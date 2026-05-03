import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const LOYALTY = {
  adept:  { label: '🔥 Адепт',      color: '#27ae60' },
  loyal:  { label: '💚 Лояльный',   color: '#82c99a' },
  edge:   { label: '🤔 На грани',   color: '#f39c12' },
  risk:   { label: '⚠️ Риск ухода', color: '#e74c3c' },
}

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [loyaltyMap, setLoyaltyMap] = useState({})
  const [activeSubIds, setActiveSubIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newClient, setNewClient] = useState({ last_name:'', first_name:'', patronymic:'', birth_date:'', phone:'', email:'', ad_source:'' })
  const [addingSaving, setAddingSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .order('full_name')
    setClients(data || [])

    // Метки лояльности
    const { data: loyalty } = await supabase.from('client_loyalty').select('client_id, level')
    const map = {}
    ;(loyalty || []).forEach(l => { map[l.client_id] = l.level })
    setLoyaltyMap(map)

    // Активные абонементы
    const today = new Date().toISOString().split('T')[0]
    const { data: subs } = await supabase.from('subscriptions')
      .select('student_id').gte('expires_at', today).eq('is_frozen', false)
    setActiveSubIds(new Set((subs || []).map(s => s.student_id)))

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

    // Сохраняем дополнительные поля
    if (result.user_id) {
      await supabase.from('profiles').update({
        first_name: newClient.first_name || null,
        last_name: newClient.last_name || null,
        patronymic: newClient.patronymic || null,
        birth_date: newClient.birth_date || null,
        ad_source: newClient.ad_source || null,
      }).eq('id', result.user_id)
    }

    setShowAddModal(false)
    setNewClient({ last_name:'', first_name:'', patronymic:'', birth_date:'', phone:'', email:'', ad_source:'' })
    setAddingSaving(false)
    load()
  }

  const initials = (c) => {
    if (c.full_name) return c.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    return (c.email || '?')[0].toUpperCase()
  }

  // Фильтрация
  const ago7 = new Date(Date.now() - 7 * 86400000).toISOString()
  const filtered = clients.filter(c => {
    const name = (c.full_name || c.email || '').toLowerCase()
    const phone = (c.phone || '').toLowerCase()
    const matchSearch = name.includes(search.toLowerCase()) || phone.includes(search.toLowerCase())
    if (!matchSearch) return false

    if (filter === 'active') return activeSubIds.has(c.id)
    if (filter === 'inactive') return !activeSubIds.has(c.id)
    if (filter === 'new') return c.created_at > ago7
    return true
  })

  const filterCounts = {
    all: clients.length,
    active: clients.filter(c => activeSubIds.has(c.id)).length,
    inactive: clients.filter(c => !activeSubIds.has(c.id)).length,
    new: clients.filter(c => c.created_at > ago7).length,
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Клиенты</h1>
        <button onClick={() => setShowAddModal(true)}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          + Добавить клиента
        </button>
      </div>

      {/* Модальное окно */}
      {showAddModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}>
          <div style={{background:'#fff', borderRadius:16, padding:28, width:400, boxShadow:'0 8px 32px rgba(0,0,0,0.15)'}}>
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
                <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>{label}</label>
                <input value={newClient[key]} onChange={e => setNewClient({...newClient, [key]:e.target.value})}
                  placeholder={placeholder} type={type}
                  style={{width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif'}} />
              </div>
            ))}

            <label style={{fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block'}}>Рекламный источник</label>
            <select value={newClient.ad_source} onChange={e => setNewClient({...newClient, ad_source:e.target.value})}
              style={{width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, marginBottom:20, boxSizing:'border-box', fontFamily:'Inter,sans-serif'}}>
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

      {/* Поиск и фильтры */}
      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону..."
          style={{flex:1, minWidth:200, padding:'9px 14px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, fontFamily:'Inter,sans-serif', background:'#fff'}} />
        {[
          ['all', 'Все'],
          ['active', '✅ Активные'],
          ['inactive', '😴 Без абонемента'],
          ['new', '🆕 Новые (7 дней)'],
        ].map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:'9px 16px', borderRadius:10, fontSize:12, cursor:'pointer',
            fontFamily:'Inter,sans-serif', border: filter === f ? 'none' : '1px solid #e8e8e8',
            background: filter === f ? '#BFD900' : '#fff',
            color: filter === f ? '#2a2a2a' : '#888', fontWeight: filter === f ? 600 : 400,
            whiteSpace:'nowrap'
          }}>
            {label} <span style={{opacity:0.6, fontSize:11}}>({filterCounts[f]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : (
        <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', overflow:'hidden'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}>
                {['Клиент','Телефон','Лояльность','Абонемент','Бонусы',''].map((h,i) => (
                  <th key={i} style={{textAlign:'left', padding:'12px 16px', fontSize:11, color:'#BDBDBD', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:400}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign:'center', padding:40, color:'#BDBDBD', fontSize:13}}>Клиентов нет</td></tr>
              ) : filtered.map(c => {
                const loyaltyLevel = loyaltyMap[c.id]
                const loyalty = loyaltyLevel ? LOYALTY[loyaltyLevel] : null
                const hasActiveSub = activeSubIds.has(c.id)
                return (
                  <tr key={c.id} style={{borderBottom:'1px solid #f8f8f8'}}>
                    <td style={{padding:'12px 16px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <div style={{width:8, height:8, borderRadius:'50%', flexShrink:0, background: loyalty ? loyalty.color : '#e8e8e8'}} />
                        <div style={{width:34, height:34, background:'#f5facc', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#6a7700', flexShrink:0}}>
                          {initials(c)}
                        </div>
                        <div>
                          <div style={{fontSize:13, fontWeight:500, color:'#2a2a2a'}}>{c.full_name || '—'}</div>
                          <div style={{fontSize:11, color:'#BDBDBD'}}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:'12px 16px', fontSize:13, color:'#3a3a3a'}}>{c.phone || '—'}</td>
                    <td style={{padding:'12px 16px'}}>
                      {loyalty ? (
                        <span style={{fontSize:11, fontWeight:600, color: loyalty.color, background: loyalty.color + '22', padding:'2px 8px', borderRadius:6}}>{loyalty.label}</span>
                      ) : <span style={{fontSize:11, color:'#BDBDBD'}}>—</span>}
                    </td>
                    <td style={{padding:'12px 16px'}}>
                      {hasActiveSub
                        ? <span style={{fontSize:11, fontWeight:600, color:'#27ae60', background:'#eafaf1', padding:'2px 8px', borderRadius:6}}>✅ Активный</span>
                        : <span style={{fontSize:11, color:'#BDBDBD'}}>Нет</span>}
                    </td>
                    <td style={{padding:'12px 16px', fontSize:13, color:'#3a3a3a'}}>{c.bonus_rubles || 0} ₽</td>
                    <td style={{padding:'12px 16px'}}>
                      <button onClick={() => navigate(`/admin/clients/${c.id}`)}
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