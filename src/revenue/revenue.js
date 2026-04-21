Auth.require('revenue');
  const session = Auth.getSession();
  let brandFilter = ''; // '' = owner thấy tất cả; 'brand_id=eq.xxx' = manager chỉ thấy brand của mình

  async function initBrandFilter(){
    if(Auth.getRole() !== 'manager') return;
    try {
      const userRows = await DB.select('users', `id=eq.${session.id}&select=outlet_id`);
      const outletId = userRows?.[0]?.outlet_id;
      if(!outletId) return;
      const outletRows = await DB.select('outlets', `id=eq.${outletId}&select=brand_id`);
      const brandId = outletRows?.[0]?.brand_id;
      if(brandId) brandFilter = `&brand_id=eq.${brandId}`;
    } catch(e){ console.warn('Không lấy được brand filter:', e); }
  }

  const DOW=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  const toISO=d=>d.toISOString();
  let period='day',cursor=new Date(),customFrom=null,customTo=null,chartInstance=null;
  cursor.setHours(0,0,0,0);

  function getRange(){
    const d=new Date(cursor);
    let from,to;
    if(period==='day'){from=new Date(d);from.setHours(0,0,0,0);to=new Date(d);to.setHours(23,59,59,999);}
    else if(period==='week'){const day=d.getDay(),diff=day===0?-6:1-day;from=new Date(d);from.setDate(d.getDate()+diff);from.setHours(0,0,0,0);to=new Date(from);to.setDate(from.getDate()+6);to.setHours(23,59,59,999);}
    else if(period==='month'){from=new Date(d.getFullYear(),d.getMonth(),1);to=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999);}
    else if(period==='year'){from=new Date(d.getFullYear(),0,1);to=new Date(d.getFullYear(),11,31,23,59,59,999);}
    else{from=customFrom||new Date(d);from.setHours(0,0,0,0);to=customTo||new Date(d);to.setHours(23,59,59,999);}
    return{from,to};
  }

  function setPeriod(p){
    period=p;
    ['day','week','month','year','custom'].forEach(x=>document.getElementById('p-'+x).classList.toggle('active',x===p));
    document.getElementById('dateNav').style.display=p==='custom'?'none':'flex';
    cursor=new Date();cursor.setHours(0,0,0,0);
    loadAndRender();
  }
  function shiftPeriod(dir){
    if(period==='day') cursor.setDate(cursor.getDate()+dir);
    else if(period==='week') cursor.setDate(cursor.getDate()+dir*7);
    else if(period==='month') cursor.setMonth(cursor.getMonth()+dir);
    else if(period==='year') cursor.setFullYear(cursor.getFullYear()+dir);
    loadAndRender();
  }
  function goToday(){cursor=new Date();cursor.setHours(0,0,0,0);loadAndRender();}
  function applyCustom(){
    const f=document.getElementById('cF').value,t=document.getElementById('cT').value;
    if(!f||!t)return;
    customFrom=new Date(f);customFrom.setHours(0,0,0,0);
    customTo=new Date(t);customTo.setHours(23,59,59,999);
    loadAndRender();
  }
  function updateDateLabel(){
    const{from,to}=getRange();
    let label='';
    if(period==='day') label=`${DOW[from.getDay()]}, ${fmtDate(from)}`;
    else if(period==='week') label=`${fmtDate(from).slice(0,5)} — ${fmtDate(to)}`;
    else if(period==='month') label=`${String(from.getMonth()+1).padStart(2,'0')}/${from.getFullYear()}`;
    else if(period==='year') label=`Năm ${from.getFullYear()}`;
    document.getElementById('dateLabel').textContent=label;
  }
  function toDateInput(d){const dd=new Date(d);return `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}-${String(dd.getDate()).padStart(2,'0')}`;}

  async function loadAndRender(){
    updateDateLabel();
    document.getElementById('content').innerHTML='<div class="empty">Đang tải...</div>';
    const{from,to}=getRange();
    try {
      const orders=await RevenueService.fetchOrders(from,to,brandFilter);
      render(orders,from,to);
    } catch(e){
      document.getElementById('content').innerHTML=`<div class="empty">Lỗi: ${e.message}</div>`;
    }
  }

  function render(orders,from,to){
    const revenue=orders.reduce((s,o)=>s+o.total,0);
    const orderCount=orders.length;
    const avg=orderCount>0?Math.round(revenue/orderCount):0;
    const el=document.getElementById('content');
    let customHTML='';
    if(period==='custom') customHTML=`<div class="custom-row">
      <input type="date" id="cF" value="${toDateInput(customFrom||new Date())}">
      <span style="font-size:13px;color:#888">—</span>
      <input type="date" id="cT" value="${toDateInput(customTo||new Date())}">
      <button class="custom-apply" onclick="applyCustom()">Xem</button>
    </div>`;
    el.innerHTML=customHTML+`
      <div class="metrics-grid">
        <div class="metric-card full">
          <div class="metric-label">Doanh thu</div>
          <div class="metric-value green">${fmt(revenue)}</div>
          <div class="metric-sub">${orderCount} đơn hàng</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Số đơn</div>
          <div class="metric-value">${orderCount.toLocaleString('en-US')}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Trung bình/đơn</div>
          <div class="metric-value" style="font-size:16px">${orderCount>0?fmt(avg):'—'}</div>
        </div>
      </div>
      <div id="paymentSlot"></div>
      <div id="chartSlot"></div>
      <div id="tableSlot"></div>`;
    renderPaymentBreakdown(orders,revenue);
    renderChart(orders,from,to);
    renderTable(orders,revenue);
  }

  function renderPaymentBreakdown(orders, totalRevenue){
    const slot = document.getElementById('paymentSlot');
    if(!slot) return;
    if(!orders.length){ slot.innerHTML=''; return; }

    const methods = ['Tiền mặt','Chuyển khoản'];
    const stats = methods.map(m => {
      const filtered = orders.filter(o => o.method === m);
      return { method: m, count: filtered.length, rev: filtered.reduce((s,o)=>s+o.total,0) };
    });

    const rows = stats.map(s => {
      const pct = totalRevenue > 0 ? Math.round(s.rev / totalRevenue * 100) : 0;
      const barW = totalRevenue > 0 ? Math.round(s.rev / totalRevenue * 100) : 0;
      const icon = s.method === 'Tiền mặt' ? '💵' : '💳';
      return `<div class="table-row" style="flex-direction:column;align-items:stretch;gap:4px">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="tr-icon">${icon}</span>
          <div class="tr-info">
            <div class="tr-name">${s.method}</div>
            <div class="tr-qty">${s.count} đơn</div>
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:auto">
            <div class="tr-revenue">${fmt(s.rev)}</div>
            <div class="tr-pct">${pct}%</div>
          </div>
        </div>
        <div style="height:4px;background:#f0f0ec;border-radius:4px">
          <div style="height:100%;width:${barW}%;background:#1D9E75;border-radius:4px"></div>
        </div>
      </div>`;
    }).join('');

    slot.innerHTML=`<div class="table-card">
      <div class="table-header">
        <span class="table-title">Hình thức thanh toán</span>
        <span style="font-size:12px;color:#888">${orders.length} đơn</span>
      </div>
      ${rows}
    </div>`;
  }

  function renderChart(orders,from,to){
    const slot=document.getElementById('chartSlot');
    if(!slot)return;
    let labels=[],data=[];
    if(period==='day'){
      for(let h=6;h<=10;h++){
        labels.push(String(h).padStart(2,'0')+':00');
        data.push(orders.filter(o=>{const d=new Date(o.created_at);return d.getHours()===h&&d.getMinutes()<30;}).reduce((s,o)=>s+o.total,0));
        if(h<10){labels.push(String(h).padStart(2,'0')+':30');data.push(orders.filter(o=>{const d=new Date(o.created_at);return d.getHours()===h&&d.getMinutes()>=30;}).reduce((s,o)=>s+o.total,0));}
      }
    } else if(period==='week'){
      ['T2','T3','T4','T5','T6','T7','CN'].forEach((d,i)=>{
        labels.push(d);
        const start=new Date(from);start.setDate(from.getDate()+i);
        data.push(orders.filter(o=>new Date(o.created_at).toDateString()===start.toDateString()).reduce((s,o)=>s+o.total,0));
      });
    } else if(period==='month'){
      const days=new Date(from.getFullYear(),from.getMonth()+1,0).getDate();
      for(let i=1;i<=days;i++){labels.push(String(i));data.push(orders.filter(o=>new Date(o.created_at).getDate()===i).reduce((s,o)=>s+o.total,0));}
    } else {
      ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'].forEach((m,i)=>{
        labels.push(m);data.push(orders.filter(o=>new Date(o.created_at).getMonth()===i).reduce((s,o)=>s+o.total,0));
      });
    }
    slot.innerHTML=`<div class="chart-card"><div class="chart-title">Biểu đồ doanh thu</div><div class="chart-wrap"><canvas id="rChart"></canvas></div></div>`;
    if(chartInstance) chartInstance.destroy();
    const ctx=document.getElementById('rChart');
    if(!ctx)return;
    chartInstance=new Chart(ctx,{type:'bar',data:{labels,datasets:[{data,backgroundColor:data.map(v=>v>0?'#1D9E75':'#e8e6e0'),borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.parsed.y)}}},scales:{x:{grid:{display:false},ticks:{font:{size:10},color:'#888',maxRotation:0}},y:{display:false,grid:{display:false}}}}});
  }

  function renderTable(orders,totalRevenue){
    const slot=document.getElementById('tableSlot');
    if(!slot)return;
    // Aggregate trực tiếp từ items trong đơn, không phụ thuộc MENU id
    const map={};
    orders.forEach(o=>{
      (o.items||[]).forEach(i=>{
        const name=i.name||'?';
        if(!map[name]) map[name]={name,icon:i.icon||'☕',qty:0,rev:0};
        map[name].qty+=(i.qty||1);
        map[name].rev+=(i.price||0)*(i.qty||1);
      });
    });
    const summary=Object.values(map).filter(i=>i.qty>0).sort((a,b)=>b.rev-a.rev);
    if(!summary.length){slot.innerHTML='<div class="empty">Chưa có đơn hàng nào</div>';return;}
    slot.innerHTML=`<div class="table-card">
      <div class="table-header">
        <span class="table-title">Sản phẩm bán chạy</span>
        <span style="font-size:12px;color:#888">${summary.length} món</span>
      </div>
      ${summary.map((item,i)=>{
        const pct=totalRevenue>0?Math.round(item.rev/totalRevenue*100):0;
        const barW=totalRevenue>0?Math.round(item.rev/summary[0].rev*100):0;
        return `<div class="table-row" style="flex-direction:column;align-items:stretch;gap:4px">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="tr-rank">${i+1}</span>
            <span class="tr-icon">${item.icon}</span>
            <div class="tr-info"><div class="tr-name">${item.name}</div><div class="tr-qty">${item.qty.toLocaleString('en-US')} ly</div></div>
            <div style="text-align:right;flex-shrink:0">
              <div class="tr-revenue">${fmt(item.rev)}</div>
              <div class="tr-pct">${pct}%</div>
            </div>
          </div>
          <div style="height:4px;background:#f0f0ec;border-radius:4px;margin-left:46px">
            <div style="height:100%;width:${barW}%;background:#1D9E75;border-radius:4px"></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  async function exportXLSX(){
    const{from,to}=getRange();
    const orders=await RevenueService.fetchOrders(from,to,brandFilter);
    if(!orders.length){alert('Không có dữ liệu');return;}

    const wb=XLSX.utils.book_new();

    // ── Sheet 1: Danh sách đơn hàng ──
    const orderRows=[['Thời gian','Đơn số','Tổng tiền (đ)','Chiết khấu (đ)','Thực thu (đ)','Hình thức','Nhân viên','Món']];
    orders.forEach(o=>{
      const items=(o.items||[]).map(i=>`${i.name} x${i.qty||1}`).join('; ');
      orderRows.push([
        fmtDate(new Date(o.created_at),true),
        o.order_num||'',
        o.total||0,
        o.discount_amount||0,
        o.actual_received||o.total||0,
        o.method||'',
        o.staff_name||'',
        items
      ]);
    });
    const ws1=XLSX.utils.aoa_to_sheet(orderRows);
    // Căn độ rộng cột tự động
    ws1['!cols']=[{wch:18},{wch:10},{wch:14},{wch:14},{wch:14},{wch:12},{wch:14},{wch:50}];
    XLSX.utils.book_append_sheet(wb,ws1,'Đơn hàng');

    // ── Sheet 2: Tổng hợp theo sản phẩm ──
    const map={};
    orders.forEach(o=>{
      (o.items||[]).forEach(i=>{
        const name=i.name||'?';
        if(!map[name])map[name]={name,qty:0,rev:0};
        map[name].qty+=(i.qty||1);
        map[name].rev+=(i.price||0)*(i.qty||1);
      });
    });
    const summary=Object.values(map).sort((a,b)=>b.rev-a.rev);
    const totalRev=orders.reduce((s,o)=>s+(o.total||0),0);
    const prodRows=[['Thứ hạng','Sản phẩm','Số lượng (ly)','Doanh thu (đ)','Tỷ trọng (%)']];
    summary.forEach((item,i)=>{
      const pct=totalRev>0?Math.round(item.rev/totalRev*1000)/10:0;
      prodRows.push([i+1,item.name,item.qty,item.rev,pct]);
    });
    const ws2=XLSX.utils.aoa_to_sheet(prodRows);
    ws2['!cols']=[{wch:10},{wch:22},{wch:16},{wch:16},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws2,'Sản phẩm');

    // ── Sheet 3: Hình thức thanh toán ──
    const methods=['Tiền mặt','Chuyển khoản'];
    const totalRevXLSX=orders.reduce((s,o)=>s+(o.total||0),0);
    const payRows=[['Hình thức','Số đơn','Doanh thu (đ)','Tỷ trọng (%)']];
    methods.forEach(m=>{
      const filtered=orders.filter(o=>o.method===m);
      const rev=filtered.reduce((s,o)=>s+(o.total||0),0);
      const pct=totalRevXLSX>0?Math.round(rev/totalRevXLSX*1000)/10:0;
      payRows.push([m,filtered.length,rev,pct]);
    });
    const ws3=XLSX.utils.aoa_to_sheet(payRows);
    ws3['!cols']=[{wch:16},{wch:10},{wch:16},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws3,'Hình thức TT');

    // Xuất file
    const label=period==='day'?toDateInput(from)
      :period==='week'?`${toDateInput(from)}_${toDateInput(to)}`
      :period==='month'?`${String(from.getMonth()+1).padStart(2,'0')}-${from.getFullYear()}`
      :`nam-${from.getFullYear()}`;
    XLSX.writeFile(wb,`doanh-thu-${label}.xlsx`);
  }

  initBrandFilter().then(() => loadAndRender());
