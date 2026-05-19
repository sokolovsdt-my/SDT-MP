import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { nowMskNaive, toMskNaive, parseMskNaive, mskParts } from '../utils/tz'

const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
const MONTHS_FULL = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']

// d может быть schedule.starts_at (MSK naive) или Date — parseMskNaive
// корректно обрабатывает оба случая (если уже Date — игнорирует).
const fmtTime = (d) => parseMskNaive(d).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Moscow' })
const fmtDate = (d) => { const p = mskParts(d); return `${p.d} ${MONTHS[p.m - 1]}` }
const fmtDateFull = (d) => { const p = mskParts(d); return `${p.d} ${MONTHS_FULL[p.m - 1]}` }
const fmtDT = (d) => { if (!d) return '—'; return parseMskNaive(d).toLocaleString('ru-RU', { timeZone:'Europe/Moscow', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) }
const toDateStr = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })

// MSK-дата ('YYYY-MM-DD') для произвольного входа (string MSK naive или Date).
const mskDateStr = (d) => parseMskNaive(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
const isToday    = (d) => mskDateStr(d) === mskDateStr(new Date())
const isTomorrow = (d) => mskDateStr(d) === mskDateStr(new Date(Date.now() + 24*60*60*1000))

const TASK_STATUSES = [
  { value:'new', label:'Новая', color:'#2980b9', bg:'#e8f4fd' },
  { value:'in_progress', label:'В работе', color:'#27ae60', bg:'#eafaf1' },
  { value:'postponed', label:'Отложена', color:'#8e44ad', bg:'#f5eef8' },
  { value:'problem', label:'Проблема', color:'#e74c3c', bg:'#fdecea' },
  { value:'done', label:'Выполнена', color:'#27ae60', bg:'#eafaf1' },
]

function TaskHistory({ taskId, createdAt, completedAt }) {
  const [history, setHistory] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('task_history').select('*').eq('task_id', taskId).order('created_at')
      .then(({ data }) => { setHistory(data || []); setLoaded(true) })
  }, [taskId])

  if (!loaded) return <div style={{fontSize:11, color:'#BDBDBD'}}>Загрузка...</div>

  return (
    <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #f0f0f0'}}>
      <div style={{fontSize:11, color:'#888', fontWeight:600, marginBottom:6}}>История:</div>
      <div style={{fontSize:11, color:'#BDBDBD', marginBottom:4}}>
        📅 Назначена: <span style={{color:'#2a2a2a'}}>{fmtDT(createdAt)}</span>
      </div>
      {history.map((h,i) => (
        <div key={i} style={{fontSize:11, color:'#BDBDBD', marginBottom:3}}>
          <span style={{color:'#2a2a2a'}}>{fmtDT(h.created_at)}</span> — {h.comment || h.action}
        </div>
      ))}
      {completedAt && (
        <div style={{fontSize:11, color:'#27ae60', marginTop:4}}>
          ✅ Выполнена: <span style={{fontWeight:600}}>{fmtDT(completedAt)}</span>
        </div>
      )}
    </div>
  )
}

