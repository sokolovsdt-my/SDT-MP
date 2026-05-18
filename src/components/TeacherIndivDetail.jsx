import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { plural } from '../utils/plural'
import { parseMskNaive } from '../utils/tz'

// ─── Общий блок для индив-флоу клиента ────────────────────────────────────────
// Используется в src/pages/Shop.jsx (категория «Индивы») и src/pages/Team.jsx.
// Раньше эта же логика дублировалась полностью в обоих файлах (~250 строк
// каждый) — любая правка индив-флоу делалась дважды.
//
// Что внутри: два таба «Пакеты» / «Записаться», загрузка indiv_packages +
// teacher_slot_dates (с фильтром уже занятых слотов по indiv_requests),
// активный indiv_subscriptions клиента у этого препода, секция «Ваши заявки»
// с отменой через RPC, запись через RPC create_indiv_request.
//
// Снаружи родитель сам рисует хедер (аватар, имя, bio, список групп) — это
// у Shop и Team разное.
const DAYS_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

export default function TeacherIndivDetail({ teacherId, session }) {
  const [tab, setTab] = useState('indiv')
  const [indivProducts, setIndivProducts] = useState([])
  const [slots, setSlots] = useState([])
  const [clientPackage, setClientPackage] = useState(null)
  const [myRequests, setMyRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingDone, setBookingDone] = useState(null)
  const [bookingError, setBookingError] = useState('')
  const [bookingSlot, setBookingSlot] = useState(null)
  const [savingSlot, setSavingSlot] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => { load() }, [teacherId])

  const load = async () => {
    setLoading(true)
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    const future = new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })

    // БД-гарантия (partial UNIQUE) не даст создать вторую заявку на слот,
    // но без UX-фильтра клиент жмёт «Записаться» и получает slot_taken.
    const [{ data: pkgs }, { data: sl }, { data: busy }] = await Promise.all([
      supabase.from('indiv_packages').select('*')
        .eq('teacher_id', teacherId).eq('is_active', true).order('sort_order'),
      supabase.from('teacher_slot_dates').select('*')
        .eq('teacher_id', teacherId).eq('is_active', true)
        .gte('date', today).lte('date', future)
        .order('date').order('start_time'),
      supabase.from('indiv_requests').select('slot_date, start_time')
        .eq('teacher_id', teacherId).in('status', ['pending','confirmed'])
        .gte('slot_date', today),
    ])
    setIndivProducts(pkgs || [])
    const busySet = new Set((busy || []).map(b => `${b.slot_date}:${b.start_time}`))
    setSlots((sl || []).filter(s => !busySet.has(`${s.date}:${s.start_time}`)))

    if (session?.user?.id) {
      const { data: pkg } = await supabase
        .from('indiv_subscriptions')
        .select('id, visits_total, visits_used, expires_at')
        .eq('client_id', session.user.id)
        .eq('teacher_id', teacherId)
        .eq('is_frozen', false)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      // Безлимит-пакет: visits_total = null. Не сравниваем — NaN-comparisons дают false.
      const isValid = pkg && (pkg.visits_total === null || pkg.visits_used < pkg.visits_total)
      setClientPackage(isValid ? pkg : null)
      await loadMyRequests()
    }

    setLoading(false)
  }

  const loadMyRequests = async () => {
    if (!session?.user?.id) return
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    const { data } = await supabase
      .from('indiv_requests')
      .select('id, slot_date, start_time, end_time, hall, status')
      .eq('client_id', session.user.id)
      .eq('teacher_id', teacherId)
      .in('status', ['pending', 'confirmed'])
      .gte('slot_date', today)
      .order('slot_date').order('start_time')
    setMyRequests(data || [])
  }

  const handleCancelRequest = async (req) => {
    if (cancellingId) return
    const ask = req.status === 'confirmed'
      ? 'Отменить подтверждённое занятие? Преподаватель будет уведомлён.'
      : 'Отменить заявку на индив?'
    if (!confirm(ask)) return
    setCancellingId(req.id)
    const { data, error } = await supabase.rpc('cancel_indiv_request', { p_request_id: req.id })
    setCancellingId(null)
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
    // После отмены — освободившийся слот должен снова стать доступным
    load()
  }

  const handleBook = async (dateStr, slot) => {
    if (savingSlot) return
    setBookingSlot(slot.id)
    setBookingError('')
    setSavingSlot(true)
    const { data, error } = await supabase.rpc('create_indiv_request', {
      p_teacher_id: teacherId,
      p_slot_date:  dateStr,
      p_start_time: slot.start_time,
      p_end_time:   slot.end_time,
    })
    setSavingSlot(false)
    setBookingSlot(null)
    if (error) { setBookingError('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated:     'Сессия истекла, войдите заново',
        invalid_params:        'Некорректные параметры записи',
        invalid_time_range:    'Время окончания должно быть позже начала',
        slot_in_past:          'Слот уже в прошлом — обновите страницу',
        slot_not_found:        'Слот недоступен — обновите страницу',
        slot_taken:            'Этот слот только что заняли — обновите страницу',
        already_booked_by_you: 'Вы уже записаны на этот слот',
      }[data?.error] || `Не удалось записаться: ${data?.error || 'неизвестная ошибка'}`
      setBookingError(msg); return
    }
    const d = new Date(dateStr + 'T00:00:00')
    setBookingDone(`${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}, ${slot.start_time.slice(0,5)}–${slot.end_time.slice(0,5)}`)
    // После успешной записи занятый слот должен пропасть из списка
    load()
  }

  // Группируем слоты по дате
  const slotsByDate = {}
  slots.forEach(s => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = []
    slotsByDate[s.date].push(s)
  })

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>

  return (
    <div>
      <div style={{display:'flex', borderBottom:'1px solid #f0f0f0', marginBottom:16}}>
        {[['indiv','Пакеты'],['slots','Записаться']].map(([v,l]) => (
          <div key={v} onClick={() => setTab(v)}
            style={{padding:'10px 16px', fontSize:13, cursor:'pointer', color:tab===v?'#2a2a2a':'#BDBDBD', borderBottom:tab===v?'2px solid #BFD900':'2px solid transparent', fontWeight:tab===v?600:400}}>
            {l}
          </div>
        ))}
      </div>

      {tab === 'indiv' && (
        indivProducts.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Индивы не настроены</div>
        ) : indivProducts.map(p => (
          <div key={p.id} style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:16, marginBottom:12}}>
            <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>{p.name}</div>
            <div style={{fontSize:11, color:'#BDBDBD', marginBottom:12}}>
              {p.visits_count} {plural(p.visits_count, ['занятие','занятия','занятий'])} · {p.duration_days} {plural(p.duration_days, ['день','дня','дней'])}
            </div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontSize:20, color:'#2a2a2a', fontWeight:300}}>{Number(p.price).toLocaleString('ru-RU')} <span style={{fontSize:12, color:'#BDBDBD'}}>₽</span></div>
              <button onClick={() => alert('Оплата скоро будет доступна!')}
                style={{background:'#BFD900', border:'none', borderRadius:12, padding:'9px 20px', fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                Купить
              </button>
            </div>
          </div>
        ))
      )}

      {tab === 'slots' && (
        <div style={{paddingBottom:20}}>
          {clientPackage ? (
            <div style={{background:'#eafaf1', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#27ae60'}}>
              ✓ Есть пакет · осталось {clientPackage.visits_total - clientPackage.visits_used} занятий
            </div>
          ) : (
            <div style={{background:'#fef9e7', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#f39c12'}}>
              Нет активного пакета — после записи нужно оплатить индив
            </div>
          )}

          {myRequests.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Ваши заявки</div>
              {myRequests.map(r => {
                const d = new Date(r.slot_date + 'T00:00:00')
                const isPending = r.status === 'pending'
                // Заявка уже стартовала / прошла — отмена бессмысленна
                // (RPC всё равно отобьёт too_late для confirmed, но дёргать его
                // нет смысла — кнопку прячем).
                const hasStarted = parseMskNaive(`${r.slot_date}T${r.start_time}`) <= new Date()
                return (
                  <div key={r.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', borderRadius:12, padding:'10px 14px', marginBottom:6, border:'1px solid #f0f0f0', borderLeft:`3px solid ${isPending ? '#f39c12' : '#27ae60'}`}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, color:'#2a2a2a'}}>{DAYS_SHORT[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()]} · {r.start_time.slice(0,5)}–{r.end_time.slice(0,5)}</div>
                      <span style={{display:'inline-block', marginTop:4, fontSize:11, fontWeight:600, color: isPending ? '#f39c12' : '#27ae60', background: isPending ? '#fef9e7' : '#eafaf1', padding:'2px 8px', borderRadius:6}}>
                        {isPending ? '⏳ Ожидает подтверждения' : '✓ Подтверждено'}
                      </span>
                    </div>
                    {!hasStarted && (
                      <button onClick={() => handleCancelRequest(r)} disabled={cancellingId === r.id}
                        style={{fontSize:11, color:'#e74c3c', background:'none', border:'1px solid #fdecea', borderRadius:8, padding:'4px 12px', cursor: cancellingId === r.id ? 'default' : 'pointer', fontFamily:'Inter,sans-serif', flexShrink:0, marginLeft:8, opacity: cancellingId === r.id ? 0.5 : 1}}>
                        Отменить
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {bookingDone && (
            <div style={{background:'#eafaf1', borderRadius:12, padding:16, marginBottom:16, textAlign:'center'}}>
              <div style={{fontSize:20, marginBottom:6}}>✅</div>
              <div style={{fontSize:14, fontWeight:600, color:'#27ae60', marginBottom:4}}>Запрос отправлен!</div>
              <div style={{fontSize:12, color:'#888'}}>{bookingDone}</div>
              <div style={{fontSize:12, color:'#888', marginTop:4}}>Администратор подтвердит и свяжется с вами</div>
              <button onClick={() => setBookingDone(null)}
                style={{marginTop:12, background:'#BFD900', border:'none', borderRadius:10, padding:'8px 20px', fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                Записаться ещё
              </button>
            </div>
          )}

          {bookingError && (
            <div style={{background:'#fdecea', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#e74c3c'}}>{bookingError}</div>
          )}

          {Object.keys(slotsByDate).length === 0 ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Расписание не указано</div>
          ) : Object.entries(slotsByDate).map(([dateStr, daySlots]) => {
            const d = new Date(dateStr + 'T00:00:00')
            return (
              <div key={dateStr} style={{marginBottom:16}}>
                <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>
                  {DAYS_SHORT[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()]}
                </div>
                {daySlots.map(s => (
                  <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', borderRadius:12, padding:'10px 14px', marginBottom:6, border:'1px solid #f0f0f0'}}>
                    <div style={{fontSize:13, color:'#2a2a2a'}}>{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</div>
                    <button disabled={savingSlot && bookingSlot === s.id} onClick={() => handleBook(dateStr, s)}
                      style={{background:'#BFD900', border:'none', borderRadius:8, padding:'6px 16px', fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: savingSlot && bookingSlot === s.id ? 0.5 : 1}}>
                      {savingSlot && bookingSlot === s.id ? '...' : 'Записаться'}
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
