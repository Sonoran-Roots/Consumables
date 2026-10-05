"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/require-admin";
import { DENIED, failure, readUpload, type BulkResult } from "../csv";
import { runItemsImport } from "./import-items";

export async function importItemsCsv(_prev: BulkResult, formData: FormData): Promise<BulkResult> {
  if (!(await getAdminSession())) return DENIED;
  const checkOnly = formData.get("checkOnly") === "on";
  const upload = await readUpload(formData);
  if ("error" in upload) return failure(upload.error, checkOnly);

  const result = await runItemsImport(upload.text, {
    updateExisting: formData.get("updateExisting") === "on",
    checkOnly,
  });
  if (!result.checkOnly && (result.created > 0 || result.updated > 0)) {
    revalidatePath("/items");
    revalidatePath("/inventory");
  }
  return result;
}
