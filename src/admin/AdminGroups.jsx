import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'

const GROUP_COLORS = [
  { bg:'#FFEBEE', border:'#D32F2F', text:'#B71C1C', label:'Красный' },
  { bg:'#FFF3E0', border:'#E64A19', text:'#BF360C', label:'Оранжевый' },
  { bg:'#FFFDE7', border:'#F9A825', text:'#F57F17', label:'Жёлтый' },
  { bg:'#E8F5E9', border:'#388E3C', text:'#1B5E20', label:'Зелёный' },
  { bg:'#F1F8E9', border:'#689F38', text:'#33691E', label:'Лаймовый' },
  { bg:'#E0F7FA', border:'#0097A7', text:'#006064', label:'Голубой' },
  { bg:'#E3F2FD', border:'#1976D2', text:'#0D47A1', label:'Синий' },
  { bg:'#E8EAF6', border:'#303F9F', text:'#1A237E', label:'Индиго' },
  { bg:'#EDE7F6', border:'#5E35B1', text:'#311B92', label:'Фиолетовый' },
  { bg:'#FCE4EC', border:'#C2185B', text:'#880E4F', label:'Розовый' },
]

const EVENT_TYPES = [
  { value:'masterclass', label:'Мастер-класс' },
  { value:'workshop', label:'Воркшоп' },
  { value:'camp', label:'Лагерь' },
  { value:'other', label:'Другое' },
]

const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
const labelStyle = { fontSize:12, color:'#888', marginBottom:6, fontWeight:600, display:'block' }
const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:12 }

