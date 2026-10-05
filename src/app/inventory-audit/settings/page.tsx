import { db } from "@/lib/db";
import { saveCategory, saveDepartment, saveFacility, saveFindingType } from "./actions";

export const dynamic = "force-dynamic";

const box = "rounded-md border border-gray-300 px-2 py-1 text-sm";
const save = "rounded-md border border-black bg-black px-2.5 py-1 text-xs font-medium text-white hover:bg-white hover:text-black";

type Named = { id: string; name: string; aliases: string[]; isActive: boolean };

function NamedSection({ title, help, rows, action, noun }: {
  title: string; help: string; rows: Named[]; action: (f: FormData) => Promise<void>; noun: string;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-medium text-gray-700">{title}</h2>
      <p className="mt-1 text-xs text-gray-500">{help}</p>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <form key={r.id} action={action} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={r.id} />
            <input name="name" defaultValue={r.name} required className={`${box} w-56`} aria-label="Name" />
            <input name="aliases" defaultValue={r.aliases.join(", ")} placeholder="aliases, comma separated" className={`${box} w-64`} aria-label="Aliases" />
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input type="checkbox" name="isActive" defaultChecked={r.isActive} /> Active
            </label>
            <button className={save}>Save</button>
          </form>
        ))}
        <form action={action} className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <input name="name" required placeholder={`New ${noun}`} className={`${box} w-56`} aria-label={`New ${noun} name`} />
          <input name="aliases" placeholder="aliases, comma separated" className={`${box} w-64`} aria-label="Aliases" />
          <button className={save}>Add {noun}</button>
        </form>
      </div>
    </section>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/inventory-audit/settings">) {
  const sp = await searchParams;
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const [facilities, departments, types, categories] = await Promise.all([
    db.iaFacility.findMany({ orderBy: { name: "asc" } }),
    db.iaDepartment.findMany({ orderBy: { name: "asc" } }),
    db.iaFindingType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.iaFindingCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          The lists findings are filed against. <strong className="font-medium text-gray-700">Aliases</strong> are
          other spellings seen in the old trackers (for example &quot;McDowell - Hub&quot;), so uploads match
          without editing the file. Deactivating something hides it from new findings; existing findings keep it.
        </p>
      </div>
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <NamedSection title="Facilities" noun="facility" action={saveFacility} rows={facilities}
        help="Where audits happen." />
      <NamedSection title="Departments" noun="department" action={saveDepartment} rows={departments}
        help="Who a finding is attributed to — the team that has to fix it." />

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-medium text-gray-700">Finding types</h2>
        <p className="mt-1 text-xs text-gray-500">
          Default due days are counted from the audit date and set each new finding&apos;s due date. Leave blank for no automatic due date.
        </p>
        <div className="mt-3 space-y-2">
          {types.map((t) => (
            <form key={t.id} action={saveFindingType} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={t.id} />
              <input name="name" defaultValue={t.name} required className={`${box} w-56`} aria-label="Name" />
              <input name="aliases" defaultValue={t.aliases.join(", ")} placeholder="aliases" className={`${box} w-44`} aria-label="Aliases" />
              <label className="flex items-center gap-1 text-xs text-gray-600">
                Due in
                <input name="defaultDueDays" type="number" min={0} max={365} defaultValue={t.defaultDueDays ?? ""} className={`${box} w-16`} aria-label="Default due days" />
                days
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                Order
                <input name="sortOrder" type="number" defaultValue={t.sortOrder} className={`${box} w-14`} aria-label="Sort order" />
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" name="isActive" defaultChecked={t.isActive} /> Active
              </label>
              <button className={save}>Save</button>
            </form>
          ))}
          <form action={saveFindingType} className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <input name="name" required placeholder="New finding type" className={`${box} w-56`} aria-label="New finding type name" />
            <label className="flex items-center gap-1 text-xs text-gray-600">
              Due in
              <input name="defaultDueDays" type="number" min={0} max={365} className={`${box} w-16`} aria-label="Default due days" />
              days
            </label>
            <button className={save}>Add finding type</button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-medium text-gray-700">Finding categories</h2>
        <p className="mt-1 text-xs text-gray-500">
          The standard kinds of finding from the tracker&apos;s Key tab. Each belongs to a finding type (its impact
          level); picking a category on a finding fills in that type.
        </p>
        <div className="mt-3 space-y-2">
          {categories.map((c) => (
            <form key={c.id} action={saveCategory} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} required className={`${box} w-full sm:w-[28rem]`} aria-label="Name" />
              <select name="findingTypeId" defaultValue={c.findingTypeId} className={box} aria-label="Finding type">
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" name="isActive" defaultChecked={c.isActive} /> Active
              </label>
              <button className={save}>Save</button>
            </form>
          ))}
          <form action={saveCategory} className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <input name="name" required placeholder="New category" className={`${box} w-full sm:w-[28rem]`} aria-label="New category name" />
            <select name="findingTypeId" required defaultValue="" className={box} aria-label="Finding type">
              <option value="" disabled>Finding type…</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className={save}>Add category</button>
          </form>
        </div>
      </section>
    </div>
  );
}
