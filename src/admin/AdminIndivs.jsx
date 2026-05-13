import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'

const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']

const STATUS_LABELS = {
  pending:   { label: 'Ожидает',     color: '#f39c12', bg: '#fef9e7' },
  confirmed: { label: 'Подтверждён', color: '#27ae60', bg: '#eafaf1' },
  rejected:  { label: 'Отклонён',    color: '#888',    bg: '#f5f5f5' },
  cancelled: { label: 'Отменён',     color: '#e74c3c', bg: '#fdecea' },
}

function SlotsAndPackages({ session }) {
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

// ─── Журнал индивов ─────────────────────────────────────────────────────────
function IndivsJournal() {
  const [requests, setRequests] = useState([])
  const [teachersList, setTeachersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [limit, setLimit] = useState(100)

  // Преподавателей грузим один раз — для дропдауна фильтра.
  useEffect(() => {
    supabase.from('staff_roles').select('staff_id').eq('role', 'teacher')
      .then(async ({ data }) => {
        const ids = (data || []).map(r => r.staff_id)
        if (ids.length === 0) { setTeachersList([]); return }
        const { data: profs } = await supabase.from('profiles')
          .select('id, full_name').in('id', ids).order('full_name')
        setTeachersList(profs || [])
      })
  }, [])

  useEffect(() => { load() }, [teacherFilter, statusFilter, fromDate, toDate, limit])

  const load = async () => {
    setLoading(true)
    let q = supabase.from('indiv_requests')
      .select(`id, slot_date, start_time, end_time, hall, status, created_at,
        client:profiles!indiv_requests_client_id_fkey(id, full_name, phone),
        teacher:profiles!indiv_requests_teacher_id_fkey(id, full_name),
        package:indiv_packages(id, name)`)
      .order('slot_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(limit)
    if (teacherFilter !== 'all') q = q.eq('teacher_id', teacherFilter)
    if (statusFilter !== 'all')  q = q.eq('status', statusFilter)
    if (fromDate) q = q.gte('slot_date', fromDate)
    if (toDate)   q = q.lte('slot_date', toDate)
    const { data } = await q
    setRequests(data || [])
    setLoading(false)
  }

  const resetFilters = () => {
    setTeacherFilter('all'); setStatusFilter('all'); setFromDate(''); setToDate(''); setLimit(100)
  }

  const inputStyle = { padding:'8px 10px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, fontFamily:'Inter,sans-serif', boxSizing:'border-box' }
  const chipStyle = (active, color = '#BFD900') => ({
    padding:'6px 12px', borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif',
    border: active ? 'none' : '1px solid #e8e8e8',
    background: active ? color : '#fff',
    color: active ? '#2a2a2a' : '#888',
    fontWeight: active ? 600 : 400,
  })
  const fmtDate = (d) => {
    const dt = new Date(d + 'T00:00:00')
    return `${DAYS[dt.getDay()]}, ${dt.toLocaleDateString('ru-RU', { day:'numeric', month:'short' })}`
  }
  const filtersActive = teacherFilter !== 'all' || statusFilter !== 'all' || fromDate || toDate

  return (
    <div>
      {/* Фильтры */}
      <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:16, marginBottom:16}}>
        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12, marginBottom:12}}>
          <div>
            <div style={{fontSize:11, color:'#888', marginBottom:4, fontWeight:600}}>Преподаватель</div>
            <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} style={{...inputStyle, width:'100%'}}>
              <option value="all">Все преподаватели</option>
              {teachersList.map(t => <option key={t.id} value={t.id}>{t.full_name || '—'}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11, color:'#888', marginBottom:4, fontWeight:600}}>Дата с</div>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{...inputStyle, width:'100%'}} />
          </div>
          <div>
            <div style={{fontSize:11, color:'#888', marginBottom:4, fontWeight:600}}>Дата по</div>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{...inputStyle, width:'100%'}} />
          </div>
        </div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
          <span style={{fontSize:11, color:'#888', marginRight:4, fontWeight:600}}>Статус:</span>
          <button onClick={() => setStatusFilter('all')} style={chipStyle(statusFilter === 'all')}>Все</button>
          {Object.entries(STATUS_LABELS).map(([v, s]) => (
            <button key={v} onClick={() => setStatusFilter(v)} style={chipStyle(statusFilter === v, s.bg)}>{s.label}</button>
          ))}
          {filtersActive && (
            <button onClick={resetFilters}
              style={{marginLeft:'auto', padding:'6px 12px', background:'transparent', border:'1px solid #e8e8e8', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Список заявок */}
      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : requests.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>
          Ничего не нашлось
        </div>
      ) : (
        <>
          <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', overflow:'hidden'}}>
            {/* Заголовок таблицы */}
            <div style={{display:'grid', gridTemplateColumns:'1.4fr 1.2fr 1.2fr 0.9fr 0.9fr 1fr', gap:12, padding:'10px 16px', background:'#f9f9f9', fontSize:11, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em'}}>
              <div>Клиент</div>
              <div>Препод</div>
              <div>Дата · время</div>
              <div>Зал</div>
              <div>Статус</div>
              <div>Пакет</div>
            </div>
            {requests.map(r => {
              const st = STATUS_LABELS[r.status] || { label: r.status, color: '#888', bg: '#f5f5f5' }
              return (
                <div key={r.id} style={{display:'grid', gridTemplateColumns:'1.4fr 1.2fr 1.2fr 0.9fr 0.9fr 1fr', gap:12, padding:'12px 16px', borderTop:'1px solid #f5f5f5', alignItems:'center', fontSize:13}}>
                  <div>
                    <div style={{color:'#2a2a2a', fontWeight:500}}>{r.client?.full_name || '—'}</div>
                    {r.client?.phone && <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>{r.client.phone}</div>}
                  </div>
                  <div style={{color:'#2a2a2a'}}>{r.teacher?.full_name || '—'}</div>
                  <div style={{color:'#2a2a2a'}}>
                    <div>{fmtDate(r.slot_date)}</div>
                    <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>{r.start_time?.slice(0,5)}—{r.end_time?.slice(0,5)}</div>
                  </div>
                  <div style={{color: r.hall ? '#2a2a2a' : '#BDBDBD'}}>{r.hall || '—'}</div>
                  <div>
                    <span style={{fontSize:11, fontWeight:600, color:st.color, background:st.bg, padding:'3px 8px', borderRadius:6}}>{st.label}</span>
                  </div>
                  <div style={{color: r.package?.name ? '#27ae60' : '#e74c3c', fontSize:12}}>
                    {r.package?.name ? `✓ ${r.package.name}` : '✕ Нет'}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Пагинация */}
          {requests.length === limit && (
            <div style={{textAlign:'center', marginTop:12}}>
              <button onClick={() => setLimit(l => l + 100)}
                style={{padding:'9px 20px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                Показать ещё 100
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Wrapper с табами ───────────────────────────────────────────────────────
export default function AdminIndivs({ session }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'slots'
  const setTab = (t) => {
    const next = new URLSearchParams(searchParams)
    if (t === 'slots') next.delete('tab'); else next.set('tab', t)
    setSearchParams(next, { replace: true })
  }

  const tabs = [
    { id: 'slots',   label: 'Слоты и пакеты' },
    { id: 'journal', label: 'Журнал' },
  ]

  return (
    <div>
      <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:'0 0 20px 0'}}>Индивы</h1>
      <div style={{display:'flex', gap:4, borderBottom:'1px solid #f0f0f0', marginBottom:20}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{padding:'10px 16px', background:'transparent', border:'none', borderBottom: tab === t.id ? '2px solid #BFD900' : '2px solid transparent', fontSize:13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? '#2a2a2a' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'slots'   && <SlotsAndPackages session={session} />}
      {tab === 'journal' && <IndivsJournal />}
    </div>
  )
}