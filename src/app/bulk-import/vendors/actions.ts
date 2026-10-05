"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/require-admin";
import { DENIED, failure, readUpload, type BulkResult } from "../csv";
import { runVendorsImport } from "./import-vendors";

export async function importVendorsCsv(_prev: BulkResult, formData: FormData): Promise<BulkResult> {
  if (!(await getAdminSession())) return DENIED;
  const checkOnly = formData.get("checkOnly") === "on";
  const upload = await readUpload(formData);
  if ("error" in upload) return failure(upload.error, checkOnly);

  const result = await runVendorsImport(upload.text, { checkOnly });
  if (!result.checkOnly && result.created > 0) revalidatePath("/vendors");
  return result;
}
