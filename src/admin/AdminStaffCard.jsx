import { useState, useEffect } from 'react'
import AvatarUpload from '../components/AvatarUpload'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { parseMskNaive, todayMsk, mskDayStartNaive } from '../utils/tz'

const ROLE_LABELS = {
  owner: { label: 'Владелец', color: '#6a7700', bg: '#fafde8' },
  manager: { label: 'Управляющий', color: '#2980b9', bg: '#e8f4fd' },
  admin: { label: 'Администратор', color: '#8e44ad', bg: '#f5eef8' },
  teacher: { label: 'Преподаватель', color: '#27ae60', bg: '#eafaf1' },
  other: { label: 'Другое', color: '#888', bg: '#f5f5f5' },
}

const TASK_STATUS = {
  new: { label: 'Новая', color: '#2980b9' },
  in_progress: { label: 'В работе', color: '#f39c12' },
  done: { label: 'Выполнена', color: '#27ae60' },
  cancelled: { label: 'Отменена', color: '#BDBDBD' },
  postponed: { label: 'Перенесена', color: '#8e44ad' },
  problem: { label: 'Есть трудности', color: '#e74c3c' },
}

const PRIORITY_LABELS = { low:'Низкий', normal:'Средний', high:'Высокий' }
const PRIORITY_COLORS = { low:'#27ae60', normal:'#f39c12', high:'#e74c3c' }

