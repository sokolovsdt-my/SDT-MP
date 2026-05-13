import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'

const STATUS_LABELS = {
  new:        { label: 'Новая',          color: '#2980b9', bg: '#e8f4fd' },
  in_progress:{ label: 'В работе',       color: '#f39c12', bg: '#fef9e7' },
  done:       { label: 'Выполнена',      color: '#27ae60', bg: '#eafaf1' },
  cancelled:  { label: 'Отменена',       color: '#BDBDBD', bg: '#f5f5f5' },
  postponed:  { label: 'Перенесена',     color: '#8e44ad', bg: '#f5eef8' },
  problem:    { label: 'Есть трудности', color: '#e74c3c', bg: '#fdecea' },
}

const PRIORITY_LABELS = {
  low:    { label: 'Низкий',   color: '#BDBDBD' },
  normal: { label: 'Средний',  color: '#f39c12' },
  high:   { label: 'Высокий',  color: '#e74c3c' },
}

const ACTIVE_STATUSES = ['new', 'in_progress', 'postponed', 'problem']
const DONE_STATUSES   = ['done', 'cancelled']

const btn = (extra = {}) => ({
  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'Inter,sans-serif', border: '1px solid #e0e0e0',
  background: '#fff', color: '#2a2a2a', ...extra
})

