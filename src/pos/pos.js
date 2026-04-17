Auth.require('pos');
  const session = Auth.getSession();
  const role    = Auth.getRole();

  if(role === 'manager' || role === 'owner'){
    document.getElementById('homeBtn').style.visibility = 'visible';
    document.getElementById('ordersBtn').style.display  = 'flex';
    document.getElementById('revenueBtn').style.display = 'flex';
  }

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
      if(q.length > 0) toast(`📶 ${q.length} đơn chờ sync`);
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

  function renderMenuCard(item){
    const qty      = cart[item.id] || 0;
    const out      = item.active === false;
    const bg       = item.color || '#f5f5f0';
    const hasDisc  = item.discount_price > 0 && item.discount_price < item.price;
    const dispPrice = hasDisc ? item.discount_price : item.price;
    const thumb = item.image_url
      ? `<img src="${item.image_url}" alt="${item.name}" loading="lazy">`
      : (item.icon || '☕');
    const priceHtml = hasDisc
      ? `<span class="mc-original">${fmt(item.price)}</span><span class="mc-price">${fmt(dispPrice)}</span>`
      : `<span class="mc-price">${fmt(item.price)}</span>`;
    const ctrl = out ? '' : qty === 0
      ? `<button class="mc-add-btn" onclick="add('${item.id}')"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#E03C31"/><line x1="12" y1="6" x2="12" y2="18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><line x1="6" y1="12" x2="18" y2="12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg></button>`
      : `<div class="mc-qty">
           <button class="qb minus" onclick="chg('${item.id}',-1)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#f5f5f5"/><line x1="7" y1="12" x2="17" y2="12" stroke="#E03C31" stroke-width="2.5" stroke-linecap="round"/></svg></button>
           <span class="qn">${qty}</span>
           <button class="qb" onclick="chg('${item.id}',1)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#f5f5f5"/><line x1="12" y1="7" x2="12" y2="17" stroke="#1a1a18" stroke-width="2.5" stroke-linecap="round"/><line x1="7" y1="12" x2="17" y2="12" stroke="#1a1a18" stroke-width="2.5" stroke-linecap="round"/></svg></button>
         </div>`;
    return `<div class="menu-card${out?' out':''}${qty>0?' in-cart':''}">
      <div class="mc-img" style="background:${bg}">${thumb}</div>
      <div class="mc-content">
        <div class="mc-name">${item.name}</div>
        <div class="mc-bottom">
          <div class="mc-prices">${priceHtml}</div>
          ${ctrl}
        </div>
      </div>
    </div>`;
  }

  function renderMenu(){
    const el = document.getElementById('menuList');
    if(activeCat !== 'Tất cả'){
      const items = MENU.filter(m=>m.category===activeCat);
      if(!items.length){ el.innerHTML='<div class="loading">Không có sản phẩm</div>'; return; }
      el.innerHTML = items.map(renderMenuCard).join('');
      return;
    }
    const cats = [...new Set(MENU.map(m=>m.category))];
    if(!cats.length){ el.innerHTML='<div class="loading">Không có sản phẩm</div>'; return; }
    el.innerHTML = cats.map(cat => {
      const catItems = MENU.filter(m=>m.category===cat);
      return `<div class="cat-header">${cat}</div>` + catItems.map(renderMenuCard).join('');
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
    document.getElementById('discInput').value = '';
    discountValue = 0;
    updateDiscount();
  }
  function parseInputNum(el){
    return parseInt(el.value.replace(/\./g,'').replace(/[^0-9]/g,''))||0;
  }
  function fmtInput(n){ return n > 0 ? n.toLocaleString('vi-VN') : ''; }

  function updateDiscount(){
    const el = document.getElementById('discInput');
    const raw = parseInputNum(el);
    discountValue = raw;
    if(discountType==='vnd') el.value = fmtInput(raw);
    actualReceived = null;
    document.getElementById('actualInput').value = '';
    renderDiscountUI();
    updateCartBar();
    updatePaymentUI();
  }
  function updateActual(){
    const el = document.getElementById('actualInput');
    const raw = parseInputNum(el);
    actualReceived = raw || null;
    el.value = fmtInput(raw);
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

  const CUP_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8l1.5 14h5L16 8H8z"/><path d="M6.5 8h11"/><path d="M7.5 8C7.5 6 9.5 4.5 12 4.5S16.5 6 16.5 8"/></svg>`;

  function updateCartBar(){
    const count = getTotalQty(), subtotal = getSubtotal(), payable = getPayable();
    document.getElementById('footerSubtotal').textContent = fmt(subtotal);
    renderDiscountUI();
    const iconArea = document.getElementById('cartIconArea');
    const totalBig = document.getElementById('cartTotalBig');
    if(count > 0){
      iconArea.className = 'cart-diamond';
      iconArea.innerHTML = `<div class="cart-diamond-inner"><span class="cart-diamond-qty">${count}</span>${CUP_SVG}</div>`;
      totalBig.textContent = fmt(payable);
      totalBig.style.display = expanded ? 'none' : 'block';
    } else {
      iconArea.className = 'cart-icon-circle';
      iconArea.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;
      totalBig.style.display = 'none';
    }
    document.getElementById('trashBtn').style.visibility = count > 0 ? 'visible' : 'hidden';
    const toggleBtn = document.getElementById('cartToggleBtn');
    toggleBtn.disabled = count === 0;
    toggleBtn.innerHTML = expanded
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 12 12 18 6 12"/><polyline points="18 6 12 12 6 6"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 12 12 6 6 12"/><polyline points="18 18 12 12 6 18"/></svg>`;
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
      const bg = item.color || '#f5f5f0';
      const thumb = item.image_url
        ? `<img src="${item.image_url}" alt="">`
        : (item.icon || '☕');
      const price = (item.discount_price > 0 && item.discount_price < item.price) ? item.discount_price : item.price;
      return `<div class="ci">
        <div class="ci-top">
          <div class="ci-thumb" style="background:${bg}">${thumb}</div>
          <div class="ci-info">
            <div class="ci-name">${item.name}</div>
            <div class="ci-unit">${fmt(price)}</div>
          </div>
          <div class="ci-right">
            <div class="mc-qty">
              <button class="qb minus" onclick="chg('${id}',-1)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#f5f5f5"/><line x1="7" y1="12" x2="17" y2="12" stroke="#E03C31" stroke-width="2.5" stroke-linecap="round"/></svg></button>
              <span class="qn">${cart[id]}</span>
              <button class="qb" onclick="chg('${id}',1)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#f5f5f5"/><line x1="12" y1="7" x2="12" y2="17" stroke="#1a1a18" stroke-width="2.5" stroke-linecap="round"/><line x1="7" y1="12" x2="17" y2="12" stroke="#1a1a18" stroke-width="2.5" stroke-linecap="round"/></svg></button>
            </div>
            <span class="ci-price">${fmt(price*cart[id])}</span>
          </div>
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
    const tb = document.getElementById('cartTotalBig');
    if(tb) tb.style.display = expanded ? 'none' : (getTotalQty()>0 ? 'block' : 'none');
    if(!expanded){ payMethod=null; updatePaymentUI(); }
    updateCartBar();
  }

  // ── SWIPE GESTURE ──
  (function(){
    let startY = 0, startClientY = 0, startExp = false;
    const THRESHOLD = 40;

    document.addEventListener('touchstart', e => {
      startClientY = e.touches[0].clientY;
      startY       = e.touches[0].clientY;
      startExp     = expanded;
    }, { passive: true });

    document.addEventListener('touchend', e => {
      const endY = e.changedTouches[0].clientY;
      const dy   = startY - endY; // dương = vuốt lên
      if(Math.abs(dy) < THRESHOLD) return;

      const screenH    = window.innerHeight;
      const startNear  = startClientY > screenH - 120; // bắt đầu từ vùng 120px dưới

      // Vuốt lên từ vùng bottom → mở cart
      if(dy > 0 && !startExp && startNear) { toggleCart(); return; }
      // Vuốt xuống khi cart đang mở → đóng
      if(dy < 0 && startExp) toggleCart();
    }, { passive: true });
  })();

  async function confirmPay(){
    const btn = document.getElementById('confirmBtn');
    if(!btn.classList.contains('active')) return;

    // Loading state
    btn.classList.remove('active');
    btn.classList.add('loading');
    btn.innerHTML = '<span class="btn-spinner"></span>Đang xử lý...';

    const subtotal   = getSubtotal();
    const discount   = getDiscount();
    const payable    = getPayable();
    const methodName = payMethod==='cash' ? 'Tiền mặt' : 'Chuyển khoản';
    const orderNum   = '#' + String(orderN).padStart(3,'0');
    const items = Object.keys(cart).map(id => {
      const item = findItem(id);
      return { id, name:item?.name||'', qty:cart[id], price:item?.price||0 };
    });

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

    try { await IDBService.addPendingOrder(orderPayload); } catch(e){ console.warn('IDB error:', e); }
    if(navigator.onLine){ syncPendingOrders(); }
    else { toast('Offline — đơn đã lưu, sẽ sync khi có mạng'); }

    // Success state
    btn.classList.remove('loading');
    btn.classList.add('success');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Đã thanh toán';

    await new Promise(r => setTimeout(r, 1000));

    cart={}; notes={}; payMethod=null; discountValue=0; actualReceived=null;
    document.getElementById('discInput').value='';
    document.getElementById('actualInput').value='';
    orderN++;
    expanded = false;
    document.getElementById('bottomCart').classList.remove('expanded');
    update();
  }




  function showLogout(){
    document.getElementById('logoutSub').textContent = session ? `Đang đăng nhập: ${session.name}` : '';
    document.getElementById('logoutOverlay').classList.add('show');
  }
  function hideLogout(){ document.getElementById('logoutOverlay').classList.remove('show'); }

  init();
