/* ===== admin.js — Tienda Libre ===== */

const TEMAS = [
  {id:'aurora', n:'Aurora',  sw:'linear-gradient(135deg,#ffe3ec,#ff7a59)'},
  {id:'noir',   n:'Noir',    sw:'linear-gradient(135deg,#16161a,#d4af6a)'},
  {id:'lumen',  n:'Lumen',   sw:'linear-gradient(135deg,#f1efe9,#c2410c)'},
  {id:'verano', n:'Verano',  sw:'linear-gradient(135deg,#eafcff,#1bc6c6 60%,#ff6b6b)'},
  {id:'urbano', n:'Urbano',  sw:'linear-gradient(135deg,#202125,#ff5a1f)'},
  {id:'vintage',n:'Vintage', sw:'linear-gradient(135deg,#fbeef0,#b06a78)'},
  {id:'neon',   n:'Neón',    sw:'linear-gradient(135deg,#0a0712,#ff2bd1 60%,#1fe0ff)'},
  {id:'natural',n:'Natural', sw:'linear-gradient(135deg,#eef0e2,#6a8350)'},
  {id:'premium',n:'Premium', sw:'linear-gradient(135deg,#232730,#c8cdd6)'},
  {id:'pastel', n:'Pastel',  sw:'linear-gradient(135deg,#efe7ff,#8b6ff0 60%,#ffc24b)'}
];

const $ = id => document.getElementById(id);
let editId = null;       // producto en edición
let imagenProd = '';     // base64 de la foto del producto
let logoImg = '';        // base64 del logo (si se sube)
let temaSel = 'aurora';

/* ---------- toast ---------- */
let toastT = null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2600); }

/* ---------- comprimir imagen ---------- */
function comprimirImagen(file, max, cb){
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const s = Math.min(1, max / Math.max(w, h));
      w = Math.round(w*s); h = Math.round(h*s);
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.72));
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}
function esImg(s){ return typeof s==='string' && s.indexOf('data:')===0; }

/* ===================== VISTAS ===================== */
function mostrarLogin(){ $('vistaLogin').style.display='grid'; $('vistaPanel').style.display='none'; }

async function mostrarPanel(){
  $('vistaLogin').style.display='none';
  $('vistaPanel').style.display='block';
  // Hidratar de la nube una vez por sesión, luego habilitar sync
  if (sessionStorage.getItem('tl_hidratado') !== '1') {
    try { await tlNubeCargar(); } catch(e){}
    sessionStorage.setItem('tl_hidratado','1');
  }
  tlHabilitarSync();
  pintarBarra();
  pintarConfig();
  pintarModelos();
  pintarProductos();
  // Bienvenida
  const b = sessionStorage.getItem('tl_bienvenida');
  if (b) { sessionStorage.removeItem('tl_bienvenida'); setTimeout(()=>toast('🎉 ¡Bienvenido/a! Cargá tus productos y elegí tu modelo.'), 400); }
}

function pintarBarra(){
  const logo = cfg('logo','🛍️');
  $('barLogo').innerHTML = esImg(logo) ? `<img src="${logo}">` : escHtml(logo||'🛍️');
  $('barNombre').textContent = cfg('nombre_local','Tienda Libre');
  let u=''; try { u=(obtenerLicencia()||{}).usuario||''; } catch(e){}
  $('barUser').textContent = u ? ('@'+u) : '';
  const d = diasRestantes();
  const chip = $('barLic');
  if (d===null){ chip.textContent='—'; chip.className='chip v'; }
  else { chip.textContent = d+(d===1?' día':' días'); chip.className='chip '+(d>15?'v':d>5?'a':'r'); }
}

