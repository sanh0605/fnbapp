Auth.require('pos');
  const session = Auth.getSession();
  const role    = Auth.getRole();

  if(role === 'manager' || role === 'owner'){
    document.getElementById('homeBtn').style.visibility = 'visible';
    document.getElementById('ordersBtn').style.display  = 'flex';
    document.getElementById('revenueBtn').style.display = 'flex';
  }

  const netDot = document.getElementById('netDot');
  function updateNet(){ netDot.className = 'net-dot' + (navigator.onLine ? '' : ' offline'); }
  window.addEventListener('online', () => { updateNet(); syncPendingOrders(); });
  window.addEventListener('offline', updateNet);
  updateNet();

  // ── OFFLINE SYNC ──
  let syncing = false;
  const DEAD_KEY = `fnb_pos_deadletter_${session?.id||'anon'}`;

  function saveDeadLetter(entry){
    try {
      const dl = JSON.parse(localStorage.getItem(DEAD_KEY)||'[]');
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
        if(IDBService.isDeadLetter(entry)){
          saveDeadLetter(entry);
          toast(`⚠️ Đơn ${entry.payload?.order_num||''} lỗi quá ${IDBService.MAX_RETRIES} lần — đã lưu dead letter`);
          await IDBService.removePendingOrder(entry.local_id);
          continue;
        }
        try {
          await DB.insert('orders', entry.payload, false);
          await IDBService.removePendingOrder(entry.local_id);
          synced++;
        } catch(e){
          if(e.message && e.message.includes('409')){
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

  async function updateSyncBadge(){
    try {
      const q = await IDBService.getPendingOrders();
      if(q.length > 0) toast(`📶 ${q.length} đơn chờ sync`);
    } catch(e){}
  }

  // ── STATE ──
  let MENU = [], SETTINGS = {}, activeCat = 'Tất cả';
  let cartLines = [], orderN = 1, expanded = false, payMethod = null;
  let discOpen = false, lastQRAmount = null, customState = null;

  const SWEET_OPTS = ['0%', '30%', '50%', '70%', '100%', '120%'];
  const ICE_OPTS   = ['Không đá', 'Ít đá', 'Bình thường', 'Đá để riêng'];
  const ICE_LABEL  = { 'Không đá':'không đá', 'Ít đá':'ít đá', 'Bình thường':'đá bình thường', 'Đá để riêng':'đá để riêng' };
  const getToppings = () => MENU.filter(m => (m.category||'').toLowerCase() === 'topping');

  // ── DRAFT PERSISTENCE ──
  const DRAFT_KEY  = `fnb_pos_draft_${session?.id || 'anon'}`;
  const PARKED_KEY = `fnb_pos_parked_${session?.id || 'anon'}`;
  let parkedOrders = [];

  function saveDraft(){
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        cartLines, discountType, discountValue, actualReceived, discOpen,
      }));
    } catch(e){}
  }

  function loadDraft(){
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if(!raw) return;
      const d = JSON.parse(raw);
      if(!d.cartLines?.length) return;
      cartLines = d.cartLines.filter(l => findItem(l.productId));
      if(!cartLines.length) return;
      discountType   = d.discountType   || 'vnd';
      discountValue  = d.discountValue  || 0;
      actualReceived = d.actualReceived || null;
      discOpen       = d.discOpen       || false;
    } catch(e){}
  }

  function restoreDraftUI(){
    if(!cartLines.length) return;
    document.getElementById('dtVnd').classList.toggle('active', discountType==='vnd');
    document.getElementById('dtPct').classList.toggle('active', discountType==='pct');
    if(discountValue) document.getElementById('discInput').value =
      discountType==='vnd' ? fmtInput(discountValue) : discountValue;
    if(actualReceived) document.getElementById('actualInput').value = fmtInput(actualReceived);
    if(discOpen){
      document.getElementById('discBlock').style.display = 'flex';
      document.getElementById('discArrow').style.transform = 'rotate(180deg)';
    }
  }

  function clearDraft(){ try { localStorage.removeItem(DRAFT_KEY); } catch(e){} }

  // ── PARKED ORDERS ──
  function loadParked(){
    try { parkedOrders = JSON.parse(localStorage.getItem(PARKED_KEY)) || []; } catch(e){ parkedOrders = []; }
  }
  function saveParked(){
    try { localStorage.setItem(PARKED_KEY, JSON.stringify(parkedOrders)); } catch(e){}
  }
  function updateDraftBadge(){
    const btn = document.getElementById('draftListBtn');
    const badge = document.getElementById('draftBadge');
    if(!btn) return;
    btn.style.display = parkedOrders.length > 0 ? 'flex' : 'none';
    if(badge) badge.textContent = parkedOrders.length;
  }
  function buildDraftLabel(){
    if(!cartLines.length) return 'Đơn trống';
    const first = findItem(cartLines[0].productId);
    const label = `${first?.name || 'Món'} ×${cartLines[0].qty}`;
    const unique = new Set(cartLines.map(l=>l.productId)).size;
    return unique > 1 ? `${label} +${unique-1} loại` : label;
  }
  function timeAgo(iso){
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if(mins < 1) return 'vừa xong';
    if(mins < 60) return `${mins} phút trước`;
    return `${Math.round(mins/60)} giờ trước`;
  }
  function parkOrder(){
    if(!cartLines.length) return;
    const draft = {
      id: Date.now().toString(),
      savedAt: new Date().toISOString(),
      label: buildDraftLabel(),
      cartLines: JSON.parse(JSON.stringify(cartLines)),
      discountType, discountValue, actualReceived, discOpen,
    };
    parkedOrders.push(draft);
    saveParked(); updateDraftBadge();
    cartLines=[]; payMethod=null; discountType='vnd'; discountValue=0; actualReceived=null;
    discOpen=false; lastQRAmount=null;
    clearDraft();
    document.getElementById('discInput').value='';
    document.getElementById('actualInput').value='';
    document.getElementById('discBlock').style.display='none';
    document.getElementById('discArrow').style.transform='';
    document.getElementById('dtVnd').classList.add('active');
    document.getElementById('dtPct').classList.remove('active');
    if(expanded) toggleCart();
    renderMenu(); renderCartItems(); updateCartBar(); updatePaymentUI();
    toast(`Đã lưu nháp: "${draft.label}"`);
  }
  function resumeDraft(id){
    const draft = parkedOrders.find(d=>d.id===id);
    if(!draft) return;
    if(cartLines.length) parkOrder();
    cartLines      = (draft.cartLines||[]).filter(l=>findItem(l.productId));
    discountType   = draft.discountType   || 'vnd';
    discountValue  = draft.discountValue  || 0;
    actualReceived = draft.actualReceived || null;
    discOpen       = draft.discOpen       || false;
    payMethod=null; lastQRAmount=null;
    parkedOrders = parkedOrders.filter(d=>d.id!==id);
    saveParked(); saveDraft(); updateDraftBadge(); hideDrafts();
    renderCats(); renderMenu(); renderCartItems(); updateCartBar(); updatePaymentUI();
    restoreDraftUI();
    if(!expanded && cartLines.length) toggleCart();
  }
  function deleteDraft(id){
    parkedOrders = parkedOrders.filter(d=>d.id!==id);
    saveParked(); updateDraftBadge(); renderDraftList();
    if(!parkedOrders.length) hideDrafts();
  }
  function showDrafts(){ renderDraftList(); document.getElementById('draftsOverlay').classList.add('show'); }
  function hideDrafts(){ document.getElementById('draftsOverlay').classList.remove('show'); }
  function renderDraftList(){
    const el = document.getElementById('draftList');
    if(!parkedOrders.length){
      el.innerHTML='<div style="text-align:center;padding:20px 0;color:#bbb;font-size:13px">Không có đơn nháp nào</div>';
      return;
    }
    el.innerHTML = parkedOrders.map((d,idx) => {
      const lines = d.cartLines||[];
      const total = lines.reduce((s,l)=>s+linePriceUnit(l)*l.qty, 0);
      const qty = lines.reduce((s,l)=>s+l.qty,0);
      const itemsHtml = lines.map(l=>`${findItem(l.productId)?.name||'Món'} x${l.qty}`).join('<br>');
      return `<div class="draft-row">
        <div class="draft-info">
          <div class="draft-label"><strong>Nháp ${idx+1}</strong> - ${timeAgo(d.savedAt)}</div>
          <div class="draft-items">${itemsHtml}</div>
          <div class="draft-meta">${qty} món - ${fmt(total)}</div>
        </div>
        <button class="draft-resume" onclick="resumeDraft('${d.id}')">Tiếp tục</button>
        <button class="draft-del" onclick="deleteDraft('${d.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    }).join('');
  }

  let discountType='vnd', discountValue=0, actualReceived=null;
  let posOutletId=null, posBrandId=null;

  const findItem    = id => MENU.find(m=>m.id===id);
  const linePriceUnit = line => {
    const p = findItem(line.productId);
    const base = (p?.discount_price>0&&p.discount_price<p.price)?p.discount_price:(p?.price||0);
    return base + (line.toppings||[]).reduce((s,t)=>s+(t.price||0),0);
  };
  const getSubtotal = () => cartLines.reduce((s,l)=>s+linePriceUnit(l)*l.qty, 0);
  const getDiscount = () => {
    if(!discountValue) return 0;
    if(discountType==='pct') return Math.round(getSubtotal()*Math.min(discountValue,100)/100);
    return Math.min(discountValue, getSubtotal());
  };
  const getPayable  = () => Math.max(0, getSubtotal()-getDiscount());
  const getTotalQty = () => cartLines.reduce((s,l)=>s+l.qty, 0);

  // ── LOAD DATA ──
  const SKELETON = Array(4).fill(0).map(()=>`<div class="skel-card"><div class="skel-img"></div><div class="skel-body"><div class="skel-line"></div><div class="skel-line short"></div></div></div>`).join('');

  async function init(){
    document.getElementById('menuList').innerHTML = SKELETON;
    try {
      if(navigator.onLine){
        const userRows = session?.id ? await DB.select('users',`id=eq.${session.id}&select=outlet_id`) : [];
        const outletIdForQuery = userRows?.[0]?.outlet_id || null;
        const [products, settings, latestOrders] = await Promise.all([
          DB.select('products','active=eq.true&select=*&order=sort_order.asc'),
          DB.select('settings','select=*'),
          outletIdForQuery
            ? DB.select('orders',`select=order_num&outlet_id=eq.${outletIdForQuery}&order=created_at.desc&limit=1`)
            : DB.select('orders','select=order_num&order=created_at.desc&limit=1'),
        ]);
        MENU = products;
        IDBService.cacheMenu(products).catch(()=>{});
        settings.forEach(s=>SETTINGS[s.key]=s.value);
        if(latestOrders?.length){
          const m=(latestOrders[0].order_num||'').match(/(\d+)$/);
          if(m) orderN=parseInt(m[1],10)+1;
        }
        if(outletIdForQuery){
          posOutletId=outletIdForQuery;
          try {
            const outletRows=await DB.select('outlets',`id=eq.${outletIdForQuery}&select=brand_id`);
            posBrandId=outletRows?.[0]?.brand_id||null;
          } catch(e){ console.warn('Không lấy được brand_id:',e); }
        }
      } else {
        const cached=await IDBService.getMenu();
        if(!cached.length){
          document.getElementById('menuList').innerHTML=`<div class="loading">⚠️ Không có mạng và chưa có cache — vui lòng kết nối để tải menu lần đầu</div>`;
          updateSyncBadge(); return;
        }
        MENU=cached;
        toast('📶 Offline — dùng menu đã lưu');
      }
      if(navigator.onLine) syncPendingOrders();
      else updateSyncBadge();
    } catch(e){
      document.getElementById('menuList').innerHTML=`<div class="loading">Lỗi tải menu: ${e.message}</div>`;
    } finally {
      loadDraft(); loadParked();
      renderCats(); renderMenu(); renderCartItems(); updateCartBar(); updatePaymentUI();
      restoreDraftUI(); updateDraftBadge();
    }
  }

  // ── RENDER MENU ──
  function getCats(){ return ['Tất cả',...new Set(MENU.map(m=>m.category))]; }
  function renderCats(){
    document.getElementById('catBar').innerHTML = getCats().map(c=>
      `<button class="cat-pill${c===activeCat?' active':''}" onclick="setCat('${c}')">${c}</button>`
    ).join('');
  }
  function setCat(c){ activeCat=c; renderCats(); renderMenu(); }

  const SVG_PLUS_RED  = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#E03C31"/><line x1="12" y1="6" x2="12" y2="18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><line x1="6" y1="12" x2="18" y2="12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  const SVG_MINUS     = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#f5f5f5"/><line x1="7" y1="12" x2="17" y2="12" stroke="#E03C31" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  const SVG_PLUS_GRAY = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#f5f5f5"/><line x1="12" y1="7" x2="12" y2="17" stroke="#1a1a18" stroke-width="2.5" stroke-linecap="round"/><line x1="7" y1="12" x2="17" y2="12" stroke="#1a1a18" stroke-width="2.5" stroke-linecap="round"/></svg>`;

  function getCtrlHtml(id){
    const item=findItem(id); if(!item||item.active===false) return '';
    const qty=cartLines.filter(l=>l.productId===id).reduce((s,l)=>s+l.qty,0);
    if(qty===0) return `<button class="mc-add-btn" onclick="add('${id}')">${SVG_PLUS_RED}</button>`;
    return `<div class="mc-qty">
      <button class="qb minus" onclick="event.stopPropagation();chgLastLine('${id}',-1)">${SVG_MINUS}</button>
      <span class="qn">${qty}</span>
      <button class="qb" onclick="event.stopPropagation();add('${id}')">${SVG_PLUS_GRAY}</button>
    </div>`;
  }

  function updateMenuCardCtrl(id){
    const card=document.querySelector(`.menu-card[data-id="${id}"]`);
    if(!card) return;
    const qty=cartLines.filter(l=>l.productId===id).reduce((s,l)=>s+l.qty,0);
    card.classList.toggle('in-cart',qty>0);
    const bottom=card.querySelector('.mc-bottom');
    bottom.innerHTML=bottom.querySelector('.mc-prices').outerHTML+getCtrlHtml(id);
  }

  function renderMenuCard(item){
    const qty=cartLines.filter(l=>l.productId===item.id).reduce((s,l)=>s+l.qty,0);
    const out=item.active===false, bg=item.color||'#f5f5f0';
    const hasDisc=item.discount_price>0&&item.discount_price<item.price;
    const dispPrice=hasDisc?item.discount_price:item.price;
    const thumb=item.image_url?`<img src="${item.image_url}" alt="${item.name}" loading="lazy">`:(item.icon||'☕');
    const priceHtml=hasDisc
      ?`<span class="mc-original">${fmt(item.price)}</span><span class="mc-price">${fmt(dispPrice)}</span>`
      :`<span class="mc-price">${fmt(item.price)}</span>`;
    return `<div class="menu-card${out?' out':''}${qty>0?' in-cart':''}" data-id="${item.id}">
      <div class="mc-img" style="background:${bg}">${thumb}</div>
      <div class="mc-content">
        <div class="mc-name">${item.name}</div>
        <div class="mc-bottom"><div class="mc-prices">${priceHtml}</div>${getCtrlHtml(item.id)}</div>
      </div>
    </div>`;
  }

  function renderMenu(){
    const el=document.getElementById('menuList');
    if(activeCat!=='Tất cả'){
      const items=MENU.filter(m=>m.category===activeCat);
      if(!items.length){el.innerHTML='<div class="loading">Không có sản phẩm</div>';return;}
      el.innerHTML=items.map(renderMenuCard).join('');return;
    }
    const cats=[...new Set(MENU.map(m=>m.category))];
    if(!cats.length){el.innerHTML='<div class="loading">Không có sản phẩm</div>';return;}
    el.innerHTML=cats.map(cat=>`<div class="cat-header">${cat}</div>`+MENU.filter(m=>m.category===cat).map(renderMenuCard).join('')).join('');
  }

  // ── CART ACTIONS ──
  function add(id){
    const item=findItem(id); if(!item) return;
    if((item.category||'').toLowerCase()==='topping'){
      const last=[...cartLines].reverse().find(l=>l.productId===id);
      if(last) last.qty++;
      else cartLines.push({lineId:Date.now().toString(),productId:id,qty:1,sweet:null,ice:null,toppings:[],note:''});
      payMethod=null;
      updateMenuCardCtrl(id); renderCartItems(); updateCartBar(); updatePaymentUI();
      saveDraft(); navigator.vibrate?.(20);
    } else {
      openCustomModal(id,null);
    }
  }

  function chgLine(lineId,d){
    const line=cartLines.find(l=>l.lineId===lineId); if(!line) return;
    const productId=line.productId;
    line.qty+=d;
    if(line.qty<=0) cartLines=cartLines.filter(l=>l.lineId!==lineId);
    payMethod=null;
    updateMenuCardCtrl(productId); renderCartItems(); updateCartBar(); updatePaymentUI();
    saveDraft();
  }

  function chgLastLine(productId,d){
    const lines=cartLines.filter(l=>l.productId===productId);
    if(lines.length) chgLine(lines[lines.length-1].lineId,d);
  }

  function clearAll(){
    cartLines=[]; payMethod=null; discountType='vnd'; discountValue=0; actualReceived=null;
    discOpen=false; lastQRAmount=null;
    document.getElementById('discInput').value='';
    document.getElementById('actualInput').value='';
    document.getElementById('discBlock').style.display='none';
    document.getElementById('discArrow').style.transform='';
    document.getElementById('dtVnd').classList.add('active');
    document.getElementById('dtPct').classList.remove('active');
    clearDraft();
    renderMenu(); renderCartItems(); updateCartBar(); updatePaymentUI();
    if(expanded) toggleCart();
  }

  // ── CUSTOM MODAL ──
  function openCustomModal(productId, lineId){
    const item=findItem(productId); if(!item) return;
    if(lineId){
      const line=cartLines.find(l=>l.lineId===lineId); if(!line) return;
      customState={lineId,productId,qty:line.qty,sweet:line.sweet||'100%',ice:line.ice||'Bình thường',toppings:new Set((line.toppings||[]).map(t=>t.id)),note:line.note||''};
    } else {
      customState={lineId:null,productId,qty:1,sweet:'100%',ice:'Bình thường',toppings:new Set(),note:''};
    }
    document.getElementById('customItemName').textContent=item.name;
    const thumb=document.getElementById('customItemThumb');
    const bg=item.color||'#f5f5f0';
    thumb.style.background=bg;
    thumb.innerHTML=item.image_url
      ?`<img src="${item.image_url}" alt="" style="width:100%;height:100%;object-fit:cover">`
      :(item.icon||'☕');
    renderCustomModal();
    document.getElementById('customModal').classList.add('show');
  }

  function editLine(lineId){
    const line=cartLines.find(l=>l.lineId===lineId);
    if(line) openCustomModal(line.productId,lineId);
  }

  function renderCustomModal(){
    if(!customState) return;
    const {lineId,qty,sweet,ice,toppings}=customState;
    document.getElementById('customQtyVal').textContent=qty;
    document.getElementById('customQtyMinus').disabled=qty<=1;

    document.getElementById('sweetPills').innerHTML=SWEET_OPTS.map(s=>
      `<button class="custom-pill${sweet===s?' active':''}" onclick="setCustomOpt('sweet','${s}')">${s}</button>`
    ).join('');

    document.getElementById('icePills').innerHTML=ICE_OPTS.map(i=>
      `<button class="custom-pill${ice===i?' active':''}" onclick="setCustomOpt('ice','${i}')">${i}</button>`
    ).join('');

    const toppingItems=getToppings();
    const toppingSection=document.getElementById('toppingSection');
    if(toppingItems.length){
      toppingSection.style.display='block';
      document.getElementById('toppingPills').innerHTML=toppingItems.map(t=>{
        const priceLabel=t.price?` <span style="font-size:11px;opacity:.75">+${fmt(t.price)}</span>`:'';
        return `<button class="custom-pill${toppings.has(t.id)?' active':''}" onclick="toggleTopping('${t.id}')">${t.name}${priceLabel}</button>`;
      }).join('');
    } else {
      toppingSection.style.display='none';
    }

    document.getElementById('customNote').value=customState.note||'';

    const product=findItem(customState.productId);
    const base=(product?.discount_price>0&&product.discount_price<product.price)?product.discount_price:(product?.price||0);
    const toppingSum=getToppings().filter(t=>toppings.has(t.id)).reduce((s,t)=>s+(t.price||0),0);
    const unitPrice=base+toppingSum;

    document.getElementById('customAddBtn').textContent=lineId?'Cập nhật':`Thêm — ${fmt(unitPrice*qty)}`;
    const delBtn=document.getElementById('customDelBtn');
    if(delBtn) delBtn.style.display=lineId?'block':'none';
  }

  function customQty(d){
    if(!customState) return;
    customState.qty=Math.max(1,customState.qty+d);
    renderCustomModal();
  }

  function setCustomOpt(key,val){
    if(!customState) return;
    customState[key]=val;
    renderCustomModal();
  }

  function toggleTopping(id){
    if(!customState) return;
    if(customState.toppings.has(id)) customState.toppings.delete(id);
    else customState.toppings.add(id);
    renderCustomModal();
  }

  function confirmCustom(){
    if(!customState) return;
    const {lineId,productId,qty,sweet,ice,toppings}=customState;
    const note=document.getElementById('customNote').value.trim();
    const toppingObjs=getToppings().filter(t=>toppings.has(t.id)).map(t=>({id:t.id,name:t.name,price:t.price||0}));

    if(lineId){
      const line=cartLines.find(l=>l.lineId===lineId);
      if(line){line.qty=qty;line.sweet=sweet;line.ice=ice;line.toppings=toppingObjs;line.note=note;}
    } else {
      cartLines.push({lineId:Date.now().toString(),productId,qty,sweet,ice,toppings:toppingObjs,note});
    }
    payMethod=null; customState=null;
    document.getElementById('customModal').classList.remove('show');
    updateMenuCardCtrl(productId); renderCartItems(); updateCartBar(); updatePaymentUI();
    saveDraft(); navigator.vibrate?.(20);
  }

  function deleteCustomLine(){
    if(!customState?.lineId) return;
    const productId=cartLines.find(l=>l.lineId===customState.lineId)?.productId;
    cartLines=cartLines.filter(l=>l.lineId!==customState.lineId);
    customState=null;
    document.getElementById('customModal').classList.remove('show');
    if(productId) updateMenuCardCtrl(productId);
    renderCartItems(); updateCartBar(); updatePaymentUI(); saveDraft();
  }

  function cancelCustom(){
    customState=null;
    document.getElementById('customModal').classList.remove('show');
  }

  // ── CART DISPLAY ──
  function formatLineOpts(line){
    if(!line.sweet&&!line.ice) return '';
    const parts=[];
    if(line.sweet) parts.push(`${line.sweet} ngọt`);
    if(line.ice) parts.push(ICE_LABEL[line.ice]||line.ice.toLowerCase());
    if(line.toppings?.length) parts.push(line.toppings.map(t=>t.name).join(', '));
    if(line.note) parts.push(line.note);
    return parts.join(', ');
  }

  function renderCartItems(){
    const el=document.getElementById('cartItems');
    if(!cartLines.length){
      el.innerHTML=`<div class="cart-empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>Chưa có món nào</div>`;
      return;
    }
    const order=[], groups={};
    cartLines.forEach(line=>{
      if(!groups[line.productId]){groups[line.productId]=[];order.push(line.productId);}
      groups[line.productId].push(line);
    });
    el.innerHTML=order.map(productId=>{
      const item=findItem(productId); if(!item) return '';
      const isTopping=(item.category||'').toLowerCase()==='topping';
      const linesHtml=groups[productId].map(line=>{
        const opts=formatLineOpts(line);
        const desc=opts?`×${line.qty} – ${opts}`:`×${line.qty}`;
        const optsEl=isTopping
          ?`<span class="ci-line-opts">${desc}</span>`
          :`<button class="ci-line-opts" onclick="event.stopPropagation();editLine('${line.lineId}')">${desc}</button>`;
        return `<div class="ci-line">
          ${optsEl}
          <div class="ci-line-right">
            <span class="ci-price">${fmt(linePriceUnit(line)*line.qty)}</span>
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

  function editLineQty(spanEl,lineId){
    const line=cartLines.find(l=>l.lineId===lineId); if(!line) return;
    const productId=line.productId;
    const inp=document.createElement('input');
    inp.className='qn-edit'; inp.value=line.qty; inp.type='text'; inp.inputMode='numeric';
    spanEl.replaceWith(inp); inp.select();
    inp.addEventListener('blur',()=>{
      const v=parseInt(inp.value)||0;
      if(v<=0) cartLines=cartLines.filter(l=>l.lineId!==lineId);
      else { const l=cartLines.find(l=>l.lineId===lineId); if(l) l.qty=v; }
      renderCartItems(); updateCartBar(); updateMenuCardCtrl(productId); updatePaymentUI(); saveDraft();
    });
    inp.addEventListener('keydown',e=>{if(e.key==='Enter') inp.blur();});
  }

  // ── CHIẾT KHẤU ──
  function setDiscType(t){
    discountType=t;
    document.getElementById('dtVnd').classList.toggle('active',t==='vnd');
    document.getElementById('dtPct').classList.toggle('active',t==='pct');
    document.getElementById('discInput').value=''; discountValue=0;
    updateDiscount();
  }
  function parseInputNum(el){ return parseInt(el.value.replace(/\./g,'').replace(/[^0-9]/g,''))||0; }
  function fmtInput(n){ return n>0?n.toLocaleString('vi-VN'):''; }

  function updateDiscount(){
    const el=document.getElementById('discInput');
    const raw=parseInputNum(el);
    discountValue=raw;
    if(discountType==='vnd') el.value=fmtInput(raw);
    actualReceived=null;
    document.getElementById('actualInput').value='';
    updateCartBar(); updatePaymentUI(); saveDraft();
  }
  function updateActual(){
    const el=document.getElementById('actualInput');
    const raw=parseInputNum(el);
    actualReceived=raw||null; el.value=fmtInput(raw);
    renderDiscountUI(); saveDraft();
  }
  function renderDiscountUI(){
    const payable=getPayable(), discount=getDiscount(), hasDiscount=discount>0;
    document.getElementById('payableRow').style.display=hasDiscount?'flex':'none';
    document.getElementById('actualRow').style.display=hasDiscount?'flex':'none';
    if(hasDiscount) document.getElementById('payableAmt').textContent=fmt(payable);
    const actual=actualReceived!==null?actualReceived:payable;
    const change=actual-payable;
    document.getElementById('changeRow').style.display=change>0?'flex':'none';
    if(change>0) document.getElementById('changeAmt').textContent=fmt(change);
    if(document.getElementById('qrSection').classList.contains('show')) updateQR(payable);
  }

  function updateCartBar(){
    const count=getTotalQty(), payable=getPayable();
    document.getElementById('footerSubtotal').textContent=fmt(getSubtotal());
    renderDiscountUI();
    document.getElementById('cartQtyLabel').textContent=count>0?`${count} ly`:'';
    document.getElementById('cartTotalBig').textContent=count>0?fmt(payable):'';
    document.getElementById('bottomCart').style.visibility=count>0?'visible':'hidden';
  }

  function toggleDisc(){
    discOpen=!discOpen;
    document.getElementById('discBlock').style.display=discOpen?'flex':'none';
    document.getElementById('discArrow').style.transform=discOpen?'rotate(180deg)':'';
    saveDraft();
  }

  function selectMethod(m){ payMethod=m; updatePaymentUI(); }

  function updatePaymentUI(){
    const payable=getPayable(), hasItems=cartLines.length>0;
    document.getElementById('btnCash').classList.toggle('selected',payMethod==='cash');
    document.getElementById('btnTransfer').classList.toggle('selected',payMethod==='transfer');
    const qr=document.getElementById('qrSection');
    if(payMethod==='transfer'&&hasItems){ qr.classList.add('show'); updateQR(payable); }
    else qr.classList.remove('show');
    document.getElementById('confirmBtn').classList.toggle('active',payMethod!==null&&hasItems);
    const parkBtn=document.getElementById('parkBtn');
    if(parkBtn) parkBtn.style.display=hasItems?'block':'none';
  }

  function updateQR(amount){
    if(amount===lastQRAmount) return;
    lastQRAmount=amount;
    const bankId=SETTINGS.bank_id||'ACB', accountNo=SETTINGS.account_no||'XXXXXXXXXX';
    const accountName=SETTINGS.account_name||'', content=SETTINGS.transfer_content||'Thanh toan don hang';
    document.getElementById('qrImg').src=`https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.jpg?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(accountName)}`;
    document.getElementById('qrAmount').textContent=fmt(amount);
  }

  function toggleCart(){
    if(cartLines.length===0&&!expanded) return;
    expanded=!expanded;
    document.getElementById('bottomCart').classList.toggle('expanded',expanded);
    document.getElementById('cartBackdrop').style.display=expanded?'block':'none';
    document.getElementById('cartTrashBtn').style.display=expanded?'flex':'none';
    if(!expanded){ payMethod=null; updatePaymentUI(); }
    updateCartBar();
  }

  // ── SWIPE ──
  (function(){
    let startY=0, startClientY=0, startExp=false;
    const THRESHOLD=40;
    document.addEventListener('touchstart',e=>{startClientY=e.touches[0].clientY;startY=e.touches[0].clientY;startExp=expanded;},{passive:true});
    document.addEventListener('touchend',e=>{
      const modalOpen=document.querySelector('.overlay.show');
      if(modalOpen) return;
      const dy=startY-e.changedTouches[0].clientY;
      if(Math.abs(dy)<THRESHOLD) return;
      const startNear=startClientY>window.innerHeight-120;
      if(dy>0&&!startExp&&startNear){toggleCart();return;}
      if(dy<0&&startExp) toggleCart();
    },{passive:true});
  })();

  async function confirmPay(){
    const btn=document.getElementById('confirmBtn');
    if(!btn.classList.contains('active')) return;
    btn.classList.remove('active'); btn.classList.add('loading');
    btn.innerHTML='<span class="btn-spinner"></span>Đang xử lý...';

    const subtotal=getSubtotal(), discount=getDiscount(), payable=getPayable();
    const methodName=payMethod==='cash'?'Tiền mặt':'Chuyển khoản';
    let displayN=orderN;
    if(posOutletId&&navigator.onLine){
      try{ const n=await DB.rpc('next_order_num',{p_outlet_id:posOutletId}); if(typeof n==='number') displayN=n; }catch(e){}
    }
    const orderNum=posOutletId?`${posOutletId}-${String(displayN).padStart(3,'0')}`:'#'+String(orderN).padStart(3,'0');
    const items=cartLines.map(line=>{
      const item=findItem(line.productId);
      return {id:line.productId,name:item?.name||'',qty:line.qty,price:linePriceUnit(line),
        sweet:line.sweet,ice:line.ice,toppings:(line.toppings||[]).map(t=>t.name),note:line.note||undefined};
    });

    const orderPayload={
      client_id:crypto.randomUUID(), order_num:orderNum,
      total:payable, subtotal, discount_amount:discount||undefined,
      actual_received:actualReceived||undefined, method:methodName,
      items, staff_name:session?.name||'',
      outlet_id:posOutletId||undefined, brand_id:posBrandId||undefined,
    };

    let saved = false;
    try {
      await IDBService.addPendingOrder(orderPayload);
      saved = true;
    } catch(idbErr){
      if(navigator.onLine){
        try { await DB.insert('orders', orderPayload, false); saved = true; } catch(e){}
      }
    }

    if(!saved){
      btn.classList.remove('loading'); btn.classList.add('active');
      btn.innerHTML='Xác nhận thanh toán';
      toast('Lỗi: không thể lưu đơn — vui lòng thử lại');
      return;
    }

    if(navigator.onLine) syncPendingOrders();
    else toast('Offline — đơn đã lưu, sẽ sync khi có mạng');

    btn.classList.remove('loading'); btn.classList.add('success');
    btn.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Đã thanh toán';

    await new Promise(r=>setTimeout(r,1000));

    btn.classList.remove('success'); btn.innerHTML='Xác nhận thanh toán';
    cartLines=[]; payMethod=null; discountType='vnd'; discountValue=0; actualReceived=null;
    discOpen=false; lastQRAmount=null;
    clearDraft();
    document.getElementById('discInput').value='';
    document.getElementById('actualInput').value='';
    document.getElementById('discBlock').style.display='none';
    document.getElementById('discArrow').style.transform='';
    document.getElementById('dtVnd').classList.add('active');
    document.getElementById('dtPct').classList.remove('active');
    orderN++; expanded=false;
    document.getElementById('bottomCart').classList.remove('expanded');
    document.getElementById('cartBackdrop').style.display='none';
    document.getElementById('cartTrashBtn').style.display='none';
    renderMenu(); renderCartItems(); updateCartBar(); updatePaymentUI();
  }

  function showLogout(){
    document.getElementById('logoutSub').textContent=session?`Đang đăng nhập: ${session.name}`:'';
    document.getElementById('logoutOverlay').classList.add('show');
  }
  function hideLogout(){ document.getElementById('logoutOverlay').classList.remove('show'); }

  init();
