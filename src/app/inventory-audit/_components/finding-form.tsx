"use client";

import { useActionState, useState } from "react";
import type { FindingFormState } from "../findings/actions";

type Option = { id: string; name: string };
export type FindingFormValues = {
  findingId?: string;
  auditType: string;
  auditDate: string;
  auditors: string;
  facilityId: string;
  findingTypeId: string;
  categoryId: string;
  departmentId: string;
  secondDepartmentId: string;
  description: string;
  product: string;
  batchId: string;
  pid: string;
  strain: string;
  quantity: string;
  unit: string;
  room: string;
  serialNo: string;
  reference: string;
  weightGrams: string;
  disposalDate: string;
  correction: string;
  monitoringNotes: string;
  dueDate: string;
  assignedToId: string;
};

export const EMPTY_FINDING: FindingFormValues = {
  auditType: "PRODUCT", auditDate: "", auditors: "", facilityId: "", findingTypeId: "", categoryId: "", departmentId: "", secondDepartmentId: "",
  description: "", product: "", batchId: "", pid: "", strain: "", quantity: "", unit: "", room: "", serialNo: "", reference: "",
  weightGrams: "", disposalDate: "", correction: "", monitoringNotes: "", dueDate: "", assignedToId: "",
};

const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-gray-700";

function Select({ name, value, onChange, options, required, blank }: {
  name: string; value: string; onChange: (v: string) => void; options: Option[]; required?: boolean; blank?: string;
}) {
  return (
    <select name={name} value={value} required={required} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">{blank ?? "Select…"}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}

export default function FindingForm({
  action, initial, facilities, departments, types, categories, assignees, submitLabel,
}: {
  action: (prev: FindingFormState, formData: FormData) => Promise<FindingFormState>;
  initial: FindingFormValues;
  facilities: Option[];
  departments: Option[];
  types: Option[];
  categories: (Option & { findingTypeId: string })[];
  assignees: Option[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [v, setV] = useState(initial);
  const set = (k: keyof FindingFormValues) => (val: string) => setV((prev) => ({ ...prev, [k]: val }));
  const text = (k: keyof FindingFormValues) => ({ name: k, value: v[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k)(e.target.value), className: input });

  return (
    <form action={formAction} className="space-y-6">
      {v.findingId && <input type="hidden" name="findingId" value={v.findingId} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Audit type *</label>
          <select name="auditType" value={v.auditType} onChange={(e) => set("auditType")(e.target.value)} className={input}>
            <option value="PRODUCT">Product audit</option>
            <option value="WASTE_LOG">Waste log audit</option>
            <option value="PLANT">Plant room audit</option>
          </select>
        </div>
        <div>
          <label className={label}>Date audited *</label>
          <input type="date" required {...text("auditDate")} />
        </div>
        <div>
          <label className={label}>Auditor initials</label>
          <input placeholder="e.g. MS/TL/KW" {...text("auditors")} />
        </div>
        <div>
          <label className={label}>Facility *</label>
          <Select name="facilityId" value={v.facilityId} onChange={set("facilityId")} options={facilities} required />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Finding category</label>
          <select
            name="categoryId"
            value={v.categoryId}
            onChange={(e) => {
              const c = categories.find((x) => x.id === e.target.value);
              // Picking a category sets its impact level (finding type), as in the tracker's Key.
              setV((prev) => ({ ...prev, categoryId: e.target.value, findingTypeId: c ? c.findingTypeId : prev.findingTypeId }));
            }}
            className={input}
          >
            <option value="">None / other</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Finding type (impact) *</label>
          <Select name="findingTypeId" value={v.findingTypeId} onChange={set("findingTypeId")} options={types} required />
        </div>
        <div>
          <label className={label}>Due date</label>
          <input type="date" {...text("dueDate")} />
          <p className="mt-1 text-xs text-gray-400">Blank = the finding type&apos;s default.</p>
        </div>
        <div>
          <label className={label}>Department (Dept. 1) *</label>
          <Select name="departmentId" value={v.departmentId} onChange={set("departmentId")} options={departments} required />
        </div>
        <div>
          <label className={label}>Second department</label>
          <Select name="secondDepartmentId" value={v.secondDepartmentId} onChange={set("secondDepartmentId")} options={departments} blank="None" />
        </div>
        <div>
          <label className={label}>Assigned to</label>
          <Select name="assignedToId" value={v.assignedToId} onChange={set("assignedToId")} options={assignees} blank="Nobody in particular" />
        </div>
      </div>

      <div>
        <label className={label}>Discrepancy finding *</label>
        <textarea rows={3} required placeholder="What was found, e.g. “Count is on, IOC count shows 120”" {...text("description")} />
      </div>

      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">What was audited</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {v.auditType !== "PLANT" && (
            <>
              <div><label className={label}>Product</label><input {...text("product")} /></div>
              <div><label className={label}>Batch ID</label><input {...text("batchId")} /></div>
              <div><label className={label}>PID</label><input {...text("pid")} /></div>
            </>
          )}
          <div><label className={label}>Strain</label><input {...text("strain")} /></div>
          <div><label className={label}>Quantity</label><input type="number" step="any" {...text("quantity")} /></div>
          <div><label className={label}>Unit</label><input placeholder="qty, g, lb…" {...text("unit")} /></div>
          {v.auditType === "PLANT" && (
            <>
              <div><label className={label}>Room</label><input {...text("room")} /></div>
              <div><label className={label}>Serial no.</label><input {...text("serialNo")} /></div>
            </>
          )}
          {v.auditType === "WASTE_LOG" && (
            <>
              <div><label className={label}>Reference # (written log)</label><input {...text("reference")} /></div>
              <div><label className={label}>Weight disposed (g)</label><input type="number" step="any" {...text("weightGrams")} /></div>
              <div><label className={label}>Date of physical disposal</label><input type="date" {...text("disposalDate")} /></div>
            </>
          )}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label}>Correction</label><textarea rows={2} {...text("correction")} /></div>
        <div><label className={label}>Monitoring notes</label><textarea rows={2} {...text("monitoringNotes")} /></div>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
