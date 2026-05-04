import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import AvatarUpload from '../components/AvatarUpload'
import { requestPermission } from '../firebase'

function MyLessons({ session, onBack }) {
  const [tab, setTab] = useState(() => localStorage.getItem('lessons_tab') || 'upcoming')
const goTab = (t) => { setTab(t); localStorage.setItem('lessons_tab', t) }
  const [upcoming, setUpcoming] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, schedule:schedule_id(id, title, starts_at, ends_at, hall, is_cancelled, groups(name), teacher:profiles!schedule_teacher_id_fkey(full_name)), attendance(basis, status)')
      .eq('student_id', session.user.id)
      .neq('status', 'cancelled')

    const now = new Date()
    setUpcoming(
      (bookings || [])
        .filter(b => b.schedule && new Date(b.schedule.starts_at) >= now)
        .sort((a, b) => new Date(a.schedule.starts_at) - new Date(b.schedule.starts_at))
    )
    setHistory(
      (bookings || [])
        .filter(b => b.schedule && new Date(b.schedule.starts_at) < now)
        .sort((a, b) => new Date(b.schedule.starts_at) - new Date(a.schedule.starts_at))
        .slice(0, 30)
    )
    setLoading(false)
  }

  const handleCancel = async (bookingId) => {
    if (!confirm('Отменить запись на занятие?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
    load()
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const fmtTime = (d) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const isToday = (d) => { const n = new Date(), dd = new Date(d); return dd.getDate() === n.getDate() && dd.getMonth() === n.getMonth() }

  const BASIS = { subscription: 'Абонемент', single: 'Разовое', trial: 'Пробное', indiv: 'Индив', none: '⚠️ Нет основания' }

  return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{display:'flex', alignItems:'center', gap:12, padding:'16px 20px', borderBottom:'1px solid #f0f0f0'}}>
        <div onClick={onBack} style={{cursor:'pointer', color:'#BDBDBD', fontSize:20}}>←</div>
        <div style={{fontSize:16, color:'#2a2a2a', fontWeight:500}}>Мои занятия</div>
      </div>
      <div style={{display:'flex', padding:'0 20px', borderBottom:'1px solid #f0f0f0'}}>
        {[['upcoming','Предстоящие'],['history','История']].map(([v,l]) => (
          <div key={v} onClick={() => goTab(v)} style={{padding:'12px 16px', fontSize:13, cursor:'pointer', color: tab===v?'#2a2a2a':'#BDBDBD', borderBottom: tab===v?'2px solid #BFD900':'2px solid transparent', fontWeight: tab===v?600:400}}>
            {l}
          </div>
        ))}
      </div>
      <div style={{padding:'12px 20px'}}>
        {loading ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
        ) : tab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Нет предстоящих занятий</div>
          ) : upcoming.map(b => {
            const s = b.schedule
            const basis = b.attendance?.[0]?.basis || 'none'
            const isCancelled = s?.is_cancelled
            return (
              <div key={b.id} style={{background:'#fff', borderRadius:14, border: isCancelled?'1px solid #fdecea':'1px solid #f0f0f0', padding:14, marginBottom:10}}>
                {isCancelled && (
                  <div style={{fontSize:11, fontWeight:700, color:'#e74c3c', background:'#fdecea', borderRadius:6, padding:'3px 8px', display:'inline-block', marginBottom:8}}>
                    ✕ Занятие отменено
                  </div>
                )}
                <div style={{fontSize:13, fontWeight:600, color: isCancelled?'#BDBDBD':'#2a2a2a', marginBottom:4, textDecoration: isCancelled?'line-through':'none'}}>
                  {s?.groups?.name || s?.title || 'Занятие'}
                </div>
                <div style={{fontSize:12, color:'#888', marginBottom:4}}>
                  {isToday(s?.starts_at) ? 'Сегодня' : fmtDate(s?.starts_at)} · {fmtTime(s?.starts_at)}–{fmtTime(s?.ends_at)}
                </div>
                {s?.teacher?.full_name && <div style={{fontSize:11, color:'#BDBDBD', marginBottom:2}}>{s.teacher.full_name}</div>}
                {s?.hall && <div style={{fontSize:11, color:'#BDBDBD', marginBottom:8}}>{s.hall}</div>}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span style={{fontSize:11, fontWeight:600, color: basis==='none'?'#e74c3c':'#27ae60', background: basis==='none'?'#fdecea':'#eafaf1', padding:'2px 8px', borderRadius:6}}>
                    {BASIS[basis] || basis}
                  </span>
                  {!isCancelled && (
                    <button onClick={() => handleCancel(b.id)} style={{fontSize:11, color:'#e74c3c', background:'none', border:'1px solid #fdecea', borderRadius:8, padding:'4px 12px', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                      Отменить запись
                    </button>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          history.length === 0 ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>История пуста</div>
          ) : history.map(b => {
            const s = b.schedule
            const status = b.attendance?.[0]?.status
            return (
              <div key={b.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f8f8f8'}}>
                <div>
                  <div style={{fontSize:13, color:'#2a2a2a', fontWeight:500}}>{s?.groups?.name || s?.title || 'Занятие'}</div>
                  <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>{fmtDate(s?.starts_at)} · {fmtTime(s?.starts_at)}</div>
                </div>
                <span style={{fontSize:11, fontWeight:600, color: status==='present'?'#27ae60':status==='absent'?'#e74c3c':'#BDBDBD', background: status==='present'?'#eafaf1':status==='absent'?'#fdecea':'#f5f5f5', padding:'2px 8px', borderRadius:6}}>
                  {status==='present'?'✓ Был':status==='absent'?'✗ Не был':'—'}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function MyStats({ session, onBack }) {
  const [loading, setLoading] = useState(true)
  const [totalLessons, setTotalLessons] = useState(0)
  const [totalHours, setTotalHours] = useState(0)
  const [thisMonth, setThisMonth] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestMonth, setBestMonth] = useState(null)
  const [chartData, setChartData] = useState([])
  const [chartMode, setChartMode] = useState('6months')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: att } = await supabase
      .from('attendance')
      .select('status, marked_at, schedule:schedule_id(starts_at, ends_at)')
      .eq('student_id', session.user.id)
      .order('marked_at', { ascending: false })

    const all = att || []
    const present = all.filter(a => a.status === 'present')

    setTotalLessons(present.length)
    const mins = present.reduce((sum, a) => {
      if (a.schedule?.starts_at && a.schedule?.ends_at)
        return sum + (new Date(a.schedule.ends_at) - new Date(a.schedule.starts_at)) / 60000
      return sum + 90
    }, 0)
    setTotalHours(Math.round(mins / 60))

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    setThisMonth(present.filter(a => new Date(a.marked_at) >= monthStart).length)

    let s = 0
    for (const a of all) { if (a.status === 'present') s++; else break }
    setStreak(s)

    const byMonth = {}
    present.forEach(a => {
      const d = new Date(a.marked_at)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      byMonth[key] = (byMonth[key] || 0) + 1
    })
    const sorted = Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b))

    if (sorted.length > 0) {
      const best = sorted.reduce((a, b) => b[1] > a[1] ? b : a)
      const [y, m] = best[0].split('-')
      const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
      setBestMonth({ label: `${months[parseInt(m)-1]} ${y}`, count: best[1] })
    }
    setChartData(sorted)
    setLoading(false)
  }

  const displayChart = chartMode === '6months' ? chartData.slice(-6) : chartData
  const maxVal = Math.max(...displayChart.map(([,v]) => v), 1)
  const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
  const monthLabel = (key) => MONTHS[parseInt(key.split('-')[1])-1]

  return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{display:'flex', alignItems:'center', gap:12, padding:'16px 20px', borderBottom:'1px solid #f0f0f0'}}>
        <div onClick={onBack} style={{cursor:'pointer', color:'#BDBDBD', fontSize:20}}>←</div>
        <div style={{fontSize:16, color:'#2a2a2a', fontWeight:500}}>Моя статистика</div>
      </div>
      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : (
        <div style={{padding:'16px 20px'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
            <div style={{background:'#fff', borderRadius:14, padding:16, border:'1px solid #f0f0f0', textAlign:'center'}}>
              <div style={{fontSize:28, fontWeight:300, color:'#2a2a2a'}}>{totalLessons}</div>
              <div style={{fontSize:11, color:'#BDBDBD', marginTop:4}}>Занятий всего</div>
            </div>
            <div style={{background:'#fff', borderRadius:14, padding:16, border:'1px solid #f0f0f0', textAlign:'center'}}>
              <div style={{fontSize:28, fontWeight:300, color:'#2a2a2a'}}>{totalHours}</div>
              <div style={{fontSize:11, color:'#BDBDBD', marginTop:4}}>Часов всего</div>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16}}>
            <div style={{background:'#fafde8', borderRadius:14, padding:16, border:'1px solid #e8f0aa', textAlign:'center'}}>
              <div style={{fontSize:28, fontWeight:300, color:'#6a7700'}}>{streak} 🔥</div>
              <div style={{fontSize:11, color:'#8a9900', marginTop:4}}>Серия подряд</div>
            </div>
            <div style={{background:'#fff', borderRadius:14, padding:16, border:'1px solid #f0f0f0', textAlign:'center'}}>
              <div style={{fontSize:28, fontWeight:300, color:'#2a2a2a'}}>{thisMonth}</div>
              <div style={{fontSize:11, color:'#BDBDBD', marginTop:4}}>В этом месяце</div>
            </div>
          </div>
          {chartData.length > 0 && (
            <div style={{background:'#fff', borderRadius:14, padding:16, border:'1px solid #f0f0f0', marginBottom:12}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>По месяцам</div>
                <div style={{display:'flex', background:'#f5f5f5', borderRadius:8, padding:2}}>
                  {[['6months','6 мес'],['all','Всё время']].map(([v,l]) => (
                    <button key={v} onClick={() => setChartMode(v)} style={{padding:'4px 10px', borderRadius:6, border:'none', fontSize:11, cursor:'pointer', fontFamily:'Inter,sans-serif', background: chartMode===v?'#fff':'transparent', color: chartMode===v?'#2a2a2a':'#888', fontWeight: chartMode===v?600:400}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:'flex', alignItems:'flex-end', gap:4, height:80}}>
                {displayChart.map(([key, val]) => (
                  <div key={key} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                    <div style={{width:'100%', background:'#BFD900', borderRadius:'4px 4px 0 0', height: Math.max((val/maxVal)*64, 4), opacity:0.85}} />
                    <div style={{fontSize:9, color:'#BDBDBD'}}>{monthLabel(key)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {bestMonth && (
            <div style={{background:'#fff', borderRadius:14, padding:16, border:'1px solid #f0f0f0'}}>
              <div style={{fontSize:11, color:'#BDBDBD', marginBottom:4}}>⭐ Самый активный месяц</div>
              <div style={{fontSize:16, fontWeight:600, color:'#2a2a2a'}}>{bestMonth.label}</div>
              <div style={{fontSize:12, color:'#888', marginTop:2}}>{bestMonth.count} занятий</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Referral({ session, onBack }) {
  const refLink = `https://sdt-mp.vercel.app?ref=${session.user.id.slice(0,8)}`
  return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{display:'flex', alignItems:'center', gap:12, padding:'16px 20px', borderBottom:'1px solid #f0f0f0'}}>
        <div onClick={onBack} style={{cursor:'pointer', color:'#BDBDBD', fontSize:20}}>←</div>
        <div style={{fontSize:16, color:'#2a2a2a', fontWeight:500}}>Привести друга</div>
      </div>
      <div style={{padding:'16px 20px'}}>
        <div style={{background:'#fafde8', border:'1px solid #BFD900', borderRadius:16, padding:16, marginBottom:16}}>
          <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>Как это работает</div>
          <div style={{fontSize:12, color:'#555', lineHeight:1.7}}>
            Поделитесь ссылкой с другом. Когда он купит абонемент — вы получите <strong>10% от стоимости</strong> на бонусный счёт. Друг тоже получит <strong>10% бонусов</strong> на первый месяц! 🎉
          </div>
        </div>
        <div style={{fontSize:11, color:'#BDBDBD', marginBottom:8}}>Ваша реферальная ссылка</div>
        <div style={{background:'#f9f9f9', borderRadius:12, padding:'12px 14px', fontSize:12, color:'#2a2a2a', marginBottom:12, wordBreak:'break-all'}}>
          {refLink}
        </div>
        <button onClick={() => { navigator.clipboard.writeText(refLink); alert('Ссылка скопирована!') }}
          style={{width:'100%', padding:13, background:'#BFD900', border:'none', borderRadius:12, fontSize:14, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', marginBottom:16}}>
          Скопировать ссылку
        </button>
        <div style={{background:'#fff', border:'1px solid #f0f0f0', borderRadius:16, padding:16}}>
          <div style={{fontSize:13, color:'#2a2a2a', fontWeight:500, marginBottom:8}}>
            🔔 Узнавайте первыми об изменениях в расписании и отменах занятий
          </div>
          <button onClick={async () => {
            const token = await requestPermission()
            if (token) { await supabase.from('profiles').upsert({ id: session.user.id, push_token: token }); alert('Уведомления включены! ✅') }
          }} style={{width:'100%', padding:12, background:'#BFD900', border:'none', borderRadius:12, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            Включить уведомления
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Profile({ session }) {
  const [screen, setScreen] = useState(() => localStorage.getItem('profileScreen') || null)
  const [profile, setProfile] = useState(null)
  const [activeSub, setActiveSub] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [form, setForm] = useState({ last_name:'', first_name:'', patronymic:'', phone:'', birth_date:'', email:'' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Сохраняем экран в localStorage при каждом переходе
  const goScreen = (s) => {
    setScreen(s)
    localStorage.setItem('profileScreen', s || '')
  }

  useEffect(() => { load() }, [session])

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (data) {
      setProfile(data)
      setAvatarUrl(data.avatar_url || null)
      setForm({ last_name:data.last_name||'', first_name:data.first_name||'', patronymic:data.patronymic||'', phone:data.phone||'', birth_date:data.birth_date||'', email:data.email||'' })
    }
    const today = new Date().toISOString().split('T')[0]
    const { data: sub } = await supabase.from('subscriptions')
      .select('*').eq('student_id', session.user.id)
      .gte('expires_at', today).eq('is_frozen', false)
      .order('expires_at', { ascending: true }).limit(1).maybeSingle()
    setActiveSub(sub || null)
  }

  const handleSave = async () => {
    setSaving(true)
    const full_name = [form.last_name, form.first_name, form.patronymic].filter(Boolean).join(' ')
    const { error } = await supabase.from('profiles').update({ full_name:full_name||null, last_name:form.last_name||null, first_name:form.first_name||null, patronymic:form.patronymic||null, phone:form.phone||null, birth_date:form.birth_date||null, email:form.email||null }).eq('id', session.user.id)
    if (!error) { setProfile(p=>({...p,...form,full_name})); setSaved(true); setTimeout(()=>{setSaved(false); goScreen(null)},1500) }
    setSaving(false)
  }

  const isTechEmail = session.user.email?.startsWith('tg_')
  const greetName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.full_name || ''
  const initials = greetName ? greetName[0].toUpperCase() : '?'

  const subDaysLeft = activeSub ? Math.ceil((new Date(activeSub.expires_at) - new Date()) / 86400000) : 0
  const subTotal = activeSub ? Math.max(1, Math.ceil((new Date(activeSub.expires_at) - new Date(activeSub.activated_at || activeSub.created_at)) / 86400000)) : 1
  const subProgress = activeSub ? Math.max(0, Math.min(100, (1 - subDaysLeft/subTotal)*100)) : 0
  const subExpDate = activeSub ? new Date(activeSub.expires_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}) : ''

  if (screen === 'lessons')  return <MyLessons  session={session} onBack={() => goScreen(null)} />
  if (screen === 'stats')    return <MyStats    session={session} onBack={() => goScreen(null)} />
  if (screen === 'referral') return <Referral   session={session} onBack={() => goScreen(null)} />
  if (screen === 'editing') return (
    <div style={{fontFamily:'Inter,sans-serif', padding:20, maxWidth:480, margin:'0 auto'}}>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:24}}>
        <div onClick={() => goScreen(null)} style={{cursor:'pointer', color:'#BDBDBD', fontSize:20}}>←</div>
        <div style={{fontSize:16, color:'#2a2a2a', fontWeight:300}}>Редактировать профиль</div>
      </div>
      {[
        {label:'Фамилия',key:'last_name',placeholder:'Соколова',type:'text'},
        {label:'Имя',key:'first_name',placeholder:'Мария',type:'text'},
        {label:'Отчество',key:'patronymic',placeholder:'Ивановна',type:'text'},
        {label:'Телефон',key:'phone',placeholder:'+7 900 000 00 00',type:'tel'},
        {label:'Дата рождения',key:'birth_date',placeholder:'',type:'date'},
        {label:'Email',key:'email',placeholder:'example@mail.ru',type:'email'},
      ].map(field => (
        <div key={field.key} style={{marginBottom:16}}>
          <div style={{fontSize:11, color:'#BDBDBD', marginBottom:6, letterSpacing:'0.05em'}}>{field.label}</div>
          <input type={field.type} value={form[field.key]} placeholder={field.placeholder} onChange={e=>setForm({...form,[field.key]:e.target.value})}
            style={{width:'100%', padding:'12px 14px', border:'1px solid #e8e8e8', borderRadius:12, fontSize:14, boxSizing:'border-box', fontFamily:'Inter,sans-serif', color:'#2a2a2a', background:'#fff'}} />
        </div>
      ))}
      <button onClick={handleSave} disabled={saving}
        style={{width:'100%', padding:13, background:'#BFD900', border:'none', borderRadius:12, fontSize:14, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', marginTop:8}}>
        {saved ? 'Сохранено ✓' : saving ? 'Сохраняем...' : 'Сохранить'}
      </button>
    </div>
  )

  return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{padding:'20px 20px 0', display:'flex', flexDirection:'column', alignItems:'center'}}>
        <div style={{marginBottom:12}}>
          <AvatarUpload userId={session.user.id} currentUrl={avatarUrl} size={72} onUpload={url=>setAvatarUrl(url)} initials={initials} />
        </div>
        <div style={{fontSize:16, color:'#2a2a2a', fontWeight:300, marginBottom:16}}>
          {greetName || (!isTechEmail ? session.user.email : '') || 'Профиль'}
        </div>
        {activeSub ? (
          <div style={{background:'#fafde8', border:'1.5px solid #BFD900', borderRadius:16, padding:'14px 16px', width:'100%', boxSizing:'border-box', marginBottom:8}}>
            <div style={{fontSize:10, color:'#8a9900', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4}}>Активный абонемент</div>
            <div style={{fontSize:13, color:'#2a2a2a', fontWeight:400, marginBottom:10}}>{activeSub.type || 'Абонемент'}</div>
            <div style={{background:'#e8f0aa', borderRadius:4, height:5, marginBottom:6}}>
              <div style={{background:'#BFD900', borderRadius:4, height:5, width:`${100-subProgress}%`, transition:'width 0.3s'}} />
            </div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'#BDBDBD'}}>
              <span>Осталось {subDaysLeft} {subDaysLeft===1?'день':subDaysLeft<5?'дня':'дней'}</span>
              <span>до {subExpDate}</span>
            </div>
          </div>
        ) : (
          <div style={{background:'#f9f9f9', border:'1px solid #e0e0e0', borderRadius:16, padding:'14px 16px', width:'100%', boxSizing:'border-box', marginBottom:8, textAlign:'center'}}>
            <div style={{fontSize:13, color:'#BDBDBD'}}>Нет активного абонемента</div>
          </div>
        )}
      </div>

      {[
        {label:'Мои занятия', action:() => goScreen('lessons')},
        {label:'Моя статистика', action:() => goScreen('stats')},
        {label:'Привести друга ✦', accent:true, action:() => goScreen('referral')},
      ].map((item,i) => (
        <div key={i} onClick={item.action} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid #f5f5f5', cursor:'pointer'}}>
          <div style={{fontSize:14, color:item.accent?'#6a7700':'#3a3a3a', fontWeight:item.accent?600:400}}>{item.label}</div>
          <div style={{color:'#d0d0d0', fontSize:16}}>›</div>
        </div>
      ))}
      <div onClick={() => goScreen('editing')} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid #f5f5f5', cursor:'pointer'}}>
        <div style={{fontSize:14, color:'#3a3a3a'}}>Редактировать профиль</div>
        <div style={{color:'#d0d0d0', fontSize:16}}>›</div>
      </div>
      <div onClick={() => supabase.auth.signOut()} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', cursor:'pointer'}}>
        <div style={{fontSize:14, color:'#ccc'}}>Выйти</div>
        <div style={{color:'#d0d0d0', fontSize:16}}>›</div>
      </div>
    </div>
  )
}