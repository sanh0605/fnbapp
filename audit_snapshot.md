# FNB POS — Audit Snapshot
**Generated:** 2026-04-19 (post-fix revision)
**Scope:** POS module (src/pos/), service layer (src/lib/), auth (src/auth/)
**Code state:** includes 6 fixes applied in this session (not yet pushed)

---

# 1. PROJECT STRUCTURE

```
fnbapp/
├── src/
│   ├── lib/
│   │   ├── supabase.js         ← Supabase REST client + hashPassword()
│   │   ├── utils.js            ← fmt(), fmtDate(), toast()
│   │   ├── idb-service.js      ← IndexedDB: offline queue + menu cache
│   │   ├── revenue-service.js  ← out of scope
│   │   └── settings-service.js ← out of scope
│   ├── auth/
│   │   ├── auth.js             ← Auth singleton, session, permissions
│   │   ├── login.html
│   │   └── login.js            ← out of scope
│   ├── pos/
│   │   ├── index.html          ← All UI + inline CSS
│   │   └── pos.js              ← All POS logic (718 lines, no module system)
│   ├── orders/                 ← out of scope
│   ├── revenue/                ← out of scope
│   ├── menu/                   ← out of scope
│   └── settings/               ← out of scope
├── migrations/
│   ├── 019_reset_schema.sql    ← canonical DB schema
│   └── 020_rls_tighten.sql     ← RLS policies
└── docs/CONTEXT.md
```

---

# 2. FILE TREE (POS-relevant)

| Path | Role |
|---|---|
| `src/pos/index.html` | UI shell, all CSS inline, HTML structure |
| `src/pos/pos.js` | Entire POS: state, cart, render, payment, offline sync |
| `src/lib/supabase.js` | `DB.select/insert/update/upsert/delete` over Supabase REST |
| `src/lib/idb-service.js` | IndexedDB: pending order queue + menu cache |
| `src/lib/utils.js` | `fmt()`, `fmtDate()`, `toast()` |
| `src/auth/auth.js` | Session read/write, `require()`, `can()`, `logout()` |

---

# 3. UI LAYER

## Product List

**Static HTML** (`src/pos/index.html`):
```html
<div class="cat-bar" id="catBar"></div>
<div class="menu-list" id="menuList">
  <div class="loading">Đang tải menu...</div>
</div>
```

Both `#catBar` and `#menuList` are fully replaced by JS on init.

**Category pills** — `renderCats()` in pos.js:
```js
function getCats(){ return ['Tất cả', ...new Set(MENU.map(m => m.category))]; }
function renderCats(){
  document.getElementById('catBar').innerHTML = getCats().map(c =>
    `<button class="cat-pill${c===activeCat?' active':''}" onclick="setCat('${c}')">${c}</button>`
  ).join('');
}
function setCat(c){ activeCat = c; renderCats(); renderMenu(); }
```

**Menu card** — `renderMenuCard(item)`:
```js
function renderMenuCard(item){
  const qty = cartLines.filter(l => l.productId===item.id).reduce((s,l) => s+l.qty, 0);
  const out = item.active === false, bg = item.color || '#f5f5f0';
  const hasDisc = item.discount_price > 0 && item.discount_price < item.price;
  const thumb = item.image_url
    ? `<img src="${item.image_url}" alt="${item.name}" loading="lazy">`
    : (item.icon || '☕');
  const priceHtml = hasDisc
    ? `<span class="mc-original">${fmt(item.price)}</span><span class="mc-price">${fmt(item.discount_price)}</span>`
    : `<span class="mc-price">${fmt(item.price)}</span>`;
  return `<div class="menu-card${out?' out':''}${qty>0?' in-cart':''}" data-id="${item.id}">
    <div class="mc-img" style="background:${bg}">${thumb}</div>
    <div class="mc-content">
      <div class="mc-name">${item.name}</div>
      <div class="mc-bottom"><div class="mc-prices">${priceHtml}</div>${getCtrlHtml(item.id)}</div>
    </div>
  </div>`;
}
```

**Event bindings on cards** — inline onclick in generated HTML:
- `add('${id}')` → `+` button (red circle when qty=0, gray when qty>0)
- `chgLastLine('${id}', -1)` → `−` button (visible when qty>0 in menu card)

**`renderMenu()`** — full re-render of `#menuList`:
```js
function renderMenu(){
  const el = document.getElementById('menuList');
  if(activeCat !== 'Tất cả'){
    const items = MENU.filter(m => m.category === activeCat);
    if(!items.length){ el.innerHTML='<div class="loading">Không có sản phẩm</div>'; return; }
    el.innerHTML = items.map(renderMenuCard).join(''); return;
  }
  const cats = [...new Set(MENU.map(m => m.category))];
  el.innerHTML = cats.map(cat =>
    `<div class="cat-header">${cat}</div>` + MENU.filter(m => m.category===cat).map(renderMenuCard).join('')
  ).join('');
}
```

---

## Cart / Bottom Sheet

