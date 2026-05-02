import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
const labelStyle = { fontSize:12, color:'#888', marginBottom:6, fontWeight:600, display:'block' }
const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16 }
const titleStyle = { fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:4 }
const hintStyle = { fontSize:12, color:'#888', marginBottom:14 }
const saveBtn = { padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap' }
const chipStyle = (active) => ({ padding:'7px 14px', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', border: active ? 'none' : '1px solid #e8e8e8', background: active ? '#BFD900' : '#fff', color: active ? '#2a2a2a' : '#888', fontWeight: active ? 600 : 400 })
const smallBtn = { padding:'5px 10px', borderRadius:7, fontSize:11, cursor:'pointer', fontFamily:'Inter,sans-serif', border:'none' }

const fmtMoney = (n) => (Number(n) || 0).toLocaleString('ru-RU') + ' ₽'
const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'numeric' })
const fmtDateTime = (d) => new Date(d).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
const todayStr = () => new Date().toISOString().split('T')[0]

const PERIODS = [
  ['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Этот месяц'],
  ['prev_month', 'Прошлый месяц'], ['quarter', 'Квартал'], ['year', 'Год'], ['custom', 'Произвольный']
]

const PAYMENT_METHODS = {
  cash: '💵 Наличные',
  bank: '🏦 Безнал',
  online: '💳 Эквайринг',
  bonus: '🎁 Баллы',
  coins: '🪙 SDTшки',
}

const PRODUCT_TYPES = {
  subscription: 'Абонемент',
  service: 'Услуга',
  indiv: 'Индив',
  merch: 'Мерч',
  event: 'Мероприятие',
}

function toLocalStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getPeriodRange(period) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  let from, to
  if (period === 'today') { from = new Date(y, m, d); to = new Date(y, m, d) }
  else if (period === 'week') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1
    from = new Date(y, m, d - day); to = new Date(y, m, d - day + 6)
  }
  else if (period === 'month') { from = new Date(y, m, 1); to = new Date(y, m + 1, 0) }
  else if (period === 'prev_month') { from = new Date(y, m - 1, 1); to = new Date(y, m, 0) }
  else if (period === 'quarter') {
    const qStart = Math.floor(m / 3) * 3
    from = new Date(y, qStart, 1); to = new Date(y, qStart + 3, 0)
  }
  else if (period === 'year') { from = new Date(y, 0, 1); to = new Date(y, 11, 31) }
  return { from: toLocalStr(from), to: toLocalStr(to) }
}

function getPrevPeriodRange(period, from, to) {
  const f = new Date(from)
  const t = new Date(to)
  const days = Math.round((t - f) / (1000 * 60 * 60 * 24)) + 1
  const prevTo = new Date(f); prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1)
  return { from: toLocalStr(prevFrom), to: toLocalStr(prevTo) }
}

function pctChange(curr, prev) {
  if (!prev || prev === 0) return null
  return Math.round((curr - prev) / prev * 100)
}

function PctBadge({ value }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <span style={{fontSize:11, fontWeight:600, color: up ? '#27ae60' : '#e74c3c', background: up ? '#eafaf1' : '#fdecea', padding:'2px 7px', borderRadius:6, marginLeft:8}}>
      {up ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  )
}

function BarChart({ data, mode }) {
  if (!data || data.length === 0) return <div style={{textAlign:'center', color:'#BDBDBD', padding:30, fontSize:12}}>Нет данных за период</div>
  const maxVal = Math.max(...data.map(d => Math.max(mode !== 'expenses' ? d.income : 0, mode !== 'income' ? d.expense : 0)), 1)
  const W = 600, H = 160, barW = Math.max(4, Math.floor((W - 40) / data.length) - 2)
  const step = (W - 40) / data.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{width:'100%', maxHeight:200}} preserveAspectRatio="none">
      {data.map((d, i) => {
        const x = 20 + i * step + step / 2
        const incH = mode !== 'expenses' ? Math.round((d.income / maxVal) * H) : 0
        const expH = mode !== 'income' ? Math.round((d.expense / maxVal) * H) : 0
        const bothMode = mode === 'both'
        return (
          <g key={i}>
            {mode !== 'expenses' && incH > 0 && <rect x={x - (bothMode ? barW * 0.6 : barW / 2)} y={H - incH} width={bothMode ? barW * 0.55 : barW} height={incH} rx={2} fill="#BFD900" opacity={0.9} />}
            {mode !== 'income' && expH > 0 && <rect x={bothMode ? x + barW * 0.05 : x - barW / 2} y={H - expH} width={bothMode ? barW * 0.55 : barW} height={expH} rx={2} fill="#e74c3c" opacity={0.75} />}
            {(i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1) && <text x={x} y={H + 20} textAnchor="middle" fontSize={9} fill="#BDBDBD">{d.label}</text>}
          </g>
        )
      })}
      <line x1={20} y1={H} x2={W - 20} y2={H} stroke="#f0f0f0" strokeWidth={1} />
    </svg>
  )
}

