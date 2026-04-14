import { useState } from 'react'

const PRODUCTS = {
  subscriptions: [
    { id: 1, name: 'Безлимит на месяц', desc: 'Все группы без ограничений. Действует с 7 по 7 каждого месяца.', price: 8700, unit: '₽/мес', featured: true },
    { id: 2, name: 'Абонемент на 4 занятия', desc: 'Действует 15 дней с момента активации.', price: 5800, unit: '₽' },
    { id: 3, name: 'Разовое занятие', desc: 'Согласовывается с преподавателем или администратором.', price: 1800, unit: '₽' },
    { id: 4, name: 'Пробное занятие', desc: 'Любой день по расписанию подходящей группы.', price: 500, unit: '₽' },
  ],
  indiv: [
    { id: 5, name: 'Индив · Сюзанна Соколова', desc: '60 минут индивидуальной работы.', price: 4500, unit: '₽' },
    { id: 6, name: 'Индив · Мария Куликова', desc: '60 минут индивидуальной работы.', price: 3500, unit: '₽' },
  ],
  events: [
    { id: 7, name: 'Мастер-класс 20 апреля', desc: 'Сюзанна Соколова. Большой зал, 18:00.', price: 1500, unit: '₽' },
  ],
  merch: [
    { id: 8, name: 'Футболка SDT', desc: 'Размеры S, M, L, XL. Хлопок 100%.', price: 1900, unit: '₽' },
  ],
}

const CATS = [
  { id: 'subscriptions', label: 'Абонементы' },
  { id: 'indiv', label: 'Индивы' },
  { id: 'events', label: 'Мероприятия' },
  { id: 'merch', label: 'Мерч' },
]

export default function Shop() {
  const [activeCat, setActiveCat] = useState('subscriptions')

  return (
    <div style={{fontFamily:'Inter,sans-serif'}}>
      <div style={{padding:'16px 20px 0'}}>
        <div style={{fontSize:18,color:'#2a2a2a',fontWeight:300,marginBottom:16,fontFamily:'sans-serif'}}>
          Магазин
        </div>

        {/* Категории */}
        <div style={{display:'flex',gap:8,overflowX:'auto',scrollbarWidth:'none',marginBottom:16}}>
          {CATS.map(cat => (
            <div
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              style={{
                flexShrink:0, padding:'6px 14px', borderRadius:12,
                border: activeCat === cat.id ? 'none' : '1px solid #e0e0e0',
                background: activeCat === cat.id ? '#BFD900' : '#fff',
                color: activeCat === cat.id ? '#2a2a2a' : '#BDBDBD',
                fontSize:12, cursor:'pointer',
                fontWeight: activeCat === cat.id ? 600 : 400
              }}
            >
              {cat.label}
            </div>
          ))}
        </div>
      </div>

      {/* Продукты */}
      <div style={{padding:'0 20px'}}>
        {PRODUCTS[activeCat].map(product => (
          <div
            key={product.id}
            style={{
              background: product.featured ? '#fafde8' : '#fff',
              border: product.featured ? '1.5px solid #BFD900' : '1px solid #efefef',
              borderRadius:20, padding:18, marginBottom:12
            }}
          >
            {product.featured && (
              <div style={{display:'inline-block',background:'#BFD900',color:'#2a2a2a',fontSize:9,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',padding:'3px 10px',borderRadius:8,marginBottom:10}}>
                Популярный
              </div>
            )}
            <div style={{fontSize:14,color:'#2a2a2a',fontWeight:400,marginBottom:4,fontFamily:'sans-serif'}}>{product.name}</div>
            <div style={{fontSize:12,color:'#BDBDBD',marginBottom:14,lineHeight:1.5}}>{product.desc}</div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:18,color:'#2a2a2a',fontFamily:'sans-serif'}}>
                {product.price.toLocaleString()} <span style={{fontSize:11,color:'#BDBDBD'}}>{product.unit}</span>
              </div>
              <button style={{
                background: product.featured ? '#BFD900' : 'transparent',
                color: product.featured ? '#2a2a2a' : '#BDBDBD',
                border: product.featured ? 'none' : '1.5px solid #e0e0e0',
                borderRadius:12, padding:'9px 20px',
                fontSize:12, fontWeight:700, cursor:'pointer',
                fontFamily:'Inter,sans-serif'
              }}>
                Купить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}