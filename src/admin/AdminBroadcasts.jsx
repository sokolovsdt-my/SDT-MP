import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { safeHtml } from '../utils/safeHtml'

const cardStyle = { background:'#fff', borderRadius:14, border:'1px solid #f0f0f0', padding:20, marginBottom:16 }
const inputStyle = { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e8', borderRadius:10, fontSize:13, boxSizing:'border-box', fontFamily:'Inter,sans-serif' }
const labelStyle = { fontSize:12, color:'#888', marginBottom:6, fontWeight:600, display:'block' }
const btnPrimary = { padding:'9px 20px', background:'#BFD900', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif' }

const EMOJIS = ['😊','😂','🔥','❤️','👍','🎉','✅','⚠️','📢','💪','🙏','👋','🎁','💡','📅','🏆','⭐','🎶','💃','🕺','🌟','👏','😍','🤩','💥','🚀','🎯','📌','🔑','💰','🎊','🥳','😎','🙌','💫','✨','🌈','🎵','👑','🏅']
const LOYALTY_LABELS = { adept:'👑 Адепт', loyal:'💚 Лояльный', edge:'🤔 На грани', risk:'⚠️ Риск ухода' }
const PRODUCT_TYPE_LABELS = { subscription:'Абонемент', service:'Услуга', indiv:'Индив', merch:'Мерч', event:'Мероприятие' }

function RichEditor({ value, onChange, defaultBold = false }) {
  const editorRef = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)

  // Синхронизируем innerHTML с пропсом value, когда он меняется ИЗВНЕ
  // (например, «Использовать шаблон» меняет setTitle/setContent в родителе).
  // Не пишем во время фокуса — иначе сломается каретка во время набора.
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const focused = document.activeElement === el
    const incoming = value || ''
    if (!focused && el.innerHTML !== incoming) {
      el.innerHTML = incoming
    }
  }, [value])

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

