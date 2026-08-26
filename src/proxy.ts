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
    '/((?!_next/static|_next/image|favicon.ico|logo\\.|robots\\.txt).*)',
  ],
}
