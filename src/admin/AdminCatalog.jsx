import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TABS = ['subscription', 'service', 'indiv', 'merch', 'event']
const TAB_LABELS = { subscription: 'Абонементы', service: 'Услуги', indiv: 'Индивы', merch: 'Мерч', event: 'Мероприятия' }
const SUB_TYPES = { unlimited: 'Безлимит', count: 'На количество', single: 'Разовое', trial: 'Пробное' }

const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }
const labelStyle = { fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block' }

const BADGE_COLORS = ['#BFD900','#27ae60','#e74c3c','#2980b9','#f39c12','#8e44ad','#2a2a2a','#e0e0e0']
const BADGE_EMOJIS = ['🔥','⭐','💥','🎉','✅','👑','🏆','💪','🚀','❤️','💚','💛','🎯','🌟','⚡','🎁','👍','😎','🆕','💎']

const textColor = (bg) => ['#BFD900','#f39c12','#e0e0e0'].includes(bg) ? '#2a2a2a' : '#fff'

function ProductForm({ type, teachers, groups, onSave, onCancel, initial = null }) {
  const isEdit = !!initial

  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    price: initial?.price || '',
    is_available_online: initial?.is_available_online ?? true,
    is_active: initial?.is_active ?? true,
    sort_order: initial?.sort_order ?? 100,
    is_featured: initial?.is_featured ?? false,
    badge_text: initial?.badge_text || 'Популярный',
    badge_color: initial?.badge_color || '#BFD900',
  })

  const ps = initial?.product_subscriptions?.[0]
  const pi = initial?.product_indivs?.[0]
  const pm = initial?.product_merch?.[0]
  const pe = initial?.product_events?.[0]

  const [subForm, setSubForm] = useState({
    sub_type: ps?.sub_type || 'unlimited',
    visits_count: ps?.visits_count || '',
    duration_days: ps?.duration_days || '',
    available_from_day: ps?.available_from_day || '',
    available_to_day: ps?.available_to_day || '',
  })
  const [indivForm, setIndivForm] = useState({
    teacher_id: pi?.teacher_id || '',
    visits_count: pi?.visits_count || '',
    duration_days: pi?.duration_days || '',
  })
  const [merchForm, setMerchForm] = useState({ stock_count: pm?.stock_count || 0 })
  const [eventForm, setEventForm] = useState({
    teacher_id: pe?.teacher_id || '',
    hall: pe?.hall || '',
    starts_at: pe?.starts_at ? pe.starts_at.slice(0,16) : '',
    ends_at: pe?.ends_at ? pe.ends_at.slice(0,16) : '',
    max_participants: pe?.max_participants || '',
  })

  const [selectedGroups, setSelectedGroups] = useState([])
  const [selectedTeachers, setSelectedTeachers] = useState([])
  const [showEmoji, setShowEmoji] = useState(false)

  useEffect(() => {
    if (isEdit && initial?.id && type === 'subscription') {
      const loadRelated = async () => {
        const { data: g } = await supabase.from('product_subscription_groups').select('group_id').eq('product_id', initial.id)
        setSelectedGroups((g || []).map(x => x.group_id))
        const { data: t } = await supabase.from('product_subscription_teachers').select('teacher_id').eq('product_id', initial.id)
        setSelectedTeachers((t || []).map(x => x.teacher_id))
      }
      loadRelated()
    }
  }, [])

  const toggleGroup = (id) => setSelectedGroups(p => p.includes(id) ? p.filter(g => g !== id) : [...p, id])
  const toggleTeacher = (id) => setSelectedTeachers(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id])

  const handleSave = async () => {
    if (!form.name || !form.price) return
    const base = { ...form, price: parseInt(form.price), sort_order: parseInt(form.sort_order) || 100 }

    if (isEdit) {
      await supabase.from('products').update(base).eq('id', initial.id)
      if (type === 'subscription') {
        await supabase.from('product_subscriptions').upsert({ product_id: initial.id, ...subForm, visits_count: subForm.visits_count ? parseInt(subForm.visits_count) : null, duration_days: subForm.duration_days ? parseInt(subForm.duration_days) : null }, { onConflict: 'product_id' })
        await supabase.from('product_subscription_groups').delete().eq('product_id', initial.id)
        if (selectedGroups.length > 0) await supabase.from('product_subscription_groups').insert(selectedGroups.map(gid => ({ product_id: initial.id, group_id: gid })))
        await supabase.from('product_subscription_teachers').delete().eq('product_id', initial.id)
        if (selectedTeachers.length > 0) await supabase.from('product_subscription_teachers').insert(selectedTeachers.map(tid => ({ product_id: initial.id, teacher_id: tid })))
      }
      if (type === 'indiv') await supabase.from('product_indivs').upsert({ product_id: initial.id, ...indivForm, visits_count: indivForm.visits_count ? parseInt(indivForm.visits_count) : null, duration_days: indivForm.duration_days ? parseInt(indivForm.duration_days) : null }, { onConflict: 'product_id' })
      if (type === 'merch') await supabase.from('product_merch').upsert({ product_id: initial.id, ...merchForm }, { onConflict: 'product_id' })
      if (type === 'event') await supabase.from('product_events').upsert({ product_id: initial.id, ...eventForm, max_participants: eventForm.max_participants ? parseInt(eventForm.max_participants) : null }, { onConflict: 'product_id' })
    } else {
      const { data: product } = await supabase.from('products').insert({ ...base, type }).select().single()
      if (type === 'subscription') {
        await supabase.from('product_subscriptions').insert({ product_id: product.id, ...subForm, visits_count: subForm.visits_count ? parseInt(subForm.visits_count) : null, duration_days: subForm.duration_days ? parseInt(subForm.duration_days) : null })
        if (selectedGroups.length > 0) await supabase.from('product_subscription_groups').insert(selectedGroups.map(gid => ({ product_id: product.id, group_id: gid })))
        if (selectedTeachers.length > 0) await supabase.from('product_subscription_teachers').insert(selectedTeachers.map(tid => ({ product_id: product.id, teacher_id: tid })))
      }
      if (type === 'indiv') await supabase.from('product_indivs').insert({ product_id: product.id, ...indivForm, visits_count: indivForm.visits_count ? parseInt(indivForm.visits_count) : null, duration_days: indivForm.duration_days ? parseInt(indivForm.duration_days) : null })
      if (type === 'merch') await supabase.from('product_merch').insert({ product_id: product.id, ...merchForm })
      if (type === 'event') await supabase.from('product_events').insert({ product_id: product.id, ...eventForm, max_participants: eventForm.max_participants ? parseInt(eventForm.max_participants) : null })
    }
    onSave()
  }

  return (
    <div style={{background:'#fff', borderRadius:16, border:'2px solid #BFD900', padding:20, marginBottom:20}}>
      <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>
        {isEdit ? '✏️ Редактировать' : 'Новый'} {TAB_LABELS[type]}
      </div>

      <label style={labelStyle}>Название *</label>
      <input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Например: Безлимит на месяц" style={inputStyle} />

      <label style={labelStyle}>Описание</label>
      <textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Краткое описание продукта" style={{...inputStyle, resize:'vertical', minHeight:60}} />

      <label style={labelStyle}>Стоимость ₽ *</label>
      <input value={form.price} onChange={e => setForm({...form, price:e.target.value})} placeholder="8700" type="number" style={inputStyle} />

      <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#2a2a2a', marginBottom:12, cursor:'pointer'}}>
        <input type="checkbox" checked={form.is_available_online} onChange={e => setForm({...form, is_available_online:e.target.checked})} />
        Доступен к покупке в приложении
      </label>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12}}>
        <div>
          <label style={labelStyle}>Приоритет (меньше = выше)</label>
          <input value={form.sort_order} onChange={e => setForm({...form, sort_order:parseInt(e.target.value)||100})}
            type="number" min="1" max="999" placeholder="100" style={inputStyle} />
        </div>
        <div style={{display:'flex', alignItems:'flex-end', paddingBottom:8}}>
          <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#2a2a2a', cursor:'pointer'}}>
            <input type="checkbox" checked={form.is_featured} onChange={e => setForm({...form, is_featured:e.target.checked})} />
            Показывать плашку
          </label>
        </div>
      </div>

      {form.is_featured && (
        <div style={{background:'#f9f9f9', borderRadius:10, padding:12, marginBottom:12}}>
          <label style={labelStyle}>Текст плашки</label>
          <div style={{display:'flex', gap:6, marginBottom:8}}>
            <input value={form.badge_text} onChange={e => setForm({...form, badge_text:e.target.value})}
              placeholder="Популярный" style={{...inputStyle, marginBottom:0, flex:1}} />
            <div style={{position:'relative'}}>
              <button type="button" onClick={() => setShowEmoji(!showEmoji)}
                style={{padding:'8px 10px', background:'#f5f5f5', border:'1px solid #e0e0e0', borderRadius:8, fontSize:16, cursor:'pointer'}}>
                😊
              </button>
              {showEmoji && (
                <div style={{position:'absolute', top:'100%', right:0, zIndex:100, background:'#fff', border:'1px solid #e0e0e0', borderRadius:12, padding:10, width:260, display:'flex', flexWrap:'wrap', gap:4, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', marginTop:4}}>
                  {BADGE_EMOJIS.map(e => (
                    <button key={e} type="button"
                      onClick={() => { setForm(f => ({...f, badge_text: f.badge_text + e})); setShowEmoji(false) }}
                      style={{padding:'4px 6px', background:'none', border:'none', fontSize:18, cursor:'pointer', borderRadius:6}}
                      onMouseEnter={ev => ev.currentTarget.style.background='#f5f5f5'}
                      onMouseLeave={ev => ev.currentTarget.style.background='none'}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <label style={labelStyle}>Цвет плашки</label>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:8}}>
            {BADGE_COLORS.map(color => (
              <div key={color} onClick={() => setForm({...form, badge_color:color})}
                style={{width:28, height:28, borderRadius:'50%', background:color, cursor:'pointer', border: form.badge_color === color ? '3px solid #2a2a2a' : '2px solid transparent'}} />
            ))}
          </div>
          <div style={{fontSize:11, color:'#888', marginTop:4}}>
            Предпросмотр: <span style={{background:form.badge_color, color:textColor(form.badge_color), padding:'2px 10px', borderRadius:6, fontSize:11, fontWeight:700}}>{form.badge_text}</span>
          </div>
        </div>
      )}

      {type === 'subscription' && (
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
          <div style={{marginBottom:8}}>
            <label style={labelStyle}>Доступен к продаже по числам месяца</label>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <span style={{fontSize:13, color:'#888'}}>с</span>
              <input value={subForm.available_from_day} onChange={e => setSubForm({...subForm, available_from_day:e.target.value})} type="number" min="1" max="31" placeholder="1" style={{...inputStyle, width:70, marginBottom:0}} />
              <span style={{fontSize:13, color:'#888'}}>по</span>
              <input value={subForm.available_to_day} onChange={e => setSubForm({...subForm, available_to_day:e.target.value})} type="number" min="1" max="31" placeholder="31" style={{...inputStyle, width:70, marginBottom:0}} />
              <span style={{fontSize:13, color:'#888'}}>число</span>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={labelStyle}>Доступные группы</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {groups.map(g => (
                <label key={g.id} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: selectedGroups.includes(g.id) ? '#fafde8' : '#f5f5f5', border: selectedGroups.includes(g.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
                  <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={labelStyle}>Доступные преподаватели</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {teachers.map(t => (
                <label key={t.id} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: selectedTeachers.includes(t.id) ? '#fafde8' : '#f5f5f5', border: selectedTeachers.includes(t.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}>
                  <input type="checkbox" checked={selectedTeachers.includes(t.id)} onChange={() => toggleTeacher(t.id)} />
                  {t.full_name || t.email}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {type === 'indiv' && (
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

      {type === 'merch' && (
        <div>
          <label style={labelStyle}>Количество в наличии</label>
          <input value={merchForm.stock_count} onChange={e => setMerchForm({...merchForm, stock_count:parseInt(e.target.value) || 0})} placeholder="Например: 10" type="number" style={inputStyle} />
        </div>
      )}

      {type === 'event' && (
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
          {isEdit ? 'Сохранить изменения' : 'Создать'}
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
  const [tab, setTab] = useState('subscription')
  const [products, setProducts] = useState([])
  const [teachers, setTeachers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  useEffect(() => { loadAll() }, [tab])

  const loadAll = async () => {
    setLoading(true)
    const { data: p } = await supabase.from('products')
      .select(`*, product_subscriptions(*), product_indivs(*, profiles(full_name)), product_merch(*), product_events(*, profiles(full_name))`)
      .eq('type', tab).order('sort_order', { ascending: true })
    setProducts(p || [])
    const { data: t } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'teacher')
    setTeachers(t || [])
    const { data: g } = await supabase.from('groups').select('id, name')
    setGroups(g || [])
    setLoading(false)
  }

  const handleArchive = async (id) => {
    if (!confirm('Архивировать продукт? Он скроется из каталога и кассы.')) return
    await supabase.from('products').update({ is_active: false }).eq('id', id)
    loadAll()
  }

  const handleRestore = async (id) => {
    await supabase.from('products').update({ is_active: true }).eq('id', id)
    loadAll()
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setShowForm(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingProduct(null)
  }

  const formatPrice = (p) => p.toLocaleString('ru-RU') + ' ₽'
  const activeProducts = products.filter(p => p.is_active)
  const archivedProducts = products.filter(p => !p.is_active)

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Каталог</h1>
        <button onClick={() => { setShowForm(!showForm); setEditingProduct(null) }}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          {showForm ? 'Закрыть' : '+ Добавить'}
        </button>
      </div>

      <div style={{display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #f0f0f0'}}>
        {TABS.map(t => (
          <div key={t} onClick={() => { setTab(t); setShowForm(false); setEditingProduct(null) }} style={{
            padding:'10px 16px', fontSize:13, cursor:'pointer',
            color: tab === t ? '#2a2a2a' : '#BDBDBD',
            borderBottom: tab === t ? '2px solid #BFD900' : '2px solid transparent',
            fontWeight: tab === t ? 600 : 400, marginBottom:-1
          }}>{TAB_LABELS[t]}</div>
        ))}
      </div>

      {showForm && !editingProduct && (
        <ProductForm type={tab} teachers={teachers} groups={groups}
          onSave={() => { setShowForm(false); loadAll() }}
          onCancel={handleCloseForm} />
      )}

      {editingProduct && (
        <ProductForm type={tab} teachers={teachers} groups={groups}
          initial={editingProduct}
          onSave={() => { setEditingProduct(null); loadAll() }}
          onCancel={handleCloseForm} />
      )}

      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : activeProducts.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Ничего нет — добавьте первый продукт</div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12}}>
          {activeProducts.map(p => (
            <div key={p.id} style={{background:'#fff', borderRadius:14, border: editingProduct?.id === p.id ? '2px solid #BFD900' : '1px solid #f0f0f0', padding:16}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>{p.name}</div>
                  {p.is_featured && (
                    <span style={{background:p.badge_color||'#BFD900', color:textColor(p.badge_color||'#BFD900'), padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700}}>
                      {p.badge_text || 'Популярный'}
                    </span>
                  )}
                </div>
                <span style={{background: p.is_available_online ? '#fafde8' : '#f5f5f5', color: p.is_available_online ? '#6a7700' : '#BDBDBD', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600, flexShrink:0, marginLeft:8}}>
                  {p.is_available_online ? '🌐' : 'Офлайн'}
                </span>
              </div>

              {p.description && <div style={{fontSize:12, color:'#888', marginBottom:8}}>{p.description}</div>}

              <div style={{fontSize:11, color:'#BDBDBD', marginBottom:4}}>Приоритет: {p.sort_order}</div>

              {tab === 'subscription' && p.product_subscriptions?.[0] && (
                <div style={{fontSize:12, color:'#BDBDBD', marginBottom:8}}>
                  {SUB_TYPES[p.product_subscriptions[0].sub_type]}
                  {p.product_subscriptions[0].duration_days && ` · ${p.product_subscriptions[0].duration_days} дней`}
                  {p.product_subscriptions[0].visits_count && ` · ${p.product_subscriptions[0].visits_count} занятий`}
                </div>
              )}
              {tab === 'indiv' && p.product_indivs?.[0] && (
                <div style={{fontSize:12, color:'#BDBDBD', marginBottom:8}}>
                  {p.product_indivs[0].profiles?.full_name}
                  {p.product_indivs[0].visits_count && ` · ${p.product_indivs[0].visits_count} занятий`}
                </div>
              )}
              {tab === 'merch' && p.product_merch?.[0] && (
                <div style={{fontSize:12, color:'#BDBDBD', marginBottom:8}}>В наличии: {p.product_merch[0].stock_count} шт.</div>
              )}
              {tab === 'event' && p.product_events?.[0] && (
                <div style={{fontSize:12, color:'#BDBDBD', marginBottom:8}}>
                  {p.product_events[0].profiles?.full_name} · {p.product_events[0].hall}
                  {p.product_events[0].starts_at && ` · ${new Date(p.product_events[0].starts_at).toLocaleDateString('ru-RU')}`}
                </div>
              )}

              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
                <div style={{fontSize:18, fontWeight:600, color:'#2a2a2a'}}>{formatPrice(p.price)}</div>
                <div style={{display:'flex', gap:8}}>
                  <button onClick={() => handleEdit(p)}
                    style={{fontSize:11, color: editingProduct?.id === p.id ? '#BFD900' : '#2980b9', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'Inter,sans-serif', fontWeight: editingProduct?.id === p.id ? 700 : 400}}>
                    {editingProduct?.id === p.id ? '✏️ Редактируется' : 'Изменить'}
                  </button>
                  <button onClick={() => handleArchive(p.id)}
                    style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'Inter,sans-serif'}}>
                    В архив
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {archivedProducts.length > 0 && (
        <div style={{marginTop:32}}>
          <details>
            <summary style={{fontSize:13, color:'#BDBDBD', cursor:'pointer', userSelect:'none', padding:'10px 0', listStyle:'none', display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:16}}>🗄</span>
              <span>Архив — {archivedProducts.length} {archivedProducts.length === 1 ? 'продукт' : 'продукта'}</span>
              <span style={{fontSize:11}}>(нажми чтобы раскрыть)</span>
            </summary>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12, marginTop:12}}>
              {archivedProducts.map(p => (
                <div key={p.id} style={{background:'#f9f9f9', borderRadius:14, border:'1px solid #f0f0f0', padding:16, opacity:0.75}}>
                  <div style={{fontSize:14, fontWeight:600, color:'#888', marginBottom:4}}>{p.name}</div>
                  {p.description && <div style={{fontSize:12, color:'#BDBDBD', marginBottom:6}}>{p.description}</div>}
                  <div style={{fontSize:18, fontWeight:600, color:'#BDBDBD', marginBottom:10}}>{formatPrice(p.price)}</div>
                  <button onClick={() => handleRestore(p.id)}
                    style={{fontSize:12, color:'#27ae60', background:'#eafaf1', border:'1px solid #a9dfbf', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                    ↩ Восстановить
                  </button>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}