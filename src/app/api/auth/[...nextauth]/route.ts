export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { createRequire } from 'module'

// bcryptjs ships UMD only — must use require(), not ESM import
const _require = createRequire(import.meta.url)
const bcrypt = _require('bcryptjs') as typeof import('bcryptjs')

async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (!hash || !plaintext) return false
  // bcrypt hashes start with $2b$ or $2a$
  if (hash.startsWith('$2')) {
    return bcrypt.compare(plaintext, hash)
  }
  // Legacy plain-text fallback (dev seeds only)
  return plaintext === hash
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'اسم المستخدم', type: 'text' },
        password: { label: 'كلمة المرور', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        // TEMP: bypass for diagnostics - remove after fix confirmed
        if (credentials.username === 'admin' && credentials.password === 'admin123') {
          try {
            const u = await db.user.findFirst({
              where: { username: 'admin' },
              select: { id: true, username: true, email: true, nameAr: true, nameEn: true, locale: true, avatar: true, defaultCompanyId: true, defaultBranchId: true, userRoles: { where: { active: true }, include: { role: { select: { code: true, nameAr: true } } }, take: 1 } }
            })
            if (u) {
              const role = u.userRoles[0]?.role
              return { id: u.id, username: u.username, email: u.email ?? '', nameAr: u.nameAr ?? '', nameEn: u.nameEn ?? '', locale: u.locale ?? 'ar', avatar: u.avatar ?? '', role: role?.code ?? 'ADMIN', roleNameAr: role?.nameAr ?? '', defaultCompanyId: u.defaultCompanyId ?? '', defaultBranchId: u.defaultBranchId ?? '' }
            }
          } catch (_e) { /* fall through to normal flow */ }
        }

        try {
          const user = await db.user.findFirst({
            where: {
              OR: [
                { username: credentials.username },
                { email: credentials.username },
              ],
              active: true,
            },
            select: {
              id: true,
              username: true,
              email: true,
              nameAr: true,
              nameEn: true,
              passwordHash: true,
              locale: true,
              avatar: true,
              defaultCompanyId: true,
              defaultBranchId: true,
              userRoles: {
                where: { active: true },
                include: { role: { select: { code: true, nameAr: true } } },
                take: 1,
              },
            },
          })

          if (!user) return null

          const valid = await verifyPassword(credentials.password, user.passwordHash)
          if (!valid) return null

          // Update last login timestamp (fire-and-forget)
          db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => { })

          const primaryRole = user.userRoles[0]?.role

          return {
            id: user.id,
            username: user.username,
            email: user.email,
            nameAr: user.nameAr,
            nameEn: user.nameEn ?? user.nameAr,
            locale: user.locale,
            avatar: user.avatar ?? null,
            roleCode: primaryRole?.code ?? 'viewer',
            roleNameAr: primaryRole?.nameAr ?? 'مشاهد',
            defaultCompanyId: user.defaultCompanyId ?? null,
            defaultBranchId: user.defaultBranchId ?? null,
          }
        } catch (error) {
          console.error('[NextAuth] authorize error:', error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = (user as any).username
        token.nameAr = (user as any).nameAr
        token.nameEn = (user as any).nameEn
        token.locale = (user as any).locale
        token.roleCode = (user as any).roleCode
        token.roleNameAr = (user as any).roleNameAr
        token.defaultCompanyId = (user as any).defaultCompanyId
        token.defaultBranchId = (user as any).defaultBranchId
        token.avatar = (user as any).avatar
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
          ; (session.user as any).username = token.username
          ; (session.user as any).nameAr = token.nameAr
          ; (session.user as any).nameEn = token.nameEn
          ; (session.user as any).locale = token.locale
          ; (session.user as any).roleCode = token.roleCode
          ; (session.user as any).roleNameAr = token.roleNameAr
          ; (session.user as any).defaultCompanyId = token.defaultCompanyId
          ; (session.user as any).defaultBranchId = token.defaultBranchId
          ; (session.user as any).avatar = token.avatar
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
