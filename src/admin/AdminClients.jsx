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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
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

    // Загружаем метки лояльности
    const { data: loyalty } = await supabase
      .from('client_loyalty')
      .select('client_id, level')
    const map = {}
    ;(loyalty || []).forEach(l => { map[l.client_id] = l.level })
    setLoyaltyMap(map)

    setLoading(false)
  }

  const filtered = clients.filter(c => {
    const name = (c.full_name || c.email || '').toLowerCase()
    const phone = (c.phone || '').toLowerCase()
    return name.includes(search.toLowerCase()) || phone.includes(search.toLowerCase())
  })

  const initials = (c) => {
    if (c.full_name) return c.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    return (c.email || '?')[0].toUpperCase()
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Клиенты</h1>
        <button
          onClick={() => navigate('/admin/clients/new')}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          + Добавить клиента
        </button>
      </div>

      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону..."
          style={{flex:1, minWidth:200, padding:'9px 14px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, fontFamily:'Inter,sans-serif', background:'#fff'}}
        />
        {['all','active','debt','new'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:'9px 16px', borderRadius:10, fontSize:12, cursor:'pointer',
            fontFamily:'Inter,sans-serif', border: filter === f ? 'none' : '1px solid #e8e8e8',
            background: filter === f ? '#BFD900' : '#fff',
            color: filter === f ? '#2a2a2a' : '#888', fontWeight: filter === f ? 600 : 400
          }}>
            {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : f === 'debt' ? 'Долги' : 'Новые'}
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
                {['Клиент','Телефон','Лояльность','Бонусы','SDTшки',''].map((h,i) => (
                  <th key={i} style={{textAlign:'left', padding:'12px 16px', fontSize:11, color:'#BDBDBD', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:400}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign:'center', padding:40, color:'#BDBDBD', fontSize:13}}>Клиентов нет</td></tr>
              ) : (
                filtered.map(c => {
                  const loyaltyLevel = loyaltyMap[c.id]
                  const loyalty = loyaltyLevel ? LOYALTY[loyaltyLevel] : null
                  return (
                    <tr key={c.id} style={{borderBottom:'1px solid #f8f8f8'}}>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex', alignItems:'center', gap:10}}>
                          {/* Цветная точка лояльности */}
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: loyalty ? loyalty.color : '#e8e8e8',
                          }} />
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
                          <span style={{fontSize:11, fontWeight:600, color: loyalty.color, background: loyalty.color + '22', padding:'2px 8px', borderRadius:6}}>
                            {loyalty.label}
                          </span>
                        ) : (
                          <span style={{fontSize:11, color:'#BDBDBD'}}>—</span>
                        )}
                      </td>
                      <td style={{padding:'12px 16px', fontSize:13, color:'#3a3a3a'}}>{c.bonus_rubles || 0} ₽</td>
                      <td style={{padding:'12px 16px', fontSize:13, color:'#3a3a3a'}}>⭐ {c.bonus_coins || 0}</td>
                      <td style={{padding:'12px 16px'}}>
                        <button
                          onClick={() => navigate(`/admin/clients/${c.id}`)}
                          style={{padding:'6px 14px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', background:'#fff', fontFamily:'Inter,sans-serif'}}>
                          Открыть
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}