// Множественный выбор с поиском. options: [{value, label, group?}].
// Выбранные показываются плашками сверху (можно убрать крестиком), снизу
// поиск + список совпадений. Удобно для 30+ элементов в отличие от чекбоксов.
function PillsMultiSelect({ options, selected, onChange, placeholder = 'Найти и добавить...', groupLabels }) {
  const [query, setQuery] = useState('')
  const selectedSet = new Set(selected)
  const visibleOptions = options.filter(o =>
    !selectedSet.has(o.value) &&
    (!query || o.label.toLowerCase().includes(query.toLowerCase()))
  )
  const grouped = {}
  visibleOptions.forEach(o => {
    const key = o.group || ''
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(o)
  })
  const orderedGroups = Object.keys(grouped).sort()

  const add = (val) => { onChange([...selected, val]); setQuery('') }
  const remove = (val) => onChange(selected.filter(v => v !== val))

  return (
    <div>
      {/* Pills выбранных */}
      {selected.length > 0 && (
        <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:8}}>
          {selected.map(val => {
            const opt = options.find(o => o.value === val)
            return (
              <span key={val} style={{display:'inline-flex', alignItems:'center', gap:6, background:'#fafde8', border:'1px solid #BFD900', borderRadius:20, padding:'4px 10px', fontSize:12, color:'#2a2a2a'}}>
                {opt?.label || val}
                <button type="button" onClick={() => remove(val)}
                  style={{background:'none', border:'none', cursor:'pointer', color:'#888', padding:0, fontSize:14, lineHeight:1}}>×</button>
              </span>
            )
          })}
        </div>
      )}
      {/* Поиск */}
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder}
        style={{...inputStyle, marginBottom: visibleOptions.length > 0 && (query || selected.length === 0) ? 6 : 0}} />
      {/* Список */}
      {(query || selected.length === 0) && visibleOptions.length > 0 && (
        <div style={{maxHeight:180, overflowY:'auto', background:'#fff', border:'1px solid #f0f0f0', borderRadius:10}}>
          {orderedGroups.map(g => (
            <div key={g}>
              {g && <div style={{padding:'6px 12px', fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', background:'#f9f9f9'}}>{groupLabels?.[g] || g}</div>}
              {grouped[g].map(o => (
                <div key={o.value} onClick={() => add(o.value)}
                  style={{padding:'8px 12px', cursor:'pointer', fontSize:13, color:'#2a2a2a', borderBottom:'1px solid #f8f8f8'}}
                  onMouseEnter={e => e.currentTarget.style.background='#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                  {o.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecipientFilter({ filters, onChange }) {
  const [groups, setGroups] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    let cancelled = false
    // Только открытые группы — закрытые в фильтр не предлагаем.
    supabase.from('groups').select('id, name').eq('is_closed', false).order('name').then(({ data }) => { if (!cancelled) setGroups(data || []) })
    // Активные продукты всех типов — список тянется динамически, никакого хардкода.
    supabase.from('products').select('id, name, type').eq('is_active', true).order('type').order('name').then(({ data }) => { if (!cancelled) setProducts(data || []) })
    return () => { cancelled = true }
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

  const productOptions = products.map(p => ({ value: p.id, label: p.name, group: p.type }))
  const groupOptions   = groups.map(g => ({ value: g.id, label: g.name }))
  const loyaltyOptions = [
    ...Object.entries(LOYALTY_LABELS).map(([k, v]) => ({ value: k, label: v })),
    { value: 'none', label: '⚪ Без метки' },
  ]

  return (
    <div>
      <div style={{fontSize:12, color:'#888', marginBottom:10, background:'#fafde8', borderRadius:8, padding:'8px 12px'}}>
        💡 Фильтры комбинируются — чем больше включено, тем уже аудитория
      </div>

      {/* По купленным продуктам (множественный) */}
      <div style={sectionStyle}>
        {checkRow('По купленным продуктам', 'use_product')}
        {filters.use_product && (
          <div style={{paddingLeft:24}}>
            <PillsMultiSelect
              options={productOptions}
              selected={filters.product_ids || []}
              onChange={vals => set('product_ids', vals)}
              placeholder="Поиск продукта..."
              groupLabels={PRODUCT_TYPE_LABELS}
            />
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10}}>
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

      {/* По группам (множественный) */}
      <div style={sectionStyle}>
        {checkRow('По группам', 'use_group')}
        {filters.use_group && (
          <div style={{paddingLeft:24}}>
            <PillsMultiSelect
              options={groupOptions}
              selected={filters.group_ids || []}
              onChange={vals => set('group_ids', vals)}
              placeholder="Поиск группы..."
            />
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

      {/* По лояльности (множественный + 'Без метки') */}
      <div style={sectionStyle}>
        {checkRow('По меткам лояльности', 'use_loyalty')}
        {filters.use_loyalty && (
          <div style={{paddingLeft:24}}>
            <PillsMultiSelect
              options={loyaltyOptions}
              selected={filters.loyalty_levels || []}
              onChange={vals => set('loyalty_levels', vals)}
              placeholder="Поиск метки..."
            />
          </div>
        )}
      </div>

      {/* По пуш-уведомлениям */}
      <div style={sectionStyle}>
        {checkRow('По пуш-уведомлениям', 'use_push')}
        {filters.use_push && (
          <div style={{paddingLeft:24, display:'flex', gap:8}}>
            {[
              ['with_push',    '📱 Только с пушем'],
              ['without_push', '🚫 Только без пуша'],
            ].map(([v, l]) => (
              <label key={v} style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:10, border: filters.push_filter === v ? '1.5px solid #BFD900' : '1px solid #e0e0e0', background: filters.push_filter === v ? '#fafde8' : '#fff', fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: filters.push_filter === v ? 600 : 400}}>
                <input type="radio" name="push_filter" value={v} checked={filters.push_filter === v} onChange={() => set('push_filter', v)} style={{accentColor:'#BFD900'}} />
                {l}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Новые клиенты */}
      <div style={sectionStyle}>
        {checkRow('Новые клиенты', 'use_registered')}
        {filters.use_registered && (
          <div style={{paddingLeft:24}}>
            <label style={labelStyle}>Зарегистрировались за последние (дней)</label>
            <input type="number" value={filters.registered_days || ''} onChange={e => set('registered_days', e.target.value)} placeholder="30" style={inputStyle} />
          </div>
        )}
      </div>

      {/* Именинники */}
      <div style={sectionStyle}>
        {checkRow('Именинники', 'use_birthday')}
        {filters.use_birthday && (
          <div style={{paddingLeft:24}}>
            <label style={labelStyle}>День рождения в ближайшие (дней)</label>
            <input type="number" value={filters.birthday_days ?? ''} onChange={e => set('birthday_days', e.target.value)} placeholder="7" style={inputStyle} />
          </div>
        )}
      </div>

      {/* Исключить уже получавших */}
      <div style={sectionStyle}>
        {checkRow('Не отправлять уже получавшим', 'use_exclude_received')}
        {filters.use_exclude_received && (
          <div style={{paddingLeft:24}}>
            <label style={labelStyle}>Получали рассылку за последние (дней)</label>
            <input type="number" value={filters.exclude_received_days || ''} onChange={e => set('exclude_received_days', e.target.value)} placeholder="14" style={inputStyle} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Авторассылки ───────────────────────────────────────────────────────────
function AutoBirthdaySettings({ auto, onClose, onSaved, session }) {
  const [title, setTitle] = useState(auto.title || '')
  const [content, setContent] = useState(auto.content || '')
  const [channel, setChannel] = useState(auto.channel || 'push')
  const [sendTime, setSendTime] = useState((auto.send_time || '10:00:00').slice(0, 5))
  const [daysBefore, setDaysBefore] = useState(auto.days_before ?? 0)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const { error } = await supabase.from('auto_broadcasts').update({
      title, content, channel,
      send_time:   sendTime + ':00',
      days_before: Number(daysBefore) || 0,
      updated_by:  session.user.id,
      updated_at:  new Date().toISOString(),
    }).eq('id', auto.id)
    setSaving(false)
    if (error) { alert('Не удалось сохранить: ' + error.message); return }
    onSaved()
    onClose()
  }

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'#fff', borderRadius:16, padding:24, width:520, maxHeight:'90vh', overflowY:'auto', fontFamily:'Inter,sans-serif'}}>
        <div style={{fontSize:16, fontWeight:700, color:'#2a2a2a', marginBottom:16}}>🎂 Настройка поздравления с днём рождения</div>

        <div style={{marginBottom:14}}>
          <label style={labelStyle}>Заголовок сообщения</label>
          <RichEditor value={title} onChange={setTitle} defaultBold />
        </div>

        <div style={{marginBottom:14}}>
          <label style={labelStyle}>Текст поздравления</label>
          <RichEditor value={content} onChange={setContent} />
        </div>

        <div style={{marginBottom:14}}>
          <label style={labelStyle}>Канал</label>
          <div style={{display:'flex', gap:8}}>
            {[['push','📱 Пуш'], ['email','📧 Email'], ['push+email','📱+📧 Оба']].map(([v,l]) => (
              <label key={v} style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:10, border: channel === v ? '1.5px solid #BFD900' : '1px solid #e0e0e0', background: channel === v ? '#fafde8' : '#fff', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight: channel === v ? 600 : 400}}>
                <input type="radio" name="ab_channel" value={v} checked={channel === v} onChange={() => setChannel(v)} style={{accentColor:'#BFD900'}} />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18}}>
          <div>
            <label style={labelStyle}>Время отправки (МСК)</label>
            <input type="time" value={sendTime} onChange={e => setSendTime(e.target.value)} style={inputStyle} />
            <div style={{fontSize:11, color:'#BDBDBD', marginTop:4}}>cron сейчас фиксирован на 10:00 МСК — поле сохранится, но используется не будет</div>
          </div>
          <div>
            <label style={labelStyle}>За сколько дней до ДР</label>
            <input type="number" min="0" value={daysBefore} onChange={e => setDaysBefore(e.target.value)} style={inputStyle} />
            <div style={{fontSize:11, color:'#BDBDBD', marginTop:4}}>0 = в день ДР; 7 = за неделю</div>
          </div>
        </div>

        <div style={{display:'flex', gap:8}}>
          <button onClick={handleSave} disabled={saving}
            style={{...btnPrimary, flex:1, opacity: saving ? 0.5 : 1}}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
          <button onClick={onClose}
            style={{padding:'10px 16px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, color:'#888', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// Один день расписания авторассылки. kind:
//   'past'   — вчера: показываем факт (доставлено / упало / должны были но cron не сработал)
//   'today'  — сегодня: микс факта (если cron уже отработал) и плана (если ещё нет)
//   'future' — завтра: только план
function ScheduleDay({ label, day, kind, isActive }) {
  if (!day) return null
  const fmtDate = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

  const statusBadge = (item) => {
    if (item.run) {
      if (item.run.channels_sent && !item.run.error) {
        return <span style={{fontSize:10, fontWeight:700, color:'#27ae60', background:'#eafaf1', padding:'1px 6px', borderRadius:4}}>✓ {item.run.channels_sent}</span>
      }
      if (item.run.error === 'no_contact_channels') {
        return <span style={{fontSize:10, fontWeight:700, color:'#888', background:'#f5f5f5', padding:'1px 6px', borderRadius:4}}>📭 нет каналов</span>
      }
      return <span style={{fontSize:10, fontWeight:700, color:'#e74c3c', background:'#fdecea', padding:'1px 6px', borderRadius:4}} title={item.run.error || ''}>✗ ошибка</span>
    }
    if (kind === 'past') {
      return <span style={{fontSize:10, fontWeight:700, color:'#f39c12', background:'#fef9e7', padding:'1px 6px', borderRadius:4}} title="cron не сработал или авторассылка была выключена">⌛ пропущено</span>
    }
    if (kind === 'today' || kind === 'future') {
      return <span style={{fontSize:10, fontWeight:700, color:'#2980b9', background:'#e8f4fd', padding:'1px 6px', borderRadius:4}}>📋 запланировано</span>
    }
    return null
  }

  const headerColor = kind === 'today' ? '#6a7700' : '#888'
  const headerBg    = kind === 'today' ? '#fafde8' : '#fff'

  return (
    <div style={{marginBottom:10}}>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background: headerBg, borderRadius:8, marginBottom:4}}>
        <span style={{fontSize:12, fontWeight:700, color: headerColor}}>{label}</span>
        <span style={{fontSize:11, color:'#BDBDBD'}}>{fmtDate(day.date)}</span>
        <span style={{fontSize:11, color:'#888', marginLeft:'auto'}}>
          {day.items.length === 0 ? 'никого' : `${day.items.length} чел.`}
        </span>
      </div>
      {day.items.length > 0 && (
        <div style={{paddingLeft:8}}>
          {day.items.map((it, idx) => (
            <div key={it.client.id} style={{display:'flex', alignItems:'center', gap:8, padding:'4px 6px', borderBottom: idx < day.items.length - 1 ? '1px solid #f0f0f0' : 'none', fontSize:12}}>
              <span style={{flex:1, color:'#2a2a2a'}}>{it.client.full_name || it.client.email || '—'}</span>
              <span style={{fontSize:11, color:'#BDBDBD', display:'flex', gap:4}}>
                <span title={it.client.email ? `email: ${it.client.email}` : 'нет email'} style={{opacity: it.client.email ? 1 : 0.3}}>📧</span>
                <span title={it.client.push_token ? 'есть push' : 'нет push'} style={{opacity: it.client.push_token ? 1 : 0.3}}>📱</span>
              </span>
              {isActive ? statusBadge(it) : (
                <span style={{fontSize:10, fontWeight:700, color:'#888', background:'#f5f5f5', padding:'1px 6px', borderRadius:4}}>выключено</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AutoTab({ session }) {
  const [autos, setAutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  // schedules[autoId] = { yesterday: [...], today: [...], tomorrow: [...] }
  // Каждый элемент: { client: {id, full_name, email, push_token, birth_date},
  //                   run: { channels_sent, error } | null,  // null = ещё не было / в будущем
  //                   day: 'yesterday'|'today'|'tomorrow' }
  const [schedules, setSchedules] = useState({})
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: autosList } = await supabase.from('auto_broadcasts').select('*').order('type')
    setAutos(autosList || [])
    setLoading(false)

    // Грузим всех клиентов с ДР + runs за вчера/сегодня/завтра одним заходом
    const { data: clients } = await supabase.from('profiles')
      .select('id, full_name, email, push_token, birth_date')
      .eq('role','client').not('birth_date','is',null)

    const sch = {}
    for (const a of autosList || []) {
      if (a.type !== 'birthday') continue
      sch[a.id] = await buildBirthdaySchedule(a, clients || [])
    }
    setSchedules(sch)
  }

  // Считаем ключ MM-DD для произвольной даты
  const mdKey = (date) => {
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${m}-${d}`
  }
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

  const matchBirthday = (birthDateStr, target) => {
    const bd = new Date(birthDateStr)
    const bdKey = mdKey(bd)
    const targetKey = mdKey(target)
    if (bdKey === targetKey) return true
    // 29 февраля → 28 февраля в невисокосный год
    if (bdKey === '02-29' && targetKey === '02-28' && !isLeap(target.getFullYear())) return true
    return false
  }

  const buildBirthdaySchedule = async (auto, clients) => {
    // День отправки = run_date. День ДР клиента = run_date + days_before.
    const nowMsk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }))
    const mkDay  = (offset) => {
      const d = new Date(nowMsk); d.setDate(d.getDate() + offset); d.setHours(0,0,0,0); return d
    }
    const yesterday = mkDay(-1)
    const today     = mkDay(0)
    const tomorrow  = mkDay(1)

    // Кандидаты на каждый день: клиенты у кого ДР приходится на runDate + days_before
    const candidatesFor = (runDate) => {
      const targetBday = new Date(runDate)
      targetBday.setDate(targetBday.getDate() + (auto.days_before || 0))
      return clients.filter(c => matchBirthday(c.birth_date, targetBday))
    }

    // Реальные runs (для вчера/сегодня)
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const { data: runs } = await supabase.from('auto_broadcast_runs')
      .select('recipient_id, channels_sent, error, run_date')
      .eq('auto_id', auto.id)
      .gte('run_date', fmt(yesterday))
      .lte('run_date', fmt(tomorrow))

    const runByDay = { yesterday: {}, today: {}, tomorrow: {} }
    ;(runs || []).forEach(r => {
      const key = r.run_date === fmt(yesterday) ? 'yesterday' :
                  r.run_date === fmt(today)     ? 'today'     :
                  r.run_date === fmt(tomorrow)  ? 'tomorrow'  : null
      if (key) runByDay[key][r.recipient_id] = r
    })

    // Объединяем: кандидаты + те кто реально получил (могли получить даже не из кандидатов
    // если ДР клиента поменяли после запуска)
    const buildDay = (runDate, dayKey) => {
      const cands = candidatesFor(runDate)
      const result = cands.map(c => ({ client: c, run: runByDay[dayKey][c.id] || null, day: dayKey }))
      // Если в runs есть кто-то кого нет в текущих кандидатах — добавим
      const candIds = new Set(cands.map(c => c.id))
      Object.values(runByDay[dayKey]).forEach(r => {
        if (!candIds.has(r.recipient_id)) {
          const cl = clients.find(c => c.id === r.recipient_id)
          if (cl) result.push({ client: cl, run: r, day: dayKey })
        }
      })
      return result.sort((a, b) => (a.client.full_name || '').localeCompare(b.client.full_name || ''))
    }

    return {
      yesterday: { date: yesterday, items: buildDay(yesterday, 'yesterday') },
      today:     { date: today,     items: buildDay(today,     'today') },
      tomorrow:  { date: tomorrow,  items: buildDay(tomorrow,  'tomorrow') },
    }
  }

  const handleToggle = async (auto) => {
    if (togglingId) return
    setTogglingId(auto.id)
    const { error } = await supabase.from('auto_broadcasts').update({
      is_active:  !auto.is_active,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    }).eq('id', auto.id)
    setTogglingId(null)
    if (error) { alert('Не удалось переключить: ' + error.message); return }
    load()
  }

  if (loading) return <div style={{textAlign:'center', color:'#BDBDBD', padding:60}}>Загрузка...</div>

  return (
    <div>
      {editing && (
        <AutoBirthdaySettings auto={editing} session={session}
          onClose={() => setEditing(null)} onSaved={load} />
      )}

      {autos.map(a => {
        if (a.type !== 'birthday') return null
        const sched = schedules[a.id]
        return (
          <div key={a.id} style={{...cardStyle, padding:24}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
              <div style={{flex:1}}>
                <div style={{fontSize:18, fontWeight:600, color:'#2a2a2a', marginBottom:6}}>🎂 Поздравление с днём рождения</div>
                <div style={{fontSize:13, color:'#888', lineHeight:1.5}}>
                  {a.is_active
                    ? <>Активна. Отправка ежедневно в 10:00 МСК. Канал: <strong>{a.channel === 'push' ? '📱 Пуш' : a.channel === 'email' ? '📧 Email' : '📱+📧 Оба'}</strong>{a.days_before > 0 ? `, за ${a.days_before} дн. до ДР` : ', в день ДР'}.</>
                    : <>Выключена. Включи тумблером справа чтобы клиенты автоматически получали поздравление.</>
                  }
                </div>
              </div>
              {/* Тумблер */}
              <button onClick={() => handleToggle(a)} disabled={togglingId === a.id}
                style={{
                  position:'relative', width:48, height:26, borderRadius:13,
                  background: a.is_active ? '#BFD900' : '#e0e0e0',
                  border:'none', cursor: togglingId === a.id ? 'default' : 'pointer',
                  transition:'background 0.2s', opacity: togglingId === a.id ? 0.5 : 1,
                  flexShrink:0, marginLeft:16,
                }}>
                <div style={{
                  position:'absolute', top:3, left: a.is_active ? 25 : 3,
                  width:20, height:20, borderRadius:'50%', background:'#fff',
                  transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>

            {/* Расписание отправок: вчера / сегодня / завтра */}
            {sched && (
              <div style={{background:'#f9f9f9', borderRadius:12, padding:14, marginBottom:14}}>
                <div style={{fontSize:12, color:'#888', fontWeight:600, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em'}}>
                  📅 Расписание отправок
                </div>
                <ScheduleDay label="Вчера"   day={sched.yesterday} kind="past"   isActive={a.is_active} />
                <ScheduleDay label="Сегодня" day={sched.today}     kind="today"  isActive={a.is_active} />
                <ScheduleDay label="Завтра"  day={sched.tomorrow}  kind="future" isActive={a.is_active} />
              </div>
            )}

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontSize:12, color:'#BDBDBD'}}>
                Отправлено за всё время: <strong style={{color:'#2a2a2a'}}>{a.sent_count || 0}</strong>
              </div>
              <button onClick={() => setEditing(a)}
                style={{padding:'8px 16px', background:'#f5f5f5', border:'none', borderRadius:10, fontSize:13, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600}}>
                ⚙️ Настроить
              </button>
            </div>
          </div>
        )
      })}

      <div style={{fontSize:12, color:'#BDBDBD', textAlign:'center', marginTop:16}}>
        Скоро здесь появятся: «За N дней до окончания абонемента», «Через N дней после регистрации» и др.
      </div>
    </div>
  )
}

export default function AdminBroadcasts({ session }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'new'
  const setTab = (t) => {
    const next = new URLSearchParams(searchParams)
    if (t === 'new') next.delete('tab'); else next.set('tab', t)
    setSearchParams(next, { replace: true })
  }
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

  // mounted-флаг — чтобы не делать setState на размонтированном компоненте
  // при возврате из долгих сетевых запросов.
  const mountedRef = useRef(true)
  useEffect(() => { return () => { mountedRef.current = false } }, [])

  useEffect(() => { loadTemplates(); loadBroadcasts() }, [])

  const loadTemplates = async () => {
    const { data, error } = await supabase.from('broadcast_templates').select('*').order('created_at', { ascending: false })
    if (!mountedRef.current) return
    if (error) { console.error('loadTemplates:', error); setTemplates([]); return }
    setTemplates(data || [])
  }

  const loadBroadcasts = async () => {
    // recipients_count подтягиваем агрегатом через PostgREST: broadcast_recipients(count)
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*, profiles:created_by(full_name), recipients:broadcast_recipients(count)')
      .order('created_at', { ascending: false })
    if (!mountedRef.current) return
    if (error) { console.error('loadBroadcasts:', error); setBroadcasts([]); return }
    setBroadcasts((data || []).map(b => ({
      ...b,
      recipients_count: b.recipients?.[0]?.count ?? 0,
    })))
  }

  // Сборка payload для RPC: только реально включённые UI-фильтры пробрасываем дальше.
  const buildRpcFilters = () => {
    const f = {}
    if (filters.use_product) {
      const ids = (filters.product_ids || []).filter(Boolean)
      if (ids.length > 0)        f.product_ids   = ids
      if (filters.purchase_from) f.purchase_from = filters.purchase_from
      if (filters.purchase_to)   f.purchase_to   = filters.purchase_to
    }
    if (filters.no_active_sub) f.no_active_sub = true
    if (filters.use_group) {
      const ids = (filters.group_ids || []).filter(Boolean)
      if (ids.length > 0) f.group_ids = ids
    }
    if (filters.use_sub_status) f.subscription_status = filters.subscription_status || 'active'
    if (filters.use_ltv) {
      if (filters.ltv_min !== '' && filters.ltv_min != null) f.ltv_min = Number(filters.ltv_min)
      if (filters.ltv_max !== '' && filters.ltv_max != null) f.ltv_max = Number(filters.ltv_max)
    }
    if (filters.use_age) {
      if (filters.age_min !== '' && filters.age_min != null) f.age_min = Number(filters.age_min)
      if (filters.age_max !== '' && filters.age_max != null) f.age_max = Number(filters.age_max)
    }
    if (filters.use_last_visit && filters.last_visit_days) f.last_visit_days = Number(filters.last_visit_days)
    if (filters.use_loyalty) {
      const lv = (filters.loyalty_levels || []).filter(Boolean)
      if (lv.length > 0) f.loyalty_levels = lv
    }
    if (filters.use_push && filters.push_filter)              f.push_filter           = filters.push_filter
    if (filters.use_registered && filters.registered_days)    f.registered_days       = Number(filters.registered_days)
    if (filters.use_birthday && filters.birthday_days != null && filters.birthday_days !== '')
      f.birthday_days = Number(filters.birthday_days)
    if (filters.use_exclude_received && filters.exclude_received_days)
      f.exclude_received_days = Number(filters.exclude_received_days)
    return f
  }

  const loadRecipients = async () => {
    setLoadingRecipients(true)
    const { data, error } = await supabase.rpc('recipients_for_broadcast', { p_filters: buildRpcFilters() })
    if (!mountedRef.current) return
    if (error) {
      const msg = {
        not_authenticated: 'Сессия истекла, войдите заново',
        forbidden:         'Недостаточно прав для подбора аудитории',
      }[error.message] || `Не удалось подобрать аудиторию: ${error.message}`
      alert(msg)
      setLoadingRecipients(false)
      return
    }
    setRecipients(data || [])
    setExcludedIds([])
    setShowPreview(true)
    setLoadingRecipients(false)
  }

  const [savingTemplate, setSavingTemplate] = useState(false)
  const [deletingTemplateId, setDeletingTemplateId] = useState(null)
  const [manualQuery, setManualQuery] = useState('')
  const [manualResults, setManualResults] = useState([])
  const [sendingTest, setSendingTest] = useState(false)

  // Поиск клиента для ручного добавления в список получателей.
  const handleManualSearch = async (val) => {
    setManualQuery(val)
    if (val.length < 2) { setManualResults([]); return }
    const { data } = await supabase.from('profiles')
      .select('id, full_name, email, phone, push_token')
      .eq('role', 'client')
      .or(`full_name.ilike.%${val}%,phone.ilike.%${val}%,email.ilike.%${val}%`)
      .limit(8)
    setManualResults(data || [])
  }

  const handleManualAdd = (client) => {
    if (recipients.find(r => r.id === client.id)) {
      setManualQuery(''); setManualResults([])
      return
    }
    setRecipients(prev => [...prev, client])
    setManualQuery(''); setManualResults([])
    if (!showPreview) setShowPreview(true)
  }

  // Тестовая отправка только себе — не загрязняет историю чужими получателями.
  // Создаёт обычную рассылку с одним получателем (текущий админ) + помечает в title
  // префиксом [ТЕСТ], чтоб в истории видно было.
  const handleSendTest = async () => {
    if (sendingTest) return
    if (!title || !content) { alert('Заполни заголовок и текст'); return }
    setSendingTest(true)
    const { data: testB, error: bErr } = await supabase.from('broadcasts').insert({
      title:   '[ТЕСТ] ' + title,
      content,
      channel: Object.entries(channels).filter(([,v]) => v).map(([k]) => k).join('+') || 'push',
      status:  'sent',
      sent_at: new Date().toISOString(),
      created_by: session.user.id,
      filter_type: 'test',
      filter_payload: { test_only_self: true },
    }).select().single()
    if (bErr || !testB) {
      setSendingTest(false)
      alert('Не удалось создать тестовую рассылку: ' + (bErr?.message || 'неизвестная ошибка'))
      return
    }
    const { error: rErr } = await supabase.from('broadcast_recipients').insert({
      broadcast_id: testB.id, client_id: session.user.id,
    })
    if (rErr) {
      setSendingTest(false)
      alert('Тестовая рассылка создана, но получатель не сохранился: ' + rErr.message)
      return
    }
    const { data: sendRes, error: sendErr } = await supabase.functions.invoke('send-broadcast', {
      body: { broadcast_id: testB.id },
    })
    setSendingTest(false)
    if (sendErr || !sendRes?.ok) {
      alert('Не удалось отправить тестовую рассылку: ' + (sendErr?.message || sendRes?.error || 'неизвестная ошибка'))
      return
    }
    const stats = `Отправлено вам: пуш ${sendRes.sent_push}, email ${sendRes.sent_email}` + (sendRes.failed ? `, неудачно ${sendRes.failed}` : '')
    alert(stats)
    loadBroadcasts()
  }

  const handleSaveTemplate = async () => {
    if (savingTemplate || !templateName) return
    setSavingTemplate(true)
    const { error } = await supabase.from('broadcast_templates').insert({ name: templateName, title, content, created_by: session.user.id })
    setSavingTemplate(false)
    if (error) { alert('Не удалось сохранить шаблон: ' + error.message); return }
    setTemplateName(''); setShowSaveTemplate(false)
    loadTemplates()
  }

  const handleDeleteTemplate = async (templateId) => {
    if (deletingTemplateId) return
    if (!confirm('Удалить шаблон?')) return
    setDeletingTemplateId(templateId)
    const { error } = await supabase.from('broadcast_templates').delete().eq('id', templateId)
    setDeletingTemplateId(null)
    if (error) { alert('Не удалось удалить шаблон: ' + error.message); return }
    loadTemplates()
  }

  const handleSend = async (status = 'sent') => {
    if (saving) return
    if (!title || !content) { alert('Заполни заголовок и текст'); return }
    setSaving(true)

    const { data: broadcast, error: bErr } = await supabase.from('broadcasts').insert({
      title, content,
      channel: Object.entries(channels).filter(([,v]) => v).map(([k]) => k).join('+') || 'push',
      status,
      scheduled_at: scheduledAt || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      created_by: session.user.id,
      // filter_payload — единый JSON-снимок всех применённых фильтров. Точно тот же
      // payload что отправляется в recipients_for_broadcast. Используется в истории
      // для просмотра под какой фильтр ушла рассылка и для кнопки «Дублировать»
      // (которой пока нет, но будет тривиальной). Старые filter_* колонки больше
      // не заполняем — они оставлены deprecated для совместимости старых строк.
      filter_type:    'combined',
      filter_payload: buildRpcFilters(),
    }).select().single()

    if (bErr || !broadcast) {
      setSaving(false)
      alert('Не удалось создать рассылку: ' + (bErr?.message || 'неизвестная ошибка'))
      return
    }

    if (recipients.length > 0) {
      const finalRecipients = recipients.filter(r => !excludedIds.includes(r.id))
      if (finalRecipients.length > 0) {
        const { error: rErr } = await supabase.from('broadcast_recipients').insert(
          finalRecipients.map(r => ({ broadcast_id: broadcast.id, client_id: r.id }))
        )
        if (rErr) {
          setSaving(false)
          alert('Рассылка создана, но получатели не сохранились: ' + rErr.message)
          loadBroadcasts()
          return
        }
      }
    }

    // Для немедленной отправки — дёргаем edge-функцию. Для scheduled её подберёт pg_cron.
    if (status === 'sent') {
      const { data: sendRes, error: sendErr } = await supabase.functions.invoke('send-broadcast', {
        body: { broadcast_id: broadcast.id },
      })
      if (sendErr || !sendRes?.ok) {
        setSaving(false)
        alert('Рассылка создана, но не удалось запустить отправку: ' + (sendErr?.message || sendRes?.error || 'неизвестная ошибка') + '\n\nЗайди в историю — рассылка там, можно повторить попытку отправки позже.')
        loadBroadcasts()
        setTab('history')
        return
      }
      const stats = `Отправлено: пуш ${sendRes.sent_push}, email ${sendRes.sent_email}` + (sendRes.failed ? `, неудачно ${sendRes.failed}` : '')
      alert(stats)
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

  // Колонка channel хранится строкой 'push' / 'email' / 'push+email' / ...
  const formatChannel = (ch) => {
    const parts = (ch || '').split('+').filter(Boolean)
    const labels = { push: '📱 Пуш', email: '📧 Email' }
    return parts.map(p => labels[p] || p).join(' + ') || '—'
  }

  return (
    <div>
      <h1 style={{fontSize:24, fontWeight:600, color:'#1f2024', margin:'0 0 20px 0'}}>Рассылки</h1>

      <div style={{display:'flex', gap:4, borderBottom:'1px solid #f0f0f0', marginBottom:20}}>
        {[['new','✍️ Новая рассылка'], ['templates','📋 Шаблоны'], ['auto','⚡ Авто'], ['history','📜 История']].map(([v,l]) => (
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
                    <button onClick={handleSaveTemplate} disabled={savingTemplate || !templateName}
                      style={{...btnPrimary, padding:'8px 14px', fontSize:12, whiteSpace:'nowrap', opacity: (savingTemplate || !templateName) ? 0.5 : 1}}>
                      {savingTemplate ? '...' : 'Сохранить'}
                    </button>
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
              {showPreview && recipients.length > 0 && (() => {
                const withEmail = activeRecipients.filter(r => r.email).length
                const withPush  = activeRecipients.filter(r => r.push_token).length
                return (
                  <div style={{marginTop:10, fontSize:12, color:'#888', textAlign:'center'}}>
                    Найдено: <strong style={{color:'#2a2a2a'}}>{activeRecipients.length}</strong> чел., из них 📧 <strong style={{color:'#2a2a2a'}}>{withEmail}</strong> с email, 📱 <strong style={{color:'#2a2a2a'}}>{withPush}</strong> с пушем
                  </div>
                )
              })()}
            </div>

            {showPreview && (
              <div style={cardStyle}>
                <div style={{fontSize:14, fontWeight:600, color:'#2a2a2a', marginBottom:14}}>
                  Получатели
                  <span style={{marginLeft:8, fontSize:13, color:'#BFD900', fontWeight:700}}>{activeRecipients.length}</span>
                  <span style={{fontSize:12, color:'#BDBDBD', fontWeight:400}}> из {recipients.length}</span>
                </div>

                {/* Ручное добавление поверх фильтров */}
                <div style={{position:'relative', marginBottom:12}}>
                  <input value={manualQuery} onChange={e => handleManualSearch(e.target.value)}
                    placeholder="+ Добавить вручную (имя/телефон/email)..."
                    style={inputStyle} />
                  {manualResults.length > 0 && (
                    <div style={{position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, zIndex:10, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', marginTop:4, maxHeight:240, overflowY:'auto'}}>
                      {manualResults.map(c => (
                        <div key={c.id} onClick={() => handleManualAdd(c)}
                          style={{padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid #f5f5f5', fontSize:13}}
                          onMouseEnter={e => e.currentTarget.style.background='#f9f9f9'}
                          onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                          <div style={{fontWeight:500, color:'#2a2a2a'}}>{c.full_name || c.email}</div>
                          <div style={{fontSize:11, color:'#BDBDBD', marginTop:2, display:'flex', gap:8, alignItems:'center'}}>
                            {c.phone && <span>{c.phone}</span>}
                            {c.email && <span>📧 {c.email}</span>}
                            {c.push_token && <span>📱</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {recipients.length === 0 ? (
                  <div style={{fontSize:12, color:'#BDBDBD'}}>По выбранным фильтрам никого не найдено</div>
                ) : (
                  <div style={{maxHeight:300, overflowY:'auto'}}>
                    {recipients.map(r => {
                      const excluded = excludedIds.includes(r.id)
                      return (
                        <div key={r.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f8f8f8', opacity: excluded ? 0.4 : 1}}>
                          <div style={{flex:1, minWidth:0}}>
                            <div style={{fontSize:13, fontWeight:500, color:'#2a2a2a', textDecoration: excluded ? 'line-through' : 'none'}}>{r.full_name || r.email}</div>
                            <div style={{fontSize:11, color:'#BDBDBD', display:'flex', gap:6, alignItems:'center'}}>
                              {r.phone && <span>{r.phone}</span>}
                              <span title={r.email ? `email: ${r.email}` : 'нет email'} style={{opacity: r.email ? 1 : 0.3}}>📧</span>
                              <span title={r.push_token ? 'есть push_token' : 'нет push_token'} style={{opacity: r.push_token ? 1 : 0.3}}>📱</span>
                            </div>
                          </div>
                          <button onClick={() => setExcludedIds(p => p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id])}
                            style={{fontSize:11, color: excluded ? '#27ae60' : '#e74c3c', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif', flexShrink:0, marginLeft:8}}>
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
              <button onClick={handleSendTest} disabled={sendingTest || !title || !content}
                style={{width:'100%', padding:'10px', background:'#fef9e7', border:'1px solid #f39c12', borderRadius:10, fontSize:13, color:'#f39c12', cursor: (sendingTest || !title || !content) ? 'default' : 'pointer', fontFamily:'Inter,sans-serif', marginTop:8, fontWeight:600, opacity: (sendingTest || !title || !content) ? 0.5 : 1}}>
                {sendingTest ? 'Отправляем...' : '🧪 Тест только мне'}
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
                  {title && <div style={{fontSize:13, fontWeight:700, color:'#2a2a2a', marginBottom:6}} dangerouslySetInnerHTML={safeHtml(title)} />}
                  {content && <div style={{fontSize:12, color:'#3a3a3a', lineHeight:1.6}} dangerouslySetInnerHTML={safeHtml(content)} />}
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
                    dangerouslySetInnerHTML={safeHtml(t.content)} />
                  <div style={{display:'flex', gap:8}}>
                    <button onClick={() => { setTitle(t.title || ''); setContent(t.content || ''); setTab('new') }}
                      style={{flex:1, padding:'7px', background:'#BFD900', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#2a2a2a', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                      Использовать
                    </button>
                    <button onClick={() => handleDeleteTemplate(t.id)} disabled={deletingTemplateId === t.id}
                      style={{padding:'7px 12px', background:'#fdecea', border:'none', borderRadius:8, fontSize:12, color:'#e74c3c', cursor: deletingTemplateId === t.id ? 'default' : 'pointer', fontFamily:'Inter,sans-serif', opacity: deletingTemplateId === t.id ? 0.5 : 1}}>
                      {deletingTemplateId === t.id ? '...' : 'Удалить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'auto' && <AutoTab session={session} />}

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
                        dangerouslySetInnerHTML={safeHtml(b.title)} />
                      <td style={{padding:'12px 16px', fontSize:12, color:'#888'}}>{formatChannel(b.channel)}</td>
                      <td style={{padding:'12px 16px'}}>
                        <span style={{fontSize:11, fontWeight:600, color: STATUS_COLORS[b.status], background: STATUS_COLORS[b.status]+'22', padding:'2px 8px', borderRadius:6}}>
                          {STATUS_LABELS[b.status]}
                        </span>
                      </td>
                      <td style={{padding:'12px 16px', fontSize:12, color:'#888'}}>{b.recipients_count || 0}</td>
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