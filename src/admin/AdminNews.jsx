import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
const labelStyle = { fontSize:12, color:'#888', marginBottom:6, fontWeight:600, display:'block' }
const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16 }

const EMOJIS = ['😊','😂','🔥','❤️','👍','🎉','✅','⚠️','📢','💪','🙏','👋','🎁','💡','📅','🏆','⭐','🎶','💃','🕺','🌟','👏','😍','🤩','💥','🚀','🎯','📌','🔑','💰','🎊','🥳','😎','🙌','💫','✨','🌈','🎵','👑','🏅']

const TAGS = [
  { value:'hot', label:'🔥 Горячее' },
  { value:'event', label:'🎉 Мероприятие' },
  { value:'summer', label:'🌞 Лето' },
  { value:'subscription', label:'💳 Абонементы' },
  { value:'achievement', label:'🏆 Достижение' },
  { value:'education', label:'🎓 Обучение' },
  { value:'schedule', label:'📅 Расписание' },
  { value:'promo', label:'🎁 Акция' },
  { value:'new', label:'🆕 Новинка' },
  { value:'motivation', label:'💪 Мотивация' },
]

const PALETTE = ['#ffffff','#fafde8','#eafaf1','#fdecea','#e8f4fd','#f5eef8','#fef9e7','#2a2a2a','#BFD900','#27ae60','#e74c3c','#2980b9','#f39c12','#8e44ad']

const REPEAT_TYPES = { none:'Не повторять', daily:'Каждый день', weekly:'Каждую неделю', monthly:'Каждый месяц' }

