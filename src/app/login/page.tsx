import { Suspense } from 'react'
import AuthPage from '@/components/auth/auth-page'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">جاري التحميل...</div>}>
      <AuthPage initialMode="login" />
    </Suspense>
  )
}
