/**
 * auth.js — Hệ thống phân quyền FNB App
 *
 * Cách dùng: thêm vào đầu mỗi trang cần bảo vệ
 *
 *   <script src="../auth/auth.js"></script>
 *   <script>
 *     Auth.require('pos');           // cần quyền 'pos' mới vào được
 *     Auth.requireRole('owner');     // chỉ chủ mới vào được
 *   </script>
 */

const Auth = (() => {

  // Lấy session hiện tại
  function getSession() {
    try {
      const raw = localStorage.getItem('fnb_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Kiểm tra đã đăng nhập chưa
  function isLoggedIn() {
    return getSession() !== null;
  }

  // Lấy vai trò hiện tại
  function getRole() {
    const s = getSession();
    return s ? s.role : null;
  }

  // Lấy tên người dùng
  function getName() {
    const s = getSession();
    return s ? s.name : '';
  }

  // Kiểm tra có quyền cụ thể không
  function can(permission) {
    const s = getSession();
    if (!s) return false;
    return s.permissions && s.permissions.includes(permission);
  }

  // Bảo vệ trang — cần đăng nhập và có quyền
  // Nếu không đủ điều kiện → chuyển về login
  function require(permission) {
    if (!isLoggedIn()) {
      window.location.href = getLoginPath();
      return false;
    }
    if (permission && !can(permission)) {
      window.location.href = getLoginPath();
      return false;
    }
    return true;
  }

  // Bảo vệ trang — chỉ cho phép vai trò cụ thể
  function requireRole(role) {
    if (!isLoggedIn() || getRole() !== role) {
      window.location.href = getLoginPath();
      return false;
    }
    return true;
  }

  // Đăng xuất
  function logout() {
    localStorage.removeItem('fnb_session');
    window.location.href = getLoginPath();
  }

  // Tìm đường dẫn đến login.html tương đối
  function getLoginPath() {
    const depth = window.location.pathname.split('/').length - 2;
    return '../'.repeat(depth) + 'auth/login.html';
  }

  // Hiện/ẩn phần tử theo quyền
  // Dùng: Auth.showIf('recipe', document.getElementById('recipeBtn'))
  function showIf(permission, element) {
    if (!element) return;
    element.style.display = can(permission) ? '' : 'none';
  }

  // Hiện/ẩn phần tử theo vai trò
  function showIfRole(role, element) {
    if (!element) return;
    element.style.display = getRole() === role ? '' : 'none';
  }

  return {
    getSession,
    isLoggedIn,
    getRole,
    getName,
    can,
    require,
    requireRole,
    logout,
    showIf,
    showIfRole,
  };
})();
