import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TYPE_TO_CAT = {
  subscription: 'subscriptions',
  service: 'services',
  indiv: 'indiv',
  event: 'events',
  merch: 'merch',
}

const CATS = [
  { id: 'subscriptions', label: 'Абонементы' },
  { id: 'services', label: 'Услуги' },
  { id: 'indiv', label: 'Индивы' },
  { id: 'events', label: 'Мероприятия' },
  { id: 'merch', label: 'Мерч' },
]

export default function Shop({ session }) {
  const [activeCat, setActiveCat] = useState('subscriptions')
  const [selected, setSelected] = useState(null)
  const [products, setProducts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const today = new Date().getDate() // день месяца (1-31)

      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      const grouped = { subscriptions: [], services: [], indiv: [], events: [], merch: [] }
      ;(data || []).forEach(p => {
        // Фильтр по дням продажи
        if (p.available_from_day && p.available_to_day) {
          if (today < p.available_from_day || today > p.available_to_day) return
        }
        const cat = TYPE_TO_CAT[p.type]
        if (cat && grouped[cat]) grouped[cat].push(p)
      })
      setProducts(grouped)
      setLoading(false)
    }
    load()
  }, [])

  const current = products[activeCat] || []

  return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{padding:'16px 20px 0'}}>
        <div style={{fontSize:18, color:'#2a2a2a', fontWeight:300, marginBottom:16, fontFamily:'sans-serif'}}>
          Магазин
        </div>
        <div style={{display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', marginBottom:16}}>
          {CATS.map(cat => (
            <div key={cat.id} onClick={() => setActiveCat(cat.id)} style={{
              flexShrink:0, padding:'6px 14px', borderRadius:12,
              border: activeCat === cat.id ? 'none' : '1px solid #e0e0e0',
              background: activeCat === cat.id ? '#BFD900' : '#fff',
              color: activeCat === cat.id ? '#2a2a2a' : '#BDBDBD',
              fontSize:12, cursor:'pointer',
              fontWeight: activeCat === cat.id ? 600 : 400
            }}>{cat.label}</div>
          ))}
        </div>
      </div>

      <div style={{padding:'0 20px 20px'}}>
        {loading ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
        ) : current.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>
            Пока ничего нет
          </div>
        ) : current.map(product => {
          return (
            <div key={product.id} style={{
              background: product.is_featured ? '#fafde8' : '#fff',
              border: product.is_featured ? `1.5px solid ${product.badge_color || '#BFD900'}` : '1px solid #efefef',
              borderRadius:20, padding:18, marginBottom:12
            }}>
             {product.is_featured && (
              <div style={{display:'inline-block', background:product.badge_color || '#BFD900', color: (product.badge_color === '#BFD900' || product.badge_color === '#f39c12' || product.badge_color === '#e0e0e0') ? '#2a2a2a' : '#fff', fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'3px 10px', borderRadius:8, marginBottom:10}}>
                {product.badge_text || 'Популярный'}
              </div>
            )}
              <div style={{fontSize:14, color:'#2a2a2a', fontWeight:400, marginBottom:4, fontFamily:'sans-serif'}}>{product.name}</div>
              {product.description && (
                <div style={{fontSize:12, color:'#BDBDBD', marginBottom:14, lineHeight:1.5}}>{product.description}</div>
              )}
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{fontSize:18, color:'#2a2a2a', fontFamily:'sans-serif'}}>
                  {Number(product.price).toLocaleString()} <span style={{fontSize:11, color:'#BDBDBD'}}>₽</span>
                </div>
                <button
                  onClick={() => setSelected(product)}
                  style={{
                    background: product.is_featured ? (product.badge_color || '#BFD900') : 'transparent',
                    color: product.is_featured ? ((product.badge_color === '#BFD900' || product.badge_color === '#f39c12' || product.badge_color === '#e0e0e0') ? '#2a2a2a' : '#fff') : '#BDBDBD',
                    border: product.is_featured ? 'none' : '1.5px solid #e0e0e0',
                    borderRadius:12, padding:'9px 20px',
                    fontSize:12, fontWeight:700, cursor:'pointer',
                    fontFamily:'Inter,sans-serif'
                  }}>
                  Купить
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div onClick={() => setSelected(null)}
          style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:'#fff', borderRadius:'24px 24px 0 0', padding:24, width:'100%', maxWidth:480, boxSizing:'border-box'}}>
            <div style={{width:40, height:4, background:'#e0e0e0', borderRadius:2, margin:'0 auto 20px'}} />
            <div style={{fontSize:16, color:'#2a2a2a', fontWeight:500, marginBottom:6}}>{selected.name}</div>
            {selected.description && (
              <div style={{fontSize:13, color:'#BDBDBD', marginBottom:20, lineHeight:1.6}}>{selected.description}</div>
            )}
            <div style={{fontSize:24, color:'#2a2a2a', fontWeight:300, marginBottom:20}}>
              {Number(selected.price).toLocaleString()} <span style={{fontSize:14, color:'#BDBDBD'}}>₽</span>
            </div>
            <button
              onClick={() => alert('Оплата скоро будет доступна! Для оплаты свяжитесь с администратором.')}
              style={{width:'100%', padding:14, background:'#BFD900', border:'none', borderRadius:14, fontSize:14, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', marginBottom:10}}>
              Оплатить {Number(selected.price).toLocaleString()} ₽
            </button>
            <button onClick={() => setSelected(null)}
              style={{width:'100%', padding:14, background:'transparent', border:'1px solid #e0e0e0', borderRadius:14, fontSize:14, color:'#BDBDBD', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}