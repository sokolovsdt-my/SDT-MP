import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { safeHtml } from '../utils/safeHtml'
import { nowMskNaive, parseMskNaive } from '../utils/tz'

export default function Home({ session, onNewsAll, onBonus }) {
  const [profile, setProfile] = useState(null)
  const [news, setNews] = useState([])
  const [tags, setTags] = useState([])
  const [stats, setStats] = useState({ thisMonth: 0, totalHours: 0 })
  const [nextLesson, setNextLesson] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // Все четыре запроса страницы параллельно — раньше шли последовательно
      // с накопительным RTT.
      // schedule.starts_at — MSK naive, фильтр "от сейчас" должен быть в той же конвенции.
      const nowIso = nowMskNaive()
      const sel = 'id, title, starts_at, ends_at, hall, lesson_type, is_cancelled, groups(name), teacher:profiles!schedule_teacher_id_fkey(full_name)'
      const [profileRes, tagsRes, newsRes, attRes, bookingsRes, indivRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('news_tags').select('*').order('created_at'),
        supabase.from('news').select('*').eq('is_active', true)
          .lte('published_at', new Date().toISOString())
          .order('is_pinned', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(5),
        supabase.from('attendance')
          .select('created_at, schedule:schedule_id(starts_at, ends_at)')
          .eq('student_id', session.user.id)
          .eq('status', 'present'),
        supabase.from('bookings')
          .select(`schedule:schedule_id(${sel})`)
          .eq('student_id', session.user.id)
          .eq('status', 'booked'),
        supabase.from('schedule')
          .select(sel)
          .eq('indiv_student_id', session.user.id)
          .eq('is_cancelled', false)
          .gte('starts_at', nowIso),
      ])
      if (cancelled) return

      setProfile(profileRes.data)
      setTags(tagsRes.data || [])
      setNews(newsRes.data || [])

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const allAttendance = attRes.data || []
      const thisMonthCount = allAttendance.filter(a => a.created_at >= monthStart).length
      const totalMinutes = allAttendance.reduce((sum, a) => {
        if (a.schedule?.starts_at && a.schedule?.ends_at)
          return sum + (new Date(a.schedule.ends_at) - new Date(a.schedule.starts_at)) / 60000
        return sum + 90
      }, 0)
      setStats({ thisMonth: thisMonthCount, totalHours: Math.round(totalMinutes / 60) })

      // Следующее занятие — bookings (группа/мероприятие) + schedule напрямую
      // (для индивов: bookings туда не пишутся, занятие связано через
      // schedule.indiv_student_id).
      const fromBookings = (bookingsRes.data || [])
        .map(b => b.schedule)
        .filter(s => s && !s.is_cancelled && parseMskNaive(s.starts_at) >= new Date())
      const fromIndiv = indivRes.data || []
      const next = [...fromBookings, ...fromIndiv]
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0]

      if (next) setNextLesson(next)
    }
    load()
    return () => { cancelled = true }
  }, [session])

  const name = profile?.first_name || profile?.full_name?.split(' ')[0] || session.user.email
  const formatDate = (d) => parseMskNaive(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' })
  const formatTime = (d) => parseMskNaive(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
  const isToday = (d) => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    return parseMskNaive(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }) === today
  }
  const stripHtml = (html) => html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&') || ''
  const tagLabel = (tag) => tags.find(t => t.value === tag)?.label || tag

  return (
    <div style={{padding:'16px 20px 0', fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
        <div style={{width:36, height:36, border:'2px dashed #BDBDBD', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'#BDBDBD'}}>+</div>
        {profile?.avatar_url
          ? <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" style={{width:36, height:36, borderRadius:'50%', objectFit:'cover'}} />
          : <div style={{width:36, height:36, background:'#BFD900', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#2a2a2a'}}>
              {name[0]?.toUpperCase()}
            </div>
        }
      </div>

      <div style={{fontSize:21, color:'#2a2a2a', fontWeight:300, marginBottom:22}}>
        Привет, <span style={{color:'#6a7700', fontWeight:600}}>{name}!</span>
      </div>

      {/* Следующее занятие */}
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
              {nextLesson.teacher?.full_name && <span>{nextLesson.teacher.full_name}</span>}
            </div>
          </>
        ) : (
          <>
            <div style={{fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'#BDBDBD', marginBottom:6}}>Следующее занятие</div>
            <div style={{fontSize:14, color:'#888'}}>Нет запланированных занятий</div>
          </>
        )}
      </div>

      {/* Статистика */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18}}>
        <div style={{background:'#fff', borderRadius:16, padding:14, border:'1px solid #efefef'}}>
          <div style={{fontSize:22, color:'#2a2a2a', fontWeight:300}}>{stats.thisMonth} <span style={{fontSize:11, color:'#6a7700'}}>зан.</span></div>
          <div style={{fontSize:11, color:'#BDBDBD', marginTop:3}}>В этом месяце</div>
        </div>
        <div style={{background:'#fff', borderRadius:16, padding:14, border:'1px solid #efefef'}}>
          <div style={{fontSize:22, color:'#2a2a2a', fontWeight:300}}>{stats.totalHours} <span style={{fontSize:11, color:'#6a7700'}}>ч.</span></div>
          <div style={{fontSize:11, color:'#BDBDBD', marginTop:3}}>Всего часов</div>
        </div>
      </div>

      {/* Бонусы */}
      <div onClick={onBonus} style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fafde8', border:'1.5px solid #BFD900', borderRadius:16, padding:'12px 16px', marginBottom:18, cursor:'pointer'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <span style={{fontSize:20}}>⭐</span>
          <div>
            <div style={{fontSize:13, fontWeight:600, color:'#6a7700'}}>Мои бонусы</div>
            <div style={{fontSize:11, color:'#8a9900', marginTop:2}}>{profile?.bonus_rubles || 0} ₽ · {profile?.bonus_coins || 0} SDTшек</div>
          </div>
        </div>
        <div style={{color:'#6a7700', fontSize:18}}>›</div>
      </div>

      {/* Разделитель */}
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
        <div style={{flex:1, height:1, background:'#f0f0f0'}} />
        <div style={{fontSize:10, color:'#BDBDBD', letterSpacing:'0.12em', textTransform:'uppercase'}}>Новости студии</div>
        <div style={{flex:1, height:1, background:'#f0f0f0'}} />
      </div>

      {/* Новости */}
      <div style={{display:'flex', justifyContent:'flex-end', marginBottom:10}}>
        <div onClick={() => { localStorage.setItem('news_tag', ''); onNewsAll() }} style={{fontSize:12, color:'#6a7700', fontWeight:600, cursor:'pointer'}}>Все новости →</div>
      </div>

      {news.length === 0 ? (
        <div style={{fontSize:13, color:'#BDBDBD', padding:'10px 0'}}>Новостей пока нет</div>
      ) : news.map(n => (
        <div key={n.id} onClick={() => { localStorage.setItem('news_tag', ''); onNewsAll() }}
          style={{background: n.card_bg || '#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:14, marginBottom:10, cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', position:'relative', overflow:'hidden'}}>

          {n.is_pinned && (
            <div style={{position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg, #BFD900 0%, #a0b800 40%, transparent 100%)', borderRadius:'16px 16px 0 0'}} />
          )}

          {n.tag && (
            <div style={{marginBottom:8, marginTop: n.is_pinned ? 8 : 0, textAlign:'left'}}>
              <span style={{fontSize:9, fontWeight:700, background: n.tag_color || '#BFD900', color: n.tag_text_color || '#2a2a2a', padding:'2px 8px', borderRadius:6}}>
                {tagLabel(n.tag)}
              </span>
            </div>
          )}

          {n.title && (
            <div style={{fontSize:14, fontWeight:600, color: n.title_color || '#2a2a2a', marginBottom:4, lineHeight:1.4, textAlign:'center'}}
              dangerouslySetInnerHTML={safeHtml(n.title)} />
          )}

          {n.body && (
            <div style={{fontSize:12, color: n.body_color || '#888', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', textAlign:'center'}}>
              {stripHtml(n.body).slice(0, 120)}
            </div>
          )}

          <div style={{fontSize:11, color:'#BDBDBD', marginTop:6, textAlign:'center'}}>{formatDate(n.published_at)}</div>
        </div>
      ))}
    </div>
  )
}