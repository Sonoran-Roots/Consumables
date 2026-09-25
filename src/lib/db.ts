import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Standard Next.js dev-mode singleton: without this, every hot reload would
// open a fresh pool and eventually exhaust Postgres connection limits.
const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

function createPool() {
  const newPool = new Pool({ connectionString: process.env.DATABASE_URL });
  // pg crashes the process if an idle client errors with no listener attached.
  // The pool evicts the dead client and reconnects on the next query either way.
  newPool.on("error", (err) => {
    console.error("Postgres pool error (idle client):", err.message);
  });
  return newPool;
}

const pool = globalForDb.pool ?? createPool();
const adapter = new PrismaPg(pool);

export const db = globalForDb.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForDb.prisma = db;
  globalForDb.pool = pool;
}
