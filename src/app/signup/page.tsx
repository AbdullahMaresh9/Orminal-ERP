import { Suspense } from 'react'
import AuthPage from '@/components/auth/auth-page'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">Loading...</div>}>
      <AuthPage initialMode="signup" />
    </Suspense>
  )
}
