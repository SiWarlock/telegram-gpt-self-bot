import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
    const ownerId = process.env.TELEGRAM_OWNER_ID;
    console.log(`Initializing admin for Owner ID: ${ownerId}`);

    if (!ownerId) {
        throw new Error('TELEGRAM_OWNER_ID not found in .env');
    }

    // 1. Ensure Roles exist
    const roles = ['admin', 'moderator', 'user'];
    for (const roleName of roles) {
        await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: { name: roleName }
        });
        console.log(`Role ensured: ${roleName}`);
    }

    // 2. Upsert User
    const user = await prisma.user.upsert({
        where: { id: ownerId },
        update: {},
        create: {
            id: ownerId,
            username: 'Owner'
        }
    });
    console.log(`User ensured: ${user.id}`);

    // 3. Assign Admin Role
    await prisma.user.update({
        where: { id: ownerId },
        data: {
            roles: {
                connect: { name: 'admin' }
            }
        }
    });
    console.log(`Successfully assigned 'admin' role to user ${ownerId}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
