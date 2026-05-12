import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const TYPE_TO_CAT = {
  subscription: 'subscriptions',
  service: 'services',
  event: 'events',
}

const CATS = [
  { id: 'subscriptions', label: 'Абонементы' },
  { id: 'services', label: 'Услуги' },
  { id: 'indiv', label: 'Индивы' },
  { id: 'events', label: 'Мероприятия' },
  { id: 'merch', label: 'Мерч' },
]

const DAYS_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

export default function Shop({ session }) {
  const [activeCat, setActiveCat] = useState(() => localStorage.getItem('shop_cat') || 'subscriptions')
  const [selected, setSelected] = useState(null)
  const [products, setProducts] = useState({})
  const [loading, setLoading] = useState(true)

  // Мерч
  const [merchProducts, setMerchProducts] = useState([])
  const [merchLoading, setMerchLoading] = useState(false)
  const [activeProductId, setActiveProductId] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [cardVisible, setCardVisible] = useState(true)
  const [selectedColors, setSelectedColors] = useState({})
  const [selectedSizes, setSelectedSizes] = useState({})
  const [preordering, setPreordering] = useState(false)

  // Мероприятия
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)

  // Индивы
  const [teachers, setTeachers] = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState(() => localStorage.getItem('shop_indiv_teacher') || null)
  const [teacherData, setTeacherData] = useState(null)
  const [indivProducts, setIndivProducts] = useState([])
  const [slots, setSlots] = useState([])
  const [groups, setGroups] = useState([])
  const [indivTab, setIndivTab] = useState('indiv')
  const [indivLoading, setIndivLoading] = useState(false)
  const [clientPackage, setClientPackage] = useState(null)
  const [bookingDone, setBookingDone] = useState(null)
  const [bookingError, setBookingError] = useState('')
  const [bookingSlot, setBookingSlot] = useState(null)
  const [savingSlot, setSavingSlot] = useState(false)

  const goCat = (c) => { setActiveCat(c); localStorage.setItem('shop_cat', c) }
  const goTeacher = (id) => {
    setSelectedTeacher(id)
    localStorage.setItem('shop_indiv_teacher', id || '')
    setBookingDone(null)
    setBookingError('')
  }

  useEffect(() => {
    const load = async () => {
      const today = new Date().getDate()
      const { data } = await supabase.from('products').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      const grouped = { subscriptions: [], services: [], events: [] }
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
    if (activeCat === 'merch') loadMerch()
    if (activeCat === 'events') loadEvents()
  }, [activeCat])

  useEffect(() => {
    if (selectedTeacher) loadTeacherDetail(selectedTeacher)
    else setTeacherData(null)
  }, [selectedTeacher])

  const loadMerch = async () => {
    setMerchLoading(true)
    const { data } = await supabase
      .from('merch_products')
      .select('*, merch_variants(*), merch_preorders(client_id)')
      .eq('is_active', true)
      .eq('is_available_online', true)
      .order('sort_order')
    const list = data || []
    setMerchProducts(list)
    if (list.length > 0 && !activeProductId) setActiveProductId(list[0].id)
    setMerchLoading(false)
  }

  const loadEvents = async () => {
    setEventsLoading(true)
    const { data } = await supabase
      .from('events')
      .select('*, event_dates(*), event_price_tiers(*)')
      .eq('is_active', true)
      .eq('is_available_online', true)
      .order('sort_order')
    setEvents(data || [])
    setEventsLoading(false)
  }

  const loadTeachers = async () => {
    const { data } = await supabase
      .from('indiv_packages')
      .select('teacher:profiles!indiv_packages_teacher_id_fkey(id, full_name, first_name, last_name, avatar_url, bio, sort_order)')
      .eq('is_active', true)
    const seen = new Set()
    const unique = (data || []).map(d => d.teacher)
      .filter(t => t && !seen.has(t.id) && seen.add(t.id))
      .sort((a, b) => (a.sort_order || 100) - (b.sort_order || 100))
    setTeachers(unique)
  }

  const loadTeacherDetail = async (id) => {
    setIndivLoading(true)
    const { data: profile } = await supabase.from('profiles').select('id, full_name, first_name, last_name, avatar_url, bio').eq('id', id).single()
    setTeacherData(profile)
    const { data: grps } = await supabase.from('schedule').select('groups(name)').eq('teacher_id', id).not('group_id', 'is', null)
    setGroups([...new Set((grps || []).map(g => g.groups?.name).filter(Boolean))])
    const { data: pkgs } = await supabase.from('indiv_packages').select('*').eq('teacher_id', id).eq('is_active', true).order('sort_order')
    setIndivProducts(pkgs || [])

    // Слоты на 30 дней из teacher_slot_dates
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    const future = new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    const { data: sl } = await supabase
      .from('teacher_slot_dates')
      .select('*')
      .eq('teacher_id', id)
      .eq('is_active', true)
      .gte('date', today)
      .lte('date', future)
      .order('date')
      .order('start_time')
    setSlots(sl || [])

    if (session?.user?.id) {
      const { data: pkg } = await supabase
        .from('indiv_subscriptions')
        .select('id, visits_total, visits_used, expires_at')
        .eq('client_id', session.user.id)
        .eq('teacher_id', id)
        .eq('is_frozen', false)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setClientPackage(pkg && pkg.visits_used < pkg.visits_total ? pkg : null)
    }

    setIndivLoading(false)
  }

  const handleBook = async (dateStr, slot) => {
    setBookingSlot(slot.id)
    setBookingError('')
    setSavingSlot(true)
    try {
      const { data: existing } = await supabase
        .from('indiv_requests')
        .select('id')
        .eq('client_id', session.user.id)
        .eq('teacher_id', selectedTeacher)
        .eq('slot_date', dateStr)
        .eq('start_time', slot.start_time)
        .in('status', ['pending', 'confirmed'])
        .maybeSingle()

      if (existing) {
        setBookingError('Вы уже записаны на этот слот')
        setSavingSlot(false)
        setBookingSlot(null)
        return
      }

      await supabase.from('indiv_requests').insert({
        client_id: session.user.id,
        teacher_id: selectedTeacher,
        slot_date: dateStr,
        start_time: slot.start_time,
        end_time: slot.end_time,
        package_id: clientPackage?.id || null,
        status: 'pending',
        created_by: session.user.id,
      })

      const d = new Date(dateStr + 'T00:00:00')
      setBookingDone(`${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}, ${slot.start_time.slice(0,5)}–${slot.end_time.slice(0,5)}`)
    } catch {
      setBookingError('Ошибка при записи')
    }
    setSavingSlot(false)
    setBookingSlot(null)
  }

  // Группируем слоты по дате
  const slotsByDate = {}
  slots.forEach(s => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = []
    slotsByDate[s.date].push(s)
  })

  const switchProduct = (newId) => {
    if (transitioning || newId === activeProductId) return
    setTransitioning(true)
    setCardVisible(false)
    setTimeout(() => {
      setActiveProductId(newId)
      setCardVisible(true)
      setTimeout(() => setTransitioning(false), 350)
    }, 220)
  }

  const handlePreorder = async (productId) => {
    if (!session?.user?.id) return
    setPreordering(true)
    await supabase.from('merch_preorders').upsert({ product_id: productId, client_id: session.user.id }, { onConflict: 'product_id,client_id' })
    setPreordering(false)
    alert('Мы уведомим тебя когда товар появится!')
    loadMerch()
  }

  const getVariantsByColor = (variants) => {
    const map = {}
    ;(variants || []).filter(v => v.is_active).forEach(v => {
      const c = v.color || 'Без цвета'
      if (!map[c]) map[c] = { hex: v.color_hex, variants: [] }
      map[c].variants.push(v)
    })
    return map
  }

  const initials = (t) => {
    const name = t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim()
    return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  }
  const getName = (t) => t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || '—'

  const current = products[activeCat] || []

  // ── Мерч ──────────────────────────────────────────────────────────────────
  const MerchSection = () => {
    if (merchLoading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
    if (merchProducts.length === 0) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Мерч скоро появится</div>

    const activeProduct = merchProducts.find(p => p.id === activeProductId) || merchProducts[0]
    const otherProducts = merchProducts.filter(p => p.id !== activeProduct.id)
    const colorMap = getVariantsByColor(activeProduct.merch_variants)
    const colors = Object.keys(colorMap)
    const selectedColor = selectedColors[activeProduct.id] || colors[0]
    const currentColorData = colorMap[selectedColor]
    const variants = currentColorData?.variants || []
    const hasSize = variants.some(v => v.size)
    const selectedSize = selectedSizes[activeProduct.id]
    const selectedVariant = hasSize ? (selectedSize ? variants.find(v => v.size === selectedSize) : null) : variants[0]
    const totalStock = (activeProduct.merch_variants || []).filter(v => v.is_active).reduce((s, v) => s + (v.stock_count || 0), 0)
    const alreadyPreordered = activeProduct.merch_preorders?.some(p => p.client_id === session?.user?.id)
    const minPrice = Math.min(...(activeProduct.merch_variants || []).filter(v => v.is_active && v.stock_count > 0).map(v => v.price).filter(Boolean))

    return (
      <div>
        <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0f0f0', overflow:'hidden', marginBottom:12, opacity:cardVisible?1:0, transform:cardVisible?'translateY(0)':'translateY(-10px)', transition:'opacity 0.25s ease, transform 0.25s ease' }}>
          <div style={{position:'relative', aspectRatio:'4/3', overflow:'hidden', background:'#f0f0f0'}}>
            {activeProduct.image_url ? <img src={activeProduct.image_url} alt="" style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}} /> : <div style={{width:'100%', height:'100%', background:'#f5f5f5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48}}>📦</div>}
            {activeProduct.badge_text && <div style={{position:'absolute', top:12, left:12}}><span style={{fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:20, background:(activeProduct.badge_color||'#BFD900')+'ee', color: activeProduct.badge_color === '#BFD900' || activeProduct.badge_color === '#f39c12' ? '#2a2a2a' : '#fff'}}>{activeProduct.badge_text}</span></div>}
            {totalStock > 0 && totalStock <= 5 && <div style={{position:'absolute', top:12, right:12, background:'rgba(0,0,0,0.5)', color:'#fff', fontSize:11, padding:'3px 10px', borderRadius:20}}>Осталось {totalStock} шт</div>}
          </div>
          <div style={{padding:16}}>
            <div style={{fontSize:18, fontWeight:600, color:'#2a2a2a', marginBottom:6}}>{activeProduct.name}</div>
            {activeProduct.description && <div style={{fontSize:13, color:'#888', lineHeight:1.6, marginBottom:16}}>{activeProduct.description}</div>}
            {colors.length > 1 && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Цвет</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  {colors.map(color => { const { hex, variants: cv } = colorMap[color]; const colorStock = cv.reduce((s,v)=>s+v.stock_count,0); const isSel = selectedColor===color; return <button key={color} onClick={() => { setSelectedColors(p=>({...p,[activeProduct.id]:color})); setSelectedSizes(p=>({...p,[activeProduct.id]:null})) }} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:20,border:isSel?'2px solid #BFD900':'1.5px solid #e0e0e0',background:isSel?'#fafde8':'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,color:isSel?'#6a7700':'#2a2a2a',fontWeight:isSel?600:400,opacity:colorStock===0?0.4:1}}><div style={{width:14,height:14,borderRadius:'50%',background:hex||'#e0e0e0',border:'1px solid rgba(0,0,0,0.1)',flexShrink:0}} />{color}{colorStock===0&&<span style={{fontSize:10,color:'#e74c3c'}}>нет</span>}</button> })}
                </div>
              </div>
            )}
            {hasSize && variants.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Размер</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  {variants.map(v => { const isSel=selectedSize===v.size; const isOut=v.stock_count===0; return <button key={v.id} disabled={isOut} onClick={() => setSelectedSizes(p=>({...p,[activeProduct.id]:v.size}))} style={{padding:'8px 0',width:52,textAlign:'center',borderRadius:10,border:isSel?'2px solid #BFD900':'1.5px solid #e0e0e0',background:isSel?'#fafde8':isOut?'#f5f5f5':'#fff',fontSize:13,fontWeight:isSel?600:400,color:isSel?'#6a7700':isOut?'#BDBDBD':'#2a2a2a',textDecoration:isOut?'line-through':'none',cursor:isOut?'default':'pointer',fontFamily:'Inter,sans-serif'}}>{v.size}{!isOut&&v.stock_count<=2&&<div style={{fontSize:9,color:'#f39c12',marginTop:1}}>мало</div>}</button> })}
                </div>
              </div>
            )}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:14}}>
              <div>
                {selectedVariant ? <><div style={{fontSize:28,fontWeight:300,color:'#2a2a2a',lineHeight:1}}>{Number(selectedVariant.price).toLocaleString('ru-RU')} <span style={{fontSize:14,color:'#BDBDBD'}}>₽</span></div>{selectedVariant.coins_price&&<div style={{fontSize:12,color:'#f39c12',marginTop:4}}>или {selectedVariant.coins_price} 🪙 SDTшек</div>}</> : <div style={{fontSize:16,color:'#888'}}>{isFinite(minPrice)?`от ${minPrice.toLocaleString('ru-RU')} ₽`:'—'}</div>}
              </div>
              {selectedVariant && hasSize && <div style={{fontSize:12,color:'#888'}}>{selectedColor} / {selectedVariant.size}</div>}
            </div>
            {totalStock === 0 && activeProduct.allow_preorder ? (
              <button onClick={() => handlePreorder(activeProduct.id)} disabled={preordering||alreadyPreordered} style={{width:'100%',padding:14,borderRadius:14,border:`1.5px solid ${alreadyPreordered?'#e0e0e0':'#f39c12'}`,background:alreadyPreordered?'#f5f5f5':'#fef9e7',color:alreadyPreordered?'#BDBDBD':'#f39c12',fontSize:14,fontWeight:700,cursor:alreadyPreordered?'default':'pointer',fontFamily:'Inter,sans-serif'}}>{alreadyPreordered?'✓ Ты уже в списке ожидания':'🔔 Хочу — привезите больше!'}</button>
            ) : (
              <>
                <button disabled={totalStock===0||(hasSize&&!selectedVariant)} onClick={() => alert('Оплата скоро будет доступна!')} style={{width:'100%',padding:14,borderRadius:14,border:'none',background:totalStock===0?'#f0f0f0':(!hasSize||selectedVariant)?'#BFD900':'#f0f0f0',color:totalStock===0?'#BDBDBD':(!hasSize||selectedVariant)?'#2a2a2a':'#888',fontSize:14,fontWeight:700,cursor:(totalStock===0||(hasSize&&!selectedVariant))?'default':'pointer',fontFamily:'Inter,sans-serif',transition:'background 0.15s'}}>{totalStock===0?'Нет в наличии':hasSize&&!selectedVariant?'Выберите размер':`Купить — ${selectedVariant?Number(selectedVariant.price).toLocaleString('ru-RU'):''} ₽`}</button>
                {selectedVariant?.coins_price && totalStock > 0 && <button onClick={() => alert('Для оплаты SDTшками обратись к администратору студии 🪙')} style={{width:'100%',marginTop:8,padding:12,borderRadius:14,border:'1.5px solid #f39c12',background:'#fef9e7',color:'#f39c12',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>🪙 Купить за {selectedVariant.coins_price} SDTшек</button>}
              </>
            )}
          </div>
        </div>
        {otherProducts.length > 0 && (
          <div>
            <div style={{fontSize:11,color:'#BDBDBD',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:10}}>Ещё в магазине</div>
            {otherProducts.map((op,idx) => { const opStock=(op.merch_variants||[]).filter(v=>v.is_active).reduce((s,v)=>s+v.stock_count,0); const opMinPrice=Math.min(...(op.merch_variants||[]).filter(v=>v.is_active&&v.stock_count>0).map(v=>v.price).filter(Boolean)); return <div key={op.id} onClick={() => switchProduct(op.id)} style={{background:'#fff',borderRadius:14,border:'1px solid #f0f0f0',display:'flex',gap:12,padding:12,alignItems:'center',marginBottom:8,cursor:'pointer',opacity:cardVisible?1:0,transform:cardVisible?'translateY(0)':'translateY(-8px)',transition:`opacity ${0.3+idx*0.06}s ease, transform ${0.3+idx*0.06}s ease`}}>{op.image_url?<img src={op.image_url} alt="" style={{width:60,height:60,borderRadius:10,objectFit:'cover',flexShrink:0}} />:<div style={{width:60,height:60,borderRadius:10,background:'#f5f5f5',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>📦</div>}<div style={{flex:1,minWidth:0}}><div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:3}}><span style={{fontSize:14,fontWeight:600,color:'#2a2a2a'}}>{op.name}</span>{op.badge_text&&<span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:20,background:(op.badge_color||'#BFD900')+'22',color:op.badge_color||'#6a7700'}}>{op.badge_text}</span>}</div><span style={{fontSize:12,color:opStock===0?'#e74c3c':opStock<=3?'#f39c12':'#888'}}>{opStock===0?'Нет в наличии':opStock<=3?`Осталось ${opStock} шт`:isFinite(opMinPrice)?`от ${opMinPrice.toLocaleString('ru-RU')} ₽`:'—'}</span></div><span style={{fontSize:18,color:'#BDBDBD',flexShrink:0}}>›</span></div> })}
          </div>
        )}
      </div>
    )
  }

  // ── Карточка препода ───────────────────────────────────────────────────────
  const TeacherDetail = () => (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
        <div onClick={() => goTeacher(null)} style={{cursor:'pointer', color:'#BDBDBD', fontSize:20}}>←</div>
        <div style={{fontSize:16, fontWeight:600, color:'#2a2a2a'}}>{getName(teacherData)}</div>
      </div>
      {teacherData.avatar_url && <div style={{display:'flex', justifyContent:'center', marginBottom:16}}><img src={teacherData.avatar_url} alt="" style={{width:200, height:200, objectFit:'cover', borderRadius:16}} /></div>}
      {teacherData.bio && <div style={{fontSize:13, color:'#888', lineHeight:1.6, marginBottom:12}}>{teacherData.bio}</div>}
      {groups.length > 0 && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Ведёт группы</div>
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>{groups.map(g => <span key={g} style={{fontSize:12, background:'#f5f5f5', color:'#2a2a2a', padding:'4px 12px', borderRadius:20}}>{g}</span>)}</div>
        </div>
      )}

      <div style={{display:'flex', borderBottom:'1px solid #f0f0f0', marginBottom:16}}>
        {[['indiv','Пакеты'],['slots','Записаться']].map(([v,l]) => (
          <div key={v} onClick={() => setIndivTab(v)} style={{padding:'10px 16px', fontSize:13, cursor:'pointer', color:indivTab===v?'#2a2a2a':'#BDBDBD', borderBottom:indivTab===v?'2px solid #BFD900':'2px solid transparent', fontWeight:indivTab===v?600:400}}>{l}</div>
        ))}
      </div>

      {indivTab === 'indiv' && (
        indivProducts.length === 0 ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Индивы не настроены</div>
        : indivProducts.map(p => (
          <div key={p.id} style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:16, marginBottom:12}}>
            <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>{p.name}</div>
            <div style={{fontSize:11, color:'#BDBDBD', marginBottom:8}}>{p.visits_count} {p.visits_count===1?'занятие':p.visits_count<5?'занятия':'занятий'} · {p.duration_days} дней</div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontSize:20, color:'#2a2a2a', fontWeight:300}}>{Number(p.price).toLocaleString()} <span style={{fontSize:12, color:'#BDBDBD'}}>₽</span></div>
              <button onClick={() => alert('Оплата скоро будет доступна!')} style={{background:'#BFD900', border:'none', borderRadius:12, padding:'9px 20px', fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Купить</button>
            </div>
          </div>
        ))
      )}

      {indivTab === 'slots' && (
        <div style={{paddingBottom:20}}>
          {clientPackage ? (
            <div style={{background:'#eafaf1', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#27ae60'}}>
              ✓ Есть пакет · осталось {clientPackage.visits_total - clientPackage.visits_used} занятий
            </div>
          ) : (
            <div style={{background:'#fef9e7', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#f39c12'}}>
              Нет активного пакета — после записи нужно оплатить индив
            </div>
          )}

          {bookingDone && (
            <div style={{background:'#eafaf1', borderRadius:12, padding:16, marginBottom:16, textAlign:'center'}}>
              <div style={{fontSize:20, marginBottom:6}}>✅</div>
              <div style={{fontSize:14, fontWeight:600, color:'#27ae60', marginBottom:4}}>Запрос отправлен!</div>
              <div style={{fontSize:12, color:'#888'}}>{bookingDone}</div>
              <div style={{fontSize:12, color:'#888', marginTop:4}}>Администратор подтвердит и свяжется с вами</div>
              <button onClick={() => setBookingDone(null)} style={{marginTop:12, background:'#BFD900', border:'none', borderRadius:10, padding:'8px 20px', fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Записаться ещё</button>
            </div>
          )}

          {bookingError && <div style={{background:'#fdecea', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#e74c3c'}}>{bookingError}</div>}

          {Object.keys(slotsByDate).length === 0 ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Расписание не указано</div>
          ) : Object.entries(slotsByDate).map(([dateStr, daySlots]) => {
            const d = new Date(dateStr + 'T00:00:00')
            return (
              <div key={dateStr} style={{marginBottom:16}}>
                <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>
                  {DAYS_SHORT[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()]}
                </div>
                {daySlots.map(s => (
                  <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', borderRadius:12, padding:'10px 14px', marginBottom:6, border:'1px solid #f0f0f0'}}>
                    <div style={{fontSize:13, color:'#2a2a2a'}}>{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</div>
                    <button disabled={savingSlot && bookingSlot === s.id} onClick={() => handleBook(dateStr, s)}
                      style={{background:'#BFD900', border:'none', borderRadius:8, padding:'6px 16px', fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: savingSlot && bookingSlot === s.id ? 0.5 : 1}}>
                      {savingSlot && bookingSlot === s.id ? '...' : 'Записаться'}
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const TeacherList = () => (
    teachers.length === 0 ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Преподаватели не найдены</div>
    : (
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        {teachers.map(t => (
          <div key={t.id} onClick={() => goTeacher(t.id)} style={{background:'#fff', borderRadius:16, overflow:'hidden', border:'1px solid #f0f0f0', cursor:'pointer'}}>
            {t.avatar_url ? <img src={t.avatar_url} alt="" style={{width:'100%', height:140, objectFit:'cover'}} /> : (
              <div style={{width:'100%', height:140, background:'linear-gradient(135deg, #2a2a2a, #444)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <div style={{width:48, height:48, background:'#BFD900', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#2a2a2a'}}>{initials(t)}</div>
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
            <div key={cat.id} onClick={() => goCat(cat.id)} style={{flexShrink:0, padding:'6px 14px', borderRadius:12, border:activeCat===cat.id?'none':'1px solid #e0e0e0', background:activeCat===cat.id?'#BFD900':'#fff', color:activeCat===cat.id?'#2a2a2a':'#BDBDBD', fontSize:12, cursor:'pointer', fontWeight:activeCat===cat.id?600:400}}>{cat.label}</div>
          ))}
        </div>
      </div>

      <div style={{padding:'0 20px 20px'}}>
        {activeCat === 'merch' ? <MerchSection />
        : activeCat === 'events' ? (
          eventsLoading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
          : events.length === 0 ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Мероприятий пока нет</div>
          : events.map(ev => {
            const dates = (ev.event_dates || []).sort((a,b) => a.sort_order - b.sort_order)
            const tiers = (ev.event_price_tiers || []).sort((a,b) => a.position_from - b.position_from)
            const formatDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'short' }) : null
            const dateStr = dates.length > 0 ? dates.map(d => `${formatDate(d.date_start)}${d.date_end && d.date_end !== d.date_start ? `–${formatDate(d.date_end)}` : ''}${d.label ? ` (${d.label})` : ''}`).join(', ') : null
            const priceStr = tiers.length > 0 ? `от ${Math.min(...tiers.map(t => t.price)).toLocaleString('ru-RU')} ₽` : ev.price ? `${Number(ev.price).toLocaleString('ru-RU')} ₽` : null
            return (
              <div key={ev.id} style={{background:'#fff', borderRadius:20, border:'1px solid #f0f0f0', overflow:'hidden', marginBottom:12}}>
                {ev.image_url && <img src={ev.image_url} alt="" style={{width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block'}} />}
                <div style={{padding:16}}>
                  <div style={{fontSize:16, fontWeight:600, color:'#2a2a2a', marginBottom:6}}>{ev.name}</div>
                  {dateStr && <div style={{fontSize:12, color:'#2980b9', marginBottom:6}}>📅 {dateStr}</div>}
                  {ev.description && <div style={{fontSize:13, color:'#888', lineHeight:1.6, marginBottom:10}}>{ev.description}</div>}
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
                    {ev.hall && <span style={{fontSize:11, background:'#f5f5f5', color:'#888', padding:'3px 10px', borderRadius:20}}>{ev.hall}</span>}
                    {ev.age_info && <span style={{fontSize:11, background:'#f5f5f5', color:'#888', padding:'3px 10px', borderRadius:20}}>{ev.age_info}</span>}
                    {ev.max_participants && <span style={{fontSize:11, background:'#f5f5f5', color:'#888', padding:'3px 10px', borderRadius:20}}>до {ev.max_participants} чел.</span>}
                  </div>
                  {tiers.length > 0 && <div style={{marginBottom:12}}>{tiers.map((t,i) => <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f8f8f8', fontSize:13}}><span style={{color:'#888'}}>{t.label || `Места ${t.position_from}–${t.position_to || '∞'}`}</span><span style={{fontWeight:600, color:'#2a2a2a'}}>{Number(t.price).toLocaleString('ru-RU')} ₽</span></div>)}</div>}
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    {priceStr && <div style={{fontSize:20, fontWeight:300, color:'#2a2a2a'}}>{priceStr}</div>}
                    <button onClick={() => alert('Оплата скоро будет доступна!')} style={{background:'#BFD900', border:'none', borderRadius:12, padding:'10px 24px', fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Записаться</button>
                  </div>
                </div>
              </div>
            )
          })
        ) : activeCat === 'indiv' ? (
          indivLoading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
          : selectedTeacher && teacherData ? <TeacherDetail /> : <TeacherList />
        ) : loading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
        : current.length === 0 ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Пока ничего нет</div>
        : current.map(product => (
          <div key={product.id} style={{background:product.is_featured?'#fafde8':'#fff', border:product.is_featured?`1.5px solid ${product.badge_color||'#BFD900'}`:'1px solid #efefef', borderRadius:20, padding:18, marginBottom:12}}>
            {product.is_featured && <div style={{display:'inline-block', background:product.badge_color||'#BFD900', color:(product.badge_color==='#BFD900'||product.badge_color==='#f39c12'||product.badge_color==='#e0e0e0')?'#2a2a2a':'#fff', fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'3px 10px', borderRadius:8, marginBottom:10}}>{product.badge_text||'Популярный'}</div>}
            <div style={{fontSize:14, color:'#2a2a2a', fontWeight:400, marginBottom:4, fontFamily:'sans-serif'}}>{product.name}</div>
            {product.description && <div style={{fontSize:12, color:'#BDBDBD', marginBottom:14, lineHeight:1.5}}>{product.description}</div>}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontSize:18, color:'#2a2a2a', fontFamily:'sans-serif'}}>{Number(product.price).toLocaleString()} <span style={{fontSize:11, color:'#BDBDBD'}}>₽</span></div>
              <button onClick={() => setSelected(product)} style={{background:product.is_featured?(product.badge_color||'#BFD900'):'transparent', color:product.is_featured?((product.badge_color==='#BFD900'||product.badge_color==='#f39c12'||product.badge_color==='#e0e0e0')?'#2a2a2a':'#fff'):'#BDBDBD', border:product.is_featured?'none':'1.5px solid #e0e0e0', borderRadius:12, padding:'9px 20px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Купить</button>
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
            <div style={{fontSize:24, color:'#2a2a2a', fontWeight:300, marginBottom:20}}>{Number(selected.price).toLocaleString()} <span style={{fontSize:14, color:'#BDBDBD'}}>₽</span></div>
            <button onClick={() => alert('Оплата скоро будет доступна!')} style={{width:'100%', padding:14, background:'#BFD900', border:'none', borderRadius:14, fontSize:14, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', marginBottom:10}}>Оплатить {Number(selected.price).toLocaleString()} ₽</button>
            <button onClick={() => setSelected(null)} style={{width:'100%', padding:14, background:'transparent', border:'1px solid #e0e0e0', borderRadius:14, fontSize:14, color:'#BDBDBD', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}