function RichEditor({ value, onChange, defaultBold = false }) {
  const editorRef = useRef(null)
  const isFirstRender = useRef(true)
  const [showEmoji, setShowEmoji] = useState(false)

  useEffect(() => {
    if (editorRef.current && isFirstRender.current) {
      editorRef.current.innerHTML = value || ''
      isFirstRender.current = false
    }
  }, [])

  const exec = (cmd, val = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    onChange(editorRef.current?.innerHTML || '')
  }

  const insertEmoji = (emoji) => {
    editorRef.current?.focus()
    document.execCommand('insertText', false, emoji)
    onChange(editorRef.current?.innerHTML || '')
    setShowEmoji(false)
  }

  const setColor = (color) => exec('foreColor', color)

  const toolBtn = (label, action, title) => (
    <button type="button" title={title} onClick={action}
      style={{padding:'5px 10px', background:'#f5f5f5', border:'1px solid #e0e0e0', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
      {label}
    </button>
  )

  return (
    <div>
      <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:8, alignItems:'center'}}>
        {toolBtn('Ж', () => exec('bold'), 'Жирный')}
        {toolBtn(<em>К</em>, () => exec('italic'), 'Курсив')}
        {toolBtn(<u>П</u>, () => exec('underline'), 'Подчёркивание')}
        <div style={{display:'flex', gap:3, alignItems:'center'}}>
          {['#2a2a2a','#e74c3c','#2980b9','#27ae60','#f39c12','#8e44ad','#BFD900'].map(c => (
            <div key={c} onClick={() => setColor(c)}
              style={{width:16, height:16, borderRadius:'50%', background:c, cursor:'pointer', border:'1.5px solid #e0e0e0'}} />
          ))}
        </div>
        <div style={{position:'relative'}}>
          <button type="button" onClick={() => setShowEmoji(!showEmoji)}
            style={{padding:'5px 10px', background:'#f5f5f5', border:'1px solid #e0e0e0', borderRadius:6, fontSize:13, cursor:'pointer'}}>
            😊
          </button>
          {showEmoji && (
            <div style={{position:'absolute', top:'100%', left:0, zIndex:100, background:'#fff', border:'1px solid #e0e0e0', borderRadius:12, padding:10, width:280, display:'flex', flexWrap:'wrap', gap:4, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', marginTop:4}}>
              {EMOJIS.map(e => (
                <button key={e} type="button" onClick={() => insertEmoji(e)}
                  style={{padding:'4px 6px', background:'none', border:'none', fontSize:18, cursor:'pointer', borderRadius:6}}
                  onMouseEnter={ev => ev.currentTarget.style.background='#f5f5f5'}
                  onMouseLeave={ev => ev.currentTarget.style.background='none'}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => { if(editorRef.current) { editorRef.current.innerHTML = ''; onChange('') } }}
          style={{padding:'5px 10px', background:'#fdecea', border:'1px solid #e74c3c33', borderRadius:6, fontSize:11, cursor:'pointer', color:'#e74c3c'}}>
          Сбросить
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        dir="ltr"
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        style={{
          minHeight: defaultBold ? 48 : 140,
          padding:'12px 14px',
          border:'1px solid #e8e8e8',
          borderRadius:10,
          fontSize: defaultBold ? 16 : 15,
          fontFamily:'-apple-system, BlinkMacSystemFont, Inter, sans-serif',
          outline:'none',
          lineHeight:1.7,
          fontWeight: defaultBold ? 700 : 400,
          color:'#1a1a1a',
          letterSpacing: defaultBold ? 0 : '-0.01em',
        }}
      />
      {!defaultBold && (
        <div style={{fontSize:11, color:'#BDBDBD', marginTop:4}}>
          Выдели текст и нажми кнопку форматирования
        </div>
      )}
    </div>
  )
}

function ColorPicker({ label, value, onChange }) {
  return (
    <div style={{marginBottom:12}}>
      <label style={labelStyle}>{label}</label>
      <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
        {PALETTE.map(c => (
          <div key={c} onClick={() => onChange(c)}
            style={{width:24, height:24, borderRadius:6, background:c, cursor:'pointer', border: value === c ? '3px solid #2a2a2a' : '1.5px solid #e0e0e0'}} />
        ))}
      </div>
    </div>
  )
}

const emptyForm = () => ({
  title: '',
  body: '',
  tag: '',
  tag_color: '#BFD900',
  card_bg: '#ffffff',
  title_color: '#2a2a2a',
  is_pinned: false,
  is_active: true,
  scheduled_at: '',
  repeat_type: 'none',
})

export default function AdminNews({ session }) {
  const [tab, setTab] = useState('list')
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTag, setFilterTag] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const titleRef = useRef(null)
  const bodyRef = useRef(null)

  useEffect(() => {
    loadNews()
    loadRole()
  }, [filterTag])

  const loadRole = async () => {
    const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    setUserRole(data?.role)
  }

  const loadNews = async () => {
    setLoading(true)
    let query = supabase.from('news').select('*, profiles:created_by(full_name), updater:updated_by(full_name)')
      .order('is_pinned', { ascending: false })
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false })
    if (filterTag) query = query.eq('tag', filterTag)
    const { data } = await query
    setNews(data || [])
    setLoading(false)
  }

  const loadHistory = async (newsId) => {
    const { data } = await supabase.from('news_history').select('*, profiles:author_id(full_name)')
      .eq('news_id', newsId).order('created_at', { ascending: false })
    setHistory(data || [])
    setShowHistory(newsId)
  }

  const handleEdit = (item) => {
    setForm({
      title: item.title || '',
      body: item.body || '',
      tag: item.tag || '',
      tag_color: item.tag_color || '#BFD900',
      card_bg: item.card_bg || '#ffffff',
      title_color: item.title_color || '#2a2a2a',
      is_pinned: item.is_pinned || false,
      is_active: item.is_active ?? true,
      scheduled_at: item.scheduled_at ? item.scheduled_at.slice(0,16) : '',
      repeat_type: item.repeat_type || 'none',
    })
    setEditingId(item.id)
    setTab('form')
    titleRef.current = null
    bodyRef.current = null
  }

  const handleSave = async () => {
    if (!form.title && !form.body) { alert('Введи хотя бы заголовок или текст'); return }
    setSaving(true)
    const payload = {
      ...form,
      scheduled_at: form.scheduled_at || null,
      published_at: form.scheduled_at ? form.scheduled_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    }

    if (editingId) {
      await supabase.from('news').update(payload).eq('id', editingId)
      await supabase.from('news_history').insert({
        news_id: editingId, action: 'edited', author_id: session.user.id,
        changes: { title: form.title, tag: form.tag }
      })
    } else {
      const { data } = await supabase.from('news').insert({
        ...payload, created_by: session.user.id,
      }).select().single()
      if (data) {
        await supabase.from('news_history').insert({
          news_id: data.id, action: 'created', author_id: session.user.id,
          changes: { title: form.title }
        })
      }
    }
    setSaving(false)
    setForm(emptyForm())
    setEditingId(null)
    setTab('list')
    loadNews()
  }

  const handleDelete = async (id, title) => {
    if (!confirm(`Удалить новость "${title}"?`)) return
    await supabase.from('news').update({ is_active: false, updated_by: session.user.id, updated_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('news_history').insert({ news_id: id, action: 'deleted', author_id: session.user.id, changes: { title } })
    loadNews()
  }

  const handleTogglePin = async (id, pinned) => {
    await supabase.from('news').update({ is_pinned: !pinned, updated_by: session.user.id, updated_at: new Date().toISOString() }).eq('id', id)
    loadNews()
  }

  const tagLabel = (tag) => TAGS.find(t => t.value === tag)?.label || tag
  const fmtDT = (dt) => dt ? new Date(dt).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'

  const isManagerPlus = ['owner','manager'].includes(userRole)

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Новости</h1>
        <button onClick={() => { setForm(emptyForm()); setEditingId(null); setTab('form') }}
          style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
          + Новость
        </button>
      </div>

      <div style={{display:'flex', gap:4, borderBottom:'1px solid #f0f0f0', marginBottom:20}}>
        {[['list','📋 Список'], ['form', editingId ? '✏️ Редактировать' : '✍️ Создать']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{padding:'10px 16px', background:'transparent', border:'none', borderBottom: tab===v ? '2px solid #BFD900' : '2px solid transparent', fontSize:13, fontWeight: tab===v ? 600 : 400, color: tab===v ? '#2a2a2a' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div>
          {/* Фильтр по тегам */}
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16}}>
            <button onClick={() => setFilterTag('')}
              style={{padding:'5px 12px', borderRadius:10, border: filterTag==='' ? 'none' : '1px solid #e0e0e0', background: filterTag==='' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: filterTag==='' ? 600 : 400}}>
              Все
            </button>
            {TAGS.map(t => (
              <button key={t.value} onClick={() => setFilterTag(filterTag === t.value ? '' : t.value)}
                style={{padding:'5px 12px', borderRadius:10, border: filterTag===t.value ? 'none' : '1px solid #e0e0e0', background: filterTag===t.value ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: filterTag===t.value ? 600 : 400}}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
          ) : news.length === 0 ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>
              Новостей нет — создай первую!
            </div>
          ) : news.map(item => (
            <div key={item.id} style={{background: item.card_bg || '#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:18, marginBottom:12, opacity: item.is_active ? 1 : 0.5}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap'}}>
                    {item.is_pinned && <span style={{fontSize:11, fontWeight:700, color:'#2a2a2a', background:'#f5f5f5', padding:'2px 8px', borderRadius:6}}>📌 Закреп</span>}
                    {!item.is_active && <span style={{fontSize:11, fontWeight:700, color:'#e74c3c', background:'#fdecea', padding:'2px 8px', borderRadius:6}}>Архив</span>}
                    {item.tag && (
                      <span style={{fontSize:11, fontWeight:600, background: item.tag_color || '#BFD900', color:'#2a2a2a', padding:'2px 10px', borderRadius:8}}>
                        {tagLabel(item.tag)}
                      </span>
                    )}
                    {item.scheduled_at && new Date(item.scheduled_at) > new Date() && (
                      <span style={{fontSize:11, color:'#f39c12', background:'#fef9e7', padding:'2px 8px', borderRadius:6, fontWeight:600}}>
                        ⏰ {fmtDT(item.scheduled_at)}
                      </span>
                    )}
                    {item.repeat_type && item.repeat_type !== 'none' && (
                      <span style={{fontSize:11, color:'#2980b9', background:'#e8f4fd', padding:'2px 8px', borderRadius:6}}>
                        🔄 {REPEAT_TYPES[item.repeat_type]}
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:15, fontWeight:600, color: item.title_color || '#2a2a2a', marginBottom:4}}
                    dangerouslySetInnerHTML={{ __html: item.title }} />
                  {item.body && (
                    <div style={{fontSize:12, color:'#2a2a2a', lineHeight:1.5, maxHeight:48, overflow:'hidden'}}
                      dangerouslySetInnerHTML={{ __html: item.body }} />
                  )}
                  <div style={{fontSize:11, color:'#BDBDBD', marginTop:6}}>
                    {fmtDT(item.published_at)}
                    {item.profiles?.full_name && ` · ${item.profiles.full_name}`}
                    {item.views_count > 0 && ` · 👁 ${item.views_count}`}
                  </div>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:6, flexShrink:0}}>
                  <button onClick={() => handleEdit(item)}
                    style={{fontSize:11, color:'#2980b9', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Изменить</button>
                  <button onClick={() => handleTogglePin(item.id, item.is_pinned)}
                    style={{fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                    {item.is_pinned ? '📌 Откреп' : '📌 Закреп'}
                  </button>
                  {isManagerPlus && (
                    <button onClick={() => loadHistory(item.id)}
                      style={{fontSize:11, color:'#8e44ad', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>История</button>
                  )}
                  {item.is_active && (
                    <button onClick={() => handleDelete(item.id, item.title)}
                      style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Архив</button>
                  )}
                </div>
              </div>

              {/* История изменений */}
              {showHistory === item.id && isManagerPlus && (
                <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #f0f0f0'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <div style={{fontSize:12, fontWeight:600, color:'#888'}}>История изменений</div>
                    <button onClick={() => setShowHistory(null)} style={{fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer'}}>Скрыть</button>
                  </div>
                  {history.length === 0 ? (
                    <div style={{fontSize:12, color:'#BDBDBD'}}>Изменений нет</div>
                  ) : history.map(h => (
                    <div key={h.id} style={{display:'flex', gap:8, padding:'5px 0', borderBottom:'1px solid #f8f8f8', fontSize:12}}>
                      <span style={{color: h.action==='deleted'?'#e74c3c': h.action==='created'?'#27ae60':'#2980b9', fontWeight:600}}>
                        {h.action==='created'?'✅ Создана': h.action==='edited'?'✏️ Изменена':'🗑 Архив'}
                      </span>
                      <span style={{color:'#888'}}>{h.profiles?.full_name || '—'}</span>
                      <span style={{color:'#BDBDBD', marginLeft:'auto'}}>{fmtDT(h.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'form' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:20, alignItems:'start'}}>
          <div>
            <div style={cardStyle}>
              <label style={labelStyle}>Заголовок *</label>
              <RichEditor key={`title-${editingId}`} value={form.title} onChange={v => setForm(f => ({...f, title:v}))} defaultBold />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Текст новости</label>
              <RichEditor key={`body-${editingId}`} value={form.body} onChange={v => setForm(f => ({...f, body:v}))} />
            </div>

            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>🎨 Оформление</div>
              <ColorPicker label="Фон карточки" value={form.card_bg} onChange={v => setForm(f => ({...f, card_bg:v}))} />
              <ColorPicker label="Цвет заголовка" value={form.title_color} onChange={v => setForm(f => ({...f, title_color:v}))} />
              <ColorPicker label="Цвет фона тега" value={form.tag_color} onChange={v => setForm(f => ({...f, tag_color:v}))} />

              {/* Предпросмотр */}
              <div style={{marginTop:12, padding:14, borderRadius:12, background: form.card_bg || '#fff', border:'1px solid #f0f0f0'}}>
                <div style={{fontSize:11, color:'#BDBDBD', marginBottom:6}}>Предпросмотр карточки:</div>
                {form.tag && (
                  <span style={{display:'inline-block', fontSize:11, fontWeight:600, background: form.tag_color, color:'#2a2a2a', padding:'2px 10px', borderRadius:8, marginBottom:6}}>
                    {tagLabel(form.tag)}
                  </span>
                )}
                <div style={{fontSize:14, fontWeight:600, color: form.title_color}}
                  dangerouslySetInnerHTML={{ __html: form.title || 'Заголовок новости' }} />
              </div>
            </div>
          </div>

          <div>
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>Настройки</div>

              <label style={labelStyle}>Тег</label>
              <select value={form.tag} onChange={e => setForm(f => ({...f, tag:e.target.value}))} style={{...inputStyle, marginBottom:12}}>
                <option value="">Без тега</option>
                {TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              <label style={labelStyle}>Отложенная публикация</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({...f, scheduled_at:e.target.value}))}
                style={{...inputStyle, marginBottom:12}} />

              <label style={labelStyle}>Повторение</label>
              <select value={form.repeat_type} onChange={e => setForm(f => ({...f, repeat_type:e.target.value}))} style={{...inputStyle, marginBottom:12}}>
                {Object.entries(REPEAT_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>

              <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:16}}>
                <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer'}}>
                  <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({...f, is_pinned:e.target.checked}))} />
                  📌 Закрепить новость
                </label>
                <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer'}}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({...f, is_active:e.target.checked}))} />
                  ✅ Опубликовать сейчас
                </label>
              </div>

              <button onClick={handleSave} disabled={saving || (!form.title && !form.body)}
                style={{width:'100%', padding:'11px', background:'#BFD900', border:'none', borderRadius:10, fontSize:14, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: (saving || (!form.title && !form.body)) ? 0.5 : 1}}>
                {saving ? 'Сохраняем...' : editingId ? '💾 Сохранить' : '🚀 Опубликовать'}
              </button>
              <button onClick={() => { setTab('list'); setEditingId(null); setForm(emptyForm()) }}
                style={{width:'100%', padding:'9px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif', marginTop:8}}>
                Отмена
              </button>
              <div style={{marginTop:16}}>
              <div style={{fontSize:12, fontWeight:600, color:'#888', marginBottom:10}}>📱 Предпросмотр в ленте</div>
              <div style={{
                background: form.card_bg || '#fff',
                borderRadius:16, border:'1px solid #f0f0f0',
                padding:16, boxShadow:'0 2px 8px rgba(0,0,0,0.06)'
              }}>
                {form.is_pinned && (
                  <div style={{fontSize:10, fontWeight:700, color:'#888', marginBottom:6}}>📌 ЗАКРЕПЛЕНО</div>
                )}
                {form.tag && (
                  <span style={{display:'inline-block', fontSize:10, fontWeight:700, background: form.tag_color || '#BFD900', color:'#2a2a2a', padding:'2px 10px', borderRadius:8, marginBottom:8}}>
                    {tagLabel(form.tag)}
                  </span>
                )}
                {form.title && (
                  <div style={{fontSize:14, fontWeight:600, color: form.title_color || '#2a2a2a', marginBottom:6, lineHeight:1.4}}
                    dangerouslySetInnerHTML={{ __html: form.title }} />
                )}
                {form.body && (
                  <div style={{fontSize:12, color:'#2a2a2a', lineHeight:1.5, maxHeight:60, overflow:'hidden'}}
                    dangerouslySetInnerHTML={{ __html: form.body }} />
                )}
                <div style={{fontSize:10, color:'#BDBDBD', marginTop:8}}>
                  {form.scheduled_at
                    ? `⏰ ${new Date(form.scheduled_at).toLocaleDateString('ru-RU', {day:'numeric', month:'short'})}`
                    : new Date().toLocaleDateString('ru-RU', {day:'numeric', month:'short'})
                  }
                  {form.repeat_type && form.repeat_type !== 'none' && ` · 🔄 ${REPEAT_TYPES[form.repeat_type]}`}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}