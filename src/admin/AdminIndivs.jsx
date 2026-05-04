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
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [newSlot, setNewSlot] = useState({ day_of_week: 1, start_time: '10:00', end_time: '18:00', duration: 60 })
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
    const { data: teacherProds } = await supabase
      .from('product_subscription_teachers')
      .select('product_id')
      .eq('teacher_id', id)
    const productIds = (teacherProds || []).map(r => r.product_id)
    if (productIds.length > 0) {
      const { data: prods } = await supabase
        .from('products').select('*').eq('type', 'indiv').eq('is_active', true).in('id', productIds)
      setIndivProducts(prods || [])
    } else {
      setIndivProducts([])
    }

    const { data: sl } = await supabase
      .from('teacher_indiv_slots').select('*').eq('teacher_id', id)
      .order('day_of_week').order('start_time')
    setSlots(sl || [])
  }

  const getSlotPreview = () => {
    const [sh, sm] = newSlot.start_time.split(':').map(Number)
    const [eh, em] = newSlot.end_time.split(':').map(Number)
    const dur = newSlot.duration || 60
    let cur = sh * 60 + sm
    const end = eh * 60 + em
    const preview = []
    while (cur + dur <= end) {
      const s = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`
      const e = `${String(Math.floor((cur+dur)/60)).padStart(2,'0')}:${String((cur+dur)%60).padStart(2,'0')}`
      preview.push(`${s} — ${e}`)
      cur += dur
    }
    return preview
  }

  const handleAddSlot = async () => {
    setSaving(true)
    const [sh, sm] = newSlot.start_time.split(':').map(Number)
    const [eh, em] = newSlot.end_time.split(':').map(Number)
    const dur = newSlot.duration || 60
    let cur = sh * 60 + sm
    const end = eh * 60 + em
    const inserts = []
    while (cur + dur <= end) {
      const s = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`
      const e = `${String(Math.floor((cur+dur)/60)).padStart(2,'0')}:${String((cur+dur)%60).padStart(2,'0')}`
      inserts.push({ teacher_id: selected.id, day_of_week: Number(newSlot.day_of_week), start_time: s, end_time: e, is_active: true })
      cur += dur
    }
    if (inserts.length > 0) await supabase.from('teacher_indiv_slots').insert(inserts)
    setShowAddSlot(false)
    setNewSlot({ day_of_week: 1, start_time: '10:00', end_time: '18:00', duration: 60 })
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
        {/* Пакеты */}
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

        {/* Слоты */}
        <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
            <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>📅 Расписание слотов</div>
            <button onClick={() => setShowAddSlot(!showAddSlot)}
              style={{padding:'6px 14px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              + Слоты
            </button>
          </div>

          {showAddSlot && (
            <div style={{background:'#f9f9f9', borderRadius:12, padding:16, marginBottom:16}}>
              <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:12}}>Новые слоты</div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:11, color:'#888', marginBottom:6}}>День недели</div>
                <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
                  {[1,2,3,4,5,6,0].map(d => (
                    <button key={d} onClick={() => setNewSlot({...newSlot, day_of_week: d})}
                      style={{padding:'6px 10px', borderRadius:8, border:'none', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif',
                        fontWeight:Number(newSlot.day_of_week)===d?700:400,
                        background:Number(newSlot.day_of_week)===d?'#BFD900':'#fff',
                        color:Number(newSlot.day_of_week)===d?'#2a2a2a':'#888'}}>
                      {DAYS[d]}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12}}>
                <div>
                  <div style={{fontSize:11, color:'#888', marginBottom:4}}>С</div>
                  <input type="time" value={newSlot.start_time} onChange={e => setNewSlot({...newSlot, start_time:e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <div style={{fontSize:11, color:'#888', marginBottom:4}}>До</div>
                  <input type="time" value={newSlot.end_time} onChange={e => setNewSlot({...newSlot, end_time:e.target.value})} style={inputStyle} />
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:11, color:'#888', marginBottom:6}}>Длительность слота</div>
                <div style={{display:'flex', gap:6}}>
                  {[30,45,60,90].map(m => (
                    <button key={m} onClick={() => setNewSlot({...newSlot, duration: m})}
                      style={{flex:1, padding:'6px 0', borderRadius:8, border:'none', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif',
                        fontWeight:newSlot.duration===m?700:400,
                        background:newSlot.duration===m?'#BFD900':'#fff',
                        color:newSlot.duration===m?'#2a2a2a':'#888'}}>
                      {m} мин
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const preview = getSlotPreview()
                if (preview.length === 0) return null
                return (
                  <div style={{background:'#fff', borderRadius:8, padding:10, marginBottom:12}}>
                    <div style={{fontSize:11, color:'#888', marginBottom:6}}>
                      Будет создано {preview.length} слот{preview.length===1?'':preview.length<5?'а':'ов'}:
                    </div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
                      {preview.map(p => (
                        <span key={p} style={{fontSize:11, background:'#f5f5f5', borderRadius:6, padding:'3px 8px', color:'#2a2a2a'}}>{p}</span>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div style={{display:'flex', gap:8}}>
                <button onClick={handleAddSlot} disabled={saving || getSlotPreview().length === 0}
                  style={{flex:1, padding:'9px', background:'#BFD900', border:'none', borderRadius:8, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: saving ? 0.5 : 1}}>
                  {saving ? 'Создаём...' : `Создать слоты`}
                </button>
                <button onClick={() => setShowAddSlot(false)}
                  style={{padding:'9px 12px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
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
                  <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background: s.is_active?'#f9f9f9':'#fff', borderRadius:8, marginBottom:4, border:'1px solid #f0f0f0', opacity:s.is_active?1:0.5}}>
                    <div style={{fontSize:13, color:'#2a2a2a'}}>{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</div>
                    <div style={{display:'flex', gap:8}}>
                      <button onClick={() => handleToggleSlot(s)}
                        style={{fontSize:11, color:s.is_active?'#27ae60':'#888', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                        {s.is_active?'✓ Вкл':'Выкл'}
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