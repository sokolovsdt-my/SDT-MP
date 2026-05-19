import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function PrizesTab({ userId, userCoins }) {
  const [prizes, setPrizes] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase.from('prizes').select('*').eq('is_active', true).order('sort_order')
      setPrizes(p || [])
      const { data: r } = await supabase.from('prize_requests').select('*, prize:prizes(name)').eq('client_id', userId).order('created_at', { ascending: false })
      setMyRequests(r || [])
      setLoading(false)
    }
    load()
  }, [userId])

  const handleRequest = async (prize) => {
    if (requesting) return
    setRequesting(prize.id)
    const { data, error } = await supabase.rpc('request_prize', { p_prize_id: prize.id })
    if (error) {
      setRequesting(null)
      alert('Ошибка сети: ' + error.message); return
    }
    if (!data?.ok) {
      setRequesting(null)
      const msg = {
        not_authenticated:    'Сессия истекла, войдите заново',
        prize_not_found:      'Приз не найден',
        prize_inactive:       'Приз снят с раздачи',
        out_of_stock:         'Этот приз закончился',
        insufficient_balance: `Не хватает SDTшек (нужно ${data.price}, есть ${data.balance})`,
        already_pending:      'Вы уже подали заявку на этот приз',
      }[data?.error] || `Не удалось подать заявку: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    const { data: r } = await supabase.from('prize_requests').select('*, prize:prizes(name)').eq('client_id', userId).order('created_at', { ascending: false })
    setMyRequests(r || [])
    setRequesting(null)
  }

  const STATUS_LABEL = { pending:'Ждёт выдачи ⏳', completed:'Получен! 🎉', cancelled:'Отменена' }
  const STATUS_COLOR = { pending:'#f39c12', completed:'#27ae60', cancelled:'#888' }

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:30}}>Загрузка...</div>

  return (
    <div>
      <div style={{fontSize:13, color:'#888', marginBottom:16, lineHeight:1.6}}>
        Обменяй SDTшки на призы — обратись к администратору для получения 🎁
      </div>

      {prizes.length === 0 && (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:30, fontSize:13}}>Призов пока нет</div>
      )}

      {prizes.map(prize => {
        const canAfford = userCoins >= prize.coins_price
        const isOut = prize.stock_count === 0
        const alreadyPending = myRequests.some(r => r.prize_id === prize.id && r.status === 'pending')

        return (
          <div key={prize.id} style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', marginBottom:12, overflow:'hidden'}}>
            {prize.image_url && (
              <img loading="lazy" decoding="async" src={prize.image_url} alt="" style={{width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block'}} />
            )}
            <div style={{padding:14}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                <span style={{fontSize:15, fontWeight:600, color:'#2a2a2a'}}>{prize.name}</span>
                {prize.badge_text && (
                  <span style={{fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:(prize.badge_color||'#f39c12')+'22', color:prize.badge_color||'#f39c12'}}>
                    {prize.badge_text}
                  </span>
                )}
              </div>
              {prize.description && <div style={{fontSize:12, color:'#888', marginBottom:10, lineHeight:1.5}}>{prize.description}</div>}
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontSize:18, fontWeight:600, color:'#f39c12'}}>⭐ {prize.coins_price} SDTшек</div>
                  {isOut && <div style={{fontSize:11, color:'#e74c3c', marginTop:2}}>Закончился</div>}
                  {!isOut && !canAfford && <div style={{fontSize:11, color:'#e74c3c', marginTop:2}}>Не хватает {prize.coins_price - userCoins} ⭐</div>}
                  {!isOut && canAfford && !alreadyPending && <div style={{fontSize:11, color:'#27ae60', marginTop:2}}>Хватает монет ✓</div>}
                </div>
                {alreadyPending ? (
                  <span style={{fontSize:12, color:'#f39c12', fontWeight:600, background:'#fef9e7', padding:'6px 12px', borderRadius:10}}>
                    Заявка подана ⏳
                  </span>
                ) : (
                  <button
                    disabled={!canAfford || isOut || requesting === prize.id}
                    onClick={() => handleRequest(prize)}
                    style={{padding:'9px 18px', borderRadius:12, border:'none', fontFamily:'Inter,sans-serif', fontSize:13, fontWeight:700,
                      cursor: (!canAfford || isOut) ? 'default' : 'pointer',
                      background: (!canAfford || isOut) ? '#f0f0f0' : '#BFD900',
                      color: (!canAfford || isOut) ? '#888' : '#2a2a2a'}}>
                    {requesting === prize.id ? '...' : isOut ? 'Нет' : !canAfford ? 'Мало монет' : 'Хочу! 🎁'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {myRequests.length > 0 && (
        <div style={{marginTop:20}}>
          <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:10}}>Мои заявки</div>
          {myRequests.map(r => (
            <div key={r.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f8f8f8'}}>
              <span style={{fontSize:13, color:'#2a2a2a'}}>{r.prize?.name}</span>
              <span style={{fontSize:12, fontWeight:600, color:STATUS_COLOR[r.status]}}>{STATUS_LABEL[r.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Bonus({ session }) {
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [tab, setTab] = useState(() => localStorage.getItem('bonus_tab') || 'history')

  const goTab = (t) => { setTab(t); localStorage.setItem('bonus_tab', t) }

  useEffect(() => {
    const getData = async () => {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(prof)
      const { data: hist } = await supabase.from('bonus_history').select('*').eq('student_id', session.user.id).order('created_at', { ascending: false }).limit(30)
      setHistory(hist || [])
    }
    getData()
  }, [session])

  const formatDate = (dt) => new Date(dt).toLocaleDateString('ru-RU', { day:'numeric', month:'short' })

  return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{padding:'16px 20px 0'}}>
        <div style={{fontSize:18, color:'#2a2a2a', fontWeight:300, marginBottom:16}}>Бонусы</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
          <div style={{background:'#fafde8', border:'1.5px solid #BFD900', borderRadius:20, padding:16}}>
            <div style={{fontSize:10, color:'#8a9900', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8}}>Рубли-бонусы</div>
            <div style={{fontSize:28, color:'#2a2a2a', fontWeight:300}}>{profile?.bonus_rubles || 0}</div>
            <div style={{fontSize:11, color:'#BDBDBD', marginTop:4}}>1 бонус = 1 ₽</div>
          </div>
          <div style={{background:'#fff', border:'1px solid #f0f0f0', borderRadius:20, padding:16}}>
            <div style={{fontSize:10, color:'#BDBDBD', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8}}>SDTшки ⭐</div>
            <div style={{fontSize:28, color:'#2a2a2a', fontWeight:300}}>{profile?.bonus_coins || 0}</div>
            <div style={{fontSize:11, color:'#BDBDBD', marginTop:4}}>Обмен на призы</div>
          </div>
        </div>
        <div style={{display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid #f0f0f0'}}>
          {[['history','История'],['prizes','Призы']].map(t => (
            <div key={t[0]} onClick={() => goTab(t[0])} style={{padding:'8px 16px', fontSize:13, cursor:'pointer', color:tab===t[0]?'#2a2a2a':'#BDBDBD', borderBottom:tab===t[0]?'2px solid #BFD900':'2px solid transparent', fontWeight:tab===t[0]?500:400, marginBottom:-1}}>
              {t[1]}
            </div>
          ))}
        </div>
        {tab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div style={{fontSize:13, color:'#BDBDBD', padding:'20px 0', textAlign:'center'}}>Начислений пока нет</div>
            ) : history.map(h => (
              <div key={h.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f8f8f8'}}>
                <div>
                  <div style={{fontSize:13, color:'#2a2a2a'}}>{h.reason}</div>
                  <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>{formatDate(h.created_at)}</div>
                </div>
                <div style={{fontSize:14, fontWeight:600, color:h.amount>0?'#6a7700':'#e74c3c'}}>
                  {h.amount>0?'+':''}{h.amount} {h.type==='rubles'?'₽':'⭐'}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'prizes' && <PrizesTab userId={session.user.id} userCoins={profile?.bonus_coins || 0} />}
      </div>
    </div>
  )
}