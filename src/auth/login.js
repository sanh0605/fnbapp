const PERMISSIONS = {
      owner:   ['pos','revenue','menu','payment_settings','user_settings'],
      manager: ['pos','revenue'],
      staff:   ['pos'],
    };

    // Nếu đã đăng nhập → về home (manager/owner) hoặc POS (staff)
    try {
      const s = JSON.parse(localStorage.getItem('fnb_session')||'null');
      if(s?.role && !(s.expires_at && Date.now() > s.expires_at * 1000)){
        window.location.href = (s.role==='staff') ? '../pos/index.html' : '../home/index.html';
      } else if(s) {
        localStorage.removeItem('fnb_session');
      }
    } catch(e){ localStorage.removeItem('fnb_session'); }

    async function login(){
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      if(!username||!password){ showError('Vui lòng nhập đầy đủ tài khoản và mật khẩu'); return; }
      showLoading(true); hideError();
      try {
        // 1. Xác thực qua Supabase Auth
        const email = `${username.toLowerCase()}@fnbapp.internal`;
        const authData = await AuthAPI.login(email, password);

        // 2. Lấy profile từ bảng users (dùng anon key — PostgREST chưa support ES256)
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${authData.user.id}&select=*`,
          { headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` } }
        );
        const profiles = await profileRes.json();
        if(!profiles?.length){ showLoading(false); showError('Tài khoản chưa được cấu hình'); return; }

        const user = profiles[0];
        if(!user.active){ showLoading(false); showError('Tài khoản đã bị khoá'); document.getElementById('password').value=''; return; }

        // 3. Lưu session kèm JWT
        Auth.setSession(user, {
          access_token:  authData.access_token,
          refresh_token: authData.refresh_token,
          expires_at:    authData.expires_at,
        });

        window.location.href = (user.role==='staff') ? '../pos/index.html' : '../home/index.html';
      } catch(e){
        showLoading(false);
        showError('Tài khoản hoặc mật khẩu không đúng');
        document.getElementById('password').value='';
      }
    }

    function togglePw(){
      const input=document.getElementById('password'),icon=document.getElementById('eyeIcon');
      if(input.type==='password'){
        input.type='text';
        icon.innerHTML=`<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
      } else {
        input.type='password';
        icon.innerHTML=`<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
      }
    }

    function showError(msg){ document.getElementById('errorText').textContent=msg; document.getElementById('errorMsg').classList.add('show'); }
    function hideError(){ document.getElementById('errorMsg').classList.remove('show'); }
    function showLoading(s){ document.getElementById('loading').classList.toggle('show',s); document.getElementById('submitBtn').style.display=s?'none':'block'; }
    document.addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
