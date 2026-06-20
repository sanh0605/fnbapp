# UI/UX Polish Plan: Fix Modal Overlay & POS Premium Dark Mode

**Workstream:** Polish / UI-UX
**Date:** 2026-06-19
**Target:** Sửa lỗi giao diện Modal và Redesign màn hình POS sang Premium Dark Mode (Glassmorphism + Bento Box).

---

## 1. Sửa lỗi Modal Overlay bị cắt (Admin Inventory / Suppliers)

### Hiện trạng & Root Cause
- **Vấn đề:** Màn hình tạo mới của Nhà Cung Cấp, Nhóm Nguyên Liệu, và Hàng Mua Vào bị tình trạng lớp phủ đen (`bg-black/50`) chỉ che được nửa trên màn hình, phía dưới bị rỗng.
- **Nguyên nhân:** Các Nút bấm + Modal Form đang được lồng vào bên trong component `<StickyFilterBar>`. Component này sử dụng class `backdrop-blur-md` (`backdrop-filter` trong CSS). Theo chuẩn CSS, `backdrop-filter` tạo ra một "containing block" mới. Điều này ép toàn bộ các phần tử `position: fixed` (như Modal Overlay) bên trong nó phải tính toán tọa độ và kích thước dựa trên thẻ cha `<StickyFilterBar>` thay vì toàn màn hình (viewport).

### Giải pháp
Sử dụng **React Portals** (`createPortal` từ `react-dom`) cho các file Form Component. 
- Giữ nguyên vị trí gắn component (vẫn gọi `<SupplierForm />` bên trong `StickyFilterBar`).
- Nhưng nội dung thực tế của Modal sẽ được "bắn" ra ngoài `document.body`.
- Đảm bảo Modal luôn nằm ở lớp ngoài cùng của DOM, không bị kẹt bởi bất kỳ thẻ cha nào có `transform` hay `backdrop-filter`.

---

## 2. Redesign POS UI (Premium Dark Mode & Glassmorphism)

### Mục tiêu Thiết Kế (Design Direction)
- **Cảm hứng:** augmentcode.com
- **Phong cách:** Premium Dark Mode, Glassmorphism (Kính mờ), Bento Box Layout (Các khối bo góc tròn trịa cách nhau bởi gap).
- **Yêu cầu cốt lõi:** Phân tách cực kỳ rõ ràng 3 loại giảm giá bằng **MÀU SẮC NEON** trên nền tối ở khu vực Hóa đơn (Bill - Nửa bên phải).

### Design Tokens (TailwindCSS)
1. **Background:** Nền tổng thể `bg-zinc-950`.
2. **Bento Box & Glassmorphism:** Sử dụng nền Zinc bán trong suốt `bg-zinc-900/40 backdrop-blur-2xl border border-white/10` cùng độ bo góc lớn `rounded-[2.5rem]`.
3. **Typography:** Chữ trắng và xám kẽm (`text-zinc-100`, `text-zinc-500`).
4. **Màu Phân Loại Giảm Giá (Discount Colors - CỰC KỲ QUAN TRỌNG):**
   - **Khuyến mãi hệ thống trên món (System Promo):** Màu **Xanh Cyan** 
     - Class: `bg-cyan-500/10 border-cyan-500/20 text-cyan-400` kèm hiệu ứng chấm tròn `animate-pulse`.
   - **Giảm giá từng món (Manual Item Discount):** Màu **Cam (Orange)**
     - Class: `bg-orange-500/10 border-orange-500/20 text-orange-400`.
   - **Giảm giá toàn bill (Manual Order Discount):** Màu **Đỏ/Hồng Rực (Rose)**
     - Class: `bg-rose-500/5 border-rose-500/20 text-rose-500`.
5. **Call-to-Action (Thanh toán):** Neo-brutalism pha Glassmorphism, nút thanh toán nền trắng chữ đen `bg-zinc-100 hover:bg-white text-black font-black` kết hợp shadow sáng.

### Kiến trúc UI (Mockup Layout cho `POSScreen.tsx`)

