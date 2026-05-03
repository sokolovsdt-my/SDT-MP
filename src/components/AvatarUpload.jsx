import { useState } from 'react'
import { supabase } from '../supabase'

export default function AvatarUpload({ userId, currentUrl, size = 52, onUpload, initials = '?' }) {
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
      if (onUpload) onUpload(url)
    } catch (err) {
      alert('Ошибка загрузки: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <label style={{ cursor:'pointer', position:'relative', flexShrink:0, display:'block' }}>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display:'none' }} />
      <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', background:'#BFD900', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.35, fontWeight:700, color:'#2a2a2a', position:'relative' }}>
        {currentUrl
          ? <img src={currentUrl} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span>{initials}</span>
        }
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.15s', fontSize:18, borderRadius:'50%' }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0}>
          {uploading ? '⏳' : '📷'}
        </div>
      </div>
    </label>
  )
}