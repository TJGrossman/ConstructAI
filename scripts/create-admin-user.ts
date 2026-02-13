import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdminUser() {
  const email = 'admin@constructai.com';
  const password = 'Kevi';
  const name = 'Admin';

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.log(`✅ User ${email} already exists with ID: ${existing.id}`);
      console.log(`   isDemoAccount: ${existing.isDemoAccount}`);

      // Update to ensure isDemoAccount is true
      if (!existing.isDemoAccount) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { isDemoAccount: true },
        });
        console.log(`   Updated isDemoAccount to true`);
      }

      return;
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        isDemoAccount: true,
        onboardingDone: true, // Skip onboarding for admin
      },
    });

    console.log(`✅ Admin user created successfully!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Password: ${password}`);
    console.log(`   isDemoAccount: ${user.isDemoAccount}`);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
