import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const STATUS_OPTIONS = [
  { value: 'none',        label: 'Не отмечен',  color: '#BDBDBD', bg: '#f5f5f5' },
  { value: 'present',     label: 'Пришёл',       color: '#27ae60', bg: '#eafaf1' },
  { value: 'absent',      label: 'Не пришёл',    color: '#e74c3c', bg: '#fdecea' },
  { value: 'cancelled',   label: 'Отказался',    color: '#f39c12', bg: '#fef9e7' },
  { value: 'transferred', label: 'Перенос',      color: '#8e44ad', bg: '#f5eef8' },
]

const BASIS_LABELS = {
  subscription: 'Абонемент',
  single:       'Разовое',
  trial:        'Пробное',
  indiv:        'Индив',
  none:         'Без основания',
}

function StatusButton({ status, isTrial, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  const options = STATUS_OPTIONS.filter(s => s.value !== 'none' && (s.value !== 'transferred' || isTrial))

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          padding: '5px 10px', border: `1px solid ${current.color}`,
          borderRadius: 8, fontSize: 12, background: current.bg,
          color: current.color, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 4,
          opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
        }}
      >
        {current.label}
        {!disabled && <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, background: '#fff',
          border: '1px solid #e8e8e8', borderRadius: 10, zIndex: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 140, overflow: 'hidden',
        }}>
          {options.map(opt => (
            <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: opt.color, fontWeight: 600, fontFamily: 'Inter,sans-serif', background: opt.value === status ? opt.bg : '#fff', borderBottom: '1px solid #f5f5f5' }}
              onMouseEnter={e => e.currentTarget.style.background = opt.bg}
              onMouseLeave={e => e.currentTarget.style.background = opt.value === status ? opt.bg : '#fff'}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StudentRow({ booking, onStatusChange, lessonStarted }) {
  const [status, setStatus] = useState(booking.attendance_status || 'none')
  const [saving, setSaving] = useState(false)

  // Синхронизируем при перезагрузке списка (после loadBookings из родителя)
  useEffect(() => { setStatus(booking.attendance_status || 'none') }, [booking.attendance_status])

  const handleChange = async (newStatus) => {
    if (saving) return
    const prev = status
    setSaving(true)
    setStatus(newStatus)            // оптимистично
    const ok = await onStatusChange(booking, newStatus, prev)
    if (!ok) setStatus(prev)        // откат, если RPC не прошла
    setSaving(false)
  }

  const basis = booking.basis || 'none'
  const isNoBasis = basis === 'none'
  const isTrial = basis === 'trial'
  const isIndiv = basis === 'indiv'
  const formatDate = (dt) => dt ? new Date(dt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <div style={{
      padding: '12px 16px', borderBottom: '1px solid #f5f5f5',
      background: isNoBasis ? '#fff8f8' : '#fff',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: isIndiv ? '#e8f4fd' : isNoBasis ? '#fdecea' : '#fafde8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
        color: isIndiv ? '#2980b9' : isNoBasis ? '#e74c3c' : '#6a7700', flexShrink: 0,
      }}>
        {(booking.profiles?.full_name || '?')[0].toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>
            {booking.profiles?.full_name || booking.profiles?.email || '—'}
          </span>
          {booking.profiles?.birth_date && (
            <span style={{ fontSize: 11, color: '#BDBDBD' }}>
              {new Date().getFullYear() - new Date(booking.profiles.birth_date).getFullYear()} лет
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: isNoBasis ? '#e74c3c' : isIndiv ? '#2980b9' : '#6a7700',
            background: isNoBasis ? '#fdecea' : isIndiv ? '#e8f4fd' : '#fafde8',
            padding: '1px 6px', borderRadius: 4,
          }}>
            {isNoBasis ? '⚠️ Без основания' : BASIS_LABELS[basis]}
          </span>
          {/* Статус оплаты для индивов */}
          {isIndiv && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: booking.has_package ? '#27ae60' : '#f39c12',
              background: booking.has_package ? '#eafaf1' : '#fef9e7',
              padding: '1px 6px', borderRadius: 4,
            }}>
              {booking.has_package ? `✓ ${booking.package_name || 'Пакет оплачен'}` : '⚠ Нет пакета'}
            </span>
          )}
          {booking.subscription_expires && !isNoBasis && !isIndiv && (
            <span style={{ fontSize: 10, color: '#BDBDBD' }}>до {formatDate(booking.subscription_expires)}</span>
          )}
        </div>
      </div>

      <StatusButton
        status={status}
        isTrial={isTrial}
        onChange={handleChange}
        disabled={saving || !lessonStarted}
      />
    </div>
  )
}

