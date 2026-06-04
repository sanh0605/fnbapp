import { NextResponse } from "next/server";
import { findAllNoCache, insert, remove } from "@/lib/sheets_db";

function normalize(str: string): string {
  return str.toLowerCase().trim()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/[đ]/g, 'd');
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNo = searchParams.get("order_no");

    if (!orderNo) {
      return NextResponse.json({ error: "Missing order_no" }, { status: 400 });
    }

    const [orders, orderLines] = await Promise.all([
      findAllNoCache("Orders"),
      findAllNoCache("Order_Lines"),
    ]);

    const order = orders.find((o: any) => o.order_no === orderNo);
    if (!order) return NextResponse.json({ error: `Order ${orderNo} not found` });

    const linesToDelete = orderLines.filter((l: any) =>
      l.order_id === order.id && l.id?.startsWith("OL-RECOVER-")
    );

    for (const line of linesToDelete) {
      await remove("Order_Lines", line.id);
    }

    return NextResponse.json({
      success: true,
      deleted: linesToDelete.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNo = searchParams.get("order_no");
    const dryRun = searchParams.get("dry_run") === "1";

    if (!orderNo) {
      return NextResponse.json({ error: "Missing order_no" }, { status: 400 });
    }

    const body = await request.json();
    const { items } = body;

    const [orders, products, variants, allModifiers] = await Promise.all([
      findAllNoCache("Orders"),
      findAllNoCache("Products"),
      findAllNoCache("Product_Variants"),
      findAllNoCache("Modifiers"),
    ]);

    const order = orders.find((o: any) => o.order_no === orderNo);
    if (!order) return NextResponse.json({ error: `Order ${orderNo} not found` });

    const createdLines: any[] = [];
    const errors: string[] = [];
    const nowIso = order.created_at;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const normSearch = normalize(item.product_name);

      // Fuzzy match: normalize both sides, try exact then contains
      let product = products.find((p: any) => normalize(p.name) === normSearch);
      if (!product) {
        product = products.find((p: any) => normalize(p.name).includes(normSearch));
      }
      if (!product) {
        product = products.find((p: any) => normSearch.includes(normalize(p.name)));
      }
      if (!product) {
        errors.push(`Item ${i}: Product "${item.product_name}" not found. Similar: ${products.filter((p: any) => normalize(p.name).includes(normSearch.slice(0, 5))).map((p: any) => p.name).join(', ')}`);
        continue;
      }

      const variant = variants.find((v: any) =>
        v.product_id === product.id && v.size_name === item.size_name
      );
      if (!variant) {
        const available = variants.filter((v: any) => v.product_id === product.id);
        errors.push(`Item ${i}: Variant "${item.size_name}" for "${product.name}" not found. Available sizes: ${available.map((v: any) => v.size_name).join(', ')}`);
        continue;
      }

      const matchedModifiers: any[] = [];
      if (item.modifiers && item.modifiers.length > 0) {
        for (const modName of item.modifiers) {
          const normMod = normalize(modName);
          let mod = allModifiers.find((m: any) => normalize(m.name) === normMod);
          if (!mod) {
            mod = allModifiers.find((m: any) => normalize(m.name).includes(normMod) || normMod.includes(normalize(m.name)));
          }
          if (mod) {
            matchedModifiers.push({ id: mod.id, name: mod.name, price: Number(mod.price || 0) });
          }
        }
      }

      const line_id = `OL-RECOVER-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      const lineData = {
        id: line_id,
        order_id: order.id,
        product_id: product.id,
        variant_id: variant.id,
        qty: String(item.qty),
        unit_price: String(variant.price),
        line_discount: "0",
        discount_type: "VND",
        modifiers_json: JSON.stringify(matchedModifiers),
        created_at: nowIso,
      };

      if (!dryRun) {
        await insert("Order_Lines", lineData);
      }
      createdLines.push({
        ...lineData,
        product_name: product.name,
        size_name: variant.size_name,
        matched_modifiers: matchedModifiers.map((m: any) => m.name),
      });
    }

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      created: createdLines.length,
      errors: errors.length > 0 ? errors : undefined,
      lines: createdLines,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
