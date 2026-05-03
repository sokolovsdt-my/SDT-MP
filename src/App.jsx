import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import Shop from './pages/Shop'
import News from './pages/News'
import Profile from './pages/Profile'
import BottomNav from './components/BottomNav'
import AdminLayout from './admin/AdminLayout'
import AdminDashboard from './admin/AdminDashboard'
import AdminClients from './admin/AdminClients'
import AdminClientCard from './admin/AdminClientCard'
import AdminTasks from './admin/AdminTasks'
import AdminCatalog from './admin/AdminCatalog'
import AdminSchedule from './admin/AdminSchedule'
import AdminStaff from './admin/AdminStaff'
import AdminStaffCard from './admin/AdminStaffCard'
import AdminFinance from './admin/AdminFinance'
import AdminCashbox from './admin/AdminCashbox'
import AdminGroups from './admin/AdminGroups'
import AdminBroadcasts from './admin/AdminBroadcasts'
import AdminNews from './admin/AdminNews'
import { RequireRole } from './components/RequireRole'
import { useUserRole } from './hooks/useUserRole'

const TG_LOGIN_URL = 'https://momqnoeogfjjexwcwlpu.supabase.co/functions/v1/telegram-login'

function ClientApp({ session }) {
  const [page, setPage] = useState('home')
  const [prevPage, setPrevPage] = useState('home')
  const goTo = (p) => { setPrevPage(page); setPage(p) }
  return (
    <div style={{maxWidth:480, margin:'0 auto', background:'#F8F8F8', minHeight:'100vh', paddingBottom:80, width:'100%', boxSizing:'border-box'}}>
      {page === 'news' && <News session={session} onBack={() => setPage('home')} />}
      {page === 'home' && <Home session={session} onNewsAll={() => goTo('news')} />}
      {page === 'schedule' && <Schedule session={session} />}
      {page === 'shop' && <Shop session={session} />}
      {page === 'profile' && <Profile session={session} />}
      <BottomNav active={page} onChange={setPage} />
    </div>
  )
}

