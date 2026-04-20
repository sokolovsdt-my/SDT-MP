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
const todayStr = () => new Date().toISOString().split('T')[0]

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
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }
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
    if (await saveSetting('acquiring_fee_percent', acquiring)) {
      setAcquiringSaved(true); setTimeout(() => setAcquiringSaved(false), 1500)
    }
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
    setNewSubByCat(p => ({...p, [categoryId]: ''}))
    loadAll()
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
                    <button onClick={() => toggleExpand(cat.id)} style={{background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#888', width:22, padding:0}}>
                      {expanded ? '▾' : '▸'}
                    </button>
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
      const r = getPeriodRange(period)
      from = r.from; to = r.to
    }
    let q = supabase.from('expenses').select('*').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending:false }).order('created_at', { ascending:false })
    if (filterCategory !== 'all') q = q.eq('category', filterCategory)
    const { data, error } = await q
    if (error) alert('Ошибка загрузки: ' + error.message)
    setExpenses(data || [])
    setLoading(false)
  }

  const resetForm = () => {
    setForm({ category:'', subcategoryMode:'existing', subcategoryExisting:'', subcategoryCustom:'', saveSubcategory:false, amount:'', expense_date: todayStr(), comment:'' })
    setEditingId(null)
  }

  const handleStartAdd = () => { resetForm(); setShowForm(true) }

  const handleStartEdit = (exp) => {
    setForm({
      category: exp.category,
      subcategoryMode: 'existing',
      subcategoryExisting: exp.subcategory || '',
      subcategoryCustom: '',
      saveSubcategory: false,
      amount: String(exp.amount),
      expense_date: exp.expense_date,
      comment: exp.comment || ''
    })
    setEditingId(exp.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.category || !form.amount || !form.expense_date) {
      alert('Заполни категорию, сумму и дату'); return
    }
    const amount = parseFloat(String(form.amount).replace(',', '.'))
    if (isNaN(amount) || amount <= 0) { alert('Некорректная сумма'); return }

    let finalSubcategory = null
    if (form.subcategoryMode === 'existing') {
      finalSubcategory = form.subcategoryExisting || null
    } else {
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

    const payload = {
      category: form.category,
      subcategory: finalSubcategory,
      amount,
      expense_date: form.expense_date,
      comment: form.comment.trim() || null,
    }

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

  const periods = [
    ['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Этот месяц'],
    ['prev_month', 'Прошлый месяц'], ['quarter', 'Квартал'], ['year', 'Год'], ['custom', 'Произвольный']
  ]

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
              <div>
                <label style={labelStyle}>Сумма, ₽ *</label>
                <input value={form.amount} onChange={e => setForm({...form, amount:e.target.value})} type="number" step="0.01" placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Дата *</label>
                <input value={form.expense_date} onChange={e => setForm({...form, expense_date:e.target.value})} type="date" style={inputStyle} />
              </div>
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
          {periods.map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={chipStyle(period === v)}>{l}</button>
          ))}
        </div>
        {period === 'custom' && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12, maxWidth:400}}>
            <div>
              <label style={labelStyle}>С</label>
              <input value={customFrom} onChange={e => setCustomFrom(e.target.value)} type="date" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>По</label>
              <input value={customTo} onChange={e => setCustomTo(e.target.value)} type="date" style={inputStyle} />
            </div>
          </div>
        )}
        <div style={{fontSize:12, color:'#888', marginBottom:8, fontWeight:600}}>Категория</div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          <button onClick={() => setFilterCategory('all')} style={chipStyle(filterCategory === 'all')}>Все</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilterCategory(c.name)} style={chipStyle(filterCategory === c.name)}>{c.name}</button>
          ))}
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
          {sortedCats.length === 0 ? (
            <div style={{fontSize:12, color:'#BDBDBD'}}>Нет данных за период</div>
          ) : (
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
        {loading ? (
          <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
        ) : expenses.length === 0 ? (
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

      {tab === 'overview' && empty('Обзор')}
      {tab === 'sales' && empty('Продажи')}
      {tab === 'expenses' && <FinanceExpenses session={session} />}
      {tab === 'detail' && empty('Детализация')}
      {tab === 'loyalty' && empty('Метрики лояльности')}
      {tab === 'settings' && <FinanceSettings />}
    </div>
  )
}