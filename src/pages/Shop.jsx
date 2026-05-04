import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TYPE_TO_CAT = {
  subscription: 'subscriptions',
  service: 'services',
  event: 'events',
  merch: 'merch',
}

const CATS = [
  { id: 'subscriptions', label: 'Абонементы' },
  { id: 'services', label: 'Услуги' },
  { id: 'indiv', label: 'Индивы' },
  { id: 'events', label: 'Мероприятия' },
  { id: 'merch', label: 'Мерч' },
]

const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']

export default function Shop({ session }) {
  const [activeCat, setActiveCat] = useState(() => localStorage.getItem('shop_cat') || 'subscriptions')
  const [selected, setSelected] = useState(null)
  const [products, setProducts] = useState({})
  const [loading, setLoading] = useState(true)

  // Для вкладки Индивы
  const [teachers, setTeachers] = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState(() => localStorage.getItem('shop_indiv_teacher') || null)
  const [teacherData, setTeacherData] = useState(null)
  const [indivProducts, setIndivProducts] = useState([])
  const [slots, setSlots] = useState([])
  const [groups, setGroups] = useState([])
  const [indivTab, setIndivTab] = useState('indiv')
  const [indivLoading, setIndivLoading] = useState(false)

  const goCat = (c) => { setActiveCat(c); localStorage.setItem('shop_cat', c) }

  const goTeacher = (id) => {
    setSelectedTeacher(id)
    localStorage.setItem('shop_indiv_teacher', id || '')
  }

  useEffect(() => {
    const load = async () => {
      const today = new Date().getDate()
      const { data } = await supabase.from('products').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      const grouped = { subscriptions: [], services: [], events: [], merch: [] }
      ;(data || []).forEach(p => {
        if (p.available_from_day && p.available_to_day) {
          if (today < p.available_from_day || today > p.available_to_day) return
        }
        const cat = TYPE_TO_CAT[p.type]
        if (cat && grouped[cat]) grouped[cat].push(p)
      })
      setProducts(grouped)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (activeCat === 'indiv') loadTeachers()
  }, [activeCat])

  useEffect(() => {
    if (selectedTeacher) loadTeacherDetail(selectedTeacher)
    else setTeacherData(null)
  }, [selectedTeacher])

  const loadTeachers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, avatar_url, bio')
      .eq('role', 'teacher')
      .order('full_name')
    setTeachers(data || [])
  }

  const loadTeacherDetail = async (id) => {
    setIndivLoading(true)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, avatar_url, bio')
      .eq('id', id).single()
    setTeacherData(profile)

    const { data: grps } = await supabase
      .from('schedule')
      .select('groups(name)')
      .eq('teacher_id', id)
      .not('group_id', 'is', null)
    const uniqueGroups = [...new Set((grps || []).map(g => g.groups?.name).filter(Boolean))]
    setGroups(uniqueGroups)

    const { data: teacherProds } = await supabase
      .from('product_subscription_teachers')
      .select('product_id')
      .eq('teacher_id', id)
    const productIds = (teacherProds || []).map(r => r.product_id)

    if (productIds.length > 0) {
      const { data: prods } = await supabase
        .from('products')
        .select('*, product_indivs(*)')
        .eq('type', 'indiv')
        .eq('is_active', true)
        .in('id', productIds)
      setIndivProducts(prods || [])
    } else {
      setIndivProducts([])
    }

    const { data: sl } = await supabase
      .from('teacher_indiv_slots')
      .select('*')
      .eq('teacher_id', id)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time')
    setSlots(sl || [])
    setIndivLoading(false)
  }

  const initials = (t) => {
    const name = t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim()
    return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  }

  const getName = (t) => t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || '—'

  const current = products[activeCat] || []

  // ── Карточка препода внутри вкладки Индивы ───────────────────────────────
  const TeacherDetail = () => (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
        <div onClick={() => goTeacher(null)} style={{cursor:'pointer', color:'#BDBDBD', fontSize:20}}>←</div>
        <div style={{fontSize:16, fontWeight:600, color:'#2a2a2a'}}>{getName(teacherData)}</div>
      </div>

      {teacherData.avatar_url && (
        <img src={teacherData.avatar_url} alt="" style={{width:'100%', display:'block', objectFit:'contain', borderRadius:16, marginBottom:12, background:'#f0f0f0'}} />
      )}

      {teacherData.bio && (
        <div style={{fontSize:13, color:'#888', lineHeight:1.6, marginBottom:12}}>{teacherData.bio}</div>
      )}

      {groups.length > 0 && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Ведёт группы</div>
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
            {groups.map(g => (
              <span key={g} style={{fontSize:12, background:'#f5f5f5', color:'#2a2a2a', padding:'4px 12px', borderRadius:20}}>{g}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'flex', borderBottom:'1px solid #f0f0f0', marginBottom:16}}>
        {[['indiv','Индивы'],['slots','Расписание']].map(([v,l]) => (
          <div key={v} onClick={() => setIndivTab(v)}
            style={{padding:'10px 16px', fontSize:13, cursor:'pointer', color:indivTab===v?'#2a2a2a':'#BDBDBD', borderBottom:indivTab===v?'2px solid #BFD900':'2px solid transparent', fontWeight:indivTab===v?600:400}}>
            {l}
          </div>
        ))}
      </div>

      {indivTab === 'indiv' && (
        indivProducts.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Индивы не настроены</div>
        ) : indivProducts.map(p => (
          <div key={p.id} style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:16, marginBottom:12}}>
            <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>{p.name}</div>
            {p.description && <div style={{fontSize:12, color:'#888', marginBottom:12, lineHeight:1.5}}>{p.description}</div>}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontSize:20, color:'#2a2a2a', fontWeight:300}}>
                {Number(p.price).toLocaleString()} <span style={{fontSize:12, color:'#BDBDBD'}}>₽</span>
              </div>
              <button onClick={() => alert('Оплата скоро будет доступна!')}
                style={{background:'#BFD900', border:'none', borderRadius:12, padding:'9px 20px', fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                Купить
              </button>
            </div>
          </div>
        ))
      )}

      {indivTab === 'slots' && (() => {
        const DAYS_FULL = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']
        const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
        const nextDateForDay = (d) => {
          const today = new Date()
          const diff = (d - today.getDay() + 7) % 7
          const next = new Date(today)
          next.setDate(today.getDate() + diff)
          return next
        }
        const grouped = [1,2,3,4,5,6,0]
          .map(day => ({ day, date: nextDateForDay(day), slots: slots.filter(s => s.day_of_week === day) }))
          .filter(g => g.slots.length > 0)
          .sort((a,b) => a.date - b.date)
        return slots.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Расписание не указано</div>
        ) : grouped.map(({day, date, slots: daySlots}) => (
          <div key={day} style={{marginBottom:16}}>
            <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>
              {DAYS_FULL[day]}, {date.getDate()} {MONTHS[date.getMonth()]}
            </div>
            {daySlots.map(s => (
              <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', borderRadius:12, padding:'10px 14px', marginBottom:6, border:'1px solid #f0f0f0'}}>
                <div style={{fontSize:13, color:'#2a2a2a'}}>{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</div>
                <button onClick={() => alert('Сначала оплатите индив!')}
                  style={{background:'#f5facc', border:'none', borderRadius:8, padding:'5px 14px', fontSize:12, fontWeight:600, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Записаться
                </button>
              </div>
            ))}
          </div>
        ))
      })()}
    </div>
  )

  // ── Список преподавателей ─────────────────────────────────────────────────
  const TeacherList = () => (
    teachers.length === 0 ? (
      <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Преподаватели не найдены</div>
    ) : (
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        {teachers.map(t => (
          <div key={t.id} onClick={() => goTeacher(t.id)}
            style={{background:'#fff', borderRadius:16, overflow:'hidden', border:'1px solid #f0f0f0', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            {t.avatar_url ? (
              <img src={t.avatar_url} alt="" style={{width:'100%', height:140, objectFit:'cover'}} />
            ) : (
              <div style={{width:'100%', height:140, background:'linear-gradient(135deg, #2a2a2a, #444)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <div style={{width:48, height:48, background:'#BFD900', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#2a2a2a'}}>
                  {initials(t)}
                </div>
              </div>
            )}
            <div style={{padding:'10px 12px'}}>
              <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', lineHeight:1.3}}>{getName(t)}</div>
              {t.bio && <div style={{fontSize:11, color:'#BDBDBD', marginTop:3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>{t.bio}</div>}
            </div>
          </div>
        ))}
      </div>
    )
  )

  return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{padding:'16px 20px 0'}}>
        <div style={{fontSize:18, color:'#2a2a2a', fontWeight:300, marginBottom:16, fontFamily:'sans-serif'}}>Магазин</div>
        <div style={{display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', marginBottom:16}}>
          {CATS.map(cat => (
            <div key={cat.id} onClick={() => goCat(cat.id)} style={{
              flexShrink:0, padding:'6px 14px', borderRadius:12,
              border: activeCat === cat.id ? 'none' : '1px solid #e0e0e0',
              background: activeCat === cat.id ? '#BFD900' : '#fff',
              color: activeCat === cat.id ? '#2a2a2a' : '#BDBDBD',
              fontSize:12, cursor:'pointer',
              fontWeight: activeCat === cat.id ? 600 : 400
            }}>{cat.label}</div>
          ))}
        </div>
      </div>

      <div style={{padding:'0 20px 20px'}}>
        {activeCat === 'indiv' ? (
          indivLoading ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
          ) : selectedTeacher && teacherData ? (
            <TeacherDetail />
          ) : (
            <TeacherList />
          )
        ) : loading ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
        ) : current.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Пока ничего нет</div>
        ) : current.map(product => (
          <div key={product.id} style={{
            background: product.is_featured ? '#fafde8' : '#fff',
            border: product.is_featured ? `1.5px solid ${product.badge_color || '#BFD900'}` : '1px solid #efefef',
            borderRadius:20, padding:18, marginBottom:12
          }}>
            {product.is_featured && (
              <div style={{display:'inline-block', background:product.badge_color || '#BFD900', color: (product.badge_color === '#BFD900' || product.badge_color === '#f39c12' || product.badge_color === '#e0e0e0') ? '#2a2a2a' : '#fff', fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'3px 10px', borderRadius:8, marginBottom:10}}>
                {product.badge_text || 'Популярный'}
              </div>
            )}
            <div style={{fontSize:14, color:'#2a2a2a', fontWeight:400, marginBottom:4, fontFamily:'sans-serif'}}>{product.name}</div>
            {product.description && <div style={{fontSize:12, color:'#BDBDBD', marginBottom:14, lineHeight:1.5}}>{product.description}</div>}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontSize:18, color:'#2a2a2a', fontFamily:'sans-serif'}}>
                {Number(product.price).toLocaleString()} <span style={{fontSize:11, color:'#BDBDBD'}}>₽</span>
              </div>
              <button onClick={() => setSelected(product)} style={{
                background: product.is_featured ? (product.badge_color || '#BFD900') : 'transparent',
                color: product.is_featured ? ((product.badge_color === '#BFD900' || product.badge_color === '#f39c12' || product.badge_color === '#e0e0e0') ? '#2a2a2a' : '#fff') : '#BDBDBD',
                border: product.is_featured ? 'none' : '1.5px solid #e0e0e0',
                borderRadius:12, padding:'9px 20px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif'
              }}>Купить</button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'#fff', borderRadius:'24px 24px 0 0', padding:24, width:'100%', maxWidth:480, boxSizing:'border-box'}}>
            <div style={{width:40, height:4, background:'#e0e0e0', borderRadius:2, margin:'0 auto 20px'}} />
            <div style={{fontSize:16, color:'#2a2a2a', fontWeight:500, marginBottom:6}}>{selected.name}</div>
            {selected.description && <div style={{fontSize:13, color:'#BDBDBD', marginBottom:20, lineHeight:1.6}}>{selected.description}</div>}
            <div style={{fontSize:24, color:'#2a2a2a', fontWeight:300, marginBottom:20}}>
              {Number(selected.price).toLocaleString()} <span style={{fontSize:14, color:'#BDBDBD'}}>₽</span>
            </div>
            <button onClick={() => alert('Оплата скоро будет доступна! Для оплаты свяжитесь с администратором.')}
              style={{width:'100%', padding:14, background:'#BFD900', border:'none', borderRadius:14, fontSize:14, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', marginBottom:10}}>
              Оплатить {Number(selected.price).toLocaleString()} ₽
            </button>
            <button onClick={() => setSelected(null)}
              style={{width:'100%', padding:14, background:'transparent', border:'1px solid #e0e0e0', borderRadius:14, fontSize:14, color:'#BDBDBD', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}