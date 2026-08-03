import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { scrypt, timingSafeEqual, randomBytes } from 'crypto'
const scryptAsync = (password: string | Buffer, salt: string | Buffer, keylen: number, options: { N: number; r: number; p: number }): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  try {
    // Support both scrypt format (scrypt:N:r:p$salt$hash) and plain bcrypt-style
    if (hash.startsWith('scrypt:')) {
      const [params, salt, storedHash] = hash.split('$')
      const [, N, r, p] = params.split(':').map(Number)
      const derivedKey = (await scryptAsync(plaintext, Buffer.from(salt, 'hex'), 64, { N, r, p })) as Buffer
      return timingSafeEqual(derivedKey, Buffer.from(storedHash, 'hex'))
    }
    // Fallback: plain text comparison (dev-only seeds)
    return plaintext === hash
  } catch {
    return false
  }
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
          console.error('[NextAuth] DATABASE_URL prefix:', process.env.POSTGRES_PRISMA_URL?.substring(0, 60))
          console.error('[NextAuth] NODE_ENV:', process.env.NODE_ENV)
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
