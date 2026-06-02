"use client";

import { useState } from "react";
import { deleteOrder } from "@/app/actions/orders";

export default function OrderTable({ initialOrders }: { initialOrders: any[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
  const currentOrders = orders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleDeleteClick = (order: any) => {
    setOrderToDelete(order);
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;
    const orderId = orderToDelete.id;
    
    // Optimistic Update
    const prevOrders = [...orders];
    setOrders(orders.filter(o => o.id !== orderId));
    setOrderToDelete(null);
    
    const res = await deleteOrder(orderId);
    if (!res.success) {
      // Revert if failed
      setOrders(prevOrders);
      alert("Lỗi xoá đơn: " + res.error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
            <tr>
              <th className="px-6 py-4">Mã Đơn</th>
              <th className="px-6 py-4">Thời gian</th>
              <th className="px-6 py-4">Sản phẩm (Chi tiết)</th>
              <th className="px-6 py-4 text-right">Tổng tiền</th>
              <th className="px-6 py-4 text-center">Phương thức</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Chưa có đơn hàng nào
                </td>
              </tr>
            ) : (
              currentOrders.map((order) => (
                <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${deletingId === order.id ? "opacity-50" : ""}`}>
                  <td className="px-6 py-4 font-bold text-gray-900">
                    {order.display_order_no || order.order_no}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(order.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1.5">
                      {order.lines && order.lines.map((line: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <span className="font-bold text-gray-700">{line.qty}x</span> {line.product_name} <span className="text-gray-400">({line.size_name})</span>
                          {line.modifiers && line.modifiers.length > 0 && (
                            <div className="text-[10px] text-gray-500 ml-4 mt-0.5">
                              + {line.modifiers.map((m:any) => m.name).join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-orange-600">
                    {Number(order.total_amount || 0).toLocaleString("vi-VN")} đ
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${order.method === 'Chuyển khoản' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {order.method === "Chuyển khoản" ? "💳 Chuyển khoản" : "💵 Tiền mặt"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteClick(order)}
                      disabled={deletingId === order.id}
                      className="text-red-500 hover:text-red-700 font-medium px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      {deletingId === order.id ? "Đang xoá..." : "Xoá đơn"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Đang hiển thị <span className="font-bold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> đến <span className="font-bold text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, orders.length)}</span> trong tổng số <span className="font-bold text-gray-900">{orders.length}</span> đơn hàng
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
            >
              Trước
            </button>
            <div className="flex items-center px-2 font-medium text-gray-700">
              Trang {currentPage} / {totalPages}
            </div>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-red-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-red-800">Xác nhận xoá đơn</h3>
                <p className="text-sm text-red-600 font-medium">{orderToDelete.display_order_no || orderToDelete.order_no}</p>
              </div>
            </div>
            <div className="p-5 text-gray-600 text-sm leading-relaxed">
              Anh có chắc chắn muốn xoá đơn hàng này không? Việc xoá sẽ đồng thời <strong>hoàn trả lại toàn bộ nguyên vật liệu</strong> của đơn này vào kho. Thao tác này không thể hoàn tác.
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button 
                onClick={() => setOrderToDelete(null)}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
              >
                Huỷ bỏ
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-sm shadow-red-200 transition-colors"
              >
                Đồng ý xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
