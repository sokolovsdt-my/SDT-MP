import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Bundle splitting (S13):
// 1. /admin/* и /teacher страницы лениво грузятся через React.lazy() в App.jsx —
//    клиентская мобилка не тянет ~7000 строк админ-кода.
// 2. Тяжёлые vendor-зависимости (supabase-js, firebase) выносим в отдельные
//    чанки, чтобы их можно было кэшировать отдельно от нашего кода.
//    В Vite 8 на Rolldown manualChunks — функция, не объект.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase'))                 return 'vendor-supabase'
          if (id.includes('firebase'))                  return 'vendor-firebase'
          if (id.includes('dompurify'))                 return 'vendor-dompurify'
          if (id.includes('react-router'))              return 'vendor-react'
          if (id.includes('react-dom') || id.match(/[\\/]node_modules[\\/]react[\\/]/))
            return 'vendor-react'
        },
      },
    },
  },
})
