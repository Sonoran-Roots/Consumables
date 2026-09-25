"use server";

import { revalidatePath } from "next/cache";
import { runInventoryImport, type ImportResult } from "./import-logic";

export type ImportState = ImportResult | null;

export async function importInventoryCsv(
  _prevState: ImportState,
  formData: FormData
): Promise<ImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { successCount: 0, errorCount: 0, errors: ["Please choose a CSV file."] };
  }

  const text = await file.text();
  const result = await runInventoryImport(text);

  if (result.successCount > 0) {
    revalidatePath("/inventory");
    revalidatePath("/items");
  }

  return result;
}