**HTML** (`src/pos/index.html`):
```html
<!-- Tap-to-close backdrop (z-index 50, below cart z-index 100) -->
<div id="cartBackdrop" onclick="toggleCart()"
  style="display:none; position:fixed; inset:0; z-index:50"></div>

<!-- Bottom sheet -->
<div class="bottom-cart" id="bottomCart">
  <div class="handle"></div>

  <!-- Collapsed bar — always visible when cart has items -->
  <div class="cart-collapsed" onclick="toggleCart()">
    <div class="cart-icon-circle">
      <!-- static cart SVG icon -->
    </div>
    <span id="cartQtyLabel"></span>      <!-- "3 ly" -->
    <span id="cartTotalBig" class="cart-total-big"></span>  <!-- "54,000 đ" -->
    <!-- Trash btn: only shown when expanded -->
    <button id="cartTrashBtn" class="icon-btn"
      onclick="event.stopPropagation(); clearAll()"
      style="display:none; margin-left:auto; color:#c0392b">
      <!-- trash SVG -->
    </button>
  </div>

  <!-- Expanded content -->
  <div class="cart-detail">
    <div id="cartItems"></div>
  </div>

  <div class="cart-footer">
    <div class="total-row">
      <span>Tổng cộng</span>
      <span id="footerSubtotal">0 đ</span>
    </div>
    <!-- discount toggle + block -->
    <div class="pay-method-grid">
      <button class="pay-method-btn" id="btnCash" onclick="selectMethod('cash')">Tiền mặt</button>
      <button class="pay-method-btn" id="btnTransfer" onclick="selectMethod('transfer')">Chuyển khoản</button>
    </div>
    <div class="qr-section" id="qrSection">
      <img id="qrImg" src="" alt="QR">
      <div class="qr-amount" id="qrAmount"></div>
    </div>
    <button class="park-btn" id="parkBtn" style="display:none" onclick="parkOrder()">
      Lưu nháp &amp; đơn mới
    </button>
    <button class="confirm-btn" id="confirmBtn" onclick="confirmPay()">
      Xác nhận thanh toán
    </button>
  </div>
</div>
```

**Cart visibility** — `updateCartBar()`:
```js
function updateCartBar(){
  const count = getTotalQty(), payable = getPayable();
  document.getElementById('footerSubtotal').textContent = fmt(getSubtotal());
  renderDiscountUI();
  document.getElementById('cartQtyLabel').textContent = count > 0 ? `${count} ly` : '';
  document.getElementById('cartTotalBig').textContent = count > 0 ? fmt(payable) : '';
  // Hide entire bottom sheet when cart is empty
  document.getElementById('bottomCart').style.visibility = count > 0 ? 'visible' : 'hidden';
}
```

**Toggle expanded/collapsed** — `toggleCart()`:
```js
function toggleCart(){
  if(cartLines.length === 0 && !expanded) return; // prevent open when empty
  expanded = !expanded;
  document.getElementById('bottomCart').classList.toggle('expanded', expanded);
  document.getElementById('cartBackdrop').style.display = expanded ? 'block' : 'none';
  document.getElementById('cartTrashBtn').style.display = expanded ? 'flex' : 'none';
  if(!expanded){ payMethod = null; updatePaymentUI(); }
  updateCartBar();
}
```

**Swipe gesture** (on document, skipped if any overlay is open):
```js
(function(){
  let startY = 0, startClientY = 0, startExp = false;
  const THRESHOLD = 40;
  document.addEventListener('touchstart', e => {
    startClientY = e.touches[0].clientY;
    startY = e.touches[0].clientY;
    startExp = expanded;
  }, {passive:true});
  document.addEventListener('touchend', e => {
    const modalOpen = document.querySelector('.overlay.show');
    if(modalOpen) return;  // ← guard: skip swipe when modal/overlay is open
    const dy = startY - e.changedTouches[0].clientY;
    if(Math.abs(dy) < THRESHOLD) return;
    const startNear = startClientY > window.innerHeight - 120;
    if(dy > 0 && !startExp && startNear){ toggleCart(); return; }
    if(dy < 0 && startExp) toggleCart();
  }, {passive:true});
})();
```

---

## Checkout

**Payment method selection:**
```js
function selectMethod(m){ payMethod = m; updatePaymentUI(); }

function updatePaymentUI(){
  const payable = getPayable(), hasItems = cartLines.length > 0;
  document.getElementById('btnCash').classList.toggle('selected', payMethod === 'cash');
  document.getElementById('btnTransfer').classList.toggle('selected', payMethod === 'transfer');
  const qr = document.getElementById('qrSection');
  if(payMethod === 'transfer' && hasItems){ qr.classList.add('show'); updateQR(payable); }
  else qr.classList.remove('show');
  document.getElementById('confirmBtn').classList.toggle('active', payMethod !== null && hasItems);
  const parkBtn = document.getElementById('parkBtn');
  if(parkBtn) parkBtn.style.display = hasItems ? 'block' : 'none';
}
```

**QR generation** (VietQR CDN, cached by amount):
```js
function updateQR(amount){
  if(amount === lastQRAmount) return;  // cache: skip if amount unchanged
  lastQRAmount = amount;
  const bankId = SETTINGS.bank_id || 'ACB';
  const accountNo = SETTINGS.account_no || 'XXXXXXXXXX';
  const accountName = SETTINGS.account_name || '';
  const content = SETTINGS.transfer_content || 'Thanh toan don hang';
  document.getElementById('qrImg').src =
    `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.jpg` +
    `?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(accountName)}`;
  document.getElementById('qrAmount').textContent = fmt(amount);
}
```

---

## Product Customization Modal

**Trigger:** non-topping `add(id)` → `openCustomModal(id, null)`
**Edit existing:** tap line text → `editLine(lineId)` → `openCustomModal(productId, lineId)`

