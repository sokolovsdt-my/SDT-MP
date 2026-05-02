import { Navigate } from 'react-router-dom'
import { useUserRole } from '../hooks/useUserRole'

export function RequireRole({ session, allow, children }) {
  const { role, loading } = useUserRole(session)

  if (loading) {
    return (
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'center',
        height:'100vh', background:'#F8F8F8',
        fontFamily:'Inter,sans-serif', color:'#BDBDBD'
      }}>
        Проверка доступа...
      </div>
    )
  }

 if (!role || !allow.includes(role)) {
    return (
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'60vh', fontFamily:'Inter,sans-serif', textAlign:'center'
      }}>
        <div style={{fontSize:48, marginBottom:16}}>🔒</div>
        <div style={{fontSize:20, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>Нет доступа</div>
        <div style={{fontSize:14, color:'#888'}}>У вас недостаточно прав для просмотра этого раздела</div>
      </div>
    )
  }

  return children
}