```tsx
<div className="h-screen w-full bg-zinc-950 text-zinc-200 flex overflow-hidden font-sans selection:bg-indigo-500/30">
  
  {/* ================= NỬA TRÁI: DANH MỤC & SẢN PHẨM (Bento Box) ================= */}
  <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
    {/* Header / Category Tabs */}
    <div className="flex justify-between items-center bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
       {/* Category Tabs: Tương thích với tông màu zinc */}
    </div>
    
    {/* Product Grid */}
    <div className="grid grid-cols-3 xl:grid-cols-4 gap-5">
       {/* Product Card
           class: p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all
       */}
    </div>
  </div>

  {/* ================= NỬA PHẢI: HÓA ĐƠN / CART (Bento Box - Glassmorphism) ================= */}
  <div className="w-[450px] h-full p-4 bg-zinc-950">
    <div className="h-full flex flex-col rounded-[2.5rem] bg-zinc-900/40 border border-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden relative">
      
      {/* Header: Thông tin đơn hàng */}
      <div className="p-6 border-b border-white/5 relative z-10">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Tạo đơn mới</h2>
          <span className="px-3 py-1 rounded-full bg-white/5 text-zinc-500 text-xs font-medium">10:45 AM</span>
        </div>
      </div>

      {/* Nội dung Cart: Các món ăn */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 custom-scrollbar">
        {/* Một dòng sản phẩm mẫu */}
        <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all">
          <div className="flex justify-between">
            <div>
              <h4 className="font-semibold text-zinc-200">Sữa Dâu Tây</h4>
              <p className="text-xs text-zinc-500">Size L • Full Topping</p>
            </div>
            <div className="text-right">
              <span className="block text-zinc-100 font-bold">35,000đ</span>
            </div>
          </div>

          {/* PHÂN TÁCH GIẢM GIÁ TỪNG MÓN */}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* 1. Khuyến mãi hệ thống trên món (Cyan) */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-bold text-cyan-400 uppercase">Hệ thống: -10,000đ</span>
            </div>

            {/* 2. Thu ngân giảm giá món (Orange) */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <span className="text-[10px] font-bold text-orange-400 uppercase">Thu ngân: -5,000đ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Tổng kết (Bento Summary) */}
      <div className="p-6 bg-black/20 border-t border-white/10 space-y-3 relative z-10">
        <div className="flex justify-between text-sm text-zinc-500">
          <span>Tạm tính</span>
          <span className="text-zinc-300">120,000đ</span>
        </div>

        {/* 3. Giảm giá toàn Bill (Red) */}
        <div className="flex justify-between items-center p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20 cursor-pointer hover:bg-rose-500/10 transition-colors">
          <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Giảm giá toàn bill</span>
          <span className="text-rose-500 font-black">-15,000đ</span>
        </div>

        <div className="pt-4 flex justify-between items-end">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Tổng thanh toán</p>
            <div className="text-4xl font-black text-white tracking-tighter shadow-cyan-500/20 drop-shadow-md">
              90,000<span className="text-lg ml-1 text-zinc-500">đ</span>
            </div>
          </div>
          <button className="h-16 px-8 bg-zinc-100 hover:bg-white text-black font-black rounded-2xl transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            THANH TOÁN
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Các bước Triển khai (Execution Steps)
1. **Khắc phục Modal Overlay:** Sử dụng `createPortal` cập nhật `SupplierForm`, `BaseIngredientForm`, và `ItemForm`.
2. **Cấu trúc lại Layout POS:** Thay đổi wrapper lớn nhất của `components/POSScreen.tsx` để tích hợp toàn bộ thiết kế Bento Box Glassmorphism ở trên.
3. **Phân rã màu Giảm giá (Bill Summary):**
   - Viết UI logic render ra 3 dòng chiết khấu với 3 dải màu đã định (Cyan, Orange, Red) trong phần Cart Summary.
   - Thêm hiệu ứng màu tương ứng vào phần Cart Item (Orange cho món).
4. **Đồng bộ hóa Modal trong POS:** Áp dụng phong cách Glassmorphism nền tối cho Modal chọn sản phẩm và Modal Checkout để ăn khớp thiết kế tổng thể.
