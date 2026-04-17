Auth.require('menu');

  let PRODUCTS=[], RAW_MATERIALS=[], SEMI_PRODUCTS=[], SUPPLIES=[];
  let editingProductId=null, currentRecipes=[];

  async function init(){
    try {
      [PRODUCTS, RAW_MATERIALS, SEMI_PRODUCTS, SUPPLIES] = await Promise.all([
        DB.select('products','select=*&order=sort_order.asc'),
        DB.select('raw_materials','select=*&order=name.asc'),
        DB.select('semi_products','select=*&order=name.asc'),
        DB.select('supplies','select=*&order=name.asc'),
      ]);
      render();
    } catch(e){
      document.getElementById('content').innerHTML=`<div class="empty">Lỗi: ${e.message}</div>`;
    }
  }

  function render(){
    const el = document.getElementById('content');
    if(!PRODUCTS.length){ el.innerHTML='<div class="empty">Chưa có sản phẩm nào</div>'; return; }
    el.innerHTML = `<div class="card-list">
      ${PRODUCTS.map(p=>`<div class="card-row" onclick="showProduct('${p.id}')">
        <div class="card-icon" style="background:${p.color||'#f5f5f0'}">${p.icon||'☕'}</div>
        <div class="card-info">
          <div class="card-name">${p.name}</div>
          <div class="card-sub">${fmt(p.price)} · ${p.category}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="card-badge ${p.active?'badge-active':'badge-inactive'}">${p.active?'Đang bán':'Tạm ngưng'}</span>
          <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`).join('')}
    </div>`;
  }

  async function showProduct(id){
    editingProductId = id||null;
    const title = document.getElementById('productSheetTitle');
    const del   = document.getElementById('delProductBtn');
    if(id){
      const p = PRODUCTS.find(x=>x.id===id);
      if(!p) return;
      title.textContent = 'Chỉnh sửa sản phẩm';
      document.getElementById('pName').value     = p.name;
      document.getElementById('pCategory').value = p.category;
      document.getElementById('pPrice').value    = p.price;
      document.getElementById('pIcon').value     = p.icon;
      document.getElementById('pColor').value    = p.color;
      document.getElementById('pActive').value   = String(p.active);
      const recipes = await DB.select('product_recipes', `product_id=eq.${id}&select=*`);
      currentRecipes = recipes.map(r=>({...r}));
      del.style.display = 'block';
    } else {
      title.textContent = 'Thêm sản phẩm';
      ['pName','pCategory','pIcon','pColor'].forEach(x=>document.getElementById(x).value='');
      document.getElementById('pPrice').value  = '';
      document.getElementById('pActive').value = 'true';
      currentRecipes = [];
      del.style.display = 'none';
    }
    renderRecipeEditor();
    document.getElementById('productOverlay').classList.add('show');
  }
  function hideProduct(){ document.getElementById('productOverlay').classList.remove('show'); }

  function getIngUnit(ingredient_id, ingredient_type){
    if(ingredient_type==='semi')   return SEMI_PRODUCTS.find(x=>x.id===ingredient_id)?.unit||'';
    if(ingredient_type==='raw')    return RAW_MATERIALS.find(x=>x.id===ingredient_id)?.unit||'';
    if(ingredient_type==='supply') return SUPPLIES.find(x=>x.id===ingredient_id)?.unit||'';
    return '';
  }

  function renderRecipeEditor(){
    const el = document.getElementById('recipeEditor');
    const dropdownIngredients = [
      ...SEMI_PRODUCTS.filter(s=>s.id!=='nuoc_duong').map(s=>({id:s.id, name:s.name, type:'semi', unit:s.unit})),
      ...RAW_MATERIALS.map(r=>({id:r.id, name:r.name, type:'raw', unit:r.unit})),
    ];
    window._dropdownIngredients = dropdownIngredients;
    el.innerHTML =
      currentRecipes.map((r,i)=>{
        const unit = getIngUnit(r.ingredient_id, r.ingredient_type);
        return `<div class="recipe-row">
          <div class="recipe-name">
            <select onchange="const ing=window._dropdownIngredients.find(x=>x.id===this.value);currentRecipes[${i}].ingredient_id=this.value;currentRecipes[${i}].ingredient_type=ing?.type||'semi';renderRecipeEditor()"
              style="width:100%;padding:4px 6px;border:0.5px solid #e8e6e0;border-radius:6px;font-size:12px;font-family:inherit">
              ${dropdownIngredients.map(ing=>`<option value="${ing.id}" ${r.ingredient_id===ing.id?'selected':''}>${ing.name} (${ing.unit})</option>`).join('')}
            </select>
          </div>
          <div class="recipe-inputs">
            <input type="number" value="${r.amount}" min="0" step="any" onchange="currentRecipes[${i}].amount=parseFloat(this.value)||0">
            <span class="recipe-unit">${unit}</span>
            <button onclick="currentRecipes.splice(${i},1);renderRecipeEditor()"
              style="width:24px;height:24px;border-radius:50%;border:none;background:#e8e6e0;cursor:pointer;font-size:14px;color:#888;display:flex;align-items:center;justify-content:center">×</button>
          </div>
        </div>`;
      }).join('')+
      `<button onclick="const f=window._dropdownIngredients[0];currentRecipes.push({ingredient_id:f?.id||'',ingredient_type:f?.type||'semi',amount:0});renderRecipeEditor()"
        style="width:100%;padding:8px;border:0.5px dashed #d8d6d0;border-radius:10px;background:transparent;font-size:13px;color:#888;cursor:pointer;font-family:inherit;margin-top:4px">+ Thêm nguyên liệu</button>`;
  }

  async function saveProduct(){
    const name     = document.getElementById('pName').value.trim();
    const category = document.getElementById('pCategory').value.trim();
    const price    = parseInt(document.getElementById('pPrice').value)||0;
    const icon     = document.getElementById('pIcon').value.trim()||'☕';
    const color    = document.getElementById('pColor').value.trim()||'#FAEEDA';
    const active   = document.getElementById('pActive').value === 'true';
    if(!name||!category){ toast('Vui lòng nhập tên và danh mục'); return; }
    try {
      let productId = editingProductId;
      if(editingProductId){
        await DB.update('products', `id=eq.${editingProductId}`, {name,category,price,icon,color,active});
        await DB.delete('product_recipes', `product_id=eq.${editingProductId}`);
      } else {
        const res = await DB.insert('products', {name,category,price,icon,color,active,sort_order:PRODUCTS.length+1});
        productId = res[0].id;
      }
      for(const r of currentRecipes.filter(x=>x.ingredient_id&&x.amount>0)){
        const allIng = [...SEMI_PRODUCTS.map(s=>({id:s.id,unit:s.unit,type:'semi'})),...RAW_MATERIALS.map(x=>({id:x.id,unit:x.unit,type:'raw'}))];
        const ing = allIng.find(x=>x.id===r.ingredient_id);
        await DB.insert('product_recipes',{product_id:productId,ingredient_id:r.ingredient_id,ingredient_type:r.ingredient_type||ing?.type||'semi',amount:r.amount,unit:ing?.unit||''},false);
      }
      hideProduct(); toast('✓ Đã lưu sản phẩm');
      PRODUCTS = await DB.select('products','select=*&order=sort_order.asc');
      render();
    } catch(e){ toast('Lỗi: '+e.message); }
  }

  async function deleteProduct(){
    if(!editingProductId) return;
    try {
      await DB.delete('products', `id=eq.${editingProductId}`);
      hideProduct(); toast('Đã xoá sản phẩm');
      PRODUCTS = await DB.select('products','select=*&order=sort_order.asc');
      render();
    } catch(e){ toast('Lỗi: '+e.message); }
  }


  init();
