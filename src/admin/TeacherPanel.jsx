import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

const fmtTime = (d) => new Date(d).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })
const fmtDate = (d) => { const dt = new Date(d); return `${dt.getDate()} ${MONTHS[dt.getMonth()]}` }
const isToday = (d) => { const n = new Date(), dt = new Date(d); return dt.getDate()===n.getDate() && dt.getMonth()===n.getMonth() }
const isTomorrow = (d) => { const n = new Date(); n.setDate(n.getDate()+1); const dt = new Date(d); return dt.getDate()===n.getDate() && dt.getMonth()===n.getMonth() }

const TASK_STATUSES = [
  { value:'new', label:'Новая', color:'#2980b9', bg:'#e8f4fd' },
  { value:'in_progress', label:'В работе', color:'#27ae60', bg:'#eafaf1' },
  { value:'postponed', label:'Отложена', color:'#8e44ad', bg:'#f5eef8' },
  { value:'problem', label:'Проблема', color:'#e74c3c', bg:'#fdecea' },
  { value:'done', label:'Выполнена', color:'#27ae60', bg:'#eafaf1' },
]

function TasksSection({ tasks, session, onReload }) {
  const [expanded, setExpanded] = useState(null)

  const handleStatus = async (taskId, newStatus) => {
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId)
    await supabase.from('task_history').insert({ task_id: taskId, action: 'status_changed', author_id: session.user.id, changes: { status: newStatus } })
    onReload()
  }

  if (tasks.length === 0) return (
    <div style={{textAlign:'center', color:'#BDBDBD', padding:60, fontSize:13}}>Активных задач нет 🎉</div>
  )

  return (
    <div>
      {tasks.map(t => {
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
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function TeacherPanel({ session }) {
  const [tab, setTab] = useState(() => localStorage.getItem('tp_tab') || 'main')
  const [profile, setProfile] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [tasks, setTasks] = useState([])
  const [slots, setSlots] = useState([])
  const [stats, setStats] = useState({ lessons: 0, students: 0, thisMonth: 0 })
  const [birthdays, setBirthdays] = useState([])
  const [scheduleView, setScheduleView] = useState('today')
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [newSlot, setNewSlot] = useState({ day_of_week: 1, start_time: '10:00', end_time: '18:00', duration: 60 })
  const [loading, setLoading] = useState(true)
  const [attendancePanel, setAttendancePanel] = useState(null)

  const goTab = (t) => { setTab(t); localStorage.setItem('tp_tab', t) }

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const uid = session.user.id

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(prof)

    const now = new Date().toISOString()
    const future = new Date(Date.now() + 30*24*60*60*1000).toISOString()
    const { data: sch } = await supabase.from('schedule')
      .select('*, groups(name, color), bookings(id, student_id, status, profiles:student_id(full_name, first_name, last_name))')
      .eq('teacher_id', uid)
      .gte('starts_at', now)
      .lte('starts_at', future)
      .order('starts_at')
    setSchedule(sch || [])

    const { data: ta } = await supabase.from('task_assignees')
      .select('tasks(*)')
      .eq('user_id', uid)
      .in('tasks.status', ['new','in_progress','postponed','problem'])
    setTasks((ta || []).map(t => t.tasks).filter(Boolean))

    const { data: sl } = await supabase.from('teacher_indiv_slots')
      .select('*').eq('teacher_id', uid).order('day_of_week').order('start_time')
    setSlots(sl || [])

    const { data: att } = await supabase.from('attendance')
      .select('created_at, student_id')
      .eq('teacher_id', uid)
      .eq('status', 'present')
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
    const uniqueStudents = new Set((att || []).map(a => a.student_id)).size
    const thisMonth = (att || []).filter(a => new Date(a.created_at) >= monthStart).length
    setStats({ lessons: att?.length || 0, students: uniqueStudents, thisMonth })

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

  const handleToggleSlot = async (slot) => {
    await supabase.from('teacher_indiv_slots').update({ is_active: !slot.is_active }).eq('id', slot.id)
    loadAll()
  }

  const handleDeleteSlot = async (id) => {
    if (!confirm('Удалить слот?')) return
    await supabase.from('teacher_indiv_slots').delete().eq('id', id)
    loadAll()
  }

  const handleAddSlot = async () => {
    const [sh, sm] = newSlot.start_time.split(':').map(Number)
    const [eh, em] = newSlot.end_time.split(':').map(Number)
    const dur = newSlot.duration || 60
    let cur = sh * 60 + sm
    const end = eh * 60 + em
    const inserts = []
    while (cur + dur <= end) {
      const s = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`
      const e = `${String(Math.floor((cur+dur)/60)).padStart(2,'0')}:${String((cur+dur)%60).padStart(2,'0')}`
      inserts.push({ teacher_id: session.user.id, day_of_week: Number(newSlot.day_of_week), start_time: s, end_time: e, is_active: true })
      cur += dur
    }
    if (inserts.length > 0) await supabase.from('teacher_indiv_slots').insert(inserts)
    setShowAddSlot(false)
    loadAll()
  }

  const markAttendance = async (bookingId, studentId, scheduleId, status) => {
    await supabase.from('attendance').upsert({
      schedule_id: scheduleId,
      student_id: studentId,
      teacher_id: session.user.id,
      status,
      created_at: new Date().toISOString(),
    }, { onConflict: 'schedule_id,student_id' })
    loadAll()
  }

  const getName = (p) => p?.full_name || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || '—'
  const myName = profile?.first_name || profile?.full_name?.split(' ')?.[0] || '—'
  const todaySchedule = schedule.filter(s => isToday(s.starts_at))
  const weekSchedule = schedule.filter(s => {
    const d = new Date(s.starts_at)
    const now = new Date()
    const weekEnd = new Date(); weekEnd.setDate(now.getDate() + 7)
    return d >= now && d <= weekEnd
  })

  const inputStyle = { width:'100%', padding:'10px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:14, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }

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
    ['indivs','💃 Индивы'],
    ['slots','🕐 Слоты'],
    ['profile','👤 Профиль'],
  ]

  return (
    <div style={{fontFamily:'Inter,sans-serif', background:'#F8F8F8', minHeight:'100vh', width:'100%', maxWidth:480, margin:'0 auto', boxSizing:'border-box'}}>

      <div style={{background:'#2a2a2a', padding:'16px 16px 0', position:'sticky', top:0, zIndex:10}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <div>
            <div style={{fontSize:12, color:'#888', marginBottom:2}}>{getHour()},</div>
            <div style={{fontSize:18, fontWeight:600, color:'#fff'}}>{myName} 👋</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {tasks.length > 0 && (
              <div onClick={() => goTab('tasks')} style={{background:'#e74c3c', color:'#fff', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, cursor:'pointer'}}>
                {tasks.length}
              </div>
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
              <div style={{background:'#fff', borderRadius:16, padding:14, border:'1px solid #f0f0f0', cursor:'pointer'}} onClick={() => goTab('tasks')}>
                <div style={{fontSize:10, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Задач активных</div>
                <div style={{fontSize:26, fontWeight:300, color:tasks.length>0?'#e74c3c':'#2a2a2a'}}>{tasks.length}</div>
              </div>
            </div>

            <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Сегодня</div>
            {todaySchedule.length === 0 ? (
              <div style={{background:'#fff', borderRadius:14, padding:16, marginBottom:16, border:'1px solid #f0f0f0', fontSize:13, color:'#BDBDBD', textAlign:'center'}}>
                Занятий сегодня нет 🎉
              </div>
            ) : todaySchedule.map(s => (
              <div key={s.id} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:14, marginBottom:10}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                  <div>
                    <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:3}}>{s.groups?.name || 'Индив'}</div>
                    <div style={{fontSize:12, color:'#888'}}>{fmtTime(s.starts_at)} — {fmtTime(s.ends_at)} · {s.hall || '—'}</div>
                  </div>
                  <button onClick={() => setAttendancePanel(attendancePanel===s.id ? null : s.id)}
                    style={{padding:'6px 12px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:11, fontWeight:600, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                    Посещаемость
                  </button>
                </div>
                {attendancePanel === s.id && (
                  <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #f0f0f0'}}>
                    {(s.bookings||[]).filter(b=>b.status==='confirmed').length===0 ? (
                      <div style={{fontSize:12, color:'#BDBDBD'}}>Нет записавшихся</div>
                    ) : (s.bookings||[]).filter(b=>b.status==='confirmed').map(b => (
                      <div key={b.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f8f8f8'}}>
                        <div style={{fontSize:13, color:'#2a2a2a'}}>{getName(b.profiles)}</div>
                        <div style={{display:'flex', gap:6}}>
                          <button onClick={() => markAttendance(b.id, b.student_id, s.id, 'present')}
                            style={{padding:'6px 12px', background:'#eafaf1', border:'none', borderRadius:8, fontSize:12, color:'#27ae60', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                            ✓ Был
                          </button>
                          <button onClick={() => markAttendance(b.id, b.student_id, s.id, 'absent')}
                            style={{padding:'6px 12px', background:'#fdecea', border:'none', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                            ✗ Нет
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

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
              return list.map(s => (
                <div key={s.id} style={{background:'#fff',borderRadius:14,border:'1px solid #f0f0f0',padding:14,marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:'#2a2a2a',marginBottom:2}}>{s.groups?.name||'Индив'}</div>
                      <div style={{fontSize:12,color:'#888'}}>
                        {isToday(s.starts_at)?'Сегодня':isTomorrow(s.starts_at)?'Завтра':fmtDate(s.starts_at)}, {fmtTime(s.starts_at)} — {fmtTime(s.ends_at)}
                      </div>
                      <div style={{fontSize:11,color:'#BDBDBD',marginTop:2}}>{s.hall||'—'} · {(s.bookings||[]).filter(b=>b.status==='confirmed').length} чел.</div>
                    </div>
                    {isToday(s.starts_at) && (
                      <button onClick={() => {goTab('main');setAttendancePanel(s.id)}}
                        style={{padding:'6px 10px',background:'#fafde8',border:'1px solid #BFD900',borderRadius:8,fontSize:11,color:'#6a7700',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>
                        Отметить
                      </button>
                    )}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}

        {tab === 'tasks' && (
          <TasksSection tasks={tasks} session={session} onReload={loadAll} />
        )}

        {tab === 'indivs' && (
          <div style={{textAlign:'center',color:'#BDBDBD',padding:40,fontSize:13}}>
            История записей на индивы — скоро
          </div>
        )}

        {tab === 'slots' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:600,color:'#2a2a2a'}}>Мои слоты для индивов</div>
              <button onClick={() => setShowAddSlot(!showAddSlot)}
                style={{padding:'8px 16px',background:'#BFD900',border:'none',borderRadius:8,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                + Слот
              </button>
            </div>

            {showAddSlot && (
              <div style={{background:'#fff',borderRadius:14,padding:16,marginBottom:16,border:'1px solid #f0f0f0'}}>
                <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a',marginBottom:12}}>Новые слоты</div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:'#888',marginBottom:6}}>День недели</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {[1,2,3,4,5,6,0].map(d => (
                      <button key={d} onClick={() => setNewSlot({...newSlot, day_of_week:d})}
                        style={{padding:'8px 12px',borderRadius:8,border:'none',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif',
                          fontWeight:Number(newSlot.day_of_week)===d?700:400,
                          background:Number(newSlot.day_of_week)===d?'#BFD900':'#f5f5f5',
                          color:Number(newSlot.day_of_week)===d?'#2a2a2a':'#888'}}>
                        {DAYS[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div>
                    <div style={{fontSize:11,color:'#888',marginBottom:4}}>С какого времени</div>
                    <input type="time" value={newSlot.start_time} onChange={e => setNewSlot({...newSlot,start_time:e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <div style={{fontSize:11,color:'#888',marginBottom:4}}>До какого времени</div>
                    <input type="time" value={newSlot.end_time} onChange={e => setNewSlot({...newSlot,end_time:e.target.value})} style={inputStyle} />
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:'#888',marginBottom:6}}>Длительность слота</div>
                  <div style={{display:'flex',gap:6}}>
                    {[30,45,60,90].map(m => (
                      <button key={m} onClick={() => setNewSlot({...newSlot,duration:m})}
                        style={{flex:1,padding:'8px 0',borderRadius:8,border:'none',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif',
                          fontWeight:newSlot.duration===m?700:400,
                          background:newSlot.duration===m?'#BFD900':'#f5f5f5',
                          color:newSlot.duration===m?'#2a2a2a':'#888'}}>
                        {m} мин
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const preview = []
                  const [sh,sm] = newSlot.start_time.split(':').map(Number)
                  const [eh,em] = newSlot.end_time.split(':').map(Number)
                  const dur = newSlot.duration||60
                  let cur = sh*60+sm
                  const end = eh*60+em
                  while (cur+dur<=end) {
                    const s = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`
                    const e = `${String(Math.floor((cur+dur)/60)).padStart(2,'0')}:${String((cur+dur)%60).padStart(2,'0')}`
                    preview.push(`${s} — ${e}`)
                    cur+=dur
                  }
                  if (preview.length===0) return null
                  return (
                    <div style={{background:'#f9f9f9',borderRadius:10,padding:10,marginBottom:14}}>
                      <div style={{fontSize:11,color:'#888',marginBottom:6}}>Будет создано {preview.length} слот{preview.length===1?'':preview.length<5?'а':'ов'}:</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {preview.map(p => (
                          <span key={p} style={{fontSize:12,background:'#fff',border:'1px solid #e0e0e0',borderRadius:6,padding:'3px 8px',color:'#2a2a2a'}}>{p}</span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                <div style={{display:'flex',gap:8}}>
                  <button onClick={handleAddSlot}
                    style={{flex:1,padding:'11px',background:'#BFD900',border:'none',borderRadius:10,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    Создать слоты
                  </button>
                  <button onClick={() => setShowAddSlot(false)}
                    style={{padding:'11px 16px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:10,fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {slots.length===0 ? (
              <div style={{textAlign:'center',color:'#BDBDBD',padding:40,fontSize:13}}>Слотов нет — добавь первый</div>
            ) : [1,2,3,4,5,6,0].map(day => {
              const daySlots = slots.filter(s=>s.day_of_week===day)
              if (daySlots.length===0) return null
              return (
                <div key={day} style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#888',marginBottom:6}}>{DAYS[day]}</div>
                  {daySlots.map(s => (
                    <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:6,border:'1px solid #f0f0f0',opacity:s.is_active?1:0.5}}>
                      <div style={{fontSize:14,color:'#2a2a2a'}}>{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</div>
                      <div style={{display:'flex',gap:10}}>
                        <button onClick={() => handleToggleSlot(s)}
                          style={{fontSize:12,color:s.is_active?'#27ae60':'#888',background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>
                          {s.is_active?'✓ Вкл':'Выкл'}
                        </button>
                        <button onClick={() => handleDeleteSlot(s.id)}
                          style={{fontSize:12,color:'#e74c3c',background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
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