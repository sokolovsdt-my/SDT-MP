import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const ROLE_LABELS = {
  owner: { label: 'Владелец', color: '#6a7700', bg: '#fafde8' },
  manager: { label: 'Управляющий', color: '#2980b9', bg: '#e8f4fd' },
  admin: { label: 'Администратор', color: '#8e44ad', bg: '#f5eef8' },
  teacher: { label: 'Преподаватель', color: '#27ae60', bg: '#eafaf1' },
  content_creator: { label: 'Контент-креатор', color: '#f39c12', bg: '#fef9e7' },
  other: { label: 'Другое', color: '#888', bg: '#f5f5f5' },
}

export default function AdminStaff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [newStaff, setNewStaff] = useState({ email:'', full_name:'', phone:'', role:'teacher', hire_date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*, staff_roles(*), staff_info(*), staff_salary_settings(*)')
      .in('role', ['teacher','admin','manager','owner','content_creator','other'])
      .order('full_name')
    setStaff(profiles || [])
    setLoading(false)
  }

  const handleCreateStaff = async () => {
    if (!newStaff.email || !newStaff.role) return
    setSaving(true); setSaveResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('https://momqnoeogfjjexwcwlpu.supabase.co/functions/v1/create-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(newStaff)
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Ошибка')
      setSaveResult({ success: true, message: result.message })
      setNewStaff({ email:'', full_name:'', phone:'', role:'teacher', hire_date: new Date().toISOString().split('T')[0] })
      loadAll()
    } catch (err) {
      setSaveResult({ success: false, message: err.message })
    }
    setSaving(false)
  }

  const getStaffRoles = (s) => s.staff_roles?.length > 0 ? s.staff_roles : [{ role: s.role, is_primary: true }]

  const getCurrentSalary = (s) => {
    const settings = (s.staff_salary_settings || []).filter(x => x.is_active)
    if (settings.length === 0) return '—'
    return settings.map(st => {
      if (st.type === 'salary') return `${st.amount.toLocaleString('ru-RU')} ₽/мес`
      if (st.type === 'per_lesson') return `${st.amount.toLocaleString('ru-RU')} ₽/зан`
      if (st.type === 'percentage') return `${st.amount}%`
    }).join(' + ')
  }

  const getExperience = (s) => {
    const hireDate = s.staff_info?.hire_date || s.staff_info?.[0]?.hire_date
    if (!hireDate) return '—'
    const diff = Math.floor((new Date() - new Date(hireDate)) / (1000 * 60 * 60 * 24))
    if (diff < 30) return `${diff} дн.`
    if (diff < 365) return `${Math.floor(diff / 30)} мес.`
    const years = Math.floor(diff / 365)
    const months = Math.floor((diff % 365) / 30)
    return `${years} г. ${months} мес.`
  }

  const filtered = staff.filter(s => {
    if (filterRole === 'all') return true
    const roles = getStaffRoles(s).map(r => r.role)
    return roles.includes(filterRole)
  })

  const initials = (s) => s.full_name ? s.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : (s.email || '?')[0].toUpperCase()

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Сотрудники</h1>
        <button onClick={() => { setShowForm(!showForm); setSaveResult(null) }}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          {showForm ? 'Закрыть' : '+ Добавить сотрудника'}
        </button>
      </div>

      {showForm && (
        <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:20, marginBottom:20}}>
          <div style={{fontSize:14, fontWeight:600, marginBottom:16}}>Новый сотрудник</div>

          {saveResult && (
            <div style={{padding:'10px 14px', borderRadius:10, marginBottom:12, fontSize:13, background: saveResult.success ? '#eafaf1' : '#fdecea', color: saveResult.success ? '#27ae60' : '#e74c3c'}}>
              {saveResult.success ? '✅ ' : '❌ '}{saveResult.message}
            </div>
          )}

          <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>Email *</label>
          <input value={newStaff.email} onChange={e => setNewStaff({...newStaff, email:e.target.value})}
            placeholder="employee@example.com"
            style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, marginBottom:10, fontFamily:'Inter,sans-serif', boxSizing:'border-box'}} />

          <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>ФИО</label>
          <input value={newStaff.full_name} onChange={e => setNewStaff({...newStaff, full_name:e.target.value})}
            placeholder="Иванова Мария Сергеевна"
            style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, marginBottom:10, fontFamily:'Inter,sans-serif', boxSizing:'border-box'}} />

          <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>Телефон</label>
          <input value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone:e.target.value})}
            placeholder="+7..."
            style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, marginBottom:10, fontFamily:'Inter,sans-serif', boxSizing:'border-box'}} />

          <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>Роль *</label>
          <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role:e.target.value})}
            style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, marginBottom:10, fontFamily:'Inter,sans-serif', boxSizing:'border-box'}}>
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'owner').map(([k,v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>Дата найма</label>
          <input value={newStaff.hire_date} onChange={e => setNewStaff({...newStaff, hire_date:e.target.value})}
            type="date"
            style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, marginBottom:16, fontFamily:'Inter,sans-serif', boxSizing:'border-box'}} />

          <div style={{fontSize:11, color:'#888', background:'#f9f9f9', borderRadius:8, padding:'8px 12px', marginBottom:14}}>
            💡 Сотрудник получит письмо с приглашением для входа в систему
          </div>

          <button onClick={handleCreateStaff} disabled={saving || !newStaff.email}
            style={{width:'100%', padding:'10px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: (saving || !newStaff.email) ? 0.5 : 1}}>
            {saving ? 'Создаём...' : '+ Создать сотрудника'}
          </button>
        </div>
      )}

      {/* Фильтры */}
      <div style={{display:'flex', gap:6, marginBottom:16, flexWrap:'wrap'}}>
        <button onClick={() => setFilterRole('all')} style={{padding:'7px 14px', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', border: filterRole === 'all' ? 'none' : '1px solid #e8e8e8', background: filterRole === 'all' ? '#BFD900' : '#fff', color: filterRole === 'all' ? '#2a2a2a' : '#888', fontWeight: filterRole === 'all' ? 600 : 400}}>Все</button>
        {Object.entries(ROLE_LABELS).map(([k,v]) => (
          <button key={k} onClick={() => setFilterRole(k)}
            style={{padding:'7px 14px', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', border: filterRole === k ? 'none' : '1px solid #e8e8e8', background: filterRole === k ? v.bg : '#fff', color: filterRole === k ? v.color : '#888', fontWeight: filterRole === k ? 600 : 400}}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Таблица */}
      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Сотрудников нет</div>
      ) : (
        <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', overflow:'hidden'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}>
                {['Сотрудник','Роли','Зарплата','Стаж','Телефон',''].map((h,i) => (
                  <th key={i} style={{textAlign:'left', padding:'12px 16px', fontSize:11, color:'#BDBDBD', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:400}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const roles = getStaffRoles(s)
                return (
                  <tr key={s.id} style={{borderBottom:'1px solid #f8f8f8'}}>
                    <td style={{padding:'12px 16px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <div style={{width:34, height:34, background:'#fafde8', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#6a7700', flexShrink:0}}>
                          {initials(s)}
                        </div>
                        <div>
                          <div style={{fontSize:13, fontWeight:500, color:'#2a2a2a'}}>{s.full_name || '—'}</div>
                          <div style={{fontSize:11, color:'#BDBDBD'}}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:'12px 16px'}}>
                      <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                        {roles.map((r, i) => {
                          const rl = ROLE_LABELS[r.role] || ROLE_LABELS.other
                          return (
                            <span key={i} style={{background: rl.bg, color: rl.color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>
                              {r.custom_role_name || rl.label}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{padding:'12px 16px', fontSize:12, color:'#3a3a3a'}}>{getCurrentSalary(s)}</td>
                    <td style={{padding:'12px 16px', fontSize:12, color:'#3a3a3a'}}>{getExperience(s)}</td>
                    <td style={{padding:'12px 16px', fontSize:12, color:'#3a3a3a'}}>{s.phone || '—'}</td>
                    <td style={{padding:'12px 16px'}}>
                      <button onClick={() => navigate(`/admin/staff/${s.id}`)}
                        style={{padding:'6px 14px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', background:'#fff', fontFamily:'Inter,sans-serif'}}>
                        Открыть
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}