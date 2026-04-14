import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '', birth_date: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const getProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (data) {
        setProfile(data)
        setForm({
          full_name: data.full_name || '',
          phone: data.phone || '',
          birth_date: data.birth_date || ''
        })
      }
    }
    getProfile()
  }, [session])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, ...form })
    if (!error) {
      setProfile({ ...profile, ...form })
      setSaved(true)
      setTimeout(() => { setSaved(false); setEditing(false) }, 1500)
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const name = profile?.full_name || session.user.email
  const initials = name[0].toUpperCase()

  if (editing) return (
    <div style={{fontFamily:'Inter,sans-serif',padding:20}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <div onClick={() => setEditing(false)} style={{cursor:'pointer',color:'#BDBDBD',fontSize:20}}>←</div>
        <div style={{fontSize:16,color:'#2a2a2a',fontWeight:300}}>Редактировать профиль</div>
      </div>

      {[
        { label: 'Имя и фамилия', key: 'full_name', placeholder: 'Иванова Мария', type: 'text' },
        { label: 'Телефон', key: 'phone', placeholder: '+7 900 000 00 00', type: 'tel' },
        { label: 'Дата рождения', key: 'birth_date', placeholder: '', type: 'date' },
      ].map(field => (
        <div key={field.key} style={{marginBottom:16}}>
          <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,letterSpacing:'0.05em'}}>{field.label}</div>
          <input
            type={field.type}
            value={form[field.key]}
            placeholder={field.placeholder}
            onChange={e => setForm({...form, [field.key]: e.target.value})}
            style={{
              width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',
              borderRadius:12,fontSize:14,boxSizing:'border-box',
              fontFamily:'Inter,sans-serif',color:'#2a2a2a',background:'#fff'
            }}
          />
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width:'100%',padding:13,background:'#BFD900',border:'none',
          borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',
          cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:8
        }}
      >
        {saved ? 'Сохранено ✓' : saving ? 'Сохраняем...' : 'Сохранить'}
      </button>
    </div>
  )

  return (
    <div style={{fontFamily:'Inter,sans-serif'}}>
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
        <div style={{background:'#fafde8',border:'1.5px solid #BFD900',borderRadius:16,padding:'14px 16px',width:'100%',boxSizing:'border-box',marginBottom:8}}>
          <div style={{fontSize:10,color:'#8a9900',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>Активный абонемент</div>
          <div style={{fontSize:13,color:'#2a2a2a',fontWeight:400,marginBottom:10,fontFamily:'sans-serif'}}>Безлимит на месяц</div>
          <div style={{background:'#e8f0aa',borderRadius:4,height:5,marginBottom:6}}>
            <div style={{background:'#BFD900',borderRadius:4,height:5,width:'65%'}}></div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#BDBDBD'}}>
            <span>Осталось 13 дней</span><span>до 7 мая</span>
          </div>
        </div>
      </div>

      {[
        { label: 'Мои записи' },
        { label: 'Моя статистика' },
        { label: 'Привести друга ✦', accent: true },
      ].map((item, i) => (
        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',borderBottom:'1px solid #f5f5f5',cursor:'pointer'}}>
          <div style={{fontSize:14,color:item.accent?'#6a7700':'#3a3a3a',fontWeight:item.accent?600:400}}>{item.label}</div>
          <div style={{color:'#d0d0d0',fontSize:16}}>›</div>
        </div>
      ))}

      <div onClick={() => setEditing(true)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',borderBottom:'1px solid #f5f5f5',cursor:'pointer'}}>
        <div style={{fontSize:14,color:'#3a3a3a'}}>Редактировать профиль</div>
        <div style={{color:'#d0d0d0',fontSize:16}}>›</div>
      </div>

      <div onClick={handleLogout} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',cursor:'pointer'}}>
        <div style={{fontSize:14,color:'#ccc'}}>Выйти</div>
        <div style={{color:'#d0d0d0',fontSize:16}}>›</div>
      </div>
    </div>
  )
}