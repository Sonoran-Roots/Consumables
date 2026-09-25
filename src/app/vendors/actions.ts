"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateVendorState = { error?: string } | null;

export async function createVendor(
  _prevState: CreateVendorState,
  formData: FormData
): Promise<CreateVendorState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Name is required." };
  }

  try {
    await db.vendor.create({ data: { name } });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `A vendor named "${name}" already exists.` };
    }
    return { error: "Could not create vendor. Please try again." };
  }

  revalidatePath("/vendors");
  redirect("/vendors");
}
