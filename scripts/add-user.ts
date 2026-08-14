// Script to add a new user to the system
import { db } from '../src/lib/db'
import { scrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const N = 16384, r = 8, p = 1
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await (scryptAsync as any)(password, Buffer.from(salt, 'hex'), 64, { N, r, p })) as Buffer
  return `scrypt:${N}:${r}:${p}$${salt}$${derivedKey.toString('hex')}`
}

async function main() {
  console.log('Adding new user...')

  try {
    // Get default company and branch
    const company = await db.company.findFirst()
    const branch = await db.branch.findFirst()

    if (!company || !branch) {
      console.error('Company or Branch not found. Please run the seed script first.')
      process.exit(1)
    }

    //  Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { username: 'omararif' },
          { email: 'omararif@example.com' },
        ],
      },
    })

    if (existingUser) {
      console.log('User "omararif" already exists!')
      console.log('Username:', existingUser.username)
      console.log('Email:', existingUser.email)
      process.exit(0)
    }

    // Create the new user
    const newUser = await db.user.create({
      data: {
        username: 'omararif',
        email: 'omararif@example.com',
        nameAr: 'عمر عريف',
        nameEn: 'Omar Arif',
        passwordHash: await hashPassword('Omar775R#'),
        defaultCompanyId: company.id,
        defaultBranchId: branch.id,
        locale: 'ar',
        timezone: 'Asia/Riyadh',
        active: true,
        mfaEnabled: false,
      },
    })

    // Assign a default role (Sales Representative)
    const role = await db.role.findFirst({ where: { code: 'SALES_REP' } })
    if (role) {
      await db.userRole.create({
        data: {
          userId: newUser.id,
          roleId: role.id,
          companyId: company.id,
          branchId: branch.id,
          active: true,
        },
      })
      console.log('✓ Role assigned: Sales Representative')
    }

    console.log('✓ User created successfully!')
    console.log('─────────────────────────────────')
    console.log('Username:', newUser.username)
    console.log('Email:', newUser.email)
    console.log('Password: Omar775R#')
    console.log('Name (AR):', newUser.nameAr)
    console.log('Name (EN):', newUser.nameEn)
    console.log('─────────────────────────────────')
    console.log('You can now login with these credentials!')

    process.exit(0)
  } catch (error) {
    console.error('Error creating user:', error)
    process.exit(1)
  }
}

main()
