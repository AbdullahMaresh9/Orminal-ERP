import { db } from '@/lib/db'
import {
  list, created, badRequest, serverError,
  parsePagination, parseSearch,
} from '@/lib/erp/api-response'
import { hashPassword } from '@/lib/auth/password'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const active = url.searchParams.get('active')
    const mfaEnabled = url.searchParams.get('mfaEnabled')

    const where: any = {}
    if (q) {
      where.OR = [
        { username: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
        { email: { contains: q } },
      ]
    }
    if (active === 'true' || active === 'false') where.active = active === 'true'
    if (mfaEnabled === 'true' || mfaEnabled === 'false') where.mfaEnabled = mfaEnabled === 'true'

    const [data, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          nameAr: true,
          nameEn: true,
          phone: true,
          avatar: true,
          active: true,
          mfaEnabled: true,
          defaultBranchId: true,
          locale: true,
          timezone: true,
          lastLoginAt: true,
          createdAt: true,
          defaultBranch: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          userRoles: {
            include: {
              role: {
                select: { id: true, code: true, nameAr: true, nameEn: true, isSystem: true },
              },
            },
          },
          _count: { select: { auditLogs: true } },
        },
      }),
      db.user.count({ where }),
    ])

    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.username) return badRequest('اسم المستخدم مطلوب', 'VALIDATION_ERROR')
    if (!body.email) return badRequest('البريد الإلكتروني مطلوب', 'VALIDATION_ERROR')
    if (!body.nameAr) return badRequest('الاسم بالعربية مطلوب', 'VALIDATION_ERROR')
    if (!body.password) return badRequest('كلمة المرور مطلوبة', 'VALIDATION_ERROR')

    // Duplicate username/email checks
    const dup = await db.user.findFirst({
      where: { OR: [{ username: body.username }, { email: body.email }] },
    })
    if (dup) {
      if (dup.username === body.username) {
        return badRequest('اسم المستخدم مستخدم بالفعل', 'DUPLICATE_USERNAME')
      }
      return badRequest('البريد الإلكتروني مستخدم بالفعل', 'DUPLICATE_EMAIL')
    }

    // scrypt — the only format verifyPassword accepts. The previous base64
    // "obfuscation" was reversible AND locked created users out of login.
    const passwordHash = await hashPassword(body.password)

    const created_ = await db.user.create({
      data: {
        username: body.username,
        email: body.email,
        nameAr: body.nameAr,
        nameEn: body.nameEn || null,
        phone: body.phone || null,
        avatar: body.avatar || null,
        passwordHash,
        defaultBranchId: body.defaultBranchId || null,
        locale: body.locale || 'ar',
        timezone: body.timezone || 'Asia/Riyadh',
        mfaEnabled: body.mfaEnabled ?? false,
        active: body.active ?? true,
        ...(body.roleId
          ? {
              userRoles: {
                create: [{ role: { connect: { id: body.roleId } } }],
              },
            }
          : {}),
      },
      select: {
        id: true, username: true, email: true, nameAr: true, nameEn: true,
        active: true, mfaEnabled: true, createdAt: true,
      },
    })
    return created(created_)
  } catch (e: any) {
    return serverError(e.message)
  }
}