/* ===================== PRODUCTOS ===================== */
function pintarProductos(){
  const prods = getProductos();
  // datalist de categorías
  $('catList').innerHTML = categoriasDe(prods).map(c=>`<option value="${escHtml(c)}">`).join('');
  const cont = $('listaProd');
  if (!prods.length){
    cont.innerHTML = `<div class="empty"><span class="e">📦</span>Todavía no cargaste productos.<br>Tocá "+ Agregar producto".</div>`;
    return;
  }
  cont.innerHTML = prods.map(p=>`
    <div class="prod-row">
      <div class="th">${esImg(p.imagen)?`<img src="${p.imagen}">`:'🛍️'}</div>
      <div class="pi">
        <div class="n">${escHtml(p.nombre)}${p.cat?`<span class="cat-chip">${escHtml(p.cat)}</span>`:''}${p.ultimos?'<span class="tag-ult">Últimos</span>':''}</div>
        <div class="m">${escHtml(p.marca||'')}</div>
        <div class="pr">${formatPrecio(p.precio)}</div>
      </div>
      <div class="prod-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${p.id}">✏️</button>
        <button class="btn btn-bad btn-sm" data-del="${p.id}">🗑️</button>
      </div>
    </div>`).join('');
}

function abrirProd(id){
  editId = id || null;
  imagenProd = '';
  $('extraCont').innerHTML = '';
  const p = id ? getProductos().find(x=>x.id===id) : null;
  $('prodModalTit').textContent = p ? 'Editar producto' : 'Nuevo producto';
  $('prodNombre').value = p ? (p.nombre||'') : '';
  $('prodCat').value    = p ? (p.cat||'') : '';
  $('prodMarca').value  = p ? (p.marca||'') : '';
  $('prodPrecio').value = p ? (p.precio||'') : '';
  $('prodDesc').value   = p ? (p.desc||'') : '';
  $('prodUlt').checked  = p ? !!p.ultimos : false;
  imagenProd = p ? (p.imagen||'') : '';
  $('prodPrev').innerHTML = esImg(imagenProd) ? `<img src="${imagenProd}">` : '👕';
  (p && p.extra ? p.extra : []).forEach(addExtraRow);
  $('prodFile').value = '';
  abrir('ovProd');
}

function addExtraRow(data){
  const div = document.createElement('div');
  div.className = 'extra-row';
  div.innerHTML = `<input class="ex-l" placeholder="Talle / Color..." value="${data?escHtml(data.label):''}">
    <input class="ex-v" placeholder="Valor" value="${data?escHtml(data.valor):''}">
    <button type="button" class="x" data-rmextra>×</button>`;
  $('extraCont').appendChild(div);
}

function guardarProd(){
  const nombre = $('prodNombre').value.trim();
  if (!nombre) { toast('⚠️ Poné un nombre'); return; }
  const extra = [...document.querySelectorAll('#extraCont .extra-row')].map(r=>({
    label: r.querySelector('.ex-l').value.trim(),
    valor: r.querySelector('.ex-v').value.trim()
  })).filter(e=>e.label || e.valor);

  const prod = {
    id: editId || uid(),
    nombre,
    cat: $('prodCat').value.trim(),
    marca: $('prodMarca').value.trim(),
    precio: parseFloat($('prodPrecio').value) || 0,
    desc: $('prodDesc').value.trim(),
    imagen: imagenProd || '',
    ultimos: $('prodUlt').checked,
    extra
  };
  let prods = getProductos();
  if (editId) prods = prods.map(p=>p.id===editId?prod:p);
  else prods.unshift(prod);
  setProductos(prods);
  cerrarTodo();
  pintarProductos();
  toast(editId ? '✅ Producto actualizado' : '✅ Producto agregado');
}

function eliminarProd(id){
  if (!confirm('¿Eliminar este producto?')) return;
  setProductos(getProductos().filter(p=>p.id!==id));
  pintarProductos();
  toast('Producto eliminado');
}

/* ===================== CONFIG ===================== */
function pintarConfig(){
  $('cNombre').value    = cfg('nombre_local','');
  $('cTagline').value   = cfg('tagline','');
  $('cDireccion').value = cfg('direccion','');
  $('cTelefono').value  = cfg('telefono','');
  const logo = cfg('logo','🛍️');
  logoImg = esImg(logo) ? logo : '';
  $('cLogoEmoji').value = esImg(logo) ? '' : (logo||'🛍️');
  $('cLogoPrev').innerHTML = esImg(logo) ? `<img src="${logo}">` : (logo||'🛍️');
  temaSel = cfg('tema','aurora');
}
function pintarModelos(){
  $('modelosGrid').innerHTML = TEMAS.map(t=>`
    <div class="modelo-op ${t.id===temaSel?'on':''}" data-tema="${t.id}">
      <div class="sw" style="background:${t.sw}"></div>${t.n}
    </div>`).join('');
}
function guardarConfig(){
  setCfg('nombre_local', $('cNombre').value.trim() || 'Tienda Libre');
  setCfg('tagline', $('cTagline').value.trim());
  setCfg('direccion', $('cDireccion').value.trim());
  setCfg('telefono', $('cTelefono').value.trim());
  setCfg('logo', logoImg || $('cLogoEmoji').value.trim() || '🛍️');
  setCfg('tema', temaSel);
  pintarBarra();
  toast('💾 Configuración guardada');
}

