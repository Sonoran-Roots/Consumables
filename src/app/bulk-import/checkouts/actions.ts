"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/require-admin";
import { DENIED, failure, readUpload, type BulkResult } from "../csv";
import { runCheckoutsImport } from "./import-checkouts";

export async function importCheckoutsCsv(_prev: BulkResult, formData: FormData): Promise<BulkResult> {
  if (!(await getAdminSession())) return DENIED;
  const checkOnly = formData.get("checkOnly") === "on";
  const upload = await readUpload(formData);
  if ("error" in upload) return failure(upload.error, checkOnly);

  const result = await runCheckoutsImport(upload.text, {
    checkOnly,
    createEmployees: formData.get("createEmployees") === "on",
  });
  if (!result.checkOnly && result.created > 0) {
    revalidatePath("/checkouts");
    revalidatePath("/inventory");
    revalidatePath("/employees");
  }
  return result;
}