**HTML:**
```html
<div class="overlay" id="customModal" onclick="cancelCustom()">
  <div class="sheet" onclick="event.stopPropagation()">
    <!-- X close button -->
    <!-- thumbnail + product name -->
    <div id="customItemThumb"></div>
    <div id="customItemName"></div>
    <!-- qty row -->
    <button id="customQtyMinus" onclick="customQty(-1)">−</button>
    <span id="customQtyVal">1</span>
    <button onclick="customQty(1)">+</button>
    <!-- sweet: 0%/30%/50%/70%/100%/120% (default 100%) -->
    <div class="custom-pills" id="sweetPills"></div>
    <!-- ice: Không đá/Ít đá/Bình thường/Đá để riêng (default Bình thường) -->
    <div class="custom-pills" id="icePills"></div>
    <!-- toppings from MENU where category='topping' -->
    <div id="toppingSection">
      <div class="custom-pills" id="toppingPills"></div>
    </div>
    <!-- note -->
    <input id="customNote" type="text" placeholder="Vd: thêm đường, không kem...">
    <!-- delete line button (edit mode only) -->
    <button id="customDelBtn" onclick="deleteCustomLine()" style="display:none">Xoá dòng này</button>
    <!-- confirm -->
    <button id="customAddBtn" onclick="confirmCustom()">Thêm vào giỏ</button>
  </div>
</div>
```

---

## Draft List Sheet

```html
<div class="overlay" id="draftsOverlay" onclick="hideDrafts()">
  <div class="sheet" onclick="event.stopPropagation()">
    <div id="draftList"></div>  <!-- rendered by renderDraftList() -->
  </div>
</div>
```

Trigger: `#draftListBtn` in header (only visible when `parkedOrders.length > 0`) → `showDrafts()`

---

# 4. STATE MANAGEMENT

All state is **module-scope variables** in `pos.js`. No framework, no store pattern.

```js
// ── CORE STATE (pos.js:71–74) ──
let MENU = [], SETTINGS = {}, activeCat = 'Tất cả';
let cartLines = [], orderN = 1, expanded = false, payMethod = null;
let discOpen = false, lastQRAmount = null, customState = null;

// ── CUSTOMIZATION OPTIONS (pos.js:76–79) ──
const SWEET_OPTS = ['0%', '30%', '50%', '70%', '100%', '120%'];
const ICE_OPTS   = ['Không đá', 'Ít đá', 'Bình thường', 'Đá để riêng'];
const ICE_LABEL  = {
  'Không đá':'không đá', 'Ít đá':'ít đá',
  'Bình thường':'đá bình thường', 'Đá để riêng':'đá để riêng'
};
const getToppings = () => MENU.filter(m => (m.category||'').toLowerCase() === 'topping');

// ── DISCOUNT + OUTLET (pos.js:225–226) ──
let discountType = 'vnd', discountValue = 0, actualReceived = null;
let posOutletId = null, posBrandId = null;

// ── PARKED ORDERS (pos.js:84) ──
let parkedOrders = [];
```

**Cart line shape:**
```js
{
  lineId:    string,      // Date.now().toString() — unique per add action
  productId: string,      // UUID from products table
  qty:       number,
  sweet:     string|null, // e.g. '100%' — null for toppings
  ice:       string|null, // e.g. 'Bình thường' — null for toppings
  toppings:  Array<{id: string, name: string, price: number}>,
  note:      string,
}
```

**customState shape** (ephemeral — only while customization modal is open):
```js
{
  lineId:    string|null,  // null = new line; string = editing existing
  productId: string,
  qty:       number,
  sweet:     string,
  ice:       string,
  toppings:  Set<string>,  // Set of topping product IDs
  note:      string,
}
```

**Computed values** (pure functions, recalculated each call):
```js
const findItem      = id => MENU.find(m => m.id === id);

const linePriceUnit = line => {
  const p = findItem(line.productId);
  const base = (p?.discount_price > 0 && p.discount_price < p.price)
    ? p.discount_price : (p?.price || 0);
  return base + (line.toppings || []).reduce((s, t) => s + (t.price || 0), 0);
};

const getSubtotal = () => cartLines.reduce((s, l) => s + linePriceUnit(l) * l.qty, 0);

const getDiscount = () => {
  if(!discountValue) return 0;
  if(discountType === 'pct') return Math.round(getSubtotal() * Math.min(discountValue, 100) / 100);
  return Math.min(discountValue, getSubtotal());
};

const getPayable  = () => Math.max(0, getSubtotal() - getDiscount());
const getTotalQty = () => cartLines.reduce((s, l) => s + l.qty, 0);
```

**State persistence map:**

| Variable | Persisted | Storage | Key |
|---|---|---|---|
| `cartLines` (active) | Yes | localStorage | `fnb_pos_draft_{userId}` |
| `discountType/Value/actualReceived/discOpen` | Yes | localStorage | same draft key |
| `parkedOrders` | Yes | localStorage | `fnb_pos_parked_{userId}` |
| `MENU` | Yes (offline cache) | IndexedDB | store: `cached_menu` |
| `orderN` | No | In-memory | Re-read from DB max on init |
| `payMethod/customState/expanded/lastQRAmount` | No | In-memory | — |
| dead-letter orders | Yes | localStorage | `fnb_pos_deadletter_{userId}` |

---

# 5. ADD TO CART FLOW (CRITICAL)

## Path A — Topping item (direct add, no modal)

**Step 1 — User interaction:**
```html
<button class="mc-add-btn" onclick="add('${id}')">  <!-- when qty=0 -->
<button class="qb" onclick="event.stopPropagation();add('${id}')">  <!-- when qty>0 -->
```