// ─── Модалка: контакты клиента ────────────────────────────────────────────────
function ClientContactModal({ clientId, onClose }) {
  const [client, setClient] = useState(null)
  const [reps, setReps] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: c } = await supabase.from('profiles').select('full_name, phone, email').eq('id', clientId).single()
      setClient(c)
      const { data: r } = await supabase.from('client_representatives').select('full_name, role, phone, contact').eq('client_id', clientId)
      setReps(r || [])
    }
    load()
  }, [clientId])

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{background:'#fff',borderRadius:16,padding:24,width:360,border:'1px solid #f0f0f0'}}>
        <div style={{fontSize:15,fontWeight:600,color:'#2a2a2a',marginBottom:4}}>Контакты клиента</div>
        <div style={{fontSize:12,color:'#888',marginBottom:16}}>Для связи по запросу на индив</div>
        {client ? (
          <div style={{background:'#f9f9f9',borderRadius:10,padding:14,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a',marginBottom:8}}>{client.full_name}</div>
            {client.phone && <div style={{fontSize:13,color:'#2a2a2a',marginBottom:4}}>📱 <a href={`tel:${client.phone}`} style={{color:'#2980b9',textDecoration:'none'}}>{client.phone}</a></div>}
            {client.email && <div style={{fontSize:13,color:'#2a2a2a'}}>✉️ <a href={`mailto:${client.email}`} style={{color:'#2980b9',textDecoration:'none'}}>{client.email}</a></div>}
          </div>
        ) : (
          <div style={{color:'#BDBDBD',fontSize:13,marginBottom:12}}>Загрузка...</div>
        )}
        {reps.length > 0 && (
          <div>
            <div style={{fontSize:11,color:'#888',fontWeight:600,marginBottom:6}}>Представители</div>
            {reps.map((r, i) => (
              <div key={i} style={{background:'#f9f9f9',borderRadius:8,padding:10,marginBottom:6}}>
                <div style={{fontSize:12,fontWeight:600,color:'#2a2a2a'}}>{r.full_name} <span style={{color:'#888',fontWeight:400}}>({r.role})</span></div>
                {r.phone && <div style={{fontSize:12,color:'#2a2a2a',marginTop:2}}>📱 <a href={`tel:${r.phone}`} style={{color:'#2980b9',textDecoration:'none'}}>{r.phone}</a></div>}
                {r.contact && <div style={{fontSize:12,color:'#888',marginTop:2}}>{r.contact}</div>}
              </div>
            ))}
          </div>
        )}
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button onClick={() => { navigate(`/admin/clients/${clientId}`); onClose() }}
            style={{...btn(), flex:1, background:'#fafde8', borderColor:'#BFD900', color:'#6a7700'}}>
            Открыть карточку →
          </button>
          <button onClick={onClose} style={btn()}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

// ─── Модалка: назначить зал ───────────────────────────────────────────────────
function HallModal({ request, onClose, onConfirm }) {
  const [hall, setHall] = useState('Малый зал')
  const [hallFree, setHallFree] = useState(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { checkHall(hall) }, [hall])

  const checkHall = async (h) => {
    setChecking(true)
    setHallFree(null)
    const dateStr = request.slot_date
    const start = `${dateStr}T${request.start_time}`
    const end = `${dateStr}T${request.end_time}`
    const { data } = await supabase.from('schedule').select('id').eq('hall', h).eq('is_cancelled', false).lt('starts_at', end).gt('ends_at', start).neq('id', request.schedule_id || '00000000-0000-0000-0000-000000000000')
    setHallFree((data || []).length === 0)
    setChecking(false)
  }

  const handleConfirm = async () => {
    setSaving(true)
    await onConfirm(hall)
    setSaving(false)
  }

  const hasPackage = !!request.package_id
  const dateLabel = new Date(request.slot_date).toLocaleDateString('ru-RU', { day:'numeric', month:'long' })
  const timeLabel = `${request.start_time?.slice(0,5)} — ${request.end_time?.slice(0,5)}`

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{background:'#fff',borderRadius:16,padding:24,width:400,border:'1px solid #f0f0f0'}}>
        <div style={{fontSize:15,fontWeight:600,color:'#2a2a2a',marginBottom:4}}>Подтвердить индив</div>
        <div style={{fontSize:12,color:'#888',marginBottom:20}}>{request.client?.full_name} · {request.teacher?.full_name} · {dateLabel}, {timeLabel}</div>
        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:8}}>Выберите зал</div>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          {['Большой зал','Малый зал'].map(h => (
            <button key={h} onClick={() => setHall(h)} style={{...btn(hall===h ? {background:'#fafde8',borderColor:'#BFD900',color:'#6a7700'} : {}), flex:1}}>{h}</button>
          ))}
        </div>
        <div style={{background:'#f9f9f9',borderRadius:10,padding:12,marginBottom:16}}>
          <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:600}}>{hall} · {dateLabel} {timeLabel}</div>
          {checking ? <div style={{fontSize:13,color:'#888'}}>Проверяем...</div>
            : hallFree === true ? <div style={{fontSize:13,color:'#27ae60'}}>✓ Зал свободен</div>
            : hallFree === false ? <div style={{fontSize:13,color:'#e74c3c'}}>✕ Зал занят — выберите другой</div>
            : null}
        </div>
        <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:8}}>Оплата</div>
        {hasPackage
          ? <div style={{background:'#eafaf1',borderRadius:10,padding:10,marginBottom:16,fontSize:13,color:'#27ae60'}}>✓ Есть пакет индивов — визит спишется при отметке посещения</div>
          : <div style={{background:'#fdecea',borderRadius:10,padding:10,marginBottom:16,fontSize:13,color:'#c0392b'}}>⚠ Нет пакета индивов — нужна оплата</div>
        }
        <div style={{display:'flex',gap:8}}>
          <button onClick={handleConfirm} disabled={saving || !hallFree}
            style={{...btn({background:'#BFD900',borderColor:'#BFD900',color:'#2a2a2a'}), flex:1, opacity:(!hallFree||saving)?0.5:1}}>
            {saving ? 'Создаём...' : 'Подтвердить и создать занятие'}
          </button>
          <button onClick={onClose} style={btn()}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

