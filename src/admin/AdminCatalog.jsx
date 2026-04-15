import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TABS = ['subscriptions', 'indivs', 'merch', 'events']
const TAB_LABELS = { subscriptions: 'Абонементы', indivs: 'Индивы', merch: 'Мерч', events: 'Мероприятия' }
const SUB_TYPES = { unlimited: 'Безлимит', count: 'На количество', single: 'Разовое', trial: 'Пробное' }

const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }
const labelStyle = { fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block' }

function ProductForm({ type, teachers, groups, onSave, onCancel, initial = null }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    price: initial?.price || '',
    is_available_online: initial?.is_available_online ?? true,
    is_active: initial?.is_active ?? true,
  })
  const [subForm, setSubForm] = useState({ sub_type: 'unlimited', visits_count: '', duration_days: '' })
  const [indivForm, setIndivForm] = useState({ teacher_id: '', visits_count: '', duration_days: '' })
  const [merchForm, setMerchForm] = useState({ stock_count: 0 })
  const [eventForm, setEventForm] = useState({ teacher_id: '', hall: '', starts_at: '', ends_at: '', max_participants: '' })
  const [selectedGroups, setSelectedGroups] = useState([])
  const [selectedTeachers, setSelectedTeachers] = useState([])

  const toggleGroup = (id) => setSelectedGroups(p => p.includes(id) ? p.filter(g => g !== id) : [...p, id])
  const toggleTeacher = (id) => setSelectedTeachers(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id])

  const handleSave = async () => {
    if (!form.name || !form.price) return
    const { data: product } = await supabase.from('products').insert({
      ...form, type, price: parseInt(form.price)
    }).select().single()

    if (type === 'subscriptions') {
      await supabase.from('product_subscriptions').insert({
        product_id: product.id, ...subForm,
        visits_count: subForm.visits_count ? parseInt(subForm.visits_count) : null,
        duration_days: subForm.duration_days ? parseInt(subForm.duration_days) : null
      })
      if (selectedGroups.length > 0) await supabase.from('product_subscription_groups').insert(selectedGroups.map(gid => ({ product_id: product.id, group_id: gid })))
      if (selectedTeachers.length > 0) await supabase.from('product_subscription_teachers').insert(selectedTeachers.map(tid => ({ product_id: product.id, teacher_id: tid })))
    }
    if (type === 'indivs') await supabase.from('product_indivs').insert({
      product_id: product.id, ...indivForm,
      visits_count: indivForm.visits_count ? parseInt(indivForm.visits_count) : null,
      duration_days: indivForm.duration_days ? parseInt(indivForm.duration_days) : null
    })
    if (type === 'merch') await supabase.from('product_merch').insert({ product_id: product.id, ...merchForm })
    if (type === 'events') await supabase.from('product_events').insert({
      product_id: product.id, ...eventForm,
      max_participants: eventForm.max_participants ? parseInt(eventForm.max_participants) : null
    })
    onSave()
  }

  return (
    <div style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:20, marginBottom:20}}>
      <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>
        {initial ? 'Редактировать' : 'Новый'} {TAB_LABELS[type]}
      </div>

      <label style={labelStyle}>Название *</label>
      <input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Например: Безлимит на месяц" style={inputStyle} />

      <label style={labelStyle}>Описание</label>
      <textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Краткое описание продукта" style={{...inputStyle, resize:'vertical', minHeight:60}} />

      <label style={labelStyle}>Стоимость ₽ *</label>
      <input value={form.price} onChange={e => setForm({...form, price:e.target.value})} placeholder="8700" type="number" style={inputStyle} />

      <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#2a2a2a', marginBottom:16, cursor:'pointer'}}>
        <input type="checkbox" checked={form.is_available_online} onChange={e => setForm({...form, is_available_online:e.target.checked})} />
        Доступен к покупке в приложении
      </label>

      {/* Абонемент */}
      {type === 'subscriptions' && (
        <div>
          <label style={labelStyle}>Тип абонемента</label>
          <select value={subForm.sub_type} onChange={e => setSubForm({...subForm, sub_type:e.target.value})} style={inputStyle}>
            {Object.entries(SUB_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {subForm.sub_type === 'count' && (
            <>
              <label style={labelStyle}>Количество занятий</label>
              <input value={subForm.visits_count} onChange={e => setSubForm({...subForm, visits_count:e.target.value})} placeholder="Например: 4" type="number" style={inputStyle} />
            </>
          )}

          <label style={labelStyle}>Срок действия (дней)</label>
          <input value={subForm.duration_days} onChange={e => setSubForm({...subForm, duration_days:e.target.value})} placeholder="Например: 30" type="number" style={inputStyle} />

          <div style={{marginBottom:12}}>
            <div style={labelStyle}>Доступные группы</div>
            {groups.length === 0 ? (
              <div style={{fontSize:12, color:'#BDBDBD'}}>Группы не найдены</div>
            ) : (
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {groups.map(g => (
                  <label key={g.id} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: selectedGroups.includes(g.id) ? '#fafde8' : '#f5f5f5', border: selectedGroups.includes(g.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
                    <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                    {g.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{marginBottom:12}}>
            <div style={labelStyle}>Доступные преподаватели</div>
            {teachers.length === 0 ? (
              <div style={{fontSize:12, color:'#BDBDBD'}}>Преподаватели не найдены</div>
            ) : (
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {teachers.map(t => (
                  <label key={t.id} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: selectedTeachers.includes(t.id) ? '#fafde8' : '#f5f5f5', border: selectedTeachers.includes(t.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
                    <input type="checkbox" checked={selectedTeachers.includes(t.id)} onChange={() => toggleTeacher(t.id)} />
                    {t.full_name || t.email}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Индив */}
      {type === 'indivs' && (
        <div>
          <label style={labelStyle}>Преподаватель</label>
          <select value={indivForm.teacher_id} onChange={e => setIndivForm({...indivForm, teacher_id:e.target.value})} style={inputStyle}>
            <option value="">Выберите преподавателя</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
          </select>

          <label style={labelStyle}>Количество занятий</label>
          <input value={indivForm.visits_count} onChange={e => setIndivForm({...indivForm, visits_count:e.target.value})} placeholder="Например: 5" type="number" style={inputStyle} />

          <label style={labelStyle}>Срок действия (дней)</label>
          <input value={indivForm.duration_days} onChange={e => setIndivForm({...indivForm, duration_days:e.target.value})} placeholder="Например: 60" type="number" style={inputStyle} />
        </div>
      )}

      {/* Мерч */}
      {type === 'merch' && (
        <div>
          <label style={labelStyle}>Количество в наличии</label>
          <input value={merchForm.stock_count} onChange={e => setMerchForm({...merchForm, stock_count:parseInt(e.target.value) || 0})} placeholder="Например: 10" type="number" style={inputStyle} />
        </div>
      )}

      {/* Мероприятие */}
      {type === 'events' && (
        <div>
          <label style={labelStyle}>Преподаватель</label>
          <select value={eventForm.teacher_id} onChange={e => setEventForm({...eventForm, teacher_id:e.target.value})} style={inputStyle}>
            <option value="">Выберите преподавателя</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
          </select>

          <label style={labelStyle}>Зал</label>
          <select value={eventForm.hall} onChange={e => setEventForm({...eventForm, hall:e.target.value})} style={inputStyle}>
            <option value="">Выберите зал</option>
            <option value="Большой зал">Большой зал</option>
            <option value="Малый зал">Малый зал</option>
          </select>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <div>
              <label style={labelStyle}>Начало</label>
              <input value={eventForm.starts_at} onChange={e => setEventForm({...eventForm, starts_at:e.target.value})} type="datetime-local" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Конец</label>
              <input value={eventForm.ends_at} onChange={e => setEventForm({...eventForm, ends_at:e.target.value})} type="datetime-local" style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>Максимум участников</label>
          <input value={eventForm.max_participants} onChange={e => setEventForm({...eventForm, max_participants:e.target.value})} placeholder="Например: 20" type="number" style={inputStyle} />
        </div>
      )}

      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={handleSave}
          style={{flex:1, padding:'9px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          Сохранить
        </button>
        <button onClick={onCancel}
          style={{padding:'9px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          Отмена
        </button>
      </div>
    </div>
  )
}

export default function AdminCatalog() {
  const [tab, setTab] = useState('subscriptions')
  const [products, setProducts] = useState([])
  const [teachers, setTeachers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { loadAll() }, [tab])

  const loadAll = async () => {
    setLoading(true)
    const { data: p } = await supabase.from('products')
      .select(`*, product_subscriptions(*), product_indivs(*, profiles(full_name)), product_merch(*), product_events(*, profiles(full_name))`)
      .eq('type', tab).order('created_at', { ascending: false })
    setProducts(p || [])
    const { data: t } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'teacher')
    setTeachers(t || [])
    const { data: g } = await supabase.from('groups').select('id, name')
    setGroups(g || [])
    setLoading(false)
  }

  const handleArchive = async (id) => {
    if (!confirm('Архивировать продукт?')) return
    await supabase.from('products').update({ is_active: false }).eq('id', id)
    loadAll()
  }

  const formatPrice = (p) => p.toLocaleString('ru-RU') + ' ₽'

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Каталог</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          {showForm ? 'Закрыть' : '+ Добавить'}
        </button>
      </div>

      <div style={{display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #f0f0f0'}}>
        {TABS.map(t => (
          <div key={t} onClick={() => { setTab(t); setShowForm(false) }} style={{
            padding:'10px 16px', fontSize:13, cursor:'pointer',
            color: tab === t ? '#2a2a2a' : '#BDBDBD',
            borderBottom: tab === t ? '2px solid #BFD900' : '2px solid transparent',
            fontWeight: tab === t ? 600 : 400, marginBottom:-1
          }}>{TAB_LABELS[t]}</div>
        ))}
      </div>

      {showForm && (
        <ProductForm type={tab} teachers={teachers} groups={groups}
          onSave={() => { setShowForm(false); loadAll() }}
          onCancel={() => setShowForm(false)} />
      )}

      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : products.filter(p => p.is_active).length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Ничего нет — добавьте первый продукт</div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12}}>
          {products.filter(p => p.is_active).map(p => (
            <div key={p.id} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:16}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>{p.name}</div>
                <span style={{background: p.is_available_online ? '#fafde8' : '#f5f5f5', color: p.is_available_online ? '#6a7700' : '#BDBDBD', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600, flexShrink:0, marginLeft:8}}>
                  {p.is_available_online ? '🌐 Онлайн' : 'Офлайн'}
                </span>
              </div>

              {p.description && <div style={{fontSize:12, color:'#888', marginBottom:8}}>{p.description}</div>}

              {tab === 'subscriptions' && p.product_subscriptions?.[0] && (
                <div style={{fontSize:12, color:'#BDBDBD', marginBottom:8}}>
                  {SUB_TYPES[p.product_subscriptions[0].sub_type]}
                  {p.product_subscriptions[0].duration_days && ` · ${p.product_subscriptions[0].duration_days} дней`}
                  {p.product_subscriptions[0].visits_count && ` · ${p.product_subscriptions[0].visits_count} занятий`}
                </div>
              )}
              {tab === 'indivs' && p.product_indivs?.[0] && (
                <div style={{fontSize:12, color:'#BDBDBD', marginBottom:8}}>
                  {p.product_indivs[0].profiles?.full_name}
                  {p.product_indivs[0].visits_count && ` · ${p.product_indivs[0].visits_count} занятий`}
                </div>
              )}
              {tab === 'merch' && p.product_merch?.[0] && (
                <div style={{fontSize:12, color:'#BDBDBD', marginBottom:8}}>
                  В наличии: {p.product_merch[0].stock_count} шт.
                </div>
              )}
              {tab === 'events' && p.product_events?.[0] && (
                <div style={{fontSize:12, color:'#BDBDBD', marginBottom:8}}>
                  {p.product_events[0].profiles?.full_name} · {p.product_events[0].hall}
                  {p.product_events[0].starts_at && ` · ${new Date(p.product_events[0].starts_at).toLocaleDateString('ru-RU')}`}
                </div>
              )}

              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
                <div style={{fontSize:18, fontWeight:600, color:'#2a2a2a'}}>{formatPrice(p.price)}</div>
                <div style={{display:'flex', gap:8}}>
                  <button style={{fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer', padding:0}}>
                    Изменить
                  </button>
                  <button onClick={() => handleArchive(p.id)} style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:0}}>
                    Архив
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}