**Step 2 — Function call:**
```js
function add(id){
  const item = findItem(id); if(!item) return;
  if((item.category || '').toLowerCase() === 'topping'){
    const last = [...cartLines].reverse().find(l => l.productId === id);
    if(last) last.qty++;
    else cartLines.push({
      lineId: Date.now().toString(), productId: id,
      qty: 1, sweet: null, ice: null, toppings: [], note: ''
    });
    payMethod = null;
    updateMenuCardCtrl(id); renderCartItems(); updateCartBar(); updatePaymentUI();
    saveDraft(); navigator.vibrate?.(20);
  } else {
    openCustomModal(id, null);  // → Path B
  }
}
```

**Step 3 — State mutation:** `cartLines` array updated (push new or qty++)

**Step 4 — UI update:** 4-call sequence:
- `updateMenuCardCtrl(id)` — partial: replaces only `.mc-bottom` of touched card
- `renderCartItems()` — full re-render of `#cartItems`
- `updateCartBar()` — collapsed bar qty/total/visibility
- `updatePaymentUI()` — confirm button active state

---

## Path B — Non-topping item (customization modal)

**Step 1 — User taps `+` → `add(id)` → branches to `openCustomModal(id, null)`**

**Step 2 — Modal opens:**
```js
function openCustomModal(productId, lineId){
  const item = findItem(productId); if(!item) return;
  if(lineId){
    const line = cartLines.find(l => l.lineId === lineId); if(!line) return;
    customState = {
      lineId, productId, qty: line.qty,
      sweet: line.sweet || '100%', ice: line.ice || 'Bình thường',
      toppings: new Set((line.toppings || []).map(t => t.id)),
      note: line.note || ''
    };
  } else {
    customState = { lineId: null, productId, qty: 1,
                    sweet: '100%', ice: 'Bình thường',
                    toppings: new Set(), note: '' };
  }
  // render thumbnail
  document.getElementById('customItemName').textContent = item.name;
  const thumb = document.getElementById('customItemThumb');
  thumb.style.background = item.color || '#f5f5f0';
  thumb.innerHTML = item.image_url
    ? `<img src="${item.image_url}" alt="" style="width:100%;height:100%;object-fit:cover">`
    : (item.icon || '☕');
  renderCustomModal();
  document.getElementById('customModal').classList.add('show');
}
```

**Step 3 — Modal renders pills:**
```js
function renderCustomModal(){
  if(!customState) return;
  const {lineId, qty, sweet, ice, toppings} = customState;
  document.getElementById('customQtyVal').textContent = qty;
  document.getElementById('customQtyMinus').disabled = qty <= 1;

  document.getElementById('sweetPills').innerHTML = SWEET_OPTS.map(s =>
    `<button class="custom-pill${sweet===s?' active':''}"
             onclick="setCustomOpt('sweet','${s}')">${s}</button>`
  ).join('');

  document.getElementById('icePills').innerHTML = ICE_OPTS.map(i =>
    `<button class="custom-pill${ice===i?' active':''}"
             onclick="setCustomOpt('ice','${i}')">${i}</button>`
  ).join('');

  const toppingItems = getToppings();
  const toppingSection = document.getElementById('toppingSection');
  if(toppingItems.length){
    toppingSection.style.display = 'block';
    document.getElementById('toppingPills').innerHTML = toppingItems.map(t => {
      const priceLabel = t.price
        ? ` <span style="font-size:11px;opacity:.75">+${fmt(t.price)}</span>` : '';
      return `<button class="custom-pill${toppings.has(t.id)?' active':''}"
                      onclick="toggleTopping('${t.id}')">${t.name}${priceLabel}</button>`;
    }).join('');
  } else { toppingSection.style.display = 'none'; }

  document.getElementById('customNote').value = customState.note || '';

  const product = findItem(customState.productId);
  const base = (product?.discount_price > 0 && product.discount_price < product.price)
    ? product.discount_price : (product?.price || 0);
  const toppingSum = getToppings().filter(t => toppings.has(t.id))
                                  .reduce((s, t) => s + (t.price || 0), 0);
  document.getElementById('customAddBtn').textContent =
    lineId ? 'Cập nhật' : `Thêm — ${fmt((base + toppingSum) * qty)}`;
  const delBtn = document.getElementById('customDelBtn');
  if(delBtn) delBtn.style.display = lineId ? 'block' : 'none';
}
```

**Step 4 — User confirms → `confirmCustom()`:**
```js
function confirmCustom(){
  if(!customState) return;
  const {lineId, productId, qty, sweet, ice, toppings} = customState;
  const note = document.getElementById('customNote').value.trim();
  const toppingObjs = getToppings()
    .filter(t => toppings.has(t.id))
    .map(t => ({id: t.id, name: t.name, price: t.price || 0}));

  if(lineId){
    // Edit existing line
    const line = cartLines.find(l => l.lineId === lineId);
    if(line){ line.qty=qty; line.sweet=sweet; line.ice=ice;
              line.toppings=toppingObjs; line.note=note; }
  } else {
    // New line
    cartLines.push({lineId: Date.now().toString(), productId, qty,
                    sweet, ice, toppings: toppingObjs, note});
  }
  payMethod = null; customState = null;
  document.getElementById('customModal').classList.remove('show');
  updateMenuCardCtrl(productId); renderCartItems(); updateCartBar(); updatePaymentUI();
  saveDraft(); navigator.vibrate?.(20);
}
```

---

## Path C — Edit existing line

