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
    return <Navigate to="/" replace />
  }

  return children
}