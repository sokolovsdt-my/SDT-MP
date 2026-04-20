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
  const [searchEmail, setSearchEmail] = useState('')
  const [foundUser, setFoundUser] = useState(null)
  const [newRoles, setNewRoles] = useState([])
  const [customRoleName, setCustomRoleName] = useState('')
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
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

  const handleSearchEmail = async () => {
    if (!searchEmail) return
    const { data } = await supabase.from('profiles').select('*').eq('email', searchEmail).single()
    if (data) {
      setFoundUser(data)
    } else {
      alert('Пользователь не найден. Сначала создайте его в Supabase → Authentication → Add User')
      setFoundUser(null)
    }
  }

  const toggleRole = (r) => setNewRoles(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])

  const handleAddStaff = async () => {
    if (!foundUser || newRoles.length === 0) return
    setSaving(true)

    // Определяем главную роль (по иерархии)
    const hierarchy = ['owner','manager','admin','teacher','content_creator','other']
    const primaryRole = hierarchy.find(r => newRoles.includes(r))

    // Отключаем триггер, меняем роль через RPC нельзя, поэтому через локальный код
    await supabase.from('profiles').update({ role: primaryRole }).eq('id', foundUser.id)

    // Добавляем роли
    const rolesToInsert = newRoles.map(r => ({
      staff_id: foundUser.id,
      role: r,
      custom_role_name: r === 'other' ? customRoleName : null,
      is_primary: r === primaryRole
    }))
    await supabase.from('staff_roles').insert(rolesToInsert)

    // Добавляем дату найма
    await supabase.from('staff_info').insert({
      staff_id: foundUser.id,
      hire_date: hireDate
    })

    setSearchEmail('')
    setFoundUser(null)
    setNewRoles([])
    setCustomRoleName('')
    setShowForm(false)
    setSaving(false)
    loadAll()
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
        <button onClick={() => setShowForm(!showForm)}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          {showForm ? 'Закрыть' : '+ Добавить сотрудника'}
        </button>
      </div>

      {showForm && (
        <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:20, marginBottom:20}}>
          <div style={{fontSize:14, fontWeight:600, marginBottom:12}}>Новый сотрудник</div>

          <div style={{background:'#fafde8', border:'1px solid #BFD900', borderRadius:10, padding:12, marginBottom:14, fontSize:12, color:'#6a7700'}}>
            ℹ️ Сначала создайте юзера в Supabase → Authentication → Add User. Затем введите его email здесь.
          </div>

          <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>Email сотрудника *</label>
          <div style={{display:'flex', gap:8, marginBottom:12}}>
            <input value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="employee@example.com"
              style={{flex:1, padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, fontFamily:'Inter,sans-serif'}} />
            <button onClick={handleSearchEmail}
              style={{padding:'8px 16px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Найти
            </button>
          </div>

          {foundUser && (
            <>
              <div style={{background:'#f9f9f9', borderRadius:10, padding:12, marginBottom:14}}>
                <div style={{fontSize:13, fontWeight:600}}>✓ Найден: {foundUser.full_name || foundUser.email}</div>
                {foundUser.full_name && <div style={{fontSize:11, color:'#888'}}>{foundUser.email}</div>}
              </div>

              <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>Роли (можно несколько)</label>
              <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:12}}>
                {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'owner').map(([k,v]) => (
                  <label key={k} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: newRoles.includes(k) ? v.bg : '#f5f5f5', border: newRoles.includes(k) ? `1px solid ${v.color}` : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
                    <input type="checkbox" checked={newRoles.includes(k)} onChange={() => toggleRole(k)} />
                    <span style={{color: newRoles.includes(k) ? v.color : '#888', fontWeight: newRoles.includes(k) ? 600 : 400}}>{v.label}</span>
                  </label>
                ))}
              </div>

              {newRoles.includes('other') && (
                <>
                  <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>Название роли</label>
                  <input value={customRoleName} onChange={e => setCustomRoleName(e.target.value)} placeholder="Например: Хореограф-постановщик"
                    style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, marginBottom:12, fontFamily:'Inter,sans-serif', boxSizing:'border-box'}} />
                </>
              )}

              <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>Дата найма</label>
              <input value={hireDate} onChange={e => setHireDate(e.target.value)} type="date"
                style={{width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, marginBottom:14, fontFamily:'Inter,sans-serif', boxSizing:'border-box'}} />

              <button onClick={handleAddStaff} disabled={saving || newRoles.length === 0}
                style={{width:'100%', padding:'10px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: (saving || newRoles.length === 0) ? 0.5 : 1}}>
                {saving ? 'Сохраняем...' : 'Добавить сотрудника'}
              </button>
            </>
          )}
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