Auth.require('revenue');

  const params = new URLSearchParams(location.search);
  const orderId = params.get('id');
  if(!orderId){ history.back(); }

  let ORDER = null;
  let PRODUCTS = [];
  let editItems = [];
  let editMethod = 'Tiền mặt';
  let editDiscountAmount = 0;
  let editActualReceived = null;

  // ── INIT ──
  async function init(){
    if(!orderId) return;
    try{
      const [orders, prods] = await Promise.all([
        DB.select('orders', `id=eq.${orderId}&select=*`),
        DB.select('products', 'active=eq.true&select=id,name,icon,color,price,category&order=sort_order.asc'),
      ]);
      ORDER = orders?.[0];
      PRODUCTS = prods || [];
      if(!ORDER){ document.getElementById('body').innerHTML='<div class="loading">Không tìm thấy đơn</div>'; return; }
      populate();
    } catch(e){
      document.getElementById('body').innerHTML=`<div class="loading">Lỗi: ${e.message}</div>`;
    }
  }

  function populate(){
    document.getElementById('pageTitle').textContent = `Sửa đơn ${ORDER.order_num||''}`;
    editItems = (Array.isArray(ORDER.items) ? ORDER.items : []).map(i=>({...i}));
    editMethod = ORDER.method || 'Tiền mặt';
    editDiscountAmount = ORDER.discount_amount || 0;
    editActualReceived = ORDER.actual_received || null;
    renderBody();
  }

  function renderBody(){
    const pad = n => String(n).padStart(2,'0');
    const d = new Date(ORDER.created_at);
    const dtVal = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    document.getElementById('body').innerHTML = `
      <!-- Thông tin đơn -->
      <div class="section">
        <div class="section-title">Thông tin đơn</div>
        <div class="field">
          <span class="field-label">Số đơn</span>
          <input class="field-input" id="ef-order-num" value="${ORDER.order_num||''}" placeholder="#001">
        </div>
        <div class="field">
          <span class="field-label">Thời gian</span>
          <input class="field-input" id="ef-datetime" type="datetime-local" value="${dtVal}">
        </div>
        <div class="field">
          <span class="field-label">Nhân viên</span>
          <input class="field-input" id="ef-staff" value="${ORDER.staff_name||''}" placeholder="Tên nhân viên">
        </div>
      </div>

      <!-- Món đặt -->
      <div class="section">
        <div class="section-title">Món đặt</div>
        <div id="itemsList"></div>
        <div class="add-item-btn" onclick="openPicker()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          Thêm món
        </div>
      </div>

      <!-- Hình thức thanh toán -->
      <div class="section">
        <div class="section-title">Hình thức thanh toán</div>
        <div class="method-grid">
          <button class="method-opt" id="mopt-cash"     onclick="selMethod('Tiền mặt')">Tiền mặt</button>
          <button class="method-opt" id="mopt-transfer" onclick="selMethod('Chuyển khoản')">Chuyển khoản</button>
        </div>
      </div>

      <!-- Tài chính -->
      <div class="finance-box">
        <div class="fin-row">
          <span class="fin-label">Tạm tính</span>
          <span class="fin-value" id="fin-subtotal">0 ₫</span>
        </div>
        <div class="fin-row" style="margin-top:10px">
          <span class="fin-label">Chiết khấu</span>
          <div class="fin-input-wrap">
            <input class="fin-input" id="ef-discount" type="text" inputmode="numeric" placeholder="0"
              oninput="fmtInput(this);calcFinance()" style="width:120px">
            <span style="font-size:13px;color:#888">₫</span>
          </div>
        </div>
        <div class="fin-divider"></div>
        <div class="fin-payable-row">
          <span class="fin-payable-label">Cần thanh toán</span>
          <span class="fin-payable-value" id="fin-payable">0 ₫</span>
        </div>
        <div class="fin-divider"></div>
        <div class="fin-row">
          <span class="fin-label">Thực thu</span>
          <div class="fin-input-wrap">
            <input class="fin-input" id="ef-actual" type="text" inputmode="numeric" placeholder="0"
              oninput="fmtInput(this);calcFinance()" style="width:120px">
            <span style="font-size:13px;color:#888">₫</span>
          </div>
        </div>
        <div class="fin-change" id="fin-change">
          <span class="fin-change-lbl">Hoàn lại cho khách</span>
          <span class="fin-change-val" id="fin-change-val"></span>
        </div>
      </div>`;

    selMethod(editMethod);
    setInput('ef-discount', editDiscountAmount);
    setInput('ef-actual', editActualReceived);
    renderItems();
  }

  // ── ITEMS ──
  function renderItems(){
    const el = document.getElementById('itemsList');
    if(!editItems.length){
      el.innerHTML='<div style="padding:14px 16px;font-size:13px;color:#bbb">Chưa có món nào</div>';
      calcFinance(); return;
    }
    el.innerHTML = editItems.map((item,idx)=>`
      <div class="item-row">
        <div class="item-info">
          <div class="item-name">${item.name||'?'}</div>
          <input class="item-price-input" value="${(item.price||0).toLocaleString('en-US')}"
            onchange="setItemPrice(${idx},this.value)" placeholder="Đơn giá">
        </div>
        <div class="qty-ctrl">
          <button class="qb" onclick="chgQty(${idx},-1)">−</button>
          <span class="qn">${item.qty||1}</span>
          <button class="qb" onclick="chgQty(${idx},1)">+</button>
          <button class="qb del" onclick="removeItem(${idx})">✕</button>
        </div>
      </div>`).join('');
    calcFinance();
  }

  function chgQty(idx,d){
    editItems[idx].qty=(editItems[idx].qty||1)+d;
    if(editItems[idx].qty<=0) editItems.splice(idx,1);
    renderItems();
  }
  function removeItem(idx){ editItems.splice(idx,1); renderItems(); }
  function setItemPrice(idx,val){
    editItems[idx].price = parseFloat(String(val).replace(/[^0-9.]/g,''))||0;
    calcFinance();
  }

  // ── METHOD ──
  function selMethod(m){
    editMethod=m;
    document.getElementById('mopt-cash')?.classList.toggle('sel',m==='Tiền mặt');
    document.getElementById('mopt-transfer')?.classList.toggle('sel',m==='Chuyển khoản');
  }

  // ── FINANCE ──
  function fmtInput(el){
    const raw=el.value.replace(/[^0-9]/g,'');
    el.value = raw ? parseInt(raw,10).toLocaleString('en-US') : '';
  }
  function parseInput(id){ return parseInt((document.getElementById(id)?.value||'').replace(/,/g,''),10)||0; }
  function setInput(id,val){ const el=document.getElementById(id); if(el) el.value=val?val.toLocaleString('en-US'):''; }

  function calcSubtotal(){
    return editItems.reduce((s,i)=>s+(parseFloat(String(i.price).replace(/[^0-9.-]/g,''))||0)*(i.qty||1),0);
  }

  function calcFinance(){
    const subtotal = calcSubtotal();
    editDiscountAmount = Math.max(0, parseInput('ef-discount'));
    editActualReceived = parseInput('ef-actual') || null;
    const disc = Math.min(editDiscountAmount, subtotal);
    const payable = Math.max(0, subtotal - disc);

    document.getElementById('fin-subtotal').textContent = fmt(subtotal);
    document.getElementById('fin-payable').textContent  = fmt(payable);

    const changeEl = document.getElementById('fin-change');
    if(changeEl){
      if(editActualReceived && editActualReceived > payable){
        changeEl.style.display='flex';
        document.getElementById('fin-change-val').textContent = fmt(editActualReceived - payable);
      } else {
        changeEl.style.display='none';
      }
    }
  }

  // ── PICKER ──
  function openPicker(){
    document.getElementById('pickerSearch').value='';
    filterPicker('');
    document.getElementById('pickerOverlay').classList.add('show');
  }
  function closePicker(){ document.getElementById('pickerOverlay').classList.remove('show'); }
  function filterPicker(q){
    const list=document.getElementById('pickerList');
    const filtered=q?PRODUCTS.filter(p=>(p.name||'').toLowerCase().includes(q.toLowerCase())):PRODUCTS;
    if(!filtered.length){list.innerHTML='<div style="padding:16px;text-align:center;font-size:13px;color:#bbb">Không tìm thấy</div>';return;}
    list.innerHTML=filtered.map(p=>`
      <div class="picker-item" onclick="addFromPicker('${p.id}')">
        <div class="picker-icon" style="background:${p.color||'#f5f5f0'}">${p.icon||'☕'}</div>
        <span class="picker-name">${p.name}</span>
        <span class="picker-price">${fmt(p.price||0)}</span>
      </div>`).join('');
  }
  function addFromPicker(id){
    const p=PRODUCTS.find(x=>x.id===id); if(!p) return;
    const ex=editItems.find(i=>i.id===id);
    if(ex) ex.qty=(ex.qty||1)+1;
    else editItems.push({id:p.id,name:p.name,qty:1,price:p.price||0});
    closePicker(); renderItems();
  }

  // ── SAVE ──
  async function saveEdit(){
    const orderNum  = document.getElementById('ef-order-num').value.trim();
    const dtVal     = document.getElementById('ef-datetime').value;
    const staffName = document.getElementById('ef-staff').value.trim();
    const subtotal  = calcSubtotal();
    const disc      = Math.min(editDiscountAmount, subtotal);
    const payable   = Math.max(0, subtotal - disc);
    const payload = {
      order_num:       orderNum || undefined,
      items:           editItems,
      subtotal,
      discount_amount: disc || undefined,
      actual_received: editActualReceived || undefined,
      total:           payable,
      method:          editMethod,
      staff_name:      staffName || undefined,
    };
    if(dtVal) payload.created_at = new Date(dtVal).toISOString();
    try{
      await DB.update('orders', `id=eq.${orderId}`, payload);
      toast('Đã lưu đơn hàng');
      setTimeout(()=>history.back(), 800);
    } catch(e){ toast('Lỗi: '+e.message); }
  }


  init();
