import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']

export default function AdminIndivs({ session }) {
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState([])
  const [indivProducts, setIndivProducts] = useState([])
  const [groups, setGroups] = useState([])
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [newSlot, setNewSlot] = useState({ day_of_week: 1, start_time: '10:00', end_time: '11:00' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadTeachers() }, [])
  useEffect(() => { if (selected) loadTeacherDetail(selected.id) }, [selected])

  const loadTeachers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, avatar_url, bio, role')
      .eq('role', 'teacher')
      .order('full_name')
    setTeachers(data || [])
    setLoading(false)
  }

  const loadTeacherDetail = async (id) => {
    const { data: grps } = await supabase
      .from('schedule')
      .select('groups(name)')
      .eq('teacher_id', id)
      .not('group_id', 'is', null)
    const uniqueGroups = [...new Set((grps || []).map(g => g.groups?.name).filter(Boolean))]
    setGroups(uniqueGroups)

    const { data: teacherProds } = await supabase
      .from('product_subscription_teachers')
      .select('product_id')
      .eq('teacher_id', id)
    const productIds = (teacherProds || []).map(r => r.product_id)
    if (productIds.length > 0) {
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('type', 'indiv')
        .eq('is_active', true)
        .in('id', productIds)
      setIndivProducts(prods || [])
    } else {
      setIndivProducts([])
    }

    const { data: sl } = await supabase
      .from('teacher_indiv_slots')
      .select('*')
      .eq('teacher_id', id)
      .order('day_of_week')
      .order('start_time')
    setSlots(sl || [])
  }

  const handleAddSlot = async () => {
    setSaving(true)
    await supabase.from('teacher_indiv_slots').insert({
      teacher_id: selected.id,
      day_of_week: Number(newSlot.day_of_week),
      start_time: newSlot.start_time,
      end_time: newSlot.end_time,
      is_active: true,
    })
    setShowAddSlot(false)
    setNewSlot({ day_of_week: 1, start_time: '10:00', end_time: '11:00' })
    loadTeacherDetail(selected.id)
    setSaving(false)
  }

  const handleDeleteSlot = async (id) => {
    if (!confirm('Удалить слот?')) return
    await supabase.from('teacher_indiv_slots').delete().eq('id', id)
    loadTeacherDetail(selected.id)
  }

  const handleToggleSlot = async (slot) => {
    await supabase.from('teacher_indiv_slots').update({ is_active: !slot.is_active }).eq('id', slot.id)
    loadTeacherDetail(selected.id)
  }

  const getName = (t) => t?.full_name || `${t?.first_name || ''} ${t?.last_name || ''}`.trim() || '—'

  const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }

  if (selected) return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:24}}>
        <button onClick={() => setSelected(null)}
          style={{padding:'8px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          ← Назад
        </button>
        <div>
          <h1 style={{fontSize:22, fontWeight:600, color:'#1f2024', margin:0}}>{getName(selected)}</h1>
          <div style={{fontSize:12, color:'#888', marginTop:2}}>Индивы и расписание</div>
        </div>
        <button onClick={() => navigate(`/admin/staff/${selected.id}`)}
          style={{marginLeft:'auto', padding:'8px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, color:'#2980b9', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          Карточка сотрудника →
        </button>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start'}}>
        {/* Пакеты индивов */}
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
          <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:16}}>📦 Пакеты индивов</div>
          {indivProducts.length === 0 ? (
            <div style={{fontSize:13, color:'#BDBDBD', marginBottom:12}}>Пакеты не настроены</div>
          ) : indivProducts.map(p => (
            <div key={p.id} style={{padding:'10px 0', borderBottom:'1px solid #f8f8f8'}}>
              <div style={{fontSize:13, fontWeight:500, color:'#2a2a2a'}}>{p.name}</div>
              <div style={{fontSize:12, color:'#BDBDBD', marginTop:2}}>{Number(p.price).toLocaleString()} ₽</div>
            </div>
          ))}
          <button onClick={() => navigate('/admin/catalog')}
            style={{marginTop:12, fontSize:12, color:'#2980b9', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            Настроить в каталоге →
          </button>
        </div>

        {/* Расписание слотов */}
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
            <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>📅 Расписание</div>
            <button onClick={() => setShowAddSlot(true)}
              style={{padding:'6px 14px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              + Слот
            </button>
          </div>

          {showAddSlot && (
            <div style={{background:'#f9f9f9', borderRadius:10, padding:14, marginBottom:16}}>
              <div style={{fontSize:12, color:'#888', marginBottom:8, fontWeight:600}}>Новый слот</div>
              <div style={{marginBottom:8}}>
                <select value={newSlot.day_of_week} onChange={e => setNewSlot({...newSlot, day_of_week: e.target.value})} style={inputStyle}>
                  {[1,2,3,4,5,6,0].map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
                </select>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10}}>
                <input type="time" value={newSlot.start_time} onChange={e => setNewSlot({...newSlot, start_time: e.target.value})} style={inputStyle} />
                <input type="time" value={newSlot.end_time} onChange={e => setNewSlot({...newSlot, end_time: e.target.value})} style={inputStyle} />
              </div>
              <div style={{display:'flex', gap:8}}>
                <button onClick={handleAddSlot} disabled={saving}
                  style={{flex:1, padding:'8px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  {saving ? 'Сохраняем...' : 'Добавить'}
                </button>
                <button onClick={() => setShowAddSlot(false)}
                  style={{padding:'8px 12px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {slots.length === 0 ? (
            <div style={{fontSize:13, color:'#BDBDBD'}}>Слотов нет</div>
          ) : [1,2,3,4,5,6,0].map(day => {
            const daySlots = slots.filter(s => s.day_of_week === day)
            if (daySlots.length === 0) return null
            return (
              <div key={day} style={{marginBottom:12}}>
                <div style={{fontSize:11, fontWeight:600, color:'#888', marginBottom:6}}>{DAYS[day]}</div>
                {daySlots.map(s => (
                  <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background: s.is_active ? '#f9f9f9' : '#fff', borderRadius:8, marginBottom:4, border:'1px solid #f0f0f0', opacity: s.is_active ? 1 : 0.5}}>
                    <div style={{fontSize:13, color:'#2a2a2a'}}>{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</div>
                    <div style={{display:'flex', gap:8}}>
                      <button onClick={() => handleToggleSlot(s)}
                        style={{fontSize:11, color: s.is_active ? '#27ae60' : '#888', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                        {s.is_active ? '✓ Активен' : 'Выкл'}
                      </button>
                      <button onClick={() => handleDeleteSlot(s.id)}
                        style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', marginBottom:24}}>Индивы</h1>
      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : teachers.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:60, background:'#fff', borderRadius:14}}>
          Преподавателей нет — добавь сотрудников с ролью teacher
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16}}>
          {teachers.map(t => (
            <div key={t.id} onClick={() => setSelected(t)}
              style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
                {t.avatar_url ? (
                  <img src={t.avatar_url} alt="" style={{width:44, height:44, borderRadius:'50%', objectFit:'cover'}} />
                ) : (
                  <div style={{width:44, height:44, background:'#BFD900', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#2a2a2a'}}>
                    {getName(t)[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>{getName(t)}</div>
                  <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>Преподаватель</div>
                </div>
              </div>
              <button style={{width:'100%', padding:'8px', background:'#f5f5f5', border:'none', borderRadius:8, fontSize:12, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                Управлять индивами →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}