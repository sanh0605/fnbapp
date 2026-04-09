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

  function getSession() {
    try {
      const raw = localStorage.getItem('fnb_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function isLoggedIn() { return getSession() !== null; }

  function getRole() {
    const s = getSession();
    return s ? s.role : null;
  }

  function getName() {
    const s = getSession();
    return s ? s.name : '';
  }

  function can(permission) {
    const s = getSession();
    if (!s) return false;
    return s.permissions && s.permissions.includes(permission);
  }

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

  function requireRole(role) {
    if (!isLoggedIn() || getRole() !== role) {
      window.location.href = getLoginPath();
      return false;
    }
    return true;
  }

  function logout() {
    localStorage.removeItem('fnb_session');
    window.location.href = getLoginPath();
  }

  function getLoginPath() {
    const depth = window.location.pathname.split('/').length - 2;
    return '../'.repeat(Math.max(depth, 1)) + 'auth/login.html';
  }

  function getHomePath() {
    const depth = window.location.pathname.split('/').length - 2;
    return '../'.repeat(Math.max(depth, 1)) + 'home/index.html';
  }

  function showIf(permission, element) {
    if (!element) return;
    element.style.display = can(permission) ? '' : 'none';
  }

  function showIfRole(role, element) {
    if (!element) return;
    element.style.display = getRole() === role ? '' : 'none';
  }

  return {
    getSession, isLoggedIn, getRole, getName,
    can, require, requireRole, logout,
    showIf, showIfRole, getHomePath,
  };
})();