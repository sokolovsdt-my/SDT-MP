import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const STATUS_OPTIONS = [
  { value: 'none', label: 'Не отмечен', color: '#BDBDBD', bg: '#f5f5f5' },
  { value: 'present', label: 'Пришёл', color: '#27ae60', bg: '#eafaf1' },
  { value: 'absent', label: 'Не пришёл', color: '#e74c3c', bg: '#fdecea' },
  { value: 'cancelled', label: 'Отказался', color: '#f39c12', bg: '#fef9e7' },
  { value: 'transferred', label: 'Перенос', color: '#8e44ad', bg: '#f5eef8' },
]

const BASIS_LABELS = {
  subscription: 'Абонемент',
  single: 'Разовое',
  trial: 'Пробное',
  indiv: 'Индив',
  none: 'Без основания',
}

function StudentRow({ booking, onStatusChange }) {
  const [status, setStatus] = useState(booking.attendance_status || 'none')
  const [saving, setSaving] = useState(false)

  const handleChange = async (newStatus) => {
    setSaving(true)
    setStatus(newStatus)
    await onStatusChange(booking, newStatus)
    setSaving(false)
  }

  const basis = booking.basis || 'none'
  const isNoBasis = basis === 'none'
  const isTrial = basis === 'trial'
  const currentStatus = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]

  const formatDate = (dt) => dt ? new Date(dt).toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'numeric' }) : '—'

  return (
    <div style={{
      padding:'12px 16px', borderBottom:'1px solid #f5f5f5',
      background: isNoBasis ? '#fff8f8' : '#fff',
      display:'flex', alignItems:'center', gap:12
    }}>
      <div style={{
        width:36, height:36, borderRadius:'50%',
        background: isNoBasis ? '#fdecea' : '#fafde8',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:13, fontWeight:700,
        color: isNoBasis ? '#e74c3c' : '#6a7700', flexShrink:0
      }}>
        {(booking.profiles?.full_name || '?')[0].toUpperCase()}
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
          <span style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>
            {booking.profiles?.full_name || booking.profiles?.email || '—'}
          </span>
          {booking.profiles?.birth_date && (
            <span style={{fontSize:11, color:'#BDBDBD'}}>
              {new Date().getFullYear() - new Date(booking.profiles.birth_date).getFullYear()} лет
            </span>
          )}
        </div>
        {booking.representative && (
          <div style={{fontSize:11, color:'#888', marginBottom:2}}>
            {booking.representative.role}: {booking.representative.full_name}
            {booking.representative.phone && ` · ${booking.representative.phone}`}
          </div>
        )}
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <span style={{
            fontSize:11, fontWeight:600,
            color: isNoBasis ? '#e74c3c' : '#6a7700',
            background: isNoBasis ? '#fdecea' : '#fafde8',
            padding:'1px 6px', borderRadius:4
          }}>
            {isNoBasis ? '⚠️ Без основания' : BASIS_LABELS[basis]}
          </span>
          {booking.subscription_expires && !isNoBasis && (
            <span style={{fontSize:10, color:'#BDBDBD'}}>до {formatDate(booking.subscription_expires)}</span>
          )}
        </div>
      </div>
      <select
        value={status}
        onChange={e => handleChange(e.target.value)}
        disabled={saving}
        style={{
          padding:'5px 8px', border:`1px solid ${currentStatus.color}`,
          borderRadius:8, fontSize:12, background: currentStatus.bg,
          color: currentStatus.color, fontWeight:600, cursor:'pointer',
          fontFamily:'Inter,sans-serif', opacity: saving ? 0.6 : 1, flexShrink:0
        }}
      >
        {STATUS_OPTIONS.filter(s => s.value !== 'transferred' || isTrial || s.value === status).map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function AttendancePanel({ lesson, session, onClose, teachers, onLessonUpdate }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])

  // Замена преподавателя
  const [showChangeTeacher, setShowChangeTeacher] = useState(false)
  const [newTeacherId, setNewTeacherId] = useState(lesson.teacher_id || '')

  // Перенос занятия
  const [showReschedule, setShowReschedule] = useState(false)
  const [newDate, setNewDate] = useState(lesson.starts_at ? new Date(lesson.starts_at).toISOString().split('T')[0] : '')
  const [newTimeFrom, setNewTimeFrom] = useState(lesson.starts_at ? new Date(lesson.starts_at).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}) : '')
  const [newTimeTo, setNewTimeTo] = useState(lesson.ends_at ? new Date(lesson.ends_at).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}) : '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (lesson) loadBookings() }, [lesson])

  const loadBookings = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles(id, full_name, email, birth_date, phone), attendance(status, basis, subscription_expires, id)')
      .eq('schedule_id', lesson.id)
      .neq('status', 'cancelled')
    setBookings((data || []).map(b => ({
      ...b,
      attendance_status: b.attendance?.[0]?.status || 'none',
      basis: b.attendance?.[0]?.basis || 'none',
      subscription_expires: b.attendance?.[0]?.subscription_expires,
      attendance_id: b.attendance?.[0]?.id,
    })))
    setLoading(false)
  }

  const handleStatusChange = async (booking, newStatus) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (booking.attendance_id) {
      await supabase.from('attendance').update({ status: newStatus, marked_by: user.id }).eq('id', booking.attendance_id)
    } else {
      await supabase.from('attendance').insert({
        schedule_id: lesson.id, student_id: booking.student_id,
        status: newStatus, basis: booking.basis, marked_by: user.id
      })
    }
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, attendance_status: newStatus } : b))
  }

  const handleSearch = async (val) => {
    setSearch(val)
    if (val.length < 2) { setSearchResults([]); return }
    const { data } = await supabase.from('profiles').select('id, full_name, email, phone').eq('role', 'client').ilike('full_name', `%${val}%`)
    setSearchResults(data || [])
  }

  const handleAddStudent = async (student) => {
    const already = bookings.find(b => b.student_id === student.id)
    if (already) { setSearch(''); setSearchResults([]); return }
    await supabase.from('bookings').insert({ schedule_id: lesson.id, student_id: student.id, status: 'booked' })
    setSearch(''); setSearchResults([])
    loadBookings()
  }

  const handleChangeTeacher = async () => {
    if (!newTeacherId) return
    setSaving(true)
    await supabase.from('schedule').update({ teacher_id: newTeacherId }).eq('id', lesson.id)
    setSaving(false)
    setShowChangeTeacher(false)
    onLessonUpdate?.()
  }

  const handleReschedule = async () => {
    if (!newDate || !newTimeFrom || !newTimeTo) return
    setSaving(true)
    const toLocalISO = (dateStr, timeStr) => {
      const d = new Date(`${dateStr}T${timeStr}`)
      const offset = d.getTimezoneOffset()
      return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 19)
    }
    await supabase.from('schedule').update({
      starts_at: toLocalISO(newDate, newTimeFrom),
      ends_at: toLocalISO(newDate, newTimeTo)
    }).eq('id', lesson.id)
    setSaving(false)
    setShowReschedule(false)
    onLessonUpdate?.()
  }

  const handleCancel = async () => {
    if (!confirm('Отменить занятие? Оно останется в расписании с пометкой "Отменено"')) return
    await supabase.from('schedule').update({ is_cancelled: true }).eq('id', lesson.id)
    onLessonUpdate?.()
    onClose()
  }

  const formatHeader = () => {
    const date = new Date(lesson.starts_at).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
    const timeFrom = new Date(lesson.starts_at).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})
    const timeTo = new Date(lesson.ends_at).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})
    const title = lesson.groups?.name || lesson.title || 'Занятие'
    return { date, time: `${timeFrom}–${timeTo}`, title }
  }

  const { date, time, title } = formatHeader()
  const presentCount = bookings.filter(b => b.attendance_status === 'present').length
  const absentCount = bookings.filter(b => b.attendance_status === 'absent').length
  const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }

  return (
    <div style={{
      position:'fixed', top:0, right:0, bottom:0, width:480,
      background:'#fff', boxShadow:'-4px 0 20px rgba(0,0,0,0.1)',
      zIndex:100, display:'flex', flexDirection:'column', fontFamily:'Inter,sans-serif'
    }}>
      {/* Заголовок */}
      <div style={{padding:'16px 20px', borderBottom:'1px solid #f0f0f0'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
          <div>
            <div style={{fontSize:15, fontWeight:700, color: lesson.is_cancelled ? '#BDBDBD' : '#2a2a2a', marginBottom:2, textDecoration: lesson.is_cancelled ? 'line-through' : 'none'}}>
              {title} {lesson.is_cancelled && <span style={{fontSize:11, color:'#e74c3c', fontWeight:400, textDecoration:'none'}}> · Отменено</span>}
            </div>
            <div style={{fontSize:12, color:'#888'}}>{date} · {time}</div>
            {lesson.teacher && <div style={{fontSize:12, color:'#888'}}>{lesson.teacher.full_name} · {lesson.hall}</div>}
          </div>
          <button onClick={onClose} style={{fontSize:20, color:'#BDBDBD', background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1}}>×</button>
        </div>

        {/* Счётчики */}
        <div style={{display:'flex', gap:8, marginBottom:12}}>
          <span style={{background:'#eafaf1', color:'#27ae60', padding:'3px 10px', borderRadius:6, fontSize:12, fontWeight:600}}>✅ {presentCount}</span>
          <span style={{background:'#fdecea', color:'#e74c3c', padding:'3px 10px', borderRadius:6, fontSize:12, fontWeight:600}}>❌ {absentCount}</span>
          <span style={{background:'#f5f5f5', color:'#BDBDBD', padding:'3px 10px', borderRadius:6, fontSize:12, fontWeight:600}}>👥 {bookings.length}</span>
        </div>

        {/* Поиск */}
        <div style={{position:'relative'}}>
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Записать ученика..."
            style={{...inputStyle, marginBottom:0}} />
          {searchResults.length > 0 && (
            <div style={{position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, zIndex:10, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', marginTop:4}}>
              {searchResults.map(s => (
                <div key={s.id} onClick={() => handleAddStudent(s)}
                  style={{padding:'10px 14px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f5f5f5'}}
                  onMouseEnter={e => e.currentTarget.style.background='#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                  <div style={{fontWeight:500}}>{s.full_name || s.email}</div>
                  {s.phone && <div style={{fontSize:11, color:'#BDBDBD'}}>{s.phone}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Список учеников */}
      <div style={{flex:1, overflowY:'auto'}}>
        {loading ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
        ) : bookings.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Никто не записан</div>
        ) : (
          bookings.map(b => <StudentRow key={b.id} booking={b} onStatusChange={handleStatusChange} />)
        )}
      </div>

      {/* Замена преподавателя */}
      {showChangeTeacher && (
        <div style={{padding:'12px 16px', borderTop:'1px solid #f0f0f0', background:'#f9f9f9'}}>
          <div style={{fontSize:12, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>Заменить преподавателя</div>
          <select value={newTeacherId} onChange={e => setNewTeacherId(e.target.value)}
            style={{...inputStyle, marginBottom:8}}>
            <option value="">Выберите преподавателя</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
          </select>
          <div style={{display:'flex', gap:8}}>
            <button onClick={handleChangeTeacher} disabled={saving}
              style={{flex:1, padding:'8px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
            <button onClick={() => setShowChangeTeacher(false)}
              style={{padding:'8px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Перенос занятия */}
      {showReschedule && (
        <div style={{padding:'12px 16px', borderTop:'1px solid #f0f0f0', background:'#f9f9f9'}}>
          <div style={{fontSize:12, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>Перенести занятие</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8}}>
            <div>
              <div style={{fontSize:11, color:'#888', marginBottom:3}}>Дата</div>
              <input value={newDate} onChange={e => setNewDate(e.target.value)} type="date" style={inputStyle} />
            </div>
            <div>
              <div style={{fontSize:11, color:'#888', marginBottom:3}}>Начало</div>
              <input value={newTimeFrom} onChange={e => setNewTimeFrom(e.target.value)} type="time" style={inputStyle} />
            </div>
            <div>
              <div style={{fontSize:11, color:'#888', marginBottom:3}}>Конец</div>
              <input value={newTimeTo} onChange={e => setNewTimeTo(e.target.value)} type="time" style={inputStyle} />
            </div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={handleReschedule} disabled={saving}
              style={{flex:1, padding:'8px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              {saving ? 'Сохраняем...' : 'Перенести'}
            </button>
            <button onClick={() => setShowReschedule(false)}
              style={{padding:'8px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Кнопки внизу */}
      {!showChangeTeacher && !showReschedule && (
        <div style={{padding:'12px 16px', borderTop:'1px solid #f0f0f0', display:'flex', gap:8, flexWrap:'wrap'}}>
          <button
            onClick={() => {}}
            style={{flex:1, padding:'8px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:12, color:'#6a7700', cursor:'pointer', fontWeight:600, fontFamily:'Inter,sans-serif'}}>
            ✉️ Написать
          </button>
          <button
            onClick={() => setShowChangeTeacher(true)}
            style={{flex:1, padding:'8px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            👤 Заменить
          </button>
          <button
            onClick={() => setShowReschedule(true)}
            style={{flex:1, padding:'8px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            📅 Перенести
          </button>
          <button
            onClick={handleCancel}
            disabled={lesson.is_cancelled}
            style={{flex:1, padding:'8px', background: lesson.is_cancelled ? '#f5f5f5' : '#fdecea', border:'none', borderRadius:8, fontSize:12, color: lesson.is_cancelled ? '#BDBDBD' : '#e74c3c', cursor: lesson.is_cancelled ? 'default' : 'pointer', fontFamily:'Inter,sans-serif'}}>
            {lesson.is_cancelled ? 'Отменено' : '✕ Отменить'}
          </button>
        </div>
      )}
    </div>
  )
}