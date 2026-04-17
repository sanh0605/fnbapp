/**
 * src/lib/revenue-service.js
 * Revenue module — DB calls only. Zero DOM.
 */

const RevenueService = (() => {

  /**
   * Fetch orders in a date range with optional brand filter.
   * @param {Date}   from
   * @param {Date}   to
   * @param {string} brandFilter  e.g. '&brand_id=eq.xxx' or ''
   * @returns {Promise<Array>}
   */
  async function fetchOrders(from, to, brandFilter = '') {
    return DB.select('orders',
      `created_at=gte.${from.toISOString()}&created_at=lte.${to.toISOString()}${brandFilter}&select=*&order=created_at.asc`
    );
  }

  return { fetchOrders };
})();
