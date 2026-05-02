import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
const labelStyle = { fontSize:12, color:'#888', marginBottom:6, fontWeight:600, display:'block' }
const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16 }
const primaryBtn = { padding:'11px 24px', background:'#BFD900', border:'none', borderRadius:10, fontSize:14, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif' }

const PAYMENT_METHODS = [
  { id: 'cash',   label: '💵 Наличные',    hint: 'без комиссии' },
  { id: 'bank',   label: '🏦 Безнал',      hint: 'без комиссии' },
  { id: 'online', label: '💳 Эквайринг',   hint: 'комиссия по настройкам' },
  { id: 'bonus',  label: '🎁 Баллы',       hint: '1 балл = 1 ₽, выручка 0' },
  { id: 'coins',  label: '🪙 SDTшки',      hint: 'списание с баланса, выручка 0' },
]

const TYPES = [
  { id: 'subscription', label: 'Абонемент' },
  { id: 'service',      label: 'Услуга' },
  { id: 'indiv',        label: 'Индив' },
  { id: 'event',        label: 'Мероприятие' },
  { id: 'merch',        label: 'Мерч' },
]

const fmtMoney = (n) => (Number(n) || 0).toLocaleString('ru-RU') + ' ₽'
const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'numeric' })
const fmtDateTime = (d) => new Date(d).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })

