import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Home({ session }) {
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

  const name = profile?.full_name?.split(' ')[0] || session.user.email

  return (
    <div style={{padding:'16px 20px 0',fontFamily:'Inter,sans-serif'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <div style={{width:36,height:36,border:'2px dashed #BDBDBD',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#BDBDBD'}}>+</div>
        <div style={{width:36,height:36,background:'#BFD900',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#2a2a2a'}}>
          {name[0].toUpperCase()}
        </div>
      </div>

      <div style={{fontSize:12,color:'#BDBDBD',marginBottom:3}}>Добро пожаловать,</div>
      <div style={{fontSize:21,color:'#2a2a2a',fontWeight:300,marginBottom:22}}>
        Привет, <span style={{color:'#BFD900',fontWeight:600}}>{name}!</span>
      </div>

      <div style={{background:'#2a2a2a',borderRadius:22,padding:18,marginBottom:18,position:'relative'}}>
        <div style={{position:'absolute',right:16,top:16,background:'#BFD900',color:'#2a2a2a',borderRadius:10,padding:'5px 12px',fontSize:10,fontWeight:700}}>Большой зал</div>
        <div style={{fontSize:10,letterSpacing:'0.1em',textTransform:'uppercase',color:'#BDBDBD',marginBottom:6}}>Следующее занятие</div>
        <div style={{fontSize:15,color:'#fff',marginBottom:5}}>Группа №1 (14+)</div>
        <div style={{fontSize:12,color:'#888',display:'flex',gap:12}}>
          <span>Сегодня, 19:00</span>
          <span>Сюзанна Соколова</span>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
        <div style={{background:'#fff',borderRadius:16,padding:14,border:'1px solid #efefef'}}>
          <div style={{fontSize:22,color:'#2a2a2a',fontWeight:300}}>24 <span style={{fontSize:11,color:'#BFD900'}}>зан.</span></div>
          <div style={{fontSize:11,color:'#BDBDBD',marginTop:3}}>В этом месяце</div>
        </div>
        <div style={{background:'#fff',borderRadius:16,padding:14,border:'1px solid #efefef'}}>
          <div style={{fontSize:22,color:'#2a2a2a',fontWeight:300}}>148 <span style={{fontSize:11,color:'#BFD900'}}>ч.</span></div>
          <div style={{fontSize:11,color:'#BDBDBD',marginTop:3}}>Всего часов</div>
        </div>
      </div>

      <div style={{fontSize:10,color:'#BDBDBD',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:8}}>Новости студии</div>
      {[
        {text:'Открыта запись на летний интенсив 2026!', date:'10 апр', active:true},
        {text:'Мастер-класс с Сюзанной — 20 апреля, 18:00', date:'8 апр', active:false},
        {text:'Расписание на май уже доступно', date:'5 апр', active:false},
      ].map((n,i) => (
        <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'10px 0',borderBottom:'1px solid #f2f2f2'}}>
          <div style={{width:7,height:7,background:n.active?'#BFD900':'#e0e0e0',borderRadius:'50%',flexShrink:0,marginTop:5}}></div>
          <div>
            <div style={{fontSize:13,color:'#3a3a3a',lineHeight:1.5}}>{n.text}</div>
            <div style={{fontSize:11,color:'#BDBDBD',marginTop:2}}>{n.date}</div>
          </div>
        </div>
      ))}
    </div>
  )
}