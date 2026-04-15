import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useUserRole(session) {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) {
      setRole(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setRole('client')
        } else {
          setRole(data.role)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [session?.user?.id])

  return { role, loading }
}