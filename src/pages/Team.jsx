import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']

export default function Team({ session }) {
  const [teachers, setTeachers] = useState([])
  const [selected, setSelected] = useState(() => localStorage.getItem('team_selected') || null)
  const [teacherData, setTeacherData] = useState(null)
  const [indivProducts, setIndivProducts] = useState([])
  const [slots, setSlots] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(() => localStorage.getItem('team_tab') || 'info')

  const goSelect = (id) => { setSelected(id); localStorage.setItem('team_selected', id || '') }
  const goTab = (t) => { setTab(t); localStorage.setItem('team_tab', t) }

  useEffect(() => { loadTeachers() }, [])

  useEffect(() => {
    if (selected) loadTeacher(selected)
    else setTeacherData(null)
  }, [selected])

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

  const loadTeacher = async (id) => {
    setLoading(true)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, avatar_url, bio')
      .eq('id', id).single()
    setTeacherData(profile)

    // Группы которые ведёт
    const { data: grps } = await supabase
      .from('schedule')
      .select('groups(name)')
      .eq('teacher_id', id)
      .not('group_id', 'is', null)
    const uniqueGroups = [...new Set((grps || []).map(g => g.groups?.name).filter(Boolean))]
    setGroups(uniqueGroups)

    // Индив-продукты
    const { data: prods } = await supabase
      .from('products')
      .select('*, product_indivs(*)')
      .eq('type', 'indiv')
      .eq('is_active', true)
      .in('id', (await supabase.from('product_subscription_teachers').select('product_id').eq('teacher_id', id)).data?.map(r => r.product_id) || [])
    setIndivProducts(prods || [])

    // Слоты
    const { data: sl } = await supabase
      .from('teacher_indiv_slots')
      .select('*')
      .eq('teacher_id', id)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time')
    setSlots(sl || [])

    setLoading(false)
  }

  const initials = (t) => {
    const name = t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim()
    return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  }

  const getName = (t) => t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || '—'

  // ── Карточка препода ──────────────────────────────────────────────────────
  if (selected && teacherData) return (
    <div style={{fontFamily:'Inter,sans-serif', maxWidth:480, margin:'0 auto'}}>
      {/* Шапка */}
      <div style={{position:'relative'}}>
        {teacherData.avatar_url ? (
          <img src={teacherData.avatar_url} alt="" style={{width:'100%', height:260, objectFit:'cover'}} />
        ) : (
          <div style={{width:'100%', height:260, background:'linear-gradient(135deg, #2a2a2a, #444)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{width:80, height:80, background:'#BFD900', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'#2a2a2a'}}>
              {initials(teacherData)}
            </div>
          </div>
        )}
        <div onClick={() => { goSelect(null) }}
          style={{position:'absolute', top:16, left:16, width:36, height:36, background:'rgba(0,0,0,0.5)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', fontSize:18}}>
          ←
        </div>
      </div>

      {/* Имя */}
      <div style={{padding:'16px 20px 0'}}>
        <div style={{fontSize:22, fontWeight:600, color:'#2a2a2a', marginBottom: teacherData.bio ? 8 : 16}}>
          {getName(teacherData)}
        </div>
        {teacherData.bio && (
          <div style={{fontSize:13, color:'#888', lineHeight:1.6, marginBottom:16}}>{teacherData.bio}</div>
        )}

        {/* Группы */}
        {groups.length > 0 && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Ведёт группы</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {groups.map(g => (
                <span key={g} style={{fontSize:12, background:'#f5f5f5', color:'#2a2a2a', padding:'4px 12px', borderRadius:20}}>{g}</span>
              ))}
            </div>
          </div>
        )}

        {/* Табы */}
        <div style={{display:'flex', borderBottom:'1px solid #f0f0f0', marginBottom:16}}>
          {[['info','О преподе'],['indiv','Индивы'],['slots','Расписание']].map(([v,l]) => (
            <div key={v} onClick={() => goTab(v)}
              style={{padding:'10px 16px', fontSize:13, cursor:'pointer', color:tab===v?'#2a2a2a':'#BDBDBD', borderBottom:tab===v?'2px solid #BFD900':'2px solid transparent', fontWeight:tab===v?600:400}}>
              {l}
            </div>
          ))}
        </div>

        {/* Контент табов */}
        {tab === 'info' && (
          <div style={{paddingBottom:20}}>
            {groups.length === 0 && <div style={{fontSize:13, color:'#BDBDBD'}}>Нет информации</div>}
          </div>
        )}

        {tab === 'indiv' && (
          <div style={{paddingBottom:20}}>
            {indivProducts.length === 0 ? (
              <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Индивы не настроены</div>
            ) : indivProducts.map(p => (
              <div key={p.id} style={{background:'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:16, marginBottom:12}}>
                <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>{p.name}</div>
                {p.description && <div style={{fontSize:12, color:'#888', marginBottom:12, lineHeight:1.5}}>{p.description}</div>}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{fontSize:20, color:'#2a2a2a', fontWeight:300}}>
                    {Number(p.price).toLocaleString()} <span style={{fontSize:12, color:'#BDBDBD'}}>₽</span>
                  </div>
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
            {slots.length === 0 ? (
              <div style={{textAlign:'center', color:'#BDBDBD', padding:40, fontSize:13}}>Расписание не указано</div>
            ) : (
              <>
                {[1,2,3,4,5,6,0].map(day => {
                  const daySlots = slots.filter(s => s.day_of_week === day)
                  if (daySlots.length === 0) return null
                  return (
                    <div key={day} style={{marginBottom:12}}>
                      <div style={{fontSize:12, fontWeight:600, color:'#888', marginBottom:6}}>{DAYS[day]}</div>
                      {daySlots.map(s => (
                        <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', borderRadius:12, padding:'10px 14px', marginBottom:6, border:'1px solid #f0f0f0'}}>
                          <div style={{fontSize:13, color:'#2a2a2a'}}>
                            {s.start_time.slice(0,5)} — {s.end_time.slice(0,5)}
                          </div>
                          <button onClick={() => alert('Сначала оплатите индив!')}
                            style={{background:'#f5facc', border:'none', borderRadius:8, padding:'5px 14px', fontSize:12, fontWeight:600, color:'#6a7700', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                            Записаться
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // ── Список преподавателей ─────────────────────────────────────────────────
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