function RootRedirect({ session }) {
  const { role, loading } = useUserRole(session)
  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F8F8F8',fontFamily:'Inter,sans-serif',color:'#BDBDBD'}}>
      Загрузка...
    </div>
  )
  if (role && ['teacher','admin','manager','owner'].includes(role)) {
    return <Navigate to="/admin/dashboard" replace />
  }
  return <ClientApp session={session} />
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F8F8F8',fontFamily:'Inter,sans-serif',color:'#BDBDBD'}}>
      Загрузка...
    </div>
  )

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect session={session} />} />
        <Route path="/admin" element={
          <RequireRole session={session} allow={['teacher','admin','manager','owner']}>
            <AdminLayout session={session} />
          </RequireRole>
        }>
          <Route path="dashboard" element={<AdminDashboard session={session} />} />
          <Route path="clients" element={<RequireRole session={session} allow={['admin','manager','owner']}><AdminClients /></RequireRole>} />
          <Route path="clients/:id" element={<RequireRole session={session} allow={['admin','manager','owner']}><AdminClientCard session={session} /></RequireRole>} />
          <Route path="tasks" element={<AdminTasks session={session} />} />
          <Route path="catalog" element={<RequireRole session={session} allow={['admin','manager','owner']}><AdminCatalog /></RequireRole>} />
          <Route path="schedule" element={<AdminSchedule session={session} />} />
          <Route path="staff" element={<RequireRole session={session} allow={['admin','manager','owner']}><AdminStaff /></RequireRole>} />
          <Route path="staff/:id" element={<RequireRole session={session} allow={['admin','manager','owner']}><AdminStaffCard session={session} /></RequireRole>} />
          <Route path="finance" element={<RequireRole session={session} allow={['owner']}><AdminFinance session={session} /></RequireRole>} />
          <Route path="cashbox" element={<RequireRole session={session} allow={['admin','manager','owner']}><AdminCashbox session={session} /></RequireRole>} />
          <Route path="groups" element={<RequireRole session={session} allow={['admin','manager','owner']}><AdminGroups session={session} /></RequireRole>} />
          <Route path="broadcasts" element={<RequireRole session={session} allow={['admin','manager','owner']}><AdminBroadcasts session={session} /></RequireRole>} />
          <Route path="news" element={<RequireRole session={session} allow={['admin','manager','owner']}><AdminNews session={session} /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

// ─── Экран входа ─────────────────────────────────────────────────────────────

function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState('password')
  const [magicSent, setMagicSent] = useState(false)

  const [tgStep, setTgStep] = useState('idle') // idle | waiting | needs_link
  const [tgCode, setTgCode] = useState('')
  const [tgData, setTgData] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => { return () => stopPolling() }, [])

  const stopPolling = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  const cancelTg = () => {
    stopPolling()
    setTgStep('idle'); setTgCode(''); setTgData(null); setError('')
  }

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Неверный email или пароль')
    setLoading(false)
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email) { setError('Введите email'); return }
    setLoading(true); setError('')
    const STAFF_EMAILS = ['sokolov-ruslan2014@ya.ru', 'syuziedancer@mail.ru']
    if (STAFF_EMAILS.includes(email.toLowerCase())) {
      setError('Сотрудники входят только по паролю'); setLoading(false); return
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    if (error) setError('Ошибка отправки. Проверьте email.')
    else setMagicSent(true)
    setLoading(false)
  }

  const handleTelegramLogin = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${TG_LOGIN_URL}?action=generate`)
      const data = await res.json()
      if (!data.code) throw new Error('no code')
      setTgCode(data.code)
      setTgStep('waiting')

      intervalRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${TG_LOGIN_URL}?action=check&code=${data.code}`)
          const result = await r.json()
          if (result.verified && result.session) {
            stopPolling()
            await supabase.auth.setSession(result.session)
          } else if (result.verified && result.needs_link) {
            stopPolling()
            setTgData(result)
            setTgStep('needs_link')
          }
        } catch (_) {}
      }, 2000)

      setTimeout(() => {
        if (intervalRef.current) { stopPolling(); setTgStep('idle'); setError('Время ожидания истекло. Попробуй снова.') }
      }, 10 * 60 * 1000)
    } catch (_) {
      setError('Ошибка соединения. Попробуй снова.')
    }
    setLoading(false)
  }

  const handlePhoneLink = async (e) => {
    e.preventDefault()
    if (!phone.trim()) { setError('Введите номер телефона'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${TG_LOGIN_URL}?action=link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: tgData.code, phone: phone.trim() })
      })
      const result = await res.json()
      if (result.linked && result.session) {
        await supabase.auth.setSession(result.session)
      } else if (result.error === 'not_found') {
        setError('Номер не найден. Обратитесь в студию или войдите по email.')
      } else if (result.error === 'code_expired') {
        setError('Сессия истекла. Начни сначала.'); cancelTg()
      } else {
        setError('Что-то пошло не так. Попробуй снова.')
      }
    } catch (_) { setError('Ошибка соединения.') }
    setLoading(false)
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#F8F8F8',fontFamily:'Inter,sans-serif',padding:16}}>
      <div style={{background:'#fff',borderRadius:24,padding:40,width:'100%',maxWidth:360,border:'1px solid #f0f0f0',boxSizing:'border-box'}}>

        <div style={{marginBottom:32,textAlign:'center'}}>
          <div style={{width:48,height:48,border:'2px dashed #BDBDBD',borderRadius:12,margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center',color:'#BDBDBD',fontSize:20}}>+</div>
          <div style={{fontFamily:'sans-serif',fontSize:22,fontWeight:300,color:'#2a2a2a'}}>SDT</div>
          <div style={{fontSize:12,color:'#BDBDBD',marginTop:4}}>Войдите в аккаунт</div>
        </div>

        {/* Magic Link — письмо отправлено */}
        {magicSent && (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:16}}>📬</div>
            <div style={{fontSize:15,fontWeight:600,color:'#2a2a2a',marginBottom:8}}>Письмо отправлено!</div>
            <div style={{fontSize:13,color:'#888',marginBottom:24}}>Проверьте почту {email} и нажмите на ссылку для входа</div>
            <button onClick={() => { setMagicSent(false); setEmail('') }}
              style={{background:'none',border:'none',color:'#2980b9',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Отправить снова
            </button>
          </div>
        )}

        {/* Telegram — ожидание */}
        {!magicSent && tgStep === 'waiting' && (
          <div>
            <div style={{background:'#e8f4fd',borderRadius:16,padding:20,textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:11,color:'#555',marginBottom:6}}>Твой код для входа</div>
              <div style={{fontSize:36,fontWeight:700,color:'#229ED9',letterSpacing:8,marginBottom:12}}>{tgCode}</div>
              <div style={{fontSize:13,color:'#2a2a2a',marginBottom:12}}>Открой бота и отправь ему этот код:</div>
              <a href="https://t.me/sdt_auth_bot" target="_blank" rel="noreferrer"
                style={{display:'inline-block',background:'#229ED9',color:'#fff',borderRadius:10,padding:'10px 20px',fontSize:14,fontWeight:700,textDecoration:'none'}}>
                ✈️ @sdt_auth_bot
              </a>
              <div style={{fontSize:11,color:'#888',marginTop:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#27ae60',display:'inline-block',animation:'pulse 1.5s infinite'}} />
                Ожидаем подтверждения...
              </div>
            </div>
            <button onClick={cancelTg}
              style={{width:'100%',background:'none',border:'1px solid #e8e8e8',borderRadius:10,padding:'10px',fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Отмена
            </button>
          </div>
        )}

        {/* Telegram — привязка по телефону */}
        {!magicSent && tgStep === 'needs_link' && (
          <div>
            <div style={{background:'#fff8e1',borderRadius:16,padding:16,marginBottom:16,textAlign:'center'}}>
              <div style={{fontSize:24,marginBottom:8}}>📱</div>
              <div style={{fontSize:14,fontWeight:600,color:'#2a2a2a',marginBottom:4}}>
                Привет{tgData?.telegram_name ? `, ${tgData.telegram_name}` : ''}!
              </div>
              <div style={{fontSize:12,color:'#666'}}>
                Telegram ещё не привязан. Введи номер телефона, который указан в студии:
              </div>
            </div>
            <form onSubmit={handlePhoneLink}>
              <input type="tel" placeholder="+7 999 123 45 67" value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',borderRadius:12,fontSize:14,marginBottom:12,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}}
              />
              {error && <div style={{color:'#e74c3c',fontSize:12,marginBottom:12}}>{error}</div>}
              <button type="submit" disabled={loading}
                style={{width:'100%',padding:'13px',background:'#BFD900',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:8,opacity:loading?0.7:1}}>
                {loading ? 'Проверяем...' : '✅ Привязать и войти'}
              </button>
              <button type="button" onClick={cancelTg}
                style={{width:'100%',background:'none',border:'1px solid #e8e8e8',borderRadius:10,padding:'10px',fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                Назад
              </button>
            </form>
          </div>
        )}

        {/* Основной экран */}
        {!magicSent && tgStep === 'idle' && (
          <>
            <button onClick={handleTelegramLogin} disabled={loading}
              style={{width:'100%',padding:'13px',background:'#229ED9',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:loading?0.7:1}}>
              ✈️ Войти через Telegram
            </button>

            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <div style={{flex:1,height:1,background:'#e8e8e8'}} />
              <span style={{fontSize:11,color:'#BDBDBD'}}>или</span>
              <div style={{flex:1,height:1,background:'#e8e8e8'}} />
            </div>

            <div style={{display:'flex',background:'#f5f5f5',borderRadius:10,padding:3,marginBottom:20}}>
              <button onClick={() => { setMode('password'); setError('') }}
                style={{flex:1,padding:'8px',border:'none',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',background:mode==='password'?'#fff':'transparent',color:mode==='password'?'#2a2a2a':'#888',fontWeight:mode==='password'?600:400}}>
                🔑 Пароль
              </button>
              <button onClick={() => { setMode('magic'); setError('') }}
                style={{flex:1,padding:'8px',border:'none',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',background:mode==='magic'?'#fff':'transparent',color:mode==='magic'?'#2a2a2a':'#888',fontWeight:mode==='magic'?600:400}}>
                ✉️ Magic Link
              </button>
            </div>

            <form onSubmit={mode === 'password' ? handleLogin : handleMagicLink}>
              <input type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)}
                style={{width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',borderRadius:12,fontSize:14,marginBottom:10,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}}
              />
              {mode === 'password' && (
                <input type="password" placeholder="Пароль" value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',borderRadius:12,fontSize:14,marginBottom:16,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}}
                />
              )}
              {mode === 'magic' && (
                <div style={{fontSize:12,color:'#888',marginBottom:16,background:'#f9f9f9',borderRadius:10,padding:'10px 12px'}}>
                  📩 Пришлём ссылку — вход в один клик
                </div>
              )}
              {error && <div style={{color:'#e74c3c',fontSize:12,marginBottom:12}}>{error}</div>}
              <button type="submit" disabled={loading}
                style={{width:'100%',padding:'13px',background:'#BFD900',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:loading?0.7:1}}>
                {loading ? 'Входим...' : mode === 'password' ? 'Войти' : '✉️ Отправить ссылку'}
              </button>
            </form>
          </>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}

export default App