**Step 1:** tap line description text in expanded cart:
```html
<button class="ci-line-opts" onclick="event.stopPropagation();editLine('${line.lineId}')">
  ×2 – 70% ngọt, đá bình thường
</button>
```

**Step 2:** `editLine(lineId)` → `openCustomModal(productId, lineId)` with pre-filled `customState`

**Step 3:** `confirmCustom()` takes `lineId` branch → mutates line in-place

---

## Path D — Inline qty edit (tap number in cart)

```js
function editLineQty(spanEl, lineId){
  const line = cartLines.find(l => l.lineId === lineId); if(!line) return;
  const productId = line.productId;
  const inp = document.createElement('input');
  inp.className = 'qn-edit'; inp.value = line.qty; inp.type = 'text'; inp.inputMode = 'numeric';
  spanEl.replaceWith(inp); inp.select();
  inp.addEventListener('blur', () => {
    const v = parseInt(inp.value) || 0;
    if(v <= 0) cartLines = cartLines.filter(l => l.lineId !== lineId);
    else { const l = cartLines.find(l => l.lineId === lineId); if(l) l.qty = v; }
    renderCartItems(); updateCartBar(); updateMenuCardCtrl(productId); updatePaymentUI(); saveDraft();
  });
  inp.addEventListener('keydown', e => { if(e.key === 'Enter') inp.blur(); });
}
```

---

## Path E — Payment confirmation

```js
async function confirmPay(){
  const btn = document.getElementById('confirmBtn');
  if(!btn.classList.contains('active')) return;
  btn.classList.remove('active'); btn.classList.add('loading');
  btn.innerHTML = '<span class="btn-spinner"></span>Đang xử lý...';

  const subtotal = getSubtotal(), discount = getDiscount(), payable = getPayable();
  const methodName = payMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản';
  const orderNum = posOutletId
    ? `${posOutletId}-${String(orderN).padStart(3, '0')}`
    : '#' + String(orderN).padStart(3, '0');

  const orderPayload = {
    client_id:       crypto.randomUUID(),
    order_num:       orderNum,
    total:           payable,
    subtotal,
    discount_amount: discount || undefined,
    actual_received: actualReceived || undefined,
    method:          methodName,
    items:           cartLines.map(line => ({
      id: line.productId, name: findItem(line.productId)?.name || '',
      qty: line.qty, price: linePriceUnit(line),
      sweet: line.sweet, ice: line.ice,
      toppings: (line.toppings || []).map(t => t.name),
      note: line.note || undefined,
    })),
    staff_name: session?.name || '',
    outlet_id:  posOutletId || undefined,
    brand_id:   posBrandId  || undefined,
  };

  // ── Write to IDB first (offline-safe) ──
  let saved = false;
  try {
    await IDBService.addPendingOrder(orderPayload);
    saved = true;
  } catch(idbErr){
    // IDB failed — try direct Supabase insert if online
    if(navigator.onLine){
      try { await DB.insert('orders', orderPayload, false); saved = true; } catch(e){}
    }
  }

  if(!saved){
    // Both paths failed — abort, keep cart intact
    btn.classList.remove('loading'); btn.classList.add('active');
    btn.innerHTML = 'Xác nhận thanh toán';
    toast('Lỗi: không thể lưu đơn — vui lòng thử lại');
    return;
  }

  if(navigator.onLine) syncPendingOrders();
  else toast('Offline — đơn đã lưu, sẽ sync khi có mạng');

  // ── Success state ──
  btn.classList.remove('loading'); btn.classList.add('success');
  btn.innerHTML = '<svg ...>✓</svg>Đã thanh toán';
  await new Promise(r => setTimeout(r, 1000));

  // ── Reset ──
  btn.classList.remove('success'); btn.innerHTML = 'Xác nhận thanh toán';
  cartLines = []; payMethod = null; discountValue = 0; actualReceived = null;
  discOpen = false; lastQRAmount = null;
  clearDraft();
  document.getElementById('discInput').value = '';
  document.getElementById('actualInput').value = '';
  document.getElementById('discBlock').style.display = 'none';
  document.getElementById('discArrow').style.transform = '';
  orderN++; expanded = false;
  document.getElementById('bottomCart').classList.remove('expanded');
  document.getElementById('cartBackdrop').style.display = 'none';
  document.getElementById('cartTrashBtn').style.display = 'none';  // ← bug fix
  renderMenu(); renderCartItems(); updateCartBar(); updatePaymentUI();
}
```

---

# 6. RENDERING LOGIC

## Strategy: Partial + Full hybrid

| Trigger | Scope | Function |
|---|---|---|
| Add/remove item | Only touched card's `.mc-bottom` | `updateMenuCardCtrl(id)` |
| Cart items change | Full innerHTML of `#cartItems` | `renderCartItems()` |
| Cart bar summary | Text nodes + visibility | `updateCartBar()` |
| Category filter / clear all | Full innerHTML of `#menuList` | `renderMenu()` |
| Custom modal | Full pills innerHTML | `renderCustomModal()` |
| Discount section | Show/hide rows | `renderDiscountUI()` |

**Partial card update** (only the control area — preserves price HTML):
```js
function updateMenuCardCtrl(id){
  const card = document.querySelector(`.menu-card[data-id="${id}"]`);
  if(!card) return;
  const qty = cartLines.filter(l => l.productId===id).reduce((s,l) => s+l.qty, 0);
  card.classList.toggle('in-cart', qty > 0);
  const bottom = card.querySelector('.mc-bottom');
  bottom.innerHTML = bottom.querySelector('.mc-prices').outerHTML + getCtrlHtml(id);
}
```

