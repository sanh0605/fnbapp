Auth.require('pos'); // tất cả roles đều vào được, nhưng chức năng bị giới hạn theo role
  const session = Auth.getSession();
  const role    = Auth.getRole();
  const isOwner = role === 'owner';
  let USERS=[], SETTINGS={};
  let editingUserId=null;

  async function init(){
    try {
      ({settings:SETTINGS, users:USERS} = await SettingsService.fetchInitData(isOwner));
      render();
    } catch(e){ document.getElementById('content').innerHTML=`<div style="text-align:center;padding:32px;color:#E24B4A;font-size:13px">Lỗi: ${e.message}</div>`; }
  }

  function render(){
    const el = document.getElementById('content');
    let html = '';

    // ── ĐỔI MẬT KHẨU (tất cả roles) ──
    html += `<div>
      <div class="section-header"><span class="section-title">Tài khoản của tôi</span></div>
      <div class="card-list" style="margin-top:8px">
        <div class="card-row" onclick="showPw()">
          <div class="card-icon" style="background:#E1F5EE">🔑</div>
          <div class="card-info">
            <div class="card-name">Đổi mật khẩu</div>
            <div class="card-sub">${session?.name} · ${role}</div>
          </div>
          <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </div>`;

    // ── QUẢN LÝ TÀI KHOẢN (owner only) ──
    if(isOwner){
      html += `<div>
        <div class="section-header">
          <span class="section-title">Quản lý tài khoản</span>
          <button class="section-add" onclick="showUser()">+ Thêm</button>
        </div>
        <div class="card-list" style="margin-top:8px">
          ${USERS.map(u=>`<div class="card-row" onclick="showUser('${u.id}')">
            <div class="card-icon" style="background:#f5f5f0">👤</div>
            <div class="card-info">
              <div class="card-name">${u.name}</div>
              <div class="card-sub">@${u.username}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="card-badge badge-${u.role}">${u.role}</span>
              ${!u.active?'<span class="card-badge badge-inactive">Khoá</span>':''}
              <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>`).join('')}
        </div>
      </div>`;
    }

    // ── MENU & SẢN PHẨM (owner only) ──
    if(isOwner){
      html += `<div>
        <div class="section-header"><span class="section-title">Menu & Sản phẩm</span></div>
        <div class="card-list" style="margin-top:8px">
          <a href="../menu/index.html" class="card-row" style="text-decoration:none;color:inherit">
            <div class="card-icon" style="background:#FAEEDA">☕</div>
            <div class="card-info">
              <div class="card-name">Quản lý Menu</div>
              <div class="card-sub">Thêm · sửa · xoá sản phẩm & công thức</div>
            </div>
            <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>
      </div>`;
    }

    // ── CÀI ĐẶT THANH TOÁN (owner only) ──
    if(isOwner){
      const bankId = SETTINGS.bank_id||'ACB';
      const accountNo = SETTINGS.account_no||'';
      const accountName = SETTINGS.account_name||'';
      const content = SETTINGS.transfer_content||'Thanh toan don hang';
      const qrUrl = accountNo && accountNo !== 'XXXXXXXXXX'
        ? `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.jpg?amount=0&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(accountName)}`
        : '';
      html += `<div>
        <div class="section-header"><span class="section-title">Thanh toán QR</span></div>
        <div class="settings-card" style="margin-top:8px">
          <div class="field"><label>Ngân hàng (Bank ID)</label>
            <select id="bankId">
              ${['ACB','VCB','TCB','MB','VPB','BIDV','CTG','STB','OCB','MSB','TPB'].map(b=>`<option value="${b}" ${bankId===b?'selected':''}>${b}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Số tài khoản</label><input type="text" id="accountNo" value="${accountNo}" placeholder="Số tài khoản"></div>
          <div class="field"><label>Tên chủ tài khoản (IN HOA, không dấu)</label><input type="text" id="accountName" value="${accountName}" placeholder="NGUYEN VAN A"></div>
          <div class="field"><label>Nội dung chuyển khoản mặc định</label><input type="text" id="transferContent" value="${content}" placeholder="Thanh toan don hang"></div>
          ${qrUrl?`<div class="qr-preview"><img src="${qrUrl}" alt="QR preview"><div style="font-size:12px;color:#888">Preview QR (số tiền thực tế sẽ điền tự động)</div></div>`:''}
          <button class="save-btn" onclick="savePaymentSettings()">Lưu cài đặt thanh toán</button>
        </div>
      </div>`;
    }

    // ── CÀI ĐẶT HỆ THỐNG (owner only) ──
    if(isOwner){
      html += `<div>
        <div class="section-header"><span class="section-title">Cài đặt hệ thống</span></div>
        <div class="settings-card" style="margin-top:8px">
          <div class="field"><label>Giờ mở bán</label>
            <select id="openHour">
              ${Array.from({length:12},(_,i)=>i+5).map(h=>`<option value="${h}" ${(SETTINGS.open_hour||'6')==String(h)?'selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Giờ đóng bán</label>
            <select id="closeHour">
              ${Array.from({length:12},(_,i)=>i+8).map(h=>`<option value="${h}" ${(SETTINGS.close_hour||'10')==String(h)?'selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Ngưỡng trễ chấp nhận (phút)</label>
            <input type="number" id="lateGrace" value="${SETTINGS.late_grace_minutes||15}" min="0" max="60">
          </div>
          <button class="save-btn" onclick="saveSystemSettings()">Lưu cài đặt hệ thống</button>
        </div>
      </div>`;
    }

    el.innerHTML = html;
  }

  // ── TÀI KHOẢN ──
  function showUser(id){
    editingUserId = id||null;
    const title = document.getElementById('userSheetTitle');
    const del = document.getElementById('delUserBtn');
    if(id){
      const u = USERS.find(x=>x.id===id);
      if(!u) return;
      title.textContent = 'Chỉnh sửa tài khoản';
      document.getElementById('uName').value = u.name;
      document.getElementById('uUsername').value = u.username;
      document.getElementById('uPassword').value = '';
      document.getElementById('uRole').value = u.role;
      document.getElementById('uActive').value = String(u.active);
      del.style.display = u.id === session?.id ? 'none' : 'block';
    } else {
      title.textContent = 'Thêm tài khoản';
      ['uName','uUsername','uPassword'].forEach(x=>document.getElementById(x).value='');
      document.getElementById('uRole').value = 'staff';
      document.getElementById('uActive').value = 'true';
      del.style.display = 'none';
    }
    document.getElementById('userOverlay').classList.add('show');
  }
  function hideUser(){ document.getElementById('userOverlay').classList.remove('show'); }

  async function saveUser(){
    const name = document.getElementById('uName').value.trim();
    const username = document.getElementById('uUsername').value.trim().toLowerCase();
    const password = document.getElementById('uPassword').value;
    const role_val = document.getElementById('uRole').value;
    const active = document.getElementById('uActive').value === 'true';
    if(!name||!username){ toast('Vui lòng nhập đầy đủ tên và tài khoản'); return; }
    try {
      if(!editingUserId && !password){ toast('Vui lòng nhập mật khẩu'); return; }
      await SettingsService.saveUser(editingUserId||null, {name,username,password,role:role_val,active});
      hideUser(); toast('✓ Đã lưu tài khoản');
      USERS = await SettingsService.fetchUsers();
      render();
    } catch(e){ toast('Lỗi: '+e.message); }
  }

  async function deleteUser(){
    if(!editingUserId) return;
    if(editingUserId === session?.id){ toast('Không thể xoá tài khoản đang đăng nhập'); return; }
    try {
      await SettingsService.deleteUser(editingUserId);
      hideUser(); toast('Đã xoá tài khoản');
      USERS = await SettingsService.fetchUsers();
      render();
    } catch(e){ toast('Lỗi: '+e.message); }
  }

  // ── ĐỔI MẬT KHẨU ──
  function showPw(){ ['pwCurrent','pwNew','pwConfirm'].forEach(x=>document.getElementById(x).value=''); document.getElementById('pwOverlay').classList.add('show'); }
  function hidePw(){ document.getElementById('pwOverlay').classList.remove('show'); }

  async function savePassword(){
    const current = document.getElementById('pwCurrent').value;
    const newPw   = document.getElementById('pwNew').value;
    const confirm = document.getElementById('pwConfirm').value;
    if(!current||!newPw||!confirm){ toast('Vui lòng điền đầy đủ'); return; }
    if(newPw !== confirm){ toast('Mật khẩu mới không khớp'); return; }
    if(newPw.length < 6){ toast('Mật khẩu tối thiểu 6 ký tự'); return; }
    try {
      const ok = await SettingsService.changePassword(session.id, current, newPw);
      if(!ok){ toast('Mật khẩu hiện tại không đúng'); return; }
      hidePw(); toast('✓ Đã đổi mật khẩu thành công');
    } catch(e){ toast('Lỗi: '+e.message); }
  }

  // ── THANH TOÁN ──
  async function savePaymentSettings(){
    const fields = {
      bank_id:          document.getElementById('bankId').value,
      account_no:       document.getElementById('accountNo').value.trim(),
      account_name:     document.getElementById('accountName').value.trim().toUpperCase(),
      transfer_content: document.getElementById('transferContent').value.trim()||'Thanh toan don hang',
    };
    try {
      await SettingsService.saveSettings(fields);
      Object.assign(SETTINGS, fields);
      toast('✓ Đã lưu cài đặt thanh toán');
      render();
    } catch(e){ toast('Lỗi: '+e.message); }
  }

  // ── HỆ THỐNG ──
  async function saveSystemSettings(){
    const fields = {
      open_hour:          document.getElementById('openHour').value,
      close_hour:         document.getElementById('closeHour').value,
      late_grace_minutes: document.getElementById('lateGrace').value,
    };
    try {
      await SettingsService.saveSettings(fields);
      Object.assign(SETTINGS, fields);
      toast('✓ Đã lưu cài đặt hệ thống');
    } catch(e){ toast('Lỗi: '+e.message); }
  }


  init();
