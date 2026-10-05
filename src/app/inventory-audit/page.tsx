import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLE_BLURB: Record<string, string> = {
  AUDITOR: "Inventory team — you enter and upload audit findings and track them to resolution.",
  MANAGER: "Manager — you see the findings assigned to you, your locations and your departments, and update their status.",
  ADMIN: "Admin — you can do everything in this module and configure it.",
};

export default async function InventoryAuditHome({ searchParams }: PageProps<"/inventory-audit">) {
  const params = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  const auditRole = (session?.user as { auditRole?: string | null } | undefined)?.auditRole ?? "";

  return (
    <div className="max-w-2xl">
      {params.denied === "1" && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your access level doesn&apos;t include that page.
        </p>
      )}
      <h1 className="text-xl font-semibold text-gray-900">Inventory Audit</h1>
      <p className="mt-1 text-sm text-gray-500">
        Separate from Consumable Management: its own locations, departments and
        findings. Only your login and admin settings are shared.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">Your access</h2>
        <p className="mt-1 text-sm text-gray-600">
          {ROLE_BLURB[auditRole] ?? "No access level is set for this module."}
        </p>
      </div>
    </div>
  );
}
