import { useState, useEffect, useRef } from 'react'
import AvatarUpload from '../components/AvatarUpload'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'

const TABS = ['Основное', 'Представители', 'Покупки', 'Посещения', 'Комментарии', 'Задачи', 'Бонусы']

const TYPE_LABELS = { subscription:'Абонемент', service:'Услуга', indiv:'Индив', merch:'Мерч', event:'Мероприятие', other:'Другое' }
const PAYMENT_LABELS = { cash:'💵 Наличные', bank:'🏦 Безнал', online:'💳 Эквайринг', bonus:'🎁 Баллы', coins:'🪙 SDTшки' }
const PAYMENT_METHODS = [
  { id:'cash',   label:'💵 Наличные',  hint:'без комиссии' },
  { id:'bank',   label:'🏦 Безнал',    hint:'без комиссии' },
  { id:'online', label:'💳 Эквайринг', hint:'комиссия по настройкам' },
  { id:'bonus',  label:'🎁 Баллы',     hint:'1 балл = 1 ₽, выручка 0' },
  { id:'coins',  label:'🪙 SDTшки',    hint:'списание с баланса, выручка 0' },
]
const PRODUCT_TYPES = [
  { id:'subscription', label:'Абонемент' },
  { id:'service',      label:'Услуга' },
  { id:'indiv',        label:'Индив' },
  { id:'event',        label:'Мероприятие' },
  { id:'merch',        label:'Мерч' },
]
const TASK_STATUS = {
  new:        { label:'Новая',          color:'#2980b9', bg:'#e8f4fd' },
  in_progress:{ label:'В работе',       color:'#f39c12', bg:'#fef9e7' },
  done:       { label:'Выполнена',      color:'#27ae60', bg:'#eafaf1' },
  cancelled:  { label:'Отменена',       color:'#BDBDBD', bg:'#f5f5f5' },
  postponed:  { label:'Перенесена',     color:'#8e44ad', bg:'#f5eef8' },
  problem:    { label:'Есть трудности', color:'#e74c3c', bg:'#fdecea' },
}
const TASK_PRIORITY = {
  low:    { label:'Низкий',  color:'#BDBDBD' },
  normal: { label:'Средний', color:'#f39c12' },
  high:   { label:'Высокий', color:'#e74c3c' },
}
const ACTIVE = ['new','in_progress','postponed','problem']
const AD_SOURCE_LABELS = {
  instagram:'Instagram', vk:'ВКонтакте', telegram:'Telegram',
  word_of_mouth:'Сарафанное радио', google:'Google',
  yandex:'Яндекс', '2gis':'2ГИС', other:'Другое',
}

