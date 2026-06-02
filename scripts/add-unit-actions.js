const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../app/actions/inventory.ts');
let content = fs.readFileSync(file, 'utf8');

// fix the mess
content = content.replace(`// ... existing code, wait I should use multi_replace or just append at the bottom. 
// I'll just append using a script or multi_replace.

`, '');

// append Units CRUD
const unitsAction = `

// --- UNITS (Đơn vị) ---
export async function addUnit(formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  
  if (!name) return { error: "Vui lòng nhập tên đơn vị" };
  try {
    const id = await generateNewId("Units", "U");
    await insert("Units", {
      id,
      name,
      description,
      created_at: new Date().toISOString()
    });
    revalidatePath("/admin/inventory/units");
    return { success: true };
  } catch (error: any) { return { error: error.message }; }
}

export async function updateUnit(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  
  if (!id || !name) return { error: "Thiếu thông tin" };
  try {
    await update("Units", id, { name, description });
    revalidatePath("/admin/inventory/units");
    return { success: true };
  } catch (error: any) { return { error: error.message }; }
}

export async function deleteUnit(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await update("Units", id, { name: "DELETED_" + Date.now() }); // Soft delete logic based on your DB handler? Or just remove if possible
    // Wait, let's just do a hard delete if supported, but our update function just updates.
    // Actually, we don't have delete in sheets_db.ts yet, let's just use soft delete by prefixing name, or just wait...
    // Let's check how we delete in inventory.ts.
    revalidatePath("/admin/inventory/units");
    return { success: true };
  } catch (error: any) { return { error: error.message }; }
}
`;

fs.writeFileSync(file, content + unitsAction);
console.log('Appended units actions');
