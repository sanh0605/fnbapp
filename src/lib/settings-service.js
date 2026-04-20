/**
 * src/lib/settings-service.js
 * Settings module — DB calls only. Zero DOM.
 * Depends on: SUPABASE_URL, SUPABASE_ANON, DB, AuthAPI from supabase.js
 */

const SettingsService = (() => {

  const FUNC_URL = `${SUPABASE_URL}/functions/v1/user-admin`;

  function _token() {
    try { return JSON.parse(localStorage.getItem('fnb_session') || 'null')?.access_token || ''; }
    catch { return ''; }
  }

  function _session() {
    try { return JSON.parse(localStorage.getItem('fnb_session') || 'null'); }
    catch { return null; }
  }

  async function _adminFetch(method, path = '', body = null) {
    const opts = {
      method,
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${_token()}`, 'Content-Type': 'application/json' },
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(`${FUNC_URL}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  async function fetchInitData(includeUsers = false) {
    const loads = [DB.select('settings', 'select=*')];
    if (includeUsers) loads.push(fetchUsers());
    const results = await Promise.all(loads);
    const settings = {};
    results[0].forEach(s => settings[s.key] = s.value);
    const users = includeUsers ? (results[1] || []) : [];
    return { settings, users };
  }

  function fetchUsers() {
    return _adminFetch('GET');
  }

  async function saveUser(id, data) {
    if (id) {
      const payload = { name: data.name, role: data.role, active: data.active };
      if (data.password) payload.password = data.password;
      await _adminFetch('PATCH', `/${id}`, payload);
    } else {
      await _adminFetch('POST', '', {
        name:     data.name,
        username: data.username,
        password: data.password,
        role:     data.role,
      });
    }
  }

  function deleteUser(id) {
    return _adminFetch('DELETE', `/${id}`);
  }

  async function changePassword(userId, currentPw, newPw) {
    const s = _session();
    if (!s?.username) return false;
    let freshToken;
    try {
      const authData = await AuthAPI.login(`${s.username}@fnbapp.internal`, currentPw);
      freshToken = authData.access_token;
    } catch {
      return false;
    }
    return AuthAPI.updateOwnPassword(freshToken, newPw);
  }

  async function saveSettings(fields) {
    for (const [key, value] of Object.entries(fields)) {
      await DB.upsert('settings', { key, value, updated_at: new Date().toISOString() });
    }
  }

  return { fetchInitData, fetchUsers, saveUser, deleteUser, changePassword, saveSettings };
})();
