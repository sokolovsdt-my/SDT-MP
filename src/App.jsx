import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import BottomNav from './components/BottomNav'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('home')

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
    <div style={{maxWidth:480, margin:'0 auto', background:'#F8F8F8', minHeight:'100vh', paddingBottom:80}}>
      {page === 'home' && <Home session={session} />}
      {page === 'schedule' && <Schedule session={session} />}
      {page === 'shop' && <div style={{padding:20, fontFamily:'Inter,sans-serif'}}>Магазин — скоро</div>}
      {page === 'profile' && <div style={{padding:20, fontFamily:'Inter,sans-serif'}}>Профиль — скоро</div>}
      <BottomNav active={page} onChange={setPage} />
    </div>
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
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',borderRadius:12,fontSize:14,marginBottom:10,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{width:'100%',padding:'12px 14px',border:'1px solid #e8e8e8',borderRadius:12,fontSize:14,marginBottom:16,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}}
          />
          {error && <div style={{color:'#e74c3c',fontSize:12,marginBottom:12}}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{width:'100%',padding:'13px',background:'#BFD900',border:'none',borderRadius:12,fontSize:14,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default App