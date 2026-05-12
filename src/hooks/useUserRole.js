import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useUserRole(session) {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  // true — запрос упал по сети/RLS/иной причине. Отличается от «нет профиля»:
  // при error мы НЕ должны молча понижать роль до client (так админ при
  // сетевом сбое теряет доступ).
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) {
      setRole(null); setError(false); setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true); setError(false)

    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          // Транзитная ошибка — оставляем role=null + флаг error.
          // Гарды (RequireRole / RootRedirect) могут показать «Ошибка проверки доступа».
          setRole(null); setError(true)
        } else {
          setRole(data?.role ?? null); setError(false)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [session?.user?.id])

  return { role, loading, error }
}