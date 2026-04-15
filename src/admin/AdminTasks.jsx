import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const STATUS_LABELS = {
  new: { label: 'Новая', color: '#2980b9', bg: '#e8f4fd' },
  in_progress: { label: 'В работе', color: '#f39c12', bg: '#fef9e7' },
  done: { label: 'Выполнена', color: '#27ae60', bg: '#eafaf1' },
  cancelled: { label: 'Отменена', color: '#BDBDBD', bg: '#f5f5f5' },
  postponed: { label: 'Перенесена', color: '#8e44ad', bg: '#f5eef8' },
  problem: { label: 'Есть трудности', color: '#e74c3c', bg: '#fdecea' },
}

const PRIORITY_LABELS = {
  low: { label: 'Низкий', color: '#BDBDBD' },
  normal: { label: 'Средний', color: '#f39c12' },
  high: { label: 'Высокий', color: '#e74c3c' },
}

const ACTIVE_STATUSES = ['new', 'in_progress', 'postponed', 'problem']
const DONE_STATUSES = ['done', 'cancelled']

function TaskForm({ session, staff, clients, onSave, onCancel, initialClientId = null }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'normal', deadline: '', is_group: false
  })
  const [assignees, setAssignees] = useState([])
  const [clientId, setClientId] = useState(initialClientId || '')
  const [clientReps, setClientReps] = useState([])
  const [selectedReps, setSelectedReps] = useState([])
  const [groupFilters, setGroupFilters] = useState({
    group: '', subscription_status: '', age_from: '', age_to: '', payers_only: false, payer_sub_status: ''
  })
  const [groups, setGroups] = useState([])

  useEffect(() => {
    supabase.from('groups').select('id, name').then(({ data }) => setGroups(data || []))
  }, [])

  useEffect(() => {
    if (clientId) {
      supabase.from('client_representatives').select('*').eq('client_id', clientId)
        .then(({ data }) => { setClientReps(data || []); setSelectedReps([]) })
    } else {
      setClientReps([])
      setSelectedReps([])
    }
  }, [clientId])

  const toggleAssignee = (id) => setAssignees(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  const toggleRep = (id) => setSelectedReps(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const handleSave = async () => {
    if (!form.title) return
    const { data: task } = await supabase.from('tasks').insert({
      ...form,
      created_by: session.user.id,
      deadline: form.deadline || null,
    }).select().single()

    if (assignees.length > 0) {
      await supabase.from('task_assignees').insert(assignees.map(uid => ({ task_id: task.id, user_id: uid })))
    }

    if (!form.is_group && clientId) {
      await supabase.from('task_clients').insert({ task_id: task.id, client_id: clientId })
      if (selectedReps.length > 0) {
        await supabase.from('task_client_representatives').insert(
          selectedReps.map(rid => ({ task_id: task.id, client_id: clientId, representative_id: rid }))
        )
      }
    }

    await supabase.from('task_history').insert({
      task_id: task.id, author_id: session.user.id, action: 'created', comment: 'Задача создана'
    })

    onSave()
  }

  const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }

  return (
    <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:20, marginBottom:20}}>
      <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>Новая задача</div>

      <input value={form.title} onChange={e => setForm({...form, title:e.target.value})}
        placeholder="Название задачи *" style={inputStyle} />
      <textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})}
        placeholder="Описание (необязательно)"
        style={{...inputStyle, resize:'vertical', minHeight:60}} />

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <select value={form.priority} onChange={e => setForm({...form, priority:e.target.value})} style={inputStyle}>
          <option value="low">Низкий приоритет</option>
          <option value="normal">Средний приоритет</option>
          <option value="high">Высокий приоритет</option>
        </select>
        <input value={form.deadline} onChange={e => setForm({...form, deadline:e.target.value})}
          type="datetime-local" style={inputStyle} />
      </div>

      {/* Ответственные */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:12, color:'#888', marginBottom:6, fontWeight:600}}>Ответственные</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
          {staff.map(s => (
            <label key={s.id} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: assignees.includes(s.id) ? '#fafde8' : '#f5f5f5', border: assignees.includes(s.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
              <input type="checkbox" checked={assignees.includes(s.id)} onChange={() => toggleAssignee(s.id)} />
              {s.full_name || s.email}
            </label>
          ))}
        </div>
      </div>

      {/* Тип задачи */}
      <div style={{display:'flex', gap:8, marginBottom:12}}>
        <button onClick={() => setForm({...form, is_group:false})} style={{flex:1, padding:'8px', borderRadius:8, border: !form.is_group ? 'none' : '1px solid #e0e0e0', background: !form.is_group ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: !form.is_group ? 600 : 400}}>
          Конкретный клиент
        </button>
        <button onClick={() => setForm({...form, is_group:true})} style={{flex:1, padding:'8px', borderRadius:8, border: form.is_group ? 'none' : '1px solid #e0e0e0', background: form.is_group ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: form.is_group ? 600 : 400}}>
          Групповая
        </button>
      </div>

      {/* Конкретный клиент */}
      {!form.is_group && (
        <div>
          <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
            <option value="">Выберите клиента</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
          </select>
          {clientReps.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:12, color:'#888', marginBottom:6, fontWeight:600}}>Представители</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {clientReps.map(r => (
                  <label key={r.id} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: selectedReps.includes(r.id) ? '#fafde8' : '#f5f5f5', border: selectedReps.includes(r.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
                    <input type="checkbox" checked={selectedReps.includes(r.id)} onChange={() => toggleRep(r.id)} />
                    {r.full_name} ({r.role})
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Групповая */}
      {form.is_group && (
        <div style={{background:'#f9f9f9', borderRadius:10, padding:12, marginBottom:8}}>
          <div style={{fontSize:12, color:'#888', marginBottom:8, fontWeight:600}}>Фильтры группы</div>
          <select value={groupFilters.group} onChange={e => setGroupFilters({...groupFilters, group:e.target.value})} style={inputStyle}>
            <option value="">Все группы</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={groupFilters.subscription_status} onChange={e => setGroupFilters({...groupFilters, subscription_status:e.target.value})} style={inputStyle}>
            <option value="">Любой статус абонемента</option>
            <option value="active">Активный абонемент</option>
            <option value="expired">Истёкший абонемент</option>
            <option value="none">Нет абонемента</option>
          </select>
          <select value={groupFilters.payer_sub_status} onChange={e => setGroupFilters({...groupFilters, payer_sub_status:e.target.value})} style={inputStyle}>
            <option value="">Все плательщики</option>
            <option value="active">Плательщики с активным абиком</option>
            <option value="inactive">Плательщики с неактивным абиком</option>
          </select>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <input value={groupFilters.age_from} onChange={e => setGroupFilters({...groupFilters, age_from:e.target.value})}
              placeholder="Возраст от" type="number" style={inputStyle} />
            <input value={groupFilters.age_to} onChange={e => setGroupFilters({...groupFilters, age_to:e.target.value})}
              placeholder="Возраст до" type="number" style={inputStyle} />
          </div>
        </div>
      )}

      <div style={{display:'flex', gap:8, marginTop:4}}>
        <button onClick={handleSave}
          style={{flex:1, padding:'9px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          Создать
        </button>
        <button onClick={onCancel}
          style={{padding:'9px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          Отмена
        </button>
      </div>
    </div>
  )
}

function TaskCard({ task, session, onUpdate }) {
  const [visibleHistory, setVisibleHistory] = useState(2)
  const navigate = useNavigate()
  const history = task.task_history || []
  const isExpanded = visibleHistory >= history.length && history.length > 2
  const isOverdue = task.deadline && !DONE_STATUSES.includes(task.status) && new Date(task.deadline) < new Date()

  const handleStatusChange = async (newStatus) => {
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null
    }).eq('id', task.id)
    await supabase.from('task_history').insert({
      task_id: task.id, author_id: session.user.id,
      action: `status_changed`, comment: `Статус изменён на: ${STATUS_LABELS[newStatus].label}`
    })
    onUpdate()
  }

  const formatDT = (dt) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
  }

  return (
    <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', borderLeft:`4px solid ${PRIORITY_LABELS[task.priority].color}`, padding:'14px 16px', marginBottom:10}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10}}>
        <div style={{flex:1}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap'}}>
            <span style={{fontSize:14, fontWeight:600, color: isOverdue ? '#e74c3c' : '#2a2a2a'}}>{task.title}</span>
            <span style={{background: STATUS_LABELS[task.status].bg, color: STATUS_LABELS[task.status].color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>
              {STATUS_LABELS[task.status].label}
            </span>
            {task.is_group && <span style={{background:'#e8f4fd', color:'#2980b9', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>Групповая</span>}
            {isOverdue && <span style={{background:'#fdecea', color:'#e74c3c', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>⚠️ Просрочена</span>}
          </div>

          {task.description && <div style={{fontSize:12, color:'#888', marginBottom:6}}>{task.description}</div>}

          <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:4}}>
            {task.task_assignees?.length > 0 && (
              <span style={{fontSize:11, color:'#BDBDBD'}}>
                👤 {task.task_assignees.map(a => a.profiles?.full_name || a.profiles?.email).join(', ')}
              </span>
            )}
            {task.task_clients?.length > 0 && task.task_clients.map(tc => (
              <span key={tc.client_id} style={{fontSize:11, color:'#6a7700', cursor:'pointer'}}
                onClick={() => navigate(`/admin/clients/${tc.client_id}`)}>
                🎓 {tc.profiles?.full_name || tc.profiles?.email}
              </span>
            ))}
            {task.deadline && <span style={{fontSize:11, color: isOverdue ? '#e74c3c' : '#BDBDBD'}}>⏰ {formatDT(task.deadline)}</span>}
          </div>
        </div>

        <select value={task.status} onChange={e => handleStatusChange(e.target.value)}
          style={{padding:'6px 10px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff', cursor:'pointer', flexShrink:0}}>
          {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* История */}
      {history.length > 0 && (
        <div style={{marginTop:10, paddingTop:10, borderTop:'1px solid #f5f5f5'}}>
          <div style={{fontSize:11, color:'#BDBDBD', marginBottom:4}}>История:</div>
          {history.slice(0, visibleHistory).map((h, i) => (
            <div key={i} style={{fontSize:11, color:'#BDBDBD', marginBottom:2}}>{formatDT(h.created_at)} — {h.comment}</div>
          ))}
          <div style={{display:'flex', gap:8, marginTop:6}}>
            {history.length > visibleHistory && (
              <>
                <button onClick={() => setVisibleHistory(v => v + 3)}
                  style={{flex:1, padding:'5px', background:'#f5f5f5', border:'none', borderRadius:6, fontSize:11, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Ещё 3
                </button>
                <button onClick={() => setVisibleHistory(history.length)}
                  style={{flex:1, padding:'5px', background:'#f5f5f5', border:'none', borderRadius:6, fontSize:11, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Все ({history.length})
                </button>
              </>
            )}
            {isExpanded && (
              <button onClick={() => setVisibleHistory(2)}
                style={{flex:1, padding:'5px', background:'#f5f5f5', border:'none', borderRadius:6, fontSize:11, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                Свернуть
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminTasks({ session }) {
  const [tasks, setTasks] = useState([])
  const [staff, setStaff] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState('active')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssigned, setFilterAssigned] = useState('all')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const { data: t } = await supabase
      .from('tasks')
      .select(`*, task_history(*), task_assignees(*, profiles(full_name, email)), task_clients(*, profiles(full_name, email))`)
      .order('created_at', { ascending: false })
    setTasks(t || [])
    const { data: s } = await supabase.from('profiles').select('id, full_name, email, role').in('role', ['teacher','admin','manager','owner'])
    setStaff(s || [])
    const { data: c } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'client')
    setClients(c || [])
    setLoading(false)
  }

  const filtered = tasks.filter(t => {
    const isActive = ACTIVE_STATUSES.includes(t.status)
    if (view === 'active' && !isActive) return false
    if (view === 'done' && isActive) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterAssigned !== 'all' && !t.task_assignees?.find(a => a.user_id === filterAssigned)) return false
    return true
  })

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Задачи</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          + Новая задача
        </button>
      </div>

      {showForm && <TaskForm session={session} staff={staff} clients={clients} onSave={() => { setShowForm(false); loadAll() }} onCancel={() => setShowForm(false)} />}

      {/* Переключатель */}
      <div style={{display:'flex', gap:4, marginBottom:16, background:'#f5f5f5', borderRadius:10, padding:4, width:'fit-content'}}>
        {[['active','Текущие'], ['done','Выполненные']].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)} style={{padding:'7px 20px', borderRadius:8, border:'none', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', background: view===v ? '#fff' : 'transparent', color: view===v ? '#2a2a2a' : '#888', fontWeight: view===v ? 600 : 400}}>
            {l}
          </button>
        ))}
      </div>

      {/* Фильтры */}
      <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
          <option value="all">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)}
          style={{padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff'}}>
          <option value="all">Все ответственные</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Задач нет</div>
      ) : (
        filtered.map(task => <TaskCard key={task.id} task={task} session={session} onUpdate={loadAll} />)
      )}
    </div>
  )
}