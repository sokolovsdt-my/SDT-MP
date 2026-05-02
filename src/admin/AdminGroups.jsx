import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const GROUP_COLORS = [
  { bg:'#EDF4F0', border:'#7C9885', text:'#3d5c45', label:'Зелёный' },
  { bg:'#F0ECF7', border:'#8B7BA8', text:'#4a3a6e', label:'Фиолетовый' },
  { bg:'#F7EDEA', border:'#C17B5A', text:'#7a3e25', label:'Оранжевый' },
  { bg:'#EAF1F7', border:'#5A8FA8', text:'#2a5570', label:'Синий' },
  { bg:'#F7F0EA', border:'#A8855A', text:'#6b4e25', label:'Коричневый' },
  { bg:'#EFEFEF', border:'#7A7A7A', text:'#4a4a4a', label:'Серый' },
  { bg:'#FEF9E7', border:'#D4AC0D', text:'#7D6608', label:'Жёлтый' },
  { bg:'#FDEDEC', border:'#E74C3C', text:'#922B21', label:'Красный' },
  { bg:'#EAF4FB', border:'#2E86C1', text:'#1B4F72', label:'Тёмно-синий' },
  { bg:'#F9EBEA', border:'#CB4335', text:'#78281F', label:'Малиновый' },
]

const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
const labelStyle = { fontSize:12, color:'#888', marginBottom:6, fontWeight:600, display:'block' }
const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:12 }