export default function AdminGroups() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'groups'
  const setActiveTab = (t) => {
    setSearchParams({ tab: t }, { replace:true })
    setShowForm(false)
    setShowEventForm(false)
    resetForm()
    resetEventForm()
  }

  const [groups, setGroups] = useState([])
  const [events, setEvents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name:'', description:'', color:'', is_closed:false, teacher_id:'' })
  const [saving, setSaving] = useState(false)

  // Форма мероприятия
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEventId, setEditingEventId] = useState(null)
  const [eventForm, setEventForm] = useState({ name:'', type:'masterclass', description:'', color:'', price:'', teacher_id:'', hall:'', max_participants:'', allow_client_booking:true })
  const [savingEvent, setSavingEvent] = useState(false)

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    const editId = searchParams.get('editing')
    if (editId && groups.length > 0 && activeTab === 'groups') {
      const g = groups.find(g => g.id === editId)
      if (g) {
        setForm({ name:g.name, description:g.description||'', color:g.color||'', is_closed:g.is_closed||false, teacher_id:g.teacher_id||'' })
        setEditingId(g.id)
        setShowForm(true)
      }
    }
  }, [groups])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: groupsData }, { data: eventsData }, { data: profilesData }, { data: teacherRolesData }] = await Promise.all([
      supabase.from('groups').select('*, profiles:teacher_id(id, full_name)').order('name'),
      supabase.from('events').select('*, profiles:teacher_id(id, full_name)').order('name'),
      supabase.from('profiles').select('id, full_name').in('role', ['teacher','owner','manager','admin']).order('full_name'),
      supabase.from('staff_roles').select('staff_id').eq('role', 'teacher'),
    ])
    setGroups(groupsData || [])
    setEvents(eventsData || [])
    const teacherIds = new Set((teacherRolesData || []).map(r => r.staff_id))
    setTeachers((profilesData || []).filter(p => teacherIds.has(p.id)))
    setLoading(false)
  }

  const resetForm = () => {
    setForm({ name:'', description:'', color:'', is_closed:false, teacher_id:'' })
    setEditingId(null)
  }

  const resetEventForm = () => {
    setEventForm({ name:'', type:'masterclass', description:'', color:'', price:'', teacher_id:'', hall:'', max_participants:'', allow_client_booking:true })
    setEditingEventId(null)
  }

  const handleStartEdit = (g) => {
    setForm({ name:g.name, description:g.description||'', color:g.color||'', is_closed:g.is_closed||false, teacher_id:g.teacher_id||'' })
    setEditingId(g.id)
    setShowForm(true)
    const next = new URLSearchParams(searchParams)
    next.set('editing', g.id)
    setSearchParams(next, { replace:true })
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  const handleStartEditEvent = (e) => {
    setEventForm({
      name: e.name, type: e.type, description: e.description||'',
      color: e.color||'', price: e.price||'', teacher_id: e.teacher_id||'',
      hall: e.hall||'', max_participants: e.max_participants||'',
      allow_client_booking: e.allow_client_booking
    })
    setEditingEventId(e.id)
    setShowEventForm(true)
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color || null,
      is_closed: form.is_closed,
      teacher_id: form.teacher_id || null,
    }
    if (editingId) {
      const { error } = await supabase.from('groups').update(payload).eq('id', editingId)
      if (error) { alert('Ошибка: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('groups').insert(payload)
      if (error) { alert('Ошибка: ' + error.message); setSaving(false); return }
    }
    setSaving(false); setShowForm(false); resetForm(); loadAll()
  }

  const handleSaveEvent = async () => {
    if (!eventForm.name.trim()) return
    setSavingEvent(true)
    const payload = {
      name: eventForm.name.trim(),
      type: eventForm.type,
      description: eventForm.description.trim() || null,
      color: eventForm.color || null,
      price: eventForm.price ? parseFloat(eventForm.price) : null,
      teacher_id: eventForm.teacher_id || null,
      hall: eventForm.hall.trim() || null,
      max_participants: eventForm.max_participants ? parseInt(eventForm.max_participants) : null,
      allow_client_booking: eventForm.allow_client_booking,
      is_active: true,
    }
    if (editingEventId) {
      const { error } = await supabase.from('events').update(payload).eq('id', editingEventId)
      if (error) { alert('Ошибка: ' + error.message); setSavingEvent(false); return }
    } else {
      const { error } = await supabase.from('events').insert(payload)
      if (error) { alert('Ошибка: ' + error.message); setSavingEvent(false); return }
    }
    setSavingEvent(false); setShowEventForm(false); resetEventForm(); loadAll()
  }

  const handleDelete = async (g) => {
    if (!confirm(`Удалить группу "${g.name}"? Это может повлиять на расписание.`)) return
    const { error } = await supabase.from('groups').delete().eq('id', g.id)
    if (error) { alert('Ошибка: ' + error.message); return }
    loadAll()
  }

  const handleDeleteEvent = async (e) => {
    if (!confirm(`Удалить мероприятие "${e.name}"?`)) return
    const { error } = await supabase.from('events').update({ is_active: false }).eq('id', e.id)
    if (error) { alert('Ошибка: ' + error.message); return }
    loadAll()
  }

  const getColorStyle = (colorVal) => {
    const c = GROUP_COLORS.find(c => c.border === colorVal)
    return c || { bg:'#f5f5f5', border:'#BDBDBD', text:'#888' }
  }

  const colorPicker = (currentColor, onChange) => (
    <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:12, alignItems:'center'}}>
      {GROUP_COLORS.map(c => (
        <button key={c.border} onClick={() => onChange(currentColor === c.border ? '' : c.border)}
          title={c.label}
          style={{ width:28, height:28, borderRadius:'50%', cursor:'pointer', padding:0, background:c.bg,
            border: currentColor === c.border ? `3px solid ${c.border}` : `2px solid ${c.border}`,
            boxShadow: currentColor === c.border ? `0 0 0 2px ${c.border}` : 'none',
            transition:'all 0.15s', position:'relative' }}>
          {currentColor === c.border && (
            <span style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:12, color:c.text, fontWeight:700, lineHeight:1}}>✓</span>
          )}
        </button>
      ))}
      <button onClick={() => onChange('')} title="Без цвета"
        style={{width:28, height:28, borderRadius:'50%', cursor:'pointer', padding:0, background:'#f5f5f5', border: !currentColor ? '3px solid #BDBDBD' : '2px solid #e0e0e0', fontSize:11, color:'#BDBDBD', display:'flex', alignItems:'center', justifyContent:'center'}}>
        ✕
      </button>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>
          {activeTab === 'groups' ? 'Группы' : 'Мероприятия'}
        </h1>
        <button
          onClick={() => {
            if (activeTab === 'groups') { resetForm(); setShowForm(!showForm) }
            else { resetEventForm(); setShowEventForm(!showEventForm) }
          }}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          {activeTab === 'groups'
            ? (showForm && !editingId ? 'Закрыть' : '+ Добавить группу')
            : (showEventForm && !editingEventId ? 'Закрыть' : '+ Добавить мероприятие')}
        </button>
      </div>

      {/* Вкладки */}
      <div style={{display:'flex', gap:4, borderBottom:'1px solid #f0f0f0', marginBottom:20}}>
        {[['groups','Группы'],['events','Мероприятия']].map(([v,l]) => (
          <button key={v} onClick={() => setActiveTab(v)}
            style={{padding:'10px 20px', background:'transparent', border:'none',
              borderBottom: activeTab===v ? '2px solid #BFD900' : '2px solid transparent',
              fontSize:13, fontWeight: activeTab===v ? 600 : 400,
              color: activeTab===v ? '#2a2a2a' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ===== ВКЛАДКА ГРУППЫ ===== */}
      {activeTab === 'groups' && (
        <>
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
              <label style={labelStyle}>Основной преподаватель</label>
              <select value={form.teacher_id} onChange={e => setForm({...form, teacher_id:e.target.value})}
                style={{...inputStyle, marginBottom:12}}>
                <option value=''>— Не назначен —</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <label style={labelStyle}>Цвет в расписании</label>
              {colorPicker(form.color, (c) => setForm({...form, color:c}))}
              <label style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#2a2a2a', cursor:'pointer', marginBottom:16}}>
                <input type="checkbox" checked={form.is_closed} onChange={e => setForm({...form, is_closed:e.target.checked})} style={{width:16, height:16, cursor:'pointer'}} />
                <div>
                  <div style={{fontWeight:600}}>🔒 Закрытая группа</div>
                  <div style={{fontSize:11, color:'#888', marginTop:2}}>В кассе при продаже абонемента эта группа будет без галочки по умолчанию</div>
                </div>
              </label>
              <div style={{display:'flex', gap:8}}>
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  style={{flex:1, padding:'10px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity:(!form.name.trim()||saving)?0.5:1}}>
                  {saving ? 'Сохраняем...' : editingId ? 'Сохранить изменения' : 'Создать группу'}
                </button>
                <button onClick={() => { setShowForm(false); resetForm() }}
                  style={{padding:'10px 18px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {loading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
          : groups.length === 0 ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Групп нет — добавьте первую</div>
          : groups.map(g => {
            const colorStyle = getColorStyle(g.color)
            return (
              <div key={g.id} style={cardStyle}>
                <div style={{display:'flex', alignItems:'center', gap:14}}>
                  <div style={{width:44, height:44, borderRadius:10, flexShrink:0, background:colorStyle.bg, border:`2px solid ${colorStyle.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:colorStyle.text}}>
                    {g.name.match(/№([\d]+[А-Яа-яA-Za-z]*)/)?.[1] || g.name.match(/\d+[А-Яа-яA-Za-z]*/)?.[0] || g.name[0]}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                      <span style={{fontSize:15, fontWeight:600, color:'#2a2a2a'}}>{g.name}</span>
                      {g.is_closed && <span style={{background:'#fdecea', color:'#e74c3c', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>🔒 Закрытая</span>}
                    </div>
                    <div style={{display:'flex', gap:12, alignItems:'center'}}>
                      {g.description && <div style={{fontSize:12, color:'#888'}}>{g.description}</div>}
                      {g.profiles?.full_name && <div style={{fontSize:12, color:'#BDBDBD'}}>👤 {g.profiles.full_name}</div>}
                    </div>
                  </div>
                  <div style={{display:'flex', gap:8, flexShrink:0}}>
                    <button onClick={() => handleStartEdit(g)} style={{padding:'6px 14px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:12, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>Изменить</button>
                    <button onClick={() => handleDelete(g)} style={{padding:'6px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Удалить</button>
                  </div>
                </div>
              </div>
            )
          })}

          <div style={{background:'#f9f9f9', borderRadius:12, padding:14, marginTop:8}}>
            <div style={{fontSize:12, color:'#888', lineHeight:1.6}}>
              💡 <strong>Как это работает:</strong> Группы автоматически подтягиваются в Расписание и Каталог. Закрытые группы (🔒) в Кассе при продаже абонемента будут без галочки по умолчанию.
            </div>
          </div>
        </>
      )}

      {/* ===== ВКЛАДКА МЕРОПРИЯТИЯ ===== */}
      {activeTab === 'events' && (
        <>
          {showEventForm && (
            <div style={{...cardStyle, border:'1px solid #BFD900'}}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:16}}>
                {editingEventId ? 'Редактировать мероприятие' : 'Новое мероприятие'}
              </div>

              <label style={labelStyle}>Название *</label>
              <input value={eventForm.name} onChange={e => setEventForm({...eventForm, name:e.target.value})}
                placeholder="Например: Акрокурс май 2026" style={{...inputStyle, marginBottom:12}} />

              <label style={labelStyle}>Тип</label>
              <div style={{display:'flex', gap:6, marginBottom:12, flexWrap:'wrap'}}>
                {EVENT_TYPES.map(t => (
                  <button key={t.value} onClick={() => setEventForm({...eventForm, type:t.value})}
                    style={{padding:'7px 14px', borderRadius:8, border:'none', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif',
                      fontWeight: eventForm.type===t.value ? 700 : 400,
                      background: eventForm.type===t.value ? '#BFD900' : '#f5f5f5',
                      color: eventForm.type===t.value ? '#2a2a2a' : '#888'}}>
                    {t.label}
                  </button>
                ))}
              </div>

              <label style={labelStyle}>Описание</label>
              <input value={eventForm.description} onChange={e => setEventForm({...eventForm, description:e.target.value})}
                placeholder="Подробности..." style={{...inputStyle, marginBottom:12}} />

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                <div>
                  <label style={labelStyle}>Стоимость (₽)</label>
                  <input type="number" value={eventForm.price} onChange={e => setEventForm({...eventForm, price:e.target.value})}
                    placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Макс. участников</label>
                  <input type="number" value={eventForm.max_participants} onChange={e => setEventForm({...eventForm, max_participants:e.target.value})}
                    placeholder="Без ограничений" style={inputStyle} />
                </div>
              </div>

              <label style={labelStyle}>Ведущий преподаватель</label>
              <select value={eventForm.teacher_id} onChange={e => setEventForm({...eventForm, teacher_id:e.target.value})}
                style={{...inputStyle, marginBottom:12}}>
                <option value=''>— Не назначен —</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>

              <label style={labelStyle}>Зал</label>
              <select value={eventForm.hall} onChange={e => setEventForm({...eventForm, hall:e.target.value})}
                style={{...inputStyle, marginBottom:12}}>
                <option value=''>— Не выбран —</option>
                <option value='Большой зал'>Большой зал</option>
                <option value='Малый зал'>Малый зал</option>
              </select>

              <label style={labelStyle}>Цвет в расписании</label>
              {colorPicker(eventForm.color, (c) => setEventForm({...eventForm, color:c}))}

              <label style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#2a2a2a', cursor:'pointer', marginBottom:16}}>
                <input type="checkbox" checked={eventForm.allow_client_booking} onChange={e => setEventForm({...eventForm, allow_client_booking:e.target.checked})} style={{width:16, height:16, cursor:'pointer'}} />
                <div>
                  <div style={{fontWeight:600}}>Открыть запись для клиентов</div>
                  <div style={{fontSize:11, color:'#888', marginTop:2}}>Клиенты смогут записываться самостоятельно через приложение</div>
                </div>
              </label>

              <div style={{display:'flex', gap:8}}>
                <button onClick={handleSaveEvent} disabled={savingEvent || !eventForm.name.trim()}
                  style={{flex:1, padding:'10px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity:(!eventForm.name.trim()||savingEvent)?0.5:1}}>
                  {savingEvent ? 'Сохраняем...' : editingEventId ? 'Сохранить изменения' : 'Создать мероприятие'}
                </button>
                <button onClick={() => { setShowEventForm(false); resetEventForm() }}
                  style={{padding:'10px 18px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {loading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
          : events.length === 0 ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Мероприятий нет — добавьте первое</div>
          : events.map(e => {
            const colorStyle = getColorStyle(e.color)
            const typeLabel = EVENT_TYPES.find(t => t.value === e.type)?.label || 'Другое'
            return (
              <div key={e.id} style={cardStyle}>
                <div style={{display:'flex', alignItems:'center', gap:14}}>
                  <div style={{width:44, height:44, borderRadius:10, flexShrink:0, background:colorStyle.bg, border:`2px solid ${colorStyle.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:colorStyle.text}}>
                    {e.name[0]}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                      <span style={{fontSize:15, fontWeight:600, color:'#2a2a2a'}}>{e.name}</span>
                      <span style={{background:'#e8f4fd', color:'#2980b9', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>{typeLabel}</span>
                      {!e.allow_client_booking && <span style={{background:'#fdecea', color:'#e74c3c', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600}}>🔒 Запись закрыта</span>}
                    </div>
                    <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
                      {e.price && <div style={{fontSize:12, color:'#888'}}>{Number(e.price).toLocaleString('ru-RU')} ₽</div>}
                      {e.max_participants && <div style={{fontSize:12, color:'#888'}}>до {e.max_participants} чел.</div>}
                      {e.profiles?.full_name && <div style={{fontSize:12, color:'#BDBDBD'}}>👤 {e.profiles.full_name}</div>}
                      {e.hall && <div style={{fontSize:12, color:'#BDBDBD'}}>{e.hall}</div>}
                    </div>
                  </div>
                  <div style={{display:'flex', gap:8, flexShrink:0}}>
                    <button onClick={() => handleStartEditEvent(e)} style={{padding:'6px 14px', background:'#fafde8', border:'1px solid #BFD900', borderRadius:8, fontSize:12, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>Изменить</button>
                    <button onClick={() => handleDeleteEvent(e)} style={{padding:'6px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Удалить</button>
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}