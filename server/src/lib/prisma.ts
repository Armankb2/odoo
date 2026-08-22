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

/**
 * Fail fast, and legibly, when the generated client is older than the schema.
 *
 * Prisma generates a client into node_modules from `schema.prisma`. Pulling a
 * commit that adds a model does NOT regenerate it, so on a machine whose
 * node_modules already existed, `prisma.emailVerification` is simply
 * `undefined` and the first query dies with
 *
 *     TypeError: Cannot read properties of undefined (reading 'findFirst')
 *
 * — hundreds of lines from the real cause, at request time rather than at
 * boot. `postinstall` now regenerates on every install; this check catches the
 * case where someone skips the install entirely.
 *
 * Add a model to the schema and add it here, or the next person debugs the
 * TypeError instead of reading a sentence.
 */
const REQUIRED_MODELS = [
  'company',
  'user',
  'attendance',
  'leaveRequest',
  'salaryStructure',
  'emailVerification',
] as const;

const missing = REQUIRED_MODELS.filter(
  (m) => (prisma as unknown as Record<string, unknown>)[m] === undefined,
);

if (missing.length > 0) {
  console.error(`
Prisma client is out of date — it is missing: ${missing.join(', ')}

The schema has models the generated client does not. Run this in server/:

    npm run setup      # prisma generate && prisma migrate deploy

If the database is also new or empty, seed it afterwards:

    npm run db:seed
`);
  process.exit(1);
}
