import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { requestPermission } from '../firebase'
import { parseMskNaive, mskDayStartNaive, mskDayEndNaive } from '../utils/tz'

const DAYS_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function getDays(count = 30) {
  const days = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push({ name: DAYS_RU[d.getDay()], num: d.getDate(), date: d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }) })
  }
  return days
}

export default function Schedule({ session, onShop }) {
  // DAYS — реактивное состояние с пересчётом по смене календарной даты.
  // Раньше массив фиксировался при загрузке модуля; PWA, открытое сутками,
  // показывал устаревший «Сегодня».
  const [DAYS, setDAYS] = useState(() => getDays(30))
  useEffect(() => {
    const tick = () => setDAYS(getDays(30))
    // Считаем мс до начала следующего дня в МСК
    const now = new Date()
    const nextMidnightMsk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }))
    nextMidnightMsk.setHours(24, 0, 10, 0)  // через 10 секунд после полуночи МСК
    const delay = Math.max(60_000, nextMidnightMsk.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })).getTime())
    const timer = setTimeout(tick, delay)
    // Дополнительно обновляем при возврате фокуса в окно
    window.addEventListener('focus', tick)
    return () => { clearTimeout(timer); window.removeEventListener('focus', tick) }
  }, [])

  const [activeDay, setActiveDay] = useState(() => {
    const saved = parseInt(localStorage.getItem('schedule_day') || '0')
    return saved < DAYS.length ? saved : 0
  })
  const [classes, setClasses] = useState([])
  const [booked, setBooked] = useState([]) // schedule_id[]
  const [bookingIds, setBookingIds] = useState({}) // schedule_id → booking.id
  const [showPushBanner, setShowPushBanner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dayEvents, setDayEvents] = useState([])

  const goDay = (i) => { setActiveDay(i); localStorage.setItem('schedule_day', i) }

  const loadBooked = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('id, schedule_id')
      .eq('student_id', session.user.id)
      .eq('status', 'booked')
    const ids = {}
    ;(data || []).forEach(b => { ids[b.schedule_id] = b.id })
    setBookingIds(ids)
    setBooked((data || []).map(b => b.schedule_id))
  }

  useEffect(() => { loadBooked() }, [])

  useEffect(() => {
    const getClasses = async () => {
      setLoading(true)
      // schedule.starts_at — MSK naive, фильтр границ дня тоже MSK naive (без TZ-маркера).
      const from = mskDayStartNaive(DAYS[activeDay].date)
      const to   = mskDayEndNaive(DAYS[activeDay].date)
      const { data } = await supabase
        .from('schedule')
        .select(`
          *,
          groups(name, color),
          teacher:profiles!schedule_teacher_id_fkey(full_name, first_name),
          substitution:teacher_substitutions!teacher_substitutions_schedule_id_fkey(
            original_teacher:profiles!teacher_substitutions_original_teacher_id_fkey(full_name, first_name),
            substitute_teacher:profiles!teacher_substitutions_substitute_teacher_id_fkey(full_name, first_name)
          )
        `)
        .gte('starts_at', from)
        .lte('starts_at', to)
        .eq('is_cancelled', false)
        .order('starts_at')
      setClasses(data || [])
      setLoading(false)
    }
    getClasses()

    const getEvents = async () => {
      const dateStr = DAYS[activeDay].date
      const { data } = await supabase
        .from('event_dates')
        .select('*, event:events!event_dates_event_id_fkey(id, name, description, hall, price, image_url, is_available_online, allow_client_booking)')
        .lte('date_start', dateStr)
        .gte('date_end', dateStr)
        .eq('event.is_active', true)
      setDayEvents((data || []).filter(d => d.event))
    }
    getEvents()
  }, [activeDay])

  const formatTime = (dt) => parseMskNaive(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })

  const handleBook = async (cls) => {
    if (booked.includes(cls.id)) return

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, visits_total, visits_used, expires_at, subscription_allowed_groups(group_id)')
      .eq('student_id', session.user.id)
      .eq('is_frozen', false)
      .or(`expires_at.is.null,expires_at.gte.${today}`)

    const matching = (subs || []).find(s => {
      if (s.visits_total !== null && s.visits_used >= s.visits_total) return false
      const groups = s.subscription_allowed_groups || []
      if (groups.length === 0) return true
      return groups.some(g => g.group_id === cls.group_id)
    })

    if (!matching) {
      const hasAny = (subs || []).length > 0
      alert(!hasAny
        ? 'У вас нет активного абонемента. Приобретите его в магазине.'
        : 'Ваш абонемент не подходит для этой группы или закончились занятия.')
      return
    }

    const { error } = await supabase.from('bookings').insert({
      student_id: session.user.id,
      schedule_id: cls.id,
      status: 'booked',
    })

    if (!error) {
      setBooked(prev => [...prev, cls.id])
      // Баннер показываем только если push-разрешение ещё не дано/не запрошено
      // и пользователь ранее не нажимал «Не сейчас».
      const dismissed = localStorage.getItem('push_banner_dismissed') === '1'
      const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied'
      if (!dismissed && perm === 'default') setShowPushBanner(true)
      // Перезагружаем bookings чтобы получить id для отмены
      loadBooked()
    }
  }

  const handleCancel = async (cls) => {
    const bookingId = bookingIds[cls.id]
    if (!bookingId) return
    const { data, error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated: 'Сессия истекла, войдите заново',
        forbidden:         'Можно отменять только свои записи',
        booking_not_found: 'Запись не найдена',
        already_cancelled: 'Запись уже отменена',
        too_late:          `До занятия меньше 12 часов (${data.hours_left}ч). Обратись к администратору.`,
      }[data?.error] || `Не удалось отменить: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    setBooked(prev => prev.filter(id => id !== cls.id))
    setBookingIds(prev => { const n = { ...prev }; delete n[cls.id]; return n })
  }

  const getTeacherName = (cls) => {
    const t = cls.teacher
    if (!t) return null
    return t.first_name || t.full_name?.split(' ')[1] || t.full_name || null
  }

  const getSubstitution = (cls) => {
    const sub = cls.substitution?.[0]
    if (!sub) return null
    const orig = sub.original_teacher
    const subst = sub.substitute_teacher
    const origName = orig?.first_name || orig?.full_name?.split(' ')[1] || orig?.full_name
    const substName = subst?.first_name || subst?.full_name?.split(' ')[1] || subst?.full_name
    return { origName, substName }
  }

  return (
    <div style={{ fontFamily: 'Inter,sans-serif' }}>
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, color: '#2a2a2a', fontWeight: 300, fontFamily: 'sans-serif' }}>Расписание</div>
          <button onClick={() => { setActiveDay(0); localStorage.setItem('schedule_day', '0') }}
            style={{ padding: '5px 14px', background: '#BFD900', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#2a2a2a', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Сегодня
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {DAYS.map((day, i) => (
            <div key={i} onClick={() => goDay(i)} style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '8px 11px', borderRadius: 14,
              border: activeDay === i ? 'none' : '1px solid #e8e8e8',
              background: activeDay === i ? '#BFD900' : '#fff', cursor: 'pointer'
            }}>
              <span style={{ fontSize: 9, color: activeDay === i ? '#5a6600' : '#BDBDBD', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{day.name}</span>
              <span style={{ fontSize: 15, color: '#2a2a2a', fontWeight: activeDay === i ? 600 : 300 }}>{day.num}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 20px 0' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: '#BDBDBD', padding: '20px 0', textAlign: 'center' }}>Загрузка...</div>
        ) : classes.length === 0 ? (
          <div style={{ fontSize: 13, color: '#BDBDBD', padding: '20px 0', textAlign: 'center' }}>Занятий нет</div>
        ) : classes.map(cls => {
          const isBooked = booked.includes(cls.id)
          const title = cls.groups?.name || cls.title || 'Занятие'
          const teacherName = getTeacherName(cls)
          const sub = getSubstitution(cls)
          const isIndiv = !!cls.indiv_student_id
          const isEvent = !!cls.event_id
          // Запись/отмена бессмысленны если занятие уже стартовало.
          // Фильтр БД грубый (по дню), поэтому для сегодняшнего дня после
          // времени старта кнопку прячем.
          const hasStarted = parseMskNaive(cls.starts_at) <= new Date()

          return (
            <div key={cls.id} style={{
              background: '#fff', borderRadius: 16, padding: '14px 16px',
              marginBottom: 10, border: '1px solid #f0f0f0',
              borderLeft: isEvent ? '3px solid #7B1FA2' : isIndiv ? '3px solid #5A8A7C' : '3px solid #BFD900'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: isEvent ? '#7B1FA2' : isIndiv ? '#5A8A7C' : '#6a7700', fontWeight: 600, marginBottom: 4 }}>
                    {formatTime(cls.starts_at)} — {formatTime(cls.ends_at)}
                  </div>
                  <div style={{ fontSize: 14, color: '#2a2a2a', fontWeight: 500, marginBottom: 2 }}>{title}</div>
                  {cls.hall && <div style={{ fontSize: 11, color: '#BDBDBD', marginBottom: 3 }}>{cls.hall}</div>}
                  {sub ? (
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                      <span style={{ color: '#f39c12', fontWeight: 600 }}>Замена: </span>
                      <span style={{ color: '#2a2a2a' }}>{sub.substName}</span>
                      <span style={{ color: '#BDBDBD' }}> (вместо {sub.origName})</span>
                    </div>
                  ) : teacherName ? (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{teacherName}</div>
                  ) : null}
                </div>

                {!isIndiv && !hasStarted && (
                  <button
                    onClick={() => isBooked ? handleCancel(cls) : handleBook(cls)}
                    style={{
                      background: isBooked ? '#fdecea' : '#BFD900',
                      color: isBooked ? '#e74c3c' : '#2a2a2a',
                      border: isBooked ? '1px solid #fdecea' : 'none',
                      borderRadius: 10, padding: '7px 13px',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      whiteSpace: 'nowrap', fontFamily: 'Inter,sans-serif', flexShrink: 0
                    }}>
                    {isBooked ? 'Отменить ✕' : 'Записаться'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {dayEvents.length > 0 && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ fontSize: 11, color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>
            Мероприятия
          </div>
          {dayEvents.map(d => {
            const ev = d.event
            return (
              <div key={d.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '1px solid #f0f0f0', borderLeft: '3px solid #8e44ad' }}>
                <div style={{ fontSize: 11, color: '#8e44ad', fontWeight: 600, marginBottom: 4 }}>
                  🎭 Мероприятие{d.time_start ? ` · ${d.time_start.slice(0, 5)}${d.time_end ? '–' + d.time_end.slice(0, 5) : ''}` : ''}
                </div>
                <div style={{ fontSize: 14, color: '#2a2a2a', fontWeight: 500, marginBottom: 4 }}>{ev.name}</div>
                {ev.hall && <div style={{ fontSize: 11, color: '#BDBDBD', marginBottom: 4 }}>{ev.hall}</div>}
                {ev.description && <div style={{ fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>{ev.description}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {ev.price && <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2a2a' }}>{Number(ev.price).toLocaleString('ru-RU')} ₽</div>}
                  {ev.allow_client_booking && (
                    <button onClick={() => onShop?.()}
                      style={{ background: '#BFD900', border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 12, fontWeight: 700, color: '#2a2a2a', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                      Записаться →
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showPushBanner && (
        <div style={{ margin: '16px 20px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, color: '#2a2a2a', fontWeight: 500, marginBottom: 6 }}>🔔 Узнавайте первыми об изменениях в расписании и отменах занятий</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={async () => {
              const token = await requestPermission()
              if (token) await supabase.rpc('register_push_token', { p_token: token })
              setShowPushBanner(false)
            }} style={{ flex: 1, padding: '10px', background: '#BFD900', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#2a2a2a', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
              Включить
            </button>
            <button onClick={() => { localStorage.setItem('push_banner_dismissed', '1'); setShowPushBanner(false) }}
              style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #e0e0e0', borderRadius: 12, fontSize: 13, color: '#BDBDBD', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
              Не сейчас
            </button>
          </div>
        </div>
      )}
    </div>
  )
}