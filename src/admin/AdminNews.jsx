import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const PALETTE = [
  '#ffffff', '#f8f8f8', '#2a2a2a', '#000000',
  '#fafde8', '#eafaf1', '#fdecea', '#e8f4fd', '#f5eef8', '#fef9e7',
  '#fce4ec', '#e8eaf6', '#e0f7fa', '#f9fbe7', '#fff8e1', '#fbe9e7',
  '#e8f5e9', '#e3f2fd', '#f3e5f5', '#e0f2f1',
  '#BFD900', '#27ae60', '#e74c3c', '#2980b9', '#f39c12', '#8e44ad',
  '#e91e63', '#00bcd4', '#ff5722', '#3f51b5', '#009688', '#ff9800',
]

const GRADIENTS = [
  'linear-gradient(135deg, #fafde8, #BFD900)',
  'linear-gradient(135deg, #e8f4fd, #2980b9)',
  'linear-gradient(135deg, #fdecea, #e74c3c)',
  'linear-gradient(135deg, #f5eef8, #8e44ad)',
  'linear-gradient(135deg, #eafaf1, #27ae60)',
  'linear-gradient(135deg, #fef9e7, #f39c12)',
  'linear-gradient(135deg, #fff8e1, #ff9800)',
  'linear-gradient(135deg, #fce4ec, #e91e63)',
]

const EMOJIS = ['😊','😂','🔥','❤️','👍','🎉','✅','⚠️','📢','💪','🙏','👋','🎁','💡','📅','🏆','⭐','🎶','💃','🕺','🌟','👏','😍','🤩','💥','🚀','🎯','📌','🔑','💰','🎊','🥳','😎','🙌','💫','✨','🌈','🎵','👑','🏅']
const REPEAT_TYPES = { none:'Не повторять', daily:'Каждый день', weekly:'Каждую неделю', monthly:'Каждый месяц' }

function ColorPicker({ label, value, onChange, withGradients = false }) {
  return (
    <div style={{marginBottom:14}}>
      {label && <div style={{fontSize:11, color:'#888', fontWeight:600, marginBottom:6}}>{label}</div>}
      <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
        {PALETTE.map(c => (
          <div key={c} onClick={() => onChange(c)}
            style={{width:22, height:22, borderRadius:5, background:c, cursor:'pointer',
              border: value===c ? '2.5px solid #2a2a2a' : '1.5px solid #e0e0e0', flexShrink:0}} />
        ))}
        {withGradients && GRADIENTS.map(g => (
          <div key={g} onClick={() => onChange(g)}
            style={{width:22, height:22, borderRadius:5, background:g, cursor:'pointer',
              border: value===g ? '2.5px solid #2a2a2a' : '1.5px solid #e0e0e0', flexShrink:0}} />
        ))}
      </div>
    </div>
  )
}

