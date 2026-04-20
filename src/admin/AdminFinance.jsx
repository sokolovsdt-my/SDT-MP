import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
const labelStyle = { fontSize:12, color:'#888', marginBottom:6, fontWeight:600, display:'block' }
const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16 }
const titleStyle = { fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:4 }
const hintStyle = { fontSize:12, color:'#888', marginBottom:14 }
const saveBtn = { padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap' }

function FinanceSettings() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [acquiring, setAcquiring] = useState('')
  const [taxType, setTaxType] = useState('percent')
  const [taxValue, setTaxValue] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [acquiringSaved, setAcquiringSaved] = useState(false)
  const [taxSaved, setTaxSaved] = useState(false)

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
    setLoading(false)
  }

  const saveSetting = async (key, value) => {
    const { error } = await supabase.from('finance_settings').upsert({ key, value: String(value) }, { onConflict: 'key' })
    if (error) alert('Ошибка сохранения: ' + error.message)
    return !error
  }

  const handleSaveAcquiring = async () => {
    if (await saveSetting('acquiring_fee_percent', acquiring)) {
      setAcquiringSaved(true)
      setTimeout(() => setAcquiringSaved(false), 1500)
    }
  }

  const handleSaveTax = async () => {
    const ok1 = await saveSetting('tax_type', taxType)
    const ok2 = await saveSetting('tax_value', taxValue)
    if (ok1 && ok2) {
      setTaxSaved(true)
      setTimeout(() => setTaxSaved(false), 1500)
    }
  }

  const handleAddCategory = async () => {
    const name = newCategory.trim()
    if (!name) return
    const maxOrder = Math.max(0, ...categories.map(c => c.sort_order || 0))
    const { error } = await supabase.from('expense_categories').insert({ name, is_system: false, sort_order: maxOrder + 1 })
    if (error) { alert('Не удалось добавить: ' + error.message); return }
    setNewCategory('')
    loadAll()
  }

  const handleSaveEdit = async (id) => {
    const name = editName.trim()
    if (!name) return
    const { error } = await supabase.from('expense_categories').update({ name }).eq('id', id)
    if (error) { alert('Не удалось сохранить: ' + error.message); return }
    setEditId(null); setEditName('')
    loadAll()
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Удалить категорию "${cat.name}"?`)) return
    const { error } = await supabase.from('expense_categories').delete().eq('id', cat.id)
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
        <div style={titleStyle}>Категории расходов</div>
        <div style={hintStyle}>Используются в разделе "Расходы"</div>

        {categories.map(cat => (
          <div key={cat.id} style={{display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid #f8f8f8'}}>
            {editId === cat.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{...inputStyle, flex:1}} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(cat.id) }} />
                <button onClick={() => handleSaveEdit(cat.id)} style={{padding:'7px 14px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Ок</button>
                <button onClick={() => { setEditId(null); setEditName('') }} style={{padding:'7px 12px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
              </>
            ) : (
              <>
                <div style={{flex:1, fontSize:13, color:'#2a2a2a'}}>{cat.name}</div>
                <button onClick={() => { setEditId(cat.id); setEditName(cat.name) }} style={{fontSize:12, color:'#888', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', fontFamily:'Inter,sans-serif'}}>Изменить</button>
                <button onClick={() => handleDelete(cat)} style={{fontSize:12, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', fontFamily:'Inter,sans-serif'}}>Удалить</button>
              </>
            )}
          </div>
        ))}

        <div style={{display:'flex', gap:8, marginTop:14}}>
          <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Новая категория..." style={{...inputStyle, flex:1}} onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }} />
          <button onClick={handleAddCategory} disabled={!newCategory.trim()} style={{...saveBtn, opacity: newCategory.trim() ? 1 : 0.5}}>+ Добавить</button>
        </div>
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
      {tab === 'expenses' && empty('Расходы')}
      {tab === 'detail' && empty('Детализация')}
      {tab === 'loyalty' && empty('Метрики лояльности')}
      {tab === 'settings' && <FinanceSettings />}
    </div>
  )
}