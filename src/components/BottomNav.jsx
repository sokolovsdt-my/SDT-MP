export default function BottomNav({ active, onChange }) {
  const items = [
    { id: 'home', label: 'Главная', icon: (
      <svg viewBox="0 0 22 22" fill="none" width="22" height="22">
        <path d="M3 9.5L11 3L19 9.5V19H14V14H8V19H3V9.5Z" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    )},
    { id: 'schedule', label: 'Расписание', icon: (
      <svg viewBox="0 0 22 22" fill="none" width="22" height="22">
        <rect x="3" y="4" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 2V6M15 2V6M3 9H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'shop', label: 'Магазин', icon: (
      <svg viewBox="0 0 22 22" fill="none" width="22" height="22">
        <path d="M4 4H5.5L8 14H16L18 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="9" cy="17" r="1.2" fill="currentColor"/>
        <circle cx="15" cy="17" r="1.2" fill="currentColor"/>
      </svg>
    )},
    { id: 'news', label: 'Новости', icon: (
      <svg viewBox="0 0 22 22" fill="none" width="22" height="22">
        <rect x="3" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 9H15M7 12H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'profile', label: 'Профиль', icon: (
      <svg viewBox="0 0 22 22" fill="none" width="22" height="22">
        <circle cx="11" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 19C3 15.686 6.686 13 11 13C15.314 13 19 15.686 19 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )},
  ]

  return (
    <div style={{
      position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
      width:'100%', maxWidth:480, background:'#fff',
      borderTop:'1px solid #f0f0f0', display:'flex',
      justifyContent:'space-around', padding:'14px 10px 20px',
      fontFamily:'Inter,sans-serif', zIndex:100
    }}>
      {items.map(item => (
        <div key={item.id} onClick={() => onChange(item.id)}
          style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', color: active === item.id ? '#6a7700' : '#BDBDBD'}}>
          {item.icon}
          <span style={{fontSize:9, letterSpacing:'0.05em', textTransform:'uppercase'}}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}