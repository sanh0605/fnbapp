Auth.require('pos');

const session = Auth.getSession();
const role    = Auth.getRole();
const isOwner = role === 'owner';
const isMgr   = role === 'manager';

// Header
document.getElementById('greetName').textContent = 'Xin chào, ' + (session?.name || '') + '!';
document.getElementById('greetRole').textContent =
  isOwner ? 'Chủ quán — Toàn quyền truy cập' :
  isMgr   ? 'Quản lý' : 'Nhân viên';

// Brand filter (manager chỉ thấy brand mình)
let brandFilter = '';
async function initBrandFilter() {
  if (!isMgr) return;
  try {
    const rows = await DB.select('users', `id=eq.${session.id}&select=outlet_id`);
    const outletId = rows?.[0]?.outlet_id;
    if (!outletId) return;
    const outlets = await DB.select('outlets', `id=eq.${outletId}&select=brand_id`);
    const brandId = outlets?.[0]?.brand_id;
    if (brandId) brandFilter = `&brand_id=eq.${brandId}`;
  } catch(e) {}
}

async function loadStats() {
  try {
    const today = new Date();
    const from  = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const to    = new Date(today.getFullYear(), today.getMonth(), today.getDate()+1).toISOString();
    const orders = await DB.select('orders',
      `created_at=gte.${from}&created_at=lt.${to}&voided=not.is.true&select=total${brandFilter}`
    );
    const count   = orders.length;
    const revenue = orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    document.getElementById('statsWrap').innerHTML = `
      <div class="stats-card">
        <div class="stat-item">
          <div class="stat-val">${count}</div>
          <div class="stat-lbl">Đơn hôm nay</div>
        </div>
        <div class="stat-item">
          <div class="stat-val">${fmt(revenue)}</div>
          <div class="stat-lbl">Doanh thu</div>
        </div>
      </div>`;
  } catch(e) {
    document.getElementById('statsWrap').innerHTML = '';
  }
}

function renderCards() {
  const all = [
    { href:'../pos/index.html',     icon:'🛒', label:'Bán hàng',    sub:'POS + đơn hôm nay',   perm:'pos',     primary:true },
    { href:'../orders/index.html',  icon:'📋', label:'Đơn hàng',   sub:'Lịch sử & quản lý',   perm:'revenue'  },
    { href:'../revenue/index.html', icon:'📊', label:'Doanh thu',  sub:'Báo cáo & thống kê',   perm:'revenue'  },
    { href:'../menu/index.html',    icon:'🍽️', label:'Menu',       sub:'Quản lý sản phẩm',     perm:'menu'     },
    { href:'../settings/index.html',icon:'⚙️', label:'Cài đặt',   sub:'Tài khoản & hệ thống', perm:'pos' },
  ];
  const cards = all.filter(c => Auth.can(c.perm));
  document.getElementById('cardGrid').innerHTML = cards.map(c => `
    <a href="${c.href}" class="feature-card${c.primary?' primary':''}">
      <div class="fc-icon">${c.icon}</div>
      <div>
        <div class="fc-label">${c.label}</div>
        <div class="fc-sub">${c.sub}</div>
      </div>
    </a>`).join('');
}

function showLogout() {
  document.getElementById('logoutSub').textContent = session ? `Đang đăng nhập: ${session.name}` : '';
  document.getElementById('logoutOverlay').style.display = 'flex';
}
function hideLogout() { document.getElementById('logoutOverlay').style.display = 'none'; }

async function init() {
  renderCards();
  if (isOwner || isMgr) {
    await initBrandFilter();
    loadStats();
  }
}

init();
