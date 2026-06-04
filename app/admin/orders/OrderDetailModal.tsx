"use client";

interface OrderLine {
  id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  size_name: string;
  qty: number;
  unit_price: number;
  line_discount: number;
  discount_type: string;
  modifiers: any[];
}

interface Order {
  id: string;
  order_no: string;
  display_order_no: string;
  brand_id: string;
  total_amount: number;
  subtotal_amount: number;
  discount_amount: number;
  discount_type: string;
  method: string;
  staff_name: string;
  created_at: string;
  lines: OrderLine[];
}

export default function OrderDetailModal({
  order,
  brands,
  onClose,
  onEdit,
  onDelete,
}: {
  order: Order;
  brands: any[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const brand = brands.find((b: any) => b.id === order.brand_id);
  const orderNo = order.display_order_no || order.order_no;

  const calculateLineTotal = (line: OrderLine) => {
    const modsPrice = (line.modifiers || []).reduce((sum: number, m: any) => sum + Number(m.price || 0), 0);
    const baseTotal = (Number(line.unit_price) + modsPrice) * Number(line.qty);
    let discount = 0;
    if (Number(line.line_discount) > 0) {
      if (line.discount_type === "PERCENT") {
        discount = (baseTotal * Number(line.line_discount)) / 100;
      } else {
        discount = Number(line.line_discount);
      }
    }
    return Math.max(0, baseTotal - discount);
  };

  const subtotal = order.lines.reduce((sum: number, l: OrderLine) => sum + calculateLineTotal(l), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{orderNo}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date(order.created_at).toLocaleString("vi-VN")}
              {brand && <span className="ml-2 text-blue-600 font-medium">{brand.name}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Payment info */}
          <div className="flex gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${order.method === 'Chuyen khoan' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {order.method === "Chuyen khoan" ? "Chuyen khoan" : "Tien mat"}
            </span>
            {order.staff_name && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                {order.staff_name}
              </span>
            )}
          </div>

          {/* Line items */}
          <div className="space-y-3">
            {order.lines.map((line: OrderLine, idx: number) => {
              const modsPrice = (line.modifiers || []).reduce((sum: number, m: any) => sum + Number(m.price || 0), 0);
              const baseTotal = (Number(line.unit_price) + modsPrice) * Number(line.qty);
              const lineTotal = calculateLineTotal(line);

              return (
                <div key={idx} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">
                        <span className="text-orange-600 mr-1">{line.qty}x</span>
                        {line.product_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Size {line.size_name}</div>
                      {(line.modifiers || []).length > 0 && (
                        <div className="text-xs text-indigo-600 mt-1">
                          + {line.modifiers.map((m: any) => m.name).join(", ")}
                        </div>
                      )}
                      {Number(line.line_discount) > 0 && (
                        <div className="text-xs text-red-500 mt-1">
                          Giam: -{line.discount_type === "PERCENT" ? `${line.line_discount}%` : `${Number(line.line_discount).toLocaleString("vi-VN")}d`}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {Number(line.line_discount) > 0 && (
                        <div className="text-[11px] text-gray-400 line-through">{baseTotal.toLocaleString("vi-VN")}d</div>
                      )}
                      <div className="font-bold text-gray-800">{lineTotal.toLocaleString("vi-VN")}d</div>
                      <div className="text-[11px] text-gray-400">{Number(line.unit_price).toLocaleString("vi-VN")}d / mon</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer - Totals and Actions */}
        <div className="border-t border-gray-100 shrink-0">
          <div className="px-5 py-3 bg-gray-50 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Tam tinh</span>
              <span className="font-medium">{subtotal.toLocaleString("vi-VN")}d</span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Giam gia ({order.discount_type === "PERCENT" ? `${order.discount_amount}%` : "VND"})</span>
                <span className="font-medium">-{Number(order.discount_amount).toLocaleString("vi-VN")}d</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200">
              <span className="text-gray-900">Tong cong</span>
              <span className="text-orange-600">{Number(order.total_amount || 0).toLocaleString("vi-VN")}d</span>
            </div>
          </div>
          <div className="px-5 py-4 flex gap-3 bg-white">
            <button
              onClick={onEdit}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Sua don
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
            >
              Xoa don
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
