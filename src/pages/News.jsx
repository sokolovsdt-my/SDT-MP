import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const TAGS = [
  { value:'hot', label:'🔥 Горячее' },
  { value:'event', label:'🎉 Мероприятие' },
  { value:'summer', label:'🌞 Лето' },
  { value:'subscription', label:'💳 Абонементы' },
  { value:'achievement', label:'🏆 Достижение' },
  { value:'education', label:'🎓 Обучение' },
  { value:'schedule', label:'📅 Расписание' },
  { value:'promo', label:'🎁 Акция' },
  { value:'new', label:'🆕 Новинка' },
  { value:'motivation', label:'💪 Мотивация' },
]

export default function News({ session, onBack }) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTag, setFilterTag] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [filterTag])

  const load = async () => {
    setLoading(true)
    let query = supabase.from('news').select('*')
      .eq('is_active', true)
      .lte('published_at', new Date().toISOString())
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
    if (filterTag) query = query.eq('tag', filterTag)
    const { data } = await query
    setNews(data || [])

    // Отмечаем просмотры
    if (session && data?.length > 0) {
      for (const item of data) {
        await supabase.from('news_views').upsert(
          { news_id: item.id, user_id: session.user.id },
          { onConflict: 'news_id,user_id', ignoreDuplicates: true }
        )
      }
    }
    setLoading(false)
  }

  const tagLabel = (tag) => TAGS.find(t => t.value === tag)?.label || tag
  const fmtDate = (dt) => new Date(dt).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })

  return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8'}}>
      {/* Шапка */}
      <div style={{background:'#fff', padding:'16px 20px', borderBottom:'1px solid #f0f0f0', position:'sticky', top:0, zIndex:10}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div onClick={onBack} style={{cursor:'pointer', color:'#BDBDBD', fontSize:20, lineHeight:1}}>←</div>
          <div style={{fontSize:18, fontWeight:600, color:'#2a2a2a'}}>Новости студии</div>
        </div>

        {/* Фильтр по тегам */}
        <div style={{display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', marginTop:12}}>
          <button onClick={() => setFilterTag('')}
            style={{flexShrink:0, padding:'4px 12px', borderRadius:10, border: filterTag==='' ? 'none' : '1px solid #e0e0e0', background: filterTag==='' ? '#BFD900' : '#fff', fontSize:11, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: filterTag==='' ? 600 : 400}}>
            Все
          </button>
          {TAGS.map(t => (
            <button key={t.value} onClick={() => setFilterTag(filterTag === t.value ? '' : t.value)}
              style={{flexShrink:0, padding:'4px 12px', borderRadius:10, border: filterTag===t.value ? 'none' : '1px solid #e0e0e0', background: filterTag===t.value ? '#BFD900' : '#fff', fontSize:11, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: filterTag===t.value ? 600 : 400}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Лента */}
      <div style={{padding:'12px 16px'}}>
        {loading ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
        ) : news.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Новостей пока нет</div>
        ) : news.map(item => (
          <div key={item.id}
            onClick={() => setExpanded(expanded === item.id ? null : item.id)}
            style={{background: item.card_bg || '#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:16, marginBottom:12, cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>

            {item.is_pinned && (
              <div style={{fontSize:10, fontWeight:700, color:'#888', marginBottom:6}}>📌 ЗАКРЕПЛЕНО</div>
            )}

            {item.tag && (
              <span style={{display:'inline-block', fontSize:10, fontWeight:700, background: item.tag_color || '#BFD900', color:'#2a2a2a', padding:'2px 10px', borderRadius:8, marginBottom:8}}>
                {tagLabel(item.tag)}
              </span>
            )}

            {item.title && (
              <div style={{fontSize:15, fontWeight:600, color: item.title_color || '#2a2a2a', marginBottom:6, lineHeight:1.4}}
                dangerouslySetInnerHTML={{ __html: item.title }} />
            )}

            {item.body && (
              <div style={{fontSize:13, color:'#2a2a2a', lineHeight:1.6, overflow:'hidden', maxHeight: expanded === item.id ? 'none' : 72}}
                dangerouslySetInnerHTML={{ __html: item.body }} />
            )}

            {item.body && item.body.length > 200 && (
              <div style={{fontSize:12, color:'#BFD900', fontWeight:600, marginTop:6}}>
                {expanded === item.id ? 'Свернуть ↑' : 'Читать далее →'}
              </div>
            )}

            <div style={{fontSize:11, color:'#BDBDBD', marginTop:8}}>
              {fmtDate(item.published_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}