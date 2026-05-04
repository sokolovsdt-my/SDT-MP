import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

// ─── Форма новой задачи ───────────────────────────────────────────────────────
function TaskForm({ session, staff, clients, onSave, onCancel }) {
  const [form, setForm] = useState({ title:'', description:'', priority:'normal', deadline:'', is_group:false })
  const [assignees, setAssignees] = useState([])
  const [clientId, setClientId] = useState('')
  const [clientReps, setClientReps] = useState([])
  const [selectedReps, setSelectedReps] = useState([])
  const [groups, setGroups] = useState([])
  const [groupFilters, setGroupFilters] = useState({ group:'', subscription_status:'', age_from:'', age_to:'' })

  useEffect(() => {
    supabase.from('groups').select('id, name').then(({ data }) => setGroups(data || []))
  }, [])

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
    const { data: task } = await supabase.from('tasks').insert({
      ...form, created_by: session.user.id, deadline: form.deadline || null, task_type: 'regular'
    }).select().single()
    if (assignees.length > 0)
      await supabase.from('task_assignees').insert(assignees.map(uid => ({ task_id: task.id, user_id: uid })))
    if (!form.is_group && clientId) {
      await supabase.from('task_clients').insert({ task_id: task.id, client_id: clientId })
      if (selectedReps.length > 0)
        await supabase.from('task_client_representatives').insert(selectedReps.map(rid => ({ task_id: task.id, client_id: clientId, representative_id: rid })))
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
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: isDone ? new Date().toISOString() : null,
      completed_by: isDone ? session.user.id : null,
    }).eq('id', task.id)

    if (isDone) {
      // Оставляем только выполнившего, остальных убираем
      await supabase.from('task_assignees')
        .delete().eq('task_id', task.id).neq('user_id', session.user.id)
    }

    const completedByName = staff.find(s => s.id === session.user.id)?.full_name || 'Сотрудник'
    await supabase.from('task_history').insert({
      task_id: task.id, author_id: session.user.id,
      action: 'status_changed',
      comment: isDone
        ? `Выполнена сотрудником: ${completedByName}`
        : `Статус изменён на: ${STATUS_LABELS[newStatus].label}`
    })
    onUpdate()
  }

  const formatDT = (dt) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('ru-RU', { timeZone:'Europe/Moscow', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
  }

  // Кто выполнил (для выполненных задач)
  const completedByProfile = task.completed_by
    ? staff.find(s => s.id === task.completed_by)
    : null

  return (
    <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', borderLeft:`4px solid ${PRIORITY_LABELS[task.priority]?.color || '#BDBDBD'}`, padding:'14px 16px', marginBottom:10}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10}}>
        <div style={{flex:1}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap'}}>
            <span style={{fontSize:14, fontWeight:600, color: isOverdue?'#e74c3c':'#2a2a2a'}}>{task.title}</span>
            <span style={{background:STATUS_LABELS[task.status]?.bg, color:STATUS_LABELS[task.status]?.color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>
              {STATUS_LABELS[task.status]?.label}
            </span>
            {isOverdue && <span style={{background:'#fdecea',color:'#e74c3c',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>⚠️ Просрочена</span>}
            {task.is_group && <span style={{background:'#e8f4fd',color:'#2980b9',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>Групповая</span>}
          </div>

          {task.description && (
            <div style={{fontSize:12, color:'#888', marginBottom:6, whiteSpace:'pre-line'}}>{task.description}</div>
          )}

          <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:4}}>
            {task.task_assignees?.length > 0 && (
              <span style={{fontSize:11, color:'#BDBDBD'}}>
                👤 {task.task_assignees.map(a=>a.profiles?.full_name||a.profiles?.email).join(', ')}
              </span>
            )}
            {task.task_clients?.length > 0 && task.task_clients.map(tc=>(
              <span key={tc.client_id} style={{fontSize:11,color:'#6a7700',cursor:'pointer'}}
                onClick={()=>navigate(`/admin/clients/${tc.client_id}`)}>
                🎓 {tc.profiles?.full_name||tc.profiles?.email}
              </span>
            ))}
            {task.deadline && (
              <span style={{fontSize:11, color:isOverdue?'#e74c3c':'#BDBDBD'}}>⏰ Дедлайн: {formatDT(task.deadline)}</span>
            )}
            <span style={{fontSize:11, color:'#BDBDBD'}}>📅 Назначена: {formatDT(task.created_at)}</span>
            {task.completed_at && (
              <span style={{fontSize:11, color:'#27ae60'}}>✅ Выполнена: {formatDT(task.completed_at)}</span>
            )}
            {completedByProfile && (
              <span style={{fontSize:11, color:'#27ae60'}}>✓ Выполнил: {completedByProfile.full_name}</span>
            )}
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
            <div key={i} style={{fontSize:11,color:'#BDBDBD',marginBottom:2}}>
              <span style={{color:'#2a2a2a'}}>{formatDT(h.created_at)}</span> — {h.comment || h.action}
            </div>
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
    await supabase.from('tasks').update({
      status: 'done',
      completed_at: new Date().toISOString(),
      completed_by: session.user.id,
    }).eq('id', task.id)
    await supabase.from('task_assignees').delete().eq('task_id', task.id).neq('user_id', session.user.id)
    await supabase.from('task_history').insert({
      task_id: task.id, author_id: session.user.id,
      action: 'status_changed', comment: `Выполнена сотрудником: ${name}`
    })
    onUpdate()
  }

  // Форматируем дедлайн
  const deadline = task.deadline ? new Date(task.deadline) : null
  const now = new Date()
  const hoursLeft = deadline ? Math.round((deadline - now) / 3600000) : null
  const deadlineColor = isOverdue ? '#e74c3c' : hoursLeft !== null && hoursLeft < 4 ? '#f39c12' : '#27ae60'
  const deadlineText = isOverdue
    ? `⚠️ Просрочено на ${Math.abs(hoursLeft)}ч`
    : hoursLeft !== null ? `⏰ ${hoursLeft}ч до дедлайна` : ''

  // Парсим описание
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
            {deadlineText && (
              <span style={{fontSize:12, color: deadlineColor, fontWeight:600}}>{deadlineText}</span>
            )}
          </div>
          <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>
            {task.title.replace('🆕 Новый клиент: ', '')}
            {clientId && (
              <span onClick={()=>navigate(`/admin/clients/${clientId}`)}
                style={{fontSize:12, color:'#2980b9', cursor:'pointer', fontWeight:400, marginLeft:8}}>
                → Карточка клиента
              </span>
            )}
          </div>
          {/* Контакты */}
          <div style={{background:'#f9f9f9', borderRadius:10, padding:'10px 12px', marginBottom:10, fontSize:13, lineHeight:1.8, color:'#2a2a2a'}}>
            {info.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          {/* Чеклист */}
          {checklist.length > 0 && (
            <div style={{fontSize:12, color:'#555', lineHeight:2}}>
              {checklist.map((item, i) => <div key={i}>{item}</div>)}
            </div>
          )}
        </div>
      </div>

      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        {task.task_assignees?.length > 0 && (
          <span style={{fontSize:11, color:'#BDBDBD', flex:1}}>
            👤 {task.task_assignees.map(a=>a.profiles?.full_name||'').filter(Boolean).join(', ')}
          </span>
        )}
        <button onClick={handleDone}
          style={{padding:'8px 18px', background:'#27ae60', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'Inter,sans-serif', flexShrink:0}}>
          ✓ Выполнено
        </button>
      </div>
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function AdminTasks({ session }) {
  const [tasks,      setTasks]      = useState([])
  const [staff,      setStaff]      = useState([])
  const [clients,    setClients]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [tab,        setTab]        = useState('active')    // active | new_client | done
  const [filterStatus,   setFilterStatus]   = useState('all')
  const [filterAssigned, setFilterAssigned] = useState('all')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const { data: t } = await supabase
      .from('tasks')
      .select(`*, task_history(*), task_assignees(*, profiles(id,full_name,email)), task_clients(*, profiles(full_name,email))`)
      .order('created_at', { ascending: false })
    setTasks(t || [])
    const { data: s } = await supabase.from('profiles').select('id,full_name,email,role').in('role',['teacher','admin','manager','owner'])
    setStaff(s || [])
    const { data: c } = await supabase.from('profiles').select('id,full_name,email').eq('role','client')
    setClients(c || [])
    setLoading(false)
  }

  const newClientCount = tasks.filter(t => t.task_type === 'new_client' && ACTIVE_STATUSES.includes(t.status)).length

  const filtered = tasks.filter(t => {
    if (tab === 'new_client') return t.task_type === 'new_client' && ACTIVE_STATUSES.includes(t.status)
    if (tab === 'active')     return t.task_type !== 'new_client' && ACTIVE_STATUSES.includes(t.status)
    if (tab === 'done')       return DONE_STATUSES.includes(t.status)
    return true
  }).filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterAssigned !== 'all' && !t.task_assignees?.find(a=>a.user_id===filterAssigned)) return false
    return true
  })

  const tabs = [
    { key:'active',     label:'Текущие' },
    { key:'new_client', label:'🆕 Новые клиенты', count: newClientCount },
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
          onSave={()=>{setShowForm(false);loadAll()}}
          onCancel={()=>setShowForm(false)} />
      )}

      {/* Вкладки */}
      <div style={{display:'flex', gap:4, marginBottom:16, background:'#f5f5f5', borderRadius:10, padding:4, width:'fit-content'}}>
        {tabs.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:8, border:'none', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', background:tab===t.key?'#fff':'transparent', color:tab===t.key?'#2a2a2a':'#888', fontWeight:tab===t.key?600:400}}>
            {t.label}
            {t.count > 0 && (
              <span style={{background:'#e74c3c', color:'#fff', borderRadius:10, fontSize:11, fontWeight:700, padding:'1px 7px'}}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Фильтры (скрываем для новых клиентов) */}
      {tab !== 'new_client' && (
        <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
            style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="all">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterAssigned} onChange={e=>setFilterAssigned(e.target.value)}
            style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
            <option value="all">Все ответственные</option>
            {staff.map(s=><option key={s.id} value={s.id}>{s.full_name||s.email}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>
          {tab === 'new_client' ? 'Новых заявок нет 🎉' : 'Задач нет'}
        </div>
      ) : filtered.map(task =>
        tab === 'new_client'
          ? <NewClientCard key={task.id} task={task} session={session} staff={staff} onUpdate={loadAll} />
          : <TaskCard      key={task.id} task={task} session={session} staff={staff} onUpdate={loadAll} />
      )}
    </div>
  )
}