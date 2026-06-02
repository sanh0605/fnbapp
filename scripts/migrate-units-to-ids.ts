import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function migrate() {
  const { findAll, update } = await import('../lib/sheets_db');
  console.log("Fetching Units...");
  const units = await findAll("Units");
  
  const getUnitId = (name: string) => {
    const u = units.find(unit => unit.name.toLowerCase() === name.toLowerCase());
    return u ? u.id : name;
  };

  console.log("Migrating Base_Ingredients...");
  const baseIngredients = await findAll("Base_Ingredients");
  for (const b of baseIngredients) {
    if (b.base_unit && !b.base_unit.startsWith("U-")) {
      const newId = getUnitId(b.base_unit);
      if (newId !== b.base_unit) {
        console.log(`Updating Base_Ingredient ${b.id}: ${b.base_unit} -> ${newId}`);
        await update("Base_Ingredients", b.id, { ...b, base_unit: newId });
      }
    }
  }

  console.log("Migrating UOM_Conversions...");
  const conversions = await findAll("UOM_Conversions");
  for (const c of conversions) {
    let needsUpdate = false;
    let newBase = c.base_unit;
    let newPurchased = c.purchased_unit;

    if (c.base_unit && !c.base_unit.startsWith("U-")) {
      newBase = getUnitId(c.base_unit);
      if (newBase !== c.base_unit) needsUpdate = true;
    }
    if (c.purchased_unit && !c.purchased_unit.startsWith("U-")) {
      newPurchased = getUnitId(c.purchased_unit);
      if (newPurchased !== c.purchased_unit) needsUpdate = true;
    }

    if (needsUpdate) {
      console.log(`Updating UOM_Conversion ${c.id}: ${c.purchased_unit}=>${newPurchased}, ${c.base_unit}=>${newBase}`);
      await update("UOM_Conversions", c.id, { ...c, base_unit: newBase, purchased_unit: newPurchased });
    }
  }

  console.log("Migrating Purchase_Order_Lines...");
  const poLines = await findAll("Purchase_Order_Lines");
  for (const p of poLines) {
    if (p.unit && !p.unit.startsWith("U-")) {
      const newId = getUnitId(p.unit);
      if (newId !== p.unit) {
        console.log(`Updating Purchase_Order_Line ${p.id}: ${p.unit} -> ${newId}`);
        await update("Purchase_Order_Lines", p.id, { ...p, unit: newId });
      }
    }
  }

  console.log("Migration Complete!");
}

migrate().catch(console.error);
