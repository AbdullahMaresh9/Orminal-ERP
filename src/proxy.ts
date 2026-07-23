import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // User is authenticated (withAuth guarantees this for protected routes)
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
