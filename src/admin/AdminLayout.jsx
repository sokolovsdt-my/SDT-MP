import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useUserRole } from '../hooks/useUserRole'

const ROLE_LABELS = {
  teacher: 'Преподаватель',
  admin: 'Администратор',
  manager: 'Управляющий',
  owner: 'Владелец',
}

export default function AdminLayout({ session }) {
  const { role } = useUserRole(session)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const menu = [
    { to: '/admin/dashboard',  label: 'Дашборд',    roles: ['teacher','admin','manager','owner'] },
    { to: '/admin/clients',    label: 'Клиенты',    roles: ['admin','manager','owner'] },
    { to: '/admin/schedule',   label: 'Расписание', roles: ['teacher','admin','manager','owner'] },
    { to: '/admin/tasks',      label: 'Задачи',     roles: ['teacher','admin','manager','owner'] },
    { to: '/admin/cashbox',    label: 'Касса',      roles: ['admin','manager','owner'] },
    { to: '/admin/catalog',    label: 'Каталог',    roles: ['admin','manager','owner'] },
    { to: '/admin/broadcasts', label: 'Рассылки',   roles: ['admin','manager','owner'] },
    { to: '/admin/finance',    label: 'Финансы',    roles: ['owner'] },
    { to: '/admin/staff',      label: 'Сотрудники', roles: ['manager','owner'] },
  ].filter(item => role && item.roles.includes(role))

  return (
    <div style={{display:'flex', minHeight:'100vh', fontFamily:'Inter,sans-serif', background:'#F8F8F8'}}>
      <aside style={{
        width:240, background:'#1f2024', color:'#fff',
        padding:'24px 0', display:'flex', flexDirection:'column'
      }}>
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
                display:'block',
                padding:'10px 14px',
                borderRadius:8,
                color: isActive ? '#1f2024' : '#cfd0d4',
                background: isActive ? '#BFD900' : 'transparent',
                fontSize:14,
                fontWeight: isActive ? 600 : 400,
                textDecoration:'none',
                marginBottom:4,
              })}
            >
              {item.label}
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
        <header style={{
          height:64, background:'#fff', borderBottom:'1px solid #ececec',
          display:'flex', alignItems:'center', justifyContent:'flex-end',
          padding:'0 24px',
        }}>
          <button
            onClick={handleLogout}
            style={{
              padding:'8px 16px', background:'transparent',
              border:'1px solid #e0e0e0', borderRadius:8,
              fontSize:13, color:'#555', cursor:'pointer',
              fontFamily:'Inter,sans-serif'
            }}
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