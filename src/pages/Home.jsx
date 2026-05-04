import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Home({ session, onNewsAll }) {
  const [profile, setProfile] = useState(null)
  const [news, setNews] = useState([])
  const [stats, setStats] = useState({ thisMonth: 0, totalHours: 0 })
  const [nextLesson, setNextLesson] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(profileData)

      const { data: newsData } = await supabase
        .from('news').select('*').eq('is_active', true)
        .order('published_at', { ascending: false }).limit(5)
      setNews(newsData || [])

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const { data: allAttendance } = await supabase
        .from('attendance')
        .select('created_at, schedule:schedule_id(starts_at, ends_at)')
        .eq('student_id', session.user.id)
        .eq('status', 'present')

      const thisMonthCount = (allAttendance || []).filter(a =>
        a.created_at >= monthStart
      ).length

      const totalMinutes = (allAttendance || []).reduce((sum, a) => {
        if (a.schedule?.starts_at && a.schedule?.ends_at) {
          const diff = new Date(a.schedule.ends_at) - new Date(a.schedule.starts_at)
          return sum + diff / 60000
        }
        return sum + 90
      }, 0)

      setStats({ thisMonth: thisMonthCount, totalHours: Math.round(totalMinutes / 60) })

      const { data: bookings } = await supabase
        .from('bookings')
        .select('schedule:schedule_id(id, title, starts_at, ends_at, hall, groups(name), profiles:teacher_id(full_name))')
        .eq('student_id', session.user.id)
        .eq('status', 'confirmed')
        .gte('schedule.starts_at', new Date().toISOString())
        .order('schedule.starts_at', { ascending: true })
        .limit(1)

      const next = bookings?.[0]?.schedule
      if (next) setNextLesson(next)
    }
    load()
  }, [session])

  const name = profile?.first_name || profile?.full_name?.split(' ')[0] || session.user.email

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const isToday = (dateStr) => {
    const d = new Date(dateStr)
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth()
  }

  return (
    <div style={{padding:'16px 20px 0', fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
        <div style={{width:36, height:36, border:'2px dashed #BDBDBD', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'#BDBDBD'}}>+</div>
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="" style={{width:36, height:36, borderRadius:'50%', objectFit:'cover'}} />
          : <div style={{width:36, height:36, background:'#BFD900', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#2a2a2a'}}>
              {name[0].toUpperCase()}
            </div>
        }
      </div>

      <div style={{fontSize:12, color:'#BDBDBD', marginBottom:3}}>Добро пожаловать,</div>
      <div style={{fontSize:21, color:'#2a2a2a', fontWeight:300, marginBottom:22}}>
        Привет, <span style={{color:'#BFD900', fontWeight:600}}>{name}!</span>
      </div>

      <div style={{background:'#2a2a2a', borderRadius:22, padding:18, marginBottom:18, position:'relative'}}>
        {nextLesson ? (
          <>
            <div style={{position:'absolute', right:16, top:16, background:'#BFD900', color:'#2a2a2a', borderRadius:10, padding:'5px 12px', fontSize:10, fontWeight:700}}>
              {nextLesson.hall || '—'}
            </div>
            <div style={{fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'#BDBDBD', marginBottom:6}}>Следующее занятие</div>
            <div style={{fontSize:15, color:'#fff', marginBottom:5}}>{nextLesson.groups?.name || nextLesson.title || 'Занятие'}</div>
            <div style={{fontSize:12, color:'#888', display:'flex', gap:12}}>
              <span>{isToday(nextLesson.starts_at) ? 'Сегодня' : formatDate(nextLesson.starts_at)}, {formatTime(nextLesson.starts_at)}</span>
              {nextLesson.profiles?.full_name && <span>{nextLesson.profiles.full_name}</span>}
            </div>
          </>
        ) : (
          <>
            <div style={{fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'#BDBDBD', marginBottom:6}}>Следующее занятие</div>
            <div style={{fontSize:14, color:'#888'}}>Нет запланированных занятий</div>
          </>
        )}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18}}>
        <div style={{background:'#fff', borderRadius:16, padding:14, border:'1px solid #efefef'}}>
          <div style={{fontSize:22, color:'#2a2a2a', fontWeight:300}}>{stats.thisMonth} <span style={{fontSize:11, color:'#BFD900'}}>зан.</span></div>
          <div style={{fontSize:11, color:'#BDBDBD', marginTop:3}}>В этом месяце</div>
        </div>
        <div style={{background:'#fff', borderRadius:16, padding:14, border:'1px solid #efefef'}}>
          <div style={{fontSize:22, color:'#2a2a2a', fontWeight:300}}>{stats.totalHours} <span style={{fontSize:11, color:'#BFD900'}}>ч.</span></div>
          <div style={{fontSize:11, color:'#BDBDBD', marginTop:3}}>Всего часов</div>
        </div>
      </div>

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <div style={{fontSize:10, color:'#BDBDBD', letterSpacing:'0.12em', textTransform:'uppercase'}}>Новости студии</div>
        <div onClick={onNewsAll} style={{fontSize:12, color:'#BFD900', fontWeight:600, cursor:'pointer'}}>Все новости →</div>
      </div>
      {news.length === 0 ? (
        <div style={{fontSize:13, color:'#BDBDBD', padding:'10px 0'}}>Новостей пока нет</div>
      ) : news.map((n, i) => (
        <div key={n.id} style={{display:'flex', gap:12, alignItems:'flex-start', padding:'10px 0', borderBottom:'1px solid #f2f2f2'}}>
          <div style={{width:7, height:7, background: i===0 ? '#BFD900' : '#e0e0e0', borderRadius:'50%', flexShrink:0, marginTop:5}} />
          <div>
            <div style={{fontSize:13, color:'#2a2a2a', lineHeight:1.5}} dangerouslySetInnerHTML={{ __html: n.title }} />
            <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>{formatDate(n.published_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}