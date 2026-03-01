import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Ping the database every 60 seconds to keep the connection alive
export const startDatabasePing = () => {
    setInterval(async () => {
        try {
            await prisma.$queryRaw`SELECT 1`;
            console.log('Database ping successful');
        } catch (error) {
            console.error('Database ping failed:', error);
        }
    }, 60 * 1000); // 1 minute
};

export default prisma;
