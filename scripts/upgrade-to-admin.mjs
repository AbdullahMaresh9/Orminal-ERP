import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  try {
    console.log('[v0] Starting admin upgrade process...');

    // Find the omararif user
    const user = await db.user.findUnique({
      where: { username: 'omararif' },
      select: { id: true, username: true, nameAr: true },
    });

    if (!user) {
      console.error('[v0] User omararif not found');
      process.exit(1);
    }

    console.log(`[v0] Found user: ${user.nameAr} (${user.username})`);

    // Find the ADMIN role
    const adminRole = await db.role.findUnique({
      where: { code: 'ADMIN' },
      select: { id: true, code: true, nameAr: true },
    });

    if (!adminRole) {
      console.error('[v0] ADMIN role not found');
      process.exit(1);
    }

    console.log(`[v0] Found role: ${adminRole.nameAr} (${adminRole.code})`);

    // Get the main company and branch
    const company = await db.company.findFirst({
      select: { id: true, code: true, nameAr: true },
    });

    const branch = await db.branch.findFirst({
      where: { isMain: true },
      select: { id: true, code: true, nameAr: true },
    });

    if (!company || !branch) {
      console.error('[v0] Company or branch not found');
      process.exit(1);
    }

    console.log(`[v0] Company: ${company.nameAr}, Branch: ${branch.nameAr}`);

    // Delete existing user roles
    const deleted = await db.userRole.deleteMany({
      where: { userId: user.id },
    });

    console.log(`[v0] Deleted ${deleted.count} existing user roles`);

    // Create new admin role assignment
    await db.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id,
        companyId: company.id,
        branchId: branch.id,
        active: true,
      },
    });

    console.log('[v0] User promoted to ADMIN successfully');

    // Verify the change
    const updatedUser = await db.user.findUnique({
      where: { username: 'omararif' },
      select: {
        id: true,
        username: true,
        nameAr: true,
        userRoles: {
          select: {
            role: { select: { code: true, nameAr: true } },
          },
        },
      },
    });

    console.log('[v0] User roles after upgrade:');
    updatedUser?.userRoles.forEach((ur) => {
      console.log(`  - ${ur.role.nameAr} (${ur.role.code})`);
    });

    console.log('[v0] Admin upgrade completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[v0] Error during admin upgrade:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
