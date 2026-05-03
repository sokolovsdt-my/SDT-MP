import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16 }
const fmtMoney = (n) => (Number(n) || 0).toLocaleString('ru-RU') + ' ₽'
const fmtTime = (d) => new Date(d).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })
const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'short' })

function toLocalStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function AdminDashboard({ session }) {
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newClient, setNewClient] = useState({ last_name:'', first_name:'', patronymic:'', birth_date:'', phone:'', email:'', ad_source:'', ad_source_custom:'' })
  const [addingSaving, setAddingSaving] = useState(false)

  const [revenueToday, setRevenueToday] = useState(0)
  const [revenueMonth, setRevenueMonth] = useState(0)
  const [salesToday, setSalesToday] = useState(0)
  const [activeSubs, setActiveSubs] = useState(0)
  const [expiringSoon, setExpiringSoon] = useState(0)
  const [todaySchedule, setTodaySchedule] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [newClients, setNewClients] = useState([])
  const [myIndivs, setMyIndivs] = useState([])

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles')
      .select('role, full_name').eq('id', user.id).single()
    const role = profile?.role
    setUserRole(role)
    setUserName(profile?.full_name || '')

    const today = toLocalStr(new Date())
    const now = new Date()
    const monthStart = toLocalStr(new Date(now.getFullYear(), now.getMonth(), 1))
    const in7days = toLocalStr(new Date(Date.now() + 7 * 86400000))
    const ago7 = toLocalStr(new Date(Date.now() - 7 * 86400000))

    if (role === 'owner') {
      const { data: salesTodayData } = await supabase.from('sales')
        .select('total_net').gte('sale_date', today + 'T00:00:00').lte('sale_date', today + 'T23:59:59').eq('is_cancelled', false)
      setRevenueToday((salesTodayData || []).reduce((s, x) => s + Number(x.total_net), 0))
      setSalesToday((salesTodayData || []).length)

      const { data: salesMonthData } = await supabase.from('sales')
        .select('total_net').gte('sale_date', monthStart + 'T00:00:00').lte('sale_date', today + 'T23:59:59').eq('is_cancelled', false)
      setRevenueMonth((salesMonthData || []).reduce((s, x) => s + Number(x.total_net), 0))

      const { count: activeCount } = await supabase.from('subscriptions')
        .select('id', { count: 'exact', head: true }).gte('expires_at', today).eq('is_frozen', false)
      setActiveSubs(activeCount || 0)

      const { count: expiringCount } = await supabase.from('subscriptions')
        .select('id', { count: 'exact', head: true }).gte('expires_at', today).lte('expires_at', in7days).eq('is_frozen', false)
      setExpiringSoon(expiringCount || 0)
    }

    let scheduleQuery = supabase.from('schedule')
      .select('id, title, starts_at, ends_at, hall, group_id, groups(name, color), teacher_id')
      .gte('starts_at', today + 'T00:00:00').lte('starts_at', today + 'T23:59:59').order('starts_at')
    if (role === 'teacher') scheduleQuery = scheduleQuery.eq('teacher_id', user.id)
    const { data: scheduleData } = await scheduleQuery
    setTodaySchedule(scheduleData || [])

    const { data: assignedTasks } = await supabase.from('task_assignees').select('task_id').eq('user_id', user.id)
    const taskIds = (assignedTasks || []).map(t => t.task_id)
    if (taskIds.length > 0) {
      const { data: tasksData } = await supabase.from('tasks').select('*')
        .in('id', taskIds).in('status', ['new', 'in_progress', 'postponed', 'problem'])
        .order('created_at', { ascending: false }).limit(5)
      setMyTasks(tasksData || [])
    }

    const now2 = new Date()
    const yesterday = new Date(now2); yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(now2); tomorrow.setDate(tomorrow.getDate() + 1)
    const toMMDD = (d) => `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const yesterdayMMDD = toMMDD(yesterday)
    const todayMMDD2 = toMMDD(now2)
    const tomorrowMMDD = toMMDD(tomorrow)

    const { data: birthdayStaff } = await supabase.from('profiles').select('id, full_name, phone, birth_date, role').neq('role', 'client').not('birth_date', 'is', null)
    const { data: birthdayClientUsers } = await supabase.from('profiles').select('id, full_name, phone, birth_date, role').eq('role', 'client').not('birth_date', 'is', null)
    const allBirthdayPeople = [...(birthdayStaff || []), ...(birthdayClientUsers || [])]
    const bdayList = allBirthdayPeople.map(c => {
      const bd = c.birth_date?.slice(5, 10)
      if (!bd) return null
      let when = null
      if (bd === yesterdayMMDD) when = 'yesterday'
      else if (bd === todayMMDD2) when = 'today'
      else if (bd === tomorrowMMDD) when = 'tomorrow'
      else return null
      return { ...c, when }
    }).filter(Boolean).sort((a, b) => ({ yesterday: 0, today: 1, tomorrow: 2 }[a.when] - { yesterday: 0, today: 1, tomorrow: 2 }[b.when]))
    setBirthdays(bdayList)

    const { data: newClientsData } = await supabase.from('profiles')
      .select('id, full_name, email, phone, created_at').eq('role', 'client')
      .gte('created_at', ago7 + 'T00:00:00').order('created_at', { ascending: false }).limit(10)
    setNewClients(newClientsData || [])

    if (role === 'teacher') {
      const { data: indivSubs } = await supabase.from('subscriptions')
        .select('id, type, visits_total, visits_used, profiles:student_id(full_name, phone)')
        .gte('expires_at', today).eq('is_frozen', false).not('visits_total', 'is', null)
      setMyIndivs((indivSubs || []).filter(s => s.type && (s.type.toLowerCase().includes('индив') || s.type.toLowerCase().includes('indiv'))))
    }

    setLoading(false)
  }

  const handleAddClient = async () => {
    if (!newClient.email) { alert('Email обязателен'); return }
    setAddingSaving(true)
    const full_name = [newClient.last_name, newClient.first_name, newClient.patronymic].filter(Boolean).join(' ')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('https://momqnoeogfjjexwcwlpu.supabase.co/functions/v1/create-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ ...newClient, full_name, role: 'client' })
    })
    const result = await res.json()
    if (!res.ok) { alert('Ошибка: ' + (result.error || 'неизвестная')); setAddingSaving(false); return }

    if (result.user_id) {
      await supabase.from('profiles').update({
        first_name: newClient.first_name || null,
        last_name: newClient.last_name || null,
        patronymic: newClient.patronymic || null,
        birth_date: newClient.birth_date || null,
        ad_source: newClient.ad_source || null,
        ad_source_custom: newClient.ad_source === 'other' ? newClient.ad_source_custom || null : null,
      }).eq('id', result.user_id)
    }

    setShowAddModal(false)
    setNewClient({ last_name:'', first_name:'', patronymic:'', birth_date:'', phone:'', email:'', ad_source:'', ad_source_custom:'' })
    setAddingSaving(false)
    loadAll()
  }

  const TASK_STATUS = {
    new: { label: 'Новая', color: '#2980b9', bg: '#e8f4fd' },
    in_progress: { label: 'В работе', color: '#f39c12', bg: '#fef9e7' },
    postponed: { label: 'Перенесена', color: '#8e44ad', bg: '#f5eef8' },
    problem: { label: 'Трудности', color: '#e74c3c', bg: '#fdecea' },
  }

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:60}}>Загрузка...</div>

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'

  const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
  const labelStyle = { fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block' }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12}}>
        <div>
          <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>
            {greeting}{userName ? `, ${userName.split(' ')[0]}` : ''}! 👋
          </h1>
          <div style={{fontSize:13, color:'#888', marginTop:4}}>
            {new Date().toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' })}
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)}
          style={{padding:'10px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          + Добавить клиента
        </button>
      </div>

      {showAddModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}>
          <div style={{background:'#fff', borderRadius:16, padding:28, width:420, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{fontSize:16, fontWeight:600, color:'#2a2a2a', marginBottom:20}}>Новый клиент</div>

            {[
              ['Фамилия', 'last_name', 'Соколова', 'text'],
              ['Имя', 'first_name', 'Мария', 'text'],
              ['Отчество', 'patronymic', 'Ивановна', 'text'],
              ['Email *', 'email', 'client@example.com', 'email'],
              ['Телефон', 'phone', '+7...', 'text'],
              ['Дата рождения', 'birth_date', '', 'date'],
            ].map(([label, key, placeholder, type]) => (
              <div key={key} style={{marginBottom:12}}>
                <label style={labelStyle}>{label}</label>
                <input value={newClient[key]} onChange={e => setNewClient({...newClient, [key]:e.target.value})}
                  placeholder={placeholder} type={type} style={inputStyle} />
              </div>
            ))}

            <div style={{marginBottom: newClient.ad_source === 'other' ? 8 : 20}}>
              <label style={labelStyle}>Рекламный источник</label>
              <select value={newClient.ad_source} onChange={e => setNewClient({...newClient, ad_source:e.target.value, ad_source_custom:''})} style={inputStyle}>
                <option value="">Не указан</option>
                <option value="instagram">Instagram</option>
                <option value="vk">ВКонтакте</option>
                <option value="telegram">Telegram</option>
                <option value="word_of_mouth">Сарафанное радио</option>
                <option value="google">Google</option>
                <option value="yandex">Яндекс</option>
                <option value="2gis">2ГИС</option>
                <option value="other">Другое</option>
              </select>
            </div>

            {newClient.ad_source === 'other' && (
              <div style={{marginBottom:20}}>
                <label style={labelStyle}>Уточните источник</label>
                <input value={newClient.ad_source_custom} onChange={e => setNewClient({...newClient, ad_source_custom:e.target.value})}
                  placeholder="Например: от знакомого Ивана" style={inputStyle} />
              </div>
            )}

            <div style={{display:'flex', gap:8}}>
              <button onClick={handleAddClient} disabled={addingSaving || !newClient.email}
                style={{flex:1, padding:'10px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: addingSaving || !newClient.email ? 0.5 : 1}}>
                {addingSaving ? 'Создаём...' : '+ Создать клиента'}
              </button>
              <button onClick={() => setShowAddModal(false)}
                style={{padding:'10px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {userRole === 'owner' && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16}}>
          {[
            { label: 'Выручка сегодня', value: fmtMoney(revenueToday), sub: `${salesToday} продаж`, color: '#BFD900' },
            { label: 'Выручка за месяц', value: fmtMoney(revenueMonth), color: '#6a7700' },
            { label: 'Активных абонементов', value: activeSubs, color: '#27ae60' },
            { label: 'Истекает за 7 дней', value: expiringSoon, color: '#f39c12', clickable: true },
          ].map(({ label, value, sub, color, clickable }) => (
            <div key={label} onClick={clickable ? () => navigate('/admin/finance') : undefined}
              style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, cursor: clickable ? 'pointer' : 'default'}}>
              <div style={{fontSize:11, color:'#888', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em'}}>{label}</div>
              <div style={{fontSize:22, fontWeight:700, color}}>{value}</div>
              {sub && <div style={{fontSize:11, color:'#BDBDBD', marginTop:4}}>{sub}</div>}
              {clickable && <div style={{fontSize:11, color:'#f39c12', marginTop:4}}>Нажми → Лояльность</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        <div>
          <div style={cardStyle}>
            <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>
              📅 Занятия сегодня
              <span style={{fontSize:12, color:'#BDBDBD', fontWeight:400, marginLeft:8}}>{todaySchedule.length} занятий</span>
            </div>
            {todaySchedule.length === 0 ? (
              <div style={{fontSize:12, color:'#BDBDBD'}}>Занятий сегодня нет</div>
            ) : todaySchedule.map(s => (
              <div key={s.id} style={{display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid #f8f8f8', alignItems:'center'}}>
                <div style={{fontSize:13, fontWeight:700, color:'#2a2a2a', minWidth:40}}>{fmtTime(s.starts_at)}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13, fontWeight:500, color:'#2a2a2a'}}>{s.title || s.groups?.name || 'Занятие'}</div>
                  <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>{s.hall} · до {fmtTime(s.ends_at)}</div>
                </div>
                {s.groups?.color && <div style={{width:8, height:8, borderRadius:'50%', background:s.groups.color, flexShrink:0}} />}
              </div>
            ))}
          </div>

          {userRole === 'teacher' && myIndivs.length > 0 && (
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>🎯 Индивы — остаток занятий</div>
              {myIndivs.map(s => {
                const left = (s.visits_total || 0) - (s.visits_used || 0)
                return (
                  <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f8f8f8'}}>
                    <div>
                      <div style={{fontSize:13, fontWeight:500, color:'#2a2a2a'}}>{s.profiles?.full_name || '—'}</div>
                      <div style={{fontSize:11, color:'#BDBDBD'}}>{s.profiles?.phone}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:16, fontWeight:700, color: left <= 1 ? '#e74c3c' : left <= 2 ? '#f39c12' : '#27ae60'}}>{left}</div>
                      <div style={{fontSize:10, color:'#BDBDBD'}}>из {s.visits_total}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={cardStyle}>
            <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>🎂 Дни рождения</div>
            {birthdays.length === 0 ? (
              <div style={{fontSize:12, color:'#BDBDBD'}}>Именинников нет</div>
            ) : birthdays.map(c => {
              const whenLabel = c.when === 'yesterday' ? 'Вчера' : c.when === 'today' ? 'Сегодня' : 'Завтра'
              const whenColor = c.when === 'today' ? '#27ae60' : c.when === 'tomorrow' ? '#f39c12' : '#BDBDBD'
              return (
                <div key={c.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f8f8f8'}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:500, color:'#2a2a2a'}}>{c.full_name}</div>
                    <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>{c.phone || '—'} · {c.role === 'client' ? 'Клиент' : 'Сотрудник'}</div>
                  </div>
                  <span style={{fontSize:11, fontWeight:600, color:whenColor, background: c.when === 'today' ? '#eafaf1' : c.when === 'tomorrow' ? '#fef9e7' : '#f5f5f5', padding:'3px 10px', borderRadius:8}}>
                    {whenLabel} {c.when === 'today' ? '🎉' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div style={cardStyle}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>✅ Мои задачи</div>
              <button onClick={() => navigate('/admin/tasks')}
                style={{fontSize:12, color:'#2980b9', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                Все задачи →
              </button>
            </div>
            {myTasks.length === 0 ? (
              <div style={{fontSize:12, color:'#BDBDBD'}}>Активных задач нет 🎉</div>
            ) : myTasks.map(t => {
              const st = TASK_STATUS[t.status] || TASK_STATUS.new
              return (
                <div key={t.id} style={{padding:'8px 0', borderBottom:'1px solid #f8f8f8'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8}}>
                    <div style={{fontSize:13, color:'#2a2a2a', fontWeight:500, flex:1}}>{t.title}</div>
                    <span style={{fontSize:10, color:st.color, background:st.bg, padding:'2px 7px', borderRadius:6, fontWeight:600, whiteSpace:'nowrap'}}>{st.label}</span>
                  </div>
                  {t.deadline && (
                    <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>
                      ⏰ {new Date(t.deadline).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={cardStyle}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>
                🆕 Новые клиенты
                <span style={{fontSize:12, color:'#BDBDBD', fontWeight:400, marginLeft:8}}>за 7 дней</span>
              </div>
              <span style={{fontSize:18, fontWeight:700, color:'#BFD900'}}>{newClients.length}</span>
            </div>
            {newClients.length === 0 ? (
              <div style={{fontSize:12, color:'#BDBDBD'}}>Новых клиентов нет</div>
            ) : newClients.map(c => (
              <div key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)}
                style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f8f8f8', cursor:'pointer'}}
                onMouseEnter={e => e.currentTarget.style.background='#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <div>
                  <div style={{fontSize:13, fontWeight:500, color:'#2a2a2a'}}>{c.full_name || c.email}</div>
                  <div style={{fontSize:11, color:'#BDBDBD'}}>{c.phone || c.email}</div>
                </div>
                <div style={{fontSize:11, color:'#BDBDBD'}}>{fmtDate(c.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}