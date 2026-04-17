/**
 * src/lib/settings-service.js
 * Settings module — DB calls only. Zero DOM.
 * Depends on: hashPassword() from supabase.js
 */

const SettingsService = (() => {

  /** Fetch settings map + optionally users list (owner only). */
  async function fetchInitData(includeUsers = false) {
    const loads = [DB.select('settings', 'select=*')];
    if (includeUsers) loads.push(DB.select('users', 'select=*&order=role.asc,name.asc'));
    const results = await Promise.all(loads);
    const settings = {};
    results[0].forEach(s => settings[s.key] = s.value);
    const users = includeUsers ? (results[1] || []) : [];
    return { settings, users };
  }

  /** Fetch users list (owner only). */
  async function fetchUsers() {
    return DB.select('users', 'select=*&order=role.asc,name.asc');
  }

  /**
   * Create or update a user.
   * @param {string|null} id   null = create
   * @param {{name, username, password?, role, active}} data
   */
  async function saveUser(id, data) {
    const payload = { name: data.name, username: data.username, role: data.role, active: data.active };
    if (data.password) payload.password_hash = await hashPassword(data.password);
    if (id) {
      await DB.update('users', `id=eq.${id}`, payload);
    } else {
      await DB.insert('users', payload, false);
    }
  }

  /** Delete a user by id. */
  async function deleteUser(id) {
    await DB.delete('users', `id=eq.${id}`);
  }

  /**
   * Verify current password then update to new one.
   * @returns {boolean}  false if current password is wrong
   */
  async function changePassword(userId, currentPw, newPw) {
    const hashed = await hashPassword(currentPw);
    const check = await DB.select('users', `id=eq.${userId}&password_hash=eq.${hashed}&select=id`);
    if (!check?.length) return false;
    await DB.update('users', `id=eq.${userId}`, { password_hash: await hashPassword(newPw) });
    return true;
  }

  /**
   * Upsert multiple settings key-value pairs.
   * @param {Object} fields  { key: value, … }
   */
  async function saveSettings(fields) {
    for (const [key, value] of Object.entries(fields)) {
      await DB.upsert('settings', { key, value, updated_at: new Date().toISOString() });
    }
  }

  return { fetchInitData, fetchUsers, saveUser, deleteUser, changePassword, saveSettings };
})();