/* ===================== MODALES ===================== */
function abrir(id){ $(id).classList.add('show'); document.body.style.overflow='hidden'; }
function cerrarTodo(){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); document.body.style.overflow=''; }

/* ===================== EVENTOS ===================== */
$('loginBtn').addEventListener('click', ()=>{
  const u=$('loginUser').value, p=$('loginPass').value;
  if (loginAdmin(u,p)) { mostrarPanel(); }
  else { const e=$('loginErr'); e.textContent='⚠️ Usuario o contraseña incorrectos.'; e.style.display='block'; $('loginPass').value=''; }
});
$('loginPass').addEventListener('keydown', e=>{ if(e.key==='Enter') $('loginBtn').click(); });
$('linkActivar').addEventListener('click', ()=>abrir('ovLic'));

$('btnActivar').addEventListener('click', async ()=>{
  const code = $('inputCodigo').value.trim();
  const err=$('licErr'), msg=$('licMsg');
  err.style.display='none'; msg.textContent='Validando...';
  const ok = await activarLicencia(code);
  if (ok){
    msg.textContent='';
    let u=''; try{ u=(obtenerLicencia()||{}).usuario||''; }catch(e){}
    cerrarTodo();
    if (u) $('loginUser').value = u;
    $('loginPass').focus();
    toast('✅ Licencia activada. Entrá con tu usuario y contraseña.');
  } else {
    msg.textContent=''; err.textContent='❌ Código inválido o no encontrado.'; err.style.display='block';
  }
});

$('btnAddProd').addEventListener('click', ()=>abrirProd(null));
$('btnAddExtra').addEventListener('click', ()=>addExtraRow(null));
$('btnGuardarProd').addEventListener('click', guardarProd);
$('prodFile').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  comprimirImagen(f, 800, b64=>{ imagenProd=b64; $('prodPrev').innerHTML=`<img src="${b64}">`; });
});

$('btnGuardarConfig').addEventListener('click', guardarConfig);
$('cLogoFile').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  comprimirImagen(f, 300, b64=>{ logoImg=b64; $('cLogoPrev').innerHTML=`<img src="${b64}">`; $('cLogoEmoji').value=''; });
});
$('cLogoEmoji').addEventListener('input', e=>{ logoImg=''; const v=e.target.value.trim()||'🛍️'; $('cLogoPrev').innerHTML=escHtml(v); });

$('btnVista').addEventListener('click', ()=>window.open(getLinkTienda(), '_blank'));
$('btnSalir').addEventListener('click', logoutAdmin);

document.addEventListener('click', e=>{
  if (e.target.closest('[data-close]')) { cerrarTodo(); return; }
  if (e.target.classList.contains('overlay')) { cerrarTodo(); return; }
  const tab=e.target.closest('.tab');
  if (tab){ document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on')); tab.classList.add('on');
    document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on')); $(tab.dataset.sec).classList.add('on'); return; }
  const ed=e.target.closest('[data-edit]'); if(ed){ abrirProd(ed.dataset.edit); return; }
  const dl=e.target.closest('[data-del]');  if(dl){ eliminarProd(dl.dataset.del); return; }
  const rm=e.target.closest('[data-rmextra]'); if(rm){ rm.closest('.extra-row').remove(); return; }
  const tm=e.target.closest('[data-tema]');
  if (tm){ temaSel=tm.dataset.tema; pintarModelos(); return; }
});

/* ===================== INIT ===================== */
(function init(){
  if (isAdminLogged() && verificarLicencia()) mostrarPanel();
  else mostrarLogin();
})();