const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }
const labelStyle = { fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block' }

export default function AdminStaffCard({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [staff, setStaff] = useState(null)
  const [salaryTiers, setSalaryTiers] = useState([])
  const [currentRole, setCurrentRole] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'main'
  const setTab = (t) => {
    const next = new URLSearchParams(searchParams)
    if (t === 'main') next.delete('tab'); else next.set('tab', t)
    setSearchParams(next, { replace: true })
  }
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState(null)

  useEffect(() => { loadStaff() }, [id])

  const loadStaff = async () => {
    setLoading(true)
    const [{ data }, { data: tiers }, { data: me }] = await Promise.all([
      supabase.from('profiles').select('*, staff_roles(*), staff_info(*), staff_salary_settings(*)').eq('id', id).single(),
      supabase.from('salary_tiers').select('*').eq('staff_id', id).order('created_at'),
      supabase.from('profiles').select('role').eq('id', session.user.id).single(),
    ])
    setStaff(data)
    setSalaryTiers(tiers || [])
    setCurrentRole(me?.role || null)
    setAvatarUrl(data?.avatar_url || null)
    setLoading(false)
  }

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
  if (!staff) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Сотрудник не найден</div>

  const isOwner = currentRole === 'owner'
  const roles = staff.staff_roles?.length > 0 ? staff.staff_roles : [{ role: staff.role, is_primary: true }]
  const isTeacher = roles.some(r => r.role === 'teacher')

  const getCurrentSalary = () => {
    if (salaryTiers.length === 0) return 'Не настроено'
    const parts = []
    if (salaryTiers.find(t => t.tier_type === 'salary')) parts.push(`${Number(salaryTiers.find(t=>t.tier_type==='salary').amount).toLocaleString('ru-RU')} ₽/мес`)
    if (salaryTiers.find(t => t.tier_type === 'per_lesson_tiered')) parts.push('прогрессивная ставка')
    if (salaryTiers.find(t => t.tier_type === 'per_lesson')) parts.push(`${Number(salaryTiers.find(t=>t.tier_type==='per_lesson').amount).toLocaleString('ru-RU')} ₽/зан`)
    if (salaryTiers.find(t => t.tier_type === 'percentage')) parts.push(`${salaryTiers.find(t=>t.tier_type==='percentage').amount}%`)
    return parts.length > 0 ? parts.join(' + ') : 'Не настроено'
  }

  const getExperience = () => {
    const hireDate = staff.staff_info?.hire_date || staff.staff_info?.[0]?.hire_date
    if (!hireDate) return '—'
    const diff = Math.floor((new Date() - new Date(hireDate)) / (1000 * 60 * 60 * 24))
    if (diff < 30) return `${diff} дн.`
    if (diff < 365) return `${Math.floor(diff / 30)} мес.`
    const years = Math.floor(diff / 365)
    const months = Math.floor((diff % 365) / 30)
    return `${years} г. ${months} мес.`
  }

  const tabs = [
    { id: 'main', label: 'Основное' },
    { id: 'salary', label: 'Оплата труда' },
    ...(isTeacher ? [{ id: 'stats', label: 'Статистика' }] : []),
    ...(isTeacher ? [{ id: 'subs', label: 'Замены' }] : []),
    { id: 'absences', label: 'Отпуска' },
    { id: 'tasks', label: 'Задачи' },
  ]

  return (
    <div>
      <button onClick={() => navigate('/admin/staff')}
        style={{background:'none', border:'none', color:'#888', fontSize:13, cursor:'pointer', marginBottom:16, padding:0, fontFamily:'Inter,sans-serif'}}>
        ← Все сотрудники
      </button>

      <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:20, marginBottom:16}}>
        <div style={{display:'flex', alignItems:'flex-start', gap:16, marginBottom:16}}>
          <AvatarUpload userId={staff.id} currentUrl={avatarUrl} size={60} onUpload={(url) => setAvatarUrl(url)} />
          <div style={{flex:1}}>
            <div style={{fontSize:20, fontWeight:600, color:'#1f2024', marginBottom:4}}>{staff.full_name || '—'}</div>
            <div style={{fontSize:13, color:'#888', marginBottom:8}}>
              {staff.email}{staff.phone && ` · ${staff.phone}`}
            </div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {staff.role === 'owner' && (
                <span style={{background: ROLE_LABELS.owner.bg, color: ROLE_LABELS.owner.color, padding:'3px 10px', borderRadius:6, fontSize:12, fontWeight:600}}>
                  Владелец
                </span>
              )}
              {roles.filter(r => r.role !== 'owner').map((r, i) => {
                const rl = ROLE_LABELS[r.role] || ROLE_LABELS.other
                return (
                  <span key={i} style={{background: rl.bg, color: rl.color, padding:'3px 10px', borderRadius:6, fontSize:12, fontWeight:600}}>
                    {r.custom_role_name || rl.label}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div style={{background:'#fafde8', borderRadius:10, padding:'12px 16px'}}>
            <div style={{fontSize:11, color:'#6a7700', fontWeight:600, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.05em'}}>Текущая зарплата</div>
            <div style={{fontSize:16, fontWeight:700, color:'#2a2a2a'}}>{getCurrentSalary()}</div>
          </div>
          <div style={{background:'#f5f5f5', borderRadius:10, padding:'12px 16px'}}>
            <div style={{fontSize:11, color:'#888', fontWeight:600, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.05em'}}>Стаж работы</div>
            <div style={{fontSize:16, fontWeight:700, color:'#2a2a2a'}}>{getExperience()}</div>
          </div>
        </div>
      </div>

      <div style={{display:'flex', gap:4, borderBottom:'1px solid #f0f0f0', marginBottom:20, overflowX:'auto'}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{padding:'10px 16px', background:'transparent', border:'none', borderBottom: tab === t.id ? '2px solid #BFD900' : '2px solid transparent', fontSize:13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? '#2a2a2a' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'main'     && <MainTab staff={staff} onUpdate={loadStaff} isOwner={isOwner} />}
      {tab === 'salary'   && <SalaryTab staff={staff} session={session} onUpdate={loadStaff} isOwner={isOwner} />}
      {tab === 'stats'    && <StatsTab staff={staff} />}
      {tab === 'subs'     && <SubsTab staff={staff} />}
      {tab === 'absences' && <AbsencesTab staff={staff} session={session} />}
      {tab === 'tasks'    && <TasksTab staffId={staff.id} session={session} />}
    </div>
  )
}

function MainTab({ staff, onUpdate, isOwner }) {
  const [form, setForm] = useState({
    full_name: staff.full_name || '',
    phone: staff.phone || '',
    birth_date: staff.birth_date || '',
    hire_date: staff.staff_info?.hire_date || staff.staff_info?.[0]?.hire_date || '',
    sort_order: staff.sort_order ?? 100,
  })
  const [selectedRoles, setSelectedRoles] = useState((staff.staff_roles || []).map(r => r.role))
  const [customRoleName, setCustomRoleName] = useState(staff.staff_roles?.find(r => r.role === 'other')?.custom_role_name || '')
  const [saving, setSaving] = useState(false)

  const toggleRole = (r) => setSelectedRoles(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('profiles').update({
      full_name: form.full_name,
      phone: form.phone || null,
      birth_date: form.birth_date || null,
      sort_order: parseInt(form.sort_order) || 100,
    }).eq('id', staff.id)
    await supabase.from('staff_info').upsert({ staff_id: staff.id, hire_date: form.hire_date || null }, { onConflict: 'staff_id' })
    if (isOwner) {
      await supabase.from('staff_roles').delete().eq('staff_id', staff.id)
      if (selectedRoles.length > 0) {
        const hierarchy = ['owner','manager','admin','teacher','other']
        const primaryRole = hierarchy.find(r => selectedRoles.includes(r))
        await supabase.from('staff_roles').insert(selectedRoles.map(r => ({
          staff_id: staff.id, role: r,
          custom_role_name: r === 'other' ? customRoleName : null,
          is_primary: r === primaryRole
        })))
        if (staff.role !== 'owner') {
          await supabase.from('profiles').update({ role: primaryRole }).eq('id', staff.id)
        }
      }
    }
    setSaving(false)
    onUpdate()
  }

  return (
    <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
      <label style={labelStyle}>ФИО</label>
      <input value={form.full_name} onChange={e => setForm({...form, full_name:e.target.value})} style={inputStyle} disabled={!isOwner} />
      <label style={labelStyle}>Телефон</label>
      <input value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} style={inputStyle} disabled={!isOwner} />
      <label style={labelStyle}>Дата рождения</label>
      <input value={form.birth_date} onChange={e => setForm({...form, birth_date:e.target.value})} type="date" style={inputStyle} disabled={!isOwner} />
      <label style={labelStyle}>Дата найма</label>
      <input value={form.hire_date} onChange={e => setForm({...form, hire_date:e.target.value})} type="date" style={inputStyle} disabled={!isOwner} />
      <label style={labelStyle}>Приоритет показа (меньше = выше в списке)</label>
      <input value={form.sort_order} onChange={e => setForm({...form, sort_order:e.target.value})} type="number" min="1" max="999" style={inputStyle} disabled={!isOwner} />
      {isOwner && (
        <>
          <label style={labelStyle}>Роли</label>
          <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:12}}>
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'owner').map(([k,v]) => (
              <label key={k} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: selectedRoles.includes(k) ? v.bg : '#f5f5f5', border: selectedRoles.includes(k) ? `1px solid ${v.color}` : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
                <input type="checkbox" checked={selectedRoles.includes(k)} onChange={() => toggleRole(k)} />
                <span style={{color: selectedRoles.includes(k) ? v.color : '#888', fontWeight: selectedRoles.includes(k) ? 600 : 400}}>{v.label}</span>
              </label>
            ))}
          </div>
          {selectedRoles.includes('other') && (
            <>
              <label style={labelStyle}>Название роли</label>
              <input value={customRoleName} onChange={e => setCustomRoleName(e.target.value)} placeholder="Например: Хореограф-постановщик" style={inputStyle} />
            </>
          )}
          <button onClick={handleSave} disabled={saving}
            style={{padding:'9px 24px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </>
      )}
      {!isOwner && (
        <div style={{fontSize:12, color:'#BDBDBD', marginTop:8}}>Редактирование доступно только владельцу</div>
      )}
    </div>
  )
}

function SalaryTab({ staff, session, onUpdate, isOwner }) {
  const staffRoles = (staff.staff_roles?.length > 0 ? staff.staff_roles.map(r => r.role) : [staff.role]).filter(r => r !== 'owner')
  const [activeRole, setActiveRole] = useState(staffRoles[0] || 'teacher')
  const [tiers, setTiers] = useState([])
  const [payments, setPayments] = useState([])
  const [history, setHistory] = useState([])
  const [showTierForm, setShowTierForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [newTier, setNewTier] = useState({
    tier_type: 'salary', description: '', amount: '',
    tiers: [{ max_students: 5, amount: '' }, { max_students: null, amount: '' }]
  })
  const [newPayment, setNewPayment] = useState({ type:'bonus', amount:'', reason:'' })
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [editForm, setEditForm] = useState({ type:'bonus', amount:'', reason:'' })
  const [showHistory, setShowHistory] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(3)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: t } = await supabase.from('salary_tiers').select('*').eq('staff_id', staff.id).order('created_at')
    setTiers(t || [])
    const { data: p } = await supabase.from('staff_payments').select('*').eq('staff_id', staff.id).order('created_at', {ascending:false})
    setPayments(p || [])
    const { data: h } = await supabase.from('staff_payments_history').select('*, profiles:changed_by(full_name, email)').eq('staff_id', staff.id).order('created_at', {ascending:false})
    setHistory(h || [])
  }

  const roleTiers = tiers.filter(t => t.role_context === activeRole)

  const addTierRow = () => {
    const rows = [...newTier.tiers]
    rows.splice(rows.length - 1, 0, { max_students: '', amount: '' })
    setNewTier({...newTier, tiers: rows})
  }

  const removeTierRow = (i) => {
    if (newTier.tiers.length <= 2) return
    setNewTier({...newTier, tiers: newTier.tiers.filter((_, idx) => idx !== i)})
  }

  const updateTierRow = (i, field, val) => {
    const rows = [...newTier.tiers]
    rows[i] = {...rows[i], [field]: val}
    setNewTier({...newTier, tiers: rows})
  }

  const handleAddTier = async () => {
    const tierData = {
      staff_id: staff.id,
      role_context: activeRole,
      tier_type: newTier.tier_type,
      description: newTier.description || null,
      is_active: true,
    }
    if (newTier.tier_type === 'per_lesson_tiered') {
      tierData.tiers = newTier.tiers.map((t, i) => ({
        max_students: i === newTier.tiers.length - 1 ? null : Number(t.max_students),
        amount: Number(t.amount)
      }))
    } else {
      tierData.amount = parseFloat(newTier.amount)
    }
    await supabase.from('salary_tiers').insert(tierData)
    setShowTierForm(false)
    setNewTier({ tier_type:'salary', description:'', amount:'', tiers:[{max_students:5, amount:''},{max_students:null, amount:''}] })
    load(); onUpdate()
  }

  const toggleTierActive = async (tier) => {
    await supabase.from('salary_tiers').update({ is_active: !tier.is_active }).eq('id', tier.id)
    load(); onUpdate()
  }

  const deleteTier = async (id) => {
    if (!confirm('Удалить ставку?')) return
    await supabase.from('salary_tiers').delete().eq('id', id)
    load(); onUpdate()
  }

  const handleAddPayment = async () => {
    if (!newPayment.amount) return
    const { data: inserted } = await supabase.from('staff_payments').insert({
      staff_id: staff.id, type: newPayment.type, amount: parseFloat(newPayment.amount),
      reason: newPayment.reason || null, created_by: session.user.id,
    }).select().single()
    await supabase.from('staff_payments_history').insert({
      payment_id: inserted.id, staff_id: staff.id, action: 'created',
      type: newPayment.type, amount: parseFloat(newPayment.amount),
      reason: newPayment.reason || null, changed_by: session.user.id
    })
    setNewPayment({ type:'bonus', amount:'', reason:'' })
    setShowPaymentForm(false)
    load()
  }

  const handleSavePayment = async (id) => {
    const old = payments.find(p => p.id === id)
    await supabase.from('staff_payments').update({ type: editForm.type, amount: parseFloat(editForm.amount), reason: editForm.reason || null }).eq('id', id)
    await supabase.from('staff_payments_history').insert({
      payment_id: id, staff_id: staff.id, action: 'updated',
      type: editForm.type, amount: parseFloat(editForm.amount), reason: editForm.reason || null,
      old_type: old?.type, old_amount: old?.amount, old_reason: old?.reason, changed_by: session.user.id
    })
    setEditingPaymentId(null); load()
  }

  const handleDeletePayment = async (id) => {
    if (!confirm('Удалить начисление?')) return
    const old = payments.find(p => p.id === id)
    await supabase.from('staff_payments_history').insert({
      payment_id: id, staff_id: staff.id, action: 'deleted',
      old_type: old?.type, old_amount: old?.amount, old_reason: old?.reason, changed_by: session.user.id
    })
    await supabase.from('staff_payments').delete().eq('id', id)
    load()
  }

  const tierTypeLabel = {
    salary: 'Оклад', per_lesson: 'За занятие (фикс.)',
    per_lesson_tiered: 'За занятие (прогрессивно)', percentage: 'Процент'
  }
  const paymentLabel = {
    salary: { label:'Зарплата', color:'#2980b9', bg:'#e8f4fd' },
    bonus: { label:'Премия', color:'#27ae60', bg:'#eafaf1' },
    penalty: { label:'Штраф', color:'#e74c3c', bg:'#fdecea' }
  }
  const typeLblFull = { salary:'Зарплата', bonus:'Премия', penalty:'Штраф' }

  const renderTierCard = (tier) => {
    const controls = isOwner && (
      <div style={{display:'flex', gap:8, alignItems:'center', flexShrink:0}}>
        <button onClick={() => toggleTierActive(tier)} style={{padding:'4px 10px', background: tier.is_active ? '#eafaf1' : '#f5f5f5', border:'none', borderRadius:6, fontSize:11, color: tier.is_active ? '#27ae60' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          {tier.is_active ? 'Активна' : 'Откл.'}
        </button>
        <button onClick={() => deleteTier(tier.id)} style={{background:'none', border:'none', color:'#e74c3c', cursor:'pointer', fontSize:18}}>×</button>
      </div>
    )

    if (tier.tier_type === 'per_lesson_tiered' && tier.tiers) {
      return (
        <div key={tier.id} style={{padding:'12px 0', borderBottom:'1px solid #f8f8f8', opacity: tier.is_active ? 1 : 0.4}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:6}}>
                За занятие — прогрессивно
                {tier.description && <span style={{fontSize:11, color:'#888', fontWeight:400, marginLeft:6}}>{tier.description}</span>}
              </div>
              {tier.tiers.map((t, i) => {
                const prev = i > 0 ? Number(tier.tiers[i-1].max_students) + 1 : 1
                const label = t.max_students === null
                  ? `от ${prev} чел. и выше`
                  : i === 0 ? `до ${t.max_students} чел.`
                  : `${prev}–${t.max_students} чел.`
                return (
                  <div key={i} style={{display:'flex', gap:12, alignItems:'center', fontSize:13, marginBottom:3}}>
                    <span style={{color:'#BDBDBD', minWidth:120}}>{label}</span>
                    <span style={{fontWeight:600, color:'#2a2a2a'}}>{Number(t.amount).toLocaleString('ru-RU')} ₽</span>
                  </div>
                )
              })}
            </div>
            {controls}
          </div>
        </div>
      )
    }

    const displayValue = tier.tier_type === 'percentage'
      ? `${tier.amount}%`
      : tier.tier_type === 'salary'
      ? `${Number(tier.amount).toLocaleString('ru-RU')} ₽/мес`
      : `${Number(tier.amount).toLocaleString('ru-RU')} ₽/зан`

    return (
      <div key={tier.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #f8f8f8', opacity: tier.is_active ? 1 : 0.4}}>
        <div>
          <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>{tierTypeLabel[tier.tier_type]}: {displayValue}</div>
          {tier.description && <div style={{fontSize:11, color:'#888'}}>{tier.description}</div>}
        </div>
        {controls}
      </div>
    )
  }

  return (
    <div>
      {staffRoles.length > 1 && (
        <div style={{display:'flex', gap:6, marginBottom:16}}>
          {staffRoles.map(r => {
            const rl = ROLE_LABELS[r] || ROLE_LABELS.other
            return (
              <button key={r} onClick={() => { setActiveRole(r); setShowTierForm(false) }}
                style={{padding:'7px 18px', borderRadius:10, border: activeRole === r ? `1.5px solid ${rl.color}` : '1px solid #e0e0e0', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif',
                  fontWeight: activeRole === r ? 700 : 400, background: activeRole === r ? rl.bg : '#fff', color: activeRole === r ? rl.color : '#888'}}>
                {rl.label}
              </button>
            )
          })}
        </div>
      )}

      <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
          <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>Ставки оплаты</div>
          {isOwner && (
            <button onClick={() => setShowTierForm(!showTierForm)}
              style={{padding:'6px 12px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:12, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
              {showTierForm ? 'Закрыть' : '+ Добавить ставку'}
            </button>
          )}
        </div>

        {isOwner && showTierForm && (
          <div style={{background:'#f9f9f9', borderRadius:10, padding:14, marginBottom:12}}>
            <label style={labelStyle}>Тип ставки</label>
            <select value={newTier.tier_type} onChange={e => setNewTier({...newTier, tier_type:e.target.value})} style={inputStyle}>
              <option value="salary">Оклад (фикс. в месяц)</option>
              <option value="per_lesson">За занятие (фиксированно)</option>
              <option value="per_lesson_tiered">За занятие (прогрессивно по кол-ву учеников)</option>
              <option value="percentage">Процент от выручки</option>
            </select>

            {newTier.tier_type === 'per_lesson_tiered' ? (
              <div style={{marginBottom:8}}>
                <label style={labelStyle}>Пороги и ставки</label>
                {newTier.tiers.map((row, i) => {
                  const isLast = i === newTier.tiers.length - 1
                  const prevMax = i > 0 ? newTier.tiers[i-1].max_students : null
                  return (
                    <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 1fr 28px', gap:8, marginBottom:8, alignItems:'center'}}>
                      {isLast ? (
                        <div style={{fontSize:12, color:'#888', paddingTop:4}}>от {prevMax ? Number(prevMax)+1 : '?'} чел. и выше →</div>
                      ) : (
                        <div style={{display:'flex', alignItems:'center', gap:6}}>
                          <span style={{fontSize:12, color:'#888', whiteSpace:'nowrap'}}>{i === 0 ? 'до' : `${prevMax ? Number(prevMax)+1 : '?'}–`}</span>
                          <input type="number" value={row.max_students} placeholder="чел."
                            onChange={e => updateTierRow(i, 'max_students', e.target.value)}
                            style={{...inputStyle, marginBottom:0, width:'100%'}} />
                          <span style={{fontSize:12, color:'#888'}}>чел.</span>
                        </div>
                      )}
                      <div style={{display:'flex', alignItems:'center', gap:4}}>
                        <input type="number" value={row.amount} placeholder="₽"
                          onChange={e => updateTierRow(i, 'amount', e.target.value)}
                          style={{...inputStyle, marginBottom:0}} />
                        <span style={{fontSize:12, color:'#888'}}>₽</span>
                      </div>
                      {!isLast && i > 0
                        ? <button onClick={() => removeTierRow(i)} style={{background:'none', border:'none', color:'#e74c3c', cursor:'pointer', fontSize:18, padding:0}}>×</button>
                        : <div />}
                    </div>
                  )
                })}
                <button onClick={addTierRow} style={{fontSize:12, color:'#2980b9', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif', marginBottom:4}}>
                  + Добавить порог
                </button>
              </div>
            ) : (
              <>
                <label style={labelStyle}>Сумма</label>
                <input value={newTier.amount} onChange={e => setNewTier({...newTier, amount:e.target.value})}
                  type="number" placeholder={newTier.tier_type === 'percentage' ? 'Например: 15' : 'Например: 40000'} style={inputStyle} />
              </>
            )}

            <label style={labelStyle}>Описание (необязательно)</label>
            <input value={newTier.description} onChange={e => setNewTier({...newTier, description:e.target.value})}
              placeholder="Например: Групповые занятия" style={inputStyle} />
            <button onClick={handleAddTier}
              style={{padding:'8px 20px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Сохранить
            </button>
          </div>
        )}

        {roleTiers.length === 0
          ? <div style={{color:'#BDBDBD', fontSize:12, textAlign:'center', padding:20}}>Ставки не настроены</div>
          : roleTiers.map(renderTierCard)
        }
      </div>

      <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
          <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>Премии и штрафы</div>
          {isOwner && (
            <button onClick={() => setShowPaymentForm(!showPaymentForm)}
              style={{padding:'6px 12px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:12, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
              {showPaymentForm ? 'Закрыть' : '+ Премия / Штраф'}
            </button>
          )}
        </div>
        {isOwner && showPaymentForm && (
          <div style={{background:'#f9f9f9', borderRadius:10, padding:14, marginBottom:12}}>
            <label style={labelStyle}>Тип</label>
            <select value={newPayment.type} onChange={e => setNewPayment({...newPayment, type:e.target.value})} style={inputStyle}>
              <option value="bonus">Премия</option>
              <option value="penalty">Штраф</option>
              <option value="salary">Зарплата</option>
            </select>
            <label style={labelStyle}>Сумма</label>
            <input value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount:e.target.value})} type="number" style={inputStyle} />
            <label style={labelStyle}>Причина</label>
            <input value={newPayment.reason} onChange={e => setNewPayment({...newPayment, reason:e.target.value})} placeholder="За что" style={inputStyle} />
            <button onClick={handleAddPayment} style={{padding:'8px 20px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Добавить</button>
          </div>
        )}
        {payments.length === 0
          ? <div style={{color:'#BDBDBD', fontSize:12, textAlign:'center', padding:20}}>Начислений нет</div>
          : payments.map(p => {
            const lbl = paymentLabel[p.type]
            const isEditing = editingPaymentId === p.id
            if (isEditing) return (
              <div key={p.id} style={{background:'#f9f9f9', borderRadius:10, padding:14, marginBottom:10}}>
                <label style={labelStyle}>Тип</label>
                <select value={editForm.type} onChange={e => setEditForm({...editForm, type:e.target.value})} style={inputStyle}>
                  <option value="bonus">Премия</option><option value="penalty">Штраф</option><option value="salary">Зарплата</option>
                </select>
                <label style={labelStyle}>Сумма</label>
                <input value={editForm.amount} onChange={e => setEditForm({...editForm, amount:e.target.value})} type="number" style={inputStyle} />
                <label style={labelStyle}>Причина</label>
                <input value={editForm.reason} onChange={e => setEditForm({...editForm, reason:e.target.value})} style={inputStyle} />
                <div style={{display:'flex', gap:8}}>
                  <button onClick={() => handleSavePayment(p.id)} style={{flex:1, padding:'8px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Сохранить</button>
                  <button onClick={() => setEditingPaymentId(null)} style={{padding:'8px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
                </div>
              </div>
            )
            return (
              <div key={p.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f8f8f8'}}>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{background:lbl.bg, color:lbl.color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>{lbl.label}</span>
                  <div>
                    <div style={{fontSize:13, fontWeight:600, color: p.type === 'penalty' ? '#e74c3c' : '#2a2a2a'}}>{p.type === 'penalty' ? '−' : '+'} {p.amount.toLocaleString('ru-RU')} ₽</div>
                    {p.reason && <div style={{fontSize:11, color:'#888'}}>{p.reason}</div>}
                  </div>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:11, color:'#BDBDBD'}}>{new Date(p.created_at).toLocaleDateString('ru-RU', { timeZone:'Europe/Moscow' })}</span>
                  {isOwner && <>
                    <button onClick={() => { setEditingPaymentId(p.id); setEditForm({ type:p.type, amount:p.amount, reason:p.reason || '' }) }} style={{background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#888', padding:'2px 6px'}}>✎</button>
                    <button onClick={() => handleDeletePayment(p.id)} style={{background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#e74c3c', padding:'2px 6px'}}>×</button>
                  </>}
                </div>
              </div>
            )
          })
        }
      </div>

      {history.length > 0 && (
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
            <div style={{fontSize:13, fontWeight:600, color:'#888'}}>История изменений ({history.length})</div>
            <button onClick={() => setShowHistory(!showHistory)} style={{background:'none', border:'none', color:'#888', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              {showHistory ? 'Скрыть' : 'Показать'}
            </button>
          </div>
          {showHistory && (
            <>
              {history.slice(0, historyLimit).map(h => {
                const actionLabel = { created:'Добавлено', updated:'Изменено', deleted:'Удалено' }[h.action]
                const actionColor = { created:'#27ae60', updated:'#f39c12', deleted:'#e74c3c' }[h.action]
                return (
                  <div key={h.id} style={{padding:'10px 0', borderBottom:'1px solid #f8f8f8', fontSize:12}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                      <span style={{color:actionColor, fontWeight:600}}>{actionLabel}</span>
                      <span style={{color:'#BDBDBD'}}>{new Date(h.created_at).toLocaleString('ru-RU', { timeZone:'Europe/Moscow', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                      {h.profiles && <span style={{color:'#BDBDBD'}}>· {h.profiles.full_name || h.profiles.email}</span>}
                    </div>
                    {h.action === 'updated' && (
                      <div style={{color:'#888', fontSize:11}}>
                        {h.old_type !== h.type && <div>Тип: {typeLblFull[h.old_type]} → {typeLblFull[h.type]}</div>}
                        {h.old_amount !== h.amount && <div>Сумма: {h.old_amount?.toLocaleString('ru-RU')} ₽ → {h.amount?.toLocaleString('ru-RU')} ₽</div>}
                        {h.old_reason !== h.reason && <div>Причина: "{h.old_reason || '—'}" → "{h.reason || '—'}"</div>}
                      </div>
                    )}
                    {h.action === 'created' && <div style={{color:'#888', fontSize:11}}>{typeLblFull[h.type]}: {h.amount?.toLocaleString('ru-RU')} ₽{h.reason && ` · ${h.reason}`}</div>}
                    {h.action === 'deleted' && <div style={{color:'#888', fontSize:11}}>{typeLblFull[h.old_type]}: {h.old_amount?.toLocaleString('ru-RU')} ₽{h.old_reason && ` · ${h.old_reason}`}</div>}
                  </div>
                )
              })}
              {history.length > historyLimit && (
                <button onClick={() => setHistoryLimit(l => l + 5)} style={{marginTop:10, background:'none', border:'none', color:'#2980b9', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Показать ещё ({history.length - historyLimit})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StatsTab({ staff }) {
  const [stats, setStats] = useState(null)
  useEffect(() => { load() }, [])
  const load = async () => {
    // schedule.starts_at — MSK naive, граница тоже MSK naive (1 число месяца, 00:00).
    const monthFirst = todayMsk().slice(0, 8) + '01'  // 'YYYY-MM-01'
    const monthStart = mskDayStartNaive(monthFirst)
    const { data: lessons } = await supabase.from('schedule').select('id, is_cancelled, indiv_student_id').eq('teacher_id', staff.id).gte('starts_at', monthStart)
    const total = lessons?.length || 0
    const cancelled = lessons?.filter(l => l.is_cancelled).length || 0
    const indivs = lessons?.filter(l => l.indiv_student_id).length || 0
    const groups = total - indivs
    const lessonIds = (lessons || []).filter(l => !l.is_cancelled).map(l => l.id)
    let attendanceRate = 0
    if (lessonIds.length > 0) {
      const { data: att } = await supabase.from('attendance').select('status').in('schedule_id', lessonIds)
      const present = att?.filter(a => a.status === 'present').length || 0
      const totalMarked = att?.length || 0
      attendanceRate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0
    }
    setStats({ total, cancelled, indivs, groups, cancelRate: total > 0 ? Math.round((cancelled / total) * 100) : 0, attendanceRate })
  }
  if (!stats) return <div style={{color:'#BDBDBD', textAlign:'center', padding:30}}>Загрузка...</div>
  const card = (label, value, color = '#2a2a2a') => (
    <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:'16px 20px'}}>
      <div style={{fontSize:11, color:'#BDBDBD', fontWeight:600, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em'}}>{label}</div>
      <div style={{fontSize:24, fontWeight:700, color}}>{value}</div>
    </div>
  )
  return (
    <div>
      <div style={{fontSize:13, color:'#888', marginBottom:14}}>За текущий месяц:</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12}}>
        {card('Всего занятий', stats.total)}
        {card('Групповых', stats.groups)}
        {card('Индивидуальных', stats.indivs)}
        {card('Посещаемость', `${stats.attendanceRate}%`, '#27ae60')}
        {card('Отменено', stats.cancelled, stats.cancelled > 0 ? '#e74c3c' : '#2a2a2a')}
        {card('% отмен', `${stats.cancelRate}%`, stats.cancelRate > 10 ? '#e74c3c' : '#2a2a2a')}
      </div>
    </div>
  )
}

function SubsTab({ staff }) {
  const [substituted, setSubstituted] = useState([])
  const [wasSubstituted, setWasSubstituted] = useState([])
  useEffect(() => { load() }, [])
  const load = async () => {
    const { data: s1 } = await supabase.from('teacher_substitutions').select('*, schedule(title, starts_at, groups(name))').eq('substitute_teacher_id', staff.id).order('created_at', {ascending:false})
    setSubstituted(s1 || [])
    const { data: s2 } = await supabase.from('teacher_substitutions').select('*, schedule(title, starts_at, groups(name))').eq('original_teacher_id', staff.id).order('created_at', {ascending:false})
    setWasSubstituted(s2 || [])
  }
  const card = (label, value) => (
    <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:'16px 20px'}}>
      <div style={{fontSize:11, color:'#BDBDBD', fontWeight:600, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em'}}>{label}</div>
      <div style={{fontSize:24, fontWeight:700, color:'#2a2a2a'}}>{value}</div>
    </div>
  )
  return (
    <div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16}}>
        {card('Заменял других', substituted.length)}
        {card('Его заменяли', wasSubstituted.length)}
      </div>
      {substituted.length > 0 && (
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:12}}>
          <div style={{fontSize:14, fontWeight:600, marginBottom:10}}>Заменял других</div>
          {substituted.map(s => (
            <div key={s.id} style={{padding:'8px 0', borderBottom:'1px solid #f8f8f8', fontSize:13}}>
              {s.schedule?.groups?.name || s.schedule?.title} · {parseMskNaive(s.schedule?.starts_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}
              {s.reason && <div style={{fontSize:11, color:'#888'}}>{s.reason}</div>}
            </div>
          ))}
        </div>
      )}
      {wasSubstituted.length > 0 && (
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
          <div style={{fontSize:14, fontWeight:600, marginBottom:10}}>Его заменяли</div>
          {wasSubstituted.map(s => (
            <div key={s.id} style={{padding:'8px 0', borderBottom:'1px solid #f8f8f8', fontSize:13}}>
              {s.schedule?.groups?.name || s.schedule?.title} · {parseMskNaive(s.schedule?.starts_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}
              {s.reason && <div style={{fontSize:11, color:'#888'}}>{s.reason}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AbsencesTab({ staff, session }) {
  const [absences, setAbsences] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type:'vacation', date_from:'', date_to:'', comment:'' })
  useEffect(() => { load() }, [])
  const load = async () => {
    const { data } = await supabase.from('staff_absences').select('*').eq('staff_id', staff.id).order('date_from', {ascending:false})
    setAbsences(data || [])
  }
  const handleAdd = async () => {
    if (!form.date_from || !form.date_to) return
    await supabase.from('staff_absences').insert({ staff_id: staff.id, type: form.type, date_from: form.date_from, date_to: form.date_to, comment: form.comment || null })
    setForm({ type:'vacation', date_from:'', date_to:'', comment:'' })
    setShowForm(false)
    load()
  }
  const handleDelete = async (id) => {
    if (!confirm('Удалить запись?')) return
    await supabase.from('staff_absences').delete().eq('id', id)
    load()
  }
  const typeLabel = {
    vacation: { label:'Отпуск', color:'#2980b9', bg:'#e8f4fd' },
    sick: { label:'Больничный', color:'#e74c3c', bg:'#fdecea' },
    dayoff: { label:'Отгул', color:'#f39c12', bg:'#fef9e7' }
  }
  return (
    <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>Отпуска и больничные</div>
        <button onClick={() => setShowForm(!showForm)} style={{padding:'6px 12px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:12, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
          {showForm ? 'Закрыть' : '+ Добавить'}
        </button>
      </div>
      {showForm && (
        <div style={{background:'#f9f9f9', borderRadius:10, padding:14, marginBottom:12}}>
          <label style={labelStyle}>Тип</label>
          <select value={form.type} onChange={e => setForm({...form, type:e.target.value})} style={inputStyle}>
            <option value="vacation">Отпуск</option><option value="sick">Больничный</option><option value="dayoff">Отгул</option>
          </select>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <div><label style={labelStyle}>С</label><input value={form.date_from} onChange={e => setForm({...form, date_from:e.target.value})} type="date" style={inputStyle} /></div>
            <div><label style={labelStyle}>По</label><input value={form.date_to} onChange={e => setForm({...form, date_to:e.target.value})} type="date" style={inputStyle} /></div>
          </div>
          <label style={labelStyle}>Комментарий</label>
          <input value={form.comment} onChange={e => setForm({...form, comment:e.target.value})} style={inputStyle} />
          <button onClick={handleAdd} style={{padding:'8px 20px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Сохранить</button>
        </div>
      )}
      {absences.length === 0
        ? <div style={{color:'#BDBDBD', fontSize:12, textAlign:'center', padding:20}}>Нет записей</div>
        : absences.map(a => {
          const lbl = typeLabel[a.type]
          return (
            <div key={a.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f8f8f8'}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <span style={{background:lbl.bg, color:lbl.color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>{lbl.label}</span>
                <div>
                  <div style={{fontSize:13, color:'#2a2a2a'}}>{new Date(a.date_from).toLocaleDateString('ru-RU')} — {new Date(a.date_to).toLocaleDateString('ru-RU')}</div>
                  {a.comment && <div style={{fontSize:11, color:'#888'}}>{a.comment}</div>}
                </div>
              </div>
              <button onClick={() => handleDelete(a.id)} style={{background:'none', border:'none', color:'#e74c3c', cursor:'pointer', fontSize:16}}>×</button>
            </div>
          )
        })
      }
    </div>
  )
}

function TasksTab({ staffId, session }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', priority:'normal', deadline:'' })
  const [saving, setSaving] = useState(false)
  useEffect(() => { load() }, [])
  const load = async () => {
    const { data: ta } = await supabase.from('task_assignees').select('task_id').eq('user_id', staffId)
    const ids = (ta || []).map(x => x.task_id)
    if (ids.length === 0) { setTasks([]); setLoading(false); return }
    const { data: t } = await supabase.from('tasks').select('*').in('id', ids).order('created_at', {ascending:false})
    setTasks(t || [])
    setLoading(false)
  }
  const handleCreate = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const { data: task } = await supabase.from('tasks').insert({
      title: form.title.trim(), description: form.description || null,
      priority: form.priority, deadline: form.deadline || null,
      status: 'new', task_type: 'regular', created_by: session?.user?.id,
    }).select().single()
    if (task) {
      await supabase.from('task_assignees').insert({ task_id: task.id, user_id: staffId })
      await supabase.from('task_history').insert({ task_id: task.id, action: 'created', author_id: session?.user?.id, changes: { title: form.title }, comment: 'Задача создана' })
    }
    setForm({ title:'', description:'', priority:'normal', deadline:'' })
    setShowForm(false); setSaving(false); load()
  }
  if (loading) return <div style={{color:'#BDBDBD', textAlign:'center', padding:30}}>Загрузка...</div>
  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>Задачи сотрудника</div>
        <button onClick={() => setShowForm(!showForm)} style={{padding:'7px 14px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          {showForm ? 'Отмена' : '+ Задача'}
        </button>
      </div>
      {showForm && (
        <div style={{background:'#f9f9f9', borderRadius:12, padding:16, marginBottom:16, border:'1px solid #f0f0f0'}}>
          <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:12}}>Новая задача</div>
          <label style={labelStyle}>Заголовок *</label>
          <input value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="Что нужно сделать" style={inputStyle} />
          <label style={labelStyle}>Описание</label>
          <textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Подробности..." rows={3} style={{...inputStyle, resize:'vertical', lineHeight:1.5}} />
          <label style={labelStyle}>Приоритет</label>
          <div style={{display:'flex', gap:6, marginBottom:8}}>
            {Object.entries(PRIORITY_LABELS).map(([k,v]) => (
              <button key={k} onClick={() => setForm({...form, priority:k})}
                style={{flex:1, padding:'6px 0', borderRadius:8, border:'none', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif',
                  fontWeight:form.priority===k?700:400, background:form.priority===k?PRIORITY_COLORS[k]+'22':'#f5f5f5',
                  color:form.priority===k?PRIORITY_COLORS[k]:'#888', outline:form.priority===k?`1.5px solid ${PRIORITY_COLORS[k]}`:'none'}}>
                {v}
              </button>
            ))}
          </div>
          <label style={labelStyle}>Дедлайн</label>
          <input type="date" value={form.deadline} onChange={e => setForm({...form, deadline:e.target.value})} style={inputStyle} />
          <button onClick={handleCreate} disabled={saving || !form.title.trim()}
            style={{width:'100%', padding:'10px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity:(saving||!form.title.trim())?0.5:1}}>
            {saving ? 'Создаём...' : 'Создать задачу'}
          </button>
        </div>
      )}
      {tasks.length === 0
        ? <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:30, textAlign:'center', color:'#BDBDBD', fontSize:13}}>Задач нет</div>
        : (
          <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
            {tasks.map(t => (
              <div key={t.id} style={{padding:'10px 0', borderBottom:'1px solid #f8f8f8'}}>
                <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                  <span style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>{t.title}</span>
                  <span style={{background:TASK_STATUS[t.status]?.color+'22', color:TASK_STATUS[t.status]?.color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>
                    {TASK_STATUS[t.status]?.label}
                  </span>
                  {t.priority && (
                    <span style={{background:PRIORITY_COLORS[t.priority]+'22', color:PRIORITY_COLORS[t.priority], padding:'2px 8px', borderRadius:6, fontSize:11}}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                  )}
                </div>
                {t.description && <div style={{fontSize:12, color:'#888', marginTop:3}}>{t.description}</div>}
                {t.created_at && <div style={{fontSize:11, color:'#BDBDBD', marginTop:3}}>📅 Назначена: {new Date(t.created_at).toLocaleString('ru-RU', { timeZone:'Europe/Moscow', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>}
                {t.deadline && <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>⏰ Дедлайн: {new Date(t.deadline).toLocaleDateString('ru-RU')}</div>}
                {t.completed_at && <div style={{fontSize:11, color:'#27ae60', marginTop:2}}>✅ Выполнена: {new Date(t.completed_at).toLocaleString('ru-RU', { timeZone:'Europe/Moscow', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>}
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}