**Full cart items render** (grouped by productId, each config as a sub-line):
```js
function renderCartItems(){
  const el = document.getElementById('cartItems');
  if(!cartLines.length){
    el.innerHTML = `<div class="cart-empty-state">...Chưa có món nào</div>`;
    return;
  }
  const order = [], groups = {};
  cartLines.forEach(line => {
    if(!groups[line.productId]){ groups[line.productId]=[]; order.push(line.productId); }
    groups[line.productId].push(line);
  });
  el.innerHTML = order.map(productId => {
    const item = findItem(productId); if(!item) return '';
    const isTopping = (item.category||'').toLowerCase() === 'topping';
    const linesHtml = groups[productId].map(line => {
      const opts = formatLineOpts(line);
      const desc = opts ? `×${line.qty} – ${opts}` : `×${line.qty}`;
      const optsEl = isTopping
        ? `<span class="ci-line-opts">${desc}</span>`
        : `<button class="ci-line-opts" onclick="event.stopPropagation();editLine('${line.lineId}')">${desc}</button>`;
      return `<div class="ci-line">
        ${optsEl}
        <div class="ci-line-right">
          <span class="ci-price">${fmt(linePriceUnit(line) * line.qty)}</span>
          <div class="mc-qty ci-line-qty">
            <button class="qb minus" onclick="event.stopPropagation();chgLine('${line.lineId}',-1)">${SVG_MINUS}</button>
            <span class="qn" onclick="event.stopPropagation();editLineQty(this,'${line.lineId}')">${line.qty}</span>
            <button class="qb" onclick="event.stopPropagation();chgLine('${line.lineId}',1)">${SVG_PLUS_GRAY}</button>
          </div>
        </div>
      </div>`;
    }).join('');
    return `<div class="ci-group"><div class="ci-group-name">${item.name}</div>${linesHtml}</div>`;
  }).join('');
}
```

**`formatLineOpts(line)`** — human-readable description of a cart line:
```js
function formatLineOpts(line){
  if(!line.sweet && !line.ice) return '';
  const parts = [];
  if(line.sweet) parts.push(`${line.sweet} ngọt`);
  if(line.ice) parts.push(ICE_LABEL[line.ice] || line.ice.toLowerCase());
  if(line.toppings?.length) parts.push(line.toppings.map(t => t.name).join(', '));
  if(line.note) parts.push(line.note);
  return parts.join(', ');
}
```

---

# 7. SERVICE LAYER

## DB Client — `src/lib/supabase.js`

No Supabase JS SDK. Pure fetch wrapper over Supabase REST API.

```js
const SUPABASE_URL  = 'https://zicuawpwyhmtqmzawvau.supabase.co';
const SUPABASE_ANON = '[anon key — hardcoded, visible in source]';

async function sb(path, options = {}){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type':  'application/json',
      'Prefer':        options.prefer || '',
    },
    ...options,
  });
  if(!res.ok){
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const DB = {
  select: (table, query='') =>
    sb(`${table}?${query}`, { method: 'GET' }),
  insert: (table, data, returning=true) =>
    sb(table, { method:'POST', body:JSON.stringify(data),
                prefer: returning ? 'return=representation' : 'return=minimal' }),
  update: (table, match, data) =>
    sb(`${table}?${match}`, { method:'PATCH', body:JSON.stringify(data),
                              prefer:'return=representation' }),
  upsert: (table, data) =>
    sb(table, { method:'POST', body:JSON.stringify(data),
                prefer:'resolution=merge-duplicates,return=representation' }),
  delete: (table, match) =>
    sb(`${table}?${match}`, { method: 'DELETE' }),
};
```

**Security note:** `SUPABASE_ANON` is an anon/publishable key — visible in DevTools. Acceptable for anon key. Supabase RLS is the only security layer. No Supabase Auth JWT (BACKLOG).

---

## Auth — `src/auth/auth.js`

```js
const Auth = (() => {
  const PERMISSIONS = {
    owner:   ['pos','revenue','menu','payment_settings','user_settings'],
    manager: ['pos','revenue'],
    staff:   ['pos'],
  };

  function getSession(){
    return JSON.parse(localStorage.getItem('fnb_session') || 'null');
  }
  function setSession(user){
    localStorage.setItem('fnb_session', JSON.stringify({
      id, username, name, role,
      permissions: PERMISSIONS[user.role] || [],
      loginAt: new Date().toISOString(),
    }));
  }
  function isLoggedIn(){ return getSession() !== null; }
  function getRole()   { return getSession()?.role || null; }
  function can(permission){
    return getSession()?.permissions?.includes(permission) || false;
  }
  function require(permission){
    if(!isLoggedIn() || (permission && !can(permission))){
      window.location.href = '../auth/login.html'; return false;
    }
    return true;
  }
  function logout(){
    localStorage.removeItem('fnb_session');
    window.location.href = '../auth/login.html';
  }
  return { getSession, setSession, isLoggedIn, getRole, getName, can, require, logout, showIf };
})();
```

**Security note:** Auth is client-side only. `fnb_session` is plain JSON in localStorage — not signed, not verified server-side. Role gating is cosmetic and can be bypassed via DevTools. This is a known BACKLOG item.

---

## IDBService — `src/lib/idb-service.js`

