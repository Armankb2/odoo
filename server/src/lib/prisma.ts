import { PrismaClient } from '@prisma/client';

/**
 * A single client for the process. `tsx watch` re-imports modules on change,
 * so without the global cache each reload would open a new connection pool
 * until MySQL refuses them.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