function RichEditor({ value, onChange, minHeight = 120, defaultBold = false, textColor = '#1a1a1a' }) {
  const editorRef = useRef(null)
  const isFirst = useRef(true)
  const [showEmoji, setShowEmoji] = useState(false)

  useEffect(() => {
    if (editorRef.current && isFirst.current) {
      editorRef.current.innerHTML = value || ''
      isFirst.current = false
    }
  }, [])

  const exec = (cmd, val = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    onChange(editorRef.current?.innerHTML || '')
  }

  const insertEmoji = (e) => {
    editorRef.current?.focus()
    document.execCommand('insertText', false, e)
    onChange(editorRef.current?.innerHTML || '')
    setShowEmoji(false)
  }

  const btn = (label, action, title) => (
    <button type="button" title={title} onClick={action}
      style={{padding:'4px 8px', background:'#f5f5f5', border:'1px solid #e0e0e0', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
      {label}
    </button>
  )

  return (
    <div>
      <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:8, alignItems:'center'}}>
        {btn('Ж', () => exec('bold'), 'Жирный')}
        {btn(<em>К</em>, () => exec('italic'), 'Курсив')}
        {btn(<u>П</u>, () => exec('underline'), 'Подчёркивание')}
        {btn('🔗', () => { const url = prompt('URL:'); if (url) exec('createLink', url) }, 'Ссылка')}
        <div style={{position:'relative'}}>
          <button type="button" onClick={() => setShowEmoji(!showEmoji)}
            style={{padding:'4px 8px', background:'#f5f5f5', border:'1px solid #e0e0e0', borderRadius:6, fontSize:13, cursor:'pointer'}}>
            😊
          </button>
          {showEmoji && (
            <div style={{position:'absolute', top:'100%', left:0, zIndex:200, background:'#fff', border:'1px solid #e0e0e0', borderRadius:12, padding:10, width:280, display:'flex', flexWrap:'wrap', gap:4, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', marginTop:4}}>
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
        <button type="button" onClick={() => { if(editorRef.current) { editorRef.current.innerHTML=''; onChange('') } }}
          style={{padding:'4px 8px', background:'#fdecea', border:'1px solid #e74c3c33', borderRadius:6, fontSize:11, cursor:'pointer', color:'#e74c3c'}}>
          Сбросить
        </button>
      </div>
      <div ref={editorRef} contentEditable dir="ltr" suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        style={{minHeight, padding:'10px 12px', border:'1px solid #e8e8e8', borderRadius:10,
          fontSize: defaultBold ? 16 : 14, fontFamily:'-apple-system, BlinkMacSystemFont, Inter, sans-serif',
          outline:'none', lineHeight:1.7, fontWeight: defaultBold ? 700 : 400, color: textColor}} />
    </div>
  )
}

const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:18, marginBottom:14 }
const labelStyle = { fontSize:11, color:'#888', fontWeight:600, marginBottom:6, display:'block' }
const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }

const emptyForm = () => ({
  title:'', body:'', tag:'', tag_color:'#BFD900', tag_text_color:'#2a2a2a',
  card_bg:'#ffffff', title_color:'#2a2a2a', body_color:'#2a2a2a',
  is_pinned:false, is_active:true, scheduled_at:'', repeat_type:'none',
})

function TagsManager({ tags, onClose, onChanged }) {
  const [newLabel, setNewLabel] = useState('')
  const [editingTag, setEditingTag] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  const handleAdd = async () => {
    if (!newLabel.trim()) return
    const value = newLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_а-яё]/gi, '') + '_' + Date.now()
    await supabase.from('news_tags').insert({ value, label: newLabel.trim() })
    setNewLabel('')
    onChanged()
  }

  const handleUpdate = async (tag) => {
    if (!editLabel.trim()) return
    await supabase.from('news_tags').update({ label: editLabel.trim() }).eq('id', tag.id)
    setEditingTag(null)
    onChanged()
  }

  const handleDelete = async (tag) => {
    const { count } = await supabase.from('news').select('id', { count:'exact', head:true }).eq('tag', tag.value)
    const msg = count > 0
      ? `У тега "${tag.label}" есть ${count} новост${count===1?'ь':count<5?'и':'ей'}. После удаления они останутся без тега. Удалить?`
      : `Удалить тег "${tag.label}"?`
    if (!confirm(msg)) return
    await supabase.from('news_tags').delete().eq('id', tag.id)
    onChanged()
  }

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{background:'#fff', borderRadius:16, padding:24, width:420, maxHeight:'80vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.15)'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <div style={{fontSize:15, fontWeight:600, color:'#2a2a2a'}}>Управление тегами</div>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:20, color:'#BDBDBD', cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex', gap:8, marginBottom:16}}>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="🎯 Название тега с эмодзи"
            style={{...inputStyle, flex:1}}
            onKeyDown={e => e.key==='Enter' && handleAdd()} />
          <button onClick={handleAdd}
            style={{padding:'9px 14px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            +
          </button>
        </div>
        {tags.map(tag => (
          <div key={tag.id} style={{display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid #f5f5f5'}}>
            {editingTag===tag.id ? (
              <>
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  style={{...inputStyle, flex:1}}
                  onKeyDown={e => e.key==='Enter' && handleUpdate(tag)} autoFocus />
                <button onClick={() => handleUpdate(tag)}
                  style={{padding:'6px 12px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>✓</button>
                <button onClick={() => setEditingTag(null)}
                  style={{padding:'6px 10px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:8, fontSize:12, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>✕</button>
              </>
            ) : (
              <>
                <div style={{flex:1, fontSize:13, color:'#2a2a2a'}}>{tag.label}</div>
                <button onClick={() => { setEditingTag(tag.id); setEditLabel(tag.label) }}
                  style={{fontSize:11, color:'#2980b9', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Изменить</button>
                <button onClick={() => handleDelete(tag)}
                  style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Удалить</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminNews({ session }) {
  const [tab, setTab] = useState('list')
  const [news, setNews] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTag, setFilterTag] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [showTagsManager, setShowTagsManager] = useState(false)

  useEffect(() => { loadNews(); loadTags(); loadRole() }, [filterTag])

  const loadRole = async () => {
    const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    setUserRole(data?.role)
  }

  const loadTags = async () => {
    const { data } = await supabase.from('news_tags').select('*').order('created_at')
    setTags(data || [])
  }

  const loadNews = async () => {
    setLoading(true)
    let query = supabase.from('news').select('*, profiles:created_by(full_name)')
      .order('is_pinned', { ascending: false })
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
      title: item.title||'', body: item.body||'', tag: item.tag||'',
      tag_color: item.tag_color||'#BFD900', tag_text_color: item.tag_text_color||'#2a2a2a',
      card_bg: item.card_bg||'#ffffff', title_color: item.title_color||'#2a2a2a',
      body_color: item.body_color||'#2a2a2a',
      is_pinned: item.is_pinned||false, is_active: item.is_active??true,
      scheduled_at: item.scheduled_at ? item.scheduled_at.slice(0,16) : '',
      repeat_type: item.repeat_type||'none',
    })
    setEditingId(item.id)
    setTab('form')
  }

  const handleSave = async () => {
    if (!form.title && !form.body) { alert('Введи хотя бы заголовок или текст'); return }
    setSaving(true)
    const toUTC = (localStr) => {
  if (!localStr) return null
  return new Date(localStr).toISOString()
}
const payload = {
      ...form,
      scheduled_at: toUTC(form.scheduled_at),
      published_at: form.scheduled_at ? toUTC(form.scheduled_at) : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    }
    if (editingId) {
      await supabase.from('news').update(payload).eq('id', editingId)
      await supabase.from('news_history').insert({ news_id: editingId, action:'edited', author_id: session.user.id, changes:{ title: form.title } })
    } else {
      const { data } = await supabase.from('news').insert({ ...payload, created_by: session.user.id }).select().single()
      if (data) await supabase.from('news_history').insert({ news_id: data.id, action:'created', author_id: session.user.id, changes:{ title: form.title } })
    }
    setSaving(false)
    setForm(emptyForm())
    setEditingId(null)
    setTab('list')
    loadNews()
  }

  const handleDelete = async (id, title) => {
    if (!confirm('Архивировать новость?')) return
    await supabase.from('news').update({ is_active:false, updated_by: session.user.id, updated_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('news_history').insert({ news_id: id, action:'deleted', author_id: session.user.id, changes:{ title } })
    loadNews()
  }

  const handleTogglePin = async (id, pinned) => {
    await supabase.from('news').update({ is_pinned:!pinned, updated_by: session.user.id, updated_at: new Date().toISOString() }).eq('id', id)
    loadNews()
  }

  const tagLabel = (tag) => tags.find(t => t.value===tag)?.label || tag
  const fmtDT = (dt) => dt ? new Date(dt).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'
  const stripHtml = (html) => html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') || ''
  const isManagerPlus = ['owner','manager'].includes(userRole)

  const Preview = () => (
    <div style={{background: form.card_bg||'#fff', borderRadius:16, border:'1px solid #f0f0f0', padding:14, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', position:'relative', overflow:'hidden', textAlign:'left'}}>
      {form.is_pinned && (
        <div style={{position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg, #BFD900 0%, #a0b800 40%, transparent 100%)', borderRadius:'16px 16px 0 0'}} />
      )}
      {form.tag && (
        <div style={{marginBottom:8, marginTop: form.is_pinned ? 8 : 0}}>
          <span style={{fontSize:9, fontWeight:700, background: form.tag_color||'#BFD900', color: form.tag_text_color||'#2a2a2a', padding:'2px 8px', borderRadius:6}}>
            {tagLabel(form.tag)}
          </span>
        </div>
      )}
      {form.title && (
        <div style={{fontSize:14, fontWeight:600, color: form.title_color||'#2a2a2a', marginBottom:4, lineHeight:1.4, textAlign:'center'}}
          dangerouslySetInnerHTML={{ __html: form.title }} />
      )}
      {form.body && (
        <div style={{fontSize:12, color: form.body_color||'#2a2a2a', lineHeight:1.5, maxHeight:48, overflow:'hidden', textAlign:'center'}}>
          {stripHtml(form.body).slice(0, 100)}
        </div>
      )}
      <div style={{fontSize:10, color:'#BDBDBD', marginTop:6, textAlign:'center'}}>
        {form.scheduled_at ? new Date(form.scheduled_at).toLocaleDateString('ru-RU', {day:'numeric', month:'short'}) : new Date().toLocaleDateString('ru-RU', {day:'numeric', month:'short'})}
      </div>
    </div>
  )

  return (
    <div>
      {showTagsManager && (
        <TagsManager tags={tags} onClose={() => setShowTagsManager(false)} onChanged={() => { loadTags(); setShowTagsManager(true) }} />
      )}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:0}}>Новости</h1>
        <div style={{display:'flex', gap:8}}>
          <button onClick={() => setShowTagsManager(true)}
            style={{padding:'9px 16px', background:'#fff', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, fontWeight:600, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            🏷 Теги
          </button>
          <button onClick={() => { setForm(emptyForm()); setEditingId(null); setTab('form') }}
            style={{padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            + Новость
          </button>
        </div>
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
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16}}>
            <button onClick={() => setFilterTag('')}
              style={{padding:'5px 12px', borderRadius:10, border: filterTag==='' ? 'none' : '1px solid #e0e0e0', background: filterTag==='' ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: filterTag==='' ? 600 : 400}}>
              Все
            </button>
            {tags.map(t => (
              <button key={t.value} onClick={() => setFilterTag(filterTag===t.value ? '' : t.value)}
                style={{padding:'5px 12px', borderRadius:10, border: filterTag===t.value ? 'none' : '1px solid #e0e0e0', background: filterTag===t.value ? '#BFD900' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: filterTag===t.value ? 600 : 400}}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:40}}>Загрузка...</div>
          ) : news.length === 0 ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:60, background:'#fff', borderRadius:14}}>Новостей нет — создай первую!</div>
          ) : news.map(item => (
            <div key={item.id} style={{background: item.card_bg||'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:16, marginBottom:10, opacity: item.is_active ? 1 : 0.5, position:'relative', overflow:'hidden'}}>
              {item.is_pinned && (
                <div style={{position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg, #BFD900 0%, #a0b800 40%, transparent 100%)', borderRadius:'14px 14px 0 0'}} />
              )}
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:8, flexWrap:'wrap', marginTop: item.is_pinned ? 8 : 0}}>
                    {!item.is_active && <span style={{fontSize:11, fontWeight:700, color:'#e74c3c', background:'#fdecea', padding:'2px 8px', borderRadius:6}}>Архив</span>}
                    {item.tag && (
                      <span style={{fontSize:11, fontWeight:600, background: item.tag_color||'#BFD900', color: item.tag_text_color||'#2a2a2a', padding:'2px 10px', borderRadius:8}}>
                        {tagLabel(item.tag)}
                      </span>
                    )}
                    {item.scheduled_at && new Date(item.scheduled_at) > new Date() && (
                      <span style={{fontSize:11, color:'#f39c12', background:'#fef9e7', padding:'2px 8px', borderRadius:6, fontWeight:600}}>⏰ {fmtDT(item.scheduled_at)}</span>
                    )}
                    {item.repeat_type && item.repeat_type !== 'none' && (
                      <span style={{fontSize:11, color:'#2980b9', background:'#e8f4fd', padding:'2px 8px', borderRadius:6}}>🔄 {REPEAT_TYPES[item.repeat_type]}</span>
                    )}
                  </div>
                  <div style={{fontSize:14, fontWeight:600, color: item.title_color||'#2a2a2a', marginBottom:4}} dangerouslySetInnerHTML={{ __html: item.title }} />
                  {item.body && <div style={{fontSize:12, color: item.body_color||'#888', lineHeight:1.5, maxHeight:40, overflow:'hidden'}}>{stripHtml(item.body).slice(0,120)}</div>}
                  <div style={{fontSize:11, color:'#BDBDBD', marginTop:6}}>
                    {fmtDT(item.published_at)}{item.profiles?.full_name && ` · ${item.profiles.full_name}`}
                  </div>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:6, flexShrink:0}}>
                  <button onClick={() => handleEdit(item)} style={{fontSize:11, color:'#2980b9', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Изменить</button>
                  <button onClick={() => handleTogglePin(item.id, item.is_pinned)} style={{fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                    {item.is_pinned ? '📌 Откреп' : '📌 Закреп'}
                  </button>
                  {isManagerPlus && (
                    <button onClick={() => loadHistory(item.id)} style={{fontSize:11, color:'#8e44ad', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>История</button>
                  )}
                  {item.is_active && (
                    <button onClick={() => handleDelete(item.id, item.title)} style={{fontSize:11, color:'#e74c3c', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>Архив</button>
                  )}
                </div>
              </div>
              {showHistory === item.id && isManagerPlus && (
                <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #f0f0f0'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                    <div style={{fontSize:12, fontWeight:600, color:'#888'}}>История изменений</div>
                    <button onClick={() => setShowHistory(null)} style={{fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer'}}>Скрыть</button>
                  </div>
                  {history.length === 0 ? <div style={{fontSize:12, color:'#BDBDBD'}}>Изменений нет</div>
                    : history.map(h => (
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
        <div style={{display:'grid', gridTemplateColumns:'1fr 300px', gap:20, alignItems:'start'}}>
          <div>
            {/* Заголовок */}
            <div style={cardStyle}>
              <label style={labelStyle}>Заголовок *</label>
              <RichEditor key={`title-${editingId}`} value={form.title} onChange={v => setForm(f => ({...f, title:v}))} defaultBold minHeight={60} textColor={form.title_color} />
              <div style={{marginTop:12}}>
                <ColorPicker label="Цвет текста заголовка" value={form.title_color} onChange={v => setForm(f => ({...f, title_color:v}))} />
              </div>
            </div>

            {/* Основной текст */}
            <div style={cardStyle}>
              <label style={labelStyle}>Текст новости</label>
              <RichEditor key={`body-${editingId}`} value={form.body} onChange={v => setForm(f => ({...f, body:v}))} minHeight={140} textColor={form.body_color} />
              <div style={{marginTop:12}}>
                <ColorPicker label="Цвет текста" value={form.body_color} onChange={v => setForm(f => ({...f, body_color:v}))} />
              </div>
            </div>

            {/* Фон карточки */}
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>🎨 Фон карточки</div>
              <ColorPicker value={form.card_bg} onChange={v => setForm(f => ({...f, card_bg:v}))} withGradients />
            </div>
          </div>

          <div>
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>Настройки</div>

              <label style={labelStyle}>Тег</label>
              <div style={{display:'flex', gap:6, marginBottom:8}}>
                <select value={form.tag} onChange={e => setForm(f => ({...f, tag:e.target.value}))} style={{...inputStyle, flex:1}}>
                  <option value="">Без тега</option>
                  {tags.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={() => setShowTagsManager(true)}
                  style={{padding:'9px 10px', background:'#f5f5f5', border:'1px solid #e0e0e0', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  🏷
                </button>
              </div>

              {form.tag && (
                <div style={{marginBottom:12}}>
                  <ColorPicker label="Фон тега" value={form.tag_color} onChange={v => setForm(f => ({...f, tag_color:v}))} />
                  <ColorPicker label="Цвет текста тега" value={form.tag_text_color} onChange={v => setForm(f => ({...f, tag_text_color:v}))} />
                </div>
              )}

              <label style={labelStyle}>Отложенная публикация</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({...f, scheduled_at:e.target.value}))}
                style={{...inputStyle, marginBottom:12}} />

              <label style={labelStyle}>Повторение</label>
              <select value={form.repeat_type} onChange={e => setForm(f => ({...f, repeat_type:e.target.value}))} style={{...inputStyle, marginBottom:12}}>
                {Object.entries(REPEAT_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>

              <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
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
                style={{width:'100%', padding:'11px', background:'#BFD900', border:'none', borderRadius:10, fontSize:14, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', opacity: (saving||(!form.title&&!form.body)) ? 0.5 : 1, marginBottom:8}}>
                {saving ? 'Сохраняем...' : editingId ? '💾 Сохранить' : '🚀 Опубликовать'}
              </button>
              <button onClick={() => { setTab('list'); setEditingId(null); setForm(emptyForm()) }}
                style={{width:'100%', padding:'9px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                Отмена
              </button>
            </div>

            <div style={cardStyle}>
              <div style={{fontSize:12, fontWeight:600, color:'#888', marginBottom:10}}>📱 Предпросмотр в ленте</div>
              <Preview />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}