// ─── SaleModal ────────────────────────────────────────────────────────────────
function SaleModal({ client, session, onClose, onSuccess }) {
  const [items, setItems] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedGroupIds, setSelectedGroupIds] = useState([])
  const [representatives, setRepresentatives] = useState([])
  const [payerType, setPayerType] = useState('client')
  const [payerRepId, setPayerRepId] = useState('')
  const [payerName, setPayerName] = useState('')
  const [discountMode, setDiscountMode] = useState('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [bonusRublesUse, setBonusRublesUse] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [comment, setComment] = useState('')
  const [acquiringPercent, setAcquiringPercent] = useState(2.5)
  const [saving, setSaving] = useState(false)
  const [productsByType, setProductsByType] = useState([])
  const [productType, setProductType] = useState('subscription')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)

  const hasSubItems = items.some(i => i.product_type === 'subscription' || i.product_type === 'service')
  const fmtMoney = (n) => (Number(n)||0).toLocaleString('ru-RU') + ' ₽'

  useEffect(() => {
    supabase.from('finance_settings').select('value').eq('key','acquiring_fee_percent').single()
      .then(({ data }) => { if (data) setAcquiringPercent(parseFloat(data.value)||2.5) })
    supabase.from('groups').select('*').order('name').then(({ data }) => setGroups(data||[]))
    supabase.from('client_representatives').select('*').eq('client_id',client.id).then(({ data }) => setRepresentatives(data||[]))
  }, [])

  useEffect(() => {
    setLoadingProducts(true); setSelectedProduct('')
    supabase.from('products')
      .select('*, product_indivs(teacher_id, profiles:teacher_id(full_name)), product_subscriptions(available_from_day, available_to_day)')
      .eq('type',productType).eq('is_active',true).order('price')
      .then(({ data }) => {
        const today = new Date().getDate()
        const filtered = (data||[]).filter(p => {
          const ps = p.product_subscriptions?.[0]
          if (!ps?.available_from_day || !ps?.available_to_day) return true
          return today >= ps.available_from_day && today <= ps.available_to_day
        })
        setProductsByType(filtered)
        setLoadingProducts(false)
      })
  }, [productType])

  useEffect(() => { if (!hasSubItems) setSelectedGroupIds([]) }, [hasSubItems])

  const subtotal = items.reduce((sum, i) => sum + i.price, 0)
  const discountAmount = discountValue
    ? discountMode === 'percent' ? Math.round(subtotal * parseFloat(discountValue) / 100) : parseFloat(discountValue)||0
    : 0
  const bonusRublesUsed = parseFloat(bonusRublesUse)||0
  const afterDiscount = Math.max(0, subtotal - discountAmount - bonusRublesUsed)
  const acquiringFee = paymentMethod === 'online' ? Math.round(afterDiscount * acquiringPercent / 100) : 0

  const addProduct = () => {
    const p = productsByType.find(p => p.id === selectedProduct)
    if (!p) return
    setItems([...items, {
      product_id: p.id, product_type: productType, product_name: p.name, price: p.price,
      teacher_id: p.product_indivs?.[0]?.teacher_id || null,
      teacher_name: p.product_indivs?.[0]?.profiles?.full_name || null
    }])
    setSelectedProduct('')
  }

  const handleSubmit = async () => {
    if (saving) return
    if (!items.length || !paymentMethod) return
    if (discountAmount > 0 && !discountReason.trim()) { alert('Укажите причину скидки'); return }
    if (bonusRublesUsed > 0 && bonusRublesUsed > (client.bonus_rubles||0)) {
      alert(`Нельзя списать ${bonusRublesUsed} ₽ — на балансе только ${client.bonus_rubles||0} ₽`); return
    }
    setSaving(true)

    const { data, error } = await supabase.rpc('create_sale', {
      p_payload: {
        client_id: client.id,
        items: items.map(i => ({
          product_id: i.product_id, product_type: i.product_type,
          product_name: i.product_name, price: i.price,
          teacher_id: i.teacher_id || null,
        })),
        discount_amount: discountAmount,
        discount_percent: discountMode === 'percent' ? (parseFloat(discountValue) || 0) : 0,
        discount_reason: discountReason || null,
        bonus_rubles_used: bonusRublesUsed,
        payment_method: paymentMethod,
        acquiring_fee_percent: acquiringPercent,
        payer_type: payerType,
        payer_representative_id: payerType === 'representative' ? payerRepId || null : null,
        payer_name: payerType === 'other' ? payerName || null : null,
        comment: comment || null,
        selected_group_ids: selectedGroupIds,
      },
    })

    if (error) { alert('Ошибка сети: ' + error.message); setSaving(false); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated:        'Сессия истекла, войдите заново',
        forbidden:                'Недостаточно прав',
        no_items:                 'Чек пуст',
        no_client:                'Не выбран клиент',
        no_payment_method:        'Не выбран способ оплаты',
        negative_amount:          'Отрицательные суммы недопустимы',
        discount_reason_required: 'Укажите причину скидки',
        client_not_found:         'Клиент не найден',
        insufficient_bonus_rubles: `На балансе только ${data.balance ?? 0} ₽, нужно ${data.required ?? bonusRublesUsed} ₽`,
        discount_exceeds_subtotal: `Скидка + бонусы (${(data.discount ?? 0) + (data.bonus ?? 0)} ₽) больше суммы чека (${data.subtotal ?? 0} ₽)`,
        groups_required:          'Для абонемента/услуги нужно выбрать хотя бы одну группу',
      }[data?.error] || `Не удалось оформить продажу: ${data?.error || 'неизвестная ошибка'}`
      alert(msg)
      setSaving(false); return
    }

    setSaving(false)
    onSuccess()
  }

  const iStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', outline:'none' }

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:1000,overflowY:'auto',padding:'24px 16px'}}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:560,padding:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontSize:16,fontWeight:600,color:'#2a2a2a'}}>Продажа</div>
            <div style={{fontSize:12,color:'#BDBDBD',marginTop:2}}>{client.full_name||client.email}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#BDBDBD',lineHeight:1}}>×</button>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:8}}>Что продаём</div>
          <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
            {PRODUCT_TYPES.map(t => (
              <button key={t.id} onClick={() => setProductType(t.id)} style={{padding:'5px 12px',borderRadius:8,border:productType===t.id?'none':'1px solid #e0e0e0',background:productType===t.id?'#BFD900':'#fff',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:productType===t.id?600:400}}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} style={{...iStyle,flex:1}}>
              <option value="">{loadingProducts?'Загрузка...':productsByType.length===0?'Нет продуктов':'Выберите продукт'}</option>
              {productsByType.map(p => <option key={p.id} value={p.id}>{p.name} — {fmtMoney(p.price)}</option>)}
            </select>
            <button onClick={addProduct} disabled={!selectedProduct} style={{padding:'8px 16px',background:selectedProduct?'#BFD900':'#e8e8e8',border:'none',borderRadius:10,fontSize:12,fontWeight:700,color:selectedProduct?'#2a2a2a':'#BDBDBD',cursor:selectedProduct?'pointer':'not-allowed',fontFamily:'Inter,sans-serif'}}>+ В чек</button>
          </div>
          {items.length > 0 && (
            <div style={{marginTop:10}}>
              {items.map((item,idx) => (
                <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'0.5px solid #f0f0f0',fontSize:13}}>
                  <div>
                    <span style={{fontWeight:500,color:'#2a2a2a'}}>{item.product_name}</span>
                    {item.teacher_name && <span style={{fontSize:11,color:'#BDBDBD',marginLeft:6}}>{item.teacher_name}</span>}
                  </div>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <span style={{fontWeight:600}}>{fmtMoney(item.price)}</span>
                    <button onClick={() => setItems(items.filter((_,i) => i!==idx))} style={{color:'#e74c3c',background:'none',border:'none',cursor:'pointer',fontSize:16,lineHeight:1}}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {hasSubItems && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:8}}>
              Доступные группы <span style={{color:'#e74c3c'}}>*</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {groups.map(g => (
                <label key={g.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:10,background:selectedGroupIds.includes(g.id)?'#fafde8':'#f9f9f9',border:selectedGroupIds.includes(g.id)?'1px solid #BFD900':'1px solid #f0f0f0',cursor:'pointer',fontSize:13}}>
                  <input type="checkbox" checked={selectedGroupIds.includes(g.id)} onChange={() => setSelectedGroupIds(prev => prev.includes(g.id)?prev.filter(x=>x!==g.id):[...prev,g.id])} style={{accentColor:'#BFD900'}} />
                  {g.name}{g.is_closed && <span style={{fontSize:11,color:'#e74c3c',marginLeft:4}}>🔒</span>}
                </label>
              ))}
            </div>
            {selectedGroupIds.length === 0 && (
              <div style={{marginTop:8,fontSize:11,color:'#e74c3c',background:'#fdecea',borderRadius:6,padding:'6px 10px'}}>
                ⚠️ Выберите хотя бы одну группу — без этого продажа не оформится
              </div>
            )}
          </div>
        )}
        {items.length > 0 && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:8}}>Кто платит</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {[['client','Сам клиент'],['representative','Представитель'],['other','Другой человек']].map(([v,l]) => (
                <button key={v} onClick={() => setPayerType(v)} style={{padding:'6px 12px',borderRadius:8,border:payerType===v?'none':'1px solid #e0e0e0',background:payerType===v?'#BFD900':'#fff',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:payerType===v?600:400}}>{l}</button>
              ))}
            </div>
            {payerType === 'representative' && representatives.length > 0 && (
              <select value={payerRepId} onChange={e => setPayerRepId(e.target.value)} style={{...iStyle,marginTop:8}}>
                <option value="">Выберите представителя</option>
                {representatives.map(r => <option key={r.id} value={r.id}>{r.full_name} ({r.role})</option>)}
              </select>
            )}
            {payerType === 'other' && <input value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="Имя плательщика" style={{...iStyle,marginTop:8}} />}
          </div>
        )}
        {items.length > 0 && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:8}}>Скидка и баллы</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:11,color:'#BDBDBD',marginBottom:4}}>Скидка</div>
                <div style={{display:'flex',gap:4,marginBottom:4}}>
                  <button onClick={() => setDiscountMode('percent')} style={{flex:1,padding:'5px',borderRadius:6,border:discountMode==='percent'?'none':'1px solid #e0e0e0',background:discountMode==='percent'?'#BFD900':'#fff',fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>%</button>
                  <button onClick={() => setDiscountMode('fixed')} style={{flex:1,padding:'5px',borderRadius:6,border:discountMode==='fixed'?'none':'1px solid #e0e0e0',background:discountMode==='fixed'?'#BFD900':'#fff',fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>₽</button>
                </div>
                <input value={discountValue} onChange={e => setDiscountValue(e.target.value)} type="number" placeholder="0" style={iStyle} />
              </div>
              <div>
                <div style={{fontSize:11,color:'#BDBDBD',marginBottom:4}}>Причина скидки</div>
                <div style={{marginBottom:4,height:22}} />
                <input value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder={discountAmount>0?'Обязательно *':'Причина'} style={{...iStyle,borderColor:discountAmount>0&&!discountReason.trim()?'#f39c12':'#e8e8e8'}} />
              </div>
            </div>
            <div style={{fontSize:11,color:'#BDBDBD',marginBottom:4}}>Списать баллы (доступно: {client.bonus_rubles||0} ₽)</div>
            <input value={bonusRublesUse} onChange={e => setBonusRublesUse(e.target.value)} type="number" min="0" placeholder="0"
              style={{...iStyle,maxWidth:160,borderColor:bonusRublesUsed>(client.bonus_rubles||0)?'#e74c3c':'#e8e8e8',transition:'border-color 0.2s'}} />
            {bonusRublesUsed > (client.bonus_rubles||0) && (
              <div style={{fontSize:11,color:'#e74c3c',marginTop:4}}>⚠️ На балансе только {client.bonus_rubles||0} ₽</div>
            )}
          </div>
        )}
        {items.length > 0 && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:'#888',fontWeight:600,marginBottom:8}}>Способ оплаты</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {PAYMENT_METHODS.map(m => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)} style={{padding:'10px 12px',borderRadius:10,border:paymentMethod===m.id?'2px solid #BFD900':'1px solid #e0e0e0',background:paymentMethod===m.id?'#fafde8':'#fff',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>
                  <div style={{fontWeight:paymentMethod===m.id?600:400,color:'#2a2a2a'}}>{m.label}</div>
                  <div style={{fontSize:10,color:'#BDBDBD',marginTop:2}}>{m.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {items.length > 0 && (
          <div style={{background:'#f9f9f9',borderRadius:12,padding:16}}>
            {[
              ['Сумма позиций', fmtMoney(subtotal)],
              discountAmount>0 ? ['Скидка','− '+fmtMoney(discountAmount)] : null,
              bonusRublesUsed>0 ? ['Баллы','− '+fmtMoney(bonusRublesUsed)] : null,
              acquiringFee>0 ? [`Эквайринг (${acquiringPercent}%)`,'− '+fmtMoney(acquiringFee)] : null,
            ].filter(Boolean).map(([label,value],i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',padding:'4px 0'}}>
                <span>{label}</span><span>{value}</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',fontSize:16,fontWeight:700,color:'#2a2a2a',marginTop:8,paddingTop:8,borderTop:'1px solid #e8e8e8'}}>
              <span>К оплате:</span><span>{fmtMoney(afterDiscount)}</span>
            </div>
            <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Комментарий к продаже..." style={{...iStyle,marginTop:12}} />
            {(() => {
              const groupsMissing = hasSubItems && selectedGroupIds.length === 0
              const btnDisabled = saving || groupsMissing
              return (
                <button onClick={handleSubmit} disabled={btnDisabled}
                  style={{width:'100%',padding:'11px',background:btnDisabled?'#e8e8e8':'#BFD900',border:'none',borderRadius:10,fontSize:14,fontWeight:700,color:btnDisabled?'#BDBDBD':'#2a2a2a',cursor:btnDisabled?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',marginTop:10}}
                  title={groupsMissing ? 'Сначала выберите доступную группу' : ''}>
                  {saving ? 'Оформляем...' : groupsMissing ? 'Выберите группу для абонемента' : '✅ Пробить продажу'}
                </button>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── VisitsTab ────────────────────────────────────────────────────────────────
function VisitsTab({ clientId }) {
  const [bookings, setBookings] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('bookings')
  const fmtDT = (d) => d ? new Date(d).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'

  useEffect(() => { load() }, [clientId])

  const load = async () => {
    setLoading(true)
    // limit(100) защищает от тяги всей истории на клиентах с многолетним
    // стажем. Снизу таба показывается «показано последние 100».
    const { data: b } = await supabase.from('bookings')
      .select('*, schedule(id,title,starts_at,ends_at,hall,teacher_id,teacher:teacher_id(full_name)), creator:created_by(full_name,email,role)')
      .eq('student_id',clientId).order('created_at',{ ascending:false }).limit(100)
    setBookings(b||[])
    const { data: a } = await supabase.from('attendance')
      .select('*, schedule(id,title,starts_at,ends_at,hall,teacher:teacher_id(full_name)), marker:marked_by(full_name,email)')
      .eq('student_id',clientId).order('created_at',{ ascending:false }).limit(100)
    setAttendance(a||[])
    setLoading(false)
  }

  const BOOKING_STATUS = {
    booked:    { label:'Записан',       color:'#2980b9', bg:'#e8f4fd' },
    confirmed: { label:'Подтверждён',   color:'#27ae60', bg:'#eafaf1' },
    cancelled: { label:'Отменён',       color:'#e74c3c', bg:'#fdecea' },
  }
  const ATTENDANCE_STATUS = {
    present:     { label:'✅ Присутствовал', color:'#27ae60', bg:'#eafaf1' },
    absent:      { label:'❌ Отсутствовал', color:'#e74c3c', bg:'#fdecea' },
    cancelled:   { label:'🚫 Отменено',     color:'#BDBDBD', bg:'#f5f5f5' },
    transferred: { label:'🔄 Перенесено',   color:'#8e44ad', bg:'#f5eef8' },
  }
  const ROLE_LABELS = { owner:'Владелец', manager:'Управляющий', admin:'Администратор', teacher:'Преподаватель' }

  if (loading) return <div style={{textAlign:'center',color:'#BDBDBD',padding:30}}>Загрузка...</div>

  return (
    <div>
      <div style={{display:'flex',gap:4,background:'#f5f5f5',borderRadius:10,padding:3,marginBottom:16,width:'fit-content'}}>
        <button onClick={() => setView('bookings')} style={{padding:'6px 16px',borderRadius:8,border:'none',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',background:view==='bookings'?'#fff':'transparent',color:view==='bookings'?'#2a2a2a':'#888',fontWeight:view==='bookings'?600:400}}>
          📋 Записи {bookings.length>0 && `(${bookings.length})`}
        </button>
        <button onClick={() => setView('attendance')} style={{padding:'6px 16px',borderRadius:8,border:'none',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',background:view==='attendance'?'#fff':'transparent',color:view==='attendance'?'#2a2a2a':'#888',fontWeight:view==='attendance'?600:400}}>
          ✅ Посещения {attendance.length>0 && `(${attendance.length})`}
        </button>
      </div>
      {view === 'bookings' && (
        <div>
          {bookings.length===0 ? (
            <div style={{textAlign:'center',color:'#BDBDBD',padding:30}}>Записей нет</div>
          ) : bookings.map(b => {
            const st = BOOKING_STATUS[b.status]||{ label:b.status, color:'#888', bg:'#f5f5f5' }
            const isClient = !b.created_by
            return (
              <div key={b.id} style={{border:'0.5px solid #e8e8e8',borderRadius:12,padding:'12px 16px',marginBottom:8,background:'#fff'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#2a2a2a',marginBottom:4}}>{b.schedule?.title||'—'}</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:11,color:'#BDBDBD'}}>
                      {b.schedule?.starts_at && <span>📅 {fmtDT(b.schedule.starts_at)}</span>}
                      {b.schedule?.hall && <span>🏛 {b.schedule.hall}</span>}
                      {b.schedule?.teacher?.full_name && <span>👤 {b.schedule.teacher.full_name}</span>}
                    </div>
                    <div style={{marginTop:6,fontSize:11,color:'#BDBDBD'}}>
                      {isClient ? '📱 Записался сам через приложение'
                        : `👤 Записал: ${b.creator?.full_name||b.creator?.email||'—'}${b.creator?.role?` (${ROLE_LABELS[b.creator.role]||b.creator.role})`:''}`}
                      <span style={{marginLeft:8}}>· {fmtDT(b.created_at)}</span>
                    </div>
                  </div>
                  <span style={{background:st.bg,color:st.color,padding:'3px 10px',borderRadius:8,fontSize:11,fontWeight:600,flexShrink:0}}>{st.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {view === 'attendance' && (
        <div>
          {attendance.length===0 ? (
            <div style={{textAlign:'center',color:'#BDBDBD',padding:30}}>Посещений нет</div>
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
                {[
                  ['Всего', attendance.length, '#2a2a2a', '#f9f9f9'],
                  ['Присутствовал', attendance.filter(a=>a.status==='present').length, '#27ae60', '#eafaf1'],
                  ['Отсутствовал', attendance.filter(a=>a.status==='absent').length, '#e74c3c', '#fdecea'],
                  ['Перенесено', attendance.filter(a=>a.status==='transferred').length, '#8e44ad', '#f5eef8'],
                ].map(([label,count,color,bg]) => (
                  <div key={label} style={{background:bg,borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
                    <div style={{fontSize:20,fontWeight:600,color}}>{count}</div>
                    <div style={{fontSize:10,color:'#BDBDBD',marginTop:2}}>{label}</div>
                  </div>
                ))}
              </div>
              {attendance.map(a => {
                const st = ATTENDANCE_STATUS[a.status]||{ label:a.status, color:'#888', bg:'#f5f5f5' }
                return (
                  <div key={a.id} style={{border:'0.5px solid #e8e8e8',borderRadius:12,padding:'12px 16px',marginBottom:8,background:'#fff'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:600,color:'#2a2a2a',marginBottom:4}}>{a.schedule?.title||'—'}</div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:11,color:'#BDBDBD'}}>
                          {a.schedule?.starts_at && <span>📅 {fmtDT(a.schedule.starts_at)}</span>}
                          {a.schedule?.hall && <span>🏛 {a.schedule.hall}</span>}
                          {a.schedule?.teacher?.full_name && <span>👤 {a.schedule.teacher.full_name}</span>}
                        </div>
                        {a.marked_by && (
                          <div style={{marginTop:6,fontSize:11,color:'#BDBDBD'}}>
                            ✏️ Отметил: {a.marker?.full_name||a.marker?.email||'—'}
                            {a.marked_at && <span style={{marginLeft:8}}>· {fmtDT(a.marked_at)}</span>}
                          </div>
                        )}
                        {a.note && <div style={{marginTop:4,fontSize:11,color:'#888',fontStyle:'italic'}}>💬 {a.note}</div>}
                      </div>
                      <span style={{background:st.bg,color:st.color,padding:'3px 10px',borderRadius:8,fontSize:11,fontWeight:600,flexShrink:0}}>{st.label}</span>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── PurchasesTab ─────────────────────────────────────────────────────────────
function PurchasesTab({ clientId, userRole, session }) {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [historyMap, setHistoryMap] = useState({})
  const [showHistoryId, setShowHistoryId] = useState(null)
  const [dateModal, setDateModal] = useState(null)
  const [dateValue, setDateValue] = useState('')
  const [dateReason, setDateReason] = useState('')
  const [recalcExpires, setRecalcExpires] = useState(false)
  const [dateSaving, setDateSaving] = useState(false)

  const canEditDates = ['admin','manager','owner'].includes(userRole)
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU',{ day:'numeric', month:'short', year:'numeric' }) : '—'
  const fmtDT = (d) => d ? new Date(d).toLocaleString('ru-RU',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'
  const fmtMoney = (n) => (Number(n)||0).toLocaleString('ru-RU') + ' ₽'

  useEffect(() => { load() }, [clientId])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('sales')
      .select('*, creator:created_by(full_name,email,role), subscription:subscriptions!subscriptions_sale_id_fkey(id,activated_at,expires_at,visits_total,visits_used,subscription_allowed_groups(groups(id,name,is_closed)))')
      .eq('client_id',clientId).order('sale_date',{ ascending:false })
    setPurchases((data||[]).map(p => {
      const sub = p.subscription?.[0]||null
      const groups = sub?.subscription_allowed_groups?.map(sag=>sag.groups).filter(Boolean)||[]
      return { ...p, subscription:sub, allowedGroups:groups, productSub:null }
    }))
    setLoading(false)
  }

  const loadHistory = async (subId) => {
    const { data } = await supabase.from('subscription_date_changes')
      .select('*, changer:changed_by(full_name,email)').eq('subscription_id',subId).order('created_at',{ ascending:false })
    setHistoryMap(prev => ({ ...prev, [subId]:data||[] }))
  }

  const toggleHistory = async (subId) => {
    if (showHistoryId===subId) { setShowHistoryId(null); return }
    await loadHistory(subId)
    setShowHistoryId(subId)
  }

  const openDateModal = (subId, field, currentVal, productSub) => {
    setDateModal({ subId, field, productSub })
    setDateValue(currentVal ? currentVal.split('T')[0] : '')
    setDateReason(''); setRecalcExpires(false)
  }

  const saveDateChange = async () => {
    if (!dateValue || !dateReason.trim()) return
    setDateSaving(true)
    const { subId, field, productSub } = dateModal
    // RPC admin_update_subscription делает FOR UPDATE + аудит в
    // subscription_date_changes + проверку visits_used<=visits_total.
    // Передаём ISO YYYY-MM-DD (date), не toISOString — RPC ожидает date.
    const payload = { [field]: dateValue }
    if (field === 'activated_at' && recalcExpires && productSub) {
      const base = new Date(dateValue + 'T12:00:00')
      let exp = null
      if (productSub.fixed_end_day) {
        const d = new Date(base); d.setMonth(d.getMonth() + 1); d.setDate(productSub.fixed_end_day)
        exp = d.toISOString().slice(0, 10)
      } else if (productSub.duration_days) {
        const d = new Date(base); d.setDate(d.getDate() + productSub.duration_days)
        exp = d.toISOString().slice(0, 10)
      }
      if (exp) payload.expires_at = exp
    }
    const { data, error } = await supabase.rpc('admin_update_subscription', {
      p_sub_id: subId, p_payload: payload, p_reason: dateReason,
    })
    setDateSaving(false)
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated:           'Сессия истекла, войдите заново',
        forbidden:                   'Недостаточно прав',
        reason_required:             'Укажите причину',
        subscription_not_found:      'Подписка не найдена',
        visits_used_negative:        'Использованных визитов не может быть меньше 0',
        visits_used_exceeds_total:   `Использовано (${data.visits_used}) больше общего числа (${data.visits_total})`,
      }[data?.error] || `Не удалось обновить: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    setDateModal(null)
    await load()
  }

  const ROLE_LABELS = { owner:'Владелец', manager:'Управляющий', admin:'Администратор', teacher:'Преподаватель' }
  const cellStyle = { background:'#f9f9f9', borderRadius:8, padding:'10px 12px' }
  const cellLabel = { fontSize:11, color:'#BDBDBD', marginBottom:3 }
  const cellValue = { fontSize:13, color:'#2a2a2a', fontWeight:500 }

  if (loading) return <div style={{textAlign:'center',color:'#BDBDBD',padding:30}}>Загрузка...</div>
  if (purchases.length===0) return <div style={{textAlign:'center',color:'#BDBDBD',padding:30}}>Покупок нет</div>

  return (
    <div>
      {purchases.map(p => {
        const isExpanded = expandedId===p.id
        const hasDiscount = Number(p.discount_amount)>0
        const hasBonus = Number(p.bonus_rubles_used)>0
        const priceChanged = Number(p.price_original)!==Number(p.amount_paid)
        const sub = p.subscription
        const isApp = !p.created_by
        const creatorName = p.creator?.full_name||p.creator?.email||'—'
        const creatorRole = ROLE_LABELS[p.creator?.role]||''
        const hasDates = sub && (sub.activated_at||sub.expires_at)
        const history = historyMap[sub?.id]||[]
        return (
          <div key={p.id} style={{border:'0.5px solid #e8e8e8',borderRadius:12,marginBottom:8,overflow:'hidden',background:'#fff'}}>
            <div onClick={() => setExpandedId(isExpanded?null:p.id)}
              style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',cursor:'pointer',background:isExpanded?'#fafafa':'#fff'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:'#2a2a2a',marginBottom:4}}>{p.product_name}</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:11,color:'#BDBDBD'}}>{fmtDate(p.sale_date)}</span>
                  <span style={{fontSize:11,color:'#BDBDBD'}}>·</span>
                  <span style={{background:'#f0f0f0',color:'#888',padding:'2px 8px',borderRadius:6,fontSize:11}}>{PAYMENT_LABELS[p.payment_method]||p.payment_method}</span>
                  <span style={{background:'#f0f0f0',color:'#888',padding:'2px 8px',borderRadius:6,fontSize:11}}>{TYPE_LABELS[p.product_type]||p.product_type}</span>
                  {hasDiscount && <span style={{background:'#fef9e7',color:'#f39c12',padding:'2px 8px',borderRadius:6,fontSize:11}}>Скидка {fmtMoney(p.discount_amount)}</span>}
                  {hasBonus && <span style={{background:'#fafde8',color:'#6a7700',padding:'2px 8px',borderRadius:6,fontSize:11}}>Баллы −{fmtMoney(p.bonus_rubles_used)}</span>}
                  {p.is_cancelled && <span style={{background:'#fdecea',color:'#e74c3c',padding:'2px 8px',borderRadius:6,fontSize:11}}>Отменена</span>}
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:15,fontWeight:700,color:p.is_cancelled?'#BDBDBD':'#2a2a2a',textDecoration:p.is_cancelled?'line-through':'none'}}>{fmtMoney(p.amount_paid)}</div>
                {priceChanged && !p.is_cancelled && <div style={{fontSize:11,color:'#BDBDBD',textDecoration:'line-through'}}>{fmtMoney(p.price_original)}</div>}
              </div>
              <div style={{color:'#BDBDBD',fontSize:11,marginLeft:4}}>{isExpanded?'▲':'▼'}</div>
            </div>
            {isExpanded && (
              <div style={{borderTop:'0.5px solid #f0f0f0',padding:'14px 16px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                  <div style={cellStyle}>
                    <div style={cellLabel}>Инициатор продажи</div>
                    <div style={cellValue}>{isApp?'📱 Через приложение':`👤 ${creatorName}`}</div>
                    {!isApp && creatorRole && <div style={{fontSize:11,color:'#BDBDBD',marginTop:2}}>{creatorRole}</div>}
                  </div>
                  <div style={cellStyle}>
                    <div style={cellLabel}>Цена по прайсу</div>
                    <div style={cellValue}>{fmtMoney(p.price_original)}</div>
                  </div>
                  {hasDiscount && (
                    <div style={{...cellStyle,background:'#fef9e7'}}>
                      <div style={{...cellLabel,color:'#f39c12'}}>Скидка</div>
                      <div style={{...cellValue,color:'#f39c12'}}>−{fmtMoney(p.discount_amount)}</div>
                      {p.discount_reason && <div style={{fontSize:11,color:'#f39c12',marginTop:2,opacity:0.8}}>{p.discount_reason}</div>}
                    </div>
                  )}
                  {hasBonus && (
                    <div style={{...cellStyle,background:'#fafde8'}}>
                      <div style={{...cellLabel,color:'#6a7700'}}>Списано баллов</div>
                      <div style={{...cellValue,color:'#6a7700'}}>−{fmtMoney(p.bonus_rubles_used)}</div>
                    </div>
                  )}
                  <div style={cellStyle}>
                    <div style={cellLabel}>Итого оплачено</div>
                    <div style={{...cellValue,fontWeight:700}}>{fmtMoney(p.amount_paid)}</div>
                  </div>
                  <div style={cellStyle}>
                    <div style={cellLabel}>Чистая выручка</div>
                    <div style={cellValue}>{fmtMoney(p.total_net)}</div>
                  </div>
                  {Number(p.acquiring_fee)>0 && (
                    <div style={cellStyle}>
                      <div style={cellLabel}>Комиссия эквайринга</div>
                      <div style={cellValue}>{fmtMoney(p.acquiring_fee)}</div>
                    </div>
                  )}
                  {p.payer_type && p.payer_type!=='client' && (
                    <div style={cellStyle}>
                      <div style={cellLabel}>Плательщик</div>
                      <div style={cellValue}>{p.payer_type==='representative'?'Представитель':p.payer_name||'Другой человек'}</div>
                    </div>
                  )}
                  {sub?.visits_total && (
                    <div style={cellStyle}>
                      <div style={cellLabel}>Занятий использовано</div>
                      <div style={cellValue}>{sub.visits_used||0} из {sub.visits_total}</div>
                    </div>
                  )}
                  {hasDates && (
                    <div style={cellStyle}>
                      <div style={cellLabel}>Активирован</div>
                      <div style={cellValue}>{fmtDate(sub.activated_at)}</div>
                      {canEditDates && <div onClick={() => openDateModal(sub.id,'activated_at',sub.activated_at,p.productSub)} style={{fontSize:11,color:'#2980b9',cursor:'pointer',marginTop:4}}>✎ Изменить</div>}
                    </div>
                  )}
                  {hasDates && (
                    <div style={cellStyle}>
                      <div style={cellLabel}>Действует до</div>
                      <div style={cellValue}>{fmtDate(sub.expires_at)}</div>
                      {canEditDates && <div onClick={() => openDateModal(sub.id,'expires_at',sub.expires_at,p.productSub)} style={{fontSize:11,color:'#2980b9',cursor:'pointer',marginTop:4}}>✎ Изменить</div>}
                    </div>
                  )}
                </div>
                {p.allowedGroups.length>0 && (
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,color:'#BDBDBD',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Доступные группы</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {p.allowedGroups.map(g => (
                        <span key={g.id} style={{fontSize:12,color:g.is_closed?'#e74c3c':'#27ae60',background:g.is_closed?'#fdecea':'#eafaf1',padding:'3px 10px',borderRadius:8,fontWeight:500}}>
                          {g.is_closed?'🔒 ':''}{g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {p.comment && <div style={{fontSize:12,color:'#888',fontStyle:'italic',marginBottom:10}}>💬 {p.comment}</div>}
                {sub && (
                  <button onClick={() => toggleHistory(sub.id)} style={{background:'none',border:'none',color:'#2980b9',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',padding:0}}>
                    История изменений дат {showHistoryId===sub.id?'▲':'▼'}
                  </button>
                )}
                {sub && showHistoryId===sub.id && (
                  <div style={{marginTop:8}}>
                    {history.length===0 ? (
                      <div style={{fontSize:12,color:'#BDBDBD',padding:'8px 0'}}>Изменений не было</div>
                    ) : history.map((h,i) => (
                      <div key={i} style={{padding:'8px 0',borderBottom:'0.5px solid #f0f0f0',fontSize:12}}>
                        <div style={{color:'#2a2a2a',fontWeight:500}}>
                          {h.field==='activated_at'?'Дата активации':'Дата завершения'}: {fmtDate(h.old_value)} → {fmtDate(h.new_value)}
                        </div>
                        <div style={{color:'#888',marginTop:2}}>Причина: {h.reason}</div>
                        <div style={{color:'#BDBDBD',marginTop:2}}>👤 {h.changer?.full_name||h.changer?.email} · {fmtDT(h.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
      {dateModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}
          onClick={e => e.target===e.currentTarget && setDateModal(null)}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:360,maxWidth:'90%'}}>
            <div style={{fontSize:15,fontWeight:600,color:'#2a2a2a',marginBottom:16}}>
              {dateModal.field==='activated_at'?'Изменить дату активации':'Изменить дату завершения'}
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Новая дата</div>
              <input type="date" value={dateValue} onChange={e => setDateValue(e.target.value)}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e8e8e8',borderRadius:10,fontSize:13,boxSizing:'border-box',fontFamily:'Inter,sans-serif',outline:'none'}}
                onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'} />
            </div>
            {dateModal.field==='activated_at' && dateModal.productSub && (
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#2a2a2a',marginBottom:12,cursor:'pointer'}}>
                <input type="checkbox" checked={recalcExpires} onChange={e => setRecalcExpires(e.target.checked)} style={{accentColor:'#BFD900'}} />
                Пересчитать дату завершения автоматически
              </label>
            )}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Причина *</div>
              <textarea value={dateReason} onChange={e => setDateReason(e.target.value)} placeholder="Обязательно укажите причину..."
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e8e8e8',borderRadius:10,fontSize:13,boxSizing:'border-box',fontFamily:'Inter,sans-serif',resize:'vertical',minHeight:70,outline:'none'}}
                onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'} />
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={saveDateChange} disabled={!dateValue||!dateReason.trim()||dateSaving}
                style={{padding:'9px 24px',background:(!dateValue||!dateReason.trim())?'#e8e8e8':'#BFD900',border:'none',borderRadius:10,fontSize:13,fontWeight:700,color:(!dateValue||!dateReason.trim())?'#BDBDBD':'#2a2a2a',cursor:(!dateValue||!dateReason.trim())?'not-allowed':'pointer',fontFamily:'Inter,sans-serif'}}>
                {dateSaving?'Сохраняем...':'Сохранить'}
              </button>
              <button onClick={() => setDateModal(null)} style={{padding:'9px 16px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:10,fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── RepresentativesTab ───────────────────────────────────────────────────────
function RepresentativesTab({ clientId }) {
  const [reps, setReps] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ last_name:'', first_name:'', patronymic:'', role:'', phone:'', birth_date:'', contact:'', comment:'', is_payer:false })
  const [showForm, setShowForm] = useState(false)
  const ROLES = ['Мама','Папа','Опекун','Бабушка','Дедушка','Другое']
  const inp = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }

  useEffect(() => { load() }, [clientId])

  const load = async () => {
    const { data } = await supabase.from('client_representatives').select('*').eq('client_id',clientId).order('created_at')
    setReps(data||[])
  }
  const resetForm = () => setForm({ last_name:'', first_name:'', patronymic:'', role:'', phone:'', birth_date:'', contact:'', comment:'', is_payer:false })

  const handleSave = async () => {
    if (!form.first_name||!form.last_name||!form.role) return
    const full_name = [form.last_name,form.first_name,form.patronymic].filter(Boolean).join(' ')
    const dataToSave = { full_name, role:form.role, phone:form.phone||null, birth_date:form.birth_date||null, contact:form.contact||null, comment:form.comment||null, is_payer:form.is_payer }
    if (editing) await supabase.from('client_representatives').update(dataToSave).eq('id',editing)
    else await supabase.from('client_representatives').insert({ ...dataToSave, client_id:clientId })
    resetForm(); setEditing(null); setShowForm(false); load()
  }

  const handleEdit = (rep) => {
    const parts = (rep.full_name||'').split(' ')
    setForm({ last_name:parts[0]||'', first_name:parts[1]||'', patronymic:parts[2]||'', role:rep.role, phone:rep.phone||'', birth_date:rep.birth_date||'', contact:rep.contact||'', comment:rep.comment||'', is_payer:rep.is_payer||false })
    setEditing(rep.id); setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить представителя?')) return
    await supabase.from('client_representatives').delete().eq('id',id)
    load()
  }

  return (
    <div>
      {reps.map(rep => (
        <div key={rep.id} style={{background:'#f9f9f9',borderRadius:12,padding:14,marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:14,fontWeight:600,color:'#2a2a2a'}}>{rep.full_name}</span>
                <span style={{background:'#f0f0f0',color:'#888',padding:'2px 8px',borderRadius:6,fontSize:11}}>{rep.role}</span>
                {rep.is_payer && <span style={{background:'#fafde8',color:'#6a7700',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>💳 Плательщик</span>}
              </div>
              {rep.phone && <div style={{fontSize:12,color:'#888',marginTop:4}}>📞 {rep.phone}</div>}
              {rep.contact && <div style={{fontSize:12,color:'#888',marginTop:2}}>💬 {rep.contact}</div>}
              {rep.birth_date && <div style={{fontSize:12,color:'#BDBDBD',marginTop:2}}>ДР: {new Date(rep.birth_date).toLocaleDateString('ru-RU')}</div>}
              {rep.comment && <div style={{fontSize:12,color:'#BDBDBD',marginTop:4,fontStyle:'italic'}}>{rep.comment}</div>}
            </div>
            <div style={{display:'flex',gap:8,flexShrink:0}}>
              <button onClick={() => handleEdit(rep)} style={{fontSize:11,color:'#888',background:'none',border:'none',cursor:'pointer',padding:0}}>Изменить</button>
              <button onClick={() => handleDelete(rep.id)} style={{fontSize:11,color:'#e74c3c',background:'none',border:'none',cursor:'pointer',padding:0}}>Удалить</button>
            </div>
          </div>
        </div>
      ))}
      {!showForm && reps.length<3 && (
        <button onClick={() => { resetForm(); setEditing(null); setShowForm(true) }}
          style={{width:'100%',padding:'10px',background:'#f5f5f5',border:'1px dashed #BDBDBD',borderRadius:10,fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
          + Добавить представителя {reps.length>0?`(${reps.length}/3)`:''}
        </button>
      )}
      {showForm && (
        <div style={{background:'#f9f9f9',borderRadius:12,padding:16,marginTop:10}}>
          <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a',marginBottom:12}}>{editing?'Редактировать представителя':'Новый представитель'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:2}}>
            {[['Фамилия *','last_name'],['Имя *','first_name'],['Отчество','patronymic']].map(([label,key]) => (
              <div key={key}>
                <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>{label}</div>
                <input value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} style={{...inp,marginBottom:0}}
                  onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'} />
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:2}}>
            <div>
              <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Роль *</div>
              <select value={form.role} onChange={e => setForm({...form,role:e.target.value})} style={{...inp,marginBottom:0,background:'#fff'}}
                onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'}>
                <option value="">Выберите роль</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Дата рождения</div>
              <input value={form.birth_date} onChange={e => setForm({...form,birth_date:e.target.value})} type="date" style={{...inp,marginBottom:0}}
                onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'} />
            </div>
            <div>
              <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Телефон</div>
              <input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+7 900 000 00 00" style={{...inp,marginBottom:0}}
                onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'} />
            </div>
            <div>
              <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Telegram / другой канал</div>
              <input value={form.contact} onChange={e => setForm({...form,contact:e.target.value})} placeholder="@username" style={{...inp,marginBottom:0}}
                onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'} />
            </div>
          </div>
          <div style={{marginBottom:2}}>
            <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Комментарий</div>
            <textarea value={form.comment} onChange={e => setForm({...form,comment:e.target.value})} placeholder="Заметки..."
              style={{...inp,marginBottom:0,resize:'vertical',minHeight:60}}
              onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'} />
          </div>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#2a2a2a',marginBottom:12,cursor:'pointer'}}>
            <input type="checkbox" checked={form.is_payer} onChange={e => setForm({...form,is_payer:e.target.checked})} />
            Является плательщиком
          </label>
          <div style={{display:'flex',gap:8}}>
            <button onClick={handleSave} style={{flex:1,padding:'9px',background:'#BFD900',border:'none',borderRadius:10,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Сохранить</button>
            <button onClick={() => { setShowForm(false); setEditing(null); resetForm() }} style={{padding:'9px 16px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:10,fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CommentsTab ──────────────────────────────────────────────────────────────
function CommentsTab({ clientId }) {
  const [comments, setComments] = useState([])
  const [deleted, setDeleted] = useState([])
  const [showDeleted, setShowDeleted] = useState(false)
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [visibleCount, setVisibleCount] = useState(3)
  const formatDT = (dt) => new Date(dt).toLocaleString('ru-RU',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })

  useEffect(() => { load() }, [clientId])

  const load = async () => {
    const { data: active } = await supabase.from('client_comments')
      .select('*, comment_history(*, author:author_id(full_name,email))')
      .eq('client_id',clientId).eq('is_deleted',false).order('created_at',{ ascending:false })
    setComments(active||[])
    const { data: del } = await supabase.from('client_comments')
      .select('*, comment_history(*, author:author_id(full_name,email))')
      .eq('client_id',clientId).eq('is_deleted',true).order('created_at',{ ascending:false })
    setDeleted(del||[])
  }

  const handleAdd = async () => {
    if (!text.trim()) return
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('client_comments').insert({ client_id:clientId, author_id:user.id, text })
    setText(''); load()
  }

  const handleEdit = async (c) => {
    if (!editText.trim()) return
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('client_comments').update({ text:editText, edited_at:new Date().toISOString(), original_text:c.original_text||c.text }).eq('id',c.id)
    await supabase.from('comment_history').insert({ comment_id:c.id, action:'edited', author_id:user.id, text_before:c.text, text_after:editText })
    setEditingId(null); load()
  }

  const handleDelete = async (c) => {
    if (!confirm('Удалить комментарий?')) return
    const { data:{ user } } = await supabase.auth.getUser()
    await supabase.from('client_comments').update({ is_deleted:true }).eq('id',c.id)
    await supabase.from('comment_history').insert({ comment_id:c.id, action:'deleted', author_id:user.id, text_before:c.text })
    load()
  }

  const visible = comments.slice(0,visibleCount)
  const hasMore = comments.length > visibleCount
  const isExpanded = visibleCount >= comments.length && comments.length > 3
  const cardStyle = { background:'#fff', border:'0.5px solid #ebebeb', borderRadius:12, padding:'14px 16px', marginBottom:8, transition:'border-color 0.15s' }

  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:20,alignItems:'flex-start'}}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Добавить комментарий..." rows={1}
          onFocus={e => e.target.rows=3} onBlur={e => { if (!text) e.target.rows=1 }}
          style={{flex:1,padding:'9px 12px',border:'0.5px solid #e0e0e0',borderRadius:10,fontSize:13,fontFamily:'Inter,sans-serif',resize:'none',lineHeight:1.5,outline:'none',transition:'border-color 0.15s',color:'#2a2a2a'}}
          onKeyDown={e => { if (e.key==='Enter'&&(e.ctrlKey||e.metaKey)) handleAdd() }} />
        <button onClick={handleAdd} style={{padding:'9px 18px',background:'#BFD900',border:'none',borderRadius:10,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>
          Добавить
        </button>
      </div>
      {comments.length===0 ? (
        <div style={{textAlign:'center',color:'#BDBDBD',padding:'40px 0',fontSize:13}}>
          <div style={{fontSize:28,marginBottom:8}}>💬</div>
          Комментариев нет
        </div>
      ) : (
        <>
          {visible.map(c => (
            <div key={c.id} style={cardStyle}
              onMouseEnter={e => e.currentTarget.style.borderColor='#d0d0d0'}
              onMouseLeave={e => e.currentTarget.style.borderColor='#ebebeb'}>
              {editingId===c.id ? (
                <div>
                  <textarea value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                    style={{width:'100%',padding:'8px 12px',border:'1px solid #BFD900',borderRadius:8,fontSize:13,fontFamily:'Inter,sans-serif',resize:'vertical',minHeight:70,boxSizing:'border-box',outline:'none',color:'#2a2a2a',background:'#fafde8'}} />
                  <div style={{display:'flex',gap:6,marginTop:8}}>
                    <button onClick={() => handleEdit(c)} style={{padding:'5px 14px',background:'#BFD900',border:'none',borderRadius:7,fontSize:12,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Сохранить</button>
                    <button onClick={() => setEditingId(null)} style={{padding:'5px 14px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:7,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Отмена</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{fontSize:13,color:'#2a2a2a',lineHeight:1.6,marginBottom:10}}>{c.text}</div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <div style={{fontSize:11,color:'#BDBDBD',display:'flex',alignItems:'center',gap:6}}>
                      {formatDT(c.created_at)}
                      {c.edited_at && <span style={{background:'#f5f5f5',color:'#BDBDBD',fontSize:10,padding:'1px 6px',borderRadius:4}}>изменён</span>}
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={() => { setEditingId(c.id); setEditText(c.text) }}
                        style={{padding:'4px 10px',border:'0.5px solid #e8e8e8',borderRadius:6,background:'transparent',fontSize:11,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all 0.15s'}}
                        onMouseEnter={e => { e.currentTarget.style.background='#f5f5f5'; e.currentTarget.style.borderColor='#d0d0d0' }}
                        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='#e8e8e8' }}>
                        ✎ Изменить
                      </button>
                      <button onClick={() => handleDelete(c)}
                        style={{padding:'4px 10px',border:'0.5px solid #e8e8e8',borderRadius:6,background:'transparent',fontSize:11,color:'#e74c3c',cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all 0.15s'}}
                        onMouseEnter={e => { e.currentTarget.style.background='#fdecea'; e.currentTarget.style.borderColor='#f5c6c6' }}
                        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='#e8e8e8' }}>
                        Удалить
                      </button>
                    </div>
                  </div>
                  {c.comment_history && c.comment_history.length>0 && (
                    <div style={{marginTop:10,paddingTop:10,borderTop:'0.5px solid #f0f0f0'}}>
                      {c.comment_history.map((h,i) => (
                        <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'4px 0',fontSize:11,color:'#BDBDBD'}}>
                          <div style={{width:20,height:20,borderRadius:'50%',background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:600,color:'#888',flexShrink:0}}>
                            {(h.author?.full_name||h.author?.email||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{marginBottom:2}}>
                              <span style={{color:'#888',fontWeight:500}}>{h.action==='edited'?'✏️ Изменён':'🗑 Удалён'}</span>
                              {' · '}
                              <span style={{color:'#888'}}>{h.author?.full_name||h.author?.email||'—'}</span>
                              {' · '}
                              {formatDT(h.created_at)}
                            </div>
                            {h.text_before && <div style={{color:'#BDBDBD',fontStyle:'italic'}}>Было: {h.text_before}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:4}}>
            {hasMore && (
              <>
                <button onClick={() => setVisibleCount(v=>v+3)} style={{flex:1,padding:'8px',background:'transparent',border:'0.5px solid #e8e8e8',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Показать ещё 3</button>
                <button onClick={() => setVisibleCount(comments.length)} style={{flex:1,padding:'8px',background:'transparent',border:'0.5px solid #e8e8e8',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Все ({comments.length})</button>
              </>
            )}
            {isExpanded && <button onClick={() => setVisibleCount(3)} style={{flex:1,padding:'8px',background:'transparent',border:'0.5px solid #e8e8e8',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Свернуть</button>}
          </div>
        </>
      )}
      {deleted.length>0 && (
        <div style={{marginTop:16}}>
          <button onClick={() => setShowDeleted(!showDeleted)} style={{width:'100%',padding:'8px',background:'#fdecea',border:'none',borderRadius:8,fontSize:12,color:'#c0392b',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {showDeleted?'Скрыть удалённые':`Показать удалённые (${deleted.length})`}
          </button>
          {showDeleted && deleted.map(c => (
            <div key={c.id} style={{background:'#fdecea',border:'0.5px solid #f5c6c6',borderRadius:12,padding:'12px 16px',marginTop:8,opacity:0.75}}>
              <div style={{fontSize:13,color:'#888',textDecoration:'line-through',marginBottom:4}}>{c.text}</div>
              {c.comment_history?.filter(h=>h.action==='deleted').map((h,i) => (
                <div key={i} style={{fontSize:11,color:'#c0392b'}}>
                  🗑 Удалён · {h.author?.full_name||h.author?.email||'—'} · {formatDT(h.created_at)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ClientTasksTab ───────────────────────────────────────────────────────────
function ClientTasksTab({ clientId, session }) {
  const [tasks, setTasks] = useState([])
  const [reps, setReps] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('active')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', priority:'normal', deadline:'' })
  const [assignees, setAssignees] = useState([])
  const [selectedReps, setSelectedReps] = useState([])
  const formatDT = (dt) => dt ? new Date(dt).toLocaleString('ru-RU',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'
  const inp = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }

  useEffect(() => { loadAll() }, [clientId])

  const loadAll = async () => {
    setLoading(true)
    const { data: tcs } = await supabase.from('task_clients').select('task_id').eq('client_id',clientId)
    const taskIds = (tcs||[]).map(tc=>tc.task_id)
    if (taskIds.length===0) { setTasks([]) } else {
      const { data: t } = await supabase.from('tasks').select('*, task_history(*), task_assignees(*, profiles(full_name,email))').in('id',taskIds).order('created_at',{ ascending:false })
      setTasks(t||[])
    }
    const { data: r } = await supabase.from('client_representatives').select('*').eq('client_id',clientId)
    setReps(r||[])
    const { data: s } = await supabase.from('profiles').select('id,full_name,email,role').in('role',['teacher','admin','manager','owner'])
    setStaff(s||[])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!form.title) return
    const { data: task } = await supabase.from('tasks').insert({ ...form, created_by:session.user.id, deadline:form.deadline||null, is_group:false }).select().single()
    if (assignees.length>0) await supabase.from('task_assignees').insert(assignees.map(uid=>({ task_id:task.id, user_id:uid })))
    await supabase.from('task_clients').insert({ task_id:task.id, client_id:clientId })
    if (selectedReps.length>0) await supabase.from('task_client_representatives').insert(selectedReps.map(rid=>({ task_id:task.id, client_id:clientId, representative_id:rid })))
    await supabase.from('task_history').insert({ task_id:task.id, author_id:session.user.id, action:'created', comment:'Задача создана' })
    setForm({ title:'', description:'', priority:'normal', deadline:'' })
    setAssignees([]); setSelectedReps([]); setShowForm(false); loadAll()
  }

  const handleStatusChange = async (task, newStatus) => {
    await supabase.from('tasks').update({ status:newStatus, completed_at:newStatus==='done'?new Date().toISOString():null }).eq('id',task.id)
    await supabase.from('task_history').insert({ task_id:task.id, author_id:session.user.id, action:'status_changed', comment:`Статус изменён на: ${TASK_STATUS[newStatus].label}` })
    loadAll()
  }

  const filtered = tasks.filter(t => view==='active' ? ACTIVE.includes(t.status) : !ACTIVE.includes(t.status))

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{display:'flex',gap:4,background:'#f5f5f5',borderRadius:10,padding:3}}>
          {[['active','Текущие'],['done','Выполненные']].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} style={{padding:'6px 16px',borderRadius:8,border:'none',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',background:view===v?'#fff':'transparent',color:view===v?'#2a2a2a':'#888',fontWeight:view===v?600:400}}>{l}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{padding:'7px 14px',background:'#BFD900',border:'none',borderRadius:8,fontSize:12,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
          {showForm?'Закрыть':'+ Новая задача'}
        </button>
      </div>
      {showForm && (
        <div style={{background:'#f9f9f9',borderRadius:12,padding:14,marginBottom:14}}>
          <input value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Название задачи *" style={inp} />
          <textarea value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Описание" style={{...inp,resize:'vertical',minHeight:50}} />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <select value={form.priority} onChange={e => setForm({...form,priority:e.target.value})} style={inp}>
              <option value="low">Низкий приоритет</option>
              <option value="normal">Средний приоритет</option>
              <option value="high">Высокий приоритет</option>
            </select>
            <input value={form.deadline} onChange={e => setForm({...form,deadline:e.target.value})} type="datetime-local" style={inp} />
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:600}}>Ответственные</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {staff.map(s => (
                <label key={s.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:assignees.includes(s.id)?'#fafde8':'#f5f5f5',border:assignees.includes(s.id)?'1px solid #BFD900':'1px solid #e0e0e0',borderRadius:8,fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={assignees.includes(s.id)} onChange={() => setAssignees(p=>p.includes(s.id)?p.filter(x=>x!==s.id):[...p,s.id])} />
                  {s.full_name||s.email}
                </label>
              ))}
            </div>
          </div>
          {reps.length>0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:600}}>Представители</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {reps.map(r => (
                  <label key={r.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:selectedReps.includes(r.id)?'#fafde8':'#f5f5f5',border:selectedReps.includes(r.id)?'1px solid #BFD900':'1px solid #e0e0e0',borderRadius:8,fontSize:12,cursor:'pointer'}}>
                    <input type="checkbox" checked={selectedReps.includes(r.id)} onChange={() => setSelectedReps(p=>p.includes(r.id)?p.filter(x=>x!==r.id):[...p,r.id])} />
                    {r.full_name} ({r.role})
                  </label>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleCreate} style={{width:'100%',padding:'9px',background:'#BFD900',border:'none',borderRadius:10,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Создать задачу</button>
        </div>
      )}
      {loading ? (
        <div style={{textAlign:'center',color:'#BDBDBD',padding:30}}>Загрузка...</div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:'center',color:'#BDBDBD',padding:30}}>Задач нет</div>
      ) : filtered.map(task => {
        const isOverdue = task.deadline && ACTIVE.includes(task.status) && new Date(task.deadline)<new Date()
        return (
          <div key={task.id} style={{background:'#fff',borderRadius:12,border:'1px solid #f0f0f0',borderLeft:`4px solid ${TASK_PRIORITY[task.priority].color}`,padding:'12px 14px',marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                  <span style={{fontSize:14,fontWeight:600,color:isOverdue?'#e74c3c':'#2a2a2a'}}>{task.title}</span>
                  <span style={{background:TASK_STATUS[task.status].bg,color:TASK_STATUS[task.status].color,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>{TASK_STATUS[task.status].label}</span>
                  {isOverdue && <span style={{background:'#fdecea',color:'#e74c3c',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>⚠️ Просрочена</span>}
                </div>
                {task.description && <div style={{fontSize:12,color:'#888',marginBottom:6}}>{task.description}</div>}
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  {task.task_assignees?.length>0 && <span style={{fontSize:11,color:'#BDBDBD'}}>👤 {task.task_assignees.map(a=>a.profiles?.full_name||a.profiles?.email).join(', ')}</span>}
                  {task.deadline && <span style={{fontSize:11,color:isOverdue?'#e74c3c':'#BDBDBD'}}>⏰ {formatDT(task.deadline)}</span>}
                </div>
              </div>
              <select value={task.status} onChange={e => handleStatusChange(task,e.target.value)} style={{padding:'5px 10px',border:'1px solid #e8e8e8',borderRadius:8,fontSize:12,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer',flexShrink:0}}>
                {Object.entries(TASK_STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── BasicTab ─────────────────────────────────────────────────────────────────
function BasicTab({ client, clientId, userRole, onUpdate }) {
  const canEdit = ['admin','manager','owner'].includes(userRole)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    last_name:client.last_name||'', first_name:client.first_name||'', patronymic:client.patronymic||'',
    phone:client.phone||'', birth_date:client.birth_date||'', ad_source:client.ad_source||'', ad_source_custom:client.ad_source_custom||'',
  })
  const formatDate = (dt) => dt ? new Date(dt).toLocaleDateString('ru-RU',{ day:'numeric', month:'long', year:'numeric' }) : '—'
  const adSourceLabel = client.ad_source==='other' && client.ad_source_custom ? `Другое: ${client.ad_source_custom}` : AD_SOURCE_LABELS[client.ad_source]||'—'

  const handleSave = async () => {
    setSaving(true)
    const full_name = [form.last_name,form.first_name,form.patronymic].filter(Boolean).join(' ')
    const { data } = await supabase.from('profiles').update({
      full_name:full_name||null, last_name:form.last_name||null, first_name:form.first_name||null,
      patronymic:form.patronymic||null, phone:form.phone||null, birth_date:form.birth_date||null,
      ad_source:form.ad_source||null, ad_source_custom:form.ad_source==='other'?form.ad_source_custom||null:null,
    }).eq('id',clientId).select().single()
    if (data) onUpdate(data)
    setSaving(false); setEditing(false)
  }

  const eInp = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', color:'#2a2a2a', outline:'none' }

  if (!editing) return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        {[['Имя',client.first_name||'—'],['Фамилия',client.last_name||'—'],['Отчество',client.patronymic||'—'],['Телефон',client.phone||'—'],['Дата рождения',formatDate(client.birth_date)],['Рекламный источник',adSourceLabel]].map(([label,value]) => (
          <div key={label} style={{background:'#f9f9f9',borderRadius:10,padding:'12px 14px'}}>
            <div style={{fontSize:11,color:'#BDBDBD',marginBottom:4}}>{label}</div>
            <div style={{fontSize:14,color:'#2a2a2a',fontWeight:500}}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{background:'#f9f9f9',borderRadius:10,padding:'12px 14px',marginBottom:16}}>
        <div style={{fontSize:11,color:'#BDBDBD',marginBottom:4}}>Email</div>
        <div style={{fontSize:14,color:'#2a2a2a',fontWeight:500}}>{client.email}</div>
      </div>
      {canEdit && <button onClick={() => setEditing(true)} style={{padding:'8px 20px',background:'#f5f5f5',border:'none',borderRadius:10,fontSize:13,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>✎ Редактировать</button>}
    </div>
  )

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        {[['Имя','first_name','text'],['Фамилия','last_name','text'],['Отчество','patronymic','text'],['Телефон','phone','text'],['Дата рождения','birth_date','date']].map(([label,key,type]) => (
          <div key={key}>
            <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>{label}</div>
            <input value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} type={type} style={eInp}
              onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'} />
          </div>
        ))}
        <div>
          <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Рекламный источник</div>
          <select value={form.ad_source} onChange={e => setForm({...form,ad_source:e.target.value})} style={{...eInp,background:'#fff'}}
            onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'}>
            <option value="">Не указан</option>
            <option value="instagram">Instagram</option>
            <option value="vk">ВКонтакте</option>
            <option value="telegram">Telegram</option>
            <option value="word_of_mouth">Сарафанное радио</option>
            <option value="google">Google</option>
            <option value="yandex">Яндекс</option>
            <option value="2gis">2ГИС</option>
            <option value="other">Другое</option>
          </select>
        </div>
      </div>
      {form.ad_source==='other' && (
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Уточните источник</div>
          <input value={form.ad_source_custom} onChange={e => setForm({...form,ad_source_custom:e.target.value})} placeholder="Например: от знакомого Ивана" style={eInp}
            onFocus={e => e.target.style.borderColor='#BFD900'} onBlur={e => e.target.style.borderColor='#e8e8e8'} />
        </div>
      )}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:'#BDBDBD',marginBottom:6,fontWeight:600}}>Email</div>
        <input value={client.email} disabled style={{...eInp,color:'#BDBDBD',background:'#fafafa',border:'1px solid #f0f0f0'}} />
        <div style={{fontSize:11,color:'#BDBDBD',marginTop:4}}>Email изменить нельзя</div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={handleSave} disabled={saving} style={{padding:'9px 24px',background:'#BFD900',border:'none',borderRadius:10,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:saving?0.7:1}}>
          {saving?'Сохраняем...':'Сохранить'}
        </button>
        <button onClick={() => setEditing(false)} style={{padding:'9px 16px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:10,fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
          Отмена
        </button>
      </div>
    </div>
  )
}

// ─── AdminClientCard ──────────────────────────────────────────────────────────
export default function AdminClientCard({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [bonusHistory, setBonusHistory] = useState([])
  const [visibleBonus, setVisibleBonus] = useState(2)
  const [bonusAmount, setBonusAmount] = useState('')
  const [bonusType, setBonusType] = useState('rubles')
  const [bonusReason, setBonusReason] = useState('')
  const [bonusOperation, setBonusOperation] = useState('credit')
  const [loyaltyLevel, setLoyaltyLevel] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loyaltyOpen, setLoyaltyOpen] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [purchasesKey, setPurchasesKey] = useState(0)
  const loyaltyRef = useRef(null)

  const tab = searchParams.get('tab') || 'Основное'
  const setTab = (t) => {
    const next = new URLSearchParams(searchParams)
    if (t === 'Основное') next.delete('tab'); else next.set('tab', t)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!loyaltyOpen) return
    const handleClick = (e) => { if (loyaltyRef.current && !loyaltyRef.current.contains(e.target)) setLoyaltyOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [loyaltyOpen])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id',id).single()
      setClient(profile)
      setAvatarUrl(profile?.avatar_url||null)
      const { data: loyalty } = await supabase.from('client_loyalty').select('level').eq('client_id',id).single()
      setLoyaltyLevel(loyalty?.level||null)
      const { data:{ user } } = await supabase.auth.getUser()
      const { data: me } = await supabase.from('profiles').select('role').eq('id',user.id).single()
      setUserRole(me?.role)
      const { data: hist } = await supabase.from('bonus_history').select('*, created_by_profile:profiles!bonus_history_created_by_fkey(full_name,email)').eq('student_id',id).order('created_at',{ ascending:false })
      setBonusHistory(hist||[])
      setLoading(false)
    }
    load()
  }, [id])

  const handleAddBonus = async () => {
    if (!bonusAmount || !bonusReason.trim()) return
    const amount = parseInt(bonusAmount)
    const delta = bonusOperation === 'debit' ? -Math.abs(amount) : Math.abs(amount)
    // RPC admin_adjust_coins / admin_adjust_rubles — атомарно, без гонок,
    // с проверкой роли и баланса на сервере, аудитом в bonus_history.
    const rpcName = bonusType === 'rubles' ? 'admin_adjust_rubles' : 'admin_adjust_coins'
    const { data, error } = await supabase.rpc(rpcName, {
      p_client_id: id, p_delta: delta, p_reason: bonusReason,
    })
    if (error) { alert('Ошибка сети: ' + error.message); return }
    if (!data?.ok) {
      const msg = {
        not_authenticated:   'Сессия истекла, войдите заново',
        forbidden:           'Недостаточно прав',
        invalid_delta:       'Сумма должна быть больше нуля',
        reason_required:     'Укажите причину',
        client_not_found:    'Клиент не найден',
        insufficient_balance: `Недостаточно средств на балансе (${data.balance ?? 0}, нужно ${data.required ?? amount})`,
      }[data?.error] || `Не удалось выполнить: ${data?.error || 'неизвестная ошибка'}`
      alert(msg); return
    }
    const field = bonusType === 'rubles' ? 'bonus_rubles' : 'bonus_coins'
    setClient({ ...client, [field]: data.new_balance })
    const { data: hist } = await supabase.from('bonus_history').select('*, created_by_profile:profiles!bonus_history_created_by_fkey(full_name,email)').eq('student_id', id).order('created_at', { ascending: false })
    setBonusHistory(hist || [])
    setBonusAmount(''); setBonusReason('')
  }

  const LOYALTY = {
    adept:  { label:'👑 Адепт',      color:'#8e44ad', bg:'#f5eef8' },
    loyal:  { label:'💚 Лояльный',   color:'#82c99a', bg:'#f0faf3' },
    edge:   { label:'🤔 На грани',   color:'#f39c12', bg:'#fef9e7' },
    risk:   { label:'⚠️ Риск ухода', color:'#e74c3c', bg:'#fdecea' },
  }

  const handleSetLoyalty = async (level) => {
    const newLevel = level===null ? null : loyaltyLevel===level ? null : level
    if (newLevel) await supabase.from('client_loyalty').upsert({ client_id:id, level:newLevel, updated_by:session.user.id, updated_at:new Date().toISOString() },{ onConflict:'client_id' })
    else await supabase.from('client_loyalty').delete().eq('client_id',id)
    setLoyaltyLevel(newLevel)
  }

  const formatDT = (dt) => new Date(dt).toLocaleString('ru-RU',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })

  const handleSaleSuccess = () => {
    setShowSaleModal(false)
    setTab('Покупки')
    setPurchasesKey(k=>k+1)
  }

  if (loading) return <div style={{textAlign:'center',color:'#BDBDBD',padding:40}}>Загрузка...</div>
  if (!client) return <div style={{textAlign:'center',color:'#BDBDBD',padding:40}}>Клиент не найден</div>

  return (
    <div>
      <div onClick={() => navigate('/admin/clients')} style={{display:'flex',alignItems:'center',gap:6,color:'#BDBDBD',fontSize:13,cursor:'pointer',marginBottom:20}}>
        ← Назад к клиентам
      </div>
      <div style={{background:'#fff',borderRadius:16,border:'1px solid #f0f0f0',padding:'20px 24px',marginBottom:4,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <AvatarUpload userId={client.id} currentUrl={avatarUrl} size={52} onUpload={(url) => setAvatarUrl(url)} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:17,fontWeight:600,color:'#2a2a2a',marginBottom:4}}>{client.full_name||'—'}</div>
          <div style={{fontSize:12,color:'#BDBDBD'}}>{client.email}</div>
        </div>
        {['admin','manager','owner'].includes(userRole) && (
          <div style={{position:'relative',flexShrink:0}} ref={loyaltyRef}>
            <div onClick={() => setLoyaltyOpen(o=>!o)}
              style={{background:loyaltyLevel?LOYALTY[loyaltyLevel].bg:'#f5f5f5',color:loyaltyLevel?LOYALTY[loyaltyLevel].color:'#BDBDBD',borderRadius:8,padding:'5px 12px',fontSize:12,fontWeight:600,cursor:'pointer',userSelect:'none'}}>
              {loyaltyLevel?LOYALTY[loyaltyLevel].label:'Лояльность'} ▾
            </div>
            {loyaltyOpen && (
              <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:'#fff',border:'1px solid #f0f0f0',borderRadius:12,padding:6,minWidth:160,zIndex:100,boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
                {Object.entries(LOYALTY).map(([key,l]) => (
                  <div key={key} onClick={() => { handleSetLoyalty(key); setLoyaltyOpen(false) }}
                    style={{padding:'8px 12px',borderRadius:8,fontSize:13,cursor:'pointer',color:l.color,fontWeight:loyaltyLevel===key?700:500,background:loyaltyLevel===key?l.bg:'transparent'}}
                    onMouseEnter={e => e.currentTarget.style.background=loyaltyLevel===key?l.bg:'#f5f5f5'}
                    onMouseLeave={e => e.currentTarget.style.background=loyaltyLevel===key?l.bg:'transparent'}>
                    {l.label}
                  </div>
                ))}
                <div style={{borderTop:'1px solid #f0f0f0',margin:'4px 0'}} />
                <div onClick={() => { handleSetLoyalty(null); setLoyaltyOpen(false) }}
                  style={{padding:'8px 12px',borderRadius:8,fontSize:13,cursor:'pointer',color:'#BDBDBD'}}
                  onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  Снять метку
                </div>
              </div>
            )}
          </div>
        )}
        <button onClick={() => setShowSaleModal(true)} style={{padding:'8px 16px',background:'#BFD900',border:'none',borderRadius:10,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>
          + Продать
        </button>
        <div style={{display:'flex',gap:8,flexShrink:0}}>
          <div style={{background:'#fafde8',borderRadius:10,padding:'8px 14px',textAlign:'center'}}>
            <div style={{fontSize:15,fontWeight:600,color:'#6a7700'}}>{client.bonus_rubles||0} ₽</div>
            <div style={{fontSize:10,color:'#BDBDBD'}}>бонусы</div>
          </div>
          <div style={{background:'#f9f9f9',borderRadius:10,padding:'8px 14px',textAlign:'center'}}>
            <div style={{fontSize:15,fontWeight:600,color:'#2a2a2a'}}>⭐ {client.bonus_coins||0}</div>
            <div style={{fontSize:10,color:'#BDBDBD'}}>SDTшки</div>
          </div>
        </div>
      </div>
      <div style={{display:'flex',gap:4,marginBottom:0,borderBottom:'1px solid #f0f0f0',background:'#fff',borderRadius:'12px 12px 0 0',padding:'0 8px',overflowX:'auto'}}>
        {TABS.map(t => (
          <div key={t} onClick={() => setTab(t)} style={{padding:'12px 16px',fontSize:13,cursor:'pointer',whiteSpace:'nowrap',color:tab===t?'#2a2a2a':'#BDBDBD',borderBottom:tab===t?'2px solid #BFD900':'2px solid transparent',fontWeight:tab===t?600:400,marginBottom:-1}}>{t}</div>
        ))}
      </div>
      <div style={{background:'#fff',borderRadius:'0 0 12px 12px',border:'1px solid #f0f0f0',borderTop:'none',padding:20}}>
        {tab==='Основное' && <BasicTab client={client} clientId={id} userRole={userRole} onUpdate={setClient} />}
        {tab==='Покупки' && <PurchasesTab key={purchasesKey} clientId={id} userRole={userRole} session={session} />}
        {tab==='Посещения' && <VisitsTab clientId={id} />}
        {tab==='Комментарии' && <CommentsTab clientId={id} />}
        {tab==='Представители' && <RepresentativesTab clientId={id} />}
        {tab==='Задачи' && <ClientTasksTab clientId={id} session={session} />}
        {tab==='Бонусы' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
              <div style={{background:'#fafde8',border:'1px solid #BFD900',borderRadius:12,padding:14,textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:300,color:'#2a2a2a'}}>{client.bonus_rubles||0}</div>
                <div style={{fontSize:11,color:'#BDBDBD'}}>Рубли-бонусы</div>
              </div>
              <div style={{background:'#f9f9f9',borderRadius:12,padding:14,textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:300,color:'#2a2a2a'}}>⭐ {client.bonus_coins||0}</div>
                <div style={{fontSize:11,color:'#BDBDBD'}}>SDTшки</div>
              </div>
            </div>
            <div style={{background:'#f9f9f9',borderRadius:12,padding:14,marginBottom:16}}>
              <div style={{fontSize:12,color:'#888',marginBottom:10,fontWeight:600}}>Управление бонусами</div>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <button onClick={() => setBonusOperation('credit')} style={{flex:1,padding:'8px',borderRadius:8,border:bonusOperation==='credit'?'none':'1px solid #e0e0e0',background:bonusOperation==='credit'?'#BFD900':'#fff',color:'#2a2a2a',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:bonusOperation==='credit'?600:400}}>💰 Начислить</button>
                <button onClick={() => setBonusOperation('debit')} style={{flex:1,padding:'8px',borderRadius:8,border:bonusOperation==='debit'?'none':'1px solid #fdecea',background:bonusOperation==='debit'?'#fdecea':'#fff',color:bonusOperation==='debit'?'#e74c3c':'#888',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:bonusOperation==='debit'?600:400}}>➖ Списать</button>
              </div>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <button onClick={() => setBonusType('rubles')} style={{flex:1,padding:'8px',borderRadius:8,border:bonusType==='rubles'?'none':'1px solid #e0e0e0',background:bonusType==='rubles'?'#2a2a2a':'#fff',color:bonusType==='rubles'?'#fff':'#888',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:bonusType==='rubles'?600:400}}>₽ Рубли</button>
                <button onClick={() => setBonusType('coins')} style={{flex:1,padding:'8px',borderRadius:8,border:bonusType==='coins'?'none':'1px solid #e0e0e0',background:bonusType==='coins'?'#2a2a2a':'#fff',color:bonusType==='coins'?'#fff':'#888',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:bonusType==='coins'?600:400}}>⭐ SDTшки</button>
              </div>
              <input value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} placeholder="Количество" type="number" min="1" style={{width:'100%',padding:'8px 12px',border:'1px solid #e8e8e8',borderRadius:8,fontSize:13,marginBottom:8,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}} />
              <input value={bonusReason} onChange={e => setBonusReason(e.target.value)} placeholder="Причина (для внутренней истории)" style={{width:'100%',padding:'8px 12px',border:'1px solid #e8e8e8',borderRadius:8,fontSize:13,marginBottom:8,boxSizing:'border-box',fontFamily:'Inter,sans-serif'}} />
              <button onClick={handleAddBonus} disabled={!bonusAmount||!bonusReason.trim()} style={{width:'100%',padding:'9px',background:(!bonusAmount||!bonusReason.trim())?'#e8e8e8':bonusOperation==='debit'?'#e74c3c':'#BFD900',border:'none',borderRadius:10,fontSize:13,fontWeight:700,color:(!bonusAmount||!bonusReason.trim())?'#BDBDBD':bonusOperation==='debit'?'#fff':'#2a2a2a',cursor:(!bonusAmount||!bonusReason.trim())?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',transition:'all 0.2s'}}>
                {bonusOperation==='credit'?'💰 Начислить':'➖ Списать'}
              </button>
            </div>
            {bonusHistory.length>0 && (
              <div>
                <div style={{fontSize:11,color:'#BDBDBD',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>История</div>
                {bonusHistory.slice(0,visibleBonus).map((h,i) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #f8f8f8',fontSize:13}}>
                    <div style={{flex:1}}>
                      <div style={{color:'#2a2a2a',fontWeight:500}}>{h.reason}</div>
                      <div style={{color:'#BDBDBD',fontSize:11,marginTop:2}}>{formatDT(h.created_at)}</div>
                      {h.created_by_profile && <div style={{color:'#BDBDBD',fontSize:11}}>👤 {h.created_by_profile.full_name||h.created_by_profile.email}</div>}
                    </div>
                    <div style={{fontWeight:700,fontSize:14,color:h.amount>0?'#27ae60':'#e74c3c',marginLeft:12}}>
                      {h.amount>0?'+':''}{h.amount} {h.type==='rubles'?'₽':'⭐'}
                    </div>
                  </div>
                ))}
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  {bonusHistory.length>visibleBonus && (
                    <>
                      <button onClick={() => setVisibleBonus(v=>v+3)} style={{flex:1,padding:'8px',background:'#f5f5f5',border:'none',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Показать ещё 3</button>
                      <button onClick={() => setVisibleBonus(bonusHistory.length)} style={{flex:1,padding:'8px',background:'#f5f5f5',border:'none',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Показать все ({bonusHistory.length})</button>
                    </>
                  )}
                  {visibleBonus>=bonusHistory.length && bonusHistory.length>2 && (
                    <button onClick={() => setVisibleBonus(2)} style={{flex:1,padding:'8px',background:'#f5f5f5',border:'none',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Свернуть</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showSaleModal && <SaleModal client={client} session={session} onClose={() => setShowSaleModal(false)} onSuccess={handleSaleSuccess} />}
    </div>
  )
}