import { useState, useEffect } from 'react'
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

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('password') // 'password' | 'magic'
  const [magicSent, setMagicSent] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Неверный email или пароль')
    setLoading(false)
  }
const handleTelegramAuth = async (tgData) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('https://momqnoeogfjjexwcwlpu.supabase.co/functions/v1/telegram-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tgData)
      })
      const data = await res.json()
      if (!res.ok) { setError('Ошибка Telegram авторизации'); setLoading(false); return }
      await supabase.auth.setSession(data.session)
    } catch {
      setError('Ошибка соединения')
    }
    setLoading(false)
  }

  useEffect(() => {
    window.onTelegramAuth = handleTelegramAuth

    // Загружаем Telegram виджет динамически
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', 'sdt_auth_bot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '12')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true

    const container = document.getElementById('telegram-login-btn')
    if (container) {
      container.innerHTML = ''
      container.appendChild(script)
    }
  }, [])

  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email) { setError('Введите email'); return }
    setLoading(true)
    setError('')
    const STAFF_EMAILS = ['sokolov-ruslan2014@ya.ru', 'syuziedancer@mail.ru']
    if (STAFF_EMAILS.includes(email.toLowerCase())) {
      setError('Сотрудники входят только по паролю')
      setLoading(false)
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }
    })
    if (error) {
      setError('Ошибка отправки. Проверьте email.')
    } else {
      setMagicSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F8F8F8',fontFamily:'Inter,sans-serif'}}>
      <div style={{background:'#fff',borderRadius:24,padding:40,width:340,border:'1px solid #f0f0f0'}}>
        <div style={{marginBottom:32,textAlign:'center'}}>
          <div style={{width:48,height:48,border:'2px dashed #BDBDBD',borderRadius:12,margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center',color:'#BDBDBD',fontSize:20}}>+</div>
          <div style={{fontFamily:'sans-serif',fontSize:22,fontWeight:300,color:'#2a2a2a'}}>SDT</div>
          <div style={{fontSize:12,color:'#BDBDBD',marginTop:4}}>Войдите в аккаунт</div>
        </div>

        {magicSent ? (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:16}}>📬</div>
            <div style={{fontSize:15,fontWeight:600,color:'#2a2a2a',marginBottom:8}}>Письмо отправлено!</div>
            <div style={{fontSize:13,color:'#888',marginBottom:24}}>Проверьте почту {email} и нажмите на ссылку для входа</div>
            <button onClick={() => { setMagicSent(false); setEmail('') }}
              style={{background:'none',border:'none',color:'#2980b9',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Отправить снова
            </button>
          </div>
        ) : (
          <>
            {/* Переключатель режима */}
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

{/* Telegram кнопка */}
            <div style={{marginBottom:16, display:'flex', flexDirection:'column', alignItems:'center'}}>
              <div id="telegram-login-btn" style={{display:'flex', justifyContent:'center'}} />
              <div style={{display:'flex', alignItems:'center', gap:8, margin:'12px 0', width:'100%'}}>
                <div style={{flex:1, height:1, background:'#e8e8e8'}} />
                <span style={{fontSize:11, color:'#BDBDBD'}}>или</span>
                <div style={{flex:1, height:1, background:'#e8e8e8'}} />
              </div>
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
                style={{width:'100%',padding:'13px',background:'#BFD900',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                {loading ? 'Отправляем...' : mode === 'password' ? 'Войти' : '✉️ Отправить ссылку'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default App