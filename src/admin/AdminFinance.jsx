import { useState } from 'react'

export default function AdminFinance({ session }) {
  const [tab, setTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Обзор' },
    { id: 'sales', label: 'Продажи' },
    { id: 'expenses', label: 'Расходы' },
    { id: 'detail', label: 'Детализация' },
    { id: 'loyalty', label: 'Лояльность' },
    { id: 'settings', label: 'Настройки' },
  ]

  return (
    <div>
      <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:'0 0 20px 0'}}>Финансы</h1>

      <div style={{display:'flex', gap:4, borderBottom:'1px solid #f0f0f0', marginBottom:20, overflowX:'auto'}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{padding:'10px 16px', background:'transparent', border:'none', borderBottom: tab === t.id ? '2px solid #BFD900' : '2px solid transparent', fontSize:13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? '#2a2a2a' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <div style={{color:'#BDBDBD', textAlign:'center', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>Обзор — делаем в следующем чате</div>}
      {tab === 'sales' && <div style={{color:'#BDBDBD', textAlign:'center', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>Продажи — делаем в следующем чате</div>}
      {tab === 'expenses' && <div style={{color:'#BDBDBD', textAlign:'center', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>Расходы — делаем в следующем чате</div>}
      {tab === 'detail' && <div style={{color:'#BDBDBD', textAlign:'center', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>Детализация — делаем в следующем чате</div>}
      {tab === 'loyalty' && <div style={{color:'#BDBDBD', textAlign:'center', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>Метрики лояльности — делаем в следующем чате</div>}
      {tab === 'settings' && <div style={{color:'#BDBDBD', textAlign:'center', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>Настройки (эквайринг и т.д.) — делаем в следующем чате</div>}
    </div>
  )
}