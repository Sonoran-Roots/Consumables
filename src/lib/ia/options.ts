import { db } from "@/lib/db";

// The dropdown lists every finding form / filter needs.
export async function getFormOptions() {
  const [facilities, departments, types, categories, reasons, assignees] = await Promise.all([
    db.iaFacility.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.iaDepartment.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.iaFindingType.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.iaFindingCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, findingTypeId: true } }),
    db.iaAdjustmentReason.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    // Anyone with Inventory Audit access can be given a finding.
    db.user.findMany({ where: { auditRole: { not: null } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  return {
    facilities,
    departments,
    types,
    categories,
    reasons,
    assignees: assignees.map((u) => ({ id: u.id, name: u.name || u.email })),
  };
}