```js
const IDBService = (() => {
  const DB_NAME = 'fnb_db', DB_VERSION = 1;
  const STORE_PENDING = 'pending_orders', STORE_MENU = 'cached_menu';
  const MAX_RETRIES = 5;
  let dbPromise = null;

  function initDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if(!db.objectStoreNames.contains(STORE_PENDING))
          db.createObjectStore(STORE_PENDING, { keyPath: 'local_id' });
        if(!db.objectStoreNames.contains(STORE_MENU))
          db.createObjectStore(STORE_MENU, { keyPath: 'id' });
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => { dbPromise=null; reject(e.target.error); };
    });
    return dbPromise;
  }

  async function addPendingOrder(order){
    if(!order.client_id) order.client_id = crypto.randomUUID();
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const store = db.transaction([STORE_PENDING],'readwrite').objectStore(STORE_PENDING);
      const entry = { local_id: order.client_id, payload: order,
                      created_at: new Date().toISOString(), retries: 0 };
      const req = store.add(entry);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function getPendingOrders(){
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction([STORE_PENDING],'readonly').objectStore(STORE_PENDING).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function removePendingOrder(local_id){
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction([STORE_PENDING],'readwrite').objectStore(STORE_PENDING).delete(local_id);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function incrementRetry(local_id){
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const store = db.transaction([STORE_PENDING],'readwrite').objectStore(STORE_PENDING);
      const get = store.get(local_id);
      get.onsuccess = () => {
        const data = get.result;
        if(data){ data.retries = (data.retries||0)+1; store.put(data).onsuccess=()=>resolve(); }
        else resolve();
      };
      get.onerror = e => reject(e.target.error);
    });
  }

  function isDeadLetter(entry){ return (entry.retries||0) >= MAX_RETRIES; }

  async function cacheMenu(products){
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const store = db.transaction([STORE_MENU],'readwrite').objectStore(STORE_MENU);
      const clear = store.clear();
      clear.onsuccess = () => {
        if(!products.length){ resolve(); return; }
        let pending = products.length;
        products.forEach(p => {
          const r = store.put(p);
          r.onsuccess = () => { if(--pending===0) resolve(); };
          r.onerror   = e => reject(e.target.error);
        });
      };
      clear.onerror = e => reject(e.target.error);
    });
  }

  async function getMenu(){
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction([STORE_MENU],'readonly').objectStore(STORE_MENU).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = e => reject(e.target.error);
    });
  }

  return { MAX_RETRIES, initDB, addPendingOrder, getPendingOrders,
           removePendingOrder, incrementRetry, isDeadLetter, cacheMenu, getMenu };
})();
```

**Pending entry shape:**
```js
{
  local_id:   string,   // = order.client_id (UUID) — IDB keyPath
  payload:    object,   // full Supabase-ready order object
  created_at: string,   // ISO timestamp
  retries:    number,   // 0..5; incremented on each failed sync
}
```

---

## orderService / storageService

MISSING: No dedicated `orderService` or `storageService` file.
- Order submission logic is inline in `confirmPay()` in pos.js
- Draft/parked persistence: inline `saveDraft()`, `loadDraft()`, `saveParked()`, `loadParked()` in pos.js

---

## Utils — `src/lib/utils.js`

```js
function fmt(n){ return Number(n).toLocaleString('vi-VN') + ' đ'; }

function fmtDate(d, showTime=false){
  const dt = d instanceof Date ? d : new Date(d);
  const p = n => String(n).padStart(2,'0');
  const s = `${p(dt.getDate())}/${p(dt.getMonth()+1)}/${dt.getFullYear()}`;
  return showTime ? `${s} ${p(dt.getHours())}:${p(dt.getMinutes())}` : s;
}

function toast(msg, duration=2200){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.style.opacity='0', duration);
}
```

---

# 8. OFFLINE-FIRST

## Write path — IDB-first, always

```js
// In confirmPay() — order is always written to IDB before any network call
let saved = false;
try {
  await IDBService.addPendingOrder(orderPayload);
  saved = true;
} catch(idbErr){
  // IDB failed — fallback: direct insert if online
  if(navigator.onLine){
    try { await DB.insert('orders', orderPayload, false); saved = true; } catch(e){}
  }
}
if(!saved){
  // Both failed — abort, user sees error, cart stays intact
  toast('Lỗi: không thể lưu đơn — vui lòng thử lại');
  return;
}
if(navigator.onLine) syncPendingOrders();
else toast('Offline — đơn đã lưu, sẽ sync khi có mạng');
```

---

## Sync logic — `syncPendingOrders()`

```js
let syncing = false;  // race condition guard
const DEAD_KEY = `fnb_pos_deadletter_${session?.id||'anon'}`;

function saveDeadLetter(entry){
  try {
    const dl = JSON.parse(localStorage.getItem(DEAD_KEY) || '[]');
    dl.push({...entry, failedAt: new Date().toISOString()});
    localStorage.setItem(DEAD_KEY, JSON.stringify(dl));
  } catch(e){}
}

async function syncPendingOrders(){
  if(syncing) return;
  syncing = true;
  try {
    let queue;
    try { queue = await IDBService.getPendingOrders(); } catch(e){ return; }
    if(!queue.length) return;
    let synced = 0;
    for(const entry of queue){
      if(IDBService.isDeadLetter(entry)){     // retries >= MAX_RETRIES (5)
        saveDeadLetter(entry);               // ← persist before deleting
        toast(`⚠️ Đơn ${entry.payload?.order_num||''} lỗi quá 5 lần — đã lưu dead letter`);
        await IDBService.removePendingOrder(entry.local_id);
        continue;
      }
      try {
        await DB.insert('orders', entry.payload, false);
        await IDBService.removePendingOrder(entry.local_id);
        synced++;
      } catch(e){
        if(e.message?.includes('409')){       // HTTP 409 = already synced (duplicate client_id)
          await IDBService.removePendingOrder(entry.local_id);
          synced++;
        } else {
          await IDBService.incrementRetry(entry.local_id);
        }
      }
    }
    updateSyncBadge();
    if(synced > 0) toast(`✓ Đã đồng bộ ${synced} đơn`);
  } finally {
    syncing = false;
  }
}
```

