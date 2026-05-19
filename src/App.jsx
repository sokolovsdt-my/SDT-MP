import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import Shop from './pages/Shop'
import News from './pages/News'
import Profile from './pages/Profile'
import Bonus from './pages/Bonus'
import Team from './pages/Team'
import BottomNav from './components/BottomNav'
// Админ/teacher страницы — lazy: клиентская мобилка не должна тянуть
// ~7000 строк админ-кода. Грузится по требованию при роутинге на /admin/* или /teacher.
const AdminLayout      = lazy(() => import('./admin/AdminLayout'))
const AdminDashboard   = lazy(() => import('./admin/AdminDashboard'))
const AdminClients     = lazy(() => import('./admin/AdminClients'))
const AdminClientCard  = lazy(() => import('./admin/AdminClientCard'))
const AdminTasks       = lazy(() => import('./admin/AdminTasks'))
const AdminCatalog     = lazy(() => import('./admin/AdminCatalog'))
const AdminSchedule    = lazy(() => import('./admin/AdminSchedule'))
const AdminStaff       = lazy(() => import('./admin/AdminStaff'))
const AdminStaffCard   = lazy(() => import('./admin/AdminStaffCard'))
const AdminFinance     = lazy(() => import('./admin/AdminFinance'))
const AdminCashbox     = lazy(() => import('./admin/AdminCashbox'))
const AdminGroups      = lazy(() => import('./admin/AdminGroups'))
const AdminBroadcasts  = lazy(() => import('./admin/AdminBroadcasts'))
const AdminNews        = lazy(() => import('./admin/AdminNews'))
const AdminPrizes      = lazy(() => import('./admin/AdminPrizes'))
const TeacherPanel     = lazy(() => import('./admin/TeacherPanel'))
import { RequireRole } from './components/RequireRole'
import { RequireSubRole } from './components/RequireSubRole'
import { useUserRole } from './hooks/useUserRole'
import { edgeUrl } from './utils/supabaseEdge'

const TG_LOGIN_URL = edgeUrl('telegram-login')

function ClientApp({ session }) {
  const [page, setPage] = useState(() => localStorage.getItem('activePage') || 'home')

  const goTo = (p) => {
    setPage(p)
    localStorage.setItem('activePage', p)
  }

  return (
    <div style={{maxWidth:480,margin:'0 auto',background:'#F8F8F8',minHeight:'100vh',paddingBottom:80,width:'100%',boxSizing:'border-box'}}>
      {page==='home'     && <Home     session={session} onNewsAll={() => goTo('news')} onTeam={() => goTo('team')} onBonus={() => goTo('bonus')} />}
      {page==='schedule' && <Schedule session={session} onShop={() => { localStorage.setItem('shop_cat', 'events'); goTo('shop') }} />}
      {page==='shop'     && <Shop     session={session} onTeam={() => goTo('team')} />}
      {page==='news'     && <News     session={session} onBack={() => goTo('home')} />}
      {page==='bonus'    && <Bonus    session={session} />}
      {page==='team'     && <Team     session={session} />}
      {page==='profile'  && <Profile  session={session} />}
      <BottomNav active={page} onChange={goTo} />
    </div>
  )
}

function RootRedirect({ session }) {
  const { role, loading, error } = useUserRole(session)
  if (loading) return <Loader />
  if (error) return <AuthError />
  if (role === 'teacher') return <Navigate to="/teacher" replace />
  if (role && ['admin','manager','owner'].includes(role))
    return <Navigate to="/admin/dashboard" replace />
  return <ClientApp session={session} />
}

function Loader() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F8F8F8',fontFamily:'Inter,sans-serif',color:'#BDBDBD'}}>
      Загрузка...
    </div>
  )
}

