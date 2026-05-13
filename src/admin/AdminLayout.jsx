import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useUserRole } from '../hooks/useUserRole'
import { useState, useEffect } from 'react'

const ROLE_LABELS = {
  teacher: 'Преподаватель',
  admin: 'Администратор',
  manager: 'Управляющий',
  owner: 'Владелец',
}

const ACTIVE_STATUSES = ['new', 'in_progress', 'postponed', 'problem']

export default function AdminLayout({ session }) {
  const { role } = useUserRole(session)
  const navigate = useNavigate()
  const [tasksCount, setTasksCount] = useState(0)
  const [prizesCount, setPrizesCount] = useState(0)
  const [indivCount, setIndivCount] = useState(0)
  const [isAlsoTeacher, setIsAlsoTeacher] = useState(false)

  useEffect(() => {
    if (!session?.user?.id || role === 'teacher') return
    const checkTeacherRole = async () => {
      const { data } = await supabase
        .from('staff_roles')
        .select('role')
        .eq('staff_id', session.user.id)
        .eq('role', 'teacher')
        .maybeSingle()
      setIsAlsoTeacher(!!data)
    }
    checkTeacherRole()
  }, [session, role])

  useEffect(() => {
    if (!session?.user?.id) return
    const fetchCount = async () => {
      const { data } = await supabase
        .from('task_assignees')
        .select('task_id, tasks!inner(status)')
        .eq('user_id', session.user.id)
        .in('tasks.status', ACTIVE_STATUSES)
      setTasksCount(data?.length || 0)
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    window.addEventListener('focus', fetchCount)
    return () => { clearInterval(interval); window.removeEventListener('focus', fetchCount) }
  }, [session])

  useEffect(() => {
    if (!session?.user?.id) return
    const fetchPrizes = async () => {
      const { count } = await supabase.from('prize_requests').select('*', { count:'exact', head:true }).eq('status','pending')
      setPrizesCount(count || 0)
    }
    fetchPrizes()
    const interval = setInterval(fetchPrizes, 30000)
    window.addEventListener('focus', fetchPrizes)
    return () => { clearInterval(interval); window.removeEventListener('focus', fetchPrizes) }
  }, [session])

  useEffect(() => {
    if (!session?.user?.id) return
    const fetchIndivs = async () => {
      const { count } = await supabase.from('indiv_requests').select('*', { count:'exact', head:true }).eq('status','pending')
      setIndivCount(count || 0)
    }
    fetchIndivs()
    const interval = setInterval(fetchIndivs, 30000)
    window.addEventListener('focus', fetchIndivs)
    return () => { clearInterval(interval); window.removeEventListener('focus', fetchIndivs) }
  }, [session])

  const handleLogout = async () => {
    // navigate('/') здесь излишен: signOut вызывает onAuthStateChange в App.jsx,
    // session становится null и весь Router размонтируется в пользу Login.
    await supabase.auth.signOut()
  }

  const menu = [
    { to: '/admin/dashboard',  label: 'Дашборд',    roles: ['teacher','admin','manager','owner'] },
    { to: '/admin/clients',    label: 'Клиенты',    roles: ['admin','manager','owner'] },
    { to: '/admin/schedule',   label: 'Расписание', roles: ['teacher','admin','manager','owner'] },
    { to: '/admin/tasks',      label: 'Задачи',     roles: ['teacher','admin','manager','owner'], badge: tasksCount + indivCount },
    { to: '/admin/cashbox',    label: 'Касса',      roles: ['admin','manager','owner'] },
    { to: '/admin/groups',     label: 'Группы',     roles: ['admin','manager','owner'] },
    { to: '/admin/catalog',    label: 'Каталог',    roles: ['admin','manager','owner'] },
    { to: '/admin/broadcasts', label: 'Рассылки',   roles: ['admin','manager','owner'] },
    { to: '/admin/news',       label: 'Новости',    roles: ['admin','manager','owner'] },
    { to: '/admin/finance',    label: 'Финансы',    roles: ['owner'] },
    { to: '/admin/staff',      label: 'Сотрудники', roles: ['admin','manager','owner'] },
    { to: '/admin/prizes',     label: 'Призы',      roles: ['admin','manager','owner'], badge: prizesCount },
  ].filter(item => role && item.roles.includes(role))

  return (
    <div style={{display:'flex', minHeight:'100vh', fontFamily:'Inter,sans-serif', background:'#F8F8F8'}}>
      <aside style={{width:240, background:'#1f2024', color:'#fff', padding:'24px 0', display:'flex', flexDirection:'column'}}>
        <div style={{padding:'0 24px 24px', borderBottom:'1px solid #2a2b30'}}>
          <div style={{fontSize:20, fontWeight:300, letterSpacing:1}}>SDT</div>
          <div style={{fontSize:11, color:'#888', marginTop:4}}>Админ-панель</div>
        </div>

        <nav style={{flex:1, padding:'16px 12px'}}>
          {menu.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 14px', borderRadius:8,
                color: isActive ? '#1f2024' : '#cfd0d4',
                background: isActive ? '#BFD900' : 'transparent',
                fontSize:14, fontWeight: isActive ? 600 : 400,
                textDecoration:'none', marginBottom:4,
              })}
            >
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span style={{
                  background:'#e74c3c', color:'#fff',
                  borderRadius:10, fontSize:11, fontWeight:700,
                  padding:'1px 7px', minWidth:18, textAlign:'center',
                  lineHeight:'18px',
                }}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{padding:'16px 24px', borderTop:'1px solid #2a2b30', fontSize:12, color:'#888'}}>
          <div style={{color:'#fff', fontSize:13, marginBottom:2, wordBreak:'break-all'}}>
            {session?.user?.email}
          </div>
          <div>{ROLE_LABELS[role] || role}</div>
        </div>
      </aside>

      <div style={{flex:1, display:'flex', flexDirection:'column'}}>
        <header style={{height:64, background:'#fff', borderBottom:'1px solid #ececec', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:12, padding:'0 24px'}}>
          {isAlsoTeacher && (
            <button
              onClick={() => navigate('/teacher')}
              style={{
                padding:'8px 16px', background:'#BFD900', border:'none',
                borderRadius:8, fontSize:13, fontWeight:600,
                color:'#1f2024', cursor:'pointer', fontFamily:'Inter,sans-serif',
              }}
            >
              🎓 Режим преподавателя
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{padding:'8px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, color:'#555', cursor:'pointer', fontFamily:'Inter,sans-serif'}}
          >
            Выйти
          </button>
        </header>
        <main style={{flex:1, padding:'24px 32px', overflow:'auto'}}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}