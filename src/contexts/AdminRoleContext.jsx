import { createContext, useContext } from 'react'

// Контекст роли для админ-зоны. Заполняется в AdminLayout (один вызов
// useUserRole на всё /admin/*). Дочерние гарды читают отсюда вместо
// повторного запроса к profiles — раньше при переходе между разделами
// админки летело 3-4 параллельных SELECT profile.role.
export const AdminRoleContext = createContext({ role: null, loading: true, error: false })

export const useAdminRole = () => useContext(AdminRoleContext)