function AuthError() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F8F8F8',fontFamily:'Inter,sans-serif',padding:16,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
      <div style={{fontSize:18,fontWeight:600,color:'#2a2a2a',marginBottom:8}}>Не удалось проверить доступ</div>
      <div style={{fontSize:13,color:'#888',marginBottom:24,maxWidth:320}}>Проблема с подключением к серверу. Обновите страницу.</div>
      <button onClick={() => window.location.reload()}
        style={{padding:'12px 24px',background:'#BFD900',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
        Обновить
      </button>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // Первичная загрузка сессии. Если onAuthStateChange успел стрельнуть
    // раньше с реальным значением, не затираем его устаревшим snapshot'ом.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setSession(prev => prev ?? session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION дублирует getSession() — игнорируем, иначе при гонке
      // более старое значение может затереть свежее.
      if (event === 'INITIAL_SESSION') return
      setSession(session)
    })
    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [])

  if (loading) return <Loader />
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<RootRedirect session={session} />} />
          <Route path="/admin" element={
            <RequireRole session={session} allow={['teacher','admin','manager','owner']}>
              <AdminLayout session={session} />
            </RequireRole>
          }>
            <Route path="dashboard" element={<AdminDashboard session={session} />} />
            <Route path="clients" element={<RequireSubRole allow={['admin','manager','owner']}><AdminClients /></RequireSubRole>} />
            <Route path="clients/:id" element={<RequireSubRole allow={['admin','manager','owner']}><AdminClientCard session={session} /></RequireSubRole>} />
            <Route path="tasks" element={<AdminTasks session={session} />} />
            <Route path="catalog" element={<RequireSubRole allow={['admin','manager','owner']}><AdminCatalog /></RequireSubRole>} />
            <Route path="schedule" element={<AdminSchedule session={session} />} />
            <Route path="staff" element={<RequireSubRole allow={['admin','manager','owner']}><AdminStaff /></RequireSubRole>} />
            <Route path="staff/:id" element={<RequireSubRole allow={['admin','manager','owner']}><AdminStaffCard session={session} /></RequireSubRole>} />
            <Route path="finance" element={<RequireSubRole allow={['owner']}><AdminFinance session={session} /></RequireSubRole>} />
            <Route path="cashbox" element={<RequireSubRole allow={['admin','manager','owner']}><AdminCashbox session={session} /></RequireSubRole>} />
            <Route path="groups" element={<RequireSubRole allow={['admin','manager','owner']}><AdminGroups session={session} /></RequireSubRole>} />
            <Route path="broadcasts" element={<RequireSubRole allow={['admin','manager','owner']}><AdminBroadcasts session={session} /></RequireSubRole>} />
            <Route path="news" element={<RequireSubRole allow={['admin','manager','owner']}><AdminNews session={session} /></RequireSubRole>} />
            <Route path="prizes" element={<RequireSubRole allow={['admin','manager','owner']}><AdminPrizes session={session} /></RequireSubRole>} />
          </Route>
          <Route path="/teacher" element={
            <RequireRole session={session} allow={['teacher','admin','manager','owner']}>
              <TeacherPanel session={session} />
            </RequireRole>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────

const STEP_LABELS = {
  awaiting_phone_contact: '📱 Поделись номером телефона в боте',
  awaiting_name:          '✍️ Введи ФИО в боте',
  awaiting_birthdate:     '🎂 Введи дату рождения в боте',
  awaiting_email:         '📧 Введи email в боте (или «пропустить»)',
}

async function loginWithToken(hashed_token, setError) {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: hashed_token,
    type: 'magiclink'
  })
  if (error) setError('Ошибка входа: ' + error.message)
}

