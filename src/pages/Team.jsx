import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DAYS_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

export default function Team({ session }) {
  const [teachers, setTeachers] = useState([])
  const [selected, setSelected] = useState(() => localStorage.getItem('team_selected') || null)
  const [teacherData, setTeacherData] = useState(null)
  const [indivProducts, setIndivProducts] = useState([])
  const [slots, setSlots] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(() => localStorage.getItem('team_tab') || 'info')
  const [clientPackage, setClientPackage] = useState(null)
  const [bookingSlot, setBookingSlot] = useState(null)
  const [bookingDone, setBookingDone] = useState(null)
  const [bookingError, setBookingError] = useState('')
  const [saving, setSaving] = useState(false)

  const goSelect = (id) => { setSelected(id); localStorage.setItem('team_selected', id || ''); setBookingDone(null); setBookingError('') }
  const goTab = (t) => { setTab(t); localStorage.setItem('team_tab', t) }

  useEffect(() => { loadTeachers() }, [])
  useEffect(() => {
    if (selected) loadTeacher(selected)
    else setTeacherData(null)
  }, [selected])

  const loadTeachers = async () => {
    setLoading(true)
    const { data: teacherRoles } = await supabase.from('staff_roles').select('staff_id').eq('role', 'teacher')
    const teacherIds = (teacherRoles || []).map(r => r.staff_id)
    if (teacherIds.length === 0) { setTeachers([]); setLoading(false); return }
    const { data } = await supabase.from('profiles').select('id, full_name, first_name, last_name, avatar_url, bio').in('id', teacherIds).order('sort_order', { ascending: true })
    setTeachers(data || [])
    setLoading(false)
  }

  const loadTeacher = async (id) => {
    setLoading(true)
    const { data: profile } = await supabase.from('profiles').select('id, full_name, first_name, last_name, avatar_url, bio').eq('id', id).single()
    setTeacherData(profile)

    const { data: grps } = await supabase.from('schedule').select('groups(name)').eq('teacher_id', id).not('group_id', 'is', null)
    const uniqueGroups = [...new Set((grps || []).map(g => g.groups?.name).filter(Boolean))]
    setGroups(uniqueGroups)

    const { data: pkgs } = await supabase.from('indiv_packages').select('*').eq('teacher_id', id).eq('is_active', true).order('sort_order')
    setIndivProducts(pkgs || [])

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    const future = new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    const { data: sl } = await supabase
      .from('teacher_slot_dates')
      .select('*')
      .eq('teacher_id', id)
      .eq('is_active', true)
      .gte('date', today)
      .lte('date', future)
      .order('date')
      .order('start_time')
    setSlots(sl || [])

    if (session?.user?.id) {
      const { data: pkg } = await supabase
        .from('indiv_subscriptions')
        .select('id, visits_total, visits_used, expires_at')
        .eq('client_id', session.user.id)
        .eq('teacher_id', id)
        .eq('is_frozen', false)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      // Безлимит-пакет: visits_total = null. Не сравниваем — NaN-comparisons дают false.
      const isValid = pkg && (pkg.visits_total === null || pkg.visits_used < pkg.visits_total)
      setClientPackage(isValid ? pkg : null)
    }

    setLoading(false)
  }

  const handleBook = async (dateStr, slot) => {
    setBookingSlot(slot.id)
    setBookingError('')
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('indiv_requests')
        .select('id')
        .eq('client_id', session.user.id)
        .eq('teacher_id', selected)
        .eq('slot_date', dateStr)
        .eq('start_time', slot.start_time)
        .in('status', ['pending', 'confirmed'])
        .maybeSingle()

      if (existing) {
        setBookingError('Вы уже записаны на этот слот')
        setSaving(false)
        setBookingSlot(null)
        return
      }

      await supabase.from('indiv_requests').insert({
        client_id: session.user.id,
        teacher_id: selected,
        slot_date: dateStr,
        start_time: slot.start_time,
        end_time: slot.end_time,
        package_id: clientPackage?.id || null,
        status: 'pending',
        created_by: session.user.id,
      })

      const d = new Date(dateStr + 'T00:00:00')
      setBookingDone(`${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}, ${slot.start_time.slice(0,5)}–${slot.end_time.slice(0,5)}`)
    } catch {
      setBookingError('Ошибка при записи')
    }
    setSaving(false)
    setBookingSlot(null)
  }

  const slotsByDate = {}
  slots.forEach(s => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = []
    slotsByDate[s.date].push(s)
  })

  const initials = (t) => {
    const name = t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim()
    return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  }
  const getName = (t) => t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || '—'

  if (selected && teacherData) return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      <div style={{position:'relative', background:'#f0f0f0'}}>
        {teacherData.avatar_url ? (
          <div style={{display:'flex', justifyContent:'center', padding:'24px 20px 0', background:'#f8f8f8'}}>
            <img src={teacherData.avatar_url} alt="" style={{width:200, height:200, objectFit:'cover', borderRadius:16}} />
          </div>
        ) : (
          <div style={{width:'100%', height:200, background:'linear-gradient(135deg, #2a2a2a, #444)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{width:80, height:80, background:'#BFD900', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'#2a2a2a'}}>
              {initials(teacherData)}
            </div>
          </div>
        )}
        <div onClick={() => goSelect(null)}
          style={{position:'absolute', top:16, left:16, width:36, height:36, background:'rgba(0,0,0,0.45)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', fontSize:18}}>
          ←
        </div>
      </div>

      <div style={{padding:'16px 20px 0'}}>
        <div style={{fontSize:22, fontWeight:600, color:'#2a2a2a', marginBottom: teacherData.bio ? 8 : 16}}>{getName(teacherData)}</div>
        {teacherData.bio && <div style={{fontSize:13, color:'#888', lineHeight:1.6, marginBottom:16}}>{teacherData.bio}</div>}

        {groups.length > 0 && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Ведёт группы</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {groups.map(g => <span key={g} style={{fontSize:12, background:'#f5f5f5', color:'#2a2a2a', padding:'4px 12px', borderRadius:20}}>{g}</span>)}
            </div>
          </div>
        )}

        <div style={{display:'flex', borderBottom:'1px solid #f0f0f0', marginBottom:16}}>
          {[['info','О преподе'],['indiv','Пакеты'],['slots','Записаться']].map(([v,l]) => (
            <div key={v} onClick={() => goTab(v)}
              style={{padding:'10px 16px', fontSize:13, cursor:'pointer', color:tab===v?'#2a2a2a':'#BDBDBD', borderBottom:tab===v?'2px solid #BFD900':'2px solid transparent', fontWeight:tab===v?600:400}}>
              {l}
            </div>
          ))}
        </div>

        {tab === 'info' && (
          <div style={{paddingBottom:20}}>
            {groups.length === 0 && !teacherData.bio && (
              <div style={{fontSize:13, color:'#BDBDBD', textAlign:'center', padding:20}}>Нет информации</div>
            )}
          </div>
        )}

        {tab === 'indiv' && (
          <div style={{paddingBottom:20}}>
            {indivProducts.length === 0 ? (
              <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Индивы не настроены</div>
            ) : indivProducts.map(p => (
              <div key={p.id} style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:16, marginBottom:12}}>
                <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>{p.name}</div>
                <div style={{fontSize:11, color:'#BDBDBD', marginBottom:12}}>
                  {p.visits_count} {p.visits_count === 1 ? 'занятие' : p.visits_count < 5 ? 'занятия' : 'занятий'} · {p.duration_days} дней
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{fontSize:20, color:'#2a2a2a', fontWeight:300}}>{Number(p.price).toLocaleString('ru-RU')} <span style={{fontSize:12, color:'#BDBDBD'}}>₽</span></div>
                  <button onClick={() => alert('Оплата скоро будет доступна!')}
                    style={{background:'#BFD900', border:'none', borderRadius:12, padding:'9px 20px', fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                    Купить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'slots' && (
          <div style={{paddingBottom:20}}>
            {clientPackage ? (
              <div style={{background:'#eafaf1', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#27ae60'}}>
                ✓ Есть пакет · осталось {clientPackage.visits_total - clientPackage.visits_used} занятий
              </div>
            ) : (
              <div style={{background:'#fef9e7', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#f39c12'}}>
                Нет активного пакета — после записи нужно оплатить индив
              </div>
            )}

            {bookingDone && (
              <div style={{background:'#eafaf1', borderRadius:12, padding:16, marginBottom:16, textAlign:'center'}}>
                <div style={{fontSize:20, marginBottom:6}}>✅</div>
                <div style={{fontSize:14, fontWeight:600, color:'#27ae60', marginBottom:4}}>Запрос отправлен!</div>
                <div style={{fontSize:12, color:'#888'}}>{bookingDone}</div>
                <div style={{fontSize:12, color:'#888', marginTop:4}}>Администратор подтвердит запись и свяжется с вами</div>
                <button onClick={() => setBookingDone(null)}
                  style={{marginTop:12, background:'#BFD900', border:'none', borderRadius:10, padding:'8px 20px', fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Записаться ещё
                </button>
              </div>
            )}

            {bookingError && (
              <div style={{background:'#fdecea', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#e74c3c'}}>{bookingError}</div>
            )}

            {Object.keys(slotsByDate).length === 0 ? (
              <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Расписание не указано</div>
            ) : Object.entries(slotsByDate).map(([dateStr, daySlots]) => {
              const d = new Date(dateStr + 'T00:00:00')
              return (
                <div key={dateStr} style={{marginBottom:16}}>
                  <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>
                    {DAYS_SHORT[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()]}
                  </div>
                  {daySlots.map(s => (
                    <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', borderRadius:12, padding:'10px 14px', marginBottom:6, border:'1px solid #f0f0f0'}}>
                      <div style={{fontSize:13, color:'#2a2a2a'}}>{s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}</div>
                      <button
                        disabled={saving && bookingSlot === s.id}
                        onClick={() => handleBook(dateStr, s)}
                        style={{background:'#BFD900', border:'none', borderRadius:8, padding:'6px 16px', fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: saving && bookingSlot === s.id ? 0.5 : 1}}>
                        {saving && bookingSlot === s.id ? '...' : 'Записаться'}
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto', padding:'16px 20px 0'}}>
      <div style={{fontSize:22, fontWeight:600, color:'#2a2a2a', marginBottom:20}}>Команда</div>
      {loading ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
      ) : teachers.length === 0 ? (
        <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Преподаватели не найдены</div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          {teachers.map(t => (
            <div key={t.id} onClick={() => goSelect(t.id)}
              style={{background:'#fff', borderRadius:16, overflow:'hidden', border:'1px solid #f0f0f0', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              {t.avatar_url ? (
                <img src={t.avatar_url} alt="" style={{width:'100%', height:160, objectFit:'cover'}} />
              ) : (
                <div style={{width:'100%', height:160, background:'linear-gradient(135deg, #2a2a2a, #444)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <div style={{width:56, height:56, background:'#BFD900', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#2a2a2a'}}>
                    {initials(t)}
                  </div>
                </div>
              )}
              <div style={{padding:'10px 12px'}}>
                <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', lineHeight:1.3}}>{getName(t)}</div>
                {t.bio && <div style={{fontSize:11, color:'#BDBDBD', marginTop:3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>{t.bio}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}