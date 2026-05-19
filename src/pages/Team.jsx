import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import TeacherIndivDetail from '../components/TeacherIndivDetail'

export default function Team({ session }) {
  const [teachers, setTeachers] = useState([])
  const [selected, setSelected] = useState(() => localStorage.getItem('team_selected') || null)
  const [teacherData, setTeacherData] = useState(null)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  const goSelect = (id) => { setSelected(id); localStorage.setItem('team_selected', id || '') }

  useEffect(() => { loadTeachers() }, [])
  useEffect(() => {
    if (selected) loadTeacher(selected)
    else { setTeacherData(null); setGroups([]) }
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

  // Только то, что Team-страница рисует САМА (аватар + bio + список групп).
  // Всё, что про пакеты/слоты/заявки — общий компонент TeacherIndivDetail.
  const loadTeacher = async (id) => {
    setLoading(true)
    const { data: profile } = await supabase.from('profiles').select('id, full_name, first_name, last_name, avatar_url, bio').eq('id', id).single()
    setTeacherData(profile)
    const { data: grps } = await supabase.from('schedule').select('groups(name)').eq('teacher_id', id).not('group_id', 'is', null)
    setGroups([...new Set((grps || []).map(g => g.groups?.name).filter(Boolean))])
    setLoading(false)
  }

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
            <img loading="lazy" decoding="async" src={teacherData.avatar_url} alt="" style={{width:200, height:200, objectFit:'cover', borderRadius:16}} />
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

        <TeacherIndivDetail teacherId={selected} session={session} />
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
                <img loading="lazy" decoding="async" src={t.avatar_url} alt="" style={{width:'100%', height:160, objectFit:'cover'}} />
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
