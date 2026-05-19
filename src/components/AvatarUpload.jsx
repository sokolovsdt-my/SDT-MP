import { useState } from 'react'
import { supabase } from '../supabase'

// Whitelist MIME → расширение. Раньше расширение бралось из user-controlled
// file.name через split('.').pop() — это и source расширения, и потенциальный
// вектор (svg + script). Привязываемся к фактическому MIME.
const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
}

export default function AvatarUpload({ userId, currentUrl, size = 52, onUpload, initials = '?' }) {
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = MIME_TO_EXT[file.type]
    if (!ext) { alert('Неподдерживаемый формат — нужен JPEG, PNG или WebP'); return }
    setUploading(true)
    try {
      const path = `${userId}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Cache-bust query параметр храним только в UI-state, в БД пишем чистый URL.
      // Раньше `?t=` копился в profiles.avatar_url с каждой перезагрузкой аватара.
      const cleanUrl = data.publicUrl
      const uiUrl = cleanUrl + '?t=' + Date.now()
      // Прямой UPDATE profiles запрещён триггером для client/teacher — идём через RPC.
      // Для admin/manager/owner RPC тоже корректно отрабатывает (whitelist полей).
      const { error: rpcError } = await supabase.rpc('update_my_profile', { p_payload: { avatar_url: cleanUrl } })
      if (rpcError) throw rpcError
      if (onUpload) onUpload(uiUrl)
    } catch (err) {
      alert('Ошибка загрузки: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <label style={{ cursor:'pointer', position:'relative', flexShrink:0, display:'block' }}
      aria-label={uploading ? 'Загрузка аватара…' : 'Загрузить аватар'}>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display:'none' }} />
      <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', background:'#BFD900', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.35, fontWeight:700, color:'#2a2a2a', position:'relative' }}>
        {currentUrl
          ? <img loading="lazy" decoding="async" src={currentUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span>{initials}</span>
        }
        {/* Постоянная иконка в углу — видна и на тач-устройствах. Hover-overlay убран. */}
        <div style={{
          position:'absolute', right:0, bottom:0,
          width: Math.max(18, size*0.34), height: Math.max(18, size*0.34),
          borderRadius:'50%', background:'#fff', border:'2px solid #BFD900',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize: Math.max(10, size*0.18), boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
        }}>
          {uploading ? '⏳' : '📷'}
        </div>
      </div>
    </label>
  )
}
