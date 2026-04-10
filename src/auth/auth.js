// src/auth/auth.js
// Hệ thống phân quyền FNB App — dùng Supabase

const Auth = (() => {
  const PERMISSIONS = {
    owner:   ['pos','inventory_view','inventory_edit','revenue','finance','schedule','recipe','menu','payment_settings','user_settings'],
    manager: ['pos','inventory_view','inventory_edit','revenue','finance','schedule'],
    staff:   ['pos','inventory_view'],
  };

  function getSession() {
    try { return JSON.parse(localStorage.getItem('fnb_session') || 'null'); }
    catch { return null; }
  }

  function setSession(user) {
    localStorage.setItem('fnb_session', JSON.stringify({
      id:          user.id,
      username:    user.username,
      name:        user.name,
      role:        user.role,
      permissions: PERMISSIONS[user.role] || [],
      loginAt:     new Date().toISOString(),
    }));
  }

  function isLoggedIn() { return getSession() !== null; }
  function getRole()    { return getSession()?.role || null; }
  function getName()    { return getSession()?.name || ''; }

  function can(permission) {
    const s = getSession();
    return s?.permissions?.includes(permission) || false;
  }

  function require(permission) {
    if (!isLoggedIn() || (permission && !can(permission))) {
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
    // Tất cả pages đều ở src/{module}/index.html — auth luôn cách 1 cấp
    return '../auth/login.html';
  }

  function getHomePath() {
    return '../home/index.html';
  }

  function showIf(permission, element) {
    if (element) element.style.display = can(permission) ? '' : 'none';
  }

  return { getSession, setSession, isLoggedIn, getRole, getName, can, require, logout, getHomePath, showIf };
})();