export default function AdminGroups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name:'', description:'', color:'', is_closed:false })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadGroups() }, [])

  const loadGroups = async () => {
    setLoading(true)
    const { data } = await supabase.from('groups').select('*').order('name')
    setGroups(data || [])
    setLoading(false)
  }

  const resetForm = () => {
    setForm({ name:'', description:'', color:'', is_closed:false })
    setEditingId(null)
  }

  const handleStartEdit = (g) => {
    setForm({ name: g.name, description: g.description || '', color: g.color || '', is_closed: g.is_closed || false })
    setEditingId(g.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color || null,
      is_closed: form.is_closed,
    }
    if (editingId) {
      const { error } = await supabase.from('groups').update(payload).eq('id', editingId)
      if (error) { alert('Ошибка: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('groups').insert(payload)
      if (error) { alert('Ошибка: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    setShowForm(false)
    resetForm()
    loadGroups()
  }

  const handleDelete = async (g) => {
    if (!confirm(`Удалить группу "${g.name}"? Это может повлиять на расписание.`)) return
    const { error } = await supabase.from('groups').delete().eq('id', g.id)
    if (error) { alert('Ошибка: ' + error.message); return }
    loadGroups()
  }

  const getColorStyle = (colorVal) => {
    const c = GROUP_COLORS.find(c => c.border === colorVal)
    return c || { bg:'#f5f5f5', border:'#BDBDBD', text:'#888' }
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Группы</h1>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          {showForm && !editingId ? 'Закрыть' : '+ Добавить группу'}
        </button>
      </div>

      {/* Форма */}
      {showForm && (
        <div style={{...cardStyle, border:'1px solid #BFD900'}}>
          <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:16}}>
            {editingId ? 'Редактировать группу' : 'Новая группа'}
          </div>

          <label style={labelStyle}>Название *</label>
          <input value={form.name} onChange={e => setForm({...form, name:e.target.value})}
            placeholder="Например: Группа №7 (взрослые)" style={{...inputStyle, marginBottom:12}} />

          <label style={labelStyle}>Описание</label>
          <input value={form.description} onChange={e => setForm({...form, description:e.target.value})}
            placeholder="Возраст, уровень, особенности..." style={{...inputStyle, marginBottom:12}} />

          <label style={labelStyle}>Цвет в расписании</label>
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:12, alignItems:'center'}}>
  {GROUP_COLORS.map(c => (
    <button key={c.border} onClick={() => setForm({...form, color: form.color === c.border ? '' : c.border})}
      title={c.label}
      style={{
        width:28, height:28, borderRadius:'50%', cursor:'pointer', padding:0,
        background: c.bg,
        border: form.color === c.border ? `3px solid ${c.border}` : `2px solid ${c.border}`,
        boxShadow: form.color === c.border ? `0 0 0 2px ${c.border}` : 'none',
        transition:'all 0.15s',
        position:'relative',
      }}>
      {form.color === c.border && (
        <span style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:12, color: c.text, fontWeight:700, lineHeight:1}}>✓</span>
      )}
    </button>
  ))}
  <button onClick={() => setForm({...form, color:''})} title="Без цвета"
    style={{width:28, height:28, borderRadius:'50%', cursor:'pointer', padding:0, background:'#f5f5f5', border: !form.color ? '3px solid #BDBDBD' : '2px solid #e0e0e0', fontSize:11, color:'#BDBDBD', display:'flex', alignItems:'center', justifyContent:'center'}}>
    ✕
  </button>
</div>

          <label style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#2a2a2a', cursor:'pointer', marginBottom:16}}>
            <input type="checkbox" checked={form.is_closed} onChange={e => setForm({...form, is_closed:e.target.checked})}
              style={{width:16, height:16, cursor:'pointer'}} />
            <div>
              <div style={{fontWeight:600}}>🔒 Закрытая группа</div>
              <div style={{fontSize:11, color:'#888', marginTop:2}}>
                В кассе при продаже абонемента эта группа будет без галочки по умолчанию
              </div>
            </div>
          </label>

          <div style={{display:'flex', gap:8}}>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              style={{flex:1, padding:'10px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: (!form.name.trim() || saving) ? 0.5 : 1}}>
              {saving ? 'Сохраняем...' : editingId ? 'Сохранить изменения' : 'Создать группу'}
            </button>
            <button onClick={() => { setShowForm(false); resetForm() }}
              style={{padding:'10px 18px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список групп */}
      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : groups.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Групп нет — добавьте первую</div>
      ) : (
        <div>
          {groups.map(g => {
            const colorStyle = getColorStyle(g.color)
            return (
              <div key={g.id} style={cardStyle}>
                <div style={{display:'flex', alignItems:'center', gap:14}}>

                  {/* Цветной индикатор */}
                  <div style={{
                    width:44, height:44, borderRadius:10, flexShrink:0,
                    background: colorStyle.bg,
                    border: `2px solid ${colorStyle.border}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, fontWeight:700, color: colorStyle.text
                  }}>
                    {g.name.match(/\d+/)?.[0] || g.name[0]}
                  </div>

                  {/* Инфо */}
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                      <span style={{fontSize:15, fontWeight:600, color:'#2a2a2a'}}>{g.name}</span>
                      {g.is_closed && (
                        <span style={{background:'#fdecea', color:'#e74c3c', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>
                          🔒 Закрытая
                        </span>
                      )}
                    </div>
                    {g.description && (
                      <div style={{fontSize:12, color:'#888'}}>{g.description}</div>
                    )}
                  </div>

                  {/* Кнопки */}
                  <div style={{display:'flex', gap:8, flexShrink:0}}>
                    <button onClick={() => handleStartEdit(g)}
                      style={{padding:'6px 14px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:12, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                      Изменить
                    </button>
                    <button onClick={() => handleDelete(g)}
                      style={{padding:'6px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Подсказка */}
      <div style={{background:'#f9f9f9', borderRadius:12, padding:14, marginTop:8}}>
        <div style={{fontSize:12, color:'#888', lineHeight:1.6}}>
          💡 <strong>Как это работает:</strong> Группы автоматически подтягиваются в Расписание и Каталог.
          Закрытые группы (🔒) в Кассе при продаже абонемента будут без галочки по умолчанию —
          чтобы случайно не дать доступ туда, куда не нужно.
        </div>
      </div>
    </div>
  )
}