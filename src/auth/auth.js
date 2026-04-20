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

  function setSession(user, tokens = {}) {
    localStorage.setItem('fnb_session', JSON.stringify({
      id:            user.id,
      username:      user.username,
      name:          user.name,
      role:          user.role,
      permissions:   PERMISSIONS[user.role] || [],
      access_token:  tokens.access_token  || null,
      refresh_token: tokens.refresh_token || null,
      expires_at:    tokens.expires_at    || null,
      loginAt:       new Date().toISOString(),
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
    const s = getSession();
    if (!s) { window.location.href = getLoginPath(); return false; }
    // Token hết hạn → logout
    if (s.expires_at && Date.now() > s.expires_at * 1000) {
      localStorage.removeItem('fnb_session');
      window.location.href = getLoginPath();
      return false;
    }
    if (permission && !can(permission)) { window.location.href = getLoginPath(); return false; }
    // Refresh ngầm nếu còn < 10 phút
    if (s.refresh_token && s.expires_at && (s.expires_at * 1000 - Date.now()) < 10 * 60 * 1000) {
      _bgRefresh(s.refresh_token);
    }
    return true;
  }

  async function _bgRefresh(refreshToken) {
    try {
      const data = await AuthAPI.refresh(refreshToken);
      if (data?.access_token) {
        const s = getSession();
        const expiresAt = data.expires_at
          || (data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : s.expires_at);
        localStorage.setItem('fnb_session', JSON.stringify({
          ...s,
          access_token:  data.access_token,
          refresh_token: data.refresh_token,
          expires_at:    expiresAt,
        }));
      }
    } catch(e) {
      // Refresh fail → không làm gì, để expire tự nhiên
    }
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

  return { getSession, setSession, isLoggedIn, getRole, getName, can, require, logout, showIf, _bgRefresh };
})();
