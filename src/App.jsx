import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import Shop from './pages/Shop'
import Profile from './pages/Profile'
import BottomNav from './components/BottomNav'
import AdminLayout from './admin/AdminLayout'
import AdminDashboard from './admin/AdminDashboard'
import AdminClients from './admin/AdminClients'
import AdminClientCard from './admin/AdminClientCard'
import AdminTasks from './admin/AdminTasks'
import AdminCatalog from './admin/AdminCatalog'
import AdminSchedule from './admin/AdminSchedule'
import { RequireRole } from './components/RequireRole'
import { useUserRole } from './hooks/useUserRole'

function ClientApp({ session }) {
  const [page, setPage] = useState('home')
  return (
    <div style={{maxWidth:480, margin:'0 auto', background:'#F8F8F8', minHeight:'100vh', paddingBottom:80}}>
      {page === 'home' && <Home session={session} />}
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
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="clients/:id" element={<AdminClientCard session={session} />} />
          <Route path="tasks" element={<AdminTasks session={session} />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="schedule" element={<AdminSchedule session={session} />} />
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

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Неверный email или пароль')
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
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',borderRadius:12,fontSize:14,marginBottom:10,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}}
          />
          <input type="password" placeholder="Пароль" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',borderRadius:12,fontSize:14,marginBottom:16,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}}
          />
          {error && <div style={{color:'#e74c3c',fontSize:12,marginBottom:12}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'13px',background:'#BFD900',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default App