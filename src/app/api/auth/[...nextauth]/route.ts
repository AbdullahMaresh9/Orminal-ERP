import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>

async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (!hash || !plaintext) return false
  if (hash.startsWith('scrypt:')) {
    const parts = hash.split('$')
    if (parts.length !== 3) return false
    const [params, saltHex, storedHex] = parts
    const [, N, r, p] = params.split(':').map(Number)
    if (!N || !r || !p || !saltHex || !storedHex) return false
    const saltBuf = Buffer.from(saltHex, 'hex')
    const storedBuf = Buffer.from(storedHex, 'hex')
    const derivedKey = await scryptAsync(plaintext, saltBuf, storedBuf.length, { N, r, p })
    if (derivedKey.length !== storedBuf.length) return false
    return timingSafeEqual(derivedKey, storedBuf)
  }
  // Fallback: plain text comparison (dev-only seeds)
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