function TasksSection({ tasks, session, onReload }) {
  const [expanded, setExpanded] = useState(null)
  const [taskTab, setTaskTab] = useState('active')
  const [doneTasks, setDoneTasks] = useState([])
  const [doneLoading, setDoneLoading] = useState(false)

  useEffect(() => {
    if (taskTab === 'done') loadDone()
  }, [taskTab])

  const loadDone = async () => {
    setDoneLoading(true)
    const { data: ta } = await supabase.from('task_assignees').select('task_id').eq('user_id', session.user.id)
    const ids = (ta || []).map(x => x.task_id)
    if (ids.length === 0) { setDoneTasks([]); setDoneLoading(false); return }
    const { data: t } = await supabase.from('tasks').select('*').in('id', ids).in('status', ['done','cancelled']).order('completed_at', {ascending:false})
    setDoneTasks(t || [])
    setDoneLoading(false)
  }

  const handleStatus = async (taskId, newStatus) => {
    const isDone = newStatus === 'done'
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: isDone ? new Date().toISOString() : null,
    }).eq('id', taskId)
    await supabase.from('task_history').insert({
      task_id: taskId,
      action: 'status_changed',
      author_id: session.user.id,
      changes: { status: newStatus },
      comment: `Статус изменён на: ${TASK_STATUSES.find(s=>s.value===newStatus)?.label || newStatus}`
    })
    onReload()
  }

  const tabBtnStyle = (active) => ({
    flex:1, padding:'7px 0', borderRadius:8, border:'none', fontSize:12, cursor:'pointer',
    fontFamily:'Inter,sans-serif', fontWeight:active?600:400,
    background:active?'#fff':'transparent', color:active?'#2a2a2a':'#888'
  })

  return (
    <div>
      <div style={{display:'flex', background:'#f5f5f5', borderRadius:10, padding:4, marginBottom:16}}>
        <button onClick={() => setTaskTab('active')} style={tabBtnStyle(taskTab==='active')}>
          Активные {tasks.length > 0 && `(${tasks.length})`}
        </button>
        <button onClick={() => setTaskTab('done')} style={tabBtnStyle(taskTab==='done')}>
          Выполненные
        </button>
      </div>

      {taskTab === 'active' && (
        tasks.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:60, fontSize:13}}>Активных задач нет 🎉</div>
        ) : tasks.map(t => {
          const st = TASK_STATUSES.find(s => s.value === t.status) || TASK_STATUSES[0]
          return (
            <div key={t.id} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:14, marginBottom:10}}>
              <div onClick={() => setExpanded(expanded===t.id ? null : t.id)} style={{cursor:'pointer'}}>
                <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:6}}>{t.title}</div>
                {t.description && <div style={{fontSize:12, color:'#888', marginBottom:8, lineHeight:1.5}}>{t.description}</div>}
                <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                  <span style={{fontSize:11, padding:'3px 10px', borderRadius:6, fontWeight:600, background:st.bg, color:st.color}}>{st.label}</span>
                  {t.deadline && <span style={{fontSize:11, color: new Date(t.deadline) < new Date() ? '#e74c3c' : '#BDBDBD'}}>⏰ {fmtDate(t.deadline)}</span>}
                  <span style={{fontSize:11, color:'#BDBDBD', marginLeft:'auto'}}>{expanded===t.id ? '▲' : '▼'}</span>
                </div>
              </div>
              {expanded === t.id && (
                <div>
                  <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #f0f0f0'}}>
                    <div style={{fontSize:11, color:'#888', marginBottom:8, fontWeight:600}}>Изменить статус:</div>
                    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                      {TASK_STATUSES.map(s => (
                        <button key={s.value} onClick={() => handleStatus(t.id, s.value)}
                          style={{padding:'6px 12px', borderRadius:8, border:'none', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif',
                            fontWeight:t.status===s.value?700:400,
                            background:t.status===s.value?s.bg:'#f5f5f5',
                            color:t.status===s.value?s.color:'#888',
                            outline:t.status===s.value?`1.5px solid ${s.color}`:'none'}}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TaskHistory taskId={t.id} createdAt={t.created_at} completedAt={t.completed_at} />
                </div>
              )}
            </div>
          )
        })
      )}

      {taskTab === 'done' && (
        doneLoading ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Загрузка...</div>
        ) : doneTasks.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:60, fontSize:13}}>Выполненных задач нет</div>
        ) : doneTasks.map(t => {
          const st = TASK_STATUSES.find(s => s.value === t.status) || TASK_STATUSES[4]
          return (
            <div key={t.id} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:14, marginBottom:10, opacity:0.85}}>
              <div onClick={() => setExpanded(expanded===t.id ? null : t.id)} style={{cursor:'pointer'}}>
                <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:6}}>{t.title}</div>
                {t.description && <div style={{fontSize:12, color:'#888', marginBottom:8, lineHeight:1.5}}>{t.description}</div>}
                <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                  <span style={{fontSize:11, padding:'3px 10px', borderRadius:6, fontWeight:600, background:st.bg, color:st.color}}>{st.label}</span>
                  {t.completed_at && <span style={{fontSize:11, color:'#27ae60'}}>✅ {fmtDT(t.completed_at)}</span>}
                  <span style={{fontSize:11, color:'#BDBDBD', marginLeft:'auto'}}>{expanded===t.id ? '▲' : '▼'}</span>
                </div>
              </div>
              {expanded === t.id && (
                <TaskHistory taskId={t.id} createdAt={t.created_at} completedAt={t.completed_at} />
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function IndivsSection({ teacherId, session }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('pending')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('indiv_requests')
      .select('*, client:profiles!indiv_requests_client_id_fkey(id, full_name, phone, email), package:indiv_packages(id, name, visits_count)')
      .eq('teacher_id', teacherId)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
    setRequests(data || [])
    setLoading(false)
  }

  const filtered = requests.filter(r => {
    if (filterStatus === 'pending') return r.status === 'pending'
    if (filterStatus === 'confirmed') return r.status === 'confirmed'
    if (filterStatus === 'done') return r.status === 'rejected' || r.status === 'cancelled'
    return true
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>

  return (
    <div>
      <div style={{display:'flex', gap:6, marginBottom:16, overflowX:'auto', scrollbarWidth:'none'}}>
        {[
          ['pending', `Новые${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
          ['confirmed', 'Подтверждены'],
          ['done', 'Завершены'],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            style={{flexShrink:0, padding:'7px 16px', borderRadius:10, border:filterStatus===v?'none':'1px solid #e0e0e0', background:filterStatus===v?'#BFD900':'#fff', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:filterStatus===v?600:400, color:filterStatus===v?'#2a2a2a':'#888'}}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:60, fontSize:13}}>
          {filterStatus === 'pending' ? 'Новых запросов нет 🎉' : 'Нет записей'}
        </div>
      ) : filtered.map(r => {
        const isPending = r.status === 'pending'
        const isConfirmed = r.status === 'confirmed'
        const hasPackage = !!r.package_id
        const dateLabel = fmtDateFull(r.slot_date)
        const dayLabel = DAYS[new Date(r.slot_date + 'T00:00:00').getDay()]
        const timeLabel = `${r.start_time?.slice(0,5)} — ${r.end_time?.slice(0,5)}`
        const borderColor = isPending ? (hasPackage ? '#BFD900' : '#e74c3c') : isConfirmed ? '#27ae60' : '#BDBDBD'

        return (
          <div key={r.id} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', borderLeft:`3px solid ${borderColor}`, padding:14, marginBottom:10}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
              <div>
                <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:3}}>{r.client?.full_name || '—'}</div>
                <div style={{fontSize:12, color:'#888'}}>{dayLabel}, {dateLabel} · {timeLabel}</div>
              </div>
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4}}>
                {isPending && <span style={{fontSize:11, fontWeight:600, color:'#f39c12', background:'#fef9e7', padding:'2px 8px', borderRadius:20}}>Новый</span>}
                {isConfirmed && <span style={{fontSize:11, fontWeight:600, color:'#27ae60', background:'#eafaf1', padding:'2px 8px', borderRadius:20}}>Подтверждён</span>}
                {(r.status === 'rejected' || r.status === 'cancelled') && <span style={{fontSize:11, fontWeight:600, color:'#888', background:'#f5f5f5', padding:'2px 8px', borderRadius:20}}>Отклонён</span>}
              </div>
            </div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              <span style={{fontSize:11, fontWeight:600, color: hasPackage ? '#27ae60' : '#e74c3c', background: hasPackage ? '#eafaf1' : '#fdecea', padding:'2px 8px', borderRadius:6}}>
                {hasPackage ? `✓ ${r.package?.name || 'Пакет оплачен'}` : '✕ Нет пакета'}
              </span>
              {r.hall && <span style={{fontSize:11, color:'#888', background:'#f5f5f5', padding:'2px 8px', borderRadius:6}}>{r.hall}</span>}
              {r.client?.phone && (
                <a href={`tel:${r.client.phone}`} style={{fontSize:11, color:'#2980b9', background:'#e8f4fd', padding:'2px 8px', borderRadius:6, textDecoration:'none'}}>
                  📱 {r.client.phone}
                </a>
              )}
            </div>
            {r.reject_reason && <div style={{fontSize:11, color:'#888', marginTop:6}}>Причина: {r.reject_reason}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── 30-дневный календарь слотов для преподавателя ─────────────────────────
function SlotsCalendar({ teacherId }) {
  const [slots, setSlots] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newStart, setNewStart] = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [saving, setSaving] = useState(false)

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => { loadSlots() }, [teacherId])

  const loadSlots = async () => {
    const from = toDateStr(days[0])
    const to = toDateStr(days[days.length - 1])
    const { data } = await supabase
      .from('teacher_slot_dates')
      .select('*')
      .eq('teacher_id', teacherId)
      .gte('date', from)
      .lte('date', to)
      .order('date').order('start_time')
    setSlots(data || [])
  }

  const slotsForDate = (dateStr) => slots.filter(s => s.date === dateStr)

  const handleAdd = async () => {
    if (!selectedDate || !newStart) return
    setSaving(true)
    const [h, m] = newStart.split(':').map(Number)
    const totalMins = h * 60 + m + duration
    const endH = String(Math.floor(totalMins / 60)).padStart(2, '0')
    const endM = String(totalMins % 60).padStart(2, '0')
    await supabase.from('teacher_slot_dates').insert({
      teacher_id: teacherId,
      date: toDateStr(selectedDate),
      start_time: newStart + ':00',
      end_time: `${endH}:${endM}:00`,
      is_active: true,
    })
    setShowAdd(false)
    setSaving(false)
    loadSlots()
  }

  const handleDelete = async (id) => {
    await supabase.from('teacher_slot_dates').delete().eq('id', id)
    loadSlots()
  }

  const handleToggle = async (slot) => {
    await supabase.from('teacher_slot_dates').update({ is_active: !slot.is_active }).eq('id', slot.id)
    loadSlots()
  }

  const inp = { padding:'10px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:14, fontFamily:'Inter,sans-serif', boxSizing:'border-box', width:'100%' }
  const selectedDateStr = selectedDate ? toDateStr(selectedDate) : null
  const todayStr = toDateStr(new Date())

  return (
    <div>
      <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:12}}>Мои слоты для индивов</div>

      {/* Горизонтальный календарь */}
      <div style={{display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:8, marginBottom:16}}>
        {days.map(d => {
          const ds = toDateStr(d)
          const count = slotsForDate(ds).length
          const isSel = selectedDateStr === ds
          const isToday = ds === todayStr
          return (
            <div key={ds} onClick={() => { setSelectedDate(d); setShowAdd(false) }}
              style={{flexShrink:0, width:52, textAlign:'center', padding:'8px 4px', borderRadius:10, cursor:'pointer',
                background: isSel ? '#BFD900' : isToday ? '#fafde8' : '#fff',
                border: isSel ? 'none' : isToday ? '1px solid #BFD900' : '1px solid #f0f0f0'}}>
              <div style={{fontSize:10, color: isSel ? '#2a2a2a' : '#888', marginBottom:2}}>{DAYS[d.getDay()]}</div>
              <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a'}}>{d.getDate()}</div>
              <div style={{fontSize:10, color: isSel ? '#2a2a2a' : '#BDBDBD'}}>{MONTHS[d.getMonth()]}</div>
              {count > 0 && (
                <div style={{marginTop:4, fontSize:10, fontWeight:700, color: isSel ? '#2a2a2a' : '#27ae60'}}>{count} сл.</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Слоты выбранной даты */}
      {selectedDate ? (
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:14}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>
              {DAYS[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}
            </div>
            <button onClick={() => setShowAdd(!showAdd)}
              style={{padding:'7px 14px', background:'#BFD900', border:'none', borderRadius:8, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              + Слот
            </button>
          </div>

          {showAdd && (
            <div style={{background:'#f9f9f9', borderRadius:10, padding:12, marginBottom:12}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
                <div>
                  <div style={{fontSize:11, color:'#888', marginBottom:4}}>Начало</div>
                  <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} style={inp} />
                </div>
                <div>
                  <div style={{fontSize:11, color:'#888', marginBottom:4}}>Длительность</div>
                  <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={inp}>
                    {[30,45,60,90].map(m => <option key={m} value={m}>{m} мин</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button onClick={handleAdd} disabled={saving}
                  style={{flex:1, padding:'10px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  {saving ? 'Создаём...' : 'Добавить'}
                </button>
                <button onClick={() => setShowAdd(false)}
                  style={{padding:'10px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {slotsForDate(selectedDateStr).length === 0 ? (
            <div style={{fontSize:13, color:'#BDBDBD', textAlign:'center', padding:'12px 0'}}>Слотов нет — нажми «+ Слот»</div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {slotsForDate(selectedDateStr).map(s => (
                <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background: s.is_active ? '#f9f9f9' : '#f0f0f0', borderRadius:10, border:'1px solid #f0f0f0', opacity: s.is_active ? 1 : 0.5}}>
                  <div style={{fontSize:14, color:'#2a2a2a'}}>{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</div>
                  <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <button onClick={() => handleToggle(s)}
                      style={{fontSize:12, color: s.is_active ? '#27ae60' : '#888', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                      {s.is_active ? '✓ Вкл' : 'Выкл'}
                    </button>
                    <button onClick={() => handleDelete(s.id)}
                      style={{fontSize:12, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:24, fontSize:13}}>Выберите дату в календаре</div>
      )}
    </div>
  )
}

export default function TeacherPanel({ session }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'main'
  const [profile, setProfile] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [tasks, setTasks] = useState([])
  const [indivPendingCount, setIndivPendingCount] = useState(0)
  const [stats, setStats] = useState({ lessons: 0, students: 0, thisMonth: 0 })
  const [birthdays, setBirthdays] = useState([])
  const [scheduleView, setScheduleView] = useState('today')
  const [loading, setLoading] = useState(true)
  const [attendancePanel, setAttendancePanel] = useState(null)
  // ключ `${scheduleId}:${studentId}` — какая кнопка сейчас в процессе RPC
  const [markingKey, setMarkingKey] = useState(null)

  const hasAdminAccess = profile && ['owner','manager','admin'].includes(profile.role)
  const goTab = (t) => setSearchParams({ tab: t })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const uid = session.user.id

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(prof)

    // schedule.starts_at — MSK naive, поэтому границы тоже MSK naive (см. tz.js).
    const now    = nowMskNaive()
    const future = toMskNaive(new Date(Date.now() + 30*24*60*60*1000))
    const [ownSch, subSch] = await Promise.all([
      supabase.from('schedule')
        .select(`*, groups(name, color),
          bookings(id, student_id, status, profiles:student_id(full_name, first_name, last_name)),
          indiv_student:profiles!schedule_indiv_student_id_fkey(id, full_name, first_name, last_name),
          attendance(student_id, status),
          substitution:teacher_substitutions!teacher_substitutions_schedule_id_fkey(substitute_teacher_id)`)
        .eq('teacher_id', uid)
        .gte('starts_at', now)
        .lte('starts_at', future)
        .order('starts_at'),
      supabase.from('teacher_substitutions')
        .select(`schedule:schedule!teacher_substitutions_schedule_id_fkey!inner(
          *, groups(name, color),
          bookings(id, student_id, status, profiles:student_id(full_name, first_name, last_name)),
          indiv_student:profiles!schedule_indiv_student_id_fkey(id, full_name, first_name, last_name),
          attendance(student_id, status)
        )`)
        .eq('substitute_teacher_id', uid)
        .gte('schedule.starts_at', now)
        .lte('schedule.starts_at', future),
    ])
    const merged = new Map()
    for (const row of (ownSch.data || [])) {
      const isSub = (row.substitution || []).some(x => x.substitute_teacher_id === uid)
      merged.set(row.id, { ...row, is_substitute: isSub })
    }
    for (const r of (subSch.data || [])) {
      const s = r.schedule
      if (!s) continue
      const prev = merged.get(s.id)
      merged.set(s.id, { ...(prev || s), is_substitute: true })
    }
    setSchedule(Array.from(merged.values()).sort((a,b) => a.starts_at.localeCompare(b.starts_at)))

    const { data: ta } = await supabase.from('task_assignees')
      .select('tasks(*)')
      .eq('user_id', uid)
      .in('tasks.status', ['new','in_progress','postponed','problem'])
    setTasks((ta || []).map(t => t.tasks).filter(Boolean))

    const { count } = await supabase.from('indiv_requests')
      .select('*', { count:'exact', head:true })
      .eq('teacher_id', uid)
      .eq('status', 'pending')
    setIndivPendingCount(count || 0)

    // Статистика преподавателя через RPC — раньше тянули всю историю
    // attendance препода на клиент. Теперь агрегация COUNT/COUNT DISTINCT в БД.
    const { data: tsData } = await supabase.rpc('teacher_stats')
    if (tsData?.ok) {
      setStats({ lessons: tsData.lessons || 0, students: tsData.students || 0, thisMonth: tsData.this_month || 0 })
    } else {
      setStats({ lessons: 0, students: 0, thisMonth: 0 })
    }

    const { data: groupIds } = await supabase.from('schedule')
      .select('group_id').eq('teacher_id', uid).not('group_id', 'is', null)
    const uniqueGroupIds = [...new Set((groupIds || []).map(g => g.group_id))]
    if (uniqueGroupIds.length > 0) {
      const { data: bk } = await supabase.from('bookings')
        .select('profiles:student_id(full_name, first_name, last_name, birth_date)')
        .in('group_id', uniqueGroupIds)
        .eq('status', 'confirmed')
      const today = new Date()
      const bdays = (bk || [])
        .map(b => b.profiles).filter(p => p?.birth_date)
        .map(p => {
          const bd = new Date(p.birth_date)
          const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
          if (next < today) next.setFullYear(today.getFullYear() + 1)
          const diff = Math.ceil((next - today) / (1000*60*60*24))
          return { ...p, next, diff }
        })
        .filter(p => p.diff <= 14)
        .sort((a,b) => a.diff - b.diff)
      setBirthdays(bdays)
    }

    setLoading(false)
  }

  const attStatusFor = (lesson, studentId) =>
    (lesson?.attendance || []).find(a => a.student_id === studentId)?.status || null

  const markAtt = async (scheduleId, studentId, status) => {
    const key = `${scheduleId}:${studentId}`
    if (markingKey) return
    const lesson = schedule.find(s => s.id === scheduleId)
    const prevStatus = attStatusFor(lesson, studentId)
    if (prevStatus === status) return // идемпотентность на клиенте
    setMarkingKey(key)
    // Оптимистично обновляем локальный массив attendance этого занятия
    setSchedule(prev => prev.map(s => {
      if (s.id !== scheduleId) return s
      const att = [...(s.attendance || [])]
      const idx = att.findIndex(a => a.student_id === studentId)
      if (idx >= 0) att[idx] = { ...att[idx], status }
      else att.push({ student_id: studentId, status })
      return { ...s, attendance: att }
    }))
    const { data, error } = await supabase.rpc('mark_attendance', {
      p_schedule_id: scheduleId,
      p_student_id:  studentId,
      p_new_status:  status,
    })
    setMarkingKey(null)
    if (error || !data?.ok) {
      // Откат локального состояния — перезагрузим всё, чтобы взять достоверные данные
      loadAll()
      const msg = error
        ? 'Ошибка сети: ' + error.message
        : ({
            not_authenticated: 'Сессия истекла, войдите заново',
            forbidden:         'Недостаточно прав',
            invalid_status:    'Недопустимый статус',
            lesson_not_found:  'Занятие не найдено',
            lesson_cancelled:  'Занятие отменено — отметка невозможна',
            not_your_lesson:   'Можно отмечать только свои занятия',
            out_of_visits:        `На абонементе нет свободных визитов (${data.visits_used ?? '?'} из ${data.visits_total ?? '?'})`,
            indiv_out_of_visits:  `На индив-пакете нет свободных визитов (${data.visits_used ?? '?'} из ${data.visits_total ?? '?'}). Передайте администратору — нужен новый пакет.`,
            no_valid_basis:       data?.lesson_type === 'indiv'
              ? 'Нет оплаченного пакета на индив. Передайте администратору — оформит пакет.'
              : 'У ученика нет действующего основания. Передайте администратору — он оформит абонемент или отметит как пробное.',
          }[data?.error] || `Не удалось сохранить отметку: ${data?.error || 'неизвестная ошибка'}`)
      alert(msg)
    }
    // Успех — оптимистичный апдейт уже применён, тяжёлый loadAll не нужен.
  }

  const getName = (p) => p?.full_name || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || '—'
  const myName = profile?.first_name || profile?.full_name?.split(' ')?.[0] || '—'
  const todaySchedule = schedule.filter(s => isToday(s.starts_at))
  const weekSchedule = schedule.filter(s => {
    const d = parseMskNaive(s.starts_at)
    const now = new Date()
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return d >= now && d <= weekEnd
  })

  const totalBadge = tasks.length + indivPendingCount

  const getHour = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Доброе утро'
    if (h < 17) return 'Добрый день'
    return 'Добрый вечер'
  }

  if (loading) return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Inter,sans-serif', color:'#BDBDBD'}}>
      Загрузка...
    </div>
  )

  const NAV = [
    ['main','🏠 Главная'],
    ['schedule','📅 Расписание'],
    ['tasks', tasks.length > 0 ? `✅ Задачи (${tasks.length})` : '✅ Задачи'],
    ['indivs', indivPendingCount > 0 ? `💃 Индивы (${indivPendingCount})` : '💃 Индивы'],
    ['slots','🕐 Слоты'],
    ['profile','👤 Профиль'],
  ]

  const AttButtons = ({ status, busy, onPresent, onAbsent }) => {
    const isPresent = status === 'present'
    const isAbsent  = status === 'absent'
    const baseBtn = {
      padding:'6px 12px', borderRadius:8, fontSize:12,
      fontFamily:'Inter,sans-serif', fontWeight:600,
      cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
    }
    return (
      <div style={{display:'flex', gap:6}}>
        <button onClick={onPresent} disabled={busy}
          style={{...baseBtn,
            background: isPresent ? '#27ae60' : '#eafaf1',
            color:      isPresent ? '#fff'    : '#27ae60',
            border:     isPresent ? '1px solid #27ae60' : '1px solid transparent',
            fontWeight: isPresent ? 700 : 600,
          }}>✓ Был</button>
        <button onClick={onAbsent} disabled={busy}
          style={{...baseBtn,
            background: isAbsent ? '#e74c3c' : '#fdecea',
            color:      isAbsent ? '#fff'    : '#e74c3c',
            border:     isAbsent ? '1px solid #e74c3c' : '1px solid transparent',
            fontWeight: isAbsent ? 700 : 600,
          }}>✗ Нет</button>
      </div>
    )
  }

  const LessonCard = ({ s, showAttendance = false }) => {
    const isIndiv = s.lesson_type === 'indiv'
    const indivStudent = s.indiv_student
    const groupBookings = (s.bookings || []).filter(b => b.status === 'confirmed' || b.status === 'booked')
    const isOpen = attendancePanel === s.id

    return (
      <div style={{background:'#fff', borderRadius:14, border: isIndiv ? '1px solid #e8f4fd' : '1px solid #f0f0f0', padding:14, marginBottom:10}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div style={{flex:1}}>
            {isIndiv && (
              <div style={{fontSize:10, fontWeight:700, color:'#2980b9', background:'#e8f4fd', borderRadius:4, padding:'1px 6px', display:'inline-block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em'}}>
                Индив
              </div>
            )}
            {s.is_substitute && (
              <div style={{fontSize:10, fontWeight:700, color:'#f39c12', background:'#fef9e7', borderRadius:4, padding:'1px 6px', display:'inline-block', marginBottom:4, marginLeft: isIndiv ? 4 : 0, textTransform:'uppercase', letterSpacing:'0.06em'}}>
                Замена
              </div>
            )}
            <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:2}}>
              {isIndiv ? (getName(indivStudent) || 'Индив') : (s.groups?.name || 'Занятие')}
            </div>
            <div style={{fontSize:12, color:'#888'}}>
              {isToday(s.starts_at) ? 'Сегодня' : isTomorrow(s.starts_at) ? 'Завтра' : fmtDate(s.starts_at)}, {fmtTime(s.starts_at)} — {fmtTime(s.ends_at)}
            </div>
            <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>
              {s.hall || '—'}{!isIndiv && ` · ${groupBookings.length} чел.`}
            </div>
          </div>
          {showAttendance && (
            <button onClick={() => setAttendancePanel(isOpen ? null : s.id)}
              style={{padding:'6px 12px', background: isOpen ? '#fafde8' : '#f5f5f5', border: isOpen ? '1px solid #BFD900' : 'none', borderRadius:8, fontSize:11, fontWeight:600, color: isOpen ? '#6a7700' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif', flexShrink:0}}>
              {isOpen ? 'Закрыть' : 'Посещаемость'}
            </button>
          )}
        </div>

        {isOpen && (
          <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #f0f0f0'}}>
            {isIndiv ? (
              indivStudent ? (() => {
                const busy = markingKey === `${s.id}:${indivStudent.id}`
                const status = attStatusFor(s, indivStudent.id)
                return (
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0'}}>
                    <div>
                      <div style={{fontSize:13, color:'#2a2a2a', fontWeight:500}}>{getName(indivStudent)}</div>
                      <div style={{fontSize:11, color:'#BDBDBD'}}>Индивидуальное занятие</div>
                    </div>
                    <AttButtons status={status} busy={busy}
                      onPresent={() => markAtt(s.id, indivStudent.id, 'present')}
                      onAbsent={() => markAtt(s.id, indivStudent.id, 'absent')} />
                  </div>
                )
              })() : (
                <div style={{fontSize:12, color:'#BDBDBD'}}>Данные ученика не найдены</div>
              )
            ) : (
              groupBookings.length === 0 ? (
                <div style={{fontSize:12, color:'#BDBDBD'}}>Нет записавшихся</div>
              ) : groupBookings.map(b => {
                const busy = markingKey === `${s.id}:${b.student_id}`
                const status = attStatusFor(s, b.student_id)
                return (
                  <div key={b.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f8f8f8'}}>
                    <div style={{fontSize:13, color:'#2a2a2a'}}>{getName(b.profiles)}</div>
                    <AttButtons status={status} busy={busy}
                      onPresent={() => markAtt(s.id, b.student_id, 'present')}
                      onAbsent={() => markAtt(s.id, b.student_id, 'absent')} />
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{fontFamily:'Inter,sans-serif', background:'#F8F8F8', minHeight:'100vh', width:'100%', maxWidth:480, margin:'0 auto', boxSizing:'border-box'}}>

      <div style={{background:'#2a2a2a', padding:'16px 16px 0', position:'sticky', top:0, zIndex:10}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <div>
            <div style={{fontSize:12, color:'#888', marginBottom:2}}>{getHour()},</div>
            <div style={{fontSize:18, fontWeight:600, color:'#fff'}}>{myName} 👋</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {totalBadge > 0 && (
              <div style={{background:'#e74c3c', color:'#fff', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700}}>
                {totalBadge}
              </div>
            )}
            {hasAdminAccess && (
              <button onClick={() => navigate('/admin/dashboard')}
                style={{padding:'6px 10px', background:'#BFD900', border:'none', borderRadius:8, fontSize:11, fontWeight:600, color:'#1f2024', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                ← Админка
              </button>
            )}
            <button onClick={() => supabase.auth.signOut()}
              style={{padding:'6px 10px', background:'transparent', border:'1px solid #444', borderRadius:8, fontSize:11, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Выйти
            </button>
          </div>
        </div>
        <div style={{display:'flex', gap:2, overflowX:'auto', scrollbarWidth:'none'}}>
          {NAV.map(([v,l]) => (
            <div key={v} onClick={() => goTab(v)}
              style={{flexShrink:0, padding:'8px 12px', borderRadius:'8px 8px 0 0', fontSize:12, cursor:'pointer', fontWeight:tab===v?600:400, background:tab===v?'#F8F8F8':'transparent', color:tab===v?'#2a2a2a':'#888', whiteSpace:'nowrap'}}>
              {l}
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:'16px 16px 80px'}}>

        {tab === 'main' && (
          <div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16}}>
              <div style={{background:'#fff', borderRadius:16, padding:14, border:'1px solid #f0f0f0'}}>
                <div style={{fontSize:10, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Занятий всего</div>
                <div style={{fontSize:26, fontWeight:300, color:'#2a2a2a'}}>{stats.lessons}</div>
              </div>
              <div style={{background:'#fff', borderRadius:16, padding:14, border:'1px solid #f0f0f0'}}>
                <div style={{fontSize:10, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Уникальных учеников</div>
                <div style={{fontSize:26, fontWeight:300, color:'#2a2a2a'}}>{stats.students}</div>
              </div>
              <div style={{background:'#fafde8', borderRadius:16, padding:14, border:'1.5px solid #BFD900'}}>
                <div style={{fontSize:10, color:'#8a9900', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>В этом месяце</div>
                <div style={{fontSize:26, fontWeight:300, color:'#2a2a2a'}}>{stats.thisMonth} <span style={{fontSize:12, color:'#BFD900'}}>зан.</span></div>
              </div>
              <div style={{background: indivPendingCount > 0 ? '#fef9e7' : '#fff', borderRadius:16, padding:14, border: indivPendingCount > 0 ? '1.5px solid #f39c12' : '1px solid #f0f0f0', cursor:'pointer'}} onClick={() => goTab('indivs')}>
                <div style={{fontSize:10, color: indivPendingCount > 0 ? '#f39c12' : '#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Запросов индивов</div>
                <div style={{fontSize:26, fontWeight:300, color: indivPendingCount > 0 ? '#f39c12' : '#2a2a2a'}}>{indivPendingCount}</div>
              </div>
            </div>

            <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Сегодня</div>
            {todaySchedule.length === 0 ? (
              <div style={{background:'#fff', borderRadius:14, padding:16, marginBottom:16, border:'1px solid #f0f0f0', fontSize:13, color:'#BDBDBD', textAlign:'center'}}>
                Занятий сегодня нет 🎉
              </div>
            ) : todaySchedule.map(s => <LessonCard key={s.id} s={s} showAttendance={true} />)}

            {birthdays.length > 0 && (
              <>
                <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, marginTop:8}}>🎂 Дни рождения</div>
                {birthdays.map((p,i) => (
                  <div key={i} style={{background:'#fff', borderRadius:12, padding:'10px 14px', marginBottom:8, border:'1px solid #f0f0f0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{fontSize:13, color:'#2a2a2a'}}>{getName(p)}</div>
                    <div style={{fontSize:12, color:p.diff===0?'#e74c3c':p.diff===1?'#f39c12':'#BDBDBD', fontWeight:p.diff<=1?600:400}}>
                      {p.diff===0?'🎉 Сегодня!':p.diff===1?'🎁 Завтра':`через ${p.diff} дн.`}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'schedule' && (
          <div>
            <div style={{display:'flex', gap:6, marginBottom:16}}>
              {[['today','Сегодня'],['week','Неделя'],['month','Месяц']].map(([v,l]) => (
                <button key={v} onClick={() => setScheduleView(v)}
                  style={{padding:'7px 16px', borderRadius:10, border:scheduleView===v?'none':'1px solid #e0e0e0', background:scheduleView===v?'#BFD900':'#fff', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:scheduleView===v?600:400, color:scheduleView===v?'#2a2a2a':'#888'}}>
                  {l}
                </button>
              ))}
            </div>
            {(() => {
              const list = scheduleView==='today'?todaySchedule:scheduleView==='week'?weekSchedule:schedule
              if (list.length===0) return <div style={{textAlign:'center',color:'#BDBDBD',padding:40,fontSize:13}}>Занятий нет</div>
              return list.map(s => <LessonCard key={s.id} s={s} showAttendance={isToday(s.starts_at)} />)
            })()}
          </div>
        )}

        {tab === 'tasks' && (
          <TasksSection tasks={tasks} session={session} onReload={loadAll} />
        )}

        {tab === 'indivs' && profile && (
          <IndivsSection teacherId={session.user.id} session={session} />
        )}

        {tab === 'slots' && profile && (
          <SlotsCalendar teacherId={session.user.id} />
        )}

        {tab === 'profile' && (
          <div>
            <div style={{background:'#fff',borderRadius:16,border:'1px solid #f0f0f0',overflow:'hidden'}}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={{width:'100%',display:'block',objectFit:'contain',background:'#f0f0f0'}} />
              ) : (
                <div style={{width:'100%',height:220,background:'linear-gradient(135deg,#2a2a2a,#444)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:80,height:80,background:'#BFD900',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,fontWeight:700,color:'#2a2a2a'}}>
                    {getName(profile)[0]?.toUpperCase()}
                  </div>
                </div>
              )}
              <div style={{padding:16}}>
                <div style={{fontSize:18,fontWeight:600,color:'#2a2a2a',marginBottom:6}}>{getName(profile)}</div>
                {profile?.bio
                  ? <div style={{fontSize:13,color:'#888',lineHeight:1.6}}>{profile.bio}</div>
                  : <div style={{fontSize:13,color:'#BDBDBD'}}>Bio не заполнено — попроси администратора добавить описание</div>
                }
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}