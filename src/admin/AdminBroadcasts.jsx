import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16 }
const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
const labelStyle = { fontSize:12, color:'#888', marginBottom:6, fontWeight:600, display:'block' }
const btnPrimary = { padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif' }

const EMOJIS = ['😊','😂','🔥','❤️','👍','🎉','✅','⚠️','📢','💪','🙏','👋','🎁','💡','📅','🏆','⭐','🎶','💃','🕺','🌟','👏','😍','🤩','💥','🚀','🎯','📌','🔑','💰','🎊','🥳','😎','🙌','💫','✨','🌈','🎵','👑','🏅']
const LOYALTY_LABELS = { adept:'🔥 Адепт', loyal:'💚 Лояльный', edge:'🤔 На грани', risk:'⚠️ Риск ухода' }
const PRODUCT_TYPE_LABELS = { subscription:'Абонемент', service:'Услуга', indiv:'Индив', merch:'Мерч', event:'Мероприятие' }

function RichEditor({ value, onChange, defaultBold = false }) {
  const editorRef = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const isFirstRender = useRef(true)

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

  const insertLink = () => {
    const url = prompt('Введите URL ссылки:')
    if (url) exec('createLink', url)
  }

  const insertEmoji = (emoji) => {
    editorRef.current?.focus()
    document.execCommand('insertText', false, emoji)
    onChange(editorRef.current?.innerHTML || '')
    setShowEmoji(false)
  }

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
        {toolBtn('🔗', insertLink, 'Вставить ссылку')}
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
          minHeight: defaultBold ? 48 : 120,
          padding:'10px 12px',
          border:'1px solid #e8e8e8',
          borderRadius:10,
          fontSize: defaultBold ? 15 : 13,
          fontFamily:'Inter,sans-serif',
          outline:'none',
          lineHeight:1.6,
          fontWeight: defaultBold ? 700 : 400,
          textAlign:'left',
          direction:'ltr',
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

function RecipientFilter({ filters, onChange }) {
  const [groups, setGroups] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    supabase.from('groups').select('id, name').then(({ data }) => setGroups(data || []))
    supabase.from('products').select('id, name, type').eq('is_active', true).order('type').then(({ data }) => setProducts(data || []))
  }, [])

  const toggle = (key) => onChange({...filters, [key]: !filters[key]})
  const set = (key, val) => onChange({...filters, [key]: val})

  const sectionStyle = { background:'#f9f9f9', borderRadius:10, padding:14, marginBottom:10 }
  const checkRow = (label, key) => (
    <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#2a2a2a', cursor:'pointer', marginBottom: filters[key] ? 10 : 0}}>
      <input type="checkbox" checked={!!filters[key]} onChange={() => toggle(key)} style={{accentColor:'#BFD900', width:15, height:15}} />
      <span style={{fontWeight: filters[key] ? 600 : 400}}>{label}</span>
    </label>
  )

  return (
    <div>
      <div style={{fontSize:12, color:'#888', marginBottom:10, background:'#fafde8', borderRadius:8, padding:'8px 12px'}}>
        💡 Фильтры комбинируются — чем больше включено, тем уже аудитория
      </div>

      {/* По продукту */}
      <div style={sectionStyle}>
        {checkRow('По купленному продукту', 'use_product')}
        {filters.use_product && (
          <div style={{paddingLeft:24}}>
            <select value={filters.product_id || ''} onChange={e => set('product_id', e.target.value)} style={{...inputStyle, marginBottom:10}}>
              <option value="">Любой продукт</option>
              {Object.entries(PRODUCT_TYPE_LABELS).map(([type, label]) => {
                const group = products.filter(p => p.type === type)
                if (group.length === 0) return null
                return (
                  <optgroup key={type} label={label}>
                    {group.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                )
              })}
            </select>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              <div>
                <label style={labelStyle}>Дата покупки с</label>
                <input type="date" value={filters.purchase_from || ''} onChange={e => set('purchase_from', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>по</label>
                <input type="date" value={filters.purchase_to || ''} onChange={e => set('purchase_to', e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Нет активного абонемента */}
      <div style={sectionStyle}>
        {checkRow('Нет активного абонемента сейчас', 'no_active_sub')}
      </div>

      {/* По группе */}
      <div style={sectionStyle}>
        {checkRow('По группе', 'use_group')}
        {filters.use_group && (
          <div style={{paddingLeft:24}}>
            <select value={filters.group_id || ''} onChange={e => set('group_id', e.target.value)} style={inputStyle}>
              <option value="">Выберите группу</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* По статусу абонемента */}
      <div style={sectionStyle}>
        {checkRow('По статусу абонемента', 'use_sub_status')}
        {filters.use_sub_status && (
          <div style={{paddingLeft:24}}>
            <select value={filters.subscription_status || 'active'} onChange={e => set('subscription_status', e.target.value)} style={inputStyle}>
              <option value="active">Активный</option>
              <option value="expiring">Истекает за 7 дней</option>
              <option value="expired">Истёк (последние 30 дней)</option>
            </select>
          </div>
        )}
      </div>

      {/* По LTV */}
      <div style={sectionStyle}>
        {checkRow('По сумме покупок (LTV)', 'use_ltv')}
        {filters.use_ltv && (
          <div style={{paddingLeft:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <div>
              <label style={labelStyle}>от ₽</label>
              <input type="number" value={filters.ltv_min || ''} onChange={e => set('ltv_min', e.target.value)} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>до ₽</label>
              <input type="number" value={filters.ltv_max || ''} onChange={e => set('ltv_max', e.target.value)} placeholder="100000" style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {/* По возрасту */}
      <div style={sectionStyle}>
        {checkRow('По возрасту', 'use_age')}
        {filters.use_age && (
          <div style={{paddingLeft:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <div>
              <label style={labelStyle}>от лет</label>
              <input type="number" value={filters.age_min || ''} onChange={e => set('age_min', e.target.value)} placeholder="18" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>до лет</label>
              <input type="number" value={filters.age_max || ''} onChange={e => set('age_max', e.target.value)} placeholder="60" style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {/* По последнему визиту */}
      <div style={sectionStyle}>
        {checkRow('По последнему визиту', 'use_last_visit')}
        {filters.use_last_visit && (
          <div style={{paddingLeft:24}}>
            <label style={labelStyle}>Не приходили более (дней)</label>
            <input type="number" value={filters.last_visit_days || ''} onChange={e => set('last_visit_days', e.target.value)} placeholder="30" style={inputStyle} />
          </div>
        )}
      </div>

      {/* По лояльности */}
      <div style={sectionStyle}>
        {checkRow('По метке лояльности', 'use_loyalty')}
        {filters.use_loyalty && (
          <div style={{paddingLeft:24}}>
            <select value={filters.loyalty_level || ''} onChange={e => set('loyalty_level', e.target.value)} style={inputStyle}>
              <option value="">Выберите уровень</option>
              {Object.entries(LOYALTY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminBroadcasts({ session }) {
  const [tab, setTab] = useState('new')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [channels, setChannels] = useState({ push: true, email: false })
  const [scheduledAt, setScheduledAt] = useState('')
  const [filters, setFilters] = useState({})
  const [templates, setTemplates] = useState([])
  const [broadcasts, setBroadcasts] = useState([])
  const [recipients, setRecipients] = useState([])
  const [excludedIds, setExcludedIds] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  useEffect(() => { loadTemplates(); loadBroadcasts() }, [])

  const loadTemplates = async () => {
    const { data } = await supabase.from('broadcast_templates').select('*').order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  const loadBroadcasts = async () => {
    const { data } = await supabase.from('broadcasts').select('*, profiles:created_by(full_name)').order('created_at', { ascending: false })
    setBroadcasts(data || [])
  }

  const loadRecipients = async () => {
    setLoadingRecipients(true)
    const today = new Date().toISOString().split('T')[0]
    const in7 = new Date(Date.now() + 7*86400000).toISOString().split('T')[0]
    const ago30 = new Date(Date.now() - 30*86400000).toISOString().split('T')[0]

    let query = supabase.from('profiles').select('id, full_name, email, phone, birth_date').eq('role', 'client')

    if (filters.use_age) {
      const now = new Date()
      if (filters.age_min) {
        const maxBirth = new Date(now.getFullYear() - Number(filters.age_min), now.getMonth(), now.getDate()).toISOString().split('T')[0]
        query = query.lte('birth_date', maxBirth)
      }
      if (filters.age_max) {
        const minBirth = new Date(now.getFullYear() - Number(filters.age_max) - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0]
        query = query.gte('birth_date', minBirth)
      }
    }

    const { data: clients } = await query
    let result = clients || []

    if (filters.use_product) {
      let salesQuery = supabase.from('sales').select('client_id').eq('is_cancelled', false)
      if (filters.product_id) salesQuery = salesQuery.eq('product_id', filters.product_id)
      if (filters.purchase_from) salesQuery = salesQuery.gte('sale_date', filters.purchase_from + 'T00:00:00')
      if (filters.purchase_to) salesQuery = salesQuery.lte('sale_date', filters.purchase_to + 'T23:59:59')
      const { data: sales } = await salesQuery
      const clientIds = new Set((sales || []).map(s => s.client_id))
      result = result.filter(c => clientIds.has(c.id))
    }

    if (filters.no_active_sub) {
      const { data: activeSubs } = await supabase.from('subscriptions').select('student_id').gte('expires_at', today).eq('is_frozen', false)
      const activeIds = new Set((activeSubs || []).map(s => s.student_id))
      result = result.filter(c => !activeIds.has(c.id))
    }

    if (filters.use_group && filters.group_id) {
      const { data: subs } = await supabase.from('subscription_allowed_groups')
        .select('subscription_id, subscriptions:subscription_id(student_id)')
        .eq('group_id', filters.group_id)
      const clientIds = new Set((subs || []).map(s => s.subscriptions?.student_id).filter(Boolean))
      result = result.filter(c => clientIds.has(c.id))
    }

    if (filters.use_sub_status) {
      let subQuery = supabase.from('subscriptions').select('student_id')
      const status = filters.subscription_status || 'active'
      if (status === 'active') subQuery = subQuery.gte('expires_at', today)
      if (status === 'expiring') subQuery = subQuery.gte('expires_at', today).lte('expires_at', in7)
      if (status === 'expired') subQuery = subQuery.lt('expires_at', today).gte('expires_at', ago30)
      const { data: subs } = await subQuery
      const clientIds = new Set((subs || []).map(s => s.student_id))
      result = result.filter(c => clientIds.has(c.id))
    }

    if (filters.use_ltv) {
      const { data: sales } = await supabase.from('sales').select('client_id, amount_paid').eq('is_cancelled', false)
      const ltvMap = {}
      ;(sales || []).forEach(s => { ltvMap[s.client_id] = (ltvMap[s.client_id] || 0) + Number(s.amount_paid) })
      result = result.filter(c => {
        const ltv = ltvMap[c.id] || 0
        if (filters.ltv_min && ltv < Number(filters.ltv_min)) return false
        if (filters.ltv_max && ltv > Number(filters.ltv_max)) return false
        return true
      })
    }

    if (filters.use_last_visit && filters.last_visit_days) {
      const cutoff = new Date(Date.now() - filters.last_visit_days * 86400000).toISOString()
      const { data: visits } = await supabase.from('attendance').select('student_id').gte('marked_at', cutoff)
      const recentIds = new Set((visits || []).map(v => v.student_id))
      result = result.filter(c => !recentIds.has(c.id))
    }

    if (filters.use_loyalty && filters.loyalty_level) {
      const { data: loyalty } = await supabase.from('client_loyalty').select('client_id').eq('level', filters.loyalty_level)
      const loyalIds = new Set((loyalty || []).map(l => l.client_id))
      result = result.filter(c => loyalIds.has(c.id))
    }

    setRecipients(result)
    setExcludedIds([])
    setShowPreview(true)
    setLoadingRecipients(false)
  }

  const handleSaveTemplate = async () => {
    if (!templateName) return
    await supabase.from('broadcast_templates').insert({ name: templateName, title, content, created_by: session.user.id })
    setTemplateName(''); setShowSaveTemplate(false)
    loadTemplates()
  }

  const handleSend = async (status = 'sent') => {
    if (!title || !content) { alert('Заполни заголовок и текст'); return }
    setSaving(true)
    const { data: broadcast } = await supabase.from('broadcasts').insert({
      title, content, channel: Object.entries(channels).filter(([,v]) => v).map(([k]) => k).join('+') || 'push', status,
      scheduled_at: scheduledAt || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      created_by: session.user.id,
      filter_type: 'combined',
    }).select().single()

    if (broadcast && recipients.length > 0) {
      const finalRecipients = recipients.filter(r => !excludedIds.includes(r.id))
      await supabase.from('broadcast_recipients').insert(
        finalRecipients.map(r => ({ broadcast_id: broadcast.id, client_id: r.id }))
      )
    }

    setTitle(''); setContent(''); setFilters({}); setScheduledAt(''); setChannels({ push: true, email: false })
    setShowPreview(false); setRecipients([]); setExcludedIds([])
    setSaving(false)
    loadBroadcasts()
    setTab('history')
  }

  const activeRecipients = recipients.filter(r => !excludedIds.includes(r.id))
  const STATUS_LABELS = { draft:'Черновик', scheduled:'Запланирована', sent:'Отправлена', cancelled:'Отменена' }
  const STATUS_COLORS = { draft:'#888', scheduled:'#f39c12', sent:'#27ae60', cancelled:'#e74c3c' }

  return (
    <div>
      <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:'0 0 20px 0'}}>Рассылки</h1>

      <div style={{display:'flex', gap:4, borderBottom:'1px solid #f0f0f0', marginBottom:20}}>
        {[['new','✍️ Новая рассылка'], ['templates','📋 Шаблоны'], ['history','📜 История']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{padding:'10px 16px', background:'transparent', border:'none', borderBottom: tab===v ? '2px solid #BFD900' : '2px solid transparent', fontSize:13, fontWeight: tab===v ? 600 : 400, color: tab===v ? '#2a2a2a' : '#888', cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap'}}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 340px', gap:20, alignItems:'start'}}>
          <div>
            <div style={cardStyle}>
              <label style={labelStyle}>Заголовок сообщения *</label>
              <RichEditor value={title} onChange={setTitle} defaultBold />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Текст сообщения *</label>
              <RichEditor value={content} onChange={setContent} />
            </div>

            {/* Сохранить как шаблон — после заголовка и текста */}
            {(title || content) && (
              <div style={cardStyle}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a'}}>💾 Сохранить как шаблон</div>
                  <button onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                    style={{fontSize:12, color:'#2980b9', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                    {showSaveTemplate ? 'Скрыть' : 'Развернуть'}
                  </button>
                </div>
                {showSaveTemplate && (
                  <div style={{marginTop:12, display:'flex', gap:8}}>
                    <input value={templateName} onChange={e => setTemplateName(e.target.value)}
                      placeholder="Название шаблона" style={{...inputStyle, marginBottom:0, flex:1}} />
                    <button onClick={handleSaveTemplate} style={{...btnPrimary, padding:'8px 14px', fontSize:12, whiteSpace:'nowrap'}}>Сохранить</button>
                  </div>
                )}
              </div>
            )}

            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>Получатели</div>
              <RecipientFilter filters={filters} onChange={setFilters} />
              <button onClick={loadRecipients} disabled={loadingRecipients}
                style={{...btnPrimary, marginTop:8, width:'100%', opacity: loadingRecipients ? 0.7 : 1}}>
                {loadingRecipients ? 'Загружаем...' : '👥 Подобрать получателей'}
              </button>
            </div>

            {showPreview && (
              <div style={cardStyle}>
                <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>
                  Получатели
                  <span style={{marginLeft:8, fontSize:13, color:'#BFD900', fontWeight:700}}>{activeRecipients.length}</span>
                  <span style={{fontSize:12, color:'#BDBDBD', fontWeight:400}}> из {recipients.length}</span>
                </div>
                {recipients.length === 0 ? (
                  <div style={{fontSize:12, color:'#BDBDBD'}}>По выбранным фильтрам никого не найдено</div>
                ) : (
                  <div style={{maxHeight:300, overflowY:'auto'}}>
                    {recipients.map(r => {
                      const excluded = excludedIds.includes(r.id)
                      return (
                        <div key={r.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f8f8f8', opacity: excluded ? 0.4 : 1}}>
                          <div>
                            <div style={{fontSize:13, fontWeight:500, color:'#2a2a2a', textDecoration: excluded ? 'line-through' : 'none'}}>{r.full_name || r.email}</div>
                            <div style={{fontSize:11, color:'#BDBDBD'}}>{r.phone || r.email}</div>
                          </div>
                          <button onClick={() => setExcludedIds(p => p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id])}
                            style={{fontSize:11, color: excluded ? '#27ae60' : '#e74c3c', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                            {excluded ? '+ Вернуть' : '× Убрать'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div style={cardStyle}>
              <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>Настройки отправки</div>
              <label style={labelStyle}>Канал</label>
              <div style={{display:'flex', gap:8, marginBottom:16}}>
                {[['push','📱 Пуш'], ['email','📧 Email']].map(([v,l]) => (
                  <label key={v} style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'9px', borderRadius:10, border: channels[v] ? 'none' : '1px solid #e0e0e0', background: channels[v] ? '#BFD900' : '#fff', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: channels[v] ? 600 : 400}}>
                    <input type="checkbox" checked={!!channels[v]} onChange={() => setChannels(p => ({...p, [v]: !p[v]}))} style={{accentColor:'#2a2a2a'}} />
                    {l}
                  </label>
                ))}
              </div>
              <label style={labelStyle}>Отложить отправку</label>
              <input value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} type="datetime-local"
                style={{...inputStyle, marginBottom:16}} />
              {scheduledAt && <div style={{fontSize:11, color:'#f39c12', marginBottom:12}}>⏰ Запланировано на {new Date(scheduledAt).toLocaleString('ru-RU')}</div>}
              {showPreview && activeRecipients.length > 0 && (
                <div style={{background:'#fafde8', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#6a7700', fontWeight:600}}>
                  📤 Получат: {activeRecipients.length} чел.
                </div>
              )}
              <button onClick={() => handleSend(scheduledAt ? 'scheduled' : 'sent')} disabled={saving || !title || !content}
                style={{...btnPrimary, width:'100%', fontSize:14, padding:'12px', opacity: (saving || !title || !content) ? 0.5 : 1}}>
                {saving ? 'Отправляем...' : scheduledAt ? '⏰ Запланировать' : '🚀 Отправить'}
              </button>
              <button onClick={() => handleSend('draft')} disabled={saving}
                style={{width:'100%', padding:'10px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif', marginTop:8}}>
                Сохранить черновик
              </button>
            </div>

            {(title || content) && (
              <div style={cardStyle}>
                <div style={{fontSize:12, color:'#888', marginBottom:10, fontWeight:600}}>Предпросмотр</div>
                <div style={{background:'#f9f9f9', borderRadius:10, padding:14}}>
                  {title && <div style={{fontSize:13, fontWeight:700, color:'#2a2a2a', marginBottom:6}} dangerouslySetInnerHTML={{ __html: title }} />}
                  {content && <div style={{fontSize:12, color:'#3a3a3a', lineHeight:1.6}} dangerouslySetInnerHTML={{ __html: content }} />}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div>
          {templates.length === 0 ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>
              Шаблонов пока нет — сохрани первый при создании рассылки
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12}}>
              {templates.map(t => (
                <div key={t.id} style={cardStyle}>
                  <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:8}}>{t.name}</div>
                  <div style={{fontSize:12, color:'#888', marginBottom:12, lineHeight:1.5, maxHeight:60, overflow:'hidden'}}
                    dangerouslySetInnerHTML={{ __html: t.content }} />
                  <div style={{display:'flex', gap:8}}>
                    <button onClick={() => { setTitle(t.title || ''); setContent(t.content || ''); setTab('new') }}
                      style={{flex:1, padding:'7px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                      Использовать
                    </button>
                    <button onClick={async () => { if (confirm('Удалить шаблон?')) { await supabase.from('broadcast_templates').delete().eq('id', t.id); loadTemplates() } }}
                      style={{padding:'7px 12px', background:'#fdecea', border:'none', borderRadius:8, fontSize:12, color:'#e74c3c', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {broadcasts.length === 0 ? (
            <div style={{textAlign:'center', color:'#BDBDBD', padding:60, background:'#fff', borderRadius:14, border:'1px solid #f0f0f0'}}>
              Рассылок пока не было
            </div>
          ) : (
            <div style={{background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', overflow:'hidden'}}>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #f0f0f0'}}>
                    {['Заголовок','Канал','Статус','Получателей','Дата','Автор'].map((h,i) => (
                      <th key={i} style={{textAlign:'left', padding:'12px 16px', fontSize:11, color:'#BDBDBD', fontWeight:400, textTransform:'uppercase', letterSpacing:'0.06em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.map(b => (
                    <tr key={b.id} style={{borderBottom:'1px solid #f8f8f8'}}>
                      <td style={{padding:'12px 16px', fontSize:13, fontWeight:500, color:'#2a2a2a'}}
                        dangerouslySetInnerHTML={{ __html: b.title }} />
                      <td style={{padding:'12px 16px', fontSize:12, color:'#888'}}>{b.channel === 'push' ? '📱 Пуш' : '📧 Email'}</td>
                      <td style={{padding:'12px 16px'}}>
                        <span style={{fontSize:11, fontWeight:600, color: STATUS_COLORS[b.status], background: STATUS_COLORS[b.status]+'22', padding:'2px 8px', borderRadius:6}}>
                          {STATUS_LABELS[b.status]}
                        </span>
                      </td>
                      <td style={{padding:'12px 16px', fontSize:12, color:'#888'}}>—</td>
                      <td style={{padding:'12px 16px', fontSize:12, color:'#888', whiteSpace:'nowrap'}}>
                        {new Date(b.created_at).toLocaleDateString('ru-RU', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}
                      </td>
                      <td style={{padding:'12px 16px', fontSize:12, color:'#888'}}>{b.profiles?.full_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}