function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState('password')
  const [magicSent, setMagicSent] = useState(false)
  const [tgStep, setTgStep]     = useState('idle')
  const [tgCode, setTgCode]     = useState('')
  const [regStep, setRegStep]   = useState('')
  const [copied, setCopied]     = useState(false)
  const intervalRef             = useRef(null)
  const timeoutRef              = useRef(null)

  useEffect(() => () => stopPolling(), [])

  const stopPolling = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null }
  }

  const cancelTg = () => {
    stopPolling()
    setTgStep('idle'); setTgCode(''); setRegStep(''); setError('')
  }

  const copyCode = () => {
    navigator.clipboard.writeText(tgCode).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
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
    // STAFF-whitelist теперь в БД (public.staff_whitelist) — единый источник
    // правды. Серверный гард: триггер profiles_staff_password_check блокирует
    // создание профиля для whitelisted email без пароля в auth.users.
    // UI-проверка ниже даёт понятную ошибку до отправки OTP.
    const { data: row } = await supabase
      .from('staff_whitelist')
      .select('email')
      .ilike('email', email.trim())
      .maybeSingle()
    if (row) {
      setError('Сотрудники входят только по паролю'); setLoading(false); return
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    if (error) setError('Ошибка. Проверьте email.')
    else setMagicSent(true)
    setLoading(false)
  }

  const handleTelegramLogin = async () => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${TG_LOGIN_URL}?action=generate`)
      const data = await res.json()
      if (!data.code) throw new Error()
      setTgCode(data.code)
      setTgStep('waiting')

      intervalRef.current = setInterval(async () => {
        try {
          const r      = await fetch(`${TG_LOGIN_URL}?action=check&code=${data.code}`)
          const result = await r.json()
          if (result.verified && result.hashed_token) {
            stopPolling()
            await loginWithToken(result.hashed_token, setError)
          } else if (result.registering) {
            setTgStep('registering')
            setRegStep(result.step || '')
          } else if (result.expired) {
            stopPolling(); setTgStep('idle')
            setError('Время ожидания истекло. Попробуй снова.')
          }
        } catch (_) {}
      }, 2000)

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        if (intervalRef.current) {
          stopPolling(); setTgStep('idle')
          setError('Время ожидания истекло. Попробуй снова.')
        }
      }, 10 * 60 * 1000)
    } catch (_) {
      setError('Ошибка соединения. Попробуй снова.')
    }
    setLoading(false)
  }

  const handleManualCheck = async () => {
    setError('')
    try {
      const r = await fetch(`${TG_LOGIN_URL}?action=check&code=${tgCode}`)
      const result = await r.json()
      if (result.verified && result.hashed_token) {
        stopPolling()
        await loginWithToken(result.hashed_token, setError)
      } else {
        setError('Регистрация ещё не завершена. Заполни все данные в боте.')
      }
    } catch (_) { setError('Ошибка соединения.') }
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#F8F8F8',fontFamily:'Inter,sans-serif',padding:16}}>
      <div style={{background:'#fff',borderRadius:24,padding:40,width:'100%',maxWidth:360,border:'1px solid #f0f0f0',boxSizing:'border-box'}}>
        <div style={{marginBottom:32,textAlign:'center'}}>
          <div style={{width:48,height:48,border:'2px dashed #BDBDBD',borderRadius:12,margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center',color:'#BDBDBD',fontSize:20}}>+</div>
          <div style={{fontFamily:'sans-serif',fontSize:22,fontWeight:300,color:'#2a2a2a'}}>SDT</div>
          <div style={{fontSize:12,color:'#BDBDBD',marginTop:4}}>Войдите в аккаунт</div>
        </div>

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

        {!magicSent && tgStep === 'waiting' && (
          <div>
            <div style={{background:'#e8f4fd',borderRadius:16,padding:20,textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:11,color:'#555',marginBottom:6}}>Твой код для входа</div>
              <div onClick={copyCode}
                style={{fontSize:36,fontWeight:700,color:'#229ED9',letterSpacing:8,marginBottom:4,cursor:'pointer',userSelect:'none'}}>
                {tgCode}
              </div>
              <div style={{fontSize:11,color:copied?'#27ae60':'#888',marginBottom:12,transition:'color 0.2s'}}>
                {copied ? '✅ Скопировано!' : 'Нажми на код чтобы скопировать'}
              </div>
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

        {!magicSent && tgStep === 'registering' && (
          <div>
            <div style={{background:'#f0f9f0',borderRadius:16,padding:20,textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:32,marginBottom:12}}>🤖</div>
              <div style={{fontSize:14,fontWeight:600,color:'#2a2a2a',marginBottom:8}}>Заполни данные в боте</div>
              {regStep && STEP_LABELS[regStep] && (
                <div style={{background:'#229ED9',color:'#fff',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:600,marginBottom:12,display:'inline-block'}}>
                  {STEP_LABELS[regStep]}
                </div>
              )}
              <div style={{fontSize:13,color:'#555',lineHeight:1.6,marginBottom:12}}>
                После заполнения всех данных <b>вернись сюда</b> — войдёшь автоматически.
              </div>
              <a href="https://t.me/sdt_auth_bot" target="_blank" rel="noreferrer"
                style={{display:'inline-block',background:'#229ED9',color:'#fff',borderRadius:10,padding:'10px 20px',fontSize:14,fontWeight:700,textDecoration:'none',marginBottom:8}}>
                ✈️ Открыть бота
              </a>
              <div style={{fontSize:11,color:'#888',marginTop:8,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#f39c12',display:'inline-block',animation:'pulse 1.5s infinite'}} />
                Ждём завершения регистрации...
              </div>
            </div>
            {error && <div style={{color:'#e74c3c',fontSize:12,marginBottom:12}}>{error}</div>}
            <button onClick={handleManualCheck}
              style={{width:'100%',padding:'13px',background:'#BFD900',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:8}}>
              ✅ Я всё заполнил → Войти
            </button>
            <button onClick={cancelTg}
              style={{width:'100%',background:'none',border:'1px solid #e8e8e8',borderRadius:10,padding:'10px',fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Отмена
            </button>
          </div>
        )}

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
            <form onSubmit={mode==='password' ? handleLogin : handleMagicLink}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                style={{width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',borderRadius:12,fontSize:14,marginBottom:10,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}} />
              {mode==='password' && (
                <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)}
                  style={{width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',borderRadius:12,fontSize:14,marginBottom:16,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}} />
              )}
              {mode==='magic' && (
                <div style={{fontSize:12,color:'#888',marginBottom:16,background:'#f9f9f9',borderRadius:10,padding:'10px 12px'}}>
                  📩 Пришлём ссылку — вход в один клик
                </div>
              )}
              {error && <div style={{color:'#e74c3c',fontSize:12,marginBottom:12}}>{error}</div>}
              <button type="submit" disabled={loading}
                style={{width:'100%',padding:'13px',background:'#BFD900',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:loading?0.7:1}}>
                {loading ? 'Входим...' : mode==='password' ? 'Войти' : '✉️ Отправить ссылку'}
              </button>
            </form>
          </>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}

export default App