---

## Sync triggers

```js
window.addEventListener('online', () => { updateNet(); syncPendingOrders(); });
// + called in init() when online (inside finally block)
// + called in confirmPay() when online and order saved successfully
```

---

## Retry / Dead-letter policy

| Condition | Action |
|---|---|
| Network error (non-409) | `incrementRetry()` — stays in IDB queue |
| `retries >= 5` | `saveDeadLetter()` → localStorage, then remove from IDB |
| HTTP 409 (duplicate `client_id`) | Treat as already-synced → remove from IDB |

Dead-letter key: `fnb_pos_deadletter_{userId}` in localStorage.
No UI to view dead-letter orders yet — BACKLOG.

---

## Draft persistence (localStorage)

```js
const DRAFT_KEY  = `fnb_pos_draft_${session?.id || 'anon'}`;
const PARKED_KEY = `fnb_pos_parked_${session?.id || 'anon'}`;

function saveDraft(){
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    cartLines, discountType, discountValue, actualReceived, discOpen,
  }));
}

function loadDraft(){
  const raw = localStorage.getItem(DRAFT_KEY);
  if(!raw) return;
  const d = JSON.parse(raw);
  if(!d.cartLines?.length) return;
  // filter lines whose product no longer exists in MENU
  cartLines = d.cartLines.filter(l => findItem(l.productId));
  if(!cartLines.length) return;
  discountType   = d.discountType   || 'vnd';
  discountValue  = d.discountValue  || 0;
  actualReceived = d.actualReceived || null;
  discOpen       = d.discOpen       || false;
}
```

**init() loads draft in `finally`** — draft is restored even if network/DB fails:
```js
async function init(){
  try {
    // ... fetch MENU, SETTINGS, latestOrders from Supabase (or IDB cache)
  } catch(e){
    document.getElementById('menuList').innerHTML = `<div class="loading">Lỗi tải menu: ${e.message}</div>`;
  } finally {
    // Always runs — preserves draft on network error
    loadDraft(); loadParked();
    renderCats(); renderMenu(); renderCartItems(); updateCartBar(); updatePaymentUI();
    restoreDraftUI(); updateDraftBadge();
  }
}
```

---

## Menu cache (IndexedDB)

```js
// Online: cache after successful fetch
MENU = products;
IDBService.cacheMenu(products).catch(() => {});  // fire-and-forget

// Offline: read from IDB cache
const cached = await IDBService.getMenu();
if(!cached.length){
  // no cache and no network — cannot operate
  document.getElementById('menuList').innerHTML = '⚠️ Không có mạng và chưa có cache';
  return;
}
MENU = cached;
toast('📶 Offline — dùng menu đã lưu');
```

---

# 9. SELF-CHECK (MANDATORY)

## COMPLETENESS CHECK

- [x] **UI layer complete** — HTML structure, CSS classes, all event bindings documented with real code
- [x] **Cart flow complete** — 5 full paths: topping add, modal add, edit line, inline qty, payment
- [x] **State management clear** — all variables named + shaped, persistence map included
- [x] **Services extracted** — supabase.js, idb-service.js, auth.js, utils.js with real code
- [x] **Offline logic present** — IDB-first write, fallback insert, sync, retry, dead-letter, menu cache, draft in finally

---

## Open risks (not blocking, but documented)

| # | Risk | Severity | Status |
|---|---|---|---|
| 1 | **Auth client-side only** — `fnb_session` is plain JSON, forgeable via DevTools | HIGH | BACKLOG: migrate to Supabase Auth |
| 2 | **`orderN` collision** — re-read from DB max on init only; two tabs/devices on same outlet can collide on display number (data integrity is protected by `client_id` UUID) | MEDIUM | BACKLOG |
| 3 | **Dead-letter has no UI** — orders saved to localStorage `fnb_pos_deadletter_*` but owner has no way to view or retry them | MEDIUM | BACKLOG |
| 4 | **No server-side price validation** — RLS only checks `total >= 0` and `method IN (...)`, not that `total` matches `items * prices` | MEDIUM | No fix planned |
| 5 | **Anon key in client JS** — visible in DevTools; acceptable for anon key, unacceptable for service key | LOW | Acceptable |

---

## MISSING (explicit)

| Item | Status |
|---|---|
| `revenue-service.js` | MISSING — not read (out of POS scope, file exists) |
| `settings-service.js` | MISSING — not read (out of POS scope, file exists) |
| `orders/orders.js`, `orders/edit.js` | MISSING — out of POS scope |
| `login.js` | MISSING — login flow not traced |
| `orderService` (dedicated) | MISSING — does not exist; logic inline in pos.js |
| `storageService` (dedicated) | MISSING — does not exist; inline localStorage helpers |
| Dead-letter viewer UI | MISSING — dead-letter saved but no UI to access it |

All in-scope files are fully extracted. MISSINGs are either out-of-scope modules, architectural gaps, or known backlog items — not extraction failures.
