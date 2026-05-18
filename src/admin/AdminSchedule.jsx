import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import AttendancePanel from './AttendancePanel'
import { toMskDateStr, mskDayStartNaive, mskDayEndNaive, parseMskNaive, mskParts } from '../utils/tz'

const GROUP_COLORS = [
  { bg:'#FFEBEE', border:'#D32F2F', text:'#B71C1C' },
  { bg:'#FFF3E0', border:'#E64A19', text:'#BF360C' },
  { bg:'#FFFDE7', border:'#F9A825', text:'#F57F17' },
  { bg:'#E8F5E9', border:'#388E3C', text:'#1B5E20' },
  { bg:'#F1F8E9', border:'#689F38', text:'#33691E' },
  { bg:'#E0F7FA', border:'#0097A7', text:'#006064' },
  { bg:'#E3F2FD', border:'#1976D2', text:'#0D47A1' },
  { bg:'#E8EAF6', border:'#303F9F', text:'#1A237E' },
  { bg:'#EDE7F6', border:'#5E35B1', text:'#311B92' },
  { bg:'#FCE4EC', border:'#C2185B', text:'#880E4F' },
]
const INDIV_COLOR = { bg: '#EAF4F2', border: '#5A8A7C', text: '#2a5a4e' }

const DAYS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const HOUR_HEIGHT = 80
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
  return parseMskNaive(dt).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Moscow' })
}
function formatDate(dt) {
  return parseMskNaive(dt).toLocaleDateString('ru-RU', { day:'numeric', month:'short', timeZone:'Europe/Moscow' })
}
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
// Сравнение МСК-даты события (MSK naive строка) с локальным Date — корректно
// в любом TZ браузера. Берём MSK-части события и сравниваем с локальными
// частями целевой даты (которая всегда строится из new Date(year, month, day) в TZ браузера,
// что эквивалентно её локальной дате — без TZ-конверсий).
function isSameMskDay(eventStartsAt, targetDate) {
  const p = mskParts(eventStartsAt)
  return p.y === targetDate.getFullYear() && p.m === targetDate.getMonth() + 1 && p.d === targetDate.getDate()
}

const EVENT_COLOR = { bg:'#F3E5F5', border:'#7B1FA2', text:'#4A148C' }

function getEventColor(ev, groupColorMap, groupNameMap) {
  if (ev.indiv_student_id) return INDIV_COLOR
  if (ev.event_id) return EVENT_COLOR
  if (ev.group_id && groupColorMap[ev.group_id]) return groupColorMap[ev.group_id]
  if (ev.title && groupNameMap?.[ev.title]) return groupNameMap[ev.title]
  if (ev.groups?.name && groupNameMap?.[ev.groups.name]) return groupNameMap[ev.groups.name]
  return GROUP_COLORS[0]
}

function getEventStyle(ev) {
  // starts_at/ends_at — MSK naive. Берём именно МСК-часы/минуты, иначе
  // у админа не из МСК блок съедет по высоте.
  const startP = mskParts(ev.starts_at)
  const endP   = mskParts(ev.ends_at)
  const startMins = (startP.h - START_HOUR) * 60 + startP.mi
  const endMins   = (endP.h   - START_HOUR) * 60 + endP.mi
  const durationMins = endMins - startMins
  const top = (startMins / 60) * HOUR_HEIGHT
  const height = Math.max((durationMins / 60) * HOUR_HEIGHT - 4, 20)
  return { top, height }
}

