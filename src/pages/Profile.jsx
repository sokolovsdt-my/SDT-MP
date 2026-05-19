import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import AvatarUpload from '../components/AvatarUpload'
import { plural } from '../utils/plural'
import { nowMskNaive, parseMskNaive } from '../utils/tz'

// ─── ЗАМЕНИ функцию MyLessons в Profile.jsx ───────────────────────────────────
// Найди: function MyLessons({ session, onBack }) {
// И замени всю функцию до следующей function MyStats

function MyLessons({ session, onBack }) {
  const [tab, setTab] = useState(() => localStorage.getItem('lessons_tab') || 'upcoming')
  const goTab = (t) => { setTab(t); localStorage.setItem('lessons_tab', t) }
  const [upcoming, setUpcoming] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const now = new Date()
    const today = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })

    // ─── 1. Обычные записи из bookings ────────────────────────────────────
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, schedule:schedule_id(id, title, starts_at, ends_at, hall, group_id, is_cancelled, groups(name), teacher:profiles!schedule_teacher_id_fkey(full_name))')
      .eq('student_id', session.user.id)
      .neq('status', 'cancelled')

    const scheduleIds = (bookings || []).map(b => b.schedule_id).filter(Boolean)
    let attMap = {}
    if (scheduleIds.length > 0) {
      const { data: attData } = await supabase
        .from('attendance')
        .select('schedule_id, basis, status')
        .eq('student_id', session.user.id)
        .in('schedule_id', scheduleIds)
      ;(attData || []).forEach(a => { attMap[a.schedule_id] = a })
    }

    // Абонементы для определения basis
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, visits_total, visits_used, expires_at, subscription_allowed_groups(group_id)')
      .eq('student_id', session.user.id)
      .eq('is_frozen', false)
      .or(`expires_at.is.null,expires_at.gte.${today}`)

    const getSubBasis = (groupId) => {
      const matching = (subs || []).find(s => {
        if (s.visits_total !== null && s.visits_used >= s.visits_total) return false
        const groups = s.subscription_allowed_groups || []
        return groups.length === 0 || groups.some(g => g.group_id === groupId)
      })
      if (!matching) return 'none'
      return matching.visits_total === null ? 'subscription' : matching.visits_total <= 1 ? 'single' : 'subscription'
    }

    const regularLessons = (bookings || []).map(b => ({
      id: `booking-${b.id}`,
      type: 'regular',
      title: b.schedule?.groups?.name || b.schedule?.title || 'Занятие',
      starts_at: b.schedule?.starts_at,
      ends_at: b.schedule?.ends_at,
      hall: b.schedule?.hall,
      teacher: b.schedule?.teacher?.full_name,
      is_cancelled: b.schedule?.is_cancelled,
      basis: attMap[b.schedule_id]?.basis || getSubBasis(b.schedule?.group_id),
      att_status: attMap[b.schedule_id]?.status || null,
      booking_id: b.id,
      canCancel: true,
    })).filter(l => l.starts_at)

    // ─── 2. Индив-запросы ──────────────────────────────────────────────────
    const { data: indivReqs } = await supabase
      .from('indiv_requests')
      .select('*, teacher:profiles!indiv_requests_teacher_id_fkey(full_name), package:indiv_packages(name)')
      .eq('client_id', session.user.id)
      .in('status', ['pending', 'confirmed'])
      .order('slot_date', { ascending: true })

    // Для подтверждённых — загружаем attendance по schedule_id
    const confirmedScheduleIds = (indivReqs || []).filter(r => r.schedule_id).map(r => r.schedule_id)
    let indivAttMap = {}
    if (confirmedScheduleIds.length > 0) {
      const { data: indivAtt } = await supabase
        .from('attendance')
        .select('schedule_id, status')
        .eq('student_id', session.user.id)
        .in('schedule_id', confirmedScheduleIds)
      ;(indivAtt || []).forEach(a => { indivAttMap[a.schedule_id] = a })
    }

    const indivLessons = (indivReqs || []).map(r => {
      const startDt = parseMskNaive(`${r.slot_date}T${r.start_time}`)
      const endDt   = parseMskNaive(`${r.slot_date}T${r.end_time}`)
      return {
        id: `indiv-${r.id}`,
        type: 'indiv',
        title: `Индив · ${r.teacher?.full_name || ''}`,
        starts_at: startDt.toISOString(),
        ends_at: endDt.toISOString(),
        hall: r.hall,
        teacher: r.teacher?.full_name,
        is_cancelled: false,
        basis: 'indiv',
        att_status: indivAttMap[r.schedule_id]?.status || null,
        indiv_status: r.status,
        package_name: r.package?.name,
        has_package: !!r.package_id,
        canCancel: r.status === 'pending' || r.status === 'confirmed',
      }
    })

    // ─── 3. Прошедшие индив-занятия из schedule (для истории) ─────────────
    const { data: pastIndivSchedule } = await supabase
      .from('schedule')
      .select('id, title, starts_at, ends_at, hall, teacher:profiles!schedule_teacher_id_fkey(full_name)')
      .eq('indiv_student_id', session.user.id)
      .eq('lesson_type', 'indiv')
      .lt('starts_at', nowMskNaive())
      .order('starts_at', { ascending: false })
      .limit(20)

    const pastIndivIds = (pastIndivSchedule || []).map(s => s.id)
    let pastIndivAttMap = {}
    if (pastIndivIds.length > 0) {
      const { data: pastAtt } = await supabase
        .from('attendance')
        .select('schedule_id, status')
        .eq('student_id', session.user.id)
        .in('schedule_id', pastIndivIds)
      ;(pastAtt || []).forEach(a => { pastIndivAttMap[a.schedule_id] = a })
    }

    const pastIndivLessons = (pastIndivSchedule || []).map(s => ({
      id: `past-indiv-${s.id}`,
      type: 'indiv',
      title: s.title || `Индив · ${s.teacher?.full_name || ''}`,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      hall: s.hall,
      teacher: s.teacher?.full_name,
      basis: 'indiv',
      att_status: pastIndivAttMap[s.id]?.status || null,
      canCancel: false,
    }))

    // ─── Объединяем ────────────────────────────────────────────────────────
    const all = [...regularLessons, ...indivLessons, ...pastIndivLessons]

    setUpcoming(
      all.filter(l => parseMskNaive(l.starts_at) >= now && !l.is_cancelled)
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    )
    setHistory(
      all.filter(l => parseMskNaive(l.starts_at) < now)
        .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))
        .slice(0, 30)
    )
    setLoading(false)
  }

  const handleCancel = async (lessonId, lesson) => {
    if (cancelling) return

    if (lessonId.startsWith('indiv-')) {
      const reqId = lessonId.replace('indiv-', '')
      const isConfirmed = lesson?.indiv_status === 'confirmed'
      const ask = isConfirmed
        ? 'Отменить подтверждённое занятие? Преподаватель будет уведомлён.'
        : 'Отменить заявку на индив?'
      if (!confirm(ask)) return
      setCancelling(true)
      const { data, error } = await supabase.rpc('cancel_indiv_request', { p_request_id: reqId })
      setCancelling(false)
      if (error) { alert('Ошибка сети: ' + error.message); return }
      if (!data?.ok) {
        const msg = {
          not_authenticated: 'Сессия истекла, войдите заново',
          forbidden:         'Можно отменять только свои заявки',
          request_not_found: 'Заявка не найдена',
          not_cancellable:   `Заявку нельзя отменить (статус: ${data.current_status})`,
          too_late:          `До занятия меньше 12 часов (${data.hours_left}ч). Обратись к администратору.`,
        }[data?.error] || `Не удалось отменить: ${data?.error || 'неизвестная ошибка'}`
        alert(msg); return
      }
      load(); return
    }

    if (!confirm('Отменить запись на занятие?')) return
    const id = lessonId.replace('booking-', '')
    setCancelling(true)
    const { data, error } = await supabase.rpc('cancel_booking', { p_booking_id: id })
    setCancelling(false)
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
    load()
  }

  const fmtDate = (d) => parseMskNaive(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' })
  const fmtTime = (d) => parseMskNaive(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
  const isToday = (d) => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    return parseMskNaive(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }) === today
  }

  const BASIS = { subscription: 'Абонемент', single: 'Разовое', trial: 'Пробное', indiv: 'Индив', none: '⚠️ Нет основания' }

  const IndivStatusBadge = ({ lesson }) => {
    if (lesson.type !== 'indiv') return null
    if (lesson.indiv_status === 'pending') return (
      <span style={{ fontSize: 11, fontWeight: 600, color: '#f39c12', background: '#fef9e7', padding: '2px 8px', borderRadius: 6 }}>
        ⏳ Ожидает подтверждения
      </span>
    )
    if (lesson.indiv_status === 'confirmed') return (
      <span style={{ fontSize: 11, fontWeight: 600, color: '#27ae60', background: '#eafaf1', padding: '2px 8px', borderRadius: 6 }}>
        ✓ Подтверждено
      </span>
    )
    return null
  }

  return (
    <div style={{ fontFamily: 'Inter,sans-serif', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', color: '#BDBDBD', fontSize: 20 }}>←</div>
        <div style={{ fontSize: 16, color: '#2a2a2a', fontWeight: 500 }}>Мои занятия</div>
      </div>
      <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid #f0f0f0' }}>
        {[['upcoming', 'Предстоящие'], ['history', 'История']].map(([v, l]) => (
          <div key={v} onClick={() => goTab(v)} style={{ padding: '12px 16px', fontSize: 13, cursor: 'pointer', color: tab === v ? '#2a2a2a' : '#BDBDBD', borderBottom: tab === v ? '2px solid #BFD900' : '2px solid transparent', fontWeight: tab === v ? 600 : 400 }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#BDBDBD', padding: 40 }}>Загрузка...</div>
        ) : tab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#BDBDBD', padding: 40, fontSize: 13 }}>Нет предстоящих занятий</div>
          ) : upcoming.map(lesson => (
            <div key={lesson.id} style={{ background: '#fff', borderRadius: 14, border: lesson.type === 'indiv' ? '1px solid #e8f4fd' : '1px solid #f0f0f0', padding: 14, marginBottom: 10 }}>
              {lesson.type === 'indiv' && (
                <div style={{ fontSize: 10, fontWeight: 700, color: '#2980b9', background: '#e8f4fd', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Индивидуальное
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a', marginBottom: 4 }}>{lesson.title}</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                {isToday(lesson.starts_at) ? 'Сегодня' : fmtDate(lesson.starts_at)} · {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
              </div>
              {lesson.teacher && <div style={{ fontSize: 11, color: '#BDBDBD', marginBottom: 2 }}>{lesson.teacher}</div>}
              {lesson.hall && <div style={{ fontSize: 11, color: '#BDBDBD', marginBottom: 8 }}>{lesson.hall}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {lesson.type === 'indiv'
                    ? <IndivStatusBadge lesson={lesson} />
                    : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: lesson.basis === 'none' ? '#e74c3c' : '#27ae60', background: lesson.basis === 'none' ? '#fdecea' : '#eafaf1', padding: '2px 8px', borderRadius: 6 }}>
                        {BASIS[lesson.basis] || lesson.basis}
                      </span>
                    )
                  }
                  {lesson.type === 'indiv' && lesson.has_package !== undefined && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: lesson.has_package ? '#27ae60' : '#f39c12', background: lesson.has_package ? '#eafaf1' : '#fef9e7', padding: '2px 8px', borderRadius: 6 }}>
                      {lesson.has_package ? '✓ Пакет оплачен' : '⚠ Нет пакета'}
                    </span>
                  )}
                </div>
                {lesson.canCancel && (
                  <button onClick={() => handleCancel(lesson.id, lesson)} disabled={cancelling}
                    style={{ fontSize: 11, color: '#e74c3c', background: 'none', border: '1px solid #fdecea', borderRadius: 8, padding: '4px 12px', cursor: cancelling ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif', opacity: cancelling ? 0.5 : 1 }}>
                    Отменить
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          history.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#BDBDBD', padding: 40, fontSize: 13 }}>История пуста</div>
          ) : (
            <>
              {(() => {
                const present = history.filter(b => b.att_status === 'present').length
                const absent = history.filter(b => b.att_status === 'absent').length
                const total = present + absent
                const pct = total > 0 ? Math.round(present / total * 100) : 0
                return (
                  <div style={{ background: '#f9f9f9', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 300, color: '#27ae60' }}>{present}</div>
                        <div style={{ fontSize: 10, color: '#BDBDBD' }}>Был</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 300, color: '#e74c3c' }}>{absent}</div>
                        <div style={{ fontSize: 10, color: '#BDBDBD' }}>Не был</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 300, color: '#2a2a2a' }}>{pct}%</div>
                        <div style={{ fontSize: 10, color: '#BDBDBD' }}>Посещ.</div>
                      </div>
                    </div>
                    <div style={{ background: '#e8e8e8', borderRadius: 4, height: 4 }}>
                      <div style={{ background: '#BFD900', borderRadius: 4, height: 4, width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })()}
              {history.map(lesson => (
                <div key={lesson.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #f8f8f8' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#2a2a2a', fontWeight: 500 }}>{lesson.title}</div>
                    <div style={{ fontSize: 11, color: '#BDBDBD', marginTop: 2 }}>{fmtDate(lesson.starts_at)} · {fmtTime(lesson.starts_at)}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                      {lesson.teacher && <span style={{ fontSize: 11, color: '#BDBDBD' }}>👤 {lesson.teacher}</span>}
                      {lesson.hall && <span style={{ fontSize: 11, color: '#BDBDBD' }}>🏛 {lesson.hall}</span>}
                      {lesson.type === 'indiv' && <span style={{ fontSize: 10, fontWeight: 600, color: '#2980b9', background: '#e8f4fd', padding: '1px 6px', borderRadius: 4 }}>Индив</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: lesson.att_status === 'present' ? '#27ae60' : lesson.att_status === 'absent' ? '#e74c3c' : '#BDBDBD', background: lesson.att_status === 'present' ? '#eafaf1' : lesson.att_status === 'absent' ? '#fdecea' : '#f5f5f5', padding: '2px 8px', borderRadius: 6, flexShrink: 0, marginLeft: 8 }}>
                    {lesson.att_status === 'present' ? '✓ Был' : lesson.att_status === 'absent' ? '✗ Не был' : '—'}
                  </span>
                </div>
              ))}
            </>
          )
        )}
      </div>
    </div>
  )
}

function MyStats({ session, onBack }) {
  const [loading, setLoading] = useState(true)
  const [totalLessons, setTotalLessons] = useState(0)
  const [totalHours, setTotalHours] = useState(0)
  const [thisMonth, setThisMonth] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestMonth, setBestMonth] = useState(null)
  const [chartData, setChartData] = useState([])
  const [chartMode, setChartMode] = useState('6months')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    // Ограничиваем выборку 24 месяцами — раньше тянулась вся история, что
    // у активного клиента превращалось в сотни строк. Все расчёты UI
    // (streak/thisMonth/чарт «6 мес» и «Всё время») укладываются в этот окно.
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 2)
    const { data: att } = await supabase
      .from('attendance')
      .select('status, created_at, schedule:schedule_id(starts_at, ends_at)')
      .eq('student_id', session.user.id)
      .gte('created_at', cutoff.toISOString())

    // Сортируем по дате занятия (schedule.starts_at), а не по времени отметки
    // (created_at) — иначе админ, отметивший занятие задним числом, ломает streak
    // и распределение по месяцам.
    const lessonDate = (a) => a.schedule?.starts_at || a.created_at
    const all = (att || []).slice().sort((a, b) => new Date(lessonDate(b)) - new Date(lessonDate(a)))
    const present = all.filter(a => a.status === 'present')
    setTotalLessons(present.length)

    const mins = present.reduce((sum, a) => {
      if (a.schedule?.starts_at && a.schedule?.ends_at)
        return sum + (new Date(a.schedule.ends_at) - new Date(a.schedule.starts_at)) / 60000
      return sum + 90
    }, 0)
    setTotalHours(Math.round(mins / 60))

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    setThisMonth(present.filter(a => new Date(lessonDate(a)) >= monthStart).length)

    let s = 0
    for (const a of all) { if (a.status === 'present') s++; else break }
    setStreak(s)

    const byMonth = {}
    present.forEach(a => {
      const d = new Date(lessonDate(a))
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      byMonth[key] = (byMonth[key] || 0) + 1
    })
    const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
    if (sorted.length > 0) {
      const best = sorted.reduce((a, b) => b[1] > a[1] ? b : a)
      const [y, m] = best[0].split('-')
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
      setBestMonth({ label: `${months[parseInt(m) - 1]} ${y}`, count: best[1] })
    }
    setChartData(sorted)
    setLoading(false)
  }

  const displayChart = chartMode === '6months' ? chartData.slice(-6) : chartData
  const maxVal = Math.max(...displayChart.map(([, v]) => v), 1)
  const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
  const monthLabel = (key) => MONTHS[parseInt(key.split('-')[1]) - 1]

  return (
    <div style={{ fontFamily: 'Inter,sans-serif', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', color: '#BDBDBD', fontSize: 20 }}>←</div>
        <div style={{ fontSize: 16, color: '#2a2a2a', fontWeight: 500 }}>Моя статистика</div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: '#BDBDBD', padding: 40 }}>Загрузка...</div>
      ) : (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: '#2a2a2a' }}>{totalLessons}</div>
              <div style={{ fontSize: 11, color: '#BDBDBD', marginTop: 4 }}>Занятий всего</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: '#2a2a2a' }}>{totalHours}</div>
              <div style={{ fontSize: 11, color: '#BDBDBD', marginTop: 4 }}>Часов всего</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#fafde8', borderRadius: 14, padding: 16, border: '1px solid #e8f0aa', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: '#6a7700' }}>{streak} 🔥</div>
              <div style={{ fontSize: 11, color: '#8a9900', marginTop: 4 }}>Серия подряд</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: '#2a2a2a' }}>{thisMonth}</div>
              <div style={{ fontSize: 11, color: '#BDBDBD', marginTop: 4 }}>В этом месяце</div>
            </div>
          </div>
          {chartData.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>По месяцам</div>
                <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: 8, padding: 2 }}>
                  {[['6months', '6 мес'], ['all', 'Всё время']].map(([v, l]) => (
                    <button key={v} onClick={() => setChartMode(v)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif', background: chartMode === v ? '#fff' : 'transparent', color: chartMode === v ? '#2a2a2a' : '#888', fontWeight: chartMode === v ? 600 : 400 }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                {displayChart.map(([key, val]) => (
                  <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: '100%', background: '#BFD900', borderRadius: '4px 4px 0 0', height: Math.max((val / maxVal) * 64, 4), opacity: 0.85 }} />
                    <div style={{ fontSize: 9, color: '#BDBDBD' }}>{monthLabel(key)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {bestMonth && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, color: '#BDBDBD', marginBottom: 4 }}>⭐ Самый активный месяц</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#2a2a2a' }}>{bestMonth.label}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{bestMonth.count} занятий</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MyIndivs({ session, onBack }) {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])
  const [totals, setTotals] = useState({ total: 0, teachers: 0 })
  // expanded[teacherId] = сколько строк видно для группы; undefined → 3 по умолчанию
  const [expanded, setExpanded] = useState({})

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('attendance')
      .select('status, schedule:schedule_id(id, starts_at, ends_at, hall, teacher:profiles!schedule_teacher_id_fkey(id, full_name))')
      .eq('student_id', session.user.id)
      .eq('basis', 'indiv')

    const items = (data || []).filter(a => a.schedule?.starts_at)

    // ─── Группировка по преподавателю ──────────────────────────────────────
    const map = new Map()
    for (const it of items) {
      const t = it.schedule.teacher
      const tid = t?.id || 'unknown'
      const tname = t?.full_name || 'Преподаватель'
      if (!map.has(tid)) map.set(tid, { teacherId: tid, teacherName: tname, items: [] })
      map.get(tid).items.push({
        id: it.schedule.id,
        starts_at: it.schedule.starts_at,
        ends_at: it.schedule.ends_at,
        hall: it.schedule.hall,
        status: it.status,
      })
    }
    const arr = Array.from(map.values())
    arr.forEach(g => g.items.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)))
    // группы — по свежести последнего индива
    arr.sort((a, b) => new Date(b.items[0].starts_at) - new Date(a.items[0].starts_at))

    setGroups(arr)
    setTotals({ total: items.length, teachers: arr.length })
    setLoading(false)
  }

  const visibleCount = (tid, total) => Math.min(expanded[tid] ?? 3, total)

  const handleShowMore = (tid, total) => {
    const cur = expanded[tid] ?? 3
    // ≤15 — раскрываем сразу всё; иначе порция по 5, последняя = остаток
    setExpanded({ ...expanded, [tid]: total <= 15 ? total : Math.min(cur + 5, total) })
  }

  const buttonLabel = (tid, total) => {
    const cur = visibleCount(tid, total)
    if (cur >= total) return null
    if (total <= 15) return `Показать все (${total})`
    return `Показать ещё (${Math.min(5, total - cur)})`
  }

  const fmtDate = (d) => parseMskNaive(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' })
  const fmtTime = (d) => parseMskNaive(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })

  return (
    <div style={{ fontFamily: 'Inter,sans-serif', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
        <div onClick={onBack} style={{ cursor: 'pointer', color: '#BDBDBD', fontSize: 20 }}>←</div>
        <div style={{ fontSize: 16, color: '#2a2a2a', fontWeight: 500 }}>Мои индивы</div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: '#BDBDBD', padding: 40 }}>Загрузка...</div>
      ) : (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: '#2a2a2a' }}>{totals.total}</div>
              <div style={{ fontSize: 11, color: '#BDBDBD', marginTop: 4 }}>Всего индивов</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: '#2a2a2a' }}>{totals.teachers}</div>
              <div style={{ fontSize: 11, color: '#BDBDBD', marginTop: 4 }}>Преподавателей</div>
            </div>
          </div>

          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#BDBDBD', padding: 40, fontSize: 13 }}>Индивов пока нет</div>
          ) : groups.map(g => {
            const total = g.items.length
            const visible = visibleCount(g.teacherId, total)
            const label = buttonLabel(g.teacherId, total)
            const slice = g.items.slice(0, visible)
            return (
              <div key={g.teacherId} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{g.teacherName}</div>
                  <div style={{ fontSize: 11, color: '#BDBDBD' }}>{total} {plural(total, ['занятие', 'занятия', 'занятий'])}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0', padding: '4px 14px' }}>
                  {slice.map((it, idx) => (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: idx < slice.length - 1 ? '1px solid #f8f8f8' : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#2a2a2a' }}>{fmtDate(it.starts_at)} · {fmtTime(it.starts_at)}–{fmtTime(it.ends_at)}</div>
                        {it.hall && <div style={{ fontSize: 11, color: '#BDBDBD', marginTop: 2 }}>🏛 {it.hall}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: it.status === 'present' ? '#27ae60' : it.status === 'absent' ? '#e74c3c' : '#BDBDBD', background: it.status === 'present' ? '#eafaf1' : it.status === 'absent' ? '#fdecea' : '#f5f5f5', padding: '2px 8px', borderRadius: 6, flexShrink: 0, marginLeft: 8 }}>
                        {it.status === 'present' ? '✓ Был' : it.status === 'absent' ? '✗ Не был' : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                {label && (
                  <button onClick={() => handleShowMore(g.teacherId, total)}
                    style={{ width: '100%', marginTop: 8, padding: '10px', background: 'transparent', border: '1px solid #e0e0e0', borderRadius: 10, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    {label}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Profile({ session }) {
  const [screen, setScreen] = useState(() => localStorage.getItem('profileScreen') || null)
  const [profile, setProfile] = useState(null)
  const [activeSub, setActiveSub] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [form, setForm] = useState({ last_name: '', first_name: '', patronymic: '', phone: '', birth_date: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const goScreen = (s) => { setScreen(s); localStorage.setItem('profileScreen', s || '') }

  useEffect(() => { load() }, [session])

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (data) {
      setProfile(data)
      setAvatarUrl(data.avatar_url || null)
      setForm({ last_name: data.last_name || '', first_name: data.first_name || '', patronymic: data.patronymic || '', phone: data.phone || '', birth_date: data.birth_date || '', email: data.email || '' })
    }
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('student_id', session.user.id)
      .eq('is_frozen', false)
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order('expires_at', { ascending: true, nullsFirst: false })
    setActiveSub(subs?.[0] || null)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const last  = form.last_name?.trim()  || null
    const first = form.first_name?.trim() || null
    const patro = form.patronymic?.trim() || null
    const { data, error } = await supabase.rpc('update_my_profile', {
      p_payload: {
        last_name:  last,
        first_name: first,
        patronymic: patro,
        phone:      form.phone?.trim() || null,
        birth_date: form.birth_date || null,
        email:      form.email?.trim() || null,
      },
    })
    setSaving(false)
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated:       'Сессия истекла, войдите заново',
        profile_not_found:       'Профиль не найден',
        birth_date_already_set:  'Дата рождения уже заполнена. Чтобы её изменить, обратись к администратору.',
        email_already_set:       'Email уже заполнен. Чтобы его изменить, обратись к администратору.',
        phone_already_set:       'Телефон уже заполнен. Чтобы его изменить, обратись к администратору.',
      }[data?.error] || `Не удалось сохранить: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    setProfile(p => ({ ...p, last_name: last, first_name: first, patronymic: patro, full_name: data.full_name }))
    setSaved(true); setTimeout(() => { setSaved(false); goScreen(null) }, 1500)
  }

  const isTechEmail = session.user.email?.startsWith('tg_')
  const greetName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.full_name || ''
  const initials = greetName ? greetName[0].toUpperCase() : '?'

  // Абонемент
  const isUnlimited = activeSub?.visits_total === null && !activeSub?.expires_at
  const subDaysLeft = activeSub?.expires_at ? Math.ceil((new Date(activeSub.expires_at) - new Date()) / 86400000) : null
  const subTotal = activeSub?.expires_at ? Math.max(1, Math.ceil((new Date(activeSub.expires_at) - new Date(activeSub.activated_at || activeSub.created_at)) / 86400000)) : 1
  const subProgress = subDaysLeft !== null ? Math.max(0, Math.min(100, (1 - subDaysLeft / subTotal) * 100)) : 0
  const subExpDate = activeSub?.expires_at ? new Date(activeSub.expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''

  if (screen === 'lessons') return <MyLessons session={session} onBack={() => goScreen(null)} />
  if (screen === 'indivs') return <MyIndivs session={session} onBack={() => goScreen(null)} />
  if (screen === 'stats') return <MyStats session={session} onBack={() => goScreen(null)} />
  if (screen === 'editing') return (
    <div style={{ fontFamily: 'Inter,sans-serif', padding: 20, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div onClick={() => goScreen(null)} style={{ cursor: 'pointer', color: '#BDBDBD', fontSize: 20 }}>←</div>
        <div style={{ fontSize: 16, color: '#2a2a2a', fontWeight: 300 }}>Редактировать профиль</div>
      </div>
      {[
        { label: 'Фамилия', key: 'last_name', placeholder: 'Соколова', type: 'text' },
        { label: 'Имя', key: 'first_name', placeholder: 'Мария', type: 'text' },
        { label: 'Отчество', key: 'patronymic', placeholder: 'Ивановна', type: 'text' },
        { label: 'Телефон', key: 'phone', placeholder: '+7 900 000 00 00', type: 'tel' },
        { label: 'Дата рождения', key: 'birth_date', placeholder: '', type: 'date' },
        { label: 'Email', key: 'email', placeholder: 'example@mail.ru', type: 'email' },
      ].map(field => (
        <div key={field.key} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#BDBDBD', marginBottom: 6, letterSpacing: '0.05em' }}>{field.label}</div>
          <input type={field.type} value={form[field.key]} placeholder={field.placeholder}
            onChange={e => setForm({ ...form, [field.key]: e.target.value })}
            style={{ width: '100%', padding: '12px 14px', border: '1px solid #e8e8e8', borderRadius: 12, fontSize: 14, boxSizing: 'border-box', fontFamily: 'Inter,sans-serif', color: '#2a2a2a', background: '#fff' }} />
        </div>
      ))}
      <button onClick={handleSave} disabled={saving}
        style={{ width: '100%', padding: 13, background: '#BFD900', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#2a2a2a', cursor: 'pointer', fontFamily: 'Inter,sans-serif', marginTop: 8 }}>
        {saved ? 'Сохранено ✓' : saving ? 'Сохраняем...' : 'Сохранить'}
      </button>
    </div>
  )

  return (
    <div style={{ fontFamily: 'Inter,sans-serif', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ marginBottom: 12 }}>
          <AvatarUpload userId={session.user.id} currentUrl={avatarUrl} size={72} onUpload={url => setAvatarUrl(url)} initials={initials} />
        </div>
        <div style={{ fontSize: 16, color: '#2a2a2a', fontWeight: 300, marginBottom: 16 }}>
          {greetName || (!isTechEmail ? session.user.email : '') || 'Профиль'}
        </div>

        {activeSub ? (
          <div style={{ background: '#fafde8', border: '1.5px solid #BFD900', borderRadius: 16, padding: '14px 16px', width: '100%', boxSizing: 'border-box', marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#8a9900', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Активный абонемент</div>
            <div style={{ fontSize: 13, color: '#2a2a2a', fontWeight: 400, marginBottom: 6 }}>{activeSub.type || 'Абонемент'}</div>
            <div style={{ fontSize: 13, color: '#2a2a2a', fontWeight: 600, marginBottom: 10 }}>
              {isUnlimited
                ? 'Безлимит · бессрочный'
                : activeSub.visits_total === null
                  ? `Безлимит · до ${subExpDate}`
                  : `Осталось ${activeSub.visits_total - (activeSub.visits_used || 0)} занятий${subExpDate ? ` · до ${subExpDate}` : ''}`
              }
            </div>
            {!isUnlimited && (
              <>
                <div style={{ background: '#e8f0aa', borderRadius: 4, height: 5, marginBottom: 6 }}>
                  <div style={{ background: '#BFD900', borderRadius: 4, height: 5, width: `${100 - subProgress}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#BDBDBD' }}>
                  {subDaysLeft !== null
                    ? <><span>Осталось {subDaysLeft} {plural(subDaysLeft, ['день', 'дня', 'дней'])}</span><span>до {subExpDate}</span></>
                    : <span>Бессрочный</span>
                  }
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 16, padding: '14px 16px', width: '100%', boxSizing: 'border-box', marginBottom: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#BDBDBD' }}>Нет активного абонемента</div>
          </div>
        )}
      </div>

      {[
        { label: 'Мои занятия', action: () => goScreen('lessons') },
        { label: 'Мои индивы', action: () => goScreen('indivs') },
        { label: 'Моя статистика', action: () => goScreen('stats') },
      ].map((item, i) => (
        <div key={i} onClick={item.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}>
          <div style={{ fontSize: 14, color: item.accent ? '#6a7700' : '#3a3a3a', fontWeight: item.accent ? 600 : 400 }}>{item.label}</div>
          <div style={{ color: '#d0d0d0', fontSize: 16 }}>›</div>
        </div>
      ))}
      <div onClick={() => goScreen('editing')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}>
        <div style={{ fontSize: 14, color: '#3a3a3a' }}>Редактировать профиль</div>
        <div style={{ color: '#d0d0d0', fontSize: 16 }}>›</div>
      </div>
      <div onClick={() => supabase.auth.signOut()} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', cursor: 'pointer' }}>
        <div style={{ fontSize: 14, color: '#ccc' }}>Выйти</div>
        <div style={{ color: '#d0d0d0', fontSize: 16 }}>›</div>
      </div>
    </div>
  )
}