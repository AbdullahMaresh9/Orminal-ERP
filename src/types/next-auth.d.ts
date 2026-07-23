// next-auth type augmentation — extends built-in types with ERP-specific user fields
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    id: string
    username: string
    email: string
    nameAr: string
    nameEn: string
    locale: string
    avatar: string | null
    roleCode: string
    roleNameAr: string
    defaultCompanyId: string | null
    defaultBranchId: string | null
  }

  interface Session {
    user: User
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    nameAr: string
    nameEn: string
    locale: string
    avatar: string | null
    roleCode: string
    roleNameAr: string
    permissions: string[]
    defaultCompanyId: string | null
    defaultBranchId: string | null
  }
}
