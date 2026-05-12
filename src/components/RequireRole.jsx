import { useUserRole } from '../hooks/useUserRole'

export function RequireRole({ session, allow, children }) {
  const { role, loading, error } = useUserRole(session)

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

  // Транзитная ошибка проверки — НЕ показываем «Нет доступа», иначе админ
  // при сетевом сбое теряет доступ. Предлагаем обновить страницу.
  if (error) {
    return (
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'60vh', fontFamily:'Inter,sans-serif', textAlign:'center', padding:16
      }}>
        <div style={{fontSize:48, marginBottom:16}}>⚠️</div>
        <div style={{fontSize:20, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>Не удалось проверить доступ</div>
        <div style={{fontSize:14, color:'#888', marginBottom:20, maxWidth:320}}>Проблема с подключением — обновите страницу.</div>
        <button onClick={() => window.location.reload()}
          style={{padding:'10px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          Обновить
        </button>
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