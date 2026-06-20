/**
 * Phase E.3: Re-migrate per E.2 Audit
 */

import * as fs from "fs";
import * as path from "path";
import { findAllNoCache } from "../lib/sheets_db";
import { batchUpdateOrders } from "./batch-sheets-orders";
import { batchUpdateOrderLines } from "./batch-sheets-utils";

const IS_LIVE = process.argv.includes("--live");

async function main() {
  console.log(`[remigrate-per-audit] mode=${IS_LIVE ? "LIVE" : "DRY-RUN"}`);

  const orders = await findAllNoCache("Orders");
  const promos = await findAllNoCache("Promotions");
  
  let reportData = "";
  try {
    const reportPath = path.resolve(process.cwd(), "scripts", "output", "reaudit-report.md");
    reportData = fs.readFileSync(reportPath, "utf8");
  } catch (e) {
    throw new Error("Could not find reaudit-report.md");
  }

  // Parse report to find target order_nos
  const missingIdMatches = [...reportData.matchAll(/### ([\w\d]+) \(/g)].map(m => m[1]);
  const invalidIdMatches = [...reportData.matchAll(/- \*\*([\w\d]+)\*\* \(/g)].map(m => m[1]);

  console.log(`Found ${missingIdMatches.length} PROMO_MISSING_ID orders`);
  console.log(`Found ${invalidIdMatches.length} PROMO_ID_INVALID orders`);

  const orderUpdates: any[] = [];
  const lineUpdates: any[] = [];
  
  const sampleMissing: any[] = [];
  const sampleInvalid: any[] = [];

  // Parse lines details from report for missing IDs
  const linesMap = new Map<string, { promoId: string | null, lines: any[] }>();
  const missingBlocks = reportData.split("### ");
  for (let i = 1; i < missingBlocks.length; i++) {
    const block = missingBlocks[i];
    const orderNoMatch = block.match(/^([\w\d]+)/);
    if (!orderNoMatch) continue;
    const orderNo = orderNoMatch[1];
    
    if (missingIdMatches.includes(orderNo)) {
      const matchedPromoMatch = block.match(/\((PRM-[\d]+)\)/);
      const promoId = matchedPromoMatch ? matchedPromoMatch[1] : null;
      
      const lineMatches = [...block.matchAll(/- Line ([\w\d-]+): expected promo: ([\d.]+), current line_discount: ([\d.]+), current line_manual: ([\d.]+)/g)];
      
      const lines = lineMatches.map(m => ({
        variant_id: m[1],
        expected_promo: Number(m[2]),
        curr_discount: Number(m[3]),
        curr_manual: Number(m[4])
      }));
      
      linesMap.set(orderNo, { promoId, lines });
    }
  }

  for (const order of orders) {
    if (missingIdMatches.includes(order.order_no)) {
      const data = linesMap.get(order.order_no);
      if (!data || !data.promoId) continue;
      
      const promo = promos.find((p: any) => p.id === data.promoId);
      
      orderUpdates.push({
        id: order.id,
        data: {
          applied_promotion_id: data.promoId,
          applied_promotion_snapshot_json: promo ? JSON.stringify(promo) : ""
        }
      });
      
      const orderLines = await findAllNoCache("Order_Lines");
      const myLines = orderLines.filter((l: any) => l.order_id === order.id);
      
      for (const l of myLines) {
        const parsedLine = data.lines.find((pl: any) => pl.variant_id === l.variant_id);
        if (parsedLine && parsedLine.expected_promo > 0) {
          const old_combined = Number(l.line_discount || 0) + Number(l.line_manual_discount || 0);
          const new_line_discount = parsedLine.expected_promo;
          const new_line_manual = Math.max(0, old_combined - new_line_discount);
          
          lineUpdates.push({
            id: l.id,
            data: {
              line_discount: new_line_discount,
              line_manual_discount: new_line_manual
            }
          });
        }
      }
      
      if (sampleMissing.length < 5) sampleMissing.push(order.order_no);
    } 
    else if (invalidIdMatches.includes(order.order_no)) {
      orderUpdates.push({
        id: order.id,
        data: {
          applied_promotion_id: "",
          applied_promotion_snapshot_json: ""
        }
      });
      
      const orderLines = await findAllNoCache("Order_Lines");
      const myLines = orderLines.filter((l: any) => l.order_id === order.id);
      
      for (const l of myLines) {
        if (Number(l.line_discount) > 0) {
           const old_promo = Number(l.line_discount);
           const old_manual = Number(l.line_manual_discount || 0);
           
           lineUpdates.push({
             id: l.id,
             data: {
               line_discount: 0,
               line_manual_discount: old_promo + old_manual
             }
           });
        }
      }
      if (sampleInvalid.length < 5) sampleInvalid.push(order.order_no);
    }
  }

  console.log(`Order updates prepared: ${orderUpdates.length}`);
  console.log(`Line updates prepared: ${lineUpdates.length}`);
  console.log(`Sample Missing ID (Fix): ${sampleMissing.join(", ")}`);
  console.log(`Sample Invalid ID (Clear): ${sampleInvalid.join(", ")}`);

  if (IS_LIVE) {
    if (orderUpdates.length > 0) {
      console.log(`Writing ${orderUpdates.length} order updates...`);
      await batchUpdateOrders(orderUpdates);
    }
    if (lineUpdates.length > 0) {
      console.log(`Writing ${lineUpdates.length} line updates...`);
      await batchUpdateOrderLines(lineUpdates);
    }
    console.log("Updates complete.");
  } else {
    console.log("Run with --live to execute.");
  }
}

main().catch(console.error);