function TransferModal({ booking, lesson, onClose, onDone }) {
  const [slots, setSlots] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadSlots = async () => {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
      const { data } = await supabase
        .from('schedule')
        .select('id, starts_at, ends_at, title, groups(name)')
        .gte('starts_at', today)
        .eq('is_cancelled', false)
        .neq('id', lesson.id)
        .order('starts_at', { ascending: true })
        .limit(30)
      setSlots(data || [])
      setLoading(false)
    }
    loadSlots()
  }, [])

  const handleConfirm = async () => {
    if (!selected || saving) return
    setSaving(true)
    // Атомарный перенос: attendance → 'transferred' + INSERT booking на новое
    // занятие в одной транзакции. Раньше делалось двумя независимыми запросами,
    // и сбой второго оставлял attendance как 'transferred' без нового booking'а.
    const { data, error } = await supabase.rpc('transfer_trial', {
      p_schedule_id:        lesson.id,
      p_target_schedule_id: selected,
      p_student_id:         booking.student_id,
    })
    setSaving(false)
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated: 'Сессия истекла, войдите заново',
        forbidden:         'Недостаточно прав',
        same_lesson:       'Нельзя перенести на то же занятие',
        source_not_found:  'Текущее занятие не найдено',
        target_not_found:  'Выбранное занятие не найдено',
        target_cancelled:  'Выбранное занятие отменено',
      }[data?.error] || `Не удалось перенести: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    onDone()
  }

  const fmt = (dt) => new Date(dt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' }) + ' ' + new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2a2a2a', marginBottom: 4 }}>Перенос пробного занятия</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>{booking.profiles?.full_name} → выберите новое занятие</div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {loading ? <div style={{ color: '#BDBDBD', textAlign: 'center', padding: 24 }}>Загрузка...</div>
          : slots.length === 0 ? <div style={{ color: '#BDBDBD', textAlign: 'center', padding: 24 }}>Нет доступных занятий</div>
          : slots.map(slot => (
            <div key={slot.id} onClick={() => setSelected(slot.id)} style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', border: `1px solid ${selected === slot.id ? '#BFD900' : '#e8e8e8'}`, background: selected === slot.id ? '#fafde8' : '#fff' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>{slot.groups?.name || slot.title || 'Занятие'}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{fmt(slot.starts_at)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleConfirm} disabled={!selected || saving} style={{ flex: 1, padding: '10px', background: selected ? '#BFD900' : '#f0f0f0', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: selected ? '#2a2a2a' : '#BDBDBD', cursor: selected ? 'pointer' : 'default', fontFamily: 'Inter,sans-serif' }}>
            {saving ? 'Переносим...' : 'Перенести'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #e0e0e0', borderRadius: 10, fontSize: 13, color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

export default function AttendancePanel({ lesson, session, onClose, teachers, onLessonUpdate }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [salaryCalc, setSalaryCalc] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcSaved, setCalcSaved] = useState(false)
  const [transferBooking, setTransferBooking] = useState(null)
  const [showChangeTeacher, setShowChangeTeacher] = useState(false)
  const [newTeacherId, setNewTeacherId] = useState(lesson.teacher_id || '')
  const [showReschedule, setShowReschedule] = useState(false)
  const [newDate, setNewDate] = useState(lesson.starts_at ? new Date(lesson.starts_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }) : '')
  const [newTimeFrom, setNewTimeFrom] = useState(lesson.starts_at ? new Date(lesson.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '')
  const [newTimeTo, setNewTimeTo] = useState(lesson.ends_at ? new Date(lesson.ends_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '')
  const [saving, setSaving] = useState(false)

  const isIndivLesson = lesson.lesson_type === 'indiv'

  useEffect(() => {
    if (lesson) { loadBookings(); checkExistingCalc() }
  }, [lesson])

  const loadBookings = async () => {
    setLoading(true)

    // ─── Индив-занятие: загружаем ученика напрямую ────────────────────────
    if (isIndivLesson && lesson.indiv_student_id) {
      const { data: studentProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, birth_date, phone')
        .eq('id', lesson.indiv_student_id)
        .single()

      // Проверяем indiv_request для этого занятия
      const { data: indivReq } = await supabase
        .from('indiv_requests')
        .select('*, package:indiv_packages(id, name, visits_count)')
        .eq('schedule_id', lesson.id)
        .maybeSingle()

      // Проверяем attendance
      const { data: att } = await supabase
        .from('attendance')
        .select('id, status, basis')
        .eq('schedule_id', lesson.id)
        .eq('student_id', lesson.indiv_student_id)
        .maybeSingle()

      setBookings([{
        id: `indiv-${lesson.indiv_student_id}`,
        student_id: lesson.indiv_student_id,
        schedule_id: lesson.id,
        status: 'confirmed',
        profiles: studentProfile,
        attendance_status: att?.status || 'none',
        basis: 'indiv',
        subscription_expires: null,
        attendance_id: att?.id,
        subscription_id: null,
        is_indiv: true,
        has_package: !!indivReq?.package_id,
        package_name: indivReq?.package?.name,
      }])
      setLoading(false)
      return
    }

    // ─── Обычное занятие ──────────────────────────────────────────────────
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*, profiles!bookings_student_id_fkey(id, full_name, email, birth_date, phone)')
      .eq('schedule_id', lesson.id)
      .neq('status', 'cancelled')

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('id, student_id, status, basis, subscription_expires, subscription_id')
      .eq('schedule_id', lesson.id)

    const attMap = {}
    ;(attendanceData || []).forEach(a => { attMap[a.student_id] = a })

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    const studentIds = (bookingsData || []).filter(b => !attMap[b.student_id]).map(b => b.student_id)
    const subMap = {}

    if (studentIds.length > 0) {
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('id, student_id, visits_total, expires_at, subscription_allowed_groups(group_id)')
        .in('student_id', studentIds)
        .eq('is_frozen', false)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order('expires_at', { ascending: true })

      ;(subs || []).forEach(s => {
        if (subMap[s.student_id]) return
        const groups = s.subscription_allowed_groups || []
        const fits = groups.length === 0 || groups.some(g => g.group_id === lesson.group_id)
        if (fits) {
          subMap[s.student_id] = {
            id: s.id,
            basis: s.visits_total === null ? 'subscription' : s.visits_total <= 1 ? 'single' : 'subscription',
            expires_at: s.expires_at,
          }
        }
      })
    }

    setBookings((bookingsData || []).map(b => {
      const att = attMap[b.student_id]
      const sub = subMap[b.student_id]
      return {
        ...b,
        attendance_status: att?.status || 'none',
        basis: att?.basis || sub?.basis || 'none',
        subscription_expires: att?.subscription_expires || sub?.expires_at,
        attendance_id: att?.id,
        subscription_id: att?.subscription_id || sub?.id,
      }
    }))

    setLoading(false)
  }

  const checkExistingCalc = async () => {
    const { data } = await supabase.from('lesson_payments').select('*').eq('schedule_id', lesson.id).maybeSingle()
    if (data) {
      setSalaryCalc({ amount: data.amount, paid_students: data.paid_students, saved: true })
      setCalcSaved(true)
    }
  }

  const handleStatusChange = async (booking, newStatus) => {
    // Перенос пробного — отдельный сценарий через модалку, RPC не вызывается
    if (newStatus === 'transferred' && booking.basis === 'trial') {
      setTransferBooking(booking)
      return false
    }

    const { data, error } = await supabase.rpc('mark_attendance', {
      p_schedule_id: lesson.id,
      p_student_id:  booking.student_id,
      p_new_status:  newStatus,
    })

    if (error) {
      alert('Ошибка сети: ' + error.message)
      return false
    }
    if (!data?.ok) {
      const msg = {
        not_authenticated: 'Сессия истекла, войдите заново',
        forbidden:         'Недостаточно прав',
        invalid_status:    'Недопустимый статус',
        lesson_not_found:  'Занятие не найдено',
        lesson_cancelled:  'Занятие отменено — отметка невозможна',
        not_your_lesson:   'Можно отмечать только свои занятия',
        out_of_visits:     `На абонементе нет свободных визитов (${data.visits_used ?? '?'} из ${data.visits_total ?? '?'})`,
      }[data?.error] || `Не удалось сохранить отметку: ${data?.error || 'неизвестная ошибка'}`
      alert(msg)
      return false
    }

    // Синхронизируем строку: используем серверные basis/subscription_id, чтобы UI не врал
    setBookings(prev => prev.map(b => b.id === booking.id ? {
      ...b,
      attendance_status: newStatus,
      attendance_id:     data.attendance_id || b.attendance_id,
      basis:             data.basis || b.basis,
      subscription_id:   data.subscription_id ?? b.subscription_id,
    } : b))
    return true
  }

  const calculateSalary = async () => {
    if (calcLoading) return
    setCalcLoading(true)
    // Расчёт ведётся на сервере (preview_lesson_salary), чтобы предпросмотр
    // показывал ровно то же число, что потом запишет save_lesson_salary.
    const { data, error } = await supabase.rpc('preview_lesson_salary', { p_schedule_id: lesson.id })
    setCalcLoading(false)
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated: 'Сессия истекла, войдите заново',
        forbidden:         'Недостаточно прав',
        lesson_not_found:  'Занятие не найдено',
        lesson_cancelled:  'Занятие отменено',
        no_teacher:        'У занятия не назначен преподаватель',
        not_your_lesson:   'Можно рассчитывать только свои занятия',
      }[data?.error] || `Не удалось рассчитать: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    setSalaryCalc({
      amount: Number(data.amount),
      paid_students: data.paid_students,
      actualTeacherId: data.actual_teacher_id,
      isSubstitution:  data.is_substitution,
    })
  }

  const saveSalaryCalc = async () => {
    if (!salaryCalc || calcLoading) return
    setCalcLoading(true)
    const { data, error } = await supabase.rpc('save_lesson_salary', { p_schedule_id: lesson.id })
    setCalcLoading(false)
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated: 'Сессия истекла, войдите заново',
        forbidden:         'Недостаточно прав',
        lesson_not_found:  'Занятие не найдено',
        lesson_cancelled:  'Занятие отменено',
        no_teacher:        'У занятия не назначен преподаватель',
        not_your_lesson:   'Можно закрывать только свои занятия',
      }[data?.error] || `Не удалось сохранить начисление: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    // Если расчёт сервера отличается от клиентского предпросмотра — показываем серверный
    setSalaryCalc(prev => ({ ...prev, paid_students: data.paid_students, amount: Number(data.amount), saved: true }))
    setCalcSaved(true)
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
    const { error } = await supabase.from('bookings').insert({ schedule_id: lesson.id, student_id: student.id, status: 'booked', ...(session?.user?.id ? { created_by: session.user.id } : {}) })
    if (error) { console.error('Booking error:', error); return }
    setSearch(''); setSearchResults([])
    loadBookings()
  }

  const handleChangeTeacher = async () => {
    if (!newTeacherId) return
    setSaving(true)
    await supabase.from('schedule').update({ teacher_id: newTeacherId }).eq('id', lesson.id)
    setSaving(false); setShowChangeTeacher(false); onLessonUpdate?.()
  }

  const handleReschedule = async () => {
    if (!newDate || !newTimeFrom || !newTimeTo) return
    setSaving(true)
    const toLocalISO = (dateStr, timeStr) => { const d = new Date(`${dateStr}T${timeStr}`); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19) }
    await supabase.from('schedule').update({ starts_at: toLocalISO(newDate, newTimeFrom), ends_at: toLocalISO(newDate, newTimeTo) }).eq('id', lesson.id)
    setSaving(false); setShowReschedule(false); onLessonUpdate?.()
  }

  const handleCancel = async () => {
    if (saving) return
    if (!confirm('Отменить занятие?\n\nЕсли кто-то был отмечен «Пришёл» — визиты вернутся в их абонементы. Зарплата за этот урок будет отозвана.')) return
    setSaving(true)
    const { data, error } = await supabase.rpc('cancel_lesson', { p_schedule_id: lesson.id })
    setSaving(false)
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated: 'Сессия истекла, войдите заново',
        forbidden:         'Недостаточно прав',
        lesson_not_found:  'Занятие не найдено',
        already_cancelled: 'Занятие уже отменено',
        not_your_lesson:   'Можно отменять только свои занятия',
      }[data?.error] || `Не удалось отменить: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    const parts = [
      `Возвращено визитов: ${data.refunded_visits}`,
      data.removed_payments > 0 ? 'Зарплата за урок отозвана' : null,
    ].filter(Boolean)
    if (parts.length > 0) alert(parts.join('\n'))
    onLessonUpdate?.(); onClose()
  }

  const formatHeader = () => {
    const date = new Date(lesson.starts_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    const timeFrom = new Date(lesson.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    const timeTo = new Date(lesson.ends_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    const title = isIndivLesson
      ? (lesson.title || `Индив: ${bookings[0]?.profiles?.full_name || ''}`)
      : (lesson.groups?.name || lesson.title || 'Занятие')
    return { date, time: `${timeFrom}–${timeTo}`, title }
  }

  const { date, time, title } = formatHeader()
  const presentCount = bookings.filter(b => b.attendance_status === 'present').length
  const absentCount = bookings.filter(b => b.attendance_status === 'absent').length
  const isPast = new Date(lesson.ends_at) < new Date()
  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #e8e8e8', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'Inter,sans-serif' }

  return (
    <>
      {transferBooking && (
        <TransferModal booking={transferBooking} lesson={lesson} onClose={() => setTransferBooking(null)} onDone={() => { setTransferBooking(null); loadBookings() }} />
      )}

      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexDirection: 'column', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, color: lesson.is_cancelled ? '#BDBDBD' : '#2a2a2a', textDecoration: lesson.is_cancelled ? 'line-through' : 'none' }}>
                {title}
                {lesson.is_cancelled && <span style={{ fontSize: 11, color: '#e74c3c', fontWeight: 400, textDecoration: 'none' }}> · Отменено</span>}
                {isIndivLesson && <span style={{ fontSize: 11, color: '#2980b9', fontWeight: 400 }}> · Индив</span>}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>{date} · {time}</div>
              {lesson.teacher && <div style={{ fontSize: 12, color: '#888' }}>{lesson.teacher.full_name} · {lesson.hall}</div>}
            </div>
            <button onClick={onClose} style={{ fontSize: 20, color: '#BDBDBD', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ background: '#eafaf1', color: '#27ae60', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>✅ {presentCount}</span>
            <span style={{ background: '#fdecea', color: '#e74c3c', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>❌ {absentCount}</span>
            <span style={{ background: '#f5f5f5', color: '#BDBDBD', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>👥 {bookings.length}</span>
          </div>

          {/* Поиск только для обычных занятий */}
          {!isIndivLesson && (
            <div style={{ position: 'relative' }}>
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Записать ученика..." style={{ ...inputStyle, marginBottom: 0 }} />
              {searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4 }}>
                  {searchResults.map(s => (
                    <div key={s.id} onClick={() => handleAddStudent(s)}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f5f5f5' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <div style={{ fontWeight: 500 }}>{s.full_name || s.email}</div>
                      {s.phone && <div style={{ fontSize: 11, color: '#BDBDBD' }}>{s.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#BDBDBD', padding: 40 }}>Загрузка...</div>
          ) : bookings.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#BDBDBD', padding: 40 }}>Никто не записан</div>
          ) : bookings.map(b => (
            <StudentRow key={b.id} booking={b} onStatusChange={handleStatusChange} lessonStarted={Date.now() >= new Date(lesson.starts_at + '+03:00').getTime()} />
          ))}
        </div>

        {isPast && !showChangeTeacher && !showReschedule && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fafde8' }}>
            {!salaryCalc ? (
              <button onClick={calculateSalary} disabled={calcLoading} style={{ width: '100%', padding: '10px', background: '#BFD900', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#2a2a2a', cursor: 'pointer', fontFamily: 'Inter,sans-serif', opacity: calcLoading ? 0.6 : 1 }}>
                {calcLoading ? 'Считаем...' : '📊 Рассчитать зарплату'}
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6a7700', marginBottom: 8 }}>Расчёт зарплаты</div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>Оплаченных клиентов</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#2a2a2a' }}>{salaryCalc.paid_students}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>К начислению</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: salaryCalc.amount > 0 ? '#27ae60' : '#e74c3c' }}>
                      {salaryCalc.amount > 0 ? `${salaryCalc.amount.toLocaleString('ru-RU')} ₽` : 'Ставка не настроена'}
                    </div>
                  </div>
                  {salaryCalc.isSubstitution && <div style={{ fontSize: 11, color: '#f39c12', fontWeight: 600, alignSelf: 'center' }}>🔄 Замена</div>}
                </div>
                {!calcSaved ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveSalaryCalc} disabled={calcLoading} style={{ flex: 1, padding: '8px', background: '#27ae60', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                      {calcLoading ? 'Сохраняем...' : '✅ Подтвердить'}
                    </button>
                    <button onClick={() => setSalaryCalc(null)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Пересчитать</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#27ae60', fontWeight: 600 }}>✅ Начислено и сохранено</div>
                )}
              </div>
            )}
          </div>
        )}

        {showChangeTeacher && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#f9f9f9' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a', marginBottom: 8 }}>Заменить преподавателя</div>
            <select value={newTeacherId} onChange={e => setNewTeacherId(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
              <option value="">Выберите преподавателя</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleChangeTeacher} disabled={saving} style={{ flex: 1, padding: '8px', background: '#BFD900', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#2a2a2a', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{saving ? 'Сохраняем...' : 'Сохранить'}</button>
              <button onClick={() => setShowChangeTeacher(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Отмена</button>
            </div>
          </div>
        )}

        {showReschedule && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#f9f9f9' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a', marginBottom: 8 }}>Перенести занятие</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Дата</div><input value={newDate} onChange={e => setNewDate(e.target.value)} type="date" style={inputStyle} /></div>
              <div><div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Начало</div><input value={newTimeFrom} onChange={e => setNewTimeFrom(e.target.value)} type="time" style={inputStyle} /></div>
              <div><div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Конец</div><input value={newTimeTo} onChange={e => setNewTimeTo(e.target.value)} type="time" style={inputStyle} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleReschedule} disabled={saving} style={{ flex: 1, padding: '8px', background: '#BFD900', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#2a2a2a', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{saving ? 'Сохраняем...' : 'Перенести'}</button>
              <button onClick={() => setShowReschedule(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Отмена</button>
            </div>
          </div>
        )}

        {!showChangeTeacher && !showReschedule && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => {}} style={{ flex: 1, padding: '8px', background: '#fafde8', border: '1px solid #BFD900', borderRadius: 8, fontSize: 12, color: '#6a7700', cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>✉️ Написать</button>
            <button onClick={() => setShowChangeTeacher(true)} style={{ flex: 1, padding: '8px', background: '#f5f5f5', border: 'none', borderRadius: 8, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>👤 Заменить</button>
            <button onClick={() => setShowReschedule(true)} style={{ flex: 1, padding: '8px', background: '#f5f5f5', border: 'none', borderRadius: 8, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>📅 Перенести</button>
            <button onClick={handleCancel} disabled={lesson.is_cancelled} style={{ flex: 1, padding: '8px', background: lesson.is_cancelled ? '#f5f5f5' : '#fdecea', border: 'none', borderRadius: 8, fontSize: 12, color: lesson.is_cancelled ? '#BDBDBD' : '#e74c3c', cursor: lesson.is_cancelled ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
              {lesson.is_cancelled ? 'Отменено' : '✕ Отменить'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}