'use server';

import { getSheetData, appendRow, sheets, SPREADSHEET_ID } from '@/lib/sheets';
import { randomUUID } from 'crypto';

/**
 * Lấy danh sách sản phẩm từ Sheet
 */
export async function getProducts() {
  return await getSheetData('products');
}

/**
 * Lấy danh sách nguyên vật liệu
 */
export async function getRawMaterials() {
  return await getSheetData('raw_materials');
}

/**
 * Lấy danh sách đơn hàng
 */
export async function getOrders() {
  return await getSheetData('orders');
}

/**
 * Tạo một đơn hàng mới (Trực tiếp)
 */
export async function createOrder(orderData: any) {
  // orderData: { client_id, total, method, items, staff_name, outlet_id, brand_id, ... }
  const id = randomUUID();
  const created_at = new Date().toISOString();
  const order_num = `#${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`; // Demo order num

  const row = [
    id,
    orderData.client_id || '',
    order_num,
    created_at,
    orderData.total || 0,
    orderData.subtotal || 0,
    orderData.discount_amount || 0,
    orderData.actual_received || 0,
    orderData.method || 'Tiền mặt',
    JSON.stringify(orderData.items || []),
    orderData.staff_name || '',
    orderData.outlet_id || '',
    orderData.brand_id || '',
    orderData.voided || false
  ];

  await appendRow('orders', row);
  return { success: true, id, order_num };
}

/**
 * Đồng bộ nhiều đơn hàng cùng lúc từ Client (Sync Engine)
 */
export async function syncOrders(ordersArray: any[]) {
  if (!ordersArray || ordersArray.length === 0) return { success: true, count: 0 };

  const rows = ordersArray.map(orderData => {
    return [
      orderData.id || randomUUID(),
      orderData.client_id || '',
      orderData.order_num || `#${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      orderData.created_at || new Date().toISOString(),
      orderData.total || 0,
      orderData.subtotal || 0,
      orderData.discount_amount || 0,
      orderData.actual_received || 0,
      orderData.method || 'Tiền mặt',
      JSON.stringify(orderData.items || []),
      orderData.staff_name || '',
      orderData.outlet_id || '',
      orderData.brand_id || '',
      orderData.voided || false
    ];
  });

  // Sử dụng API values.append để thêm nhiều dòng một lúc
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `orders!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  });

  return { success: true, count: rows.length };
}
