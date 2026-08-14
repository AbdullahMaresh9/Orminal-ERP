import NextAuth, { type AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

export const authOptions: AuthOptions = {
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

          const { valid, needsRehash } = await verifyPassword(credentials.password, user.passwordHash)
          if (!valid) return null

          // Update last login timestamp, and transparently migrate any
          // legacy (bcrypt / insecure base64) password hash to the current
          // scrypt format now that we've verified the plaintext (fire-and-forget).
          const updateData: { lastLoginAt: Date; passwordHash?: string } = { lastLoginAt: new Date() }
          if (needsRehash) {
            updateData.passwordHash = await hashPassword(credentials.password)
          }
          db.user.update({ where: { id: user.id }, data: updateData }).catch(() => { })

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
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
