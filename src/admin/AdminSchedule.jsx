import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import AttendancePanel from './AttendancePanel'

const GROUP_COLORS = [
  { bg: '#EDF4F0', border: '#7C9885', text: '#3d5c45' },
  { bg: '#F0ECF7', border: '#8B7BA8', text: '#4a3a6e' },
  { bg: '#F7EDEA', border: '#C17B5A', text: '#7a3e25' },
  { bg: '#EAF1F7', border: '#5A8FA8', text: '#2a5570' },
  { bg: '#F7F0EA', border: '#A8855A', text: '#6b4e25' },
  { bg: '#EFEFEF', border: '#7A7A7A', text: '#4a4a4a' },
]
const INDIV_COLOR = { bg: '#EAF4F2', border: '#5A8A7C', text: '#2a5a4e' }

const DAYS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const HOUR_HEIGHT = 64
const START_HOUR = 8
const END_HOUR = 23
const HOURS = Array.from({length: END_HOUR - START_HOUR + 1}, (_, i) => i + START_HOUR)

const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }
const labelStyle = { fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block' }

function getWeekDays(date) {
  const d = new Date(date)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({length:7}, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd
  })
}

function getMonthDays(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1
  const days = []
  for (let i = 0; i < startDay; i++) days.push({ date: new Date(year, month, 1 - startDay + i), current: false })
  for (let i = 1; i <= last.getDate(); i++) days.push({ date: new Date(year, month, i), current: true })
  while (days.length % 7 !== 0) days.push({ date: new Date(year, month + 1, days.length - last.getDate() - startDay + 1), current: false })
  return days
}

function formatTime(dt) {
  return new Date(dt).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })
}
function formatDate(dt) {
  return new Date(dt).toLocaleDateString('ru-RU', { day:'numeric', month:'short' })
}
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}

function getEventColor(ev, groupColorMap, groupNameMap) {
  if (ev.indiv_student_id) return INDIV_COLOR
  if (ev.group_id && groupColorMap[ev.group_id]) return groupColorMap[ev.group_id]
  if (ev.title && groupNameMap?.[ev.title]) return groupNameMap[ev.title]
  if (ev.groups?.name && groupNameMap?.[ev.groups.name]) return groupNameMap[ev.groups.name]
  return GROUP_COLORS[0]
}

function getEventStyle(ev) {
  const start = new Date(ev.starts_at)
  const end = new Date(ev.ends_at)
  const startMins = (start.getHours() - START_HOUR) * 60 + start.getMinutes()
  const durationMins = (end - start) / 60000
  const top = (startMins / 60) * HOUR_HEIGHT
  const height = Math.max((durationMins / 60) * HOUR_HEIGHT - 2, 20)
  return { top, height }
}

