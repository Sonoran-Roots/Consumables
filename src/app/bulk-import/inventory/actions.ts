"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/require-admin";
import { DENIED, failure, readUpload, type BulkResult } from "../csv";
import { runInventoryImport } from "./import-logic";

export async function importInventoryCsv(_prev: BulkResult, formData: FormData): Promise<BulkResult> {
  if (!(await getAdminSession())) return DENIED;
  const checkOnly = formData.get("checkOnly") === "on";
  const upload = await readUpload(formData);
  if ("error" in upload) return failure(upload.error, checkOnly);

  const r = await runInventoryImport(upload.text, { dryRun: checkOnly });

  if (!checkOnly && r.successCount > 0) {
    revalidatePath("/inventory");
    revalidatePath("/items");
    revalidatePath("/vendors");
  }

  const notes: string[] = [];
  if (r.summary) {
    notes.push(
      `Would also create ${r.summary.newItems} new item${r.summary.newItems === 1 ? "" : "s"} and ${r.summary.newVendors.length} new vendor${r.summary.newVendors.length === 1 ? "" : "s"}.`,
      `Total value of the rows: $${r.summary.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
    );
  }
  return {
    checkOnly,
    created: r.successCount,
    updated: 0,
    skipped: 0,
    errors: r.errors,
    notes,
  };
}
