import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const getProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setProfile(data)
    }
    getProfile()
  }, [session])

  const name = profile?.full_name || session.user.email
  const initials = name[0].toUpperCase()

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const menuItems = [
    { label: 'Мои записи', icon: '📋' },
    { label: 'Моя статистика', icon: '📊' },
    { label: 'Привести друга ✦', icon: '🎁', accent: true },
    { label: 'Редактировать профиль', icon: '✏️' },
  ]

  return (
    <div style={{fontFamily:'Inter,sans-serif'}}>

      {/* Шапка профиля */}
      <div style={{padding:'20px 20px 0',display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{
          width:72,height:72,background:'#BFD900',borderRadius:'50%',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:20,fontWeight:600,color:'#2a2a2a',marginBottom:12
        }}>
          {initials}
        </div>
        <div style={{fontSize:16,color:'#2a2a2a',fontWeight:300,marginBottom:16,fontFamily:'sans-serif'}}>
          {name}
        </div>

        {/* Статистика */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,width:'100%',marginBottom:16}}>
          {[
            { num: 87, label: 'Занятий' },
            { num: 148, label: 'Часов' },
            { num: 3, label: 'Группы' },
          ].map((s, i) => (
            <div key={i} style={{background:'#fff',borderRadius:14,padding:'12px 8px',textAlign:'center',border:'1px solid #f0f0f0'}}>
              <div style={{fontSize:18,color:'#2a2a2a',fontWeight:300}}>{s.num}</div>
              <div style={{fontSize:9,color:'#BDBDBD',marginTop:3}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Абонемент */}
        <div style={{
          background:'#fafde8',border:'1.5px solid #BFD900',
          borderRadius:16,padding:'14px 16px',width:'100%',
          boxSizing:'border-box',marginBottom:8
        }}>
          <div style={{fontSize:10,color:'#8a9900',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>
            Активный абонемент
          </div>
          <div style={{fontSize:13,color:'#2a2a2a',fontWeight:400,marginBottom:10,fontFamily:'sans-serif'}}>
            Безлимит на месяц
          </div>
          <div style={{background:'#e8f0aa',borderRadius:4,height:5,marginBottom:6}}>
            <div style={{background:'#BFD900',borderRadius:4,height:5,width:'65%'}}></div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#BDBDBD'}}>
            <span>Осталось 13 дней</span>
            <span>до 7 мая</span>
          </div>
        </div>
      </div>

      {/* Меню */}
      {menuItems.map((item, i) => (
        <div key={i} style={{
          display:'flex',justifyContent:'space-between',alignItems:'center',
          padding:'14px 20px',borderBottom:'1px solid #f5f5f5',cursor:'pointer'
        }}>
          <div style={{
            fontSize:14,
            color: item.accent ? '#6a7700' : '#3a3a3a',
            fontWeight: item.accent ? 600 : 400
          }}>
            {item.label}
          </div>
          <div style={{color:'#d0d0d0',fontSize:16}}>›</div>
        </div>
      ))}

      {/* Выход */}
      <div
        onClick={handleLogout}
        style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',cursor:'pointer'}}
      >
        <div style={{fontSize:14,color:'#ccc'}}>Выйти</div>
        <div style={{color:'#d0d0d0',fontSize:16}}>›</div>
      </div>

    </div>
  )
}