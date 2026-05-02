import { useState, useEffect } from 'react'
import AvatarUpload from '../components/AvatarUpload'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const TABS = ['Основное', 'Представители', 'Покупки', 'Посещения', 'Комментарии', 'Задачи', 'Бонусы']

const TYPE_LABELS = {
  subscription: 'Абонемент',
  service: 'Услуга',
  indiv: 'Индив',
  merch: 'Мерч',
  event: 'Мероприятие',
  other: 'Другое',
}

const PAYMENT_LABELS = {
  cash: '💵 Наличные',
  bank: '🏦 Безнал',
  online: '💳 Эквайринг',
  bonus: '🎁 Баллы',
  coins: '🪙 SDTшки',
}

function PurchasesTab({ clientId }) {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'numeric' })
  const fmtMoney = (n) => (Number(n) || 0).toLocaleString('ru-RU') + ' ₽'

  useEffect(() => { load() }, [clientId])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('sales')
      .select(`
        *,
        creator:created_by(full_name, email),
        subscription:subscriptions!subscriptions_sale_id_fkey(
          id, activated_at, expires_at, visits_total, visits_used,
          subscription_allowed_groups(groups(id, name, is_closed))
        )
      `)
      .eq('client_id', clientId)
      .order('sale_date', { ascending: false })

    setPurchases((data || []).map(p => {
      const sub = p.subscription?.[0] || null
      const groups = sub?.subscription_allowed_groups?.map(sag => sag.groups).filter(Boolean) || []
      return { ...p, subscription: sub, allowedGroups: groups }
    }))
    setLoading(false)
  }

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:30}}>Загрузка...</div>
  if (purchases.length === 0) return <div style={{textAlign:'center', color:'#BDBDBD', padding:30}}>Покупок нет</div>

  return (
    <div>
      {purchases.map(p => {
        const isExpanded = expandedId === p.id
        const hasDiscount = Number(p.discount_amount) > 0
        const hasBonus = Number(p.bonus_rubles_used) > 0
        const priceChanged = Number(p.price_original) !== Number(p.amount_paid)
        return (
          <div key={p.id} style={{background:'#fafde8', border:'1px solid #e8f0aa', borderRadius:12, padding:14, marginBottom:10}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:3}}>{p.product_name}</div>
                <div style={{fontSize:11, color:'#888'}}>
                  {TYPE_LABELS[p.product_type] || p.product_type} · {fmtDate(p.sale_date)}
                </div>
              </div>
              <div style={{textAlign:'right', marginLeft:12}}>
                <div style={{fontSize:15, fontWeight:700, color:'#2a2a2a'}}>{fmtMoney(p.amount_paid)}</div>
                {priceChanged && (
                  <div style={{fontSize:11, color:'#BDBDBD', textDecoration:'line-through'}}>{fmtMoney(p.price_original)}</div>
                )}
              </div>
            </div>

            <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
              <span style={{fontSize:11, color:'#888', background:'#f0f0f0', padding:'2px 8px', borderRadius:6}}>
                {PAYMENT_LABELS[p.payment_method] || p.payment_method}
              </span>
              {hasDiscount && (
                <span style={{fontSize:11, color:'#e74c3c', background:'#fdecea', padding:'2px 8px', borderRadius:6}}>
                  Скидка {fmtMoney(p.discount_amount)}
                </span>
              )}
              {hasBonus && (
                <span style={{fontSize:11, color:'#6a7700', background:'#fafde8', padding:'2px 8px', borderRadius:6}}>
                  Баллы −{fmtMoney(p.bonus_rubles_used)}
                </span>
              )}
            </div>

            <button
              onClick={() => setExpandedId(isExpanded ? null : p.id)}
              style={{marginTop:8, background:'none', border:'none', color:'#2980b9', fontSize:11, cursor:'pointer', fontFamily:'Inter,sans-serif', padding:0}}>
              {isExpanded ? 'Скрыть детали ▲' : 'Подробнее ▼'}
            </button>

            {isExpanded && (
              <div style={{marginTop:10, paddingTop:10, borderTop:'1px solid #e8f0aa'}}>
                {[
                  ['Продавец', p.creator?.full_name || p.creator?.email || '—'],
                  ['Способ оплаты', PAYMENT_LABELS[p.payment_method] || p.payment_method],
                  ['Цена по прайсу', fmtMoney(p.price_original)],
                  hasDiscount ? ['Скидка', `${fmtMoney(p.discount_amount)}${p.discount_reason ? ` (${p.discount_reason})` : ''}`] : null,
                  hasBonus ? ['Списано баллов', fmtMoney(p.bonus_rubles_used)] : null,
                  Number(p.acquiring_fee) > 0 ? ['Комиссия эквайринга', fmtMoney(p.acquiring_fee)] : null,
                  ['Итого оплачено', fmtMoney(p.amount_paid)],
                  ['Чистая выручка', fmtMoney(p.total_net)],
                  p.payer_type && p.payer_type !== 'client' ? ['Плательщик', p.payer_type === 'representative' ? 'Представитель' : p.payer_name || 'Другой человек'] : null,
                  p.subscription?.activated_at ? ['Действует с', fmtDate(p.subscription.activated_at)] : null,
                  p.subscription?.expires_at ? ['Действует до', fmtDate(p.subscription.expires_at)] : null,
                  p.subscription?.visits_total ? ['Занятий', `использовано ${p.subscription.visits_used || 0} из ${p.subscription.visits_total}`] : null,
                  p.comment ? ['Комментарий', p.comment] : null,
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} style={{display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12, borderBottom:'1px solid #f0f0f0'}}>
                    <span style={{color:'#888'}}>{label}</span>
                    <span style={{color:'#2a2a2a', fontWeight:500, maxWidth:'60%', textAlign:'right'}}>{value}</span>
                  </div>
                ))}

                {/* Доступные группы */}
                {p.allowedGroups.length > 0 && (
                  <div style={{paddingTop:8}}>
                    <div style={{fontSize:11, color:'#888', marginBottom:6, fontWeight:600}}>Доступные группы</div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                      {p.allowedGroups.map(g => (
                        <span key={g.id} style={{fontSize:11, color: g.is_closed ? '#e74c3c' : '#27ae60', background: g.is_closed ? '#fdecea' : '#eafaf1', padding:'3px 10px', borderRadius:8, fontWeight:500}}>
                          {g.is_closed ? '🔒 ' : ''}{g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RepresentativesTab({ clientId }) {
  const [reps, setReps] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ full_name:'', role:'', phone:'', birth_date:'', contact:'', comment:'', is_payer:false })
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { load() }, [clientId])

  const load = async () => {
    const { data } = await supabase.from('client_representatives').select('*').eq('client_id', clientId).order('created_at')
    setReps(data || [])
  }

  const resetForm = () => setForm({ full_name:'', role:'', phone:'', birth_date:'', contact:'', comment:'', is_payer:false })

  const handleSave = async () => {
    if (!form.full_name || !form.role) return
    const dataToSave = { ...form, birth_date: form.birth_date || null, phone: form.phone || null, contact: form.contact || null, comment: form.comment || null }
    if (editing) {
      await supabase.from('client_representatives').update(dataToSave).eq('id', editing)
    } else {
      await supabase.from('client_representatives').insert({ ...dataToSave, client_id: clientId })
    }
    resetForm(); setEditing(null); setShowForm(false); load()
  }

  const handleEdit = (rep) => {
    setForm({ full_name: rep.full_name, role: rep.role, phone: rep.phone || '', birth_date: rep.birth_date || '', contact: rep.contact || '', comment: rep.comment || '', is_payer: rep.is_payer || false })
    setEditing(rep.id); setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить представителя?')) return
    await supabase.from('client_representatives').delete().eq('id', id)
    load()
  }

  const ROLES = ['Мама', 'Папа', 'Опекун', 'Бабушка', 'Дедушка', 'Другое']
  const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }

  return (
    <div>
      {reps.map(rep => (
        <div key={rep.id} style={{background:'#f9f9f9', borderRadius:12, padding:14, marginBottom:10}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
            <div>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>{rep.full_name}</span>
                <span style={{background:'#f0f0f0', color:'#888', padding:'2px 8px', borderRadius:6, fontSize:11}}>{rep.role}</span>
                {rep.is_payer && <span style={{background:'#fafde8', color:'#6a7700', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>💳 Плательщик</span>}
              </div>
              {rep.phone && <div style={{fontSize:12, color:'#888', marginTop:4}}>📞 {rep.phone}</div>}
              {rep.contact && <div style={{fontSize:12, color:'#888', marginTop:2}}>💬 {rep.contact}</div>}
              {rep.birth_date && <div style={{fontSize:12, color:'#BDBDBD', marginTop:2}}>ДР: {new Date(rep.birth_date).toLocaleDateString('ru-RU')}</div>}
              {rep.comment && <div style={{fontSize:12, color:'#BDBDBD', marginTop:4, fontStyle:'italic'}}>{rep.comment}</div>}
            </div>
            <div style={{display:'flex', gap:8, flexShrink:0}}>
              <button onClick={() => handleEdit(rep)} style={{fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer', padding:0}}>Изменить</button>
              <button onClick={() => handleDelete(rep.id)} style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:0}}>Удалить</button>
            </div>
          </div>
        </div>
      ))}
      {!showForm && reps.length < 3 && (
        <button onClick={() => { resetForm(); setEditing(null); setShowForm(true) }}
          style={{width:'100%', padding:'10px', background:'#f5f5f5', border:'1px dashed #BDBDBD', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          + Добавить представителя {reps.length > 0 ? `(${reps.length}/3)` : ''}
        </button>
      )}
      {showForm && (
        <div style={{background:'#f9f9f9', borderRadius:12, padding:16, marginTop:10}}>
          <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:12}}>{editing ? 'Редактировать представителя' : 'Новый представитель'}</div>
          <input value={form.full_name} onChange={e => setForm({...form, full_name:e.target.value})} placeholder="ФИО *" style={inputStyle} />
          <select value={form.role} onChange={e => setForm({...form, role:e.target.value})} style={inputStyle}>
            <option value="">Выберите роль *</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="Телефон" style={inputStyle} />
          <input value={form.contact} onChange={e => setForm({...form, contact:e.target.value})} placeholder="Telegram / другой канал связи" style={inputStyle} />
          <input value={form.birth_date} onChange={e => setForm({...form, birth_date:e.target.value})} type="date" style={inputStyle} />
          <textarea value={form.comment} onChange={e => setForm({...form, comment:e.target.value})} placeholder="Комментарий" style={{...inputStyle, resize:'vertical', minHeight:60}} />
          <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#2a2a2a', marginBottom:12, cursor:'pointer'}}>
            <input type="checkbox" checked={form.is_payer} onChange={e => setForm({...form, is_payer:e.target.checked})} />
            Является плательщиком
          </label>
          <div style={{display:'flex', gap:8}}>
            <button onClick={handleSave} style={{flex:1, padding:'9px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Сохранить</button>
            <button onClick={() => { setShowForm(false); setEditing(null); resetForm() }} style={{padding:'9px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CommentsTab({ clientId }) {
  const [comments, setComments] = useState([])
  const [deleted, setDeleted] = useState([])
  const [showDeleted, setShowDeleted] = useState(false)
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [visibleCount, setVisibleCount] = useState(2)

  useEffect(() => { load() }, [clientId])

  const load = async () => {
    const { data: active } = await supabase.from('client_comments').select('*, comment_history(*)').eq('client_id', clientId).eq('is_deleted', false).order('created_at', { ascending: false })
    setComments(active || [])
    const { data: del } = await supabase.from('client_comments').select('*, comment_history(*)').eq('client_id', clientId).eq('is_deleted', true).order('created_at', { ascending: false })
    setDeleted(del || [])
  }

  const handleAdd = async () => {
    if (!text.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('client_comments').insert({ client_id: clientId, author_id: user.id, text })
    setText(''); load()
  }

  const handleEdit = async (c) => {
    if (!editText.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('client_comments').update({ text: editText, edited_at: new Date().toISOString(), original_text: c.original_text || c.text }).eq('id', c.id)
    await supabase.from('comment_history').insert({ comment_id: c.id, action: 'edited', author_id: user.id, text_before: c.text, text_after: editText })
    setEditingId(null); load()
  }

  const handleDelete = async (c) => {
    if (!confirm('Удалить комментарий?')) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('client_comments').update({ is_deleted: true }).eq('id', c.id)
    await supabase.from('comment_history').insert({ comment_id: c.id, action: 'deleted', author_id: user.id, text_before: c.text })
    load()
  }

  const formatDT = (dt) => new Date(dt).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
  const visible = comments.slice(0, visibleCount)
  const hasMore = comments.length > visibleCount
  const isExpanded = visibleCount >= comments.length && comments.length > 2

  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Добавить комментарий..."
          style={{flex:1, padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, fontFamily:'Inter,sans-serif'}} />
        <button onClick={handleAdd} style={{padding:'9px 18px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Добавить</button>
      </div>
      {comments.length === 0 && <div style={{textAlign:'center', color:'#BDBDBD', padding:20}}>Комментариев нет</div>}
      {visible.map(c => (
        <div key={c.id} style={{background:'#f9f9f9', borderRadius:12, padding:12, marginBottom:10}}>
          {editingId === c.id ? (
            <div>
              <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, fontFamily:'Inter,sans-serif', resize:'vertical', minHeight:60, boxSizing:'border-box'}} />
              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button onClick={() => handleEdit(c)} style={{padding:'6px 14px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Сохранить</button>
                <button onClick={() => setEditingId(null)} style={{padding:'6px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{fontSize:13, color:'#3a3a3a', marginBottom:6, lineHeight:1.5}}>{c.text}</div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{fontSize:11, color:'#BDBDBD'}}>
                  {formatDT(c.created_at)}
                  {c.edited_at && <span style={{marginLeft:8}}>· изменён {formatDT(c.edited_at)}</span>}
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button onClick={() => { setEditingId(c.id); setEditText(c.text) }} style={{fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer', padding:0}}>Изменить</button>
                  <button onClick={() => handleDelete(c)} style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:0}}>Удалить</button>
                </div>
              </div>
              {c.comment_history && c.comment_history.length > 0 && (
                <div style={{marginTop:8, paddingTop:8, borderTop:'1px solid #f0f0f0'}}>
                  {c.comment_history.map((h, i) => (
                    <div key={i} style={{fontSize:11, color:'#BDBDBD', marginBottom:3}}>
                      {h.action === 'edited' ? '✏️ Изменён' : '🗑 Удалён'} · {formatDT(h.created_at)}
                      {h.text_before && <div style={{color:'#ccc', marginTop:2}}>Было: {h.text_before}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}
      <div style={{display:'flex', gap:8, marginTop:8}}>
        {hasMore && (
          <>
            <button onClick={() => setVisibleCount(v => v + 3)} style={{flex:1, padding:'8px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Показать ещё 3</button>
            <button onClick={() => setVisibleCount(comments.length)} style={{flex:1, padding:'8px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Показать все ({comments.length})</button>
          </>
        )}
        {isExpanded && <button onClick={() => setVisibleCount(2)} style={{flex:1, padding:'8px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Свернуть</button>}
      </div>
      {deleted.length > 0 && (
        <div style={{marginTop:16}}>
          <button onClick={() => setShowDeleted(!showDeleted)} style={{width:'100%', padding:'8px', background:'#fdecea', border:'none', borderRadius:8, fontSize:12, color:'#c0392b', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            {showDeleted ? 'Скрыть удалённые' : `Показать удалённые (${deleted.length})`}
          </button>
          {showDeleted && deleted.map(c => (
            <div key={c.id} style={{background:'#fdecea', borderRadius:12, padding:12, marginTop:8, opacity:0.8}}>
              <div style={{fontSize:13, color:'#888', marginBottom:6, textDecoration:'line-through'}}>{c.text}</div>
              {c.comment_history?.filter(h => h.action === 'deleted').map((h, i) => (
                <div key={i} style={{fontSize:11, color:'#c0392b'}}>🗑 Удалён · {formatDT(h.created_at)}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TASK_STATUS = {
  new: { label: 'Новая', color: '#2980b9', bg: '#e8f4fd' },
  in_progress: { label: 'В работе', color: '#f39c12', bg: '#fef9e7' },
  done: { label: 'Выполнена', color: '#27ae60', bg: '#eafaf1' },
  cancelled: { label: 'Отменена', color: '#BDBDBD', bg: '#f5f5f5' },
  postponed: { label: 'Перенесена', color: '#8e44ad', bg: '#f5eef8' },
  problem: { label: 'Есть трудности', color: '#e74c3c', bg: '#fdecea' },
}
const TASK_PRIORITY = {
  low: { label: 'Низкий', color: '#BDBDBD' },
  normal: { label: 'Средний', color: '#f39c12' },
  high: { label: 'Высокий', color: '#e74c3c' },
}
const ACTIVE = ['new','in_progress','postponed','problem']

function ClientTasksTab({ clientId, session }) {
  const [tasks, setTasks] = useState([])
  const [reps, setReps] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('active')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', priority:'normal', deadline:'' })
  const [assignees, setAssignees] = useState([])
  const [selectedReps, setSelectedReps] = useState([])

  useEffect(() => { loadAll() }, [clientId])

  const loadAll = async () => {
    setLoading(true)
    const { data: tcs } = await supabase.from('task_clients').select('task_id').eq('client_id', clientId)
    const taskIds = (tcs || []).map(tc => tc.task_id)
    if (taskIds.length === 0) { setTasks([]) } else {
      const { data: t } = await supabase.from('tasks').select('*, task_history(*), task_assignees(*, profiles(full_name, email))').in('id', taskIds).order('created_at', { ascending:false })
      setTasks(t || [])
    }
    const { data: r } = await supabase.from('client_representatives').select('*').eq('client_id', clientId)
    setReps(r || [])
    const { data: s } = await supabase.from('profiles').select('id, full_name, email, role').in('role', ['teacher','admin','manager','owner'])
    setStaff(s || [])
    setLoading(false)
  }

  const toggleAssignee = (id) => setAssignees(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleRep = (id) => setSelectedReps(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleCreate = async () => {
    if (!form.title) return
    const { data: task } = await supabase.from('tasks').insert({ ...form, created_by: session.user.id, deadline: form.deadline || null, is_group: false }).select().single()
    if (assignees.length > 0) await supabase.from('task_assignees').insert(assignees.map(uid => ({ task_id: task.id, user_id: uid })))
    await supabase.from('task_clients').insert({ task_id: task.id, client_id: clientId })
    if (selectedReps.length > 0) await supabase.from('task_client_representatives').insert(selectedReps.map(rid => ({ task_id: task.id, client_id: clientId, representative_id: rid })))
    await supabase.from('task_history').insert({ task_id: task.id, author_id: session.user.id, action:'created', comment:'Задача создана' })
    setForm({ title:'', description:'', priority:'normal', deadline:'' })
    setAssignees([]); setSelectedReps([]); setShowForm(false); loadAll()
  }

  const handleStatusChange = async (task, newStatus) => {
    await supabase.from('tasks').update({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }).eq('id', task.id)
    await supabase.from('task_history').insert({ task_id: task.id, author_id: session.user.id, action:'status_changed', comment:`Статус изменён на: ${TASK_STATUS[newStatus].label}` })
    loadAll()
  }

  const formatDT = (dt) => dt ? new Date(dt).toLocaleString('ru-RU', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : '—'
  const filtered = tasks.filter(t => view === 'active' ? ACTIVE.includes(t.status) : !ACTIVE.includes(t.status))
  const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <div style={{display:'flex', gap:4, background:'#f5f5f5', borderRadius:10, padding:3}}>
          {[['active','Текущие'], ['done','Выполненные']].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} style={{padding:'6px 16px', borderRadius:8, border:'none', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', background: view===v ? '#fff' : 'transparent', color: view===v ? '#2a2a2a' : '#888', fontWeight: view===v ? 600 : 400}}>{l}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{padding:'7px 14px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          {showForm ? 'Закрыть' : '+ Новая задача'}
        </button>
      </div>
      {showForm && (
        <div style={{background:'#f9f9f9', borderRadius:12, padding:14, marginBottom:14}}>
          <input value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="Название задачи *" style={inputStyle} />
          <textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Описание (необязательно)" style={{...inputStyle, resize:'vertical', minHeight:50}} />
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <select value={form.priority} onChange={e => setForm({...form, priority:e.target.value})} style={inputStyle}>
              <option value="low">Низкий приоритет</option>
              <option value="normal">Средний приоритет</option>
              <option value="high">Высокий приоритет</option>
            </select>
            <input value={form.deadline} onChange={e => setForm({...form, deadline:e.target.value})} type="datetime-local" style={inputStyle} />
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:12, color:'#888', marginBottom:6, fontWeight:600}}>Ответственные</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {staff.map(s => (
                <label key={s.id} style={{display:'flex', alignItems:'center', gap:6, padding:'4px 10px', background: assignees.includes(s.id) ? '#fafde8' : '#f5f5f5', border: assignees.includes(s.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
                  <input type="checkbox" checked={assignees.includes(s.id)} onChange={() => toggleAssignee(s.id)} />
                  {s.full_name || s.email}
                </label>
              ))}
            </div>
          </div>
          {reps.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:12, color:'#888', marginBottom:6, fontWeight:600}}>Представители</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {reps.map(r => (
                  <label key={r.id} style={{display:'flex', alignItems:'center', gap:6, padding:'4px 10px', background: selectedReps.includes(r.id) ? '#fafde8' : '#f5f5f5', border: selectedReps.includes(r.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
                    <input type="checkbox" checked={selectedReps.includes(r.id)} onChange={() => toggleRep(r.id)} />
                    {r.full_name} ({r.role})
                  </label>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleCreate} style={{width:'100%', padding:'9px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Создать задачу</button>
        </div>
      )}
      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:30}}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:30}}>Задач нет</div>
      ) : (
        filtered.map(task => {
          const isOverdue = task.deadline && ACTIVE.includes(task.status) && new Date(task.deadline) < new Date()
          return (
            <div key={task.id} style={{background:'#fff', borderRadius:12, border:'1px solid #f0f0f0', borderLeft:`4px solid ${TASK_PRIORITY[task.priority].color}`, padding:'12px 14px', marginBottom:10}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap'}}>
                    <span style={{fontSize:14, fontWeight:600, color: isOverdue ? '#e74c3c' : '#2a2a2a'}}>{task.title}</span>
                    <span style={{background: TASK_STATUS[task.status].bg, color: TASK_STATUS[task.status].color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>{TASK_STATUS[task.status].label}</span>
                    {isOverdue && <span style={{background:'#fdecea', color:'#e74c3c', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>⚠️ Просрочена</span>}
                  </div>
                  {task.description && <div style={{fontSize:12, color:'#888', marginBottom:6}}>{task.description}</div>}
                  <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                    {task.task_assignees?.length > 0 && <span style={{fontSize:11, color:'#BDBDBD'}}>👤 {task.task_assignees.map(a => a.profiles?.full_name || a.profiles?.email).join(', ')}</span>}
                    {task.deadline && <span style={{fontSize:11, color: isOverdue ? '#e74c3c' : '#BDBDBD'}}>⏰ {formatDT(task.deadline)}</span>}
                  </div>
                </div>
                <select value={task.status} onChange={e => handleStatusChange(task, e.target.value)} style={{padding:'5px 10px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, fontFamily:'Inter,sans-serif', background:'#fff', cursor:'pointer', flexShrink:0}}>
                  {Object.entries(TASK_STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default function AdminClientCard({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [tab, setTab] = useState('Основное')
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [bonusHistory, setBonusHistory] = useState([])
  const [visibleBonus, setVisibleBonus] = useState(2)
  const [bonusAmount, setBonusAmount] = useState('')
  const [bonusType, setBonusType] = useState('rubles')
  const [bonusReason, setBonusReason] = useState('')
  const [loyaltyLevel, setLoyaltyLevel] = useState(null)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single()
      setClient(profile)
      setAvatarUrl(profile?.avatar_url || null)
      const { data: books } = await supabase.from('bookings').select('*, schedule(title, starts_at, hall)').eq('student_id', id).order('created_at', { ascending: false })
      setBookings(books || [])
      const { data: loyalty } = await supabase.from('client_loyalty').select('level').eq('client_id', id).single()
      setLoyaltyLevel(loyalty?.level || null)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(me?.role)
      const { data: hist } = await supabase.from('bonus_history').select('*').eq('student_id', id).order('created_at', { ascending: false })
      setBonusHistory(hist || [])
      setLoading(false)
    }
    load()
  }, [id])

  const handleAddBonus = async () => {
    if (!bonusAmount) return
    const amount = parseInt(bonusAmount)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('bonus_history').insert({ student_id: id, type: bonusType, amount, reason: bonusReason || 'Ручное начисление', created_by: user.id })
    const field = bonusType === 'rubles' ? 'bonus_rubles' : 'bonus_coins'
    const current = bonusType === 'rubles' ? client.bonus_rubles : client.bonus_coins
    await supabase.from('profiles').update({ [field]: (current || 0) + amount }).eq('id', id)
    setClient({ ...client, [field]: (current || 0) + amount })
    setBonusHistory([{ type: bonusType, amount, reason: bonusReason || 'Ручное начисление', created_at: new Date().toISOString() }, ...bonusHistory])
    setBonusAmount(''); setBonusReason('')
  }

  const LOYALTY = {
    adept:  { label: '🔥 Адепт',      color: '#27ae60', bg: '#eafaf1' },
    loyal:  { label: '💚 Лояльный',   color: '#82c99a', bg: '#f0faf3' },
    edge:   { label: '🤔 На грани',   color: '#f39c12', bg: '#fef9e7' },
    risk:   { label: '⚠️ Риск ухода', color: '#e74c3c', bg: '#fdecea' },
  }

  const handleSetLoyalty = async (level) => {
    const newLevel = loyaltyLevel === level ? null : level
    if (newLevel) {
      await supabase.from('client_loyalty').upsert({ client_id: id, level: newLevel, updated_by: session.user.id, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
    } else {
      await supabase.from('client_loyalty').delete().eq('client_id', id)
    }
    setLoyaltyLevel(newLevel)
  }
  const formatDate = (dt) => new Date(dt).toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'numeric' })
  const formatDT = (dt) => new Date(dt).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
  const initials = (c) => {
    if (c?.full_name) return c.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    return (c?.email || '?')[0].toUpperCase()
  }

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
  if (!client) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Клиент не найден</div>

  return (
    <div>
      <div onClick={() => navigate('/admin/clients')} style={{display:'flex', alignItems:'center', gap:6, color:'#BDBDBD', fontSize:13, cursor:'pointer', marginBottom:20}}>
        ← Назад к клиентам
      </div>

      <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:'20px 24px', marginBottom:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
        <AvatarUpload
  userId={client.id}
  currentUrl={avatarUrl}
  size={52}
  onUpload={(url) => setAvatarUrl(url)}
/>
        <div style={{flex:1}}>
          <div style={{fontSize:18, fontWeight:600, color:'#2a2a2a', marginBottom:2}}>{client.full_name || '—'}</div>
          <div style={{fontSize:12, color:'#BDBDBD'}}>{client.email} · {client.phone || 'телефон не указан'}</div>
        </div>
        {['admin','manager','owner'].includes(userRole) && (
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {Object.entries(LOYALTY).map(([key, l]) => (
              <button key={key} onClick={() => handleSetLoyalty(key)}
                style={{padding:'5px 12px', borderRadius:8, border: loyaltyLevel === key ? 'none' : '1px solid #e0e0e0', background: loyaltyLevel === key ? l.bg : '#fff', color: loyaltyLevel === key ? l.color : '#888', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: loyaltyLevel === key ? 700 : 400}}>
                {l.label}
              </button>
            ))}
          </div>
        )}
        <div style={{display:'flex', gap:8}}>
          <div style={{textAlign:'center', background:'#fafde8', borderRadius:12, padding:'8px 16px'}}>
            <div style={{fontSize:16, fontWeight:600, color:'#6a7700'}}>{client.bonus_rubles || 0} ₽</div>
            <div style={{fontSize:10, color:'#BDBDBD'}}>бонусы</div>
          </div>
          <div style={{textAlign:'center', background:'#f9f9f9', borderRadius:12, padding:'8px 16px'}}>
            <div style={{fontSize:16, fontWeight:600, color:'#2a2a2a'}}>⭐ {client.bonus_coins || 0}</div>
            <div style={{fontSize:10, color:'#BDBDBD'}}>SDTшки</div>
          </div>
        </div>
      </div>

      <div style={{display:'flex', gap:4, marginBottom:0, borderBottom:'1px solid #f0f0f0', background:'#fff', borderRadius:'12px 12px 0 0', padding:'0 8px', overflowX:'auto'}}>
        {TABS.map(t => (
          <div key={t} onClick={() => setTab(t)} style={{padding:'12px 16px', fontSize:13, cursor:'pointer', whiteSpace:'nowrap', color: tab === t ? '#2a2a2a' : '#BDBDBD', borderBottom: tab === t ? '2px solid #BFD900' : '2px solid transparent', fontWeight: tab === t ? 600 : 400, marginBottom:-1}}>{t}</div>
        ))}
      </div>

      <div style={{background:'#fff', borderRadius:'0 0 12px 12px', border:'1px solid #f0f0f0', borderTop:'none', padding:20}}>

        {tab === 'Основное' && (
          <div>
            {[
              ['ФИО', client.full_name || '—'],
              ['Email', client.email],
              ['Телефон', client.phone || '—'],
              ['Дата рождения', client.birth_date ? formatDate(client.birth_date) : '—'],
              ['Роль', client.role],
            ].map(([label, value]) => (
              <div key={label} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f8f8f8', fontSize:13}}>
                <span style={{color:'#BDBDBD'}}>{label}</span>
                <span style={{color:'#2a2a2a', fontWeight:500}}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'Покупки' && <PurchasesTab clientId={id} />}

        {tab === 'Посещения' && (
          <div>
            {bookings.length === 0 ? (
              <div style={{textAlign:'center', color:'#BDBDBD', padding:30}}>Записей нет</div>
            ) : bookings.map(b => (
              <div key={b.id} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f8f8f8', fontSize:13}}>
                <div>
                  <div style={{color:'#2a2a2a', fontWeight:500}}>{b.schedule?.title || '—'}</div>
                  <div style={{color:'#BDBDBD', fontSize:11}}>{b.schedule?.hall} · {b.schedule?.starts_at ? formatDate(b.schedule.starts_at) : '—'}</div>
                </div>
                <span style={{background:'#f5facc', color:'#6a7700', padding:'3px 10px', borderRadius:8, fontSize:11, fontWeight:600}}>{b.status}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'Комментарии' && <CommentsTab clientId={id} />}
        {tab === 'Представители' && <RepresentativesTab clientId={id} />}
        {tab === 'Задачи' && <ClientTasksTab clientId={id} session={session} />}

        {tab === 'Бонусы' && (
          <div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16}}>
              <div style={{background:'#fafde8', border:'1px solid #BFD900', borderRadius:12, padding:14, textAlign:'center'}}>
                <div style={{fontSize:22, fontWeight:300, color:'#2a2a2a'}}>{client.bonus_rubles || 0}</div>
                <div style={{fontSize:11, color:'#BDBDBD'}}>Рубли-бонусы</div>
              </div>
              <div style={{background:'#f9f9f9', borderRadius:12, padding:14, textAlign:'center'}}>
                <div style={{fontSize:22, fontWeight:300, color:'#2a2a2a'}}>⭐ {client.bonus_coins || 0}</div>
                <div style={{fontSize:11, color:'#BDBDBD'}}>SDTшки</div>
              </div>
            </div>
            <div style={{background:'#f9f9f9', borderRadius:12, padding:14, marginBottom:16}}>
              <div style={{fontSize:12, color:'#888', marginBottom:10, fontWeight:600}}>Начислить вручную</div>
              <div style={{display:'flex', gap:8, marginBottom:8}}>
                <button onClick={() => setBonusType('rubles')} style={{flex:1, padding:'8px', borderRadius:8, border: bonusType==='rubles' ? 'none' : '1px solid #e0e0e0', background: bonusType==='rubles' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: bonusType==='rubles' ? 600 : 400}}>₽ Рубли</button>
                <button onClick={() => setBonusType('coins')} style={{flex:1, padding:'8px', borderRadius:8, border: bonusType==='coins' ? 'none' : '1px solid #e0e0e0', background: bonusType==='coins' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: bonusType==='coins' ? 600 : 400}}>⭐ SDTшки</button>
              </div>
              <input value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} placeholder="Количество" type="number" style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box', fontFamily:'Inter,sans-serif'}} />
              <input value={bonusReason} onChange={e => setBonusReason(e.target.value)} placeholder="Причина (необязательно)" style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box', fontFamily:'Inter,sans-serif'}} />
              <button onClick={handleAddBonus} style={{width:'100%', padding:'9px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Начислить</button>
            </div>
            {bonusHistory.length > 0 && (
              <div>
                <div style={{fontSize:11, color:'#BDBDBD', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8}}>История</div>
                {bonusHistory.slice(0, visibleBonus).map((h, i) => (
                  <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f8f8f8', fontSize:13}}>
                    <div>
                      <div style={{color:'#2a2a2a'}}>{h.reason}</div>
                      <div style={{color:'#BDBDBD', fontSize:11}}>{formatDT(h.created_at)}</div>
                    </div>
                    <div style={{fontWeight:600, color: h.amount > 0 ? '#6a7700' : '#e74c3c'}}>
                      {h.amount > 0 ? '+' : ''}{h.amount} {h.type === 'rubles' ? '₽' : '⭐'}
                    </div>
                  </div>
                ))}
                <div style={{display:'flex', gap:8, marginTop:8}}>
                  {bonusHistory.length > visibleBonus && (
                    <>
                      <button onClick={() => setVisibleBonus(v => v + 3)} style={{flex:1, padding:'8px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Показать ещё 3</button>
                      <button onClick={() => setVisibleBonus(bonusHistory.length)} style={{flex:1, padding:'8px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Показать все ({bonusHistory.length})</button>
                    </>
                  )}
                  {visibleBonus >= bonusHistory.length && bonusHistory.length > 2 && (
                    <button onClick={() => setVisibleBonus(2)} style={{flex:1, padding:'8px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Свернуть</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}