const toLocalDateStr = (d) => {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${dy}`
}

function ClientSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [newClient, setNewClient] = useState({ full_name:'', phone:'' })

  const handleSearch = async (val) => {
    setQuery(val)
    if (val.length < 2) { setResults([]); return }
    const { data } = await supabase.from('profiles')
      .select('id, full_name, email, phone, bonus_rubles, bonus_coins')
      .eq('role', 'client')
      .or(`full_name.ilike.%${val}%,phone.ilike.%${val}%,email.ilike.%${val}%`)
      .limit(8)
    setResults(data || [])
  }

  return (
    <div>
      <label style={labelStyle}>Поиск клиента по имени или телефону</label>
      <div style={{position:'relative'}}>
        <input value={query} onChange={e => handleSearch(e.target.value)} placeholder="Иванова Мария или +7..." style={inputStyle} />
        {results.length > 0 && (
          <div style={{position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, zIndex:10, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', marginTop:4}}>
            {results.map(c => (
              <div key={c.id} onClick={() => { onSelect(c); setResults([]); setQuery('') }}
                style={{padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f5f5f5', fontSize:13}}
                onMouseEnter={e => e.currentTarget.style.background='#f9f9f9'}
                onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                <div style={{fontWeight:500, color:'#2a2a2a'}}>{c.full_name || c.email}</div>
                <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>
                  {c.phone && `${c.phone} · `}баллы: {c.bonus_rubles || 0} ₽ · SDTшки: {c.bonus_coins || 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => setShowNewForm(!showNewForm)}
        style={{marginTop:8, background:'none', border:'none', color:'#2980b9', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', padding:0}}>
        + Новый клиент (нет в базе)
      </button>
      {showNewForm && (
        <div style={{background:'#f9f9f9', borderRadius:10, padding:14, marginTop:10}}>
          <div style={{fontSize:12, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>Быстрое добавление клиента</div>
          <input value={newClient.full_name} onChange={e => setNewClient({...newClient, full_name:e.target.value})} placeholder="ФИО *" style={{...inputStyle, marginBottom:8}} />
          <input value={newClient.phone} onChange={e => setNewClient({...newClient, phone:e.target.value})} placeholder="Телефон" style={{...inputStyle, marginBottom:8}} />
          <div style={{fontSize:11, color:'#888'}}>После создания найдите клиента через поиск выше.</div>
        </div>
      )}
    </div>
  )
}

function ProductPicker({ onAdd }) {
  const [products, setProducts] = useState([])
  const [type, setType] = useState('subscription')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadProducts() }, [type])

  const loadProducts = async () => {
    setLoading(true); setSelectedProduct('')
    const { data } = await supabase.from('products')
      .select('*, product_indivs(teacher_id, profiles:teacher_id(full_name)), product_subscriptions(available_from_day, available_to_day)')
      .eq('type', type).eq('is_active', true).order('price')

    const today = new Date().getDate() // текущий день месяца (1-31)
    const filtered = (data || []).filter(p => {
      const ps = p.product_subscriptions?.[0]
      if (!ps?.available_from_day || !ps?.available_to_day) return true // нет ограничений — показываем
      return today >= ps.available_from_day && today <= ps.available_to_day
    })

    setProducts(filtered)
    setLoading(false)
  }

  const handleAdd = () => {
    const p = products.find(p => p.id === selectedProduct)
    if (!p) return
    const teacherId = p.product_indivs?.[0]?.teacher_id || null
    const teacherName = p.product_indivs?.[0]?.profiles?.full_name || null
    onAdd({ product_id: p.id, product_type: type, product_name: p.name, price: p.price, teacher_id: teacherId, teacher_name: teacherName })
    setSelectedProduct('')
  }

  return (
    <div>
      <div style={{display:'flex', gap:6, marginBottom:10, flexWrap:'wrap'}}>
        {TYPES.map(t => (
          <button key={t.id} onClick={() => setType(t.id)} style={{padding:'6px 12px', borderRadius:8, border: type === t.id ? 'none' : '1px solid #e0e0e0', background: type === t.id ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: type === t.id ? 600 : 400}}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{display:'flex', gap:8}}>
        <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} style={{...inputStyle, flex:1}}>
          <option value="">{loading ? 'Загрузка...' : products.length === 0 ? 'Нет продуктов' : 'Выберите продукт'}</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} — {fmtMoney(p.price)}</option>)}
        </select>
        <button onClick={handleAdd} disabled={!selectedProduct} style={{...primaryBtn, fontSize:12, padding:'9px 16px', opacity: selectedProduct ? 1 : 0.5}}>
          + В чек
        </button>
      </div>
    </div>
  )
}

function SaleDetail({ sale }) {
  const PAYER_LABELS = { client: 'Сам клиент', representative: 'Представитель', other: 'Другой человек' }
  return (
    <div style={{marginTop:10, paddingTop:10, borderTop:'1px solid #f0f0f0'}}>
      {[
        ['Продавец', sale.creator?.full_name || sale.creator?.email || '—'],
        ['Способ оплаты', PAYMENT_METHODS.find(m => m.id === sale.payment_method)?.label || sale.payment_method],
        ['Цена по прайсу', fmtMoney(sale.price_original)],
        Number(sale.discount_amount) > 0 ? ['Скидка', `${fmtMoney(sale.discount_amount)}${sale.discount_reason ? ` (${sale.discount_reason})` : ''}`] : null,
        Number(sale.bonus_rubles_used) > 0 ? ['Списано баллов', fmtMoney(sale.bonus_rubles_used)] : null,
        Number(sale.acquiring_fee) > 0 ? ['Комиссия эквайринга', fmtMoney(sale.acquiring_fee)] : null,
        ['Итого оплачено', fmtMoney(sale.amount_paid)],
        ['Чистая выручка', fmtMoney(sale.total_net)],
        sale.payer_type && sale.payer_type !== 'client' ? ['Плательщик', PAYER_LABELS[sale.payer_type] || sale.payer_type] : null,
        sale.subscription ? ['Действует с', fmtDate(sale.subscription.activated_at)] : null,
        sale.subscription?.expires_at ? ['Действует до', fmtDate(sale.subscription.expires_at)] : null,
        sale.comment ? ['Комментарий', sale.comment] : null,
      ].filter(Boolean).map(([label, value]) => (
        <div key={label} style={{display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12, borderBottom:'1px solid #f8f8f8'}}>
          <span style={{color:'#888'}}>{label}</span>
          <span style={{color:'#2a2a2a', fontWeight:500, textAlign:'right', maxWidth:'60%'}}>{value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminCashbox({ session }) {
  const [client, setClient] = useState(null)
  const [representatives, setRepresentatives] = useState([])
  const [items, setItems] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedGroupIds, setSelectedGroupIds] = useState([])
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
  const [lastReceipt, setLastReceipt] = useState(null)
  const [todaySales, setTodaySales] = useState([])
  const [loadingSales, setLoadingSales] = useState(true)
  const [expandedSaleId, setExpandedSaleId] = useState(null)

  // Есть ли в чеке абонементы/услуги (для которых нужен выбор групп)
  const hasSubItems = items.some(i => i.product_type === 'subscription' || i.product_type === 'service')

  useEffect(() => { loadAcquiring(); loadTodaySales(); loadGroups() }, [])
  useEffect(() => { if (client) loadRepresentatives(); else setRepresentatives([]) }, [client])

  // Когда в чеке появляются абонементы — автоматически выбираем все открытые группы
  useEffect(() => {
    if (!hasSubItems) setSelectedGroupIds([])
  }, [hasSubItems])

  const loadGroups = async () => {
    const { data } = await supabase.from('groups').select('*').order('name')
    setGroups(data || [])
  }

  const loadAcquiring = async () => {
    const { data } = await supabase.from('finance_settings').select('value').eq('key', 'acquiring_fee_percent').single()
    if (data) setAcquiringPercent(parseFloat(data.value) || 2.5)
  }

  const loadRepresentatives = async () => {
    const { data } = await supabase.from('client_representatives').select('*').eq('client_id', client.id)
    setRepresentatives(data || [])
  }

  const loadTodaySales = async () => {
    setLoadingSales(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('sales')
      .select('*, client:client_id(full_name), creator:created_by(full_name, email), subscription:subscriptions!subscriptions_sale_id_fkey(activated_at, expires_at)')
      .gte('sale_date', today + 'T00:00:00')
      .lte('sale_date', today + 'T23:59:59')
      .order('sale_date', { ascending: false })
    setTodaySales((data || []).map(s => ({...s, subscription: s.subscription?.[0] || null})))
    setLoadingSales(false)
  }

  const toggleGroup = (id) => {
    setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const getDiscountAmount = () => {
    if (!discountValue) return 0
    if (discountMode === 'percent') return Math.round(subtotal * parseFloat(discountValue) / 100)
    return parseFloat(discountValue) || 0
  }

  const bonusRublesUsed = parseFloat(bonusRublesUse) || 0
  const discountAmount = getDiscountAmount()
  const afterDiscount = Math.max(0, subtotal - discountAmount - bonusRublesUsed)
  const acquiringFee = paymentMethod === 'online' ? Math.round(afterDiscount * acquiringPercent / 100) : 0
  const totalNet = paymentMethod === 'bonus' || paymentMethod === 'coins' ? 0 : afterDiscount - acquiringFee

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (!client || items.length === 0 || !paymentMethod) return
    setSaving(true)

    const receiptId = crypto.randomUUID()
    const perItem = items.length
    const rows = items.map(item => ({
      receipt_id: receiptId,
      client_id: client.id,
      product_id: item.product_id,
      product_type: item.product_type,
      product_name: item.product_name,
      teacher_id: item.teacher_id || null,
      price_original: item.price,
      discount_percent: discountMode === 'percent' ? (parseFloat(discountValue) || 0) : 0,
      discount_amount: discountAmount / perItem,
      discount_reason: discountReason || null,
      bonus_rubles_used: bonusRublesUsed / perItem,
      bonus_coins_used: 0,
      payment_method: paymentMethod,
      amount_paid: afterDiscount / perItem,
      acquiring_fee: acquiringFee / perItem,
      total_net: totalNet / perItem,
      payer_type: payerType,
      payer_representative_id: payerType === 'representative' ? payerRepId || null : null,
      payer_name: payerType === 'other' ? payerName || null : null,
      comment: comment || null,
      created_by: session.user.id,
      sale_date: new Date().toISOString(),
    }))

    const { data: insertedSales, error } = await supabase.from('sales').insert(rows).select()
    if (error) { alert('Ошибка: ' + error.message); setSaving(false); return }

    if (bonusRublesUsed > 0) {
      await supabase.from('profiles').update({
        bonus_rubles: Math.max(0, (client.bonus_rubles || 0) - bonusRublesUsed)
      }).eq('id', client.id)
    }

    // Создаём подписки для абонементов и услуг
    const subItems = items.filter(item => item.product_type === 'subscription' || item.product_type === 'service')
    if (subItems.length > 0) {
      const productIds = subItems.map(i => i.product_id)
      const { data: productSubs } = await supabase
        .from('product_subscriptions')
        .select('product_id, sub_type, visits_count, duration_days, fixed_end_day')
        .in('product_id', productIds)

      const today = new Date()
      const todayStr = toLocalDateStr(today)

      const calcExpiresAt = (ps) => {
        if (ps?.fixed_end_day) {
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, ps.fixed_end_day)
          return toLocalDateStr(nextMonth)
        }
        if (ps?.duration_days) {
          const exp = new Date(today)
          exp.setDate(exp.getDate() + ps.duration_days)
          return toLocalDateStr(exp)
        }
        return null
      }

      const subscriptionRows = subItems.map(item => {
        const ps = productSubs?.find(p => p.product_id === item.product_id)
        const saleRecord = insertedSales?.find(s => s.product_id === item.product_id)
        return {
          student_id: client.id,
          type: item.product_name,
          visits_total: ps?.visits_count || null,
          visits_used: 0,
          price: item.price,
          activated_at: todayStr,
          expires_at: calcExpiresAt(ps),
          is_frozen: false,
          sale_id: saleRecord?.id || null,
        }
      })

      const { data: insertedSubs, error: subError } = await supabase
        .from('subscriptions').insert(subscriptionRows).select()
      if (subError) console.error('Ошибка создания абонемента:', subError.message)

      // Сохраняем разрешённые группы для каждого абонемента
      if (insertedSubs && selectedGroupIds.length > 0) {
        const groupRows = insertedSubs.flatMap(sub =>
          selectedGroupIds.map(groupId => ({
            subscription_id: sub.id,
            group_id: groupId,
          }))
        )
        const { error: groupError } = await supabase
          .from('subscription_allowed_groups').insert(groupRows)
        if (groupError) console.error('Ошибка сохранения групп:', groupError.message)
      }
    }

    setLastReceipt({ receiptId, client, items, total: afterDiscount, method: paymentMethod })
    setClient(null); setItems([]); setPayerType('client'); setPayerRepId(''); setPayerName('')
    setDiscountValue(''); setDiscountReason(''); setBonusRublesUse('')
    setPaymentMethod('cash'); setComment(''); setSelectedGroupIds([])
    setSaving(false)
    loadTodaySales()
  }

  return (
    <div>
      <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:'0 0 20px 0'}}>Касса</h1>

      <div style={{display:'grid', gridTemplateColumns:'1fr 360px', gap:20, alignItems:'start'}}>

        {/* ЛЕВАЯ КОЛОНКА */}
        <div>
          {lastReceipt && (
            <div style={{background:'#eafaf1', border:'1px solid #27ae60', borderRadius:14, padding:16, marginBottom:16}}>
              <div style={{fontSize:14, fontWeight:600, color:'#27ae60', marginBottom:4}}>✅ Продажа оформлена!</div>
              <div style={{fontSize:12, color:'#555'}}>
                {lastReceipt.client.full_name} · {lastReceipt.items.length} {lastReceipt.items.length === 1 ? 'позиция' : 'позиции'} · {fmtMoney(lastReceipt.total)} · {PAYMENT_METHODS.find(m => m.id === lastReceipt.method)?.label}
              </div>
              <button onClick={() => setLastReceipt(null)} style={{background:'none', border:'none', color:'#27ae60', fontSize:11, cursor:'pointer', marginTop:6, fontFamily:'Inter,sans-serif', padding:0}}>Закрыть</button>
            </div>
          )}

          {/* 1. Клиент */}
          <div style={cardStyle}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>1. Клиент</div>
              {client && <button onClick={() => setClient(null)} style={{background:'none', border:'none', color:'#e74c3c', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Изменить</button>}
            </div>
            {client ? (
              <div style={{background:'#fafde8', borderRadius:10, padding:12, display:'flex', gap:12, alignItems:'center'}}>
                <div style={{width:38, height:38, background:'#BFD900', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#2a2a2a', flexShrink:0}}>
                  {(client.full_name || client.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>{client.full_name || client.email}</div>
                  <div style={{fontSize:11, color:'#888'}}>{client.phone && `${client.phone} · `}баллы: {client.bonus_rubles || 0} ₽ · SDTшки: {client.bonus_coins || 0}</div>
                </div>
              </div>
            ) : (
              <ClientSearch onSelect={setClient} />
            )}
          </div>

          {/* 2. Что продаём */}
          {client && (
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:12}}>2. Что продаём</div>
              <ProductPicker onAdd={(item) => setItems([...items, item])} />
              {items.length > 0 && (
                <div style={{marginTop:14}}>
                  {items.map((item, idx) => (
                    <div key={idx} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f8f8f8'}}>
                      <div>
                        <div style={{fontSize:13, color:'#2a2a2a', fontWeight:500}}>{item.product_name}</div>
                        <div style={{fontSize:11, color:'#BDBDBD'}}>{TYPES.find(t => t.id === item.product_type)?.label}{item.teacher_name && ` · ${item.teacher_name}`}</div>
                      </div>
                      <div style={{display:'flex', gap:12, alignItems:'center'}}>
                        <span style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>{fmtMoney(item.price)}</span>
                        <button onClick={() => removeItem(idx)} style={{fontSize:18, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', lineHeight:1}}>×</button>
                      </div>
                    </div>
                  ))}
                  <div style={{display:'flex', justifyContent:'space-between', padding:'10px 0', fontSize:14, fontWeight:600, color:'#2a2a2a'}}>
                    <span>Итого:</span><span>{fmtMoney(subtotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2.5 Доступные группы (только если в чеке есть абонемент/услуга) */}
          {client && hasSubItems && (
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>2.5. Доступные группы</div>
              <div style={{fontSize:12, color:'#888', marginBottom:12}}>
                Отметь группы, которые клиент может посещать по этому абонементу.
                Закрытые группы (🔒) не отмечены по умолчанию.
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {groups.map(g => {
                  const isChecked = selectedGroupIds.includes(g.id)
                  return (
                    <label key={g.id} style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'8px 12px', borderRadius:10, background: isChecked ? '#fafde8' : '#f9f9f9', border: isChecked ? '1px solid #BFD900' : '1px solid #f0f0f0', transition:'all 0.15s'}}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleGroup(g.id)}
                        style={{width:16, height:16, cursor:'pointer', accentColor:'#BFD900'}} />
                      <div style={{flex:1}}>
                        <span style={{fontSize:13, fontWeight:500, color:'#2a2a2a'}}>{g.name}</span>
                        {g.is_closed && <span style={{marginLeft:8, fontSize:11, color:'#e74c3c'}}>🔒 Закрытая</span>}
                        {g.description && <div style={{fontSize:11, color:'#888', marginTop:1}}>{g.description}</div>}
                      </div>
                    </label>
                  )
                })}
              </div>
              {selectedGroupIds.length === 0 && (
                <div style={{marginTop:10, fontSize:12, color:'#e74c3c', background:'#fdecea', borderRadius:8, padding:'8px 12px'}}>
                  ⚠️ Не выбрана ни одна группа — клиент не сможет посещать занятия
                </div>
              )}
            </div>
          )}

          {/* 3. Кто платит */}
          {client && items.length > 0 && (
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:12}}>3. Кто платит</div>
              <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
                {[['client','Сам клиент'], ['representative','Представитель'], ['other','Другой человек']].map(([v,l]) => (
                  <button key={v} onClick={() => setPayerType(v)} style={{padding:'7px 14px', borderRadius:8, border: payerType === v ? 'none' : '1px solid #e0e0e0', background: payerType === v ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: payerType === v ? 600 : 400}}>{l}</button>
                ))}
              </div>
              {payerType === 'representative' && (
                representatives.length > 0 ? (
                  <select value={payerRepId} onChange={e => setPayerRepId(e.target.value)} style={inputStyle}>
                    <option value="">Выберите представителя</option>
                    {representatives.map(r => <option key={r.id} value={r.id}>{r.full_name} ({r.role})</option>)}
                  </select>
                ) : <div style={{fontSize:12, color:'#BDBDBD'}}>У клиента нет представителей в базе</div>
              )}
              {payerType === 'other' && (
                <input value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="Имя плательщика" style={inputStyle} />
              )}
            </div>
          )}

          {/* 4. Скидка и бонусы */}
          {client && items.length > 0 && (
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:12}}>
                4. Скидка и бонусы <span style={{fontWeight:400, color:'#BDBDBD', fontSize:12}}>(необязательно)</span>
              </div>
              <label style={labelStyle}>Скидка</label>
              <div style={{display:'flex', gap:8, marginBottom:8}}>
                <button onClick={() => setDiscountMode('percent')} style={{flex:1, padding:'7px', borderRadius:8, border: discountMode === 'percent' ? 'none' : '1px solid #e0e0e0', background: discountMode === 'percent' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: discountMode === 'percent' ? 600 : 400}}>% от суммы</button>
                <button onClick={() => setDiscountMode('fixed')} style={{flex:1, padding:'7px', borderRadius:8, border: discountMode === 'fixed' ? 'none' : '1px solid #e0e0e0', background: discountMode === 'fixed' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: discountMode === 'fixed' ? 600 : 400}}>₽ фиксированно</button>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16}}>
                <input value={discountValue} onChange={e => setDiscountValue(e.target.value)} type="number" placeholder={discountMode === 'percent' ? 'Например: 10' : 'Например: 500'} style={inputStyle} />
                <input value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="Причина скидки" style={inputStyle} />
              </div>
              <label style={labelStyle}>Списать бонусные рубли <span style={{color:'#BDBDBD', fontWeight:400}}>(доступно: {client.bonus_rubles || 0} ₽)</span></label>
              <input value={bonusRublesUse} onChange={e => setBonusRublesUse(e.target.value)} type="number" min="0" max={client.bonus_rubles || 0} placeholder="0" style={{...inputStyle, maxWidth:200}} />
            </div>
          )}

          {/* 5. Способ оплаты */}
          {client && items.length > 0 && (
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:12}}>5. Способ оплаты</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                {PAYMENT_METHODS.map(m => (
                  <button key={m.id} onClick={() => setPaymentMethod(m.id)} style={{padding:'12px 14px', borderRadius:10, border: paymentMethod === m.id ? '2px solid #BFD900' : '1px solid #e0e0e0', background: paymentMethod === m.id ? '#fafde8' : '#fff', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'left'}}>
                    <div style={{fontWeight: paymentMethod === m.id ? 600 : 400, color:'#2a2a2a'}}>{m.label}</div>
                    <div style={{fontSize:10, color:'#BDBDBD', marginTop:2}}>{m.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 6. Итог */}
          {client && items.length > 0 && (
            <div style={{background:'#2a2a2a', borderRadius:14, padding:24, marginBottom:16}}>
              <div style={{fontSize:13, color:'#888', marginBottom:16}}>Итоговый расчёт</div>
              {[
                ['Сумма позиций', fmtMoney(subtotal)],
                discountAmount > 0 ? [`Скидка${discountReason ? ` (${discountReason})` : ''}`, '− ' + fmtMoney(discountAmount)] : null,
                bonusRublesUsed > 0 ? ['Списание баллов', '− ' + fmtMoney(bonusRublesUsed)] : null,
                acquiringFee > 0 ? [`Комиссия эквайринга (${acquiringPercent}%)`, '− ' + fmtMoney(acquiringFee)] : null,
              ].filter(Boolean).map(([label, value], i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:13, borderBottom:'1px solid #3a3a3a', color:'#aaa'}}>
                  <span>{label}</span><span>{value}</span>
                </div>
              ))}
              <div style={{display:'flex', justifyContent:'space-between', marginTop:14, fontSize:22, fontWeight:700, color:'#BFD900'}}>
                <span>К оплате:</span><span>{fmtMoney(afterDiscount)}</span>
              </div>
              {(paymentMethod === 'bonus' || paymentMethod === 'coins') && (
                <div style={{fontSize:11, color:'#888', marginTop:6}}>⚠️ Выручка: 0 ₽ (оплата внутренними средствами)</div>
              )}
              {hasSubItems && selectedGroupIds.length > 0 && (
                <div style={{fontSize:11, color:'#BDBDBD', marginTop:8}}>
                  Группы: {groups.filter(g => selectedGroupIds.includes(g.id)).map(g => g.name).join(', ')}
                </div>
              )}
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Комментарий к продаже (необязательно)"
                style={{...inputStyle, marginTop:16, background:'#3a3a3a', border:'1px solid #4a4a4a', color:'#fff'}} />
              <button onClick={handleSubmit} disabled={saving} style={{...primaryBtn, width:'100%', marginTop:12, fontSize:15, padding:'14px', opacity: saving ? 0.7 : 1}}>
                {saving ? 'Оформляем...' : '✅ Пробить продажу'}
              </button>
            </div>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА — продажи сегодня */}
        <div>
          <div style={cardStyle}>
            <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>Продажи сегодня</div>
            <div style={{fontSize:11, color:'#BDBDBD', marginBottom:14}}>
              {new Date().toLocaleDateString('ru-RU', {day:'numeric', month:'long'})}
            </div>
            {loadingSales ? (
              <div style={{textAlign:'center', color:'#BDBDBD', padding:20}}>Загрузка...</div>
            ) : todaySales.length === 0 ? (
              <div style={{textAlign:'center', color:'#BDBDBD', padding:20, fontSize:12}}>Продаж пока нет</div>
            ) : (
              <>
                <div style={{background:'#fafde8', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', justifyContent:'space-between'}}>
                  <span style={{fontSize:12, color:'#888'}}>Итого за день:</span>
                  <span style={{fontSize:14, fontWeight:700, color:'#6a7700'}}>
                    {fmtMoney(todaySales.reduce((s, e) => s + Number(e.total_net), 0))}
                  </span>
                </div>
                {todaySales.map(sale => {
                  const isExpanded = expandedSaleId === sale.id
                  return (
                    <div key={sale.id} style={{padding:'10px 0', borderBottom:'1px solid #f8f8f8'}}>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:2}}>
                        <span style={{fontSize:13, fontWeight:500, color:'#2a2a2a'}}>{sale.product_name}</span>
                        <span style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>{fmtMoney(sale.amount_paid)}</span>
                      </div>
                      <div style={{fontSize:11, color:'#BDBDBD'}}>
                        {sale.client?.full_name} · {PAYMENT_METHODS.find(m => m.id === sale.payment_method)?.label || sale.payment_method}
                      </div>
                      <div style={{fontSize:10, color:'#BDBDBD', marginTop:1}}>{fmtDateTime(sale.sale_date)}</div>
                      <button onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                        style={{background:'none', border:'none', color:'#2980b9', fontSize:11, cursor:'pointer', fontFamily:'Inter,sans-serif', padding:'4px 0 0 0'}}>
                        {isExpanded ? 'Скрыть ▲' : 'Подробнее ▼'}
                      </button>
                      {isExpanded && <SaleDetail sale={sale} />}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}