import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif', marginBottom:8 }
const lblS = { fontSize:11, color:'#888', marginBottom:4, fontWeight:600, display:'block' }
const inpS = { width:'100%', padding:'8px 10px', border:'1px solid #e8e8e8', borderRadius:8, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }

const STATUS = {
  pending:   { label:'Ожидает',  color:'#f39c12', bg:'#fef9e7' },
  completed: { label:'Выдан',    color:'#27ae60', bg:'#eafaf1' },
  cancelled: { label:'Отменён',  color:'#888',    bg:'#f5f5f5' },
}

const BADGE_OPTIONS = [
  { text:'🔥 Горячее', color:'#e74c3c' },
  { text:'🆕 Новинка', color:'#2980b9' },
  { text:'💎 Редкое',  color:'#8e44ad' },
  { text:'⭐ Топ',     color:'#f39c12' },
]

async function uploadPrizeImage(file, productId) {
  const ext = file.name.split('.').pop()
  const path = `${productId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('prizes').upload(path, file)
  if (error) return null
  const { data } = supabase.storage.from('prizes').getPublicUrl(path)
  return data.publicUrl
}

export default function AdminPrizes({ session }) {
  const [tab, setTab] = useState('catalog')
  const [prizes, setPrizes] = useState([])
  const [archived, setArchived] = useState([])
  const [requests, setRequests] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingPrize, setEditingPrize] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const fileRef = useRef()
  const editFileRef = useRef()

  const emptyForm = { name:'', description:'', coins_price:'', stock_count:'', sort_order:100, badge_text:'', badge_color:'#f39c12', is_active:true }
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editImageFile, setEditImageFile] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState(null)

  // Модалка карточки клиента
  const [clientModal, setClientModal] = useState(null)
  const [clientProfile, setClientProfile] = useState(null)
  const [clientHistory, setClientHistory] = useState([])
  const [coinAmount, setCoinAmount] = useState('')
  const [coinReason, setCoinReason] = useState('')
  const [coinSaving, setCoinSaving] = useState(false)

  useEffect(() => { load() }, [tab])

  const load = async () => {
    setLoading(true)
    if (tab === 'catalog') {
      const { data } = await supabase.from('prizes').select('*').order('sort_order')
      setPrizes((data||[]).filter(p => p.is_active))
      setArchived((data||[]).filter(p => !p.is_active))
    }
    if (tab === 'requests') {
      const { data } = await supabase
        .from('prize_requests')
        .select('*, prize:prizes(name, image_url, coins_price), client:profiles!prize_requests_client_id_fkey(id, full_name, bonus_coins)')
        .order('created_at', { ascending: false })
      setRequests(data || [])
    }
    // Счётчик pending всегда
    const { count } = await supabase.from('prize_requests').select('*', { count:'exact', head:true }).eq('status','pending')
    setPendingCount(count || 0)
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.coins_price) return
    setSaving(true)
    const { data: prize } = await supabase.from('prizes').insert({
      name: form.name.trim(),
      description: form.description || null,
      coins_price: parseInt(form.coins_price),
      stock_count: parseInt(form.stock_count) || 0,
      sort_order: parseInt(form.sort_order) || 100,
      badge_text: form.badge_text || null,
      badge_color: form.badge_color || null,
      is_active: true,
      created_by: session.user.id,
    }).select().single()
    if (prize && imageFile) {
      const url = await uploadPrizeImage(imageFile, prize.id)
      if (url) await supabase.from('prizes').update({ image_url: url }).eq('id', prize.id)
    }
    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    setImageFile(null); setImagePreview(null)
    load()
  }

  const handleUpdate = async (id) => {
    if (!editForm?.name?.trim()) return
    setSaving(true)
    let imageUrl = editForm.image_url
    if (editImageFile) {
      const url = await uploadPrizeImage(editImageFile, id)
      if (url) imageUrl = url
    }
    await supabase.from('prizes').update({
      name: editForm.name.trim(),
      description: editForm.description || null,
      coins_price: parseInt(editForm.coins_price),
      stock_count: parseInt(editForm.stock_count) || 0,
      sort_order: parseInt(editForm.sort_order) || 100,
      badge_text: editForm.badge_text || null,
      badge_color: editForm.badge_color || null,
      image_url: imageUrl || null,
    }).eq('id', id)
    setSaving(false)
    setEditingPrize(null); setEditForm(null)
    setEditImageFile(null); setEditImagePreview(null)
    load()
  }

  const handleArchive = async (id) => {
    if (!confirm('Архивировать приз?')) return
    await supabase.from('prizes').update({ is_active: false }).eq('id', id)
    load()
  }

  const handleRestore = async (id) => {
    await supabase.from('prizes').update({ is_active: true }).eq('id', id)
    load()
  }

  const handleComplete = async (req) => {
    if (!confirm(`Отметить приз «${req.prize?.name}» как выданный? Остаток уменьшится на 1.`)) return
    await supabase.from('prize_requests').update({ status:'completed', handled_by: session.user.id, handled_at: new Date().toISOString() }).eq('id', req.id)
    await supabase.from('prizes').update({ stock_count: Math.max(0, (req.prize_stock||0) - 1) }).eq('id', req.prize_id)
    // Обновим stock через отдельный запрос
    const { data: prize } = await supabase.from('prizes').select('stock_count').eq('id', req.prize_id).single()
    if (prize) await supabase.from('prizes').update({ stock_count: Math.max(0, prize.stock_count - 1) }).eq('id', req.prize_id)
    load()
  }

  const handleCancel = async (id) => {
    if (!confirm('Отменить заявку?')) return
    await supabase.from('prize_requests').update({ status:'cancelled', handled_by: session.user.id, handled_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const openClientModal = async (clientId) => {
    setClientModal(clientId)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', clientId).single()
    setClientProfile(prof)
    const { data: hist } = await supabase.from('bonus_history').select('*').eq('student_id', clientId).order('created_at', { ascending: false }).limit(10)
    setClientHistory(hist || [])
  }

  const handleCoinOperation = async (operation) => {
    if (!coinAmount || !coinReason.trim()) return
    setCoinSaving(true)
    const amount = parseInt(coinAmount)
    const delta = operation === 'credit' ? amount : -amount
    await supabase.from('profiles').update({ bonus_coins: Math.max(0, (clientProfile.bonus_coins || 0) + delta) }).eq('id', clientModal)
    await supabase.from('bonus_history').insert({
      student_id: clientModal,
      type: 'coins',
      amount: delta,
      reason: coinReason,
      operation,
      client_reason: 'manual_' + operation,
    })
    setCoinAmount(''); setCoinReason('')
    setCoinSaving(false)
    // Обновляем профиль
    const { data: updated } = await supabase.from('profiles').select('*').eq('id', clientModal).single()
    setClientProfile(updated)
    const { data: hist } = await supabase.from('bonus_history').select('*').eq('student_id', clientModal).order('created_at', { ascending: false }).limit(10)
    setClientHistory(hist || [])
    load()
  }

  const PrizeForm = ({ isEdit, onSave, onCancel }) => {
    const f = isEdit ? editForm : form
    const setF = isEdit ? setEditForm : setForm
    const ref = isEdit ? editFileRef : fileRef
    const preview = isEdit ? editImagePreview : imagePreview
    const setFile = isEdit ? setEditImageFile : setImageFile
    const setPreview = isEdit ? setEditImagePreview : setImagePreview

    return (
      <div style={{background:'#fff', borderRadius:14, border:'1.5px solid #BFD900', padding:20, marginBottom:16}}>
        <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>
          {isEdit ? '✏️ Редактировать приз' : 'Новый приз'}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:10, marginBottom:10}}>
          <div><label style={lblS}>Название *</label><input value={f.name} onChange={e => setF({...f, name:e.target.value})} placeholder="Брелок SDT" style={inpS} /></div>
          <div><label style={lblS}>Цена (SDTшки) *</label><input type="number" min="1" value={f.coins_price} onChange={e => setF({...f, coins_price:e.target.value})} placeholder="10" style={inpS} /></div>
        </div>

        <label style={lblS}>Описание</label>
        <textarea value={f.description||''} onChange={e => setF({...f, description:e.target.value})} rows={2} placeholder="Описание приза..." style={{...inpS, marginBottom:10, resize:'vertical'}} />

        <label style={lblS}>Фото</label>
        <div onClick={() => ref.current?.click()} style={{border:'1.5px dashed #e0e0e0', borderRadius:10, padding:14, textAlign:'center', cursor:'pointer', marginBottom:10, background:'#fafafa'}}>
          {preview ? <img src={preview} alt="" style={{maxHeight:100, maxWidth:'100%', borderRadius:8, objectFit:'contain'}} /> : <div style={{fontSize:12, color:'#888'}}>📸 Нажмите для загрузки</div>}
        </div>
        <input ref={ref} type="file" accept="image/*" onChange={e => { const file=e.target.files[0]; if(!file) return; setFile(file); setPreview(URL.createObjectURL(file)) }} style={{display:'none'}} />

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
          <div><label style={lblS}>В наличии (шт)</label><input type="number" min="0" value={f.stock_count} onChange={e => setF({...f, stock_count:e.target.value})} style={inpS} /></div>
          <div><label style={lblS}>Приоритет</label><input type="number" value={f.sort_order} onChange={e => setF({...f, sort_order:e.target.value})} style={inpS} /></div>
        </div>

        <label style={lblS}>Значок</label>
        <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:12}}>
          <button onClick={() => setF({...f, badge_text:''})}
            style={{padding:'4px 10px', borderRadius:20, border:'1px solid #e0e0e0', background:!f.badge_text?'#f5f5f5':'#fff', fontSize:12, cursor:'pointer', color:'#888', fontFamily:'Inter,sans-serif'}}>
            Без значка
          </button>
          {BADGE_OPTIONS.map(b => (
            <button key={b.text} onClick={() => setF({...f, badge_text:b.text, badge_color:b.color})}
              style={{padding:'4px 10px', borderRadius:20, border:`1px solid ${f.badge_text===b.text?b.color:'#e0e0e0'}`,
                background:f.badge_text===b.text?b.color+'22':'#fff', color:f.badge_text===b.text?b.color:'#888', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              {b.text}
            </button>
          ))}
        </div>

        <div style={{display:'flex', gap:8}}>
          <button onClick={isEdit ? () => onSave() : handleCreate} disabled={saving || !f.name?.trim() || !f.coins_price}
            style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity:(!f.name?.trim()||!f.coins_price||saving)?0.5:1}}>
            {saving ? 'Сохраняем...' : isEdit ? 'Сохранить' : 'Создать приз'}
          </button>
          <button onClick={onCancel} style={{padding:'9px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            Отмена
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Призы</h1>
        {tab === 'catalog' && (
          <button onClick={() => setShowForm(!showForm)}
            style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            {showForm ? 'Закрыть' : '+ Добавить приз'}
          </button>
        )}
      </div>

      {/* Табы */}
      <div style={{display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #f0f0f0'}}>
        {[['catalog','Каталог'],['requests','Заявки']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{padding:'10px 16px', background:'transparent', border:'none', borderBottom: tab===id ? '2px solid #BFD900' : '2px solid transparent',
              fontSize:13, fontWeight: tab===id ? 600 : 400, color: tab===id ? '#2a2a2a' : '#888',
              cursor:'pointer', fontFamily:'Inter,sans-serif', display:'flex', alignItems:'center', gap:6, marginBottom:-1}}>
            {label}
            {id === 'requests' && pendingCount > 0 && (
              <span style={{background:'#e74c3c', color:'#fff', borderRadius:10, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:18, textAlign:'center'}}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Каталог ── */}
      {tab === 'catalog' && (
        <div>
          {showForm && <PrizeForm isEdit={false} onCancel={() => { setShowForm(false); setForm(emptyForm); setImageFile(null); setImagePreview(null) }} />}

          {loading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div> : (
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {prizes.length === 0 && !showForm && (
                <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Призов нет — добавьте первый</div>
              )}
              {prizes.map(prize => (
                <div key={prize.id} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', overflow:'hidden'}}>
                  <div style={{display:'flex', gap:14, alignItems:'flex-start', padding:'14px 16px'}}>
                    {prize.image_url ? (
                      <img src={prize.image_url} alt="" style={{width:72, height:72, borderRadius:10, objectFit:'cover', flexShrink:0}} />
                    ) : (
                      <div style={{width:72, height:72, borderRadius:10, background:'#f5f5f5', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28}}>🎁</div>
                    )}
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4}}>
                        <span style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>{prize.name}</span>
                        {prize.badge_text && (
                          <span style={{fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:(prize.badge_color||'#f39c12')+'22', color:prize.badge_color||'#f39c12'}}>
                            {prize.badge_text}
                          </span>
                        )}
                      </div>
                      {prize.description && <div style={{fontSize:12, color:'#888', marginBottom:4}}>{prize.description}</div>}
                      <div style={{display:'flex', gap:12, alignItems:'center'}}>
                        <span style={{fontSize:14, fontWeight:700, color:'#f39c12'}}>⭐ {prize.coins_price} SDTшек</span>
                        <span style={{fontSize:12, color: prize.stock_count === 0 ? '#e74c3c' : prize.stock_count <= 3 ? '#f39c12' : '#888'}}>
                          {prize.stock_count === 0 ? 'Закончился' : `${prize.stock_count} шт`}
                        </span>
                      </div>
                    </div>
                    <div style={{display:'flex', gap:6, flexShrink:0}}>
                      <button onClick={() => { setEditingPrize(prize.id); setEditForm({...prize}); setEditImagePreview(prize.image_url||null); setEditImageFile(null) }}
                        style={{padding:'5px 10px', background: editingPrize===prize.id ? '#fafde8' : '#f5f5f5', border: editingPrize===prize.id ? '1px solid #BFD900' : 'none', borderRadius:8, fontSize:12, color: editingPrize===prize.id ? '#6a7700' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                        ✎
                      </button>
                      <button onClick={() => handleArchive(prize.id)}
                        style={{padding:'5px 10px', background:'transparent', border:'1px solid #f0f0f0', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                        В архив
                      </button>
                    </div>
                  </div>

                  {editingPrize === prize.id && editForm && (
                    <div style={{borderTop:'1px solid #f0f0f0', padding:16, background:'#fafde8'}}>
                      <PrizeForm isEdit={true} onSave={() => handleUpdate(prize.id)} onCancel={() => { setEditingPrize(null); setEditForm(null) }} />
                    </div>
                  )}
                </div>
              ))}

              {archived.length > 0 && (
                <div style={{marginTop:8}}>
                  <button onClick={() => setShowArchive(!showArchive)}
                    style={{display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#f9f9f9', border:'1px solid #f0f0f0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif', width:'100%'}}>
                    🗄 Архив — {archived.length} {showArchive ? '▲' : '▼'}
                  </button>
                  {showArchive && (
                    <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:8}}>
                      {archived.map(p => (
                        <div key={p.id} style={{background:'#f9f9f9', borderRadius:12, border:'1px solid #f0f0f0', padding:'12px 16px', display:'flex', alignItems:'center', gap:12, opacity:0.7}}>
                          <span style={{flex:1, fontSize:13, fontWeight:600, color:'#888'}}>{p.name}</span>
                          <span style={{fontSize:12, color:'#f39c12'}}>⭐ {p.coins_price}</span>
                          <button onClick={() => handleRestore(p.id)}
                            style={{padding:'5px 12px', background:'#eafaf1', border:'1px solid #a9dfbf', borderRadius:8, fontSize:12, color:'#27ae60', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                            ↩ Восстановить
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Заявки ── */}
      {tab === 'requests' && (
        <div>
          {loading ? <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div> : (
            requests.length === 0 ? (
              <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Заявок пока нет</div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {requests.map(req => {
                  const st = STATUS[req.status]
                  const client = req.client
                  const prize = req.prize
                  return (
                    <div key={req.id} style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:16}}>
                      <div style={{display:'flex', gap:14, alignItems:'flex-start'}}>
                        {prize?.image_url ? (
                          <img src={prize.image_url} alt="" style={{width:56, height:56, borderRadius:10, objectFit:'cover', flexShrink:0}} />
                        ) : (
                          <div style={{width:56, height:56, borderRadius:10, background:'#f5f5f5', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>🎁</div>
                        )}
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:2}}>{prize?.name}</div>
                          <div style={{fontSize:12, color:'#f39c12', marginBottom:4}}>⭐ {prize?.coins_price} SDTшек</div>
                          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                            <span style={{fontSize:13, color:'#2a2a2a', fontWeight:500}}>{client?.full_name}</span>
                            <span style={{fontSize:12, color:'#888'}}>· {client?.bonus_coins || 0} SDTшек на балансе</span>
                          </div>
                          <div style={{fontSize:11, color:'#BDBDBD', marginTop:2}}>
                            {new Date(req.created_at).toLocaleString('ru-RU', { timeZone:'Europe/Moscow', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </div>
                        </div>
                        <span style={{background:st.bg, color:st.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, flexShrink:0}}>
                          {st.label}
                        </span>
                      </div>

                      {req.status === 'pending' && (
                        <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #f0f0f0', display:'flex', gap:8, flexWrap:'wrap'}}>
                          <button onClick={() => openClientModal(client?.id)}
                            style={{padding:'7px 14px', background:'#e8f4fd', border:'1px solid #2980b9', borderRadius:8, fontSize:12, color:'#2980b9', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                            👤 Карточка клиента
                          </button>
                          <button onClick={() => handleComplete(req)}
                            style={{padding:'7px 14px', background:'#eafaf1', border:'1px solid #27ae60', borderRadius:8, fontSize:12, color:'#27ae60', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                            ✅ Приз выдан
                          </button>
                          <button onClick={() => handleCancel(req.id)}
                            style={{padding:'7px 14px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                            Отменить
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* ── Модалка карточки клиента ── */}
      {clientModal && (
        <div onClick={() => { setClientModal(null); setClientProfile(null) }}
          style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:480, maxHeight:'80vh', overflowY:'auto', boxSizing:'border-box'}}>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <div style={{fontSize:16, fontWeight:600, color:'#2a2a2a'}}>Карточка клиента</div>
              <button onClick={() => { setClientModal(null); setClientProfile(null) }}
                style={{background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#888', lineHeight:1}}>×</button>
            </div>

            {clientProfile && (
              <>
                <div style={{background:'#f9f9f9', borderRadius:12, padding:14, marginBottom:16}}>
                  <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a', marginBottom:4}}>{clientProfile.full_name}</div>
                  <div style={{fontSize:13, color:'#888', marginBottom:10}}>{clientProfile.email}</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                    <div style={{background:'#fafde8', borderRadius:10, padding:'10px 14px'}}>
                      <div style={{fontSize:10, color:'#8a9900', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4}}>Рубли-бонусы</div>
                      <div style={{fontSize:20, fontWeight:600, color:'#2a2a2a'}}>{clientProfile.bonus_rubles || 0} ₽</div>
                    </div>
                    <div style={{background:'#fff7e6', borderRadius:10, padding:'10px 14px', border:'1px solid #f39c12'}}>
                      <div style={{fontSize:10, color:'#c07a00', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4}}>SDTшки</div>
                      <div style={{fontSize:20, fontWeight:600, color:'#f39c12'}}>{clientProfile.bonus_coins || 0} ⭐</div>
                    </div>
                  </div>
                </div>

                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13, fontWeight:600, color:'#2a2a2a', marginBottom:10}}>Управление SDTшками</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:8, marginBottom:8}}>
                    <div>
                      <label style={{fontSize:11, color:'#888', display:'block', marginBottom:4, fontWeight:600}}>Количество</label>
                      <input type="number" min="1" value={coinAmount} onChange={e => setCoinAmount(e.target.value)} placeholder="0" style={{...inpS}} />
                    </div>
                    <div>
                      <label style={{fontSize:11, color:'#888', display:'block', marginBottom:4, fontWeight:600}}>Причина</label>
                      <input value={coinReason} onChange={e => setCoinReason(e.target.value)} placeholder="За что начисляем / списываем" style={{...inpS}} />
                    </div>
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <button onClick={() => handleCoinOperation('credit')} disabled={coinSaving || !coinAmount || !coinReason.trim()}
                      style={{flex:1, padding:'8px', background:'#eafaf1', border:'1px solid #27ae60', borderRadius:8, fontSize:12, color:'#27ae60', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600, opacity:(!coinAmount||!coinReason.trim())?0.5:1}}>
                      + Начислить SDTшки
                    </button>
                    <button onClick={() => handleCoinOperation('debit')} disabled={coinSaving || !coinAmount || !coinReason.trim()}
                      style={{flex:1, padding:'8px', background:'#fdecea', border:'1px solid #e74c3c', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600, opacity:(!coinAmount||!coinReason.trim())?0.5:1}}>
                      − Списать SDTшки
                    </button>
                  </div>
                </div>

                {clientHistory.length > 0 && (
                  <div>
                    <div style={{fontSize:12, color:'#888', fontWeight:600, marginBottom:8}}>Последние операции</div>
                    {clientHistory.filter(h => h.type === 'coins').slice(0,5).map(h => (
                      <div key={h.id} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f8f8f8', fontSize:12}}>
                        <span style={{color:'#888'}}>{h.reason}</span>
                        <span style={{fontWeight:600, color: h.amount > 0 ? '#f39c12' : '#e74c3c'}}>{h.amount > 0 ? '+' : ''}{h.amount} ⭐</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}