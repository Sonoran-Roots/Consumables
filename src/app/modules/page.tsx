import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MODULE_HOME, modulesFor, type ModuleKey } from "@/lib/access";
import JarsLogo from "@/components/jars-logo";
import SignOutButton from "./sign-out-button";

export const dynamic = "force-dynamic";

const CARDS: Record<ModuleKey, { title: string; description: string }> = {
  CONSUMABLES: {
    title: "Consumable Management",
    description:
      "Inventory, transfers, check-outs, purchasing and reconciliation for consumable supplies.",
  },
  AUDIT: {
    title: "Inventory Audit",
    description:
      "Upload audit results, track findings, and follow them through to resolution with the managers responsible.",
  },
};

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function ModulesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const user = session.user as {
    name: string;
    email: string;
    role?: string | null;
    isPurchasingTeam?: boolean | null;
    auditRole?: string | null;
  };
  const modules = modulesFor(user);

  // Nothing to choose between: go straight in (or to the kiosk, which is all
  // a login with no module access can use).
  if (modules.length === 0) redirect("/kiosk");
  if (modules.length === 1) redirect(MODULE_HOME[modules[0]]);

  const level: Record<ModuleKey, string> = {
    CONSUMABLES: titleCase(user.role ?? "USER"),
    AUDIT: titleCase(user.auditRole ?? ""),
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-white p-6">
      <div className="flex flex-col items-center text-center">
        <JarsLogo size={96} className="mb-4" />
        <div className="text-2xl font-black tracking-tight text-black">JARS Cannabis Arizona</div>
        <p className="mt-3 text-lg font-semibold text-gray-900">
          Which module do you want to open?
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Signed in as {user.name || user.email}
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {modules.map((key) => (
          <Link
            key={key}
            href={MODULE_HOME[key]}
            className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-colors hover:border-black"
          >
            <span className="text-lg font-semibold text-gray-900">{CARDS[key].title}</span>
            <span className="mt-2 flex-1 text-sm text-gray-500">{CARDS[key].description}</span>
            <span className="mt-4 flex items-center justify-between text-sm">
              <span className="rounded-full bg-[#e5f3e5] px-2.5 py-0.5 text-xs font-medium text-[#0e3020]">
                {level[key]} access
              </span>
              <span className="font-medium text-gray-900 group-hover:underline">Open →</span>
            </span>
          </Link>
        ))}
      </div>

      <SignOutButton />
    </div>
  );
}
