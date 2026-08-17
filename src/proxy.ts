// Next.js 16 request interceptor.
//
// FILENAME MATTERS: in Next.js 16 this convention is `proxy.ts` (the old
// `middleware.ts` name still works but is deprecated and logs a build warning).
// Do NOT rename this file to middleware.ts — it is wired up and running; the
// build output confirms it as "ƒ Proxy (Middleware)".
//
// Scope: this guard only answers "is there a valid session?". It deliberately
// does NOT decide what an authenticated user may do — per-route authorization
// lives in src/lib/erp/rbac.ts (requireCapability), because a single global
// gate cannot express per-module capabilities like "read the chart but never
// edit account determination".

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
      const token = req.nextauth?.token
      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'جلسة المستخدم انتهت، يرجى إعادة تسجيل الدخول' },
          { status: 401 }
        )
      }
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl
        // Allow public paths
        if (
          pathname.startsWith('/login') ||
          pathname.startsWith('/api/auth') ||
          pathname.startsWith('/_next') ||
          pathname.startsWith('/favicon') ||
          pathname === '/logo.png' ||
          pathname === '/logo.svg' ||
          pathname === '/robots.txt'
        ) {
          return true
        }
        // Allow API routes to be handled by middleware function to return 401 JSON instead of 307 HTML redirect
        if (pathname.startsWith('/api/')) {
          return true
        }
        // All other routes require a valid token
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (logo, robots)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo\\.|robots\\.txt).*)',
  ],
}
