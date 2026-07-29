import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 0 of the inventory transparency plan
 * (docs/superpowers/specs/2026-07-27-inventory-transparency-design.md).
 *
 * Read-only. Confirms or kills the hypothesis that wrong
 * semi_products.batch_yield values are driving raw-ingredient stock negative
 * and inflating COGS. Performs no database writes; the only output artifact is
 * a dated JSON file under docs/audits/, per existing audit-script convention.
 */

const FLAG_LABELS: Record<string, string> = {
  NO_COOKING_RECIPE: "Chưa có công thức nấu",
  YIELD_DEFAULT_1: "Định mức mẻ chưa khai (đang là 1)",
  YIELD_SCALE_SUSPECT: "Nghi sai đơn vị định mức mẻ",
  OK: "Bình thường",
};

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { auditSemiProductYields } = await import("../lib/semi-product-yield-audit");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.log("Đang tải dữ liệu...");
  const [semiProducts, recipes, baseIngredients] = await Promise.all([
    findAllNoCache("Semi_Products"),
    findAllNoCache("Recipes"),
    findAllNoCache("Base_Ingredients"),
  ]);

  // CLAUDE.md section 7: the owner-facing report must use real names, never ids.
  const ingredientNames = new Map<string, string>();
  for (const ingredient of baseIngredients as Array<Record<string, unknown>>) {
    const id = String(ingredient.id || "");
    if (id) ingredientNames.set(id, String(ingredient.name || id));
  }
  for (const semiProduct of semiProducts as Array<Record<string, unknown>>) {
    const id = String(semiProduct.id || "");
    if (id) ingredientNames.set(id, String(semiProduct.name || id));
  }
  const nameOf = (id: string) => ingredientNames.get(id) || id;

  const findings = auditSemiProductYields({
    semiProducts: semiProducts as never,
    recipes: recipes as never,
  });

  const suspicious = findings.filter(finding => finding.flag !== "OK");

  console.log("");
  console.log("=== KIỂM TRA ĐỊNH MỨC MẺ BÁN THÀNH PHẨM ===");
  console.log(`Đã kiểm: ${findings.length} bán thành phẩm đang được dùng trong công thức`);
  console.log(`Nghi có vấn đề: ${suspicious.length}`);
  console.log("");

  for (const finding of findings) {
    const marker = finding.flag === "OK" ? "   " : ">> ";
    console.log(`${marker}${finding.semiProductName} (${FLAG_LABELS[finding.flag]})`);
    console.log(`      Đơn vị gốc: ${finding.baseUnit || "chưa khai"} | Định mức mẻ đang khai: ${finding.batchYield}`);

    if (finding.cookingInputs.length > 0) {
      const inputs = finding.cookingInputs
        .map(row => `${nameOf(row.ingredientId)} ${row.quantity}`)
        .join(", ");
      console.log(`      Công thức nấu một mẻ: ${inputs}`);
      console.log(`      Lượng vào lớn nhất / định mức mẻ = ${finding.scaleRatio.toFixed(2)}`);
    } else {
      console.log("      Không tìm thấy công thức nấu cho bán thành phẩm này");
    }

    console.log(`      Mỗi ly dùng khoảng ${finding.typicalConsumedQuantity} ${finding.baseUnit || ""}`.trimEnd());

    if (finding.impliedRawPerServing.length > 0) {
      const implied = finding.impliedRawPerServing
        .map(row => `${nameOf(row.ingredientId)} ${row.quantity.toFixed(2)}`)
        .join(", ");
      console.log(`      => Hệ thống đang trừ mỗi ly: ${implied}`);
    }
    console.log("");
  }

  if (suspicious.length === 0) {
    console.log("Không phát hiện định mức mẻ bất thường. Giả thuyết này bị loại;");
    console.log("chuyển sang Chức năng 2 trong spec để tìm nguyên nhân khác.");
  } else {
    console.log("Đọc dòng '=> Hệ thống đang trừ mỗi ly' của các mục đánh dấu >>.");
    console.log("Nếu con số đó lớn hơn thực tế một cách phi lý, giả thuyết được xác nhận.");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const outputPath = path.join("docs", "audits", `${stamp}-semi-product-yield-diagnostic.json`);
  fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2));
  console.log("");
  console.log(`Đã ghi chi tiết: ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
