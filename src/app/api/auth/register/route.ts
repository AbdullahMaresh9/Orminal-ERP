import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scrypt, randomBytes } from 'crypto'

function scryptAsync(password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scrypt(password, salt, keylen, options, (err, derivedKey) => {
            if (err) reject(err)
            else resolve(derivedKey)
        })
    })
}

async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16)
    const N = 16384
    const r = 8
    const p = 1
    const keylen = 64
    const derivedKey = await scryptAsync(password, salt, keylen, { N, r, p })
    return `scrypt:${N}:${r}:${p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { name, username, email, companyName, password } = body

        if (!name || !name.trim()) {
            return NextResponse.json({ success: false, error: 'الاسم الكامل مطلوب' }, { status: 400 })
        }
        if (!username || !username.trim()) {
            return NextResponse.json({ success: false, error: 'اسم المستخدم مطلوب' }, { status: 400 })
        }
        if (!email || !email.trim()) {
            return NextResponse.json({ success: false, error: 'البريد الإلكتروني مطلوب' }, { status: 400 })
        }
        if (!password || password.length < 6) {
            return NextResponse.json({ success: false, error: 'كلمة المرور يجب أن لا تقل عن 6 أحرف' }, { status: 400 })
        }

        const cleanUsername = username.trim().toLowerCase()
        const cleanEmail = email.trim().toLowerCase()

        // Check existing user
        const existing = await db.user.findFirst({
            where: {
                OR: [
                    { username: cleanUsername },
                    { email: cleanEmail },
                ],
            },
        })

        if (existing) {
            if (existing.username === cleanUsername) {
                return NextResponse.json({ success: false, error: 'اسم المستخدم مستخدم بالفعل' }, { status: 400 })
            }
            return NextResponse.json({ success: false, error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 })
        }

        // Get default company and branch if available
        const defaultCompany = await db.company.findFirst({ select: { id: true } })
        const defaultBranch = await db.branch.findFirst({ select: { id: true } })

        // Hash password
        const passwordHash = await hashPassword(password)

        // Find default viewer or admin role
        const defaultRole = await db.role.findFirst({
            where: { OR: [{ code: 'admin' }, { isSystem: true }] },
            select: { id: true },
        })

        const newUser = await db.user.create({
            data: {
                username: cleanUsername,
                email: cleanEmail,
                nameAr: name.trim(),
                nameEn: name.trim(),
                passwordHash,
                active: true,
                defaultCompanyId: defaultCompany?.id || null,
                defaultBranchId: defaultBranch?.id || null,
                locale: 'ar',
                timezone: 'Asia/Riyadh',
                ...(defaultRole
                    ? {
                        userRoles: {
                            create: [{ roleId: defaultRole.id }],
                        },
                    }
                    : {}),
            },
            select: {
                id: true,
                username: true,
                email: true,
                nameAr: true,
                nameEn: true,
                createdAt: true,
            },
        })

        return NextResponse.json({
            success: true,
            data: newUser,
            message: 'تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.',
        })
    } catch (error: any) {
        console.error('[Auth Register Error]:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'حدث خطأ غير متوقع أثناء إنشاء الحساب' },
            { status: 500 }
        )
    }
}
