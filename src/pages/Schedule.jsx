import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { requestPermission } from '../firebase'
const DAYS_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function getDays(count = 30) {
  const days = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push({
      name: DAYS_RU[d.getDay()],
      num: d.getDate(),
      date: d.toISOString().split('T')[0]
    })
  }
  return days
}

const DAYS = getDays(30)

export default function Schedule({ session }) {
  const [activeDay, setActiveDay] = useState(0)
  const [classes, setClasses] = useState([])
  const [booked, setBooked] = useState([])
  const [showPushBanner, setShowPushBanner] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getClasses = async () => {
      setLoading(true)
      const from = DAYS[activeDay].date + 'T00:00:00'
      const to = DAYS[activeDay].date + 'T23:59:59'
      const { data } = await supabase
        .from('schedule')
        .select('*')
        .gte('starts_at', from)
        .lte('starts_at', to)
        .order('starts_at')
      setClasses(data || [])
      setLoading(false)
    }
    getClasses()
  }, [activeDay])

  const formatTime = (dt) => {
    const d = new Date(dt)
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

 const handleBook = async (cls) => {
    if (booked.includes(cls.id)) return
    const { error } = await supabase
      .from('bookings')
      .insert({ 
        student_id: session.user.id, 
        schedule_id: cls.id,
        status: 'booked'
      })
    if (!error) {
  setBooked([...booked, cls.id])
  setShowPushBanner(true)
}
  }

  return (
    <div style={{fontFamily:'Inter,sans-serif'}}>
      <div style={{padding:'16px 20px 0'}}>
        <div style={{fontSize:18,color:'#2a2a2a',fontWeight:300,marginBottom:16,fontFamily:'sans-serif'}}>
          Расписание
        </div>

        {/* 30 дней */}
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
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

      {/* Список занятий */}
      <div style={{padding:'12px 20px 0'}}>
        {loading ? (
          <div style={{fontSize:13,color:'#BDBDBD',padding:'20px 0',textAlign:'center'}}>Загрузка...</div>
        ) : classes.length === 0 ? (
          <div style={{fontSize:13,color:'#BDBDBD',padding:'20px 0',textAlign:'center'}}>Занятий нет</div>
        ) : (
          classes.map(cls => (
            <div
              key={cls.id}
              style={{
                background:'#fff', borderRadius:16, padding:'14px 16px',
                marginBottom:10, display:'flex', justifyContent:'space-between',
                alignItems:'center', border:'1px solid #f0f0f0',
                borderLeft:'3px solid #BFD900'
              }}
            >
              <div>
                <div style={{fontSize:11,color:'#BFD900',fontWeight:600,marginBottom:4}}>
                  {formatTime(cls.starts_at)} — {formatTime(cls.ends_at)}
                </div>
                <div style={{fontSize:14,color:'#2a2a2a',fontWeight:500,marginBottom:2}}>{cls.title}</div>
                <div style={{fontSize:11,color:'#BDBDBD'}}>{cls.description}</div>
                <div style={{fontSize:10,color:'#ccc',marginTop:3}}>{cls.hall}</div>
              </div>
              <button
                onClick={() => handleBook(cls)}
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
          ))
        )}
      </div>
      {showPushBanner && (
  <div style={{margin:'16px 20px',background:'#fff',border:'1px solid #f0f0f0',borderRadius:16,padding:16}}>
    <div style={{fontSize:13,color:'#2a2a2a',fontWeight:500,marginBottom:6}}>
      🔔 Узнавайте первыми об изменениях в расписании и отменах занятий
    </div>
    <div style={{display:'flex',gap:8,marginTop:8}}>
      <button
        onClick={async () => {
          const token = await requestPermission()
          if (token) {
            await supabase.from('profiles').upsert({ id: session.user.id, push_token: token })
          }
          setShowPushBanner(false)
        }}
        style={{flex:1,padding:'10px',background:'#BFD900',border:'none',borderRadius:12,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}
      >
        Включить
      </button>
      <button
        onClick={() => setShowPushBanner(false)}
        style={{padding:'10px 16px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:12,fontSize:13,color:'#BDBDBD',cursor:'pointer',fontFamily:'Inter,sans-serif'}}
      >
        Не сейчас
      </button>
    </div>
  </div>
)}
    </div>
  )
}