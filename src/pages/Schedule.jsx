import { useState } from 'react'

const DAYS = [
  { name: 'пн', num: 7 },
  { name: 'вт', num: 8 },
  { name: 'ср', num: 9 },
  { name: 'чт', num: 10 },
  { name: 'пт', num: 11 },
  { name: 'сб', num: 12 },
  { name: 'вс', num: 13 },
]

const CLASSES = [
  { id: 1, time: '17:00 — 18:00', name: 'Группа №4 (4–6 лет)', teacher: 'Кристина Ревина', hall: 'Малый зал' },
  { id: 2, time: '18:00 — 19:00', name: 'Группа №5 (9–11 лет)', teacher: 'Мария Куликова', hall: 'Большой зал' },
  { id: 3, time: '19:00 — 20:30', name: 'Группа №1 (14+)', teacher: 'Сюзанна Соколова', hall: 'Большой зал' },
]

export default function Schedule() {
  const [activeDay, setActiveDay] = useState(3)
  const [activeFilter, setActiveFilter] = useState('all')
  const [booked, setBooked] = useState([])

  const filters = [
    { id: 'all', label: 'Все' },
    { id: 'morning', label: 'Утро' },
    { id: 'evening', label: 'Вечер' },
  ]

  const handleBook = (id) => {
    if (booked.includes(id)) return
    setBooked([...booked, id])
  }

  return (
    <div style={{fontFamily:'Inter,sans-serif'}}>
      <div style={{padding:'16px 20px 0'}}>
        <div style={{fontSize:18,color:'#2a2a2a',fontWeight:300,marginBottom:16,fontFamily:'sans-serif'}}>
          Расписание
        </div>

        {/* Дни недели */}
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none'}}>
          {DAYS.map((day, i) => (
            <div
              key={i}
              onClick={() => setActiveDay(i)}
              style={{
                flexShrink:0, display:'flex', flexDirection:'column',
                alignItems:'center', padding:'8px 11px', borderRadius:14,
                border: activeDay === i ? 'none' : '1px solid #e8e8e8',
                background: activeDay === i ? '#BFD900' : '#fff',
                cursor:'pointer'
              }}
            >
              <span style={{fontSize:9,color: activeDay === i ? '#5a6600' : '#BDBDBD',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                {day.name}
              </span>
              <span style={{fontSize:15,color:'#2a2a2a',fontWeight: activeDay === i ? 600 : 300}}>
                {day.num}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Фильтры */}
      <div style={{display:'flex',gap:8,padding:'12px 20px',overflowX:'auto',scrollbarWidth:'none'}}>
        {filters.map(f => (
          <div
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            style={{
              flexShrink:0, padding:'5px 13px', borderRadius:10,
              border: activeFilter === f.id ? '1px solid #BFD900' : '1px solid #e0e0e0',
              background: activeFilter === f.id ? '#f5facc' : '#fff',
              color: activeFilter === f.id ? '#6a7700' : '#BDBDBD',
              fontSize:11, cursor:'pointer',
              fontWeight: activeFilter === f.id ? 500 : 400
            }}
          >
            {f.label}
          </div>
        ))}
      </div>

      {/* Список занятий */}
      <div style={{padding:'0 20px'}}>
        {CLASSES.map(cls => (
          <div
            key={cls.id}
            style={{
              background:'#fff', borderRadius:16, padding:'14px 16px',
              marginBottom:10, display:'flex', justifyContent:'space-between',
              alignItems:'center', borderLeft:'3px solid #BFD900',
              border:'1px solid #f0f0f0', borderLeft:'3px solid #BFD900'
            }}
          >
            <div>
              <div style={{fontSize:11,color:'#BFD900',fontWeight:600,marginBottom:4}}>{cls.time}</div>
              <div style={{fontSize:14,color:'#2a2a2a',fontWeight:500,marginBottom:2}}>{cls.name}</div>
              <div style={{fontSize:11,color:'#BDBDBD'}}>{cls.teacher}</div>
              <div style={{fontSize:10,color:'#ccc',marginTop:3}}>{cls.hall}</div>
            </div>
            <button
              onClick={() => handleBook(cls.id)}
              style={{
                background: booked.includes(cls.id) ? '#f5f5f5' : '#BFD900',
                color: booked.includes(cls.id) ? '#BDBDBD' : '#2a2a2a',
                border:'none', borderRadius:10, padding:'7px 13px',
                fontSize:11, fontWeight:700, cursor:'pointer',
                whiteSpace:'nowrap', fontFamily:'Inter,sans-serif'
              }}
            >
              {booked.includes(cls.id) ? 'Записан ✓' : 'Записаться'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}