// ─── Карточка запроса на индив ────────────────────────────────────────────────
function IndivRequestCard({ request, onUpdate }) {
  const [showHallModal, setShowHallModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const hasPackage = !!request.package_id
  const isConfirmed = request.status === 'confirmed'
  const isRejected = request.status === 'rejected' || request.status === 'cancelled'
  const dateLabel = new Date(request.slot_date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', weekday:'short' })
  const timeLabel = `${request.start_time?.slice(0,5)} — ${request.end_time?.slice(0,5)}`
  const borderColor = isConfirmed ? '#27ae60' : isRejected ? '#BDBDBD' : !hasPackage ? '#e74c3c' : '#BFD900'

  const handleConfirm = async (hall) => {
    const { data, error } = await supabase.rpc('confirm_indiv_request', {
      p_request_id: request.id,
      p_hall: hall,
    })
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated: 'Сессия истекла, войдите заново',
        forbidden:         'Недостаточно прав',
        not_found:         'Заявка не найдена',
        already_handled:   'Заявка уже обработана',
        invalid_hall:      'Неверный зал',
        hall_conflict:     'Этот зал уже занят на выбранное время — выберите другой',
      }[data?.error] || `Не удалось подтвердить: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    setShowHallModal(false)
    onUpdate()
  }

  const handleReject = async () => {
    await supabase.from('indiv_requests').update({ status: 'rejected', reject_reason: rejectReason || null }).eq('id', request.id)
    setShowReject(false)
    onUpdate()
  }

  return (
    <>
      <div style={{background:'#fff',borderRadius:14,border:'1px solid #f0f0f0',borderLeft:`3px solid ${borderColor}`,padding:'14px 16px',marginBottom:10,opacity:isRejected?0.6:1}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:'#2a2a2a',marginBottom:4}}>{request.client?.full_name}</div>
            <div style={{fontSize:12,color:'#888',display:'flex',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span>👤 {request.teacher?.full_name}</span>
              <span>📅 {dateLabel}, {timeLabel}</span>
            </div>
            <div style={{fontSize:12,color:'#888',display:'flex',gap:8,flexWrap:'wrap'}}>
              {hasPackage ? <span style={{color:'#27ae60'}}>✓ Есть пакет индивов</span> : <span style={{color:'#e74c3c'}}>✕ Нет пакета</span>}
              {isConfirmed && request.hall && <span style={{color:'#27ae60'}}>🏛 {request.hall}</span>}
              {request.reject_reason && <span style={{color:'#888'}}>Причина: {request.reject_reason}</span>}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
            {isConfirmed && <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:'#eafaf1',color:'#27ae60'}}>Подтверждено</span>}
            {isRejected && <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:'#f5f5f5',color:'#888'}}>Отклонено</span>}
            {!isConfirmed && !isRejected && !hasPackage && <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:'#fdecea',color:'#e74c3c'}}>Нет пакета</span>}
            {!isConfirmed && !isRejected && hasPackage && <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:'#fafde8',color:'#6a7700'}}>Новый запрос</span>}
            <span style={{fontSize:11,color:'#BDBDBD'}}>{new Date(request.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
          </div>
        </div>
        {!isRejected && (
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {!isConfirmed && <button onClick={() => setShowHallModal(true)} style={btn({background:'#BFD900',borderColor:'#BFD900',color:'#2a2a2a'})}>Назначить зал</button>}
            {isConfirmed && <button onClick={() => window.location.href='/admin/schedule'} style={btn({background:'#eafaf1',borderColor:'#a9dfbf',color:'#27ae60'})}>Открыть расписание</button>}
            <button onClick={() => setShowContactModal(true)} style={btn()}>Написать клиенту</button>
            {!isConfirmed && <button onClick={() => setShowReject(true)} style={btn({background:'#fdecea',borderColor:'#f5b7b1',color:'#c0392b'})}>Отклонить</button>}
          </div>
        )}
        {showReject && (
          <div style={{marginTop:12,background:'#f9f9f9',borderRadius:10,padding:12}}>
            <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:600}}>Причина отклонения (необязательно)</div>
            <input value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
              placeholder="Например: препод недоступен в это время"
              style={{width:'100%',padding:'8px 12px',border:'1px solid #e8e8e8',borderRadius:8,fontSize:13,boxSizing:'border-box',fontFamily:'Inter,sans-serif',marginBottom:8}} />
            <div style={{display:'flex',gap:8}}>
              <button onClick={handleReject} style={{...btn({background:'#e74c3c',borderColor:'#e74c3c',color:'#fff'}), flex:1}}>Подтвердить отклонение</button>
              <button onClick={() => setShowReject(false)} style={btn()}>Отмена</button>
            </div>
          </div>
        )}
      </div>
      {showHallModal && <HallModal request={request} onClose={() => setShowHallModal(false)} onConfirm={handleConfirm} />}
      {showContactModal && <ClientContactModal clientId={request.client_id} onClose={() => setShowContactModal(false)} />}
    </>
  )
}

// ─── Форма новой задачи ───────────────────────────────────────────────────────
function TaskForm({ session, staff, clients, onSave, onCancel }) {
  const [form, setForm] = useState({ title:'', description:'', priority:'normal', deadline:'', is_group:false })
  const [assignees, setAssignees] = useState([])
  const [clientId, setClientId] = useState('')
  const [clientReps, setClientReps] = useState([])
  const [selectedReps, setSelectedReps] = useState([])
  const [groups, setGroups] = useState([])
  const [groupFilters, setGroupFilters] = useState({ group:'', subscription_status:'', age_from:'', age_to:'' })

  useEffect(() => { supabase.from('groups').select('id, name').then(({ data }) => setGroups(data || [])) }, [])
  useEffect(() => {
    if (clientId) {
      supabase.from('client_representatives').select('*').eq('client_id', clientId)
        .then(({ data }) => { setClientReps(data || []); setSelectedReps([]) })
    } else { setClientReps([]); setSelectedReps([]) }
  }, [clientId])

  const toggleAssignee = (id) => setAssignees(p => p.includes(id) ? p.filter(a=>a!==id) : [...p, id])
  const toggleRep = (id) => setSelectedReps(p => p.includes(id) ? p.filter(r=>r!==id) : [...p, id])

  const handleSave = async () => {
    if (!form.title) return
    const { data: task } = await supabase.from('tasks').insert({ ...form, created_by: session.user.id, deadline: form.deadline || null, task_type: 'regular' }).select().single()
    if (assignees.length > 0) await supabase.from('task_assignees').insert(assignees.map(uid => ({ task_id: task.id, user_id: uid })))
    if (!form.is_group && clientId) {
      await supabase.from('task_clients').insert({ task_id: task.id, client_id: clientId })
      if (selectedReps.length > 0) await supabase.from('task_client_representatives').insert(selectedReps.map(rid => ({ task_id: task.id, client_id: clientId, representative_id: rid })))
    }
    await supabase.from('task_history').insert({ task_id: task.id, author_id: session.user.id, action: 'created', comment: 'Задача создана' })
    onSave()
  }

  const inp = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }

  return (
    <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:20, marginBottom:20}}>
      <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>Новая задача</div>
      <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Название *" style={inp} />
      <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Описание" style={{...inp,resize:'vertical',minHeight:60}} />
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} style={inp}>
          <option value="low">Низкий</option><option value="normal">Средний</option><option value="high">Высокий</option>
        </select>
        <input value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} type="datetime-local" style={inp} />
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:600}}>Ответственные</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {staff.map(s => (
            <label key={s.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:assignees.includes(s.id)?'#fafde8':'#f5f5f5',border:assignees.includes(s.id)?'1px solid #BFD900':'1px solid #e0e0e0',borderRadius:8,fontSize:12,cursor:'pointer'}}>
              <input type="checkbox" checked={assignees.includes(s.id)} onChange={()=>toggleAssignee(s.id)} />
              {s.full_name||s.email}
            </label>
          ))}
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button onClick={()=>setForm({...form,is_group:false})} style={{flex:1,padding:8,borderRadius:8,border:!form.is_group?'none':'1px solid #e0e0e0',background:!form.is_group?'#BFD900':'#fff',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:!form.is_group?600:400}}>Конкретный клиент</button>
        <button onClick={()=>setForm({...form,is_group:true})} style={{flex:1,padding:8,borderRadius:8,border:form.is_group?'none':'1px solid #e0e0e0',background:form.is_group?'#BFD900':'#fff',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:form.is_group?600:400}}>Групповая</button>
      </div>
      {!form.is_group && (
        <div>
          <select value={clientId} onChange={e=>setClientId(e.target.value)} style={inp}>
            <option value="">Выберите клиента</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.full_name||c.email}</option>)}
          </select>
          {clientReps.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:600}}>Представители</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {clientReps.map(r=>(
                  <label key={r.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:selectedReps.includes(r.id)?'#fafde8':'#f5f5f5',border:selectedReps.includes(r.id)?'1px solid #BFD900':'1px solid #e0e0e0',borderRadius:8,fontSize:12,cursor:'pointer'}}>
                    <input type="checkbox" checked={selectedReps.includes(r.id)} onChange={()=>toggleRep(r.id)} />
                    {r.full_name} ({r.role})
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {form.is_group && (
        <div style={{background:'#f9f9f9',borderRadius:10,padding:12,marginBottom:8}}>
          <div style={{fontSize:12,color:'#888',marginBottom:8,fontWeight:600}}>Фильтры</div>
          <select value={groupFilters.group} onChange={e=>setGroupFilters({...groupFilters,group:e.target.value})} style={inp}>
            <option value="">Все группы</option>
            {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={groupFilters.subscription_status} onChange={e=>setGroupFilters({...groupFilters,subscription_status:e.target.value})} style={inp}>
            <option value="">Любой статус абонемента</option>
            <option value="active">Активный</option><option value="expired">Истёкший</option><option value="none">Нет</option>
          </select>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <input value={groupFilters.age_from} onChange={e=>setGroupFilters({...groupFilters,age_from:e.target.value})} placeholder="Возраст от" type="number" style={inp} />
            <input value={groupFilters.age_to} onChange={e=>setGroupFilters({...groupFilters,age_to:e.target.value})} placeholder="Возраст до" type="number" style={inp} />
          </div>
        </div>
      )}
      <div style={{display:'flex',gap:8,marginTop:4}}>
        <button onClick={handleSave} style={{flex:1,padding:9,background:'#BFD900',border:'none',borderRadius:10,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Создать</button>
        <button onClick={onCancel} style={{padding:'9px 16px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:10,fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Отмена</button>
      </div>
    </div>
  )
}

// ─── Карточка задачи ──────────────────────────────────────────────────────────
function TaskCard({ task, session, staff, onUpdate }) {
  const [visibleHistory, setVisibleHistory] = useState(2)
  const navigate = useNavigate()
  const history = task.task_history || []
  const isOverdue = task.deadline && !DONE_STATUSES.includes(task.status) && new Date(task.deadline) < new Date()

  const handleStatusChange = async (newStatus) => {
    const isDone = newStatus === 'done'
    await supabase.from('tasks').update({ status: newStatus, completed_at: isDone ? new Date().toISOString() : null, completed_by: isDone ? session.user.id : null }).eq('id', task.id)
    const completedByName = staff.find(s => s.id === session.user.id)?.full_name || 'Сотрудник'
    await supabase.from('task_history').insert({ task_id: task.id, author_id: session.user.id, action: 'status_changed', comment: isDone ? `Выполнена сотрудником: ${completedByName}` : `Статус изменён на: ${STATUS_LABELS[newStatus].label}` })
    onUpdate()
  }

  const formatDT = (dt) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('ru-RU', { timeZone:'Europe/Moscow', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
  }

  const completedByProfile = task.completed_by ? staff.find(s => s.id === task.completed_by) : null

  return (
    <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', borderLeft:`4px solid ${PRIORITY_LABELS[task.priority]?.color || '#BDBDBD'}`, padding:'14px 16px', marginBottom:10}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10}}>
        <div style={{flex:1}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap'}}>
            <span style={{fontSize:14, fontWeight:600, color: isOverdue?'#e74c3c':'#2a2a2a'}}>{task.title}</span>
            <span style={{background:STATUS_LABELS[task.status]?.bg, color:STATUS_LABELS[task.status]?.color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>{STATUS_LABELS[task.status]?.label}</span>
            {isOverdue && <span style={{background:'#fdecea',color:'#e74c3c',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>⚠️ Просрочена</span>}
            {task.is_group && <span style={{background:'#e8f4fd',color:'#2980b9',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>Групповая</span>}
          </div>
          {task.description && <div style={{fontSize:12, color:'#888', marginBottom:6, whiteSpace:'pre-line'}}>{task.description}</div>}
          <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:4}}>
            {task.task_assignees?.length > 0 && <span style={{fontSize:11, color:'#BDBDBD'}}>👤 {task.task_assignees.map(a=>a.profiles?.full_name||a.profiles?.email).join(', ')}</span>}
            {task.task_clients?.length > 0 && task.task_clients.map(tc=>(
              <span key={tc.client_id} style={{fontSize:11,color:'#6a7700',cursor:'pointer'}} onClick={()=>navigate(`/admin/clients/${tc.client_id}`)}>🎓 {tc.profiles?.full_name||tc.profiles?.email}</span>
            ))}
            {task.deadline && <span style={{fontSize:11, color:isOverdue?'#e74c3c':'#BDBDBD'}}>⏰ Дедлайн: {formatDT(task.deadline)}</span>}
            <span style={{fontSize:11, color:'#BDBDBD'}}>📅 Назначена: {formatDT(task.created_at)}</span>
            {task.completed_at && <span style={{fontSize:11, color:'#27ae60'}}>✅ Выполнена: {formatDT(task.completed_at)}</span>}
            {completedByProfile && <span style={{fontSize:11, color:'#27ae60'}}>✓ Выполнил: {completedByProfile.full_name}</span>}
          </div>
        </div>
        <select value={task.status} onChange={e=>handleStatusChange(e.target.value)}
          style={{padding:'6px 10px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff', cursor:'pointer', flexShrink:0}}>
          {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {history.length > 0 && (
        <div style={{marginTop:10, paddingTop:10, borderTop:'1px solid #f5f5f5'}}>
          <div style={{fontSize:11, color:'#BDBDBD', marginBottom:4}}>История:</div>
          {history.slice(0, visibleHistory).map((h,i)=>(
            <div key={i} style={{fontSize:11,color:'#BDBDBD',marginBottom:2}}><span style={{color:'#2a2a2a'}}>{formatDT(h.created_at)}</span> — {h.comment || h.action}</div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:6}}>
            {history.length > visibleHistory && (
              <>
                <button onClick={()=>setVisibleHistory(v=>v+3)} style={{flex:1,padding:5,background:'#f5f5f5',border:'none',borderRadius:6,fontSize:11,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Ещё 3</button>
                <button onClick={()=>setVisibleHistory(history.length)} style={{flex:1,padding:5,background:'#f5f5f5',border:'none',borderRadius:6,fontSize:11,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Все ({history.length})</button>
              </>
            )}
            {visibleHistory >= history.length && history.length > 2 && (
              <button onClick={()=>setVisibleHistory(2)} style={{flex:1,padding:5,background:'#f5f5f5',border:'none',borderRadius:6,fontSize:11,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Свернуть</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Карточка "Новый клиент" ──────────────────────────────────────────────────
function NewClientCard({ task, session, staff, onUpdate }) {
  const navigate = useNavigate()
  const isOverdue = task.deadline && new Date(task.deadline) < new Date()

  const handleDone = async () => {
    const name = staff.find(s=>s.id===session.user.id)?.full_name || 'Сотрудник'
    await supabase.from('tasks').update({ status:'done', completed_at:new Date().toISOString(), completed_by:session.user.id }).eq('id', task.id)
    await supabase.from('task_history').insert({ task_id:task.id, author_id:session.user.id, action:'status_changed', comment:`Выполнена сотрудником: ${name}` })
    onUpdate()
  }

  const deadline = task.deadline ? new Date(task.deadline) : null
  const now = new Date()
  const hoursLeft = deadline ? Math.round((deadline - now) / 3600000) : null
  const deadlineColor = isOverdue ? '#e74c3c' : hoursLeft !== null && hoursLeft < 4 ? '#f39c12' : '#27ae60'
  const deadlineText = isOverdue ? `⚠️ Просрочено на ${Math.abs(hoursLeft)}ч` : hoursLeft !== null ? `⏰ ${hoursLeft}ч до дедлайна` : ''
  const lines = (task.description || '').split('\n')
  const info = lines.filter(l => !l.startsWith('☐'))
  const checklist = lines.filter(l => l.startsWith('☐'))
  const clientId = task.task_clients?.[0]?.client_id

  return (
    <div style={{background:'#fff', borderRadius:14, border:'2px solid #e74c3c', padding:'14px 16px', marginBottom:10}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap'}}>
            <span style={{background:'#fdecea', color:'#e74c3c', padding:'3px 10px', borderRadius:8, fontSize:12, fontWeight:700}}>🆕 Новый клиент</span>
            {deadlineText && <span style={{fontSize:12, color: deadlineColor, fontWeight:600}}>{deadlineText}</span>}
          </div>
          <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>
            {task.title.replace('🆕 Новый клиент: ', '')}
            {clientId && <span onClick={()=>navigate(`/admin/clients/${clientId}`)} style={{fontSize:12, color:'#2980b9', cursor:'pointer', fontWeight:400, marginLeft:8}}>→ Карточка клиента</span>}
          </div>
          <div style={{background:'#f9f9f9', borderRadius:10, padding:'10px 12px', marginBottom:10, fontSize:13, lineHeight:1.8, color:'#2a2a2a'}}>
            {info.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          {checklist.length > 0 && <div style={{fontSize:12, color:'#555', lineHeight:2}}>{checklist.map((item, i) => <div key={i}>{item}</div>)}</div>}
        </div>
      </div>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        {task.task_assignees?.length > 0 && <span style={{fontSize:11, color:'#BDBDBD', flex:1}}>👤 {task.task_assignees.map(a=>a.profiles?.full_name||'').filter(Boolean).join(', ')}</span>}
        <button onClick={handleDone} style={{padding:'8px 18px', background:'#27ae60', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'Inter,sans-serif', flexShrink:0}}>✓ Выполнено</button>
      </div>
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function AdminTasks({ session }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks,            setTasks]           = useState([])
  const [indivRequests,    setIndivRequests]    = useState([])
  const [staff,            setStaff]           = useState([])
  const [clients,          setClients]         = useState([])
  const [loading,          setLoading]         = useState(true)
  const [showForm,         setShowForm]        = useState(false)
  const [teacherIds,       setTeacherIds]      = useState(new Set())

  const tab               = searchParams.get('tab')          || 'active'
  const filterStatus      = searchParams.get('status')       || 'all'
  const filterAssigned    = searchParams.get('assigned')     || 'all'
  const sortPriority      = searchParams.get('sortPriority') || 'none'
  const sortDeadline      = searchParams.get('sortDeadline') || 'none'
  const onlyMine          = searchParams.get('onlyMine')     === 'true'
  const filterTeacher     = searchParams.get('teacher')      || 'all'
  const filterIndivStatus = searchParams.get('indivStatus')  || 'all'

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all' || value === 'none' || value === 'false') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)

    const { data: t } = await supabase
      .from('tasks')
      .select(`*, task_history(*), task_assignees(*, profiles(id,full_name,email)), task_clients(*, profiles(full_name,email))`)
      .order('created_at', { ascending: false })
    setTasks(t || [])

    const { data: ir } = await supabase
      .from('indiv_requests')
      .select(`*, client:profiles!indiv_requests_client_id_fkey(id, full_name, phone, email), teacher:profiles!indiv_requests_teacher_id_fkey(id, full_name), package:indiv_packages(id, name, visits_count)`)
      .order('created_at', { ascending: false })
    setIndivRequests(ir || [])

    const { data: s } = await supabase.from('profiles').select('id,full_name,email,role').in('role',['teacher','admin','manager','owner'])
    const { data: tRoles } = await supabase.from('staff_roles').select('staff_id').eq('role','teacher')
    setStaff(s || [])
    setTeacherIds(new Set((tRoles || []).map(r => r.staff_id)))

    const { data: c } = await supabase.from('profiles').select('id,full_name,email').eq('role','client')
    setClients(c || [])
    setLoading(false)
  }

  const newClientCount    = tasks.filter(t => t.task_type === 'new_client' && ACTIVE_STATUSES.includes(t.status)).length
  const indivPendingCount = indivRequests.filter(r => r.status === 'pending').length

  const filteredTasks = tasks.filter(t => {
    if (tab === 'new_client') return t.task_type === 'new_client' && ACTIVE_STATUSES.includes(t.status)
    if (tab === 'active')     return t.task_type !== 'new_client' && ACTIVE_STATUSES.includes(t.status)
    if (tab === 'done')       return DONE_STATUSES.includes(t.status)
    return true
  }).filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterAssigned !== 'all' && !t.task_assignees?.find(a=>a.user_id===filterAssigned)) return false
    if (onlyMine && !t.task_assignees?.find(a=>a.user_id===session.user.id)) return false
    return true
  }).sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    if (sortPriority !== 'none') {
      const diff = sortPriority === 'asc' ? priorityOrder[a.priority] - priorityOrder[b.priority] : priorityOrder[b.priority] - priorityOrder[a.priority]
      if (diff !== 0) return diff
    }
    if (sortDeadline !== 'none') {
      const da = a.deadline ? new Date(a.deadline) : null
      const db = b.deadline ? new Date(b.deadline) : null
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return sortDeadline === 'asc' ? da - db : db - da
    }
    return 0
  })

  const filteredIndivs = indivRequests.filter(r => {
    if (filterIndivStatus !== 'all' && r.status !== filterIndivStatus) return false
    if (filterTeacher !== 'all' && r.teacher_id !== filterTeacher) return false
    return true
  })

  const teachers = staff.filter(s => s.role === 'teacher' || teacherIds.has(s.id))

  const tabs = [
    { key:'active',     label:'Текущие' },
    { key:'new_client', label:'🆕 Новые клиенты', count: newClientCount },
    { key:'indivs',     label:'Индивы', count: indivPendingCount },
    { key:'done',       label:'Выполненные' },
  ]

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Задачи</h1>
        <button onClick={()=>setShowForm(!showForm)}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          + Новая задача
        </button>
      </div>

      {showForm && (
        <TaskForm session={session} staff={staff} clients={clients}
          onSave={()=>{setShowForm(false);loadAll()}} onCancel={()=>setShowForm(false)} />
      )}

      <div style={{display:'flex', gap:4, marginBottom:16, background:'#f5f5f5', borderRadius:10, padding:4, width:'fit-content'}}>
        {tabs.map(t => (
          <button key={t.key} onClick={()=>setParam('tab', t.key)}
            style={{display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:8, border:'none', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', background:tab===t.key?'#fff':'transparent', color:tab===t.key?'#2a2a2a':'#888', fontWeight:tab===t.key?600:400}}>
            {t.label}
            {t.count > 0 && <span style={{background:'#e74c3c', color:'#fff', borderRadius:10, fontSize:11, fontWeight:700, padding:'1px 7px'}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'indivs' && (
        <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
          <select value={filterIndivStatus} onChange={e=>setParam('indivStatus', e.target.value)}
            style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="all">Все статусы</option>
            <option value="pending">Новые</option>
            <option value="confirmed">Подтверждены</option>
            <option value="rejected">Отклонены</option>
            <option value="cancelled">Отменены</option>
          </select>
          <select value={filterTeacher} onChange={e=>setParam('teacher', e.target.value)}
            style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="all">Все преподаватели</option>
            {teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
      )}

      {tab !== 'new_client' && tab !== 'indivs' && (
        <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
          <select value={filterStatus} onChange={e=>setParam('status', e.target.value)}
            style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="all">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={() => setParam('onlyMine', onlyMine ? 'false' : 'true')}
            style={{padding:'8px 16px', borderRadius:10, border: onlyMine ? 'none' : '1px solid #e8e8e8', background: onlyMine ? '#BFD900' : '#fff', fontSize:12, fontWeight: onlyMine ? 700 : 400, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            {onlyMine ? '✓ Мои задачи' : 'Мои задачи'}
          </button>
          <select value={sortPriority} onChange={e=>setParam('sortPriority', e.target.value)}
            style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="none">Приоритет: не сортировать</option>
            <option value="asc">Сначала высокий</option>
            <option value="desc">Сначала низкий</option>
          </select>
          <select value={sortDeadline} onChange={e=>setParam('sortDeadline', e.target.value)}
            style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="none">Дедлайн: не сортировать</option>
            <option value="asc">Сначала ближайший</option>
            <option value="desc">Сначала дальний</option>
          </select>
          <select value={filterAssigned} onChange={e=>setParam('assigned', e.target.value)}
            style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="all">Все ответственные</option>
            {staff.map(s=><option key={s.id} value={s.id}>{s.full_name||s.email}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : tab === 'indivs' ? (
        filteredIndivs.length === 0
          ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Запросов нет 🎉</div>
          : filteredIndivs.map(r => <IndivRequestCard key={r.id} request={r} onUpdate={loadAll} />)
      ) : filteredTasks.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>
          {tab === 'new_client' ? 'Новых заявок нет 🎉' : 'Задач нет'}
        </div>
      ) : filteredTasks.map(task =>
        tab === 'new_client'
          ? <NewClientCard key={task.id} task={task} session={session} staff={staff} onUpdate={loadAll} />
          : <TaskCard      key={task.id} task={task} session={session} staff={staff} onUpdate={loadAll} />
      )}
    </div>
  )
}