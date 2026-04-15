import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Bonus({ session, onBack }) {
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [tab, setTab] = useState('balance')

  useEffect(() => {
    const getData = async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setProfile(prof)

      const { data: hist } = await supabase
        .from('bonus_history')
        .select('*')
        .eq('student_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setHistory(hist || [])
    }
    getData()
  }, [session])

  const refLink = `https://sdt-mp.vercel.app?ref=${session.user.id.slice(0,8)}`

  const formatDate = (dt) => new Date(dt).toLocaleDateString('ru-RU', { day:'numeric', month:'short' })

  return (
    <div style={{fontFamily:'Inter,sans-serif'}}>
      <div style={{padding:'16px 20px 0'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <div onClick={onBack} style={{cursor:'pointer',color:'#BDBDBD',fontSize:20}}>←</div>
          <div style={{fontSize:16,color:'#2a2a2a',fontWeight:300}}>Бонусы и SDTшки</div>
        </div>

        {/* Балансы */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
          <div style={{background:'#fafde8',border:'1.5px solid #BFD900',borderRadius:20,padding:16}}>
            <div style={{fontSize:10,color:'#8a9900',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>Рубли-бонусы</div>
            <div style={{fontSize:28,color:'#2a2a2a',fontWeight:300}}>{profile?.bonus_rubles || 0}</div>
            <div style={{fontSize:11,color:'#BDBDBD',marginTop:4}}>1 бонус = 1 ₽</div>
          </div>
          <div style={{background:'#fff',border:'1px solid #f0f0f0',borderRadius:20,padding:16}}>
            <div style={{fontSize:10,color:'#BDBDBD',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>SDTшки ⭐</div>
            <div style={{fontSize:28,color:'#2a2a2a',fontWeight:300}}>{profile?.bonus_coins || 0}</div>
            <div style={{fontSize:11,color:'#BDBDBD',marginTop:4}}>Обмен на призы</div>
          </div>
        </div>

        {/* Табы */}
        <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid #f0f0f0'}}>
          {[
            { id:'balance', label:'История' },
            { id:'referral', label:'Привести друга' },
            { id:'prizes', label:'Призы' },
          ].map(t => (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding:'8px 14px', fontSize:12, cursor:'pointer',
                color: tab === t.id ? '#2a2a2a' : '#BDBDBD',
                borderBottom: tab === t.id ? '2px solid #BFD900' : '2px solid transparent',
                fontWeight: tab === t.id ? 500 : 400,
                marginBottom:-1
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* История */}
        {tab === 'balance' && (
          <div>
            {history.length === 0 ? (
              <div style={{fontSize:13,color:'#BDBDBD',padding:'20px 0',textAlign:'center'}}>
                Начислений пока нет
              </div>
            ) : (
              history.map(h => (
                <div key={h.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #f8f8f8'}}>
                  <div>
                    <div style={{fontSize:13,color:'#2a2a2a'}}>{h.reason}</div>
                    <div style={{fontSize:11,color:'#BDBDBD',marginTop:2}}>{formatDate(h.created_at)}</div>
                  </div>
                  <div style={{fontSize:14,fontWeight:600,color: h.amount > 0 ? '#6a7700' : '#e74c3c'}}>
                    {h.amount > 0 ? '+' : ''}{h.amount} {h.type === 'rubles' ? '₽' : '⭐'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Привести друга */}
        {tab === 'referral' && (
          <div>
            <div style={{background:'#fafde8',border:'1px solid #BFD900',borderRadius:16,padding:16,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a',marginBottom:8}}>Как это работает</div>
              <div style={{fontSize:12,color:'#555',lineHeight:1.7}}>
                Поделитесь ссылкой с другом. Когда он купит абонемент — вы получите <strong>10% от стоимости</strong> на бонусный счёт. Друг тоже получит <strong>10% бонусов</strong> на первый месяц! 🎉
              </div>
            </div>
            <div style={{fontSize:11,color:'#BDBDBD',marginBottom:8}}>Ваша реферальная ссылка</div>
            <div style={{background:'#f9f9f9',borderRadius:12,padding:'12px 14px',fontSize:12,color:'#2a2a2a',marginBottom:12,wordBreak:'break-all'}}>
              {refLink}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(refLink); alert('Ссылка скопирована!') }}
              style={{width:'100%',padding:13,background:'#BFD900',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}
            >
              Скопировать ссылку
            </button>
          </div>
        )}

        {/* Призы */}
        {tab === 'prizes' && (
          <div>
            <div style={{fontSize:13,color:'#BDBDBD',marginBottom:16}}>Обменяйте SDTшки на призы в студии</div>
            {[
              { name: 'Брелок SDT', coins: 10 },
              { name: 'Наклейки SDT', coins: 15 },
              { name: 'Футболка SDT', coins: 50 },
              { name: 'Мастер-класс бесплатно', coins: 100 },
            ].map((prize, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff',borderRadius:14,padding:'14px 16px',marginBottom:10,border:'1px solid #f0f0f0'}}>
                <div style={{fontSize:14,color:'#2a2a2a'}}>{prize.name}</div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:'#2a2a2a'}}>{prize.coins} ⭐</span>
                  <button style={{background:'#f5f5f5',border:'none',borderRadius:8,padding:'5px 12px',fontSize:11,color:'#BDBDBD',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    Обменять
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}