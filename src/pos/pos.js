Auth.require('pos');
  const session = Auth.getSession();
  const role    = Auth.getRole();

  // Hiện nút nav theo role
  if(role === 'manager' || role === 'owner'){
    document.getElementById('homeBtn').style.display = 'flex';
    document.getElementById('ordersBtn').style.display = 'flex';
    document.getElementById('revenueBtn').style.display = 'flex';
  }
  if(role === 'owner'){
    document.getElementById('menuNavBtn').style.display = 'flex';
    document.getElementById('settingsBtn').style.display = 'flex';
  }
  if(session) document.getElementById('userName').textContent = session.name;

  // Network
  const netDot = document.getElementById('netDot');
  function updateNet(){ netDot.className = 'net-dot' + (navigator.onLine ? '' : ' offline'); }
  window.addEventListener('online', () => { updateNet(); syncPendingOrders(); });
  window.addEventListener('offline', updateNet);
  updateNet();

  // ── OFFLINE SYNC ──
  async function syncPendingOrders(){
    let queue;
    try { queue = await IDBService.getPendingOrders(); } catch(e){ return; }
    if(!queue.length) return;
    let synced = 0, failed = 0;
    for(const entry of queue){
      if(IDBService.isDeadLetter(entry)){
        toast(`⚠️ Đơn ${entry.payload?.order_num||''} lỗi quá ${IDBService.MAX_RETRIES} lần — báo manager`);
        continue;
      }
      try {
        await DB.insert('orders', entry.payload, false);
        await IDBService.removePendingOrder(entry.local_id);
        synced++;
      } catch(e){
        // 409 = đã tồn tại (idempotent) → xoá khỏi queue
        if(e.message && e.message.includes('409')){
          await IDBService.removePendingOrder(entry.local_id);
          synced++;
        } else {
          await IDBService.incrementRetry(entry.local_id);
          failed++;
        }
      }
    }
    updateSyncBadge();
    if(synced > 0) toast(`✓ Đã đồng bộ ${synced} đơn`);
  }

  async function updateSyncBadge(){
    try {
      const q = await IDBService.getPendingOrders();
      const badge = document.getElementById('orderBadge');
      if(q.length > 0){
        badge.textContent = `${q.length} chờ sync`;
        badge.style.background = '#FAEEDA';
        badge.style.color = '#633806';
      } else {
        const num = '#' + String(orderN).padStart(3,'0');
        badge.textContent = num;
        badge.style.background = '';
        badge.style.color = '';
      }
    } catch(e){}
  }


  // ── STATE ──
  let MENU = [], SETTINGS = {}, activeCat = 'Tất cả';
  let cart = {}, notes = {}, orderN = 1, expanded = false, payMethod = null;
  let discountType = 'vnd', discountValue = 0, actualReceived = null;
  let posOutletId = null, posBrandId = null;

  const findItem    = id => MENU.find(m=>m.id===id);
  const getSubtotal = () => Object.keys(cart).reduce((s,k) => s + (findItem(k)?.price||0) * cart[k], 0);
  const getDiscount = () => {
    if(!discountValue) return 0;
    if(discountType === 'pct') return Math.round(getSubtotal() * Math.min(discountValue,100) / 100);
    return Math.min(discountValue, getSubtotal());
  };
  const getPayable  = () => Math.max(0, getSubtotal() - getDiscount());
  const getTotal    = getPayable; // alias dùng chỗ cũ
  const getTotalQty = () => Object.keys(cart).reduce((s,k) => s + cart[k], 0);

  // ── LOAD DATA ──
  async function init(){
    try {
      if(navigator.onLine){
        // Online: fetch fresh data, cache menu for offline use
        const [products, settings, latestOrders, userRows] = await Promise.all([
          DB.select('products', 'active=eq.true&select=*&order=sort_order.asc'),
          DB.select('settings', 'select=*'),
          DB.select('orders', 'select=order_num&order=created_at.desc&limit=1'),
          session?.id ? DB.select('users', `id=eq.${session.id}&select=outlet_id`) : Promise.resolve([]),
        ]);
        MENU = products;
        IDBService.cacheMenu(products).catch(()=>{}); // background, non-blocking
        settings.forEach(s => SETTINGS[s.key] = s.value);
        if(latestOrders?.length){
          const m = (latestOrders[0].order_num||'').match(/\d+/);
          if(m) orderN = parseInt(m[0], 10) + 1;
        }
        const outletId = userRows?.[0]?.outlet_id || null;
        if(outletId){
          posOutletId = outletId;
          try {
            const outletRows = await DB.select('outlets', `id=eq.${outletId}&select=brand_id`);
            posBrandId = outletRows?.[0]?.brand_id || null;
          } catch(e){ console.warn('Không lấy được brand_id:', e); }
        }
      } else {
        // Offline: dùng menu đã cache trong IDB
        const cached = await IDBService.getMenu();
        if(!cached.length){
          document.getElementById('menuList').innerHTML =
            `<div class="loading">⚠️ Không có mạng và chưa có cache — vui lòng kết nối để tải menu lần đầu</div>`;
          updateSyncBadge();
          return;
        }
        MENU = cached;
        toast('📶 Offline — dùng menu đã lưu');
      }
      const num = '#' + String(orderN).padStart(3, '0');
      document.getElementById('orderNum').textContent = num;
      document.getElementById('orderBadge').textContent = num;
      renderCats(); renderMenu(); updateCartBar();
      if(navigator.onLine) syncPendingOrders();
      else updateSyncBadge();
    } catch(e){
      document.getElementById('menuList').innerHTML = `<div class="loading">Lỗi tải menu: ${e.message}</div>`;
    }
  }

  // ── RENDER ──
  function getCats(){ return ['Tất cả', ...new Set(MENU.map(m=>m.category))]; }

  function renderCats(){
    const cats = getCats();
    document.getElementById('catBar').innerHTML = cats.map(c =>
      `<button class="cat-pill${c===activeCat?' active':''}" onclick="setCat('${c}')">${c}</button>`
    ).join('');
  }
  function setCat(c){ activeCat=c; renderCats(); renderMenu(); }

  function renderMenuRow(item){
    const qty = cart[item.id] || 0;
    const out = item.active === false;
    return `<div class="menu-row${out?' out':''}">
      <div class="micon" style="background:${item.color||'#f5f5f0'}">${item.icon||'☕'}</div>
      <div class="minfo">
        <div class="mname">${item.name}</div>
        <div class="mprice">${fmt(item.price)}</div>
      </div>
      ${out ? '' : qty === 0
        ? `<button class="add-btn" onclick="add('${item.id}')">+</button>`
        : `<div class="qty-ctrl">
             <button class="qb" onclick="chg('${item.id}',-1)">−</button>
             <span class="qn">${qty}</span>
             <button class="qb" onclick="chg('${item.id}',1)">+</button>
           </div>`}
    </div>`;
  }

  function renderMenu(){
    const el = document.getElementById('menuList');
    if(activeCat !== 'Tất cả'){
      const items = MENU.filter(m=>m.category===activeCat);
      if(!items.length){ el.innerHTML='<div class="loading">Không có sản phẩm</div>'; return; }
      el.innerHTML = items.map(renderMenuRow).join('');
      return;
    }
    // Tất cả → nhóm theo danh mục
    const cats = [...new Set(MENU.map(m=>m.category))];
    if(!cats.length){ el.innerHTML='<div class="loading">Không có sản phẩm</div>'; return; }
    el.innerHTML = cats.map(cat => {
      const catItems = MENU.filter(m=>m.category===cat);
      return `<div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;padding:6px 2px 4px;margin-top:4px">${cat}</div>`
        + catItems.map(renderMenuRow).join('');
    }).join('');
  }

  function add(id){ cart[id]=(cart[id]||0)+1; if(!notes[id])notes[id]=''; payMethod=null; update(); toast('+1 '+MENU.find(m=>m.id===id)?.name); }
  function chg(id,d){ cart[id]=(cart[id]||0)+d; if(cart[id]<=0){delete cart[id];delete notes[id];} payMethod=null; update(); }
  function clearAll(){ cart={}; notes={}; payMethod=null; discountValue=0; actualReceived=null; document.getElementById('discInput').value=''; document.getElementById('actualInput').value=''; update(); if(expanded)toggleCart(); }

  // ── CHIẾT KHẤU / THỰC THU ──
  function setDiscType(t){
    discountType=t;
    document.getElementById('dtVnd').classList.toggle('active',t==='vnd');
    document.getElementById('dtPct').classList.toggle('active',t==='pct');
    document.getElementById('discInput').placeholder = t==='pct'?'0':'0';
    document.getElementById('discInput').max = t==='pct'?'100':'';
    updateDiscount();
  }
  function updateDiscount(){
    discountValue = parseFloat(document.getElementById('discInput').value)||0;
    actualReceived = null; // reset thực thu khi CK thay đổi
    document.getElementById('actualInput').value = '';
    renderDiscountUI();
    updateCartBar();
    updatePaymentUI();
  }
  function updateActual(){
    actualReceived = parseFloat(document.getElementById('actualInput').value)||null;
    renderDiscountUI();
  }
  function renderDiscountUI(){
    const subtotal = getSubtotal(), discount = getDiscount(), payable = getPayable();
    const hasDiscount = discount > 0;
    document.getElementById('payableRow').style.display = hasDiscount ? 'flex' : 'none';
    if(hasDiscount) document.getElementById('payableAmt').textContent = fmt(payable);
    // Actual received
    const actual = actualReceived !== null ? actualReceived : payable;
    const change = actual - payable;
    document.getElementById('changeRow').style.display = change > 0 ? 'flex' : 'none';
    if(change > 0) document.getElementById('changeAmt').textContent = fmt(change);
    // QR dùng payable
    if(document.getElementById('qrSection').classList.contains('show')) updateQR(payable);
  }
  function update(){ renderMenu(); renderCartItems(); updateCartBar(); updatePaymentUI(); }

  function updateCartBar(){
    const count = getTotalQty(), subtotal = getSubtotal(), payable = getPayable();
    document.getElementById('cartTotal').textContent = fmt(payable);
    document.getElementById('footerSubtotal').textContent = fmt(subtotal);
    renderDiscountUI();
    const badge = document.getElementById('countBadge');
    badge.textContent = count; badge.style.display = count>0?'inline':'none';
    const btn = document.getElementById('cartToggleBtn');
    btn.disabled = count === 0;
    const content = document.getElementById('cartBtnContent');
    btn.classList.add('icon-only');
    if(expanded){
      // Icon thu nhỏ (chevrons xuống)
      content.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 21 6 15"/><polyline points="18 9 12 15 6 9"/></svg>`;
    } else {
      // Icon phóng to (chevrons lên)
      content.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/><polyline points="18 21 12 15 6 21"/></svg>`;
    }
  }

  function renderCartItems(){
    const keys = Object.keys(cart);
    if(!keys.length){
      document.getElementById('cartItems').innerHTML = `<div class="cart-empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>Chưa có món nào</div>`;
      return;
    }
    document.getElementById('cartItems').innerHTML = keys.map(id => {
      const item = findItem(id);
      if(!item) return '';
      return `<div class="ci">
        <div class="ci-top">
          <div style="flex:1;min-width:0">
            <div class="ci-name">${item.name}</div>
            <div style="font-size:11px;color:#bbb;margin-top:1px">${fmt(item.price)} / ly</div>
          </div>
          <div class="qty-ctrl">
            <button class="qb" onclick="chg('${id}',-1)">−</button>
            <span class="qn">${cart[id]}</span>
            <button class="qb" onclick="chg('${id}',1)">+</button>
          </div>
          <span class="ci-price">${fmt(item.price*cart[id])}</span>
        </div>
        <input class="ci-note" placeholder="Ghi chú: ít đường, không đá..."
          value="${notes[id]||''}" oninput="notes['${id}']=this.value" onclick="event.stopPropagation()">
      </div>`;
    }).join('');
  }

  function selectMethod(m){ payMethod=m; updatePaymentUI(); }

  function updatePaymentUI(){
    const payable = getPayable(), hasItems = Object.keys(cart).length > 0;
    document.getElementById('btnCash').classList.toggle('selected', payMethod==='cash');
    document.getElementById('btnTransfer').classList.toggle('selected', payMethod==='transfer');
    const qr = document.getElementById('qrSection');
    if(payMethod==='transfer' && hasItems){ qr.classList.add('show'); updateQR(payable); }
    else qr.classList.remove('show');
    document.getElementById('confirmBtn').classList.toggle('active', payMethod!==null && hasItems);
  }

  function updateQR(amount){
    const bankId      = SETTINGS.bank_id      || 'ACB';
    const accountNo   = SETTINGS.account_no   || 'XXXXXXXXXX';
    const accountName = SETTINGS.account_name || '';
    const content     = SETTINGS.transfer_content || 'Thanh toan don hang';
    const url = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.jpg?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(accountName)}`;
    document.getElementById('qrImg').src = url;
    document.getElementById('qrAmount').textContent = fmt(amount);
  }

  function toggleCart(){
    if(Object.keys(cart).length===0 && !expanded) return;
    expanded = !expanded;
    document.getElementById('bottomCart').classList.toggle('expanded', expanded);
    if(!expanded){ payMethod=null; updatePaymentUI(); }
    updateCartBar();
  }

  // ── SWIPE GESTURE ──
  (function(){
    const cart = document.getElementById('bottomCart');
    let startY = 0, startExp = false;

    cart.addEventListener('touchstart', e => {
      startY   = e.touches[0].clientY;
      startExp = expanded;
    }, { passive: true });

    cart.addEventListener('touchend', e => {
      const dy = startY - e.changedTouches[0].clientY; // dương = vuốt lên
      if(Math.abs(dy) < 30) return; // bỏ qua tap
      if(dy > 0 && !startExp) toggleCart();  // vuốt lên → mở
      if(dy < 0 &&  startExp) toggleCart();  // vuốt xuống → đóng
    }, { passive: true });
  })();

  async function confirmPay(){
    if(!document.getElementById('confirmBtn').classList.contains('active')) return;
    const subtotal   = getSubtotal();
    const discount   = getDiscount();
    const payable    = getPayable();
    const methodName = payMethod==='cash' ? 'Tiền mặt' : 'Chuyển khoản';
    const orderNum   = '#' + String(orderN).padStart(3,'0');
    const items = Object.keys(cart).map(id => {
      const item = findItem(id);
      return { id, name:item?.name||'', qty:cart[id], price:item?.price||0 };
    });

    // Tạo payload đơn hàng
    const orderPayload = {
      client_id:       crypto.randomUUID(),
      order_num:       orderNum,
      total:           payable,
      subtotal,
      discount_amount: discount || undefined,
      actual_received: actualReceived || undefined,
      method:          methodName,
      items,
      staff_name:      session?.name || '',
      outlet_id:       posOutletId || undefined,
      brand_id:        posBrandId  || undefined,
    };

    // 1. Lưu local trước (luôn thành công dù offline)
    try { await IDBService.addPendingOrder(orderPayload); } catch(e){ console.warn('IDB error:', e); }

    // 2. Sync ngay nếu có mạng
    if(navigator.onLine){ syncPendingOrders(); }
    else { toast('📶 Offline — đơn đã lưu, sẽ sync khi có mạng'); }

    toast(`✓ ${methodName} — ${fmt(payable)}`);
    cart={}; notes={}; payMethod=null; discountValue=0; actualReceived=null;
    document.getElementById('discInput').value='';
    document.getElementById('actualInput').value='';
    orderN++;
    const num = '#' + String(orderN).padStart(3,'0');
    document.getElementById('orderNum').textContent = num;
    document.getElementById('orderBadge').textContent = num;
    expanded = false;
    document.getElementById('bottomCart').classList.remove('expanded');
    update();
  }


  // ── POS TABS ──
  let posTab = 'sell';

  function switchPosTab(tab){
    posTab = tab;
    ['sell','today','summary'].forEach(t => {
      document.getElementById('tab'+t.charAt(0).toUpperCase()+t.slice(1))?.classList.toggle('active', t===tab);
    });
    const isSell = tab === 'sell';
    document.getElementById('catBar').style.display     = isSell ? '' : 'none';
    document.getElementById('menuList').style.display   = isSell ? '' : 'none';
    document.getElementById('bottomCart').style.display = isSell ? '' : 'none';
    document.getElementById('todayView').style.display   = tab==='today'   ? '' : 'none';
    document.getElementById('summaryView').style.display = tab==='summary' ? '' : 'none';
    document.getElementById('posTabTitle').textContent   =
      tab==='today' ? 'Hôm nay' : tab==='summary' ? 'Tổng kết' : 'Bán hàng';
    if(tab==='today')   loadTodayOrders();
    if(tab==='summary') loadSummary();
  }

  function todayRange(){
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1).toISOString();
    return {from, to};
  }

  async function loadTodayOrders(){
    const el = document.getElementById('todayView');
    el.innerHTML = '<div class="loading">Đang tải...</div>';
    try {
      const {from, to} = todayRange();
      const filter = posBrandId ? `&brand_id=eq.${posBrandId}` : (posOutletId ? `&outlet_id=eq.${posOutletId}` : '');
      const orders = await DB.select('orders',
        `created_at=gte.${from}&created_at=lt.${to}&select=*&order=created_at.desc${filter}`
      );
      if(!orders.length){ el.innerHTML='<div class="loading">Chưa có đơn nào hôm nay</div>'; return; }
      const canVoid = role==='manager'||role==='owner';
      el.innerHTML = orders.map(o => {
        const isVoided = o.voided;
        const items = Array.isArray(o.items) ? o.items : (typeof o.items==='string' ? JSON.parse(o.items||'[]') : []);
        const itemsText = items.map(i=>`${i.name||i.id}×${i.qty}`).join(', ') || '—';
        const time = new Date(o.created_at);
        const timeStr = `${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;
        const method = o.pay_method==='transfer'?'Chuyển khoản':'Tiền mặt';
        return `<div class="order-card${isVoided?' order-voided':''}">
          <div class="order-card-row">
            <div>
              <span class="order-num">${o.order_num||o.id?.slice(-6)||'—'}</span>
              <span class="order-time" style="margin-left:8px">${timeStr}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="order-method">${method}</span>
              <span class="order-total">${isVoided?'<span style="color:#aaa;font-size:12px">Đã huỷ</span>':fmt(o.total)}</span>
            </div>
          </div>
          <div class="order-items">${itemsText}</div>
          ${canVoid&&!isVoided?`<button class="void-btn" onclick="voidOrder('${o.id}',this)">Huỷ đơn</button>`:''}
        </div>`;
      }).join('');
    } catch(e){ el.innerHTML=`<div class="loading">Lỗi: ${e.message}</div>`; }
  }

  async function voidOrder(id, btn){
    if(!confirm('Huỷ đơn này?')) return;
    try {
      await DB.update('orders', `id=eq.${id}`, {voided:true});
      btn.closest('.order-card').classList.add('order-voided');
      btn.remove();
      toast('Đã huỷ đơn');
      if(posTab==='today') loadTodayOrders();
    } catch(e){ toast('Lỗi: '+e.message); }
  }

  async function loadSummary(){
    const el = document.getElementById('summaryView');
    el.innerHTML = '<div class="loading">Đang tải...</div>';
    try {
      const {from, to} = todayRange();
      const filter = posBrandId ? `&brand_id=eq.${posBrandId}` : (posOutletId ? `&outlet_id=eq.${posOutletId}` : '');
      const orders = await DB.select('orders',
        `created_at=gte.${from}&created_at=lt.${to}&voided=eq.false&select=total,method${filter}`
      );
      const total   = orders.reduce((s,o)=>s+(parseFloat(o.total)||0),0);
      const cash    = orders.filter(o=>o.method==='Tiền mặt');
      const trans   = orders.filter(o=>o.method==='Chuyển khoản');
      const avg     = orders.length ? total/orders.length : 0;
      el.innerHTML = `
        <div class="summary-card">
          <div class="summary-row summary-big">
            <span class="summary-label">Tổng doanh thu</span>
            <span class="summary-value">${fmt(total)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Tổng đơn</span>
            <span class="summary-value">${orders.length} đơn</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Trung bình/đơn</span>
            <span class="summary-value">${fmt(Math.round(avg))}</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-row">
            <span class="summary-label">Tiền mặt</span>
            <span class="summary-value">${fmt(cash.reduce((s,o)=>s+(parseFloat(o.total)||0),0))} <span style="color:#aaa;font-size:12px">(${cash.length} đơn)</span></span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Chuyển khoản</span>
            <span class="summary-value">${fmt(trans.reduce((s,o)=>s+(parseFloat(o.total)||0),0))} <span style="color:#aaa;font-size:12px">(${trans.length} đơn)</span></span>
          </div>
        </div>`;
    } catch(e){ el.innerHTML=`<div class="loading">Lỗi: ${e.message}</div>`; }
  }

  function showLogout(){
    document.getElementById('logoutSub').textContent = session ? `Đang đăng nhập: ${session.name}` : '';
    document.getElementById('logoutOverlay').classList.add('show');
  }
  function hideLogout(){ document.getElementById('logoutOverlay').classList.remove('show'); }


  init();
