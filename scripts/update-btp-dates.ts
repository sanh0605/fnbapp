import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { findAll, update } from '../lib/sheets_db';

async function main() {
  console.log("Fetching recipes...");
  const recipes = await findAll('Recipes');
  
  // Lọc các công thức Bán Thành Phẩm đang active (end_date rỗng)
  const targetRecipes = recipes.filter((r: any) => 
    r.target_type === 'SEMI_PRODUCT' && 
    (!r.end_date || r.end_date === "")
  );

  console.log(`Found ${targetRecipes.length} active semi-product recipes.`);

  // Ngày mục tiêu: 10/04/2026 00:00:00 (Giờ VN)
  const targetDateStr = "2026-04-10T00:00:00+07:00";
  const targetIsoStr = new Date(targetDateStr).toISOString();

  for (const recipe of targetRecipes) {
    console.log(`Updating recipe ${recipe.id} for target_id ${recipe.target_id}...`);
    await update("Recipes", recipe.id, {
      created_at: targetIsoStr
    });
  }

  console.log("Done updating semi-product recipes.");
}

main().catch(console.error);
