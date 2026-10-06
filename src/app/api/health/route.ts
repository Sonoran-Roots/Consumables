import { db } from "@/lib/db";

// A public check that the deployment can reach its database and that the
// tables and columns the app needs are there — for finding out why a deploy
// won't load when the platform shows no logs. It reports only which check
// passed or failed (never a message, URL or value).
export const dynamic = "force-dynamic";

const checks: { name: string; run: () => Promise<unknown> }[] = [
  { name: "database connection", run: () => db.$queryRaw`SELECT 1` },
  { name: "User table (+ module access column)", run: () => db.user.findFirst({ select: { id: true, role: true, isPurchasingTeam: true, auditRole: true } }) },
  { name: "Consumables: items", run: () => db.item.count() },
  { name: "Audit: findings", run: () => db.iaFinding.findFirst({ select: { id: true, flaggedField: true, needsReview: true, adjustmentStatus: true, auditLineId: true } }) },
  { name: "Audit: audits and lines", run: () => db.iaAuditLine.findFirst({ select: { id: true, labelVerified: true, harvestDate: true } }) },
  { name: "Audit: lists (facilities, departments, categories)", run: () => db.iaFindingCategory.count() },
  { name: "Audit: coverage and email templates", run: () => Promise.all([db.iaCoverage.count(), db.iaEmailTemplate.count()]) },
];

export async function GET() {
  const results = await Promise.all(
    checks.map(async (c) => {
      try {
        await c.run();
        return { check: c.name, ok: true };
      } catch (e) {
        return { check: c.name, ok: false, error: (e as { code?: string; name?: string }).code ?? (e as Error).name };
      }
    })
  );
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    BETTER_AUTH_SECRET: Boolean(process.env.BETTER_AUTH_SECRET),
    BETTER_AUTH_URL: Boolean(process.env.BETTER_AUTH_URL),
  };
  const ok = results.every((r) => r.ok) && Object.values(env).every(Boolean);
  return Response.json(
    { ok, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local", env, checks: results },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