function FinanceOverview() {
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [chartMode, setChartMode] = useState('both')
  const [revenue, setRevenue] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [prevRevenue, setPrevRevenue] = useState(0)
  const [prevExpenses, setPrevExpenses] = useState(0)
  const [paymentBreakdown, setPaymentBreakdown] = useState([])
  const [chartData, setChartData] = useState([])

  useEffect(() => { load() }, [period, customFrom, customTo])

  const getRanges = () => {
    let from, to
    if (period === 'custom') {
      if (!customFrom || !customTo) return null
      from = customFrom; to = customTo
    } else {
      const r = getPeriodRange(period)
      from = r.from; to = r.to
    }
    const prev = getPrevPeriodRange(period, from, to)
    return { from, to, prevFrom: prev.from, prevTo: prev.to }
  }

  const load = async () => {
    const ranges = getRanges()
    if (!ranges) { setLoading(false); return }
    setLoading(true)
    const { from, to, prevFrom, prevTo } = ranges
    const { data: sales } = await supabase.from('sales').select('total_net, payment_method, sale_date').gte('sale_date', from + 'T00:00:00').lte('sale_date', to + 'T23:59:59')
    const { data: exp } = await supabase.from('expenses').select('amount, expense_date').gte('expense_date', from).lte('expense_date', to)
    const { data: prevSales } = await supabase.from('sales').select('total_net').gte('sale_date', prevFrom + 'T00:00:00').lte('sale_date', prevTo + 'T23:59:59')
    const { data: prevExp } = await supabase.from('expenses').select('amount').gte('expense_date', prevFrom).lte('expense_date', prevTo)

    const totalRevenue = (sales || []).reduce((s, x) => s + Number(x.total_net), 0)
    const totalExpenses = (exp || []).reduce((s, x) => s + Number(x.amount), 0)
    setRevenue(totalRevenue)
    setExpenses(totalExpenses)
    setPrevRevenue((prevSales || []).reduce((s, x) => s + Number(x.total_net), 0))
    setPrevExpenses((prevExp || []).reduce((s, x) => s + Number(x.amount), 0))

    const byMethod = {}
    ;(sales || []).forEach(s => { byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + Number(s.total_net) })
    setPaymentBreakdown(Object.entries(byMethod).sort((a, b) => b[1] - a[1]))

    const fromDate = new Date(from)
    const toDate = new Date(to)
    const days = Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1
    const byDay = {}
    ;(sales || []).forEach(s => { const day = s.sale_date.split('T')[0]; byDay[day] = (byDay[day] || 0) + Number(s.total_net) })
    const byDayExp = {}
    ;(exp || []).forEach(e => { byDayExp[e.expense_date] = (byDayExp[e.expense_date] || 0) + Number(e.amount) })

    const chart = []
    if (days <= 31) {
      for (let i = 0; i < days; i++) {
        const d = new Date(fromDate); d.setDate(d.getDate() + i)
        const key = toLocalStr(d)
        chart.push({ label: d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' }), income: byDay[key] || 0, expense: byDayExp[key] || 0 })
      }
    } else {
      let cur = new Date(fromDate)
      while (cur <= toDate) {
        const label = cur.toLocaleDateString('ru-RU', { day:'numeric', month:'short' })
        let inc = 0, expV = 0
        for (let j = 0; j < 7; j++) {
          const d = new Date(cur); d.setDate(d.getDate() + j)
          const key = toLocalStr(d)
          inc += byDay[key] || 0; expV += byDayExp[key] || 0
        }
        chart.push({ label, income: inc, expense: expV })
        cur.setDate(cur.getDate() + 7)
      }
    }
    setChartData(chart)
    setLoading(false)
  }

  const profit = revenue - expenses
  const prevProfit = prevRevenue - prevExpenses

  return (
    <div>
      <div style={cardStyle}>
        <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom: period === 'custom' ? 12 : 0}}>
          {PERIODS.map(([v, l]) => <button key={v} onClick={() => setPeriod(v)} style={chipStyle(period === v)}>{l}</button>)}
        </div>
        {period === 'custom' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, maxWidth:400, marginTop:12}}>
            <div><label style={labelStyle}>С</label><input value={customFrom} onChange={e => setCustomFrom(e.target.value)} type="date" style={inputStyle} /></div>
            <div><label style={labelStyle}>По</label><input value={customTo} onChange={e => setCustomTo(e.target.value)} type="date" style={inputStyle} /></div>
          </div>
        )}
      </div>
      {loading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div> : (
        <>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16}}>
            {[
              { label:'Выручка', value:revenue, prev:prevRevenue, color:'#BFD900', bg:'#fafde8' },
              { label:'Расходы', value:expenses, prev:prevExpenses, color:'#e74c3c', bg:'#fdecea' },
              { label:'Прибыль', value:profit, prev:prevProfit, color:'#2980b9', bg:'#eaf4fd' },
            ].map(({ label, value, prev, color, bg }) => (
              <div key={label} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
                <div style={{fontSize:12, color:'#888', marginBottom:8, fontWeight:600}}>{label}</div>
                <div style={{fontSize:22, fontWeight:700, color:'#2a2a2a', marginBottom:4}}>{fmtMoney(value)}</div>
                <div style={{display:'flex', alignItems:'center'}}>
                  <span style={{fontSize:11, color:'#BDBDBD'}}>vs прошлый период</span>
                  <PctBadge value={pctChange(value, prev)} />
                </div>
                <div style={{height:4, background:bg, borderRadius:4, marginTop:12}}>
                  <div style={{height:4, background:color, borderRadius:4, width:'100%', opacity:0.6}} />
                </div>
              </div>
            ))}
          </div>
          <div style={{...cardStyle, marginBottom:16}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>Динамика</div>
              <div style={{display:'flex', gap:6}}>
                {[['both','Всё'], ['income','Доходы'], ['expenses','Расходы']].map(([v, l]) => (
                  <button key={v} onClick={() => setChartMode(v)} style={{...chipStyle(chartMode === v), padding:'5px 12px', fontSize:11}}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{display:'flex', gap:16, marginBottom:12}}>
              {chartMode !== 'expenses' && <div style={{display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#888'}}><div style={{width:10, height:10, background:'#BFD900', borderRadius:2}} /> Доходы</div>}
              {chartMode !== 'income' && <div style={{display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#888'}}><div style={{width:10, height:10, background:'#e74c3c', borderRadius:2, opacity:0.75}} /> Расходы</div>}
            </div>
            <BarChart data={chartData} mode={chartMode} />
          </div>
          <div style={cardStyle}>
            <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>По способам оплаты</div>
            {paymentBreakdown.length === 0 ? <div style={{fontSize:12, color:'#BDBDBD'}}>Нет продаж за период</div> : (
              paymentBreakdown.map(([method, sum]) => {
                const pct = revenue > 0 ? Math.round(sum / revenue * 100) : 0
                return (
                  <div key={method} style={{marginBottom:12}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                      <span style={{fontSize:13, color:'#2a2a2a'}}>{PAYMENT_METHODS[method] || method}</span>
                      <span style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>{fmtMoney(sum)} <span style={{color:'#BDBDBD', fontWeight:400, fontSize:11}}>({pct}%)</span></span>
                    </div>
                    <div style={{height:6, background:'#f0f0f0', borderRadius:4}}>
                      <div style={{height:6, background:'#BFD900', borderRadius:4, width:`${pct}%`, transition:'width 0.3s'}} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FinanceSales({ session }) {
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMethod, setFilterMethod] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [onlyAcquiring, setOnlyAcquiring] = useState(false)
  const [filterSeller, setFilterSeller] = useState('all')
  const [sellers, setSellers] = useState([])
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setUserRole(data?.role)
      }
    }
    loadRole()
  }, [])

  useEffect(() => { load() }, [period, customFrom, customTo])

  const getRange = () => {
    if (period === 'custom') {
      if (!customFrom || !customTo) return null
      return { from: customFrom, to: customTo }
    }
    return getPeriodRange(period)
  }

  const load = async () => {
    const range = getRange()
    if (!range) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('sales')
      .select('*, client:client_id(full_name, email), creator:created_by(id, full_name, email)')
      .gte('sale_date', range.from + 'T00:00:00')
      .lte('sale_date', range.to + 'T23:59:59')
      .order('sale_date', { ascending: false })
    setSales(data || [])

    // Уникальные продавцы
    const sellerMap = {}
    ;(data || []).forEach(s => {
      if (s.creator) sellerMap[s.creator.id] = s.creator.full_name || s.creator.email
    })
    setSellers(Object.entries(sellerMap))
    setLoading(false)
  }

  const handleCancel = async (sale) => {
    if (!confirm(`Отменить продажу "${sale.product_name}" на ${fmtMoney(sale.amount_paid)}? Это действие нельзя отменить.`)) return
    await supabase.from('sales').update({ is_cancelled: true, cancelled_at: new Date().toISOString(), cancelled_by: session.user.id }).eq('id', sale.id)
    load()
  }

  // Фильтрация
  const filtered = sales.filter(s => {
    if (s.is_cancelled) return false
    if (onlyAcquiring && s.payment_method !== 'online') return false
    if (filterMethod !== 'all' && s.payment_method !== filterMethod) return false
    if (filterType !== 'all' && s.product_type !== filterType) return false
    if (filterSeller !== 'all' && s.creator?.id !== filterSeller) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (s.client?.full_name || s.client?.email || '').toLowerCase()
      if (!name.includes(q)) return false
    }
    return true
  })

  const total = filtered.reduce((s, x) => s + Number(x.amount_paid), 0)
  const totalNet = filtered.reduce((s, x) => s + Number(x.total_net), 0)
  const avgCheck = filtered.length > 0 ? Math.round(total / filtered.length) : 0

  // Топ-5 клиентов
  const byClient = {}
  filtered.forEach(s => {
    const name = s.client?.full_name || s.client?.email || 'Неизвестен'
    byClient[name] = (byClient[name] || 0) + Number(s.amount_paid)
  })
  const top5 = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div>
      {/* Фильтры */}
      <div style={cardStyle}>
        <div style={{fontSize:12, color:'#888', marginBottom:8, fontWeight:600}}>Период</div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom: period === 'custom' ? 12 : 16}}>
          {PERIODS.map(([v, l]) => <button key={v} onClick={() => setPeriod(v)} style={chipStyle(period === v)}>{l}</button>)}
        </div>
        {period === 'custom' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, maxWidth:400, marginBottom:16}}>
            <div><label style={labelStyle}>С</label><input value={customFrom} onChange={e => setCustomFrom(e.target.value)} type="date" style={inputStyle} /></div>
            <div><label style={labelStyle}>По</label><input value={customTo} onChange={e => setCustomTo(e.target.value)} type="date" style={inputStyle} /></div>
          </div>
        )}

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
          <div>
            <div style={{fontSize:12, color:'#888', marginBottom:6, fontWeight:600}}>Способ оплаты</div>
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={inputStyle}>
              <option value="all">Все способы</option>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:12, color:'#888', marginBottom:6, fontWeight:600}}>Тип продукта</div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inputStyle}>
              <option value="all">Все типы</option>
              {Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
          <div>
            <div style={{fontSize:12, color:'#888', marginBottom:6, fontWeight:600}}>Продавец</div>
            <select value={filterSeller} onChange={e => setFilterSeller(e.target.value)} style={inputStyle}>
              <option value="all">Все продавцы</option>
              {sellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:12, color:'#888', marginBottom:6, fontWeight:600}}>Поиск по клиенту</div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Имя или email..." style={inputStyle} />
          </div>
        </div>

        <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#2a2a2a', cursor:'pointer'}}>
          <input type="checkbox" checked={onlyAcquiring} onChange={e => setOnlyAcquiring(e.target.checked)} style={{accentColor:'#BFD900'}} />
          Только эквайринг
        </label>
      </div>

      {loading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div> : (
        <>
          {/* Итоговые карточки */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:16}}>
            {[
              { label:'Продаж', value: filtered.length, money: false },
              { label:'Оплачено', value: total, money: true },
              { label:'Чистая выручка', value: totalNet, money: true },
              { label:'Средний чек', value: avgCheck, money: true },
            ].map(({ label, value, money }) => (
              <div key={label} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:16}}>
                <div style={{fontSize:11, color:'#888', marginBottom:6, fontWeight:600}}>{label}</div>
                <div style={{fontSize:20, fontWeight:700, color:'#2a2a2a'}}>{money ? fmtMoney(value) : value}</div>
              </div>
            ))}
          </div>

          {/* Топ-5 клиентов */}
          {top5.length > 0 && (
            <div style={{...cardStyle, marginBottom:16}}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>Топ-5 клиентов за период</div>
              {top5.map(([name, sum], i) => {
                const pct = total > 0 ? Math.round(sum / total * 100) : 0
                return (
                  <div key={name} style={{marginBottom:10}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                      <span style={{fontSize:13, color:'#2a2a2a'}}>
                        <span style={{color:'#BDBDBD', marginRight:8, fontSize:11}}>#{i + 1}</span>
                        {name}
                      </span>
                      <span style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>{fmtMoney(sum)} <span style={{color:'#BDBDBD', fontWeight:400, fontSize:11}}>({pct}%)</span></span>
                    </div>
                    <div style={{height:5, background:'#f0f0f0', borderRadius:4}}>
                      <div style={{height:5, background:'#BFD900', borderRadius:4, width:`${pct}%`}} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Таблица */}
          <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', overflow:'hidden'}}>
            {filtered.length === 0 ? (
              <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Нет продаж за период</div>
            ) : (
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #f0f0f0'}}>
                    {['Дата', 'Клиент', 'Продукт', 'Тип', 'Оплата', 'Сумма', 'Выручка', 'Продавец', ''].map((h, i) => (
                      <th key={i} style={{textAlign: [5,6].includes(i) ? 'right' : 'left', padding:'12px 14px', fontSize:11, color:'#BDBDBD', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:400, whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} style={{borderBottom:'1px solid #f8f8f8'}}>
                      <td style={{padding:'10px 14px', fontSize:12, color:'#888', whiteSpace:'nowrap'}}>{fmtDateTime(s.sale_date)}</td>
                      <td style={{padding:'10px 14px', fontSize:13, color:'#2a2a2a', fontWeight:500}}>{s.client?.full_name || s.client?.email || '—'}</td>
                      <td style={{padding:'10px 14px', fontSize:13, color:'#2a2a2a'}}>{s.product_name}</td>
                      <td style={{padding:'10px 14px', fontSize:11, color:'#888'}}>{PRODUCT_TYPES[s.product_type] || s.product_type}</td>
                      <td style={{padding:'10px 14px', fontSize:12, color:'#888', whiteSpace:'nowrap'}}>{PAYMENT_METHODS[s.payment_method] || s.payment_method}</td>
                      <td style={{padding:'10px 14px', fontSize:13, fontWeight:600, color:'#2a2a2a', textAlign:'right', whiteSpace:'nowrap'}}>{fmtMoney(s.amount_paid)}</td>
                      <td style={{padding:'10px 14px', fontSize:13, color:'#888', textAlign:'right', whiteSpace:'nowrap'}}>{fmtMoney(s.total_net)}</td>
                      <td style={{padding:'10px 14px', fontSize:12, color:'#888'}}>{s.creator?.full_name || s.creator?.email || '—'}</td>
                      <td style={{padding:'10px 14px', whiteSpace:'nowrap'}}>
                        {userRole === 'owner' && (
                          <button onClick={() => handleCancel(s)}
                            style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:'3px 6px', fontFamily:'Inter,sans-serif'}}>
                            Отменить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FinanceSettings() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [acquiring, setAcquiring] = useState('')
  const [taxType, setTaxType] = useState('percent')
  const [taxValue, setTaxValue] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [editCatId, setEditCatId] = useState(null)
  const [editCatName, setEditCatName] = useState('')
  const [acquiringSaved, setAcquiringSaved] = useState(false)
  const [taxSaved, setTaxSaved] = useState(false)
  const [expandedCats, setExpandedCats] = useState({})
  const [editSubId, setEditSubId] = useState(null)
  const [editSubName, setEditSubName] = useState('')
  const [newSubByCat, setNewSubByCat] = useState({})

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const { data: s } = await supabase.from('finance_settings').select('*')
    const map = {}
    ;(s || []).forEach(r => { map[r.key] = r.value })
    setAcquiring(map.acquiring_fee_percent || '')
    setTaxType(map.tax_type || 'percent')
    setTaxValue(map.tax_value || '')
    const { data: c } = await supabase.from('expense_categories').select('*').order('sort_order')
    setCategories(c || [])
    const { data: sub } = await supabase.from('expense_subcategories').select('*').order('sort_order')
    setSubcategories(sub || [])
    setLoading(false)
  }

  const saveSetting = async (key, value) => {
    const { error } = await supabase.from('finance_settings').upsert({ key, value: String(value) }, { onConflict: 'key' })
    if (error) alert('Ошибка сохранения: ' + error.message)
    return !error
  }

  const handleSaveAcquiring = async () => {
    if (await saveSetting('acquiring_fee_percent', acquiring)) { setAcquiringSaved(true); setTimeout(() => setAcquiringSaved(false), 1500) }
  }
  const handleSaveTax = async () => {
    const ok1 = await saveSetting('tax_type', taxType)
    const ok2 = await saveSetting('tax_value', taxValue)
    if (ok1 && ok2) { setTaxSaved(true); setTimeout(() => setTaxSaved(false), 1500) }
  }
  const handleAddCategory = async () => {
    const name = newCategory.trim()
    if (!name) return
    const maxOrder = Math.max(0, ...categories.map(c => c.sort_order || 0))
    const { error } = await supabase.from('expense_categories').insert({ name, is_system: false, sort_order: maxOrder + 1 })
    if (error) { alert('Не удалось добавить: ' + error.message); return }
    setNewCategory(''); loadAll()
  }
  const handleSaveCategoryEdit = async (id) => {
    const name = editCatName.trim()
    if (!name) return
    const { error } = await supabase.from('expense_categories').update({ name }).eq('id', id)
    if (error) { alert('Не удалось сохранить: ' + error.message); return }
    setEditCatId(null); setEditCatName(''); loadAll()
  }
  const handleDeleteCategory = async (cat) => {
    if (!confirm(`Удалить категорию "${cat.name}"? Её подкатегории тоже удалятся.`)) return
    const { error } = await supabase.from('expense_categories').delete().eq('id', cat.id)
    if (error) { alert('Не удалось удалить: ' + error.message); return }
    loadAll()
  }
  const toggleExpand = (id) => setExpandedCats(p => ({...p, [id]: !p[id]}))
  const handleAddSub = async (categoryId) => {
    const name = (newSubByCat[categoryId] || '').trim()
    if (!name) return
    const existing = subcategories.filter(s => s.category_id === categoryId)
    const maxOrder = Math.max(0, ...existing.map(s => s.sort_order || 0))
    const { error } = await supabase.from('expense_subcategories').insert({ category_id: categoryId, name, is_system: false, sort_order: maxOrder + 1 })
    if (error) { alert('Не удалось добавить: ' + error.message); return }
    setNewSubByCat(p => ({...p, [categoryId]: ''})); loadAll()
  }
  const handleSaveSubEdit = async (id) => {
    const name = editSubName.trim()
    if (!name) return
    const { error } = await supabase.from('expense_subcategories').update({ name }).eq('id', id)
    if (error) { alert('Не удалось сохранить: ' + error.message); return }
    setEditSubId(null); setEditSubName(''); loadAll()
  }
  const handleDeleteSub = async (sub) => {
    if (!confirm(`Удалить подкатегорию "${sub.name}"?`)) return
    const { error } = await supabase.from('expense_subcategories').delete().eq('id', sub.id)
    if (error) { alert('Не удалось удалить: ' + error.message); return }
    loadAll()
  }

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>

  return (
    <div>
      <div style={cardStyle}>
        <div style={titleStyle}>Комиссия эквайринга</div>
        <div style={hintStyle}>% с онлайн-оплат, автоматически учтётся в расходах</div>
        <label style={labelStyle}>% комиссии</label>
        <div style={{display:'flex', gap:8, maxWidth:320}}>
          <input value={acquiring} onChange={e => setAcquiring(e.target.value)} type="number" step="0.1" placeholder="2.5" style={inputStyle} />
          <button onClick={handleSaveAcquiring} style={saveBtn}>{acquiringSaved ? 'Сохранено ✓' : 'Сохранить'}</button>
        </div>
      </div>
      <div style={cardStyle}>
        <div style={titleStyle}>Налог</div>
        <div style={hintStyle}>Система сама посчитает и добавит в расходы</div>
        <div style={{display:'flex', gap:8, marginBottom:12, maxWidth:320}}>
          <button onClick={() => setTaxType('percent')} style={{flex:1, padding:'8px', borderRadius:8, border: taxType === 'percent' ? 'none' : '1px solid #e0e0e0', background: taxType === 'percent' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: taxType === 'percent' ? 600 : 400}}>% с оборота</button>
          <button onClick={() => setTaxType('fixed')} style={{flex:1, padding:'8px', borderRadius:8, border: taxType === 'fixed' ? 'none' : '1px solid #e0e0e0', background: taxType === 'fixed' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: taxType === 'fixed' ? 600 : 400}}>Фикс. ₽/мес</button>
        </div>
        <label style={labelStyle}>{taxType === 'percent' ? '% налога' : 'Сумма в месяц, ₽'}</label>
        <div style={{display:'flex', gap:8, maxWidth:320}}>
          <input value={taxValue} onChange={e => setTaxValue(e.target.value)} type="number" step={taxType === 'percent' ? '0.1' : '1'} placeholder={taxType === 'percent' ? '6' : '10000'} style={inputStyle} />
          <button onClick={handleSaveTax} style={saveBtn}>{taxSaved ? 'Сохранено ✓' : 'Сохранить'}</button>
        </div>
      </div>
      <div style={cardStyle}>
        <div style={titleStyle}>Категории и подкатегории расходов</div>
        <div style={hintStyle}>Нажми на категорию чтобы увидеть/изменить её подкатегории</div>
        {categories.map(cat => {
          const subs = subcategories.filter(s => s.category_id === cat.id)
          const expanded = expandedCats[cat.id]
          return (
            <div key={cat.id} style={{borderBottom:'1px solid #f0f0f0', padding:'4px 0'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 0'}}>
                {editCatId === cat.id ? (
                  <>
                    <input value={editCatName} onChange={e => setEditCatName(e.target.value)} style={{...inputStyle, flex:1}} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveCategoryEdit(cat.id) }} />
                    <button onClick={() => handleSaveCategoryEdit(cat.id)} style={{padding:'7px 14px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Ок</button>
                    <button onClick={() => { setEditCatId(null); setEditCatName('') }} style={{padding:'7px 12px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => toggleExpand(cat.id)} style={{background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#888', width:22, padding:0}}>{expanded ? '▾' : '▸'}</button>
                    <div style={{flex:1, fontSize:13, color:'#2a2a2a', fontWeight:500, cursor:'pointer'}} onClick={() => toggleExpand(cat.id)}>
                      {cat.name} <span style={{color:'#BDBDBD', fontWeight:400, fontSize:12}}>({subs.length})</span>
                    </div>
                    <button onClick={() => { setEditCatId(cat.id); setEditCatName(cat.name) }} style={{fontSize:12, color:'#888', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', fontFamily:'Inter,sans-serif'}}>Изменить</button>
                    <button onClick={() => handleDeleteCategory(cat)} style={{fontSize:12, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', fontFamily:'Inter,sans-serif'}}>Удалить</button>
                  </>
                )}
              </div>
              {expanded && (
                <div style={{paddingLeft:30, paddingBottom:10, paddingTop:4}}>
                  {subs.length === 0 && <div style={{fontSize:12, color:'#BDBDBD', padding:'4px 0'}}>Пока нет подкатегорий</div>}
                  {subs.map(sub => (
                    <div key={sub.id} style={{display:'flex', alignItems:'center', gap:8, padding:'4px 0'}}>
                      {editSubId === sub.id ? (
                        <>
                          <input value={editSubName} onChange={e => setEditSubName(e.target.value)} style={{...inputStyle, flex:1, padding:'6px 10px'}} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveSubEdit(sub.id) }} />
                          <button onClick={() => handleSaveSubEdit(sub.id)} style={{...smallBtn, background:'#BFD900', fontWeight:700, color:'#2a2a2a'}}>Ок</button>
                          <button onClick={() => { setEditSubId(null); setEditSubName('') }} style={{...smallBtn, background:'transparent', border:'1px solid #e0e0e0', color:'#888'}}>Отмена</button>
                        </>
                      ) : (
                        <>
                          <div style={{flex:1, fontSize:12, color:'#3a3a3a'}}>· {sub.name}</div>
                          <button onClick={() => { setEditSubId(sub.id); setEditSubName(sub.name) }} style={{fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer', padding:'3px 6px', fontFamily:'Inter,sans-serif'}}>Изменить</button>
                          <button onClick={() => handleDeleteSub(sub)} style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:'3px 6px', fontFamily:'Inter,sans-serif'}}>Удалить</button>
                        </>
                      )}
                    </div>
                  ))}
                  <div style={{display:'flex', gap:6, marginTop:8}}>
                    <input value={newSubByCat[cat.id] || ''} onChange={e => setNewSubByCat(p => ({...p, [cat.id]: e.target.value}))} placeholder="Новая подкатегория..." style={{...inputStyle, flex:1, padding:'6px 10px'}} onKeyDown={e => { if (e.key === 'Enter') handleAddSub(cat.id) }} />
                    <button onClick={() => handleAddSub(cat.id)} disabled={!(newSubByCat[cat.id] || '').trim()} style={{...smallBtn, background:'#BFD900', color:'#2a2a2a', fontWeight:700, padding:'6px 12px', opacity: (newSubByCat[cat.id] || '').trim() ? 1 : 0.5}}>+ Добавить</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div style={{display:'flex', gap:8, marginTop:14}}>
          <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Новая категория..." style={{...inputStyle, flex:1}} onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }} />
          <button onClick={handleAddCategory} disabled={!newCategory.trim()} style={{...saveBtn, opacity: newCategory.trim() ? 1 : 0.5}}>+ Добавить</button>
        </div>
      </div>
    </div>
  )
}

function FinanceExpenses({ session }) {
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ category:'', subcategoryMode:'existing', subcategoryExisting:'', subcategoryCustom:'', saveSubcategory:false, amount:'', expense_date: todayStr(), comment:'' })

  useEffect(() => { loadCategories() }, [])
  useEffect(() => { loadExpenses() }, [period, customFrom, customTo, filterCategory])

  const loadCategories = async () => {
    const { data: c } = await supabase.from('expense_categories').select('*').order('sort_order')
    setCategories(c || [])
    const { data: s } = await supabase.from('expense_subcategories').select('*').order('sort_order')
    setSubcategories(s || [])
  }

  const loadExpenses = async () => {
    setLoading(true)
    let from, to
    if (period === 'custom') {
      if (!customFrom || !customTo) { setExpenses([]); setLoading(false); return }
      from = customFrom; to = customTo
    } else {
      const r = getPeriodRange(period); from = r.from; to = r.to
    }
    let q = supabase.from('expenses').select('*').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending:false }).order('created_at', { ascending:false })
    if (filterCategory !== 'all') q = q.eq('category', filterCategory)
    const { data, error } = await q
    if (error) alert('Ошибка загрузки: ' + error.message)
    setExpenses(data || [])
    setLoading(false)
  }

  const resetForm = () => { setForm({ category:'', subcategoryMode:'existing', subcategoryExisting:'', subcategoryCustom:'', saveSubcategory:false, amount:'', expense_date: todayStr(), comment:'' }); setEditingId(null) }
  const handleStartAdd = () => { resetForm(); setShowForm(true) }
  const handleStartEdit = (exp) => {
    setForm({ category: exp.category, subcategoryMode: 'existing', subcategoryExisting: exp.subcategory || '', subcategoryCustom: '', saveSubcategory: false, amount: String(exp.amount), expense_date: exp.expense_date, comment: exp.comment || '' })
    setEditingId(exp.id); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.category || !form.amount || !form.expense_date) { alert('Заполни категорию, сумму и дату'); return }
    const amount = parseFloat(String(form.amount).replace(',', '.'))
    if (isNaN(amount) || amount <= 0) { alert('Некорректная сумма'); return }
    let finalSubcategory = null
    if (form.subcategoryMode === 'existing') { finalSubcategory = form.subcategoryExisting || null }
    else {
      const customName = form.subcategoryCustom.trim()
      if (customName) {
        finalSubcategory = customName
        if (form.saveSubcategory) {
          const cat = categories.find(c => c.name === form.category)
          if (cat) {
            const existing = subcategories.filter(s => s.category_id === cat.id)
            const maxOrder = Math.max(0, ...existing.map(s => s.sort_order || 0))
            await supabase.from('expense_subcategories').insert({ category_id: cat.id, name: customName, is_system: false, sort_order: maxOrder + 1 })
            loadCategories()
          }
        }
      }
    }
    const payload = { category: form.category, subcategory: finalSubcategory, amount, expense_date: form.expense_date, comment: form.comment.trim() || null }
    if (editingId) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editingId)
      if (error) { alert('Не удалось сохранить: ' + error.message); return }
    } else {
      const { error } = await supabase.from('expenses').insert({ ...payload, created_by: session.user.id })
      if (error) { alert('Не удалось добавить: ' + error.message); return }
    }
    setShowForm(false); resetForm(); loadExpenses()
  }

  const handleDelete = async (exp) => {
    if (!confirm(`Удалить расход на ${fmtMoney(exp.amount)}?`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', exp.id)
    if (error) { alert('Не удалось удалить: ' + error.message); return }
    loadExpenses()
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const byCategory = {}
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount) })
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const currentCat = categories.find(c => c.name === form.category)
  const availableSubs = currentCat ? subcategories.filter(s => s.category_id === currentCat.id) : []

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10}}>
        <div style={{fontSize:16, fontWeight:600, color:'#2a2a2a'}}>Расходы</div>
        <button onClick={handleStartAdd} style={saveBtn}>+ Добавить расход</button>
      </div>
      {showForm && (
        <div style={cardStyle}>
          <div style={titleStyle}>{editingId ? 'Редактировать расход' : 'Новый расход'}</div>
          <div style={{marginTop:12}}>
            <label style={labelStyle}>Категория *</label>
            <select value={form.category} onChange={e => setForm({...form, category:e.target.value, subcategoryExisting:'', subcategoryCustom:'', subcategoryMode:'existing'})} style={inputStyle}>
              <option value="">Выберите категорию</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            {form.category && (
              <div style={{marginTop:12}}>
                <label style={labelStyle}>Подкатегория</label>
                <div style={{display:'flex', gap:8, marginBottom:8}}>
                  <button onClick={() => setForm({...form, subcategoryMode:'existing'})} style={{flex:1, padding:'7px', borderRadius:8, border: form.subcategoryMode === 'existing' ? 'none' : '1px solid #e0e0e0', background: form.subcategoryMode === 'existing' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: form.subcategoryMode === 'existing' ? 600 : 400}}>Из списка</button>
                  <button onClick={() => setForm({...form, subcategoryMode:'custom'})} style={{flex:1, padding:'7px', borderRadius:8, border: form.subcategoryMode === 'custom' ? 'none' : '1px solid #e0e0e0', background: form.subcategoryMode === 'custom' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: form.subcategoryMode === 'custom' ? 600 : 400}}>+ Своя</button>
                </div>
                {form.subcategoryMode === 'existing' ? (
                  <select value={form.subcategoryExisting} onChange={e => setForm({...form, subcategoryExisting:e.target.value})} style={inputStyle}>
                    <option value="">Без подкатегории</option>
                    {availableSubs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                ) : (
                  <div>
                    <input value={form.subcategoryCustom} onChange={e => setForm({...form, subcategoryCustom:e.target.value})} placeholder="Название подкатегории" style={inputStyle} />
                    <label style={{display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#2a2a2a', marginTop:8, cursor:'pointer'}}>
                      <input type="checkbox" checked={form.saveSubcategory} onChange={e => setForm({...form, saveSubcategory:e.target.checked})} />
                      Запомнить в списке категории "{form.category}"
                    </label>
                  </div>
                )}
              </div>
            )}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
              <div><label style={labelStyle}>Сумма, ₽ *</label><input value={form.amount} onChange={e => setForm({...form, amount:e.target.value})} type="number" step="0.01" placeholder="0" style={inputStyle} /></div>
              <div><label style={labelStyle}>Дата *</label><input value={form.expense_date} onChange={e => setForm({...form, expense_date:e.target.value})} type="date" style={inputStyle} /></div>
            </div>
            <label style={{...labelStyle, marginTop:12}}>Комментарий</label>
            <input value={form.comment} onChange={e => setForm({...form, comment:e.target.value})} placeholder="Пояснение (необязательно)" style={inputStyle} />
            <div style={{display:'flex', gap:8, marginTop:16}}>
              <button onClick={handleSave} style={saveBtn}>{editingId ? 'Сохранить' : 'Добавить'}</button>
              <button onClick={() => { setShowForm(false); resetForm() }} style={{padding:'9px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
            </div>
          </div>
        </div>
      )}
      <div style={cardStyle}>
        <div style={{fontSize:12, color:'#888', marginBottom:8, fontWeight:600}}>Период</div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:12}}>
          {PERIODS.map(([v, l]) => <button key={v} onClick={() => setPeriod(v)} style={chipStyle(period === v)}>{l}</button>)}
        </div>
        {period === 'custom' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12, maxWidth:400}}>
            <div><label style={labelStyle}>С</label><input value={customFrom} onChange={e => setCustomFrom(e.target.value)} type="date" style={inputStyle} /></div>
            <div><label style={labelStyle}>По</label><input value={customTo} onChange={e => setCustomTo(e.target.value)} type="date" style={inputStyle} /></div>
          </div>
        )}
        <div style={{fontSize:12, color:'#888', marginBottom:8, fontWeight:600}}>Категория</div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          <button onClick={() => setFilterCategory('all')} style={chipStyle(filterCategory === 'all')}>Все</button>
          {categories.map(c => <button key={c.id} onClick={() => setFilterCategory(c.name)} style={chipStyle(filterCategory === c.name)}>{c.name}</button>)}
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:12, marginBottom:16}}>
        <div style={{background:'#2a2a2a', borderRadius:14, padding:20, color:'#fff'}}>
          <div style={{fontSize:11, color:'#BDBDBD', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6}}>Всего потрачено</div>
          <div style={{fontSize:24, fontWeight:700}}>{fmtMoney(total)}</div>
          <div style={{fontSize:11, color:'#888', marginTop:4}}>{expenses.length} {expenses.length === 1 ? 'запись' : 'записей'}</div>
        </div>
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
          <div style={{fontSize:12, color:'#888', marginBottom:10, fontWeight:600}}>По категориям</div>
          {sortedCats.length === 0 ? <div style={{fontSize:12, color:'#BDBDBD'}}>Нет данных за период</div> : (
            sortedCats.map(([cat, sum]) => (
              <div key={cat} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:13, borderBottom:'1px solid #f8f8f8'}}>
                <span style={{color:'#2a2a2a'}}>{cat}</span>
                <span style={{color:'#2a2a2a', fontWeight:600}}>{fmtMoney(sum)}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', overflow:'hidden'}}>
        {loading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div> : expenses.length === 0 ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>За период расходов нет</div>
        ) : (
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}>
                {['Дата', 'Категория', 'Подкатегория', 'Комментарий', 'Сумма', ''].map((h, i) => (
                  <th key={i} style={{textAlign: i === 4 ? 'right' : 'left', padding:'12px 16px', fontSize:11, color:'#BDBDBD', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:400}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} style={{borderBottom:'1px solid #f8f8f8'}}>
                  <td style={{padding:'10px 16px', fontSize:13, color:'#3a3a3a', whiteSpace:'nowrap'}}>{fmtDate(e.expense_date)}</td>
                  <td style={{padding:'10px 16px', fontSize:13, color:'#2a2a2a', fontWeight:500}}>{e.category}</td>
                  <td style={{padding:'10px 16px', fontSize:13, color:'#888'}}>{e.subcategory || '—'}</td>
                  <td style={{padding:'10px 16px', fontSize:12, color:'#888'}}>{e.comment || '—'}</td>
                  <td style={{padding:'10px 16px', fontSize:13, color:'#2a2a2a', fontWeight:600, textAlign:'right', whiteSpace:'nowrap'}}>{fmtMoney(e.amount)}</td>
                  <td style={{padding:'10px 16px', whiteSpace:'nowrap'}}>
                    <button onClick={() => handleStartEdit(e)} style={{fontSize:12, color:'#888', background:'none', border:'none', cursor:'pointer', padding:'4px 6px', fontFamily:'Inter,sans-serif'}}>✎</button>
                    <button onClick={() => handleDelete(e)} style={{fontSize:14, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:'4px 6px', fontFamily:'Inter,sans-serif'}}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function AdminFinance({ session }) {
  const [tab, setTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Обзор' },
    { id: 'sales', label: 'Продажи' },
    { id: 'expenses', label: 'Расходы' },
    { id: 'detail', label: 'Детализация' },
    { id: 'loyalty', label: 'Лояльность' },
    { id: 'settings', label: 'Настройки' },
  ]

  const empty = (text) => (
    <div style={{color:'#BDBDBD', textAlign:'center', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>
      {text} — сделаем позже
    </div>
  )

  return (
    <div>
      <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:'0 0 20px 0'}}>Финансы</h1>
      <div style={{display:'flex', gap:4, borderBottom:'1px solid #f0f0f0', marginBottom:20, overflowX:'auto'}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{padding:'10px 16px', background:'transparent', border:'none', borderBottom: tab === t.id ? '2px solid #BFD900' : '2px solid transparent', fontSize:13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? '#2a2a2a' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <FinanceOverview />}
      {tab === 'sales' && <FinanceSales session={session} />}
      {tab === 'expenses' && <FinanceExpenses session={session} />}
      {tab === 'detail' && empty('Детализация')}
      {tab === 'loyalty' && empty('Метрики лояльности')}
      {tab === 'settings' && <FinanceSettings />}
    </div>
  )
}