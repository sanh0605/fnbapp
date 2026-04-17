// src/auth/auth.js
// Hệ thống phân quyền FNB App — dùng Supabase

const Auth = (() => {
  const PERMISSIONS = {
    owner:   ['pos','revenue','menu','payment_settings','user_settings'],
    manager: ['pos','revenue'],
    staff:   ['pos'],
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
    return '../auth/login.html';
  }

  function showIf(permission, element) {
    if (element) element.style.display = can(permission) ? '' : 'none';
  }

  return { getSession, setSession, isLoggedIn, getRole, getName, can, require, logout, showIf };
})();