// ─── Модалка замены ────────────────────────────────────────────────────────────
function SubstitutionModal({ ev, teachers, session, onSave, onCancel }) {
  const [substituteId, setSubstituteId] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (saving || !substituteId) return
    setSaving(true)
    const { data, error } = await supabase.rpc('assign_substitution', {
      p_schedule_id: ev.id,
      p_substitute_teacher_id: substituteId,
      p_reason: null,
    })
    setSaving(false)
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated: 'Сессия истекла, войдите заново',
        forbidden:         'Недостаточно прав',
        lesson_not_found:  'Занятие не найдено',
        lesson_cancelled:  'Занятие отменено — замена невозможна',
        same_teacher:      'Этот преподаватель уже ведёт занятие',
        no_substitute:     'Выберите преподавателя',
      }[data?.error] || `Не удалось назначить замену: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    onSave()
  }

  const availableTeachers = teachers.filter(t => t.id !== ev.teacher_id)

  return (
    <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'#fff', borderRadius:16, padding:24, width:360, boxSizing:'border-box'}}>
        <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>Замена преподавателя</div>
        <div style={{fontSize:12, color:'#888', marginBottom:16}}>
          Только для этого занятия: {formatDate(ev.starts_at)}, {formatTime(ev.starts_at)}
        </div>
        <div style={{background:'#f9f9f9', borderRadius:10, padding:'10px 14px', marginBottom:16}}>
          <div style={{fontSize:11, color:'#888', marginBottom:2}}>Текущий преподаватель</div>
          <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>{ev.teacher?.full_name || '—'}</div>
        </div>
        <label style={labelStyle}>Кто заменяет</label>
        <select value={substituteId} onChange={e => setSubstituteId(e.target.value)} style={inputStyle}>
          <option value=''>— Выберите преподавателя —</option>
          {availableTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button onClick={handleSave} disabled={saving || !substituteId}
            style={{flex:1, padding:'10px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity:(!substituteId||saving)?0.5:1}}>
            {saving ? 'Сохраняем...' : 'Подтвердить замену'}
          </button>
          <button onClick={onCancel}
            style={{padding:'10px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

function ScheduleForm({ session, teachers, students, groups, events, onSave, onCancel, initial = null, initialDate = null }) {
  const [type, setType] = useState(initial?.indiv_student_id ? 'indiv' : 'group')
  const [form, setForm] = useState({
    title: initial?.title || '',
    teacher_id: initial?.teacher_id || '',
    hall: initial?.hall || '',
    date: initialDate ? toMskDateStr(initialDate) : (initial?.starts_at ? toMskDateStr(parseMskNaive(initial.starts_at)) : toMskDateStr(new Date())),
    time_from: initial?.starts_at ? formatTime(initial.starts_at) : '18:00',
    time_to: initial?.ends_at ? formatTime(initial.ends_at) : '19:00',
    group_id: initial?.group_id || '',
    student_id: initial?.indiv_student_id || '',
    repeat: 'none',
    repeat_until: '',
    repeat_days: [],
    event_id: initial?.event_id || '',
  })
  const [conflict, setConflict] = useState(null)
  const [saving, setSaving] = useState(false)

  const toggleRepeatDay = (d) => setForm(f => ({
    ...f, repeat_days: f.repeat_days.includes(d) ? f.repeat_days.filter(x => x !== d) : [...f.repeat_days, d]
  }))

  const checkConflict = async () => {
    if (!form.hall || !form.date || !form.time_from || !form.time_to) return false
    // form.date/time_* — это МСК-вход админа, schedule.starts_at тоже MSK naive,
    // сравниваем напрямую без всяких toISOString.
    const startsNaive = `${form.date}T${form.time_from}:00`
    const endsNaive   = `${form.date}T${form.time_to}:00`
    const { data } = await supabase.from('schedule')
      .select('id, title, starts_at, ends_at')
      .eq('hall', form.hall)
      .neq('id', initial?.id || '00000000-0000-0000-0000-000000000000')
      .lt('starts_at', endsNaive)
      .gt('ends_at', startsNaive)
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
    if (saving) return
    if (!form.hall || !form.date || !form.time_from || !form.time_to) {
      alert('Заполните все обязательные поля: группа, зал, дата, время')
      return
    }
    if (type === 'group' && !form.title && !form.group_id) return
    if (type === 'indiv' && (!form.teacher_id || !form.student_id)) return
    setSaving(true)

    const dates = buildDates()
    const selectedGroup = groups.find(g => g.id === form.group_id)
    const selectedEvent = events.find(e => e.id === form.event_id)
    const titleToSave = type === 'group'
      ? (selectedGroup?.name || form.title || '')
      : type === 'event'
      ? (selectedEvent?.name || '')
      : null

    // Дата-время передаём в МСК (naive timestamp) — RPC конвертирует в UTC.
    // getFullYear/Month/Date берут локальные компоненты, но мы используем их
    // только как Y-M-D, а время — то, что админ ввёл вручную в полях time_*.
    const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const datesPayload = dates.map(d => ({
      starts_at: `${fmtDate(d)}T${form.time_from}:00`,
      ends_at:   `${fmtDate(d)}T${form.time_to}:00`,
    }))

    const { data, error } = await supabase.rpc('create_schedule_event', {
      p_payload: {
        lesson_type:       type,
        title:             titleToSave,
        group_id:          type === 'group' ? (form.group_id || null) : null,
        indiv_student_id:  type === 'indiv' ? form.student_id : null,
        event_id:          type === 'event' ? form.event_id : null,
        teacher_id:        form.teacher_id || null,
        hall:              form.hall,
        repeat_rule:       form.repeat !== 'none' ? form.repeat : null,
        dates:             datesPayload,
      },
    })

    setSaving(false)
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      if (data?.error === 'hall_conflict') {
        const n = data.conflicts?.length || 1
        setConflict(`Зал занят в ${n === 1 ? 'выбранное время' : `${n} дат серии`} — выберите другое время или зал`)
        return
      }
      const msg = {
        not_authenticated:                  'Сессия истекла, войдите заново',
        forbidden:                          'Недостаточно прав',
        no_dates:                           'Не указаны даты',
        no_hall:                            'Не выбран зал',
        invalid_lesson_type:                'Неверный тип занятия',
        invalid_dates:                      'Время окончания должно быть позже начала',
        indiv_needs_student_and_teacher:    'Для индив-занятия нужны ученик и преподаватель',
        group_needs_title_or_group:         'Укажите название или выберите группу',
      }[data?.error] || `Не удалось создать занятие: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    setConflict(null)
    onSave()
  }

  return (
    <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:20, marginBottom:16}}>
      <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:16}}>{initial ? 'Редактировать занятие' : 'Новое занятие'}</div>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {[['group','Групповое'],['indiv','Индивидуальное'],['event','Мероприятие']].map(([v,l]) => (
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
      {type === 'event' && (<>
        <label style={labelStyle}>Мероприятие</label>
        <select value={form.event_id || ''} onChange={e => {
          const ev = events.find(ev => ev.id === e.target.value)
          setForm({...form, event_id: e.target.value, title: ev?.name || '', teacher_id: ev?.teacher_id || '', hall: ev?.hall || ''})
        }} style={inputStyle}>
          <option value="">Выберите мероприятие</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setViewState] = useState(searchParams.get('view') || 'week')
  const [currentDate, setCurrentDate] = useState(new Date())

  const setView = (v) => {
    setViewState(v)
    const next = new URLSearchParams(searchParams)
    next.set('view', v)
    setSearchParams(next, { replace: true })
  }

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
  const [showSubModal, setShowSubModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterHall, setFilterHall] = useState('all')
  const [attendanceLesson, setAttendanceLesson] = useState(null)
  const [eventsList, setEventsList] = useState([])
  const [eventDates, setEventDates] = useState([])

  useEffect(() => { loadAll() }, [currentDate, view])

  const loadAll = async () => {
    setLoading(true)
    let fromDate, toDate
    if (view === 'day') {
      fromDate = currentDate; toDate = currentDate
    } else if (view === 'week') {
      const days = getWeekDays(currentDate)
      fromDate = days[0]; toDate = days[6]
    } else {
      fromDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      toDate   = new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0)
    }
    const fromMsk = toMskDateStr(fromDate)
    const toMsk   = toMskDateStr(toDate)

    // 7 независимых запросов параллельно вместо последовательных await —
    // экономим ~6x RTT при загрузке расписания.
    const [evRes, allStaffRes, teacherRolesRes, sRes, eventsDataRes, edDataRes, gRes] = await Promise.all([
      supabase.from('schedule')
        .select(`*,
          groups(name),
          teacher:profiles!schedule_teacher_id_fkey(full_name),
          student:profiles!schedule_indiv_student_id_fkey(full_name),
          bookings(id, status),
          event:events!schedule_event_id_fkey(max_participants, event_registrations(client_id, status))`)
        .gte('starts_at', mskDayStartNaive(fromMsk))
        .lte('starts_at', mskDayEndNaive(toMsk))
        .order('starts_at'),
      supabase.from('profiles').select('id, full_name, email').in('role', ['teacher','owner','manager','admin']),
      supabase.from('staff_roles').select('staff_id').eq('role', 'teacher'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'client'),
      supabase.from('events').select('*').eq('is_active', true).order('name'),
      supabase.from('event_dates')
        .select('*, event:events!event_dates_event_id_fkey(id, name, hall, teacher_id, teacher:profiles!events_teacher_id_fkey(full_name))')
        .lte('date_start', toMsk)
        .gte('date_end', fromMsk),
      supabase.from('groups').select('id, name, color'),
    ])

    setEvents(evRes.data || [])
    const teacherIds = new Set((teacherRolesRes.data || []).map(r => r.staff_id))
    setTeachers((allStaffRes.data || []).filter(p => teacherIds.has(p.id)))
    setEventsList(eventsDataRes.data || [])
    setEventDates((edDataRes.data || []).filter(d => d.event))
    setStudents(sRes.data || [])
    const g = gRes.data
    setGroups(g || [])

    const colorMap = {}
    const nameMap = {}
    ;(g || []).forEach(group => {
      const colorObj = GROUP_COLORS.find(c => c.border === group.color) || GROUP_COLORS[0]
      colorMap[group.id] = colorObj
      nameMap[group.name] = colorObj
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

  const eventsForDay = (date) => filteredEvents.filter(ev => isSameMskDay(ev.starts_at, date))

  // Сколько человек записано на занятие. Группа — bookings(status='booked'),
  // индив — 1 (по indiv_student_id), event — event_registrations≠cancelled
  // (общий счётчик регистраций на event, без привязки к конкретной дате —
  // в схеме per-date регистраций нет).
  const bookingCount = (ev) => {
    if (ev.indiv_student_id) return 1
    if (ev.event_id) return (ev.event?.event_registrations || []).filter(r => r.status !== 'cancelled').length
    return (ev.bookings || []).filter(b => b.status === 'booked').length
  }
  // Лимит мест — только у events.
  const bookingCap = (ev) => ev.event_id ? (ev.event?.max_participants || null) : null

  const eventDatesForDay = (date) => {
    const dateStr = date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    return eventDates.filter(d => d.date_start <= dateStr && d.date_end >= dateStr)
  }

  const navigate = (dir) => {
    const d = new Date(currentDate)
    if (view === 'day') d.setDate(d.getDate()+dir)
    else if (view === 'week') d.setDate(d.getDate()+dir*7)
    else d.setMonth(d.getMonth()+dir)
    setCurrentDate(d)
  }

  const handleEventClick = (ev) => { setEditingEvent(ev); setShowEditForm(false); setShowSubModal(false) }

  const handleDeleteEvent = async (ev) => {
    if (ev.repeat_id) { setPendingDelete(ev); setShowSeriesModal(true) }
    else {
      if (!confirm('Удалить занятие?')) return
      await supabase.from('schedule_history').insert({
        schedule_id: ev.id, action: 'deleted',
        author_id: session.user.id, comment: 'Занятие удалено'
      })
      await supabase.from('schedule').delete().eq('id', ev.id)
      setEditingEvent(null); loadAll()
    }
  }

  const handleSeriesChoice = async (choice) => {
    const ev = pendingDelete || editingEvent
    if (!ev) return
    if (choice === 'one') {
      await supabase.from('schedule_history').insert({
        schedule_id: ev.id, action: 'deleted',
        author_id: session.user.id, comment: 'Удалено одно занятие из серии'
      })
      await supabase.from('schedule').delete().eq('id', ev.id)
    } else if (choice === 'future') {
      await supabase.from('schedule').delete().eq('repeat_id', ev.repeat_id).gte('starts_at', ev.starts_at)
    } else {
      await supabase.from('schedule').delete().eq('repeat_id', ev.repeat_id)
    }
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

  // inline=true (week) — счётчик внутри строки времени: «18:00–19:00 · 1».
  // На узких карточках абсолютный бейдж в углу перекрывал «00» во времени —
  // inline-формат не зависит от ширины. На широких (day) — оставлен
  // абсолютный бейдж с иконкой 👥.
  const EventBlock = ({ ev, width='95%', left='2%', inline=false }) => {
    const color = getEventColor(ev, groupColorMap, groupNameMap)
    const { top, height } = getEventStyle(ev)
    const title = ev.groups?.name || ev.title || (ev.student ? `Индив: ${ev.student.full_name}` : ev.event_id ? 'Мероприятие' : 'Занятие')
    const isShort = height < 36
    const isCancelled = ev.is_cancelled
    const cnt = bookingCount(ev)
    const cap = bookingCap(ev)
    // На отменённых счётчик не показываем (визиты возвращены при cancel_lesson,
    // фактическое число записавшихся уже не важно).
    const showCount = !isCancelled && cnt !== null
    const countLabel = cap ? `${cnt}/${cap}` : `${cnt}`
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
          <div style={{position:'absolute', top:0, left:0, right:0, background:'#e74c3c', color:'#fff', fontSize:9, fontWeight:700, letterSpacing:'0.05em', padding:'2px 6px', textAlign:'center'}}>
            ОТМЕНЕНО
          </div>
        )}
        {showCount && !inline && (
          <div style={{position:'absolute', top: isCancelled ? 16 : 2, right:3,
            fontSize:9, fontWeight:700, color: color.text,
            background:'rgba(255,255,255,0.88)',
            padding:'1px 5px', borderRadius:8, lineHeight:1.4,
            border:`1px solid ${color.border}`}}>
            👥 {countLabel}
          </div>
        )}
        <div style={{fontSize:10, fontWeight:700, color: color.text, marginTop: isCancelled ? 14 : 0}}>
          <div style={{whiteSpace:'nowrap'}}>
            {formatTime(ev.starts_at)}–{formatTime(ev.ends_at)}
            {showCount && inline && <span style={{opacity:0.7, fontWeight:600}}> ({countLabel})</span>}
          </div>
          <div style={{wordBreak:'break-word', lineHeight:1.2}}>{title}</div>
          {ev.teacher && <div style={{fontWeight:400, opacity:0.8, marginTop:1}}>{ev.teacher.full_name}</div>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {showSeriesModal && <EditSeriesModal onChoice={handleSeriesChoice} onCancel={() => {setShowSeriesModal(false); setPendingDelete(null)}} />}
      {showSubModal && editingEvent && (
        <SubstitutionModal
          ev={editingEvent}
          teachers={teachers}
          session={session}
          onSave={() => { setShowSubModal(false); setEditingEvent(null); loadAll() }}
          onCancel={() => setShowSubModal(false)}
        />
      )}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Расписание</h1>
        <button onClick={() => {setShowForm(true); setEditingEvent(null)}}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          + Добавить занятие
        </button>
      </div>

      {showForm && (
        <ScheduleForm session={session} teachers={teachers} students={students} groups={groups} events={eventsList}
          initialDate={currentDate}
          onSave={() => {setShowForm(false); loadAll()}}
          onCancel={() => setShowForm(false)} />
      )}

      {editingEvent && !showSeriesModal && !showSubModal && (
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:16, marginBottom:16}}>
          {showEditForm ? (
            <ScheduleForm session={session} teachers={teachers} students={students} groups={groups} events={eventsList}
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
              <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                <button onClick={() => { setAttendanceLesson(editingEvent); setEditingEvent(null) }}
                  style={{padding:'7px 16px', background:'#e8f4fd', border:'none', borderRadius:8, fontSize:12, color:'#2980b9', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                  👥 Отметить
                </button>
                {editingEvent.teacher_id && (
                  <button onClick={() => setShowSubModal(true)}
                    style={{padding:'7px 16px', background:'#fef9e7', border:'1px solid #f39c12', borderRadius:8, fontSize:12, color:'#d68910', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                    🔄 Замена
                  </button>
                )}
                <button onClick={() => setShowEditForm(true)}
                  style={{padding:'7px 16px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:12, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                  Редактировать
                </button>
                <button onClick={() => handleDeleteEvent(editingEvent)}
                  style={{padding:'7px 16px', background:'#fdecea', border:'none', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Удалить
                </button>
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
                  {eventDatesForDay(currentDate).map(d => (
                    <div key={d.id} onClick={() => {}} style={{
                      position:'absolute',
                      top: d.time_start ? ((parseInt(d.time_start)-START_HOUR)*HOUR_HEIGHT) : 0,
                      left:'1.5%', width:'97%',
                      height: d.time_start && d.time_end ? Math.max(((parseInt(d.time_end)-parseInt(d.time_start))*HOUR_HEIGHT)-4, 20) : 40,
                      background:'#F3E5F5', border:'1.5px solid #7B1FA2', borderRadius:6,
                      padding:'4px 7px', cursor:'pointer', overflow:'hidden', zIndex:2, boxSizing:'border-box'
                    }}>
                      <div style={{fontSize:10, fontWeight:700, color:'#4A148C'}}>
                        {d.time_start && d.time_end && <div>{d.time_start.slice(0,5)}–{d.time_end.slice(0,5)}</div>}
                        <div>🎭 {d.event.name}</div>
                        {d.event.hall && <div style={{fontWeight:400, opacity:0.8}}>{d.event.hall}</div>}
                      </div>
                    </div>
                  ))}
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
                    {eventsForDay(d).map(ev => <EventBlock key={ev.id} ev={ev} inline />)}
                    {eventDatesForDay(d).map(ed => (
                      <div key={ed.id} style={{
                        position:'absolute',
                        top: ed.time_start ? ((parseInt(ed.time_start)-START_HOUR)*HOUR_HEIGHT) : 0,
                        left:'2%', width:'95%',
                        height: ed.time_start && ed.time_end ? Math.max(((parseInt(ed.time_end)-parseInt(ed.time_start))*HOUR_HEIGHT)-4, 20) : 40,
                        background:'#F3E5F5', border:'1.5px solid #7B1FA2', borderRadius:6,
                        padding:'4px 7px', overflow:'hidden', zIndex:2, boxSizing:'border-box', cursor:'pointer'
                      }}>
                        <div style={{fontSize:10, fontWeight:700, color:'#4A148C'}}>
                          {ed.time_start && <div>{ed.time_start.slice(0,5)}–{ed.time_end?.slice(0,5)}</div>}
                          <div>🎭 {ed.event.name}</div>
                        </div>
                      </div>
                    ))}
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
                      {eventDatesForDay(cell.date).map(ed => (
                        <div key={ed.id} style={{background:'#F3E5F5', border:'1px solid #7B1FA2', borderRadius:4, padding:'1px 5px', marginBottom:2, fontSize:10, color:'#4A148C', fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                          🎭 {ed.event.name}
                        </div>
                      ))}
                      {dayEvs.slice(0,3).map(ev => {
                        const color = getEventColor(ev, groupColorMap, groupNameMap)
                        const title = ev.groups?.name || ev.title || 'Индив'
                        const cnt = ev.is_cancelled ? null : bookingCount(ev)
                        return (
                          <div key={ev.id} onClick={e => {e.stopPropagation(); handleEventClick(ev)}}
                            style={{background:color.bg, border:`1px solid ${color.border}`, borderRadius:4, padding:'1px 5px', marginBottom:2, fontSize:10, color:color.text, fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                            {formatTime(ev.starts_at)} {title}{cnt !== null && ` · 👥${cnt}`}
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