/**
 * src/lib/utils.js
 * Shared formatting & UI helpers — no DOM dependencies except toast()
 */

/**
 * Format số thành tiền VNĐ: 18000 → "18,000 ₫"
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
  return Number(n).toLocaleString('vi-VN') + ' ₫';
}

/**
 * Format ngày (và giờ tuỳ chọn)
 * @param {Date|string} d
 * @param {boolean} showTime
 * @returns {string}  "dd/mm/yyyy" hoặc "dd/mm/yyyy hh:mm"
 */
function fmtDate(d, showTime = false) {
  const dt = d instanceof Date ? d : new Date(d);
  const p = n => String(n).padStart(2, '0');
  const s = `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  return showTime ? `${s} ${p(dt.getHours())}:${p(dt.getMinutes())}` : s;
}

/**
 * Hiển thị toast (yêu cầu có <div id="toast"> trong trang)
 * @param {string} msg
 * @param {number} duration  ms (mặc định 2200)
 */
function toast(msg, duration = 2200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.style.opacity = '0', duration);
}
