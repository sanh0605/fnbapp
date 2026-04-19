Auth.require('revenue');
  const isOwner = Auth.getRole() === 'owner';
  const isManager = isOwner || Auth.getRole() === 'manager';
  const DOW=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];

  // ── STATE ──
  let period = 'day', cursor = new Date(), customFrom = null, customTo = null;
  let allOrders = [], filteredOrders = [];
  let voidTargetId = null;

  // ── DEAD-LETTER ──
  const _dlSession = Auth.getSession();
  const DEAD_KEY = `fnb_pos_deadletter_${_dlSession?.id||'anon'}`;

  function getDeadLetters(){ try{ return JSON.parse(localStorage.getItem(DEAD_KEY)||'[]'); }catch(e){ return []; } }
  function saveDeadLetters(dl){ try{ localStorage.setItem(DEAD_KEY,JSON.stringify(dl)); }catch(e){} }
  function removeDeadLetter(idx){
    const dl=getDeadLetters(); dl.splice(idx,1); saveDeadLetters(dl);
    renderList();
  }
  function clearAllDeadLetters(){ saveDeadLetters([]); renderList(); }
  function toggleDLBody(){
    const b=document.getElementById('dlBody');
    if(b) b.classList.toggle('open');
  }
  function renderDeadLetterHTML(dl){
    if(!dl.length) return '';
    const rows=dl.map((e,i)=>{
      const p=e.payload||e;
      const num=p.order_num||'#?';
      const total=p.total||0;
      const t=e.failedAt?new Date(e.failedAt):new Date(e.created_at||0);
      const timeStr=`${String(t.getDate()).padStart(2,'0')}/${String(t.getMonth()+1).padStart(2,'0')} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
      return `<div class="dl-entry">
        <div class="dl-entry-info">
          <div class="dl-entry-num">${num}</div>
          <div class="dl-entry-meta">${timeStr} · ${fmt(total)}</div>
        </div>
        <button class="dl-entry-del" onclick="removeDeadLetter(${i})" title="Xoá">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>`;
    }).join('');
    return `<div class="dl-section">
      <div class="dl-header" onclick="toggleDLBody()">
        <div class="dl-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <span class="dl-title">Đơn cần xử lý</span>
        <span class="dl-count">${dl.length}</span>
      </div>
      <div class="dl-body" id="dlBody">
        ${rows}
        <p class="dl-note">⚠️ Chỉ hiện trên thiết bị này</p>
        <button class="dl-clear-all" onclick="clearAllDeadLetters()">Xoá tất cả</button>
      </div>
    </div>`;
  }

  cursor.setHours(0,0,0,0);

  // ── PERIOD ──
  function getRange(){
    const d = new Date(cursor); let from, to;
    if(period==='day'){from=new Date(d);from.setHours(0,0,0,0);to=new Date(d);to.setHours(23,59,59,999);}
    else if(period==='week'){const day=d.getDay(),diff=day===0?-6:1-day;from=new Date(d);from.setDate(d.getDate()+diff);from.setHours(0,0,0,0);to=new Date(from);to.setDate(from.getDate()+6);to.setHours(23,59,59,999);}
    else if(period==='month'){from=new Date(d.getFullYear(),d.getMonth(),1);to=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999);}
    else{from=customFrom||new Date(d);from.setHours(0,0,0,0);to=customTo||new Date(d);to.setHours(23,59,59,999);}
    return{from,to};
  }
  function setPeriod(p){
    period=p;
    ['day','week','month','custom'].forEach(x=>document.getElementById('p-'+x).classList.toggle('active',x===p));
    document.getElementById('dateNav').style.display=p==='custom'?'none':'flex';
    document.getElementById('customRow').style.display=p==='custom'?'flex':'none';
    cursor=new Date();cursor.setHours(0,0,0,0);
    if(p!=='custom') loadOrders();
  }
  function shiftPeriod(dir){
    if(period==='day') cursor.setDate(cursor.getDate()+dir);
    else if(period==='week') cursor.setDate(cursor.getDate()+dir*7);
    else if(period==='month') cursor.setMonth(cursor.getMonth()+dir);
    loadOrders();
  }
  function goToday(){cursor=new Date();cursor.setHours(0,0,0,0);loadOrders();}
  function updateDateLabel(){
    const{from,to}=getRange();let label='';
    if(period==='day') label=`${DOW[from.getDay()]}, ${fmtDate(from)}`;
    else if(period==='week') label=`${fmtDate(from).slice(0,5)} — ${fmtDate(to)}`;
    else if(period==='month') label=`${String(from.getMonth()+1).padStart(2,'0')}/${from.getFullYear()}`;
    document.getElementById('dateLabel').textContent=label;
  }
  function toDisplayDate(d){const x=new Date(d);const p=n=>String(n).padStart(2,'0');return`${p(x.getDate())}/${p(x.getMonth()+1)}/${x.getFullYear()}`;}
  function parseDateInput(s){const[dd,mm,yyyy]=(s||'').split('/');if(!dd||!mm||!yyyy||yyyy.length<4)return null;const d=new Date(+yyyy,+mm-1,+dd);return isNaN(d)?null:d;}
  function autoFmtDate(el){let v=el.value.replace(/\D/g,'');if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);if(v.length>5)v=v.slice(0,5)+'/'+v.slice(5,9);el.value=v;}
  function applyCustom(){
    const f=parseDateInput(document.getElementById('cF').value);
    const t=parseDateInput(document.getElementById('cT').value);
    if(!f||!t){toast('Nhập ngày theo định dạng dd/mm/yyyy');return;}
    customFrom=new Date(f);customFrom.setHours(0,0,0,0);
    customTo=new Date(t);customTo.setHours(23,59,59,999);
    loadOrders();
  }

  // ── LOAD ──
  async function init(){
    await loadOrders();
  }

  async function loadOrders(){
    updateDateLabel();
    document.getElementById('content').innerHTML='<div class="loading">Đang tải...</div>';
    const{from,to}=getRange();
    try{
      allOrders=await DB.select('orders',`created_at=gte.${from.toISOString()}&created_at=lte.${to.toISOString()}&select=*&order=created_at.desc`)||[];
      document.getElementById('searchInput').value='';
      filteredOrders=allOrders;
      renderSummary(); renderList();
    }catch(e){
      document.getElementById('content').innerHTML=`<div class="empty">Lỗi: ${e.message}</div>`;
    }
  }

  // ── SEARCH ──
  function applySearch(){
    const q=document.getElementById('searchInput').value.trim().toLowerCase();
    filteredOrders=!q?allOrders:allOrders.filter(o=>{
      return (o.order_num||'').toLowerCase().includes(q)
        ||(o.staff_name||'').toLowerCase().includes(q)
        ||(Array.isArray(o.items)&&o.items.some(i=>(i.name||'').toLowerCase().includes(q)));
    });
    renderSummary(); renderList();
  }

  // ── SUMMARY ──
  function renderSummary(){
    const active=filteredOrders.filter(o=>!o.voided);
    const revenue=active.reduce((s,o)=>s+(o.total||0),0);
    const count=active.length;
    document.getElementById('sumCount').textContent=count;
    document.getElementById('sumRevenue').textContent=fmt(revenue);
    document.getElementById('sumAvg').textContent=count>0?fmt(Math.round(revenue/count)):'—';

    // Breakdown theo hình thức thanh toán
    const cash=active.filter(o=>o.method==='Tiền mặt');
    const transfer=active.filter(o=>o.method!=='Tiền mặt');
    const voided=filteredOrders.filter(o=>o.voided);
    const cashRev=cash.reduce((s,o)=>s+(o.total||0),0);
    const transRev=transfer.reduce((s,o)=>s+(o.total||0),0);
    const voidRev=voided.reduce((s,o)=>s+(o.total||0),0);
    document.getElementById('pbCashRev').textContent=fmt(cashRev);
    document.getElementById('pbCashCnt').textContent=`${cash.length} đơn`;
    document.getElementById('pbTransRev').textContent=fmt(transRev);
    document.getElementById('pbTransCnt').textContent=`${transfer.length} đơn`;
    document.getElementById('pbVoidRev').textContent=fmt(voidRev);
    document.getElementById('pbVoidCnt').textContent=`${voided.length} đơn`;
  }

  // ── RENDER LIST ──
  function renderList(){
    const el=document.getElementById('content');
    const dlHtml=renderDeadLetterHTML(getDeadLetters());
    if(!filteredOrders.length){
      el.innerHTML=dlHtml+`<div class="empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Không có đơn hàng</div>`;
      return;
    }
    const groups={};
    filteredOrders.forEach(o=>{
      const d=new Date(o.created_at);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if(!groups[key])groups[key]=[];groups[key].push(o);
    });
    const today=new Date();today.setHours(0,0,0,0);
    const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
    let html=dlHtml;
    Object.keys(groups).sort().reverse().forEach(key=>{
      const d=new Date(key);
      let dayLabel=d.toDateString()===today.toDateString()?'Hôm nay':d.toDateString()===yesterday.toDateString()?'Hôm qua':`${DOW[d.getDay()]}, ${fmtDate(d)}`;
      const dayRev=groups[key].filter(o=>!o.voided).reduce((s,o)=>s+(o.total||0),0);
      html+=`<div class="day-group-label">${dayLabel} · ${fmt(dayRev)}</div>`;
      groups[key].forEach(o=>{
        const items=Array.isArray(o.items)?o.items:[];
        const t=new Date(o.created_at);
        const timeStr=fmtDate(t,true).split(' ')[1];
        const preview=items.map(i=>`${i.name}${i.qty>1?` ×${i.qty}`:''}`).join(', ')||'—';
        const mCls=o.voided?'method-void':o.method==='Tiền mặt'?'method-cash':'method-transfer';
        const mLbl=o.voided?'Đã huỷ':(o.method||'—');
        const safeId=o.id.replace(/[^a-zA-Z0-9-]/g,'');
        html+=`<div class="order-card${o.voided?' voided':''}" id="card-${safeId}">
          <div class="order-head" onclick="toggleDetail('${safeId}')">
            <span class="order-num">${o.order_num||'#?'}</span>
            <div class="order-info">
              <div class="order-time">${timeStr}</div>
              <div class="order-items-preview">${preview}</div>
            </div>
            <div class="order-right">
              <span class="order-total">${fmt(o.total||0)}</span>
              <span class="method-tag ${mCls}">${mLbl}</span>
            </div>
            <svg class="order-chevron" id="chev-${safeId}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="order-detail" id="detail-${safeId}">
            ${items.map(i=>`<div class="detail-item">
              <div>
                <div class="di-name">${i.name||'?'}</div>
                <div class="di-qty">${i.price?`${fmt(i.price)} × ${i.qty||1}`:`× ${i.qty||1}`}</div>
              </div>
              <div class="di-price">${fmt((i.price||0)*(i.qty||1))}</div>
            </div>`).join('')}
            ${o.staff_name?`<div class="detail-staff">Nhân viên: ${o.staff_name}</div>`:''}
            ${!o.voided?`<div class="detail-actions">
              ${isManager?`<button class="edit-btn" onclick="goEdit('${o.id}',event)">Sửa đơn</button>`:''}
              ${isOwner?`<button class="void-btn" onclick="promptVoid('${o.id}','${o.order_num||''}',event)">Huỷ đơn</button>`:''}
            </div>`:''}
          </div>
        </div>`;
      });
    });
    el.innerHTML=html;
  }

  function toggleDetail(safeId){
    const det=document.getElementById('detail-'+safeId);
    const chev=document.getElementById('chev-'+safeId);
    const isOpen=det.classList.contains('open');
    document.querySelectorAll('.order-detail.open').forEach(d=>d.classList.remove('open'));
    document.querySelectorAll('.order-chevron.open').forEach(c=>c.classList.remove('open'));
    if(!isOpen){det.classList.add('open');chev.classList.add('open');}
  }

  // ── EDIT ──
  function goEdit(id, e){
    if(e) e.stopPropagation();
    location.href = `edit.html?id=${id}`;
  }

  // ── VOID ──
  function promptVoid(id,num,e){
    if(e) e.stopPropagation();
    voidTargetId=id;
    document.getElementById('voidSub').textContent=`Đơn ${num} sẽ bị đánh dấu đã huỷ.`;
    document.getElementById('voidOverlay').classList.add('show');
  }
  function closeVoid(){ document.getElementById('voidOverlay').classList.remove('show'); voidTargetId=null; }
  async function confirmVoid(){
    if(!voidTargetId) return;
    const id=voidTargetId;
    closeVoid();
    try{
      await DB.update('orders',`id=eq.${id}`,{voided:true});
      const o=allOrders.find(x=>x.id===id);
      if(o) o.voided=true;
      renderSummary(); renderList();
      toast('Đã huỷ đơn');
    }catch(e){ toast('Lỗi: '+e.message); }
  }


  // Khởi tạo
  const todayStr=toDisplayDate(new Date());
  document.getElementById('cF').value=todayStr;
  document.getElementById('cT').value=todayStr;

  init();