function ScheduleForm({ session, teachers, students, groups, onSave, onCancel, initial = null, initialDate = null }) {
  const [type, setType] = useState(initial?.indiv_student_id ? 'indiv' : 'group')
  const [form, setForm] = useState({
    title: initial?.title || '',
    teacher_id: initial?.teacher_id || '',
    hall: initial?.hall || '',
    date: initialDate ? initialDate.toISOString().split('T')[0] : (initial?.starts_at ? new Date(initial.starts_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
    time_from: initial?.starts_at ? formatTime(initial.starts_at) : '18:00',
    time_to: initial?.ends_at ? formatTime(initial.ends_at) : '19:00',
    group_id: initial?.group_id || '',
    student_id: initial?.indiv_student_id || '',
    repeat: 'none',
    repeat_until: '',
    repeat_days: [],
  })
  const [conflict, setConflict] = useState(null)
  const [saving, setSaving] = useState(false)

  const toggleRepeatDay = (d) => setForm(f => ({
    ...f, repeat_days: f.repeat_days.includes(d) ? f.repeat_days.filter(x => x !== d) : [...f.repeat_days, d]
  }))

  const checkConflict = async () => {
    if (!form.hall || !form.date || !form.time_from || !form.time_to) return false
    const starts = new Date(`${form.date}T${form.time_from}`)
    const ends = new Date(`${form.date}T${form.time_to}`)
    const { data } = await supabase.from('schedule')
      .select('id, title, starts_at, ends_at')
      .eq('hall', form.hall)
      .neq('id', initial?.id || '00000000-0000-0000-0000-000000000000')
      .lt('starts_at', ends.toISOString())
      .gt('ends_at', starts.toISOString())
    if (data && data.length > 0) {
      setConflict(`Зал занят: ${data[0].title} (${formatTime(data[0].starts_at)}–${formatTime(data[0].ends_at)})`)
      return true
    }
    setConflict(null)
    return false
  }

  const buildDates = () => {
    const dates = []
    const base = new Date(`${form.date}T${form.time_from}`)
    if (form.repeat === 'none') {
      dates.push(new Date(`${form.date}T${form.time_from}`))
    } else if (form.repeat === 'weekly') {
      const until = form.repeat_until ? new Date(form.repeat_until) : new Date(base.getTime() + 90*24*60*60*1000)
      let cur = new Date(base)
      while (cur <= until) { dates.push(new Date(cur)); cur.setDate(cur.getDate()+7) }
    } else if (form.repeat === 'custom') {
      const until = form.repeat_until ? new Date(form.repeat_until) : new Date(base.getTime() + 90*24*60*60*1000)
      let cur = new Date(base)
      while (cur <= until) {
        const dow = cur.getDay() === 0 ? 7 : cur.getDay()
        if (form.repeat_days.includes(dow)) dates.push(new Date(cur))
        cur.setDate(cur.getDate()+1)
      }
    }
    return dates
  }

  const handleSave = async () => {
    if (!form.hall || !form.date || !form.time_from || !form.time_to) return
    if (type === 'group' && !form.title && !form.group_id) return
    if (type === 'indiv' && (!form.teacher_id || !form.student_id)) return
    const hasConflict = await checkConflict()
    if (hasConflict) return
    setSaving(true)

    const repeatId = crypto.randomUUID()
    const dates = buildDates()
    const duration = new Date(`${form.date}T${form.time_to}`) - new Date(`${form.date}T${form.time_from}`)

    const selectedGroup = groups.find(g => g.id === form.group_id)
    const titleToSave = type === 'group' ? (selectedGroup?.name || form.title || '') : null

    const toLocalISO = (d) => {
      const offset = d.getTimezoneOffset()
      const local = new Date(d.getTime() - offset * 60000)
      return local.toISOString().slice(0, 19)
    }

    const rows = dates.map(d => ({
      title: titleToSave,
      group_id: type === 'group' ? (form.group_id || null) : null,
      teacher_id: form.teacher_id || null,
      hall: form.hall,
      starts_at: toLocalISO(d),
      ends_at: toLocalISO(new Date(d.getTime() + duration)),
      repeat_rule: form.repeat !== 'none' ? form.repeat : null,
      repeat_id: form.repeat !== 'none' ? repeatId : null,
      indiv_student_id: type === 'indiv' ? form.student_id : null,
      lesson_type: type,
    }))

    await supabase.from('schedule').insert(rows)
    setSaving(false)
    onSave()
  }

  return (
    <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:20, marginBottom:16}}>
      <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:16}}>{initial ? 'Редактировать занятие' : 'Новое занятие'}</div>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {[['group','Групповое'],['indiv','Индивидуальное']].map(([v,l]) => (
          <button key={v} onClick={() => setType(v)} style={{flex:1, padding:'8px', borderRadius:8, border: type===v?'none':'1px solid #e0e0e0', background: type===v?'#BFD900':'#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: type===v?600:400}}>{l}</button>
        ))}
      </div>
      {type === 'group' && (<>
        <label style={labelStyle}>Группа</label>
        <select value={form.group_id} onChange={e => {
          const g = groups.find(g => g.id === e.target.value)
          setForm({...form, group_id: e.target.value, title: g?.name || ''})
        }} style={inputStyle}>
          <option value="">Выберите группу</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {!form.group_id && (<>
          <label style={labelStyle}>Или введите название вручную</label>
          <input value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="Название занятия" style={inputStyle} />
        </>)}
      </>)}
      {type === 'indiv' && (<>
        <label style={labelStyle}>Ученик</label>
        <select value={form.student_id} onChange={e => setForm({...form, student_id:e.target.value})} style={inputStyle}>
          <option value="">Выберите ученика</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.full_name||s.email}</option>)}
        </select>
      </>)}
      <label style={labelStyle}>Преподаватель</label>
      <select value={form.teacher_id} onChange={e => setForm({...form, teacher_id:e.target.value})} style={inputStyle}>
        <option value="">Выберите преподавателя</option>
        {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name||t.email}</option>)}
      </select>
      <label style={labelStyle}>Зал</label>
      <select value={form.hall} onChange={e => {setForm({...form, hall:e.target.value}); setConflict(null)}} style={{...inputStyle, border:conflict?'1px solid #e74c3c':'1px solid #e8e8e8'}}>
        <option value="">Выберите зал</option>
        <option value="Большой зал">Большой зал</option>
        <option value="Малый зал">Малый зал</option>
      </select>
      {conflict && <div style={{fontSize:12, color:'#e74c3c', marginBottom:8, marginTop:-4}}>⚠️ {conflict}</div>}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
        <div><label style={labelStyle}>Дата</label><input value={form.date} onChange={e => setForm({...form, date:e.target.value})} type="date" style={inputStyle} /></div>
        <div><label style={labelStyle}>Начало</label><input value={form.time_from} onChange={e => setForm({...form, time_from:e.target.value})} type="time" style={inputStyle} /></div>
        <div><label style={labelStyle}>Конец</label><input value={form.time_to} onChange={e => setForm({...form, time_to:e.target.value})} type="time" style={inputStyle} /></div>
      </div>
      <label style={labelStyle}>Повторение</label>
      <select value={form.repeat} onChange={e => setForm({...form, repeat:e.target.value})} style={inputStyle}>
        <option value="none">Не повторять</option>
        <option value="weekly">Каждую неделю</option>
        <option value="custom">По дням недели</option>
      </select>
      {form.repeat === 'custom' && (
        <div style={{display:'flex', gap:6, marginBottom:8, flexWrap:'wrap'}}>
          {[['Пн',1],['Вт',2],['Ср',3],['Чт',4],['Пт',5],['Сб',6],['Вс',7]].map(([l,d]) => (
            <label key={d} style={{display:'flex', alignItems:'center', gap:4, padding:'4px 10px', background:form.repeat_days.includes(d)?'#fafde8':'#f5f5f5', border:form.repeat_days.includes(d)?'1px solid #BFD900':'1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
              <input type="checkbox" checked={form.repeat_days.includes(d)} onChange={() => toggleRepeatDay(d)} />{l}
            </label>
          ))}
        </div>
      )}
      {form.repeat !== 'none' && (<>
        <label style={labelStyle}>Повторять до (необязательно)</label>
        <input value={form.repeat_until} onChange={e => setForm({...form, repeat_until:e.target.value})} type="date" style={inputStyle} />
      </>)}
      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={handleSave} disabled={saving} style={{flex:1, padding:'9px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>{saving?'Сохраняем...':'Сохранить'}</button>
        <button onClick={onCancel} style={{padding:'9px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
      </div>
    </div>
  )
}

function EditSeriesModal({ onChoice, onCancel }) {
  return (
    <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'#fff', borderRadius:16, padding:24, width:340}}>
        <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>Изменить повторяющееся занятие</div>
        <div style={{fontSize:13, color:'#888', marginBottom:20}}>Это занятие является частью серии. Что изменить?</div>
        {[['one','Только это занятие'],['future','Это и все последующие'],['all','Все занятия серии']].map(([v,l]) => (
          <button key={v} onClick={() => onChoice(v)} style={{width:'100%', padding:'10px', background:'#f9f9f9', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', marginBottom:8, textAlign:'left'}}>{l}</button>
        ))}
        <button onClick={onCancel} style={{width:'100%', padding:'8px', background:'transparent', border:'none', fontSize:12, color:'#BDBDBD', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
      </div>
    </div>
  )
}

export default function AdminSchedule({ session }) {
  const [view, setView] = useState('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [groups, setGroups] = useState([])
  const [groupColorMap, setGroupColorMap] = useState({})
  const [groupNameMap, setGroupNameMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showSeriesModal, setShowSeriesModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterHall, setFilterHall] = useState('all')
  const [attendanceLesson, setAttendanceLesson] = useState(null)

  useEffect(() => { loadAll() }, [currentDate, view])

  const loadAll = async () => {
    setLoading(true)
    let from, to
    if (view === 'day') {
      from = new Date(currentDate); from.setHours(0,0,0,0)
      to = new Date(currentDate); to.setHours(23,59,59,999)
    } else if (view === 'week') {
      const days = getWeekDays(currentDate)
      from = new Date(days[0]); from.setHours(0,0,0,0)
      to = new Date(days[6]); to.setHours(23,59,59,999)
    } else {
      from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      to = new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0, 23, 59, 59)
    }
    const { data: ev } = await supabase.from('schedule')
      .select('*, groups(name), teacher:profiles!schedule_teacher_id_fkey(full_name), student:profiles!schedule_indiv_student_id_fkey(full_name)')
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString())
      .order('starts_at')
    setEvents(ev || [])
    const { data: t } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'teacher')
    setTeachers(t || [])
    const { data: s } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'client')
    setStudents(s || [])
    const { data: g } = await supabase.from('groups').select('id, name')
    setGroups(g || [])
    const colorMap = {}
    const nameMap = {}
    ;(g || []).forEach((group, i) => {
      colorMap[group.id] = GROUP_COLORS[i % GROUP_COLORS.length]
      nameMap[group.name] = GROUP_COLORS[i % GROUP_COLORS.length]
    })
    setGroupColorMap(colorMap)
    setGroupNameMap(nameMap)
    setLoading(false)
  }

  const filteredEvents = events.filter(ev => {
    if (filterTeacher !== 'all' && ev.teacher_id !== filterTeacher) return false
    if (filterHall !== 'all' && ev.hall !== filterHall) return false
    return true
  })

  const eventsForDay = (date) => filteredEvents.filter(ev => isSameDay(new Date(ev.starts_at), date))

  const navigate = (dir) => {
    const d = new Date(currentDate)
    if (view === 'day') d.setDate(d.getDate()+dir)
    else if (view === 'week') d.setDate(d.getDate()+dir*7)
    else d.setMonth(d.getMonth()+dir)
    setCurrentDate(d)
  }

  const handleEventClick = (ev) => { setEditingEvent(ev); setShowEditForm(false) }

  const handleDeleteEvent = async (ev) => {
    if (ev.repeat_id) { setPendingDelete(ev); setShowSeriesModal(true) }
    else {
      if (!confirm('Удалить занятие?')) return
      await supabase.from('schedule').delete().eq('id', ev.id)
      setEditingEvent(null); loadAll()
    }
  }

  const handleSeriesChoice = async (choice) => {
    const ev = pendingDelete || editingEvent
    if (!ev) return
    if (choice === 'one') await supabase.from('schedule').delete().eq('id', ev.id)
    else if (choice === 'future') await supabase.from('schedule').delete().eq('repeat_id', ev.repeat_id).gte('starts_at', ev.starts_at)
    else await supabase.from('schedule').delete().eq('repeat_id', ev.repeat_id)
    setShowSeriesModal(false); setPendingDelete(null); setEditingEvent(null); setShowEditForm(false); loadAll()
  }

  const formatHeader = () => {
    if (view === 'day') return currentDate.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long', year:'numeric'})
    if (view === 'week') {
      const days = getWeekDays(currentDate)
      return `${formatDate(days[0])} — ${formatDate(days[6])}, ${days[0].getFullYear()}`
    }
    return `${MONTHS_RU[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  const totalHeight = HOURS.length * HOUR_HEIGHT

  const HourLines = () => (
    <div style={{position:'absolute', top:0, left:0, right:0, height:totalHeight, pointerEvents:'none'}}>
      {HOURS.map(h => (
        <div key={h} style={{position:'absolute', top:(h-START_HOUR)*HOUR_HEIGHT, left:0, right:0, borderTop:'1px solid #f0f0f0'}}></div>
      ))}
    </div>
  )

 const EventBlock = ({ ev, width='95%', left='2%' }) => {
    const color = getEventColor(ev, groupColorMap, groupNameMap)
    const { top, height } = getEventStyle(ev)
    const title = ev.groups?.name || ev.title || (ev.student ? `Индив: ${ev.student.full_name}` : 'Занятие')
    const isShort = height < 36
    const isCancelled = ev.is_cancelled
    return (
      <div onClick={() => handleEventClick(ev)} style={{
        position:'absolute', top, left, width, height,
        background: color.bg,
        border: isCancelled ? '2px solid #e74c3c' : `1.5px solid ${color.border}`,
        borderRadius:6, padding: isShort?'1px 5px':'4px 7px',
        cursor:'pointer', overflow:'hidden', zIndex:2, boxSizing:'border-box',
        boxShadow:'0 1px 3px rgba(0,0,0,0.06)'
      }}>
        {isCancelled && (
          <div style={{
            position:'absolute', top:0, left:0, right:0,
            background:'#e74c3c', color:'#fff',
            fontSize:9, fontWeight:700, letterSpacing:'0.05em',
            padding:'2px 6px', textAlign:'center'
          }}>
            ОТМЕНЕНО
          </div>
        )}
        <div style={{fontSize:11, fontWeight:700, color: color.text, marginTop: isCancelled ? 14 : 0}}>
          <div style={{whiteSpace:'nowrap'}}>{formatTime(ev.starts_at)}–{formatTime(ev.ends_at)}</div>
          <div style={{wordBreak:'break-word', lineHeight:1.3}}>{title}</div>
        </div>
        {!isShort && ev.teacher && <div style={{fontSize:10, color:color.text, opacity:0.75, marginTop:1}}>{ev.teacher.full_name}</div>}
        {!isShort && ev.hall && <div style={{fontSize:10, color:color.text, opacity:0.6}}>{ev.hall}</div>}
      </div>
    )
  }

  return (
    <div>
      {showSeriesModal && <EditSeriesModal onChoice={handleSeriesChoice} onCancel={() => {setShowSeriesModal(false); setPendingDelete(null)}} />}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Расписание</h1>
        <button onClick={() => {setShowForm(true); setEditingEvent(null)}}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          + Добавить занятие
        </button>
      </div>

      {showForm && (
        <ScheduleForm session={session} teachers={teachers} students={students} groups={groups}
          initialDate={currentDate}
          onSave={() => {setShowForm(false); loadAll()}}
          onCancel={() => setShowForm(false)} />
      )}

      {editingEvent && !showSeriesModal && (
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:16, marginBottom:16}}>
          {showEditForm ? (
            <ScheduleForm session={session} teachers={teachers} students={students} groups={groups}
              initial={editingEvent}
              onSave={() => {setEditingEvent(null); setShowEditForm(false); loadAll()}}
              onCancel={() => setShowEditForm(false)} />
          ) : (
            <>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10}}>
                <div>
                  <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:3}}>
                    {editingEvent.groups?.name || editingEvent.title || (editingEvent.student ? `Индив: ${editingEvent.student.full_name}` : 'Занятие')}
                  </div>
                  <div style={{fontSize:12, color:'#888'}}>{formatDate(editingEvent.starts_at)} · {formatTime(editingEvent.starts_at)}–{formatTime(editingEvent.ends_at)}</div>
                  {editingEvent.teacher && <div style={{fontSize:12, color:'#888'}}>{editingEvent.teacher.full_name} · {editingEvent.hall}</div>}
                  {editingEvent.repeat_id && <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>🔁 Повторяющееся занятие</div>}
                </div>
                <button onClick={() => setEditingEvent(null)} style={{fontSize:20, color:'#BDBDBD', background:'none', border:'none', cursor:'pointer', lineHeight:1}}>×</button>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button onClick={() => { setAttendanceLesson(editingEvent); setEditingEvent(null) }} style={{padding:'7px 16px', background:'#e8f4fd', border:'none', borderRadius:8, fontSize:12, color:'#2980b9', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>👥 Отметить</button>
                <button onClick={() => setShowEditForm(true)} style={{padding:'7px 16px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:12, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>Редактировать</button>
                <button onClick={() => handleDeleteEvent(editingEvent)} style={{padding:'7px 16px', background:'#fdecea', border:'none', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Удалить</button>
              </div>
            </>
          )}
        </div>
      )}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <button onClick={() => navigate(-1)} style={{padding:'6px 12px', background:'#fff', border:'1px solid #e8e8e8', borderRadius:8, fontSize:14, cursor:'pointer'}}>←</button>
          <button onClick={() => setCurrentDate(new Date())} style={{padding:'6px 12px', background:'#fff', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, cursor:'pointer', color:'#888'}}>Сегодня</button>
          <button onClick={() => navigate(1)} style={{padding:'6px 12px', background:'#fff', border:'1px solid #e8e8e8', borderRadius:8, fontSize:14, cursor:'pointer'}}>→</button>
          <span style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>{formatHeader()}</span>
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <div style={{display:'flex', background:'#f5f5f5', borderRadius:10, padding:3}}>
            {[['day','День'],['week','Неделя'],['month','Месяц']].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} style={{padding:'6px 14px', borderRadius:8, border:'none', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', background:view===v?'#fff':'transparent', color:view===v?'#2a2a2a':'#888', fontWeight:view===v?600:400}}>{l}</button>
            ))}
          </div>
          <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={{padding:'6px 10px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="all">Все преподаватели</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name||t.email}</option>)}
          </select>
          <select value={filterHall} onChange={e => setFilterHall(e.target.value)} style={{padding:'6px 10px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="all">Все залы</option>
            <option value="Большой зал">Большой зал</option>
            <option value="Малый зал">Малый зал</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : (
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', overflow:'hidden'}}>

          {view === 'day' && (
            <div style={{display:'flex', overflow:'auto', maxHeight:'75vh'}}>
              <div style={{width:52, flexShrink:0, borderRight:'1px solid #f0f0f0', position:'relative'}}>
                <div style={{height:24, borderBottom:'1px solid #f0f0f0'}}></div>
                <div style={{position:'relative', height:totalHeight}}>
                  {HOURS.map(h => (
                    <div key={h} style={{position:'absolute', top:(h-START_HOUR)*HOUR_HEIGHT-8, right:8, fontSize:10, color:'#BDBDBD'}}>
                      {String(h).padStart(2,'0')}:00
                    </div>
                  ))}
                </div>
              </div>
              <div style={{flex:1, position:'relative'}}>
                <div style={{height:24, borderBottom:'1px solid #f0f0f0', padding:'4px 8px', fontSize:12, fontWeight:600, color:'#2a2a2a'}}>
                  {currentDate.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'})}
                </div>
                <div style={{position:'relative', height:totalHeight}}>
                  <HourLines />
                  {eventsForDay(currentDate).map(ev => <EventBlock key={ev.id} ev={ev} width="97%" left="1.5%" />)}
                </div>
              </div>
            </div>
          )}

          {view === 'week' && (
            <div style={{overflow:'auto', maxHeight:'75vh'}}>
              <div style={{display:'flex', minWidth:600, position:'sticky', top:0, zIndex:10, background:'#fff', borderBottom:'2px solid #f0f0f0'}}>
                <div style={{width:52, flexShrink:0, borderRight:'1px solid #f0f0f0'}}></div>
                {getWeekDays(currentDate).map((d, i) => {
                  const isToday = isSameDay(d, new Date())
                  return (
                    <div key={i} onClick={() => {setCurrentDate(d); setView('day')}} style={{flex:1, padding:'8px 6px', textAlign:'center', cursor:'pointer', background:isToday?'#fafde8':'transparent', borderRight:'1px solid #f0f0f0'}}>
                      <div style={{fontSize:10, color:'#BDBDBD', textTransform:'uppercase'}}>{DAYS_RU[d.getDay()]}</div>
                      <div style={{fontSize:16, fontWeight:isToday?700:300, color:isToday?'#6a7700':'#2a2a2a'}}>{d.getDate()}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{display:'flex', minWidth:600}}>
                <div style={{width:52, flexShrink:0, borderRight:'1px solid #f0f0f0', position:'relative', height:totalHeight}}>
                  {HOURS.map(h => (
                    <div key={h} style={{position:'absolute', top:(h-START_HOUR)*HOUR_HEIGHT-8, right:8, fontSize:10, color:'#BDBDBD'}}>
                      {String(h).padStart(2,'0')}:00
                    </div>
                  ))}
                </div>
                {getWeekDays(currentDate).map((d, i) => (
                  <div key={i} style={{flex:1, borderRight:'1px solid #f0f0f0', position:'relative', height:totalHeight}}>
                    <HourLines />
                    {eventsForDay(d).map(ev => <EventBlock key={ev.id} ev={ev} />)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'month' && (
            <>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid #f0f0f0'}}>
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                  <div key={d} style={{padding:'8px', textAlign:'center', fontSize:11, color:'#BDBDBD', fontWeight:600}}>{d}</div>
                ))}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)'}}>
                {getMonthDays(currentDate).map((cell, i) => {
                  const dayEvs = eventsForDay(cell.date)
                  const isToday = isSameDay(cell.date, new Date())
                  return (
                    <div key={i} onClick={() => {setCurrentDate(cell.date); setView('day')}}
                      style={{minHeight:80, padding:'5px', borderRight:'1px solid #f8f8f8', borderBottom:'1px solid #f8f8f8', background:isToday?'#fafde8':cell.current?'#fff':'#fafafa', cursor:'pointer'}}>
                      <div style={{fontSize:11, fontWeight:isToday?700:400, color:isToday?'#6a7700':cell.current?'#2a2a2a':'#BDBDBD', marginBottom:3}}>{cell.date.getDate()}</div>
                      {dayEvs.slice(0,3).map(ev => {
                        const color = getEventColor(ev, groupColorMap, groupNameMap)
                        const title = ev.groups?.name || ev.title || 'Индив'
                        return (
                          <div key={ev.id} onClick={e => {e.stopPropagation(); handleEventClick(ev)}}
                            style={{background:color.bg, border:`1px solid ${color.border}`, borderRadius:4, padding:'1px 5px', marginBottom:2, fontSize:10, color:color.text, fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                            {formatTime(ev.starts_at)} {title}
                          </div>
                        )
                      })}
                      {dayEvs.length > 3 && <div style={{fontSize:9, color:'#BDBDBD'}}>+{dayEvs.length-3} ещё</div>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    {attendanceLesson && (
 <AttendancePanel
  lesson={attendanceLesson}
  session={session}
  teachers={teachers}
  onClose={() => setAttendanceLesson(null)}
  onLessonUpdate={() => { loadAll(); setAttendanceLesson(null) }}
/>
)}
    </div>
  )
}