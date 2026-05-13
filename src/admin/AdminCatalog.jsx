import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'

const TABS = ['subscription', 'service', 'indiv', 'merch', 'event']
const TAB_LABELS = { subscription: 'Абонементы', service: 'Услуги', indiv: 'Индивы', merch: 'Мерч', event: 'Мероприятия' }
const SUB_TYPES = { unlimited: 'Безлимит', count: 'На количество', single: 'Разовое', trial: 'Пробное' }

const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }
const labelStyle = { fontSize:12, color:'#888', marginBottom:4, fontWeight:600, display:'block' }
const inpS = { width:'100%', padding:'8px 10px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
const lblS = { fontSize:11, color:'#888', marginBottom:4, fontWeight:600, display:'block' }

const BADGE_COLORS = ['#BFD900','#27ae60','#e74c3c','#2980b9','#f39c12','#8e44ad','#2a2a2a','#e0e0e0']
const BADGE_EMOJIS = ['🔥','⭐','💥','🎉','✅','👑','🏆','💪','🚀','❤️','💚','💛','🎯','🌟','⚡','🎁','👍','😎','🆕','💎']
const textColor = (bg) => ['#BFD900','#f39c12','#e0e0e0'].includes(bg) ? '#2a2a2a' : '#fff'

const EVENT_TYPES = [
  { value:'masterclass', label:'Мастер-класс' },
  { value:'workshop', label:'Воркшоп' },
  { value:'camp', label:'Лагерь' },
  { value:'course', label:'Курс' },
  { value:'other', label:'Другое' },
]

const MERCH_BADGES = [
  { id:'popular', text:'🔥 Популярное', color:'#e74c3c' },
  { id:'new', text:'🆕 Новинка', color:'#2980b9' },
  { id:'limited', text:'💎 Лимитированное', color:'#8e44ad' },
  { id:'season', text:'🌸 Сезонное', color:'#f39c12' },
  { id:'hit', text:'⭐ Хит продаж', color:'#27ae60' },
  { id:'sale', text:'🏷️ Скидка', color:'#e74c3c' },
  { id:'gift', text:'🎁 Подарочное', color:'#2980b9' },
]

const MERCH_CATEGORIES = [
  { id:'clothing', label:'Одежда' },
  { id:'accessories', label:'Аксессуары' },
  { id:'stationery', label:'Канцелярия' },
  { id:'other', label:'Другое' },
]

async function uploadMerchImage(file, productId) {
  const ext = file.name.split('.').pop()
  const path = `${productId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('merch').upload(path, file)
  if (error) return null
  const { data } = supabase.storage.from('merch').getPublicUrl(path)
  return data.publicUrl
}

async function uploadEventImage(file, eventId) {
  const ext = file.name.split('.').pop()
  const path = `${eventId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('events').upload(path, file)
  if (error) return null
  const { data } = supabase.storage.from('events').getPublicUrl(path)
  return data.publicUrl
}

// ─── Вкладка Мероприятия ──────────────────────────────────────────────────────
function EventTab({ teachers, session }) {
  const [events, setEvents] = useState([])
  const [archived, setArchived] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [openEvent, setOpenEvent] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const editFileRef = useRef()

  const emptyForm = { name:'', type:'masterclass', description:'', image_url:'', hall:'', teacher_id:'', max_participants:'', price:'', is_available_online:true, age_info:'', sort_order:100 }
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editImageFile, setEditImageFile] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState(null)
  const [tiers, setTiers] = useState([])
  const [editTiers, setEditTiers] = useState([])
  const [dates, setDates] = useState([])
  const [editDates, setEditDates] = useState([])
  const [eventTiers, setEventTiers] = useState({})
  const [eventRegs, setEventRegs] = useState({})

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('events').select('*, teacher:profiles!events_teacher_id_fkey(id, full_name)').order('sort_order')
    const active = (data || []).filter(e => e.is_active !== false)
    const arch = (data || []).filter(e => e.is_active === false)
    setEvents(active)
    setArchived(arch)
    const ids = active.map(e => e.id)
    if (ids.length > 0) {
      const { data: tiersData } = await supabase.from('event_price_tiers').select('*').in('event_id', ids).order('position_from')
      const { data: regsData } = await supabase.from('event_registrations').select('*').in('event_id', ids).eq('status','registered')
      const tiersMap = {}; const regsMap = {}
      ids.forEach(id => { tiersMap[id] = []; regsMap[id] = 0 })
      ;(tiersData || []).forEach(t => tiersMap[t.event_id]?.push(t))
      ;(regsData || []).forEach(r => { if (regsMap[r.event_id] !== undefined) regsMap[r.event_id]++ })
      setEventTiers(tiersMap); setEventRegs(regsMap)
    }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const { data: ev } = await supabase.from('events').insert({ name: form.name.trim(), type: form.type, description: form.description || null, hall: form.hall || null, teacher_id: form.teacher_id || null, max_participants: form.max_participants ? parseInt(form.max_participants) : null, price: form.price ? parseFloat(form.price) : null, is_available_online: form.is_available_online, age_info: form.age_info || null, sort_order: parseInt(form.sort_order) || 100, allow_client_booking: form.is_available_online, is_active: true }).select().single()
    if (ev) {
      if (imageFile) { const url = await uploadEventImage(imageFile, ev.id); if (url) await supabase.from('events').update({ image_url: url }).eq('id', ev.id) }
      if (tiers.length > 0) await supabase.from('event_price_tiers').insert(tiers.map((t, i) => ({ event_id: ev.id, position_from: parseInt(t.from), position_to: t.to ? parseInt(t.to) : null, price: parseFloat(t.price), label: t.label || null, sort_order: i + 1 })))
      if (dates.length > 0) await supabase.from('event_dates').insert(dates.map((d, i) => ({ event_id: ev.id, date_start: d.date_start, date_end: d.date_end || null, time_start: d.time_start || null, time_end: d.time_end || null, label: d.label || null, sort_order: i + 1 })))
    }
    setSaving(false); setShowForm(false); setForm(emptyForm); setImageFile(null); setImagePreview(null); setTiers([]); setDates([]); load()
  }

  const handleUpdate = async (id) => {
    if (!editForm?.name?.trim()) return
    setSaving(true)
    let imageUrl = editForm.image_url
    if (editImageFile) { const url = await uploadEventImage(editImageFile, id); if (url) imageUrl = url }
    await supabase.from('events').update({ name: editForm.name.trim(), type: editForm.type, description: editForm.description || null, image_url: imageUrl || null, hall: editForm.hall || null, teacher_id: editForm.teacher_id || null, max_participants: editForm.max_participants ? parseInt(editForm.max_participants) : null, price: editForm.price ? parseFloat(editForm.price) : null, is_available_online: editForm.is_available_online, age_info: editForm.age_info || null, sort_order: parseInt(editForm.sort_order) || 100, allow_client_booking: editForm.is_available_online }).eq('id', id)
    await supabase.from('event_price_tiers').delete().eq('event_id', id)
    if (editTiers.length > 0) await supabase.from('event_price_tiers').insert(editTiers.map((t, i) => ({ event_id: id, position_from: parseInt(t.from), position_to: t.to ? parseInt(t.to) : null, price: parseFloat(t.price), label: t.label || null, sort_order: i + 1 })))
    await supabase.from('event_dates').delete().eq('event_id', id)
    if (editDates.length > 0) await supabase.from('event_dates').insert(editDates.map((d, i) => ({ event_id: id, date_start: d.date_start, date_end: d.date_end || null, time_start: d.time_start || null, time_end: d.time_end || null, label: d.label || null, sort_order: i + 1 })))
    setSaving(false); setEditingEvent(null); setEditForm(null); setEditImageFile(null); setEditImagePreview(null); setEditTiers([]); setEditDates([]); load()
  }

  const handleArchive = async (id) => { if (!confirm('Архивировать мероприятие?')) return; await supabase.from('events').update({ is_active: false }).eq('id', id); load() }
  const handleRestore = async (id) => { await supabase.from('events').update({ is_active: true }).eq('id', id); load() }

  const openEdit = async (ev) => {
    setEditingEvent(ev.id)
    setEditForm({ name: ev.name, type: ev.type || 'masterclass', description: ev.description || '', image_url: ev.image_url || '', hall: ev.hall || '', teacher_id: ev.teacher_id || '', max_participants: ev.max_participants || '', price: ev.price || '', is_available_online: ev.is_available_online ?? true, age_info: ev.age_info || '', sort_order: ev.sort_order ?? 100 })
    setEditImagePreview(ev.image_url || null); setEditImageFile(null)
    const currentTiers = (eventTiers[ev.id] || []).map(t => ({ from: t.position_from, to: t.position_to || '', price: t.price, label: t.label || '' }))
    setEditTiers(currentTiers)
    const { data: datesData } = await supabase.from('event_dates').select('*').eq('event_id', ev.id).order('sort_order')
    setEditDates((datesData || []).map(d => ({ date_start: d.date_start, date_end: d.date_end || '', time_start: d.time_start || '', time_end: d.time_end || '', label: d.label || '' })))
    setOpenEvent(ev.id)
  }

  const TiersEditor = ({ tiers, setTiers }) => (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <label style={lblS}>Ступенчатые цены (необязательно)</label>
        <button type="button" onClick={() => setTiers([...tiers, { from: tiers.length > 0 ? (parseInt(tiers[tiers.length-1].to)||0)+1 : 1, to: '', price: '', label: '' }])} style={{padding:'4px 10px', background:'#f5f5f5', border:'none', borderRadius:6, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>+ Добавить ступень</button>
      </div>
      {tiers.length === 0 && <div style={{fontSize:12, color:'#BDBDBD', padding:'8px 0'}}>Без ступеней — единая цена выше</div>}
      {tiers.map((tier, i) => (
        <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 2fr auto', gap:6, marginBottom:6, alignItems:'end'}}>
          <div><label style={{...lblS, marginBottom:2}}>С места</label><input type="number" value={tier.from} onChange={e => { const n=[...tiers]; n[i]={...n[i],from:e.target.value}; setTiers(n) }} style={inpS} /></div>
          <div><label style={{...lblS, marginBottom:2}}>По место</label><input type="number" value={tier.to} placeholder="∞" onChange={e => { const n=[...tiers]; n[i]={...n[i],to:e.target.value}; setTiers(n) }} style={inpS} /></div>
          <div><label style={{...lblS, marginBottom:2}}>Цена ₽</label><input type="number" value={tier.price} onChange={e => { const n=[...tiers]; n[i]={...n[i],price:e.target.value}; setTiers(n) }} style={inpS} /></div>
          <div><label style={{...lblS, marginBottom:2}}>Название</label><input value={tier.label} placeholder="Ранняя запись" onChange={e => { const n=[...tiers]; n[i]={...n[i],label:e.target.value}; setTiers(n) }} style={inpS} /></div>
          <button type="button" onClick={() => setTiers(tiers.filter((_,j)=>j!==i))} style={{padding:'8px', background:'#fdecea', border:'none', borderRadius:6, fontSize:12, color:'#e74c3c', cursor:'pointer', marginBottom:1}}>✕</button>
        </div>
      ))}
    </div>
  )

  const EventForm = ({ f, setF, imgPreview, onImgChange, imgRef, trs, setTrs, dates, setDates, onSave, onCancel, isEdit }) => (
    <div style={{background:'#fff', borderRadius:14, border:'1.5px solid #BFD900', padding:20, marginBottom:16}}>
      <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>{isEdit ? '✏️ Редактировать мероприятие' : 'Новое мероприятие'}</div>
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:10, marginBottom:10}}>
        <div><label style={lblS}>Название *</label><input value={f.name} onChange={e => setF({...f,name:e.target.value})} placeholder="Акрокурс май 2026" style={inpS} /></div>
        <div><label style={lblS}>Тип</label><select value={f.type} onChange={e => setF({...f,type:e.target.value})} style={inpS}>{EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
      </div>
      <label style={lblS}>Описание</label>
      <textarea value={f.description} onChange={e => setF({...f,description:e.target.value})} rows={2} placeholder="Для кого, программа, что включено..." style={{...inpS, marginBottom:10, resize:'vertical'}} />
      <label style={lblS}>Фото</label>
      <div onClick={() => imgRef.current?.click()} style={{border:'1.5px dashed #e0e0e0', borderRadius:10, padding:14, textAlign:'center', cursor:'pointer', marginBottom:10, background:'#fafafa'}}>
        {imgPreview ? <img src={imgPreview} alt="" style={{maxHeight:120, maxWidth:'100%', borderRadius:8, objectFit:'cover'}} /> : <div style={{fontSize:12, color:'#888'}}>📸 Нажмите для загрузки</div>}
      </div>
      <input ref={imgRef} type="file" accept="image/*" onChange={onImgChange} style={{display:'none'}} />
      <div style={{marginBottom:10}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
          <label style={lblS}>Даты проведения</label>
          <button type="button" onClick={() => setDates([...dates, { date_start:'', date_end:'', label:'' }])} style={{padding:'3px 10px', background:'#f5f5f5', border:'none', borderRadius:6, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>+ Добавить период</button>
        </div>
        {dates.map((d, i) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr auto', gap:6, marginBottom:6, alignItems:'end'}}>
            <div><label style={{...lblS, marginBottom:2}}>С</label><input type="date" value={d.date_start} onChange={e => { const n=[...dates]; n[i]={...n[i],date_start:e.target.value}; setDates(n) }} style={inpS} /></div>
            <div><label style={{...lblS, marginBottom:2}}>По</label><input type="date" value={d.date_end} onChange={e => { const n=[...dates]; n[i]={...n[i],date_end:e.target.value}; setDates(n) }} style={inpS} /></div>
            <div><label style={{...lblS, marginBottom:2}}>Начало</label><input type="time" value={d.time_start||''} onChange={e => { const n=[...dates]; n[i]={...n[i],time_start:e.target.value}; setDates(n) }} style={inpS} /></div>
            <div><label style={{...lblS, marginBottom:2}}>Конец</label><input type="time" value={d.time_end||''} onChange={e => { const n=[...dates]; n[i]={...n[i],time_end:e.target.value}; setDates(n) }} style={inpS} /></div>
            <div><label style={{...lblS, marginBottom:2}}>Подпись</label><input value={d.label} placeholder="День 1..." onChange={e => { const n=[...dates]; n[i]={...n[i],label:e.target.value}; setDates(n) }} style={inpS} /></div>
            <button type="button" onClick={() => setDates(dates.filter((_,j)=>j!==i))} style={{padding:'8px', background:'#fdecea', border:'none', borderRadius:6, fontSize:12, color:'#e74c3c', cursor:'pointer', marginBottom:1}}>✕</button>
          </div>
        ))}
        {dates.length === 0 && <div style={{fontSize:12, color:'#BDBDBD'}}>Даты не указаны</div>}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
        <div><label style={lblS}>Зал</label><select value={f.hall} onChange={e => setF({...f,hall:e.target.value})} style={inpS}><option value=''>— Не выбран —</option><option value='Большой зал'>Большой зал</option><option value='Малый зал'>Малый зал</option></select></div>
        <div><label style={lblS}>Преподаватель</label><select value={f.teacher_id} onChange={e => setF({...f,teacher_id:e.target.value})} style={inpS}><option value=''>— Не выбран —</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10}}>
        <div><label style={lblS}>Базовая цена ₽</label><input type="number" value={f.price} onChange={e => setF({...f,price:e.target.value})} placeholder="5000" style={inpS} /></div>
        <div><label style={lblS}>Макс. участников</label><input type="number" value={f.max_participants} onChange={e => setF({...f,max_participants:e.target.value})} placeholder="20" style={inpS} /></div>
        <div><label style={lblS}>Возраст/уровень</label><input value={f.age_info} onChange={e => setF({...f,age_info:e.target.value})} placeholder="6–12 лет" style={inpS} /></div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
        <div><label style={lblS}>Приоритет</label><input type="number" value={f.sort_order} onChange={e => setF({...f,sort_order:e.target.value})} style={inpS} /></div>
        <div style={{display:'flex', alignItems:'flex-end', paddingBottom:4}}>
          <label style={{display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#2a2a2a', cursor:'pointer'}}><input type="checkbox" checked={f.is_available_online} onChange={e => setF({...f,is_available_online:e.target.checked})} />В магазине у клиента</label>
        </div>
      </div>
      <TiersEditor tiers={trs} setTiers={setTrs} />
      <div style={{display:'flex', gap:8}}>
        <button type="button" onClick={onSave} disabled={saving || !f.name.trim()} style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity:(!f.name.trim()||saving)?0.5:1}}>{saving ? 'Сохраняем...' : isEdit ? 'Сохранить' : 'Создать мероприятие'}</button>
        <button type="button" onClick={onCancel} style={{padding:'9px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
      </div>
    </div>
  )

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <div style={{fontSize:13, color:'#888'}}>{events.length} мероприятий</div>
        <button onClick={() => { setShowForm(!showForm); setEditingEvent(null) }} style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>{showForm ? 'Закрыть' : '+ Добавить мероприятие'}</button>
      </div>
      {showForm && <EventForm f={form} setF={setForm} imgPreview={imagePreview} onImgChange={e => { const file=e.target.files[0]; if(!file) return; setImageFile(file); setImagePreview(URL.createObjectURL(file)) }} imgRef={fileRef} trs={tiers} setTrs={setTiers} dates={dates} setDates={setDates} onSave={handleCreate} onCancel={() => { setShowForm(false); setForm(emptyForm); setImageFile(null); setImagePreview(null); setTiers([]); setDates([]) }} isEdit={false} />}
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {events.length === 0 && !showForm && <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Мероприятий нет — добавьте первое</div>}
        {events.map(ev => {
          const isOpen = openEvent === ev.id
          const tl = EVENT_TYPES.find(t => t.value === ev.type)?.label || 'Другое'
          const regsCount = eventRegs[ev.id] || 0
          const tiersList = eventTiers[ev.id] || []
          const formatDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'short' }) : null
          const dateStr = ev.date_start ? `${formatDate(ev.date_start)}${ev.date_end && ev.date_end !== ev.date_start ? ` — ${formatDate(ev.date_end)}` : ''}` : null
          return (
            <div key={ev.id} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', overflow:'hidden'}}>
              <div style={{display:'flex', gap:14, alignItems:'flex-start', padding:'14px 16px'}}>
                {ev.image_url ? <img src={ev.image_url} alt="" style={{width:72, height:72, borderRadius:10, objectFit:'cover', flexShrink:0}} /> : <div style={{width:72, height:72, borderRadius:10, background:'#f5f5f5', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28}}>🎭</div>}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4}}>
                    <span style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>{ev.name}</span>
                    <span style={{fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#e8f4fd', color:'#2980b9'}}>{tl}</span>
                    {!ev.is_available_online && <span style={{fontSize:11, color:'#BDBDBD'}}>Офлайн</span>}
                  </div>
                  <div style={{fontSize:12, color:'#888', marginBottom:4, display:'flex', gap:10, flexWrap:'wrap'}}>
                    {dateStr && <span>📅 {dateStr}</span>}
                    {ev.hall && <span>{ev.hall}</span>}
                    {ev.age_info && <span>👤 {ev.age_info}</span>}
                  </div>
                  <div style={{display:'flex', gap:10, flexWrap:'wrap', alignItems:'center'}}>
                    {tiersList.length > 0 ? tiersList.map((t, i) => <span key={i} style={{fontSize:11, color:'#f39c12', fontWeight:600}}>{t.label || `${t.position_from}–${t.position_to || '∞'}`}: {Number(t.price).toLocaleString('ru-RU')} ₽</span>) : ev.price ? <span style={{fontSize:13, fontWeight:600, color:'#2a2a2a'}}>{Number(ev.price).toLocaleString('ru-RU')} ₽</span> : null}
                    {ev.max_participants && <span style={{fontSize:11, color: regsCount >= ev.max_participants ? '#e74c3c' : '#888'}}>{regsCount}/{ev.max_participants} мест</span>}
                  </div>
                </div>
                <div style={{display:'flex', gap:6, flexShrink:0, alignItems:'center'}}>
                  <button onClick={() => editingEvent === ev.id ? setEditingEvent(null) : openEdit(ev)} style={{padding:'5px 10px', background: editingEvent===ev.id ? '#fafde8' : '#f5f5f5', border: editingEvent===ev.id ? '1px solid #BFD900' : 'none', borderRadius:8, fontSize:12, color: editingEvent===ev.id ? '#6a7700' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>✎</button>
                  <button onClick={() => setOpenEvent(isOpen ? null : ev.id)} style={{padding:'5px 10px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s'}}>⌄</button>
                  <button onClick={() => handleArchive(ev.id)} style={{padding:'5px 10px', background:'transparent', border:'1px solid #f0f0f0', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>В архив</button>
                </div>
              </div>
              {editingEvent === ev.id && editForm && (
                <div style={{borderTop:'1px solid #f0f0f0', padding:16, background:'#fafde8'}}>
                  <EventForm f={editForm} setF={setEditForm} imgPreview={editImagePreview} onImgChange={e => { const file=e.target.files[0]; if(!file) return; setEditImageFile(file); setEditImagePreview(URL.createObjectURL(file)) }} imgRef={editFileRef} trs={editTiers} setTrs={setEditTiers} dates={editDates} setDates={setEditDates} onSave={() => handleUpdate(ev.id)} onCancel={() => { setEditingEvent(null); setEditForm(null) }} isEdit={true} />
                </div>
              )}
              {isOpen && (
                <div style={{borderTop:'1px solid #f0f0f0', padding:'12px 16px'}}>
                  <div style={{fontSize:12, fontWeight:600, color:'#888', marginBottom:8}}>Записавшиеся ({regsCount})</div>
                  {regsCount === 0 ? <div style={{fontSize:12, color:'#BDBDBD'}}>Записей пока нет</div> : <EventRegistrations eventId={ev.id} />}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {archived.length > 0 && (
        <div style={{marginTop:16}}>
          <button onClick={() => setShowArchive(!showArchive)} style={{display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#f9f9f9', border:'1px solid #f0f0f0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif', width:'100%'}}>🗄 Архив — {archived.length} {showArchive ? '▲' : '▼'}</button>
          {showArchive && (
            <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:8}}>
              {archived.map(ev => (
                <div key={ev.id} style={{background:'#f9f9f9', borderRadius:12, border:'1px solid #f0f0f0', padding:'12px 16px', display:'flex', alignItems:'center', gap:12, opacity:0.7}}>
                  <span style={{flex:1, fontSize:13, fontWeight:600, color:'#888'}}>{ev.name}</span>
                  <button onClick={() => handleRestore(ev.id)} style={{padding:'5px 12px', background:'#eafaf1', border:'1px solid #a9dfbf', borderRadius:8, fontSize:12, color:'#27ae60', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>↩ Восстановить</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EventRegistrations({ eventId }) {
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('event_registrations').select('*, client:profiles!event_registrations_client_id_fkey(full_name, phone)').eq('event_id', eventId).eq('status','registered').order('created_at')
      setRegs(data || []); setLoading(false)
    }
    load()
  }, [eventId])
  if (loading) return <div style={{fontSize:12, color:'#BDBDBD'}}>Загрузка...</div>
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      {regs.map((r, i) => (
        <div key={r.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#f9f9f9', borderRadius:8}}>
          <span style={{fontSize:12, color:'#888', minWidth:20}}>{i+1}</span>
          <span style={{fontSize:13, color:'#2a2a2a', flex:1}}>{r.client?.full_name}</span>
          {r.client?.phone && <span style={{fontSize:11, color:'#BDBDBD'}}>{r.client.phone}</span>}
          <span style={{fontSize:11, color:'#888'}}>{new Date(r.created_at).toLocaleDateString('ru-RU', { day:'numeric', month:'short' })}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Вкладка Мерч ─────────────────────────────────────────────────────────────
function VariantEditForm({ variant, colorName, onSave, onClose }) {
  const [form, setForm] = useState({ price: variant.price || '', coins_price: variant.coins_price || '', stock_count: variant.stock_count ?? 0, is_active: variant.is_active ?? true, size: variant.size || '' })
  const [saving, setSaving] = useState(false)
  const label = `${colorName}${variant.size ? ' / ' + variant.size : ''}`
  const handleSave = async () => {
    setSaving(true)
    await supabase.from('merch_variants').update({ price: parseFloat(form.price) || 0, coins_price: form.coins_price ? parseInt(form.coins_price) : null, stock_count: parseInt(form.stock_count) || 0, is_active: form.is_active, size: form.size || null }).eq('id', variant.id)
    setSaving(false); onSave()
  }
  return (
    <div style={{padding:14, border:'1.5px solid #BFD900', borderRadius:10, background:'#fafde8', marginTop:8}}>
      <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:12}}>Редактировать: {label}</div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10}}>
        <div><label style={lblS}>Размер</label><input value={form.size} onChange={e => setForm({...form, size:e.target.value})} placeholder="M, L, XL..." style={inpS} /></div>
        <div><label style={lblS}>Цена (₽)</label><input type="number" min="0" value={form.price} onChange={e => setForm({...form, price:e.target.value})} style={inpS} /></div>
        <div><label style={lblS}>Цена (SDTшки)</label><input type="number" min="0" value={form.coins_price} onChange={e => setForm({...form, coins_price:e.target.value})} placeholder="необязательно" style={inpS} /></div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
        <div><label style={lblS}>Остаток (шт)</label><input type="number" min="0" value={form.stock_count} onChange={e => setForm({...form, stock_count:e.target.value})} style={inpS} /></div>
        <div style={{display:'flex', alignItems:'flex-end', paddingBottom:4}}><label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#2a2a2a', cursor:'pointer'}}><input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active:e.target.checked})} />Активен (продаётся)</label></div>
      </div>
      <div style={{display:'flex', gap:8}}>
        <button onClick={handleSave} disabled={saving} style={{padding:'8px 16px', background:'#BFD900', border:'none', borderRadius:8, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>{saving ? 'Сохраняем...' : 'Сохранить'}</button>
        <button onClick={onClose} style={{padding:'8px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
      </div>
    </div>
  )
}

function MerchTab({ session }) {
  const [products, setProducts] = useState([])
  const [archived, setArchived] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchive, setShowArchive] = useState(false)
  const [openProduct, setOpenProduct] = useState(null)
  const [openColor, setOpenColor] = useState({})
  const [editingVariant, setEditingVariant] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const editFileRef = useRef()
  const [form, setForm] = useState({ name:'', description:'', category:'clothing', is_available_online:true, sort_order:100, allow_preorder:false, low_stock_threshold:3, badge_text:'', badge_color:'#BFD900', image_url:'' })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [newColorFor, setNewColorFor] = useState(null)
  const [newColor, setNewColor] = useState({ color:'', color_hex:'#000000', size:'', price:'', coins_price:'', stock_count:0 })
  const [editingProduct, setEditingProduct] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editImageFile, setEditImageFile] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState(null)

  const openEdit = (product) => {
    setEditingProduct(product.id)
    setEditForm({ name: product.name||'', description: product.description||'', category: product.category||'clothing', is_available_online: product.is_available_online??true, sort_order: product.sort_order??100, allow_preorder: product.allow_preorder??false, low_stock_threshold: product.low_stock_threshold??3, badge_text: product.badge_text||'', badge_color: product.badge_color||'#BFD900', image_url: product.image_url||'' })
    setEditImageFile(null); setEditImagePreview(product.image_url || null); setOpenProduct(product.id)
  }

  const handleUpdate = async (productId) => {
    if (!editForm?.name?.trim()) return
    setSaving(true)
    let imageUrl = editForm.image_url
    if (editImageFile) { const url = await uploadMerchImage(editImageFile, productId); if (url) imageUrl = url }
    await supabase.from('merch_products').update({ name: editForm.name.trim(), description: editForm.description||null, category: editForm.category, is_available_online: editForm.is_available_online, sort_order: parseInt(editForm.sort_order)||100, allow_preorder: editForm.allow_preorder, low_stock_threshold: parseInt(editForm.low_stock_threshold)||3, badge_text: editForm.badge_text||null, badge_color: editForm.badge_color||null, image_url: imageUrl||null }).eq('id', productId)
    setSaving(false); setEditingProduct(null); setEditForm(null); setEditImageFile(null); setEditImagePreview(null); load()
  }

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('merch_products').select('*, merch_variants(*), merch_images(*), merch_preorders(id)').order('sort_order')
    setProducts((data || []).filter(p => p.is_active)); setArchived((data || []).filter(p => !p.is_active)); setLoading(false)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const { data: product } = await supabase.from('merch_products').insert({ name: form.name.trim(), description: form.description||null, category: form.category, is_available_online: form.is_available_online, sort_order: parseInt(form.sort_order)||100, allow_preorder: form.allow_preorder, low_stock_threshold: parseInt(form.low_stock_threshold)||3, badge_text: form.badge_text||null, badge_color: form.badge_color||null, is_active: true, created_by: session.user.id }).select().single()
    if (product && imageFile) { const url = await uploadMerchImage(imageFile, product.id); if (url) { await supabase.from('merch_products').update({ image_url: url }).eq('id', product.id); await supabase.from('merch_images').insert({ product_id: product.id, url, sort_order: 1 }) } }
    setSaving(false); setShowForm(false); setForm({ name:'', description:'', category:'clothing', is_available_online:true, sort_order:100, allow_preorder:false, low_stock_threshold:3, badge_text:'', badge_color:'#BFD900', image_url:'' }); setImageFile(null); setImagePreview(null); load()
  }

  const handleArchive = async (id) => { if (!confirm('Архивировать товар?')) return; await supabase.from('merch_products').update({ is_active: false }).eq('id', id); load() }
  const handleRestore = async (id) => { await supabase.from('merch_products').update({ is_active: true }).eq('id', id); load() }
  const handleAddVariant = async (productId) => {
    if (!newColor.color || !newColor.price) return
    setSaving(true)
    await supabase.from('merch_variants').insert({ product_id: productId, color: newColor.color, color_hex: newColor.color_hex||null, size: newColor.size||null, price: parseFloat(newColor.price), coins_price: newColor.coins_price ? parseInt(newColor.coins_price) : null, stock_count: parseInt(newColor.stock_count)||0, is_active: true, sort_order: 100 })
    setSaving(false); setNewColorFor(null); setNewColor({ color:'', color_hex:'#000000', size:'', price:'', coins_price:'', stock_count:0 }); load()
  }

  const toggleColor = (productId, color) => { const key=`${productId}-${color}`; setOpenColor(prev => ({...prev,[key]:!prev[key]})) }
  const getStockStatus = (stock, threshold) => { if (stock===0) return 'out'; if (stock<=threshold) return 'low'; return 'ok' }
  const getVariantsByColor = (variants) => {
    const map = {}
    ;(variants||[]).forEach(v => { const c=v.color||'Без цвета'; if (!map[c]) map[c]={hex:v.color_hex,variants:[]}; map[c].variants.push(v) })
    return map
  }

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <div style={{fontSize:13, color:'#888'}}>{products.length} товаров · {products.reduce((s,p)=>s+(p.merch_variants||[]).length,0)} вариантов</div>
        <button onClick={() => setShowForm(!showForm)} style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>{showForm ? 'Закрыть' : '+ Добавить товар'}</button>
      </div>
      {showForm && (
        <div style={{background:'#fff', borderRadius:14, border:'1.5px solid #BFD900', padding:20, marginBottom:16}}>
          <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>Новый товар</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
            <div><label style={lblS}>Название *</label><input value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Футболка SDT" style={inpS} /></div>
            <div><label style={lblS}>Категория</label><select value={form.category} onChange={e => setForm({...form,category:e.target.value})} style={inpS}>{MERCH_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          </div>
          <label style={lblS}>Описание</label>
          <textarea value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Описание товара..." rows={2} style={{...inpS,marginBottom:10,resize:'vertical'}} />
          <label style={lblS}>Фото товара</label>
          <div onClick={() => fileRef.current?.click()} style={{border:'1.5px dashed #e0e0e0',borderRadius:10,padding:'16px',textAlign:'center',cursor:'pointer',marginBottom:10,background:'#fafafa'}}>
            {imagePreview ? <img src={imagePreview} alt="" style={{maxHeight:120,maxWidth:'100%',borderRadius:8,objectFit:'contain'}} /> : <><div style={{fontSize:24,marginBottom:4}}>📸</div><div style={{fontSize:12,color:'#888'}}>Нажмите для загрузки фото</div></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f)return;setImageFile(f);setImagePreview(URL.createObjectURL(f))}} style={{display:'none'}} />
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10}}>
            <div><label style={lblS}>Приоритет</label><input type="number" value={form.sort_order} onChange={e=>setForm({...form,sort_order:e.target.value})} style={inpS} /></div>
            <div><label style={lblS}>Порог «мало» (шт)</label><input type="number" value={form.low_stock_threshold} onChange={e=>setForm({...form,low_stock_threshold:e.target.value})} style={inpS} /></div>
            <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:2,gap:6}}>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#2a2a2a',cursor:'pointer'}}><input type="checkbox" checked={form.is_available_online} onChange={e=>setForm({...form,is_available_online:e.target.checked})} />В магазине</label>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#2a2a2a',cursor:'pointer'}}><input type="checkbox" checked={form.allow_preorder} onChange={e=>setForm({...form,allow_preorder:e.target.checked})} />Разрешить предзаказ</label>
            </div>
          </div>
          <label style={lblS}>Виджет (значок)</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
            <button onClick={()=>setForm({...form,badge_text:''})} style={{padding:'5px 12px',borderRadius:20,border:'1px solid #e0e0e0',background:!form.badge_text?'#f5f5f5':'#fff',fontSize:12,cursor:'pointer',color:'#888',fontFamily:'Inter,sans-serif'}}>Без виджета</button>
            {MERCH_BADGES.map(b=><button key={b.id} onClick={()=>setForm({...form,badge_text:b.text,badge_color:b.color})} style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${form.badge_text===b.text?b.color:'#e0e0e0'}`,background:form.badge_text===b.text?b.color+'22':'#fff',color:form.badge_text===b.text?b.color:'#888',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:form.badge_text===b.text?600:400}}>{b.text}</button>)}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={handleCreate} disabled={saving||!form.name.trim()} style={{padding:'9px 20px',background:'#BFD900',border:'none',borderRadius:10,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:(!form.name.trim()||saving)?0.5:1}}>{saving?'Создаём...':'Создать товар'}</button>
            <button onClick={()=>setShowForm(false)} style={{padding:'9px 16px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:10,fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Отмена</button>
          </div>
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {products.length===0&&!showForm&&<div style={{textAlign:'center',color:'#BDBDBD',padding:40}}>Мерча нет — добавьте первый товар</div>}
        {products.map(product => {
          const isOpen=openProduct===product.id
          const colorMap=getVariantsByColor(product.merch_variants)
          const totalStock=(product.merch_variants||[]).reduce((s,v)=>s+(v.stock_count||0),0)
          const lowCount=(product.merch_variants||[]).filter(v=>v.stock_count>0&&v.stock_count<=product.low_stock_threshold).length
          const outCount=(product.merch_variants||[]).filter(v=>v.stock_count===0&&v.is_active).length
          const preorderCount=product.merch_preorders?.length||0
          const catLabel=MERCH_CATEGORIES.find(c=>c.id===product.category)?.label||''
          return (
            <div key={product.id} style={{background:'#fff',borderRadius:14,border:'1px solid #f0f0f0',overflow:'hidden'}}>
              <div style={{display:'flex',gap:14,alignItems:'flex-start',padding:'14px 16px'}}>
                {product.image_url?<img src={product.image_url} alt="" style={{width:72,height:72,borderRadius:10,objectFit:'cover',flexShrink:0}} />:<div style={{width:72,height:72,borderRadius:10,background:'#f5f5f5',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>📦</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:600,color:'#2a2a2a'}}>{product.name}</span>
                    {product.badge_text&&<span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:(product.badge_color||'#BFD900')+'22',color:product.badge_color||'#6a7700'}}>{product.badge_text}</span>}
                  </div>
                  <div style={{fontSize:12,color:'#BDBDBD',marginBottom:4}}>{catLabel} · {(product.merch_variants||[]).length} вариантов · {totalStock} шт итого</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {lowCount>0&&<span style={{fontSize:11,color:'#f39c12'}}>⚠ {lowCount} мало</span>}
                    {outCount>0&&<span style={{fontSize:11,color:'#e74c3c'}}>✕ {outCount} нет</span>}
                    {preorderCount>0&&<span style={{fontSize:11,fontWeight:600,padding:'1px 8px',borderRadius:20,background:'#fef9e7',color:'#f39c12'}}>🔔 {preorderCount} предзаказов</span>}
                    {!product.is_available_online&&<span style={{fontSize:11,color:'#BDBDBD'}}>Офлайн</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
                  <button onClick={()=>editingProduct===product.id?setEditingProduct(null):openEdit(product)} style={{padding:'5px 10px',background:editingProduct===product.id?'#fafde8':'#f5f5f5',border:editingProduct===product.id?'1px solid #BFD900':'none',borderRadius:8,fontSize:12,color:editingProduct===product.id?'#6a7700':'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>✎</button>
                  <button onClick={()=>setOpenProduct(isOpen?null:product.id)} style={{padding:'5px 10px',background:'#f5f5f5',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',transform:isOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}>⌄</button>
                  <button onClick={()=>handleArchive(product.id)} style={{padding:'5px 10px',background:'transparent',border:'1px solid #f0f0f0',borderRadius:8,fontSize:12,color:'#e74c3c',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>В архив</button>
                </div>
              </div>
              {editingProduct===product.id&&editForm&&(
                <div style={{borderTop:'1px solid #f0f0f0',padding:'16px',background:'#fafde8'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a',marginBottom:12}}>✏️ Редактировать товар</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div><label style={lblS}>Название *</label><input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} style={inpS} /></div>
                    <div><label style={lblS}>Категория</label><select value={editForm.category} onChange={e=>setEditForm({...editForm,category:e.target.value})} style={inpS}>{MERCH_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
                  </div>
                  <label style={lblS}>Описание</label>
                  <textarea value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})} rows={2} style={{...inpS,marginBottom:10,resize:'vertical'}} />
                  <label style={lblS}>Фото товара</label>
                  <div onClick={()=>editFileRef.current?.click()} style={{border:'1.5px dashed #BFD900',borderRadius:10,padding:'12px',textAlign:'center',cursor:'pointer',marginBottom:10,background:'#fff'}}>
                    {editImagePreview?<img src={editImagePreview} alt="" style={{maxHeight:100,maxWidth:'100%',borderRadius:8,objectFit:'contain'}} />:<div style={{fontSize:12,color:'#888'}}>📸 Нажмите для загрузки фото</div>}
                  </div>
                  <input ref={editFileRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f)return;setEditImageFile(f);setEditImagePreview(URL.createObjectURL(f))}} style={{display:'none'}} />
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                    <div><label style={lblS}>Приоритет</label><input type="number" value={editForm.sort_order} onChange={e=>setEditForm({...editForm,sort_order:e.target.value})} style={inpS} /></div>
                    <div><label style={lblS}>Порог «мало» (шт)</label><input type="number" value={editForm.low_stock_threshold} onChange={e=>setEditForm({...editForm,low_stock_threshold:e.target.value})} style={inpS} /></div>
                    <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:2,gap:6}}>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#2a2a2a',cursor:'pointer'}}><input type="checkbox" checked={editForm.is_available_online} onChange={e=>setEditForm({...editForm,is_available_online:e.target.checked})} />В магазине</label>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#2a2a2a',cursor:'pointer'}}><input type="checkbox" checked={editForm.allow_preorder} onChange={e=>setEditForm({...editForm,allow_preorder:e.target.checked})} />Предзаказ</label>
                    </div>
                  </div>
                  <label style={lblS}>Виджет</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                    <button onClick={()=>setEditForm({...editForm,badge_text:''})} style={{padding:'4px 10px',borderRadius:20,border:'1px solid #e0e0e0',background:!editForm.badge_text?'#f5f5f5':'#fff',fontSize:12,cursor:'pointer',color:'#888',fontFamily:'Inter,sans-serif'}}>Без виджета</button>
                    {MERCH_BADGES.map(b=><button key={b.id} onClick={()=>setEditForm({...editForm,badge_text:b.text,badge_color:b.color})} style={{padding:'4px 10px',borderRadius:20,border:`1px solid ${editForm.badge_text===b.text?b.color:'#e0e0e0'}`,background:editForm.badge_text===b.text?b.color+'22':'#fff',color:editForm.badge_text===b.text?b.color:'#888',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{b.text}</button>)}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>handleUpdate(product.id)} disabled={saving||!editForm.name.trim()} style={{padding:'8px 16px',background:'#BFD900',border:'none',borderRadius:8,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:(!editForm.name.trim()||saving)?0.5:1}}>{saving?'Сохраняем...':'Сохранить'}</button>
                    <button onClick={()=>{setEditingProduct(null);setEditForm(null)}} style={{padding:'8px 14px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Отмена</button>
                  </div>
                </div>
              )}
              {isOpen&&(
                <div style={{borderTop:'1px solid #f0f0f0',padding:'12px 16px'}}>
                  {Object.entries(colorMap).map(([color,{hex,variants}])=>{
                    const colorKey=`${product.id}-${color}`; const isColorOpen=openColor[colorKey]
                    const colorTotal=variants.reduce((s,v)=>s+(v.stock_count||0),0)
                    const colorLow=variants.filter(v=>v.stock_count>0&&v.stock_count<=product.low_stock_threshold).length
                    const colorOut=variants.filter(v=>v.stock_count===0).length
                    return (
                      <div key={color} style={{border:'1px solid #f0f0f0',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
                        <div onClick={()=>toggleColor(product.id,color)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#fafafa',cursor:'pointer',userSelect:'none'}}>
                          <div style={{width:18,height:18,borderRadius:'50%',background:hex||'#e0e0e0',border:'1px solid rgba(0,0,0,0.12)',flexShrink:0}} />
                          <span style={{fontSize:13,fontWeight:600,color:'#2a2a2a',flex:1}}>{color}</span>
                          <span style={{fontSize:11,color:'#BDBDBD'}}>{variants.length} размеров · {colorTotal} шт</span>
                          {colorLow>0&&<span style={{fontSize:11,color:'#f39c12'}}>⚠ мало</span>}
                          {colorOut>0&&<span style={{fontSize:11,color:'#e74c3c'}}>✕ нет</span>}
                          <span style={{fontSize:16,color:'#BDBDBD',transform:isColorOpen?'rotate(180deg)':'none',transition:'transform 0.2s',lineHeight:1}}>⌄</span>
                        </div>
                        {isColorOpen&&(
                          <div style={{padding:'10px 14px'}}>
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
                              {variants.map(v=>{
                                const status=getStockStatus(v.stock_count,product.low_stock_threshold)
                                const isEditing=editingVariant?.id===v.id
                                const borderColor=status==='ok'?'#e0e0e0':status==='low'?'#f39c12':'#e74c3c'
                                const bgColor=status==='ok'?'#fff':status==='low'?'#fef9e7':'#fdecea'
                                const textC=status==='ok'?'#2a2a2a':status==='low'?'#f39c12':'#e74c3c'
                                return (
                                  <div key={v.id}>
                                    <div onClick={()=>setEditingVariant(isEditing?null:v)} style={{textAlign:'center',padding:'8px 12px',border:`1px solid ${isEditing?'#BFD900':borderColor}`,borderRadius:10,cursor:'pointer',minWidth:64,background:isEditing?'#fafde8':(v.is_active?bgColor:'#f5f5f5'),opacity:v.is_active?1:0.5}}>
                                      {v.size&&<div style={{fontSize:11,color:'#888',marginBottom:2}}>{v.size}</div>}
                                      <div style={{fontSize:15,fontWeight:700,color:v.is_active?textC:'#BDBDBD'}}>{v.stock_count===0?'0':v.stock_count}</div>
                                      <div style={{fontSize:10,color:'#888'}}>{Number(v.price).toLocaleString('ru-RU')} ₽</div>
                                      {v.coins_price&&<div style={{fontSize:10,color:'#f39c12'}}>{v.coins_price} 🪙</div>}
                                    </div>
                                    {isEditing&&<VariantEditForm variant={v} colorName={color} onSave={()=>{setEditingVariant(null);load()}} onClose={()=>setEditingVariant(null)} />}
                                  </div>
                                )
                              })}
                              <div onClick={()=>setNewColorFor(`${product.id}-${color}-size`)} style={{textAlign:'center',padding:'8px 12px',border:'1.5px dashed #e0e0e0',borderRadius:10,cursor:'pointer',minWidth:64,display:'flex',alignItems:'center',justifyContent:'center',color:'#BDBDBD',fontSize:20}}>+</div>
                            </div>
                            {newColorFor===`${product.id}-${color}-size`&&(
                              <div style={{padding:12,background:'#f9f9f9',borderRadius:10,border:'1px solid #e0e0e0',marginTop:8}}>
                                <div style={{fontSize:12,fontWeight:600,color:'#2a2a2a',marginBottom:8}}>Новый вариант — цвет: {color}</div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}}>
                                  <div><label style={lblS}>Размер</label><input value={newColor.size} onChange={e=>setNewColor({...newColor,size:e.target.value})} placeholder="M" style={inpS} /></div>
                                  <div><label style={lblS}>Цена ₽</label><input type="number" value={newColor.price} onChange={e=>setNewColor({...newColor,price:e.target.value})} style={inpS} /></div>
                                  <div><label style={lblS}>SDTшки</label><input type="number" value={newColor.coins_price} onChange={e=>setNewColor({...newColor,coins_price:e.target.value})} placeholder="опционально" style={inpS} /></div>
                                  <div><label style={lblS}>Остаток</label><input type="number" value={newColor.stock_count} onChange={e=>setNewColor({...newColor,stock_count:e.target.value})} style={inpS} /></div>
                                </div>
                                <div style={{display:'flex',gap:8,marginTop:8}}>
                                  <button onClick={async()=>{await supabase.from('merch_variants').insert({product_id:product.id,color,color_hex:hex||null,size:newColor.size||null,price:parseFloat(newColor.price)||0,coins_price:newColor.coins_price?parseInt(newColor.coins_price):null,stock_count:parseInt(newColor.stock_count)||0,is_active:true,sort_order:100});setNewColorFor(null);setNewColor({color:'',color_hex:'#000000',size:'',price:'',coins_price:'',stock_count:0});load()}} style={{padding:'7px 14px',background:'#BFD900',border:'none',borderRadius:8,fontSize:12,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Добавить</button>
                                  <button onClick={()=>setNewColorFor(null)} style={{padding:'7px 12px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Отмена</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {newColorFor!==`${product.id}-new`?(
                    <button onClick={()=>{setNewColorFor(`${product.id}-new`);setNewColor({color:'',color_hex:'#BFD900',size:'',price:'',coins_price:'',stock_count:0})}} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,width:'100%',padding:'9px',background:'transparent',border:'1px dashed #e0e0e0',borderRadius:10,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:4}}>+ Добавить цвет</button>
                  ):(
                    <div style={{padding:14,border:'1px solid #e0e0e0',borderRadius:10,background:'#f9f9f9',marginTop:8}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a',marginBottom:12}}>Новый цвет</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 60px 1fr 1fr 1fr',gap:8,marginBottom:8}}>
                        <div><label style={lblS}>Название цвета *</label><input value={newColor.color} onChange={e=>setNewColor({...newColor,color:e.target.value})} placeholder="Белый" style={inpS} /></div>
                        <div><label style={lblS}>Hex</label><input type="color" value={newColor.color_hex} onChange={e=>setNewColor({...newColor,color_hex:e.target.value})} style={{width:'100%',height:36,border:'1px solid #e8e8e8',borderRadius:8,cursor:'pointer',padding:2}} /></div>
                        <div><label style={lblS}>Размер</label><input value={newColor.size} onChange={e=>setNewColor({...newColor,size:e.target.value})} placeholder="M (или пусто)" style={inpS} /></div>
                        <div><label style={lblS}>Цена ₽ *</label><input type="number" value={newColor.price} onChange={e=>setNewColor({...newColor,price:e.target.value})} style={inpS} /></div>
                        <div><label style={lblS}>Остаток</label><input type="number" value={newColor.stock_count} onChange={e=>setNewColor({...newColor,stock_count:e.target.value})} style={inpS} /></div>
                      </div>
                      <div style={{fontSize:11,color:'#888',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>Предпросмотр: <div style={{width:18,height:18,borderRadius:'50%',background:newColor.color_hex,border:'1px solid rgba(0,0,0,0.15)'}} /><span>{newColor.color||'—'}</span></div>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>handleAddVariant(product.id)} disabled={saving||!newColor.color||!newColor.price} style={{padding:'8px 16px',background:'#BFD900',border:'none',borderRadius:8,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:(!newColor.color||!newColor.price)?0.5:1}}>{saving?'Добавляем...':'Добавить цвет'}</button>
                        <button onClick={()=>setNewColorFor(null)} style={{padding:'8px 14px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Отмена</button>
                      </div>
                    </div>
                  )}
                  {product.allow_preorder&&product.merch_preorders?.length>0&&(
                    <div style={{marginTop:12,padding:'10px 14px',background:'#fef9e7',borderRadius:10,border:'1px solid #f39c12'}}>
                      <span style={{fontSize:13,fontWeight:600,color:'#f39c12'}}>🔔 {product.merch_preorders.length} {product.merch_preorders.length===1?'клиент хочет':'клиента хотят'} этот товар — стоит завезти больше</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {archived.length>0&&(
        <div style={{marginTop:16}}>
          <button onClick={()=>setShowArchive(!showArchive)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'#f9f9f9',border:'1px solid #f0f0f0',borderRadius:10,fontSize:13,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif',width:'100%'}}>🗄 Архив — {archived.length} товара {showArchive?'▲':'▼'}</button>
          {showArchive&&(
            <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:8}}>
              {archived.map(p=>(
                <div key={p.id} style={{background:'#f9f9f9',borderRadius:12,border:'1px solid #f0f0f0',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,opacity:0.7}}>
                  <span style={{flex:1,fontSize:13,fontWeight:600,color:'#888'}}>{p.name}</span>
                  <button onClick={()=>handleRestore(p.id)} style={{padding:'5px 12px',background:'#eafaf1',border:'1px solid #a9dfbf',borderRadius:8,fontSize:12,color:'#27ae60',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>↩ Восстановить</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Вкладка Индивы ────────────────────────────────────────────────────────────
const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']

function SlotsSection({ teacherId }) {
  const DAYS_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
  const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

  const [slots, setSlots] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newStart, setNewStart] = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [saving, setSaving] = useState(false)

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + i)
    return d
  })

  const toDateStr = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })

  useEffect(() => { loadSlots() }, [teacherId])

  const loadSlots = async () => {
    const from = toDateStr(days[0])
    const to = toDateStr(days[days.length - 1])
    const { data } = await supabase
      .from('teacher_slot_dates')
      .select('*')
      .eq('teacher_id', teacherId)
      .gte('date', from)
      .lte('date', to)
      .order('date').order('start_time')
    setSlots(data || [])
  }

  const slotsForDate = (dateStr) => slots.filter(s => s.date === dateStr)

  const handleAdd = async () => {
    if (!selectedDate || !newStart) return
    setSaving(true)
    const [h, m] = newStart.split(':').map(Number)
    const totalMins = h * 60 + m + duration
    const endH = String(Math.floor(totalMins / 60)).padStart(2, '0')
    const endM = String(totalMins % 60).padStart(2, '0')
    await supabase.from('teacher_slot_dates').insert({
      teacher_id: teacherId,
      date: toDateStr(selectedDate),
      start_time: newStart + ':00',
      end_time: `${endH}:${endM}:00`,
      is_active: true,
    })
    setShowAdd(false); setSaving(false); loadSlots()
  }

  const handleDelete = async (id) => {
    await supabase.from('teacher_slot_dates').delete().eq('id', id)
    loadSlots()
  }

  const handleToggle = async (slot) => {
    await supabase.from('teacher_slot_dates').update({ is_active: !slot.is_active }).eq('id', slot.id)
    loadSlots()
  }

  const inp = { padding:'7px 10px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, fontFamily:'Inter,sans-serif', boxSizing:'border-box' }
  const selectedDateStr = selectedDate ? toDateStr(selectedDate) : null

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10 }}>📅 Слоты расписания — 30 дней</div>

      {/* Горизонтальный скролл календаря */}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
          {days.map(d => {
            const ds = toDateStr(d)
            const count = slotsForDate(ds).length
            const isSelected = selectedDateStr === ds
            const isToday = ds === toDateStr(new Date())
            return (
              <div key={ds} onClick={() => { setSelectedDate(d); setShowAdd(false) }}
                style={{
                  flexShrink: 0, width: 52, textAlign: 'center', padding: '8px 4px',
                  borderRadius: 10, cursor: 'pointer',
                  background: isSelected ? '#BFD900' : isToday ? '#fafde8' : '#f9f9f9',
                  border: isSelected ? 'none' : isToday ? '1px solid #BFD900' : '1px solid #f0f0f0',
                }}>
                <div style={{ fontSize: 10, color: isSelected ? '#2a2a2a' : '#888', marginBottom: 2 }}>{DAYS_SHORT[d.getDay()]}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#2a2a2a' }}>{d.getDate()}</div>
                <div style={{ fontSize: 10, color: isSelected ? '#2a2a2a' : '#BDBDBD' }}>{MONTHS[d.getMonth()]}</div>
                {count > 0 && <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: isSelected ? '#2a2a2a' : '#27ae60' }}>{count} сл.</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Слоты выбранной даты */}
      {selectedDate ? (
        <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2a2a2a' }}>
              {DAYS_SHORT[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}
            </div>
            <button onClick={() => setShowAdd(!showAdd)}
              style={{ padding: '4px 12px', background: '#BFD900', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, color: '#2a2a2a', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
              + Слот
            </button>
          </div>
          {showAdd && (
            <div style={{ background: '#fff', borderRadius: 8, padding: 10, marginBottom: 10, border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Начало</div>
                  <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} style={{ ...inp, width: '100%' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Длительность</div>
                  <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ ...inp, width: '100%' }}>
                    {[30, 45, 60, 90].map(m => <option key={m} value={m}>{m} мин</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleAdd} disabled={saving} style={{ flex: 1, padding: '6px', background: '#BFD900', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#2a2a2a', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                  {saving ? 'Создаём...' : 'Добавить'}
                </button>
                <button onClick={() => setShowAdd(false)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #e0e0e0', borderRadius: 7, fontSize: 11, color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                  Отмена
                </button>
              </div>
            </div>
          )}
          {slotsForDate(selectedDateStr).length === 0 ? (
            <div style={{ fontSize: 12, color: '#BDBDBD', textAlign: 'center', padding: '12px 0' }}>Слотов нет — добавьте первый</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {slotsForDate(selectedDateStr).map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: s.is_active ? '#fff' : '#f5f5f5', borderRadius: 8, border: '1px solid #e0e0e0', opacity: s.is_active ? 1 : 0.5 }}>
                  <span style={{ fontSize: 12, color: '#2a2a2a' }}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</span>
                  <button onClick={() => handleToggle(s)} style={{ fontSize: 11, color: s.is_active ? '#27ae60' : '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{s.is_active ? '●' : '○'}</button>
                  <button onClick={() => handleDelete(s.id)} style={{ fontSize: 11, color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#BDBDBD', textAlign: 'center', padding: '8px 0' }}>Выберите дату в календаре</div>
      )}
    </div>
  )
}

function IndivTab({ teachers }) {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [openTeacher, setOpenTeacher] = useState(null)
  const [editingPkg, setEditingPkg] = useState(null)
  const [showAddFor, setShowAddFor] = useState(null)
  const [newPkg, setNewPkg] = useState({ name:'', visits_count:'', price:'', teacher_rate:50, duration_days:'', sort_order:100 })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('indiv_packages').select('*, teacher:profiles!indiv_packages_teacher_id_fkey(id, full_name, avatar_url, sort_order)').order('sort_order')
    const map = {}
    ;(data||[]).forEach(pkg => { const tid=pkg.teacher_id; if (!map[tid]) map[tid]={teacher:pkg.teacher,packages:[]}; map[tid].packages.push(pkg) })
    setPackages(Object.values(map).sort((a,b)=>(a.teacher?.sort_order||100)-(b.teacher?.sort_order||100)))
    setLoading(false)
  }

  const handleSaveNew = async (teacherId, teacherRate) => {
    if (!newPkg.name||!newPkg.price||!newPkg.visits_count||!newPkg.duration_days) return
    setSaving(true)
    await supabase.from('indiv_packages').insert({ teacher_id:teacherId, name:newPkg.name, visits_count:parseInt(newPkg.visits_count), price:parseFloat(newPkg.price), teacher_rate:parseInt(newPkg.teacher_rate)||teacherRate, duration_days:parseInt(newPkg.duration_days), sort_order:parseInt(newPkg.sort_order)||100, is_active:true })
    setShowAddFor(null); setNewPkg({name:'',visits_count:'',price:'',teacher_rate:50,duration_days:'',sort_order:100}); setSaving(false); load()
  }

  const handleUpdate = async () => {
    if (!editingPkg) return
    setSaving(true)
    await supabase.from('indiv_packages').update({ name:editingPkg.name, visits_count:parseInt(editingPkg.visits_count), price:parseFloat(editingPkg.price), teacher_rate:parseInt(editingPkg.teacher_rate), duration_days:parseInt(editingPkg.duration_days), sort_order:parseInt(editingPkg.sort_order)||100 }).eq('id',editingPkg.id)
    setEditingPkg(null); setSaving(false); load()
  }

  const handleToggle = async (pkg) => { await supabase.from('indiv_packages').update({is_active:!pkg.is_active}).eq('id',pkg.id); load() }
  const handleDelete = async (id) => { if (!confirm('Удалить пакет?')) return; await supabase.from('indiv_packages').delete().eq('id',id); load() }
  const getInitials = (name) => (name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

  if (loading) return <div style={{textAlign:'center',color:'#BDBDBD',padding:40}}>Загрузка...</div>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:860}}>
      {packages.map(({teacher,packages:pkgs})=>{
        const isOpen=openTeacher===teacher?.id
        const minPrice=Math.min(...pkgs.map(p=>Number(p.price)))
        const activePkgs=pkgs.filter(p=>p.is_active).length
        return (
          <div key={teacher?.id} style={{background:'#fff',borderRadius:14,border:'1px solid #f0f0f0',overflow:'hidden'}}>
            <div onClick={()=>{setOpenTeacher(isOpen?null:teacher?.id);setEditingPkg(null);setShowAddFor(null)}} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',cursor:'pointer',userSelect:'none'}}>
              {teacher?.avatar_url?<img src={teacher.avatar_url} alt="" style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />:<div style={{width:36,height:36,borderRadius:'50%',background:'#fafde8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#6a7700',flexShrink:0}}>{getInitials(teacher?.full_name)}</div>}
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:'#2a2a2a'}}>{teacher?.full_name}</div>
                <div style={{fontSize:11,color:'#BDBDBD',marginTop:2}}>{activePkgs} из {pkgs.length} пакетов активны · от {minPrice.toLocaleString('ru-RU')} ₽</div>
              </div>
              <span style={{fontSize:20,color:'#BDBDBD',transform:isOpen?'rotate(180deg)':'none',transition:'transform 0.2s',lineHeight:1}}>⌄</span>
            </div>
            {isOpen&&(
              <div style={{borderTop:'1px solid #f0f0f0',padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                {pkgs.map(pkg=>(
                  <div key={pkg.id}>
                    {editingPkg?.id!==pkg.id&&(
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'#fafafa',borderRadius:10,border:'1px solid #f0f0f0',opacity:pkg.is_active?1:0.5}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a'}}>{pkg.name}</div>
                          <div style={{fontSize:11,color:'#BDBDBD',marginTop:2}}>{pkg.visits_count} {pkg.visits_count===1?'занятие':pkg.visits_count<5?'занятия':'занятий'} · {pkg.duration_days} дней</div>
                        </div>
                        <div style={{fontSize:14,fontWeight:700,color:'#2a2a2a',flexShrink:0}}>{Number(pkg.price).toLocaleString('ru-RU')} ₽</div>
                        <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,flexShrink:0,background:pkg.is_active?'#eafaf1':'#f5f5f5',color:pkg.is_active?'#27ae60':'#BDBDBD'}}>{pkg.is_active?'Вкл':'Выкл'}</span>
                        <button onClick={()=>{setEditingPkg({...pkg});setShowAddFor(null)}} style={{padding:'5px 10px',background:'#fafde8',border:'1px solid #BFD900',borderRadius:8,fontSize:12,color:'#6a7700',cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>✎</button>
                      </div>
                    )}
                    {editingPkg?.id===pkg.id&&(
                      <div style={{padding:14,border:'1.5px solid #BFD900',borderRadius:10,background:'#fafde8'}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a',marginBottom:12}}>Редактировать пакет</div>
                        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10}}>
                          <div><label style={lblS}>Название пакета</label><input value={editingPkg.name} onChange={e=>setEditingPkg({...editingPkg,name:e.target.value})} style={inpS} /></div>
                          <div><label style={lblS}>Кол-во занятий</label><input type="number" min="1" value={editingPkg.visits_count} onChange={e=>setEditingPkg({...editingPkg,visits_count:e.target.value})} style={inpS} /></div>
                          <div><label style={lblS}>Срок действия (дней)</label><input type="number" min="1" value={editingPkg.duration_days} onChange={e=>setEditingPkg({...editingPkg,duration_days:e.target.value})} style={inpS} /></div>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                          <div><label style={lblS}>Цена (₽)</label><input type="number" min="0" value={editingPkg.price} onChange={e=>setEditingPkg({...editingPkg,price:e.target.value})} style={inpS} /></div>
                          <div><label style={lblS}>Приоритет</label><input type="number" min="1" value={editingPkg.sort_order} onChange={e=>setEditingPkg({...editingPkg,sort_order:e.target.value})} style={inpS} /></div>
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                          <button onClick={handleUpdate} disabled={saving} style={{padding:'8px 16px',background:'#BFD900',border:'none',borderRadius:8,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{saving?'Сохраняем...':'Сохранить'}</button>
                          <button onClick={()=>handleToggle(pkg)} style={{padding:'8px 14px',background:pkg.is_active?'#fdecea':'#eafaf1',border:'none',borderRadius:8,fontSize:12,color:pkg.is_active?'#e74c3c':'#27ae60',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{pkg.is_active?'Отключить':'Включить'}</button>
                          <button onClick={()=>handleDelete(pkg.id)} style={{padding:'8px 14px',background:'transparent',border:'1px solid #f0f0f0',borderRadius:8,fontSize:12,color:'#e74c3c',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Удалить</button>
                          <button onClick={()=>setEditingPkg(null)} style={{padding:'8px 14px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif',marginLeft:'auto'}}>Отмена</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {showAddFor!==teacher?.id?(
                  <button onClick={()=>{setShowAddFor(teacher?.id);setEditingPkg(null);setNewPkg({name:'',visits_count:'',price:'',teacher_rate:pkgs[0]?.teacher_rate||50,duration_days:'',sort_order:pkgs.length*10+10})}} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px',background:'transparent',border:'1px dashed #e0e0e0',borderRadius:10,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:4}}>+ Добавить пакет</button>
                ):(
                  <div style={{padding:14,border:'1px solid #e0e0e0',borderRadius:10,background:'#f9f9f9',marginTop:4}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#2a2a2a',marginBottom:12}}>Новый пакет</div>
                    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10}}>
                      <div><label style={lblS}>Название пакета</label><input value={newPkg.name} onChange={e=>setNewPkg({...newPkg,name:e.target.value})} placeholder="например: 5 занятий" style={inpS} /></div>
                      <div><label style={lblS}>Кол-во занятий</label><input type="number" min="1" value={newPkg.visits_count} onChange={e=>setNewPkg({...newPkg,visits_count:e.target.value})} placeholder="5" style={inpS} /></div>
                      <div><label style={lblS}>Срок действия (дней)</label><input type="number" min="1" value={newPkg.duration_days} onChange={e=>setNewPkg({...newPkg,duration_days:e.target.value})} placeholder="60" style={inpS} /></div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      <div><label style={lblS}>Цена (₽)</label><input type="number" min="0" value={newPkg.price} onChange={e=>setNewPkg({...newPkg,price:e.target.value})} placeholder="10 000" style={inpS} /></div>
                      <div><label style={lblS}>Приоритет</label><input type="number" min="1" value={newPkg.sort_order} onChange={e=>setNewPkg({...newPkg,sort_order:e.target.value})} style={inpS} /></div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>handleSaveNew(teacher?.id,pkgs[0]?.teacher_rate||50)} disabled={saving} style={{padding:'8px 16px',background:'#BFD900',border:'none',borderRadius:8,fontSize:13,fontWeight:700,color:'#2a2a2a',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{saving?'Добавляем...':'Добавить'}</button>
                      <button onClick={()=>setShowAddFor(null)} style={{padding:'8px 14px',background:'transparent',border:'1px solid #e0e0e0',borderRadius:8,fontSize:12,color:'#888',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Отмена</button>
                    </div>
                  </div>
                )}
                <SlotsSection teacherId={teacher?.id} />
              </div>
            )}
          </div>
        )
      })}
      {packages.length===0&&<div style={{textAlign:'center',color:'#BDBDBD',padding:40}}>Нет преподавателей с пакетами</div>}
    </div>
  )
}

function ProductForm({ type, teachers, groups, onSave, onCancel, initial = null }) {
  const isEdit = !!initial
  const [form, setForm] = useState({ name: initial?.name || '', description: initial?.description || '', price: initial?.price || '', is_available_online: initial?.is_available_online ?? true, is_active: initial?.is_active ?? true, sort_order: initial?.sort_order ?? 100, is_featured: initial?.is_featured ?? false, badge_text: initial?.badge_text || 'Популярный', badge_color: initial?.badge_color || '#BFD900' })
  const ps = initial?.product_subscriptions?.[0]
  const [subForm, setSubForm] = useState({ sub_type: ps?.sub_type || 'unlimited', visits_count: ps?.visits_count || '', duration_days: ps?.duration_days || '', available_from_day: ps?.available_from_day || '', available_to_day: ps?.available_to_day || '' })
  const [selectedGroups, setSelectedGroups] = useState([])
  const [selectedTeachers, setSelectedTeachers] = useState([])
  const [showEmoji, setShowEmoji] = useState(false)

  useEffect(() => {
    if (isEdit && initial?.id && type === 'subscription') {
      const loadRelated = async () => {
        const { data: g } = await supabase.from('product_subscription_groups').select('group_id').eq('product_id', initial.id)
        setSelectedGroups((g||[]).map(x=>x.group_id))
        const { data: t } = await supabase.from('product_subscription_teachers').select('teacher_id').eq('product_id', initial.id)
        setSelectedTeachers((t||[]).map(x=>x.teacher_id))
      }
      loadRelated()
    }
  }, [])

  const toggleGroup = (id) => setSelectedGroups(p => p.includes(id) ? p.filter(g=>g!==id) : [...p,id])
  const toggleTeacher = (id) => setSelectedTeachers(p => p.includes(id) ? p.filter(t=>t!==id) : [...p,id])

  const handleSave = async () => {
    if (!form.name || !form.price) return
    const base = { ...form, price: parseInt(form.price), sort_order: parseInt(form.sort_order)||100 }
    if (isEdit) {
      await supabase.from('products').update(base).eq('id', initial.id)
      if (type === 'subscription') {
        await supabase.from('product_subscriptions').upsert({ product_id:initial.id, ...subForm, visits_count:subForm.visits_count?parseInt(subForm.visits_count):null, duration_days:subForm.duration_days?parseInt(subForm.duration_days):null }, { onConflict:'product_id' })
        await supabase.from('product_subscription_groups').delete().eq('product_id', initial.id)
        if (selectedGroups.length > 0) await supabase.from('product_subscription_groups').insert(selectedGroups.map(gid=>({product_id:initial.id,group_id:gid})))
        await supabase.from('product_subscription_teachers').delete().eq('product_id', initial.id)
        if (selectedTeachers.length > 0) await supabase.from('product_subscription_teachers').insert(selectedTeachers.map(tid=>({product_id:initial.id,teacher_id:tid})))
      }
    } else {
      const { data: product } = await supabase.from('products').insert({ ...base, type }).select().single()
      if (type === 'subscription') {
        await supabase.from('product_subscriptions').insert({ product_id:product.id, ...subForm, visits_count:subForm.visits_count?parseInt(subForm.visits_count):null, duration_days:subForm.duration_days?parseInt(subForm.duration_days):null })
        if (selectedGroups.length > 0) await supabase.from('product_subscription_groups').insert(selectedGroups.map(gid=>({product_id:product.id,group_id:gid})))
        if (selectedTeachers.length > 0) await supabase.from('product_subscription_teachers').insert(selectedTeachers.map(tid=>({product_id:product.id,teacher_id:tid})))
      }
    }
    onSave()
  }

  return (
    <div style={{background:'#fff', borderRadius:16, border:'2px solid #BFD900', padding:20, marginBottom:20}}>
      <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>{isEdit ? '✏️ Редактировать' : 'Новый'} {TAB_LABELS[type]}</div>
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
          <input value={form.sort_order} onChange={e => setForm({...form, sort_order:parseInt(e.target.value)||100})} type="number" min="1" max="999" placeholder="100" style={inputStyle} />
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
            <input value={form.badge_text} onChange={e => setForm({...form, badge_text:e.target.value})} placeholder="Популярный" style={{...inputStyle, marginBottom:0, flex:1}} />
            <div style={{position:'relative'}}>
              <button type="button" onClick={() => setShowEmoji(!showEmoji)} style={{padding:'8px 10px', background:'#f5f5f5', border:'1px solid #e0e0e0', borderRadius:8, fontSize:16, cursor:'pointer'}}>😊</button>
              {showEmoji && (
                <div style={{position:'absolute', top:'100%', right:0, zIndex:100, background:'#fff', border:'1px solid #e0e0e0', borderRadius:12, padding:10, width:260, display:'flex', flexWrap:'wrap', gap:4, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', marginTop:4}}>
                  {BADGE_EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => { setForm(f => ({...f, badge_text: f.badge_text + e})); setShowEmoji(false) }} style={{padding:'4px 6px', background:'none', border:'none', fontSize:18, cursor:'pointer', borderRadius:6}} onMouseEnter={ev => ev.currentTarget.style.background='#f5f5f5'} onMouseLeave={ev => ev.currentTarget.style.background='none'}>{e}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <label style={labelStyle}>Цвет плашки</label>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:8}}>
            {BADGE_COLORS.map(color => <div key={color} onClick={() => setForm({...form, badge_color:color})} style={{width:28, height:28, borderRadius:'50%', background:color, cursor:'pointer', border: form.badge_color === color ? '3px solid #2a2a2a' : '2px solid transparent'}} />)}
          </div>
          <div style={{fontSize:11, color:'#888', marginTop:4}}>Предпросмотр: <span style={{background:form.badge_color, color:textColor(form.badge_color), padding:'2px 10px', borderRadius:6, fontSize:11, fontWeight:700}}>{form.badge_text}</span></div>
        </div>
      )}
      {type === 'subscription' && (
        <div>
          <label style={labelStyle}>Тип абонемента</label>
          <select value={subForm.sub_type} onChange={e => setSubForm({...subForm, sub_type:e.target.value})} style={inputStyle}>{Object.entries(SUB_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
          {subForm.sub_type === 'count' && (<><label style={labelStyle}>Количество занятий</label><input value={subForm.visits_count} onChange={e => setSubForm({...subForm, visits_count:e.target.value})} placeholder="Например: 4" type="number" style={inputStyle} /></>)}
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
              {groups.map(g => <label key={g.id} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: selectedGroups.includes(g.id) ? '#fafde8' : '#f5f5f5', border: selectedGroups.includes(g.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}><input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />{g.name}</label>)}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={labelStyle}>Доступные преподаватели</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {teachers.map(t => <label key={t.id} style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background: selectedTeachers.includes(t.id) ? '#fafde8' : '#f5f5f5', border: selectedTeachers.includes(t.id) ? '1px solid #BFD900' : '1px solid #e0e0e0', borderRadius:8, fontSize:12, cursor:'pointer'}}><input type="checkbox" checked={selectedTeachers.includes(t.id)} onChange={() => toggleTeacher(t.id)} />{t.full_name || t.email}</label>)}
            </div>
          </div>
        </div>
      )}
      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button onClick={handleSave} style={{flex:1, padding:'9px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>{isEdit ? 'Сохранить изменения' : 'Создать'}</button>
        <button onClick={onCancel} style={{padding:'9px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Отмена</button>
      </div>
    </div>
  )
}

export default function AdminCatalog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'subscription'
  const setTab = (t) => {
    const next = new URLSearchParams(searchParams)
    if (t === 'subscription') next.delete('tab'); else next.set('tab', t)
    setSearchParams(next, { replace: true })
  }
  const [products, setProducts] = useState([])
  const [teachers, setTeachers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [session, setSession] = useState(null)

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)) }, [])
  useEffect(() => { loadAll() }, [tab])

  const loadAll = async () => {
    setLoading(true)
    if (tab !== 'indiv' && tab !== 'merch' && tab !== 'event') {
      const { data: p } = await supabase.from('products').select(`*, product_subscriptions(*)`).eq('type', tab).order('sort_order', { ascending: true })
      setProducts(p || [])
    }
    const { data: allStaff } = await supabase.from('profiles').select('id, full_name').in('role', ['teacher','owner','manager','admin'])
    const { data: teacherRoles } = await supabase.from('staff_roles').select('staff_id').eq('role', 'teacher')
    const teacherIds = new Set((teacherRoles || []).map(r => r.staff_id))
    setTeachers((allStaff || []).filter(p => teacherIds.has(p.id)))
    const { data: g } = await supabase.from('groups').select('id, name')
    setGroups(g || [])
    setLoading(false)
  }

  const handleArchive = async (id) => { if (!confirm('Архивировать продукт?')) return; await supabase.from('products').update({ is_active: false }).eq('id', id); loadAll() }
  const handleRestore = async (id) => { await supabase.from('products').update({ is_active: true }).eq('id', id); loadAll() }
  const handleEdit = (product) => { setEditingProduct(product); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const handleCloseForm = () => { setShowForm(false); setEditingProduct(null) }

  const formatPrice = (p) => p.toLocaleString('ru-RU') + ' ₽'
  const activeProducts = products.filter(p => p.is_active)
  const archivedProducts = products.filter(p => !p.is_active)

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Каталог</h1>
        {tab !== 'indiv' && tab !== 'merch' && tab !== 'event' && (
          <button onClick={() => { setShowForm(!showForm); setEditingProduct(null) }} style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>{showForm ? 'Закрыть' : '+ Добавить'}</button>
        )}
      </div>
      <div style={{display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #f0f0f0'}}>
        {TABS.map(t => (
          <div key={t} onClick={() => { setTab(t); setShowForm(false); setEditingProduct(null) }} style={{ padding:'10px 16px', fontSize:13, cursor:'pointer', color: tab === t ? '#2a2a2a' : '#BDBDBD', borderBottom: tab === t ? '2px solid #BFD900' : '2px solid transparent', fontWeight: tab === t ? 600 : 400, marginBottom:-1 }}>{TAB_LABELS[t]}</div>
        ))}
      </div>
      {tab === 'indiv' && <IndivTab teachers={teachers} />}
      {tab === 'merch' && session && <MerchTab session={session} />}
      {tab === 'event' && session && <EventTab teachers={teachers} session={session} />}
      {tab !== 'indiv' && tab !== 'merch' && tab !== 'event' && (
        <>
          {showForm && !editingProduct && <ProductForm type={tab} teachers={teachers} groups={groups} onSave={() => { setShowForm(false); loadAll() }} onCancel={handleCloseForm} />}
          {editingProduct && <ProductForm type={tab} teachers={teachers} groups={groups} initial={editingProduct} onSave={() => { setEditingProduct(null); loadAll() }} onCancel={handleCloseForm} />}
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
                      {p.is_featured && <span style={{background:p.badge_color||'#BFD900', color:textColor(p.badge_color||'#BFD900'), padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700}}>{p.badge_text || 'Популярный'}</span>}
                    </div>
                    <span style={{background: p.is_available_online ? '#fafde8' : '#f5f5f5', color: p.is_available_online ? '#6a7700' : '#BDBDBD', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600, flexShrink:0, marginLeft:8}}>{p.is_available_online ? '🌐' : 'Офлайн'}</span>
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
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
                    <div style={{fontSize:18, fontWeight:600, color:'#2a2a2a'}}>{formatPrice(p.price)}</div>
                    <div style={{display:'flex', gap:8}}>
                      <button onClick={() => handleEdit(p)} style={{fontSize:11, color:'#2980b9', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'Inter,sans-serif'}}>Изменить</button>
                      <button onClick={() => handleArchive(p.id)} style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'Inter,sans-serif'}}>В архив</button>
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
                </summary>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12, marginTop:12}}>
                  {archivedProducts.map(p => (
                    <div key={p.id} style={{background:'#f9f9f9', borderRadius:14, border:'1px solid #f0f0f0', padding:16, opacity:0.75}}>
                      <div style={{fontSize:14, fontWeight:600, color:'#888', marginBottom:4}}>{p.name}</div>
                      <div style={{fontSize:18, fontWeight:600, color:'#BDBDBD', marginBottom:10}}>{formatPrice(p.price)}</div>
                      <button onClick={() => handleRestore(p.id)} style={{fontSize:12, color:'#27ae60', background:'#eafaf1', border:'1px solid #a9dfbf', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>↩ Восстановить</button>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </>
      )}
    </div>
  )
}