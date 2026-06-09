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
  pintarPromosPanel();
  actualizarBtnBio();
  iniciarVentas();
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

/* ===================== PROMOS (panel) ===================== */
const PROMO_COLORS = [
  '#ff7a59,#ff3d77','#7a5bf0,#5b8bf0','#0ea5e9,#16a34a','#f59e0b,#ef4444',
  '#14b8a6,#0ea5e9','#22c55e,#16a34a','#6366f1,#a855f7','#fb923c,#f43f5e',
  '#ec4899,#8b5cf6','#0891b2,#2563eb','#1f2937,#4b5563'
];
let promoEdit = null;
let promoColor = PROMO_COLORS[0];
let promoImg = '';

function getPromos(){ try{ return JSON.parse(localStorage.getItem('promos')||'[]'); }catch(e){ return []; } }
function setPromos(arr){ localStorage.setItem('promos', JSON.stringify(arr)); }

function pintarPromosPanel(){
  const proms = getPromos();
  const cont = $('listaPromos');
  if(!proms.length){ cont.innerHTML = `<div class="empty"><span class="e">🔥</span>Todavía no creaste promos.<br>Tocá "+ Agregar promo".</div>`; return; }
  cont.innerHTML = proms.map(p=>`
    <div class="promo-li">
      <div class="sw" style="${esImg(p.imagen)?`background-image:url('${p.imagen}');background-size:cover;background-position:center`:`background:linear-gradient(135deg,${p.g||'#7a5bf0,#5b8bf0'})`}">${esImg(p.imagen)?'':escHtml(p.emoji||'🔥')}</div>
      <div class="pi">
        <div class="t">${escHtml(p.titulo||'')}</div>
        <div class="d">${escHtml(p.desc||'')}</div>
        ${p.etiqueta?`<span class="q">${escHtml(p.etiqueta)}</span>`:''}${Number(p.precio)>0?` <span class="q">🛒 ${formatPrecio(p.precio)}</span>`:''}
      </div>
      <div class="prod-actions">
        <button class="btn btn-ghost btn-sm" data-editpromo="${p.id}">✏️</button>
        <button class="btn btn-bad btn-sm" data-delpromo="${p.id}">🗑️</button>
      </div>
    </div>`).join('');
}

function renderSwatches(){
  $('promoSwatches').innerHTML = PROMO_COLORS.map(c=>
    `<div class="swatch ${c===promoColor?'on':''}" data-swatch="${c}" style="background:linear-gradient(135deg,${c})"></div>`).join('');
}
function renderPromoPreview(){
  const emoji=$('promoEmoji').value.trim()||'🔥';
  const etq=$('promoEtq').value.trim();
  const tit=$('promoTit').value.trim()||'Título de la promo';
  const desc=$('promoDesc').value.trim();
  const pv=$('promoPrev');
  if(esImg(promoImg)){
    pv.style.backgroundImage=`linear-gradient(to top,rgba(0,0,0,.6),rgba(0,0,0,.05)),url('${promoImg}')`;
    pv.style.backgroundSize='cover'; pv.style.backgroundPosition='center';
  } else {
    pv.style.backgroundImage=`linear-gradient(135deg,${promoColor})`;
  }
  pv.innerHTML = `${esImg(promoImg)?'':`<span class="pe">${escHtml(emoji)}</span>`}${etq?`<span class="pq">${escHtml(etq)}</span>`:''}<div class="pt">${escHtml(tit)}</div>${desc?`<div class="pd">${escHtml(desc)}</div>`:''}`;
  $('btnQuitarPromoFoto').style.display = esImg(promoImg)?'inline-flex':'none';
}
function abrirPromo(id){
  promoEdit = id || null;
  const p = id ? getPromos().find(x=>x.id===id) : null;
  $('promoModalTit').textContent = p ? 'Editar promo' : 'Nueva promo';
  $('promoEmoji').value = p ? (p.emoji||'🔥') : '🔥';
  $('promoEtq').value   = p ? (p.etiqueta||'') : '';
  $('promoTit').value   = p ? (p.titulo||'') : '';
  $('promoPrecio').value = p ? (p.precio||'') : '';
  $('promoDesc').value  = p ? (p.desc||'') : '';
  promoColor = (p && p.g) ? p.g : PROMO_COLORS[0];
  promoImg = p ? (p.imagen||'') : '';
  $('promoFile').value = '';
  renderSwatches(); renderPromoPreview();
  abrir('ovPromo');
}
function guardarPromo(){
  const titulo = $('promoTit').value.trim();
  if(!titulo){ toast('⚠️ Poné un título'); return; }
  const promo = {
    id: promoEdit || ('pr'+Date.now().toString(36)),
    emoji: $('promoEmoji').value.trim()||'🔥',
    etiqueta: $('promoEtq').value.trim(),
    titulo, desc: $('promoDesc').value.trim(), g: promoColor, imagen: promoImg||'', precio: Number($('promoPrecio').value)||0
  };
  let proms = getPromos();
  if(promoEdit) proms = proms.map(p=>p.id===promoEdit?promo:p);
  else proms.unshift(promo);
  setPromos(proms);
  cerrarTodo(); pintarPromosPanel();
  toast(promoEdit?'✅ Promo actualizada':'✅ Promo agregada');
}
function eliminarPromo(id){
  if(!confirm('¿Eliminar esta promo?')) return;
  setPromos(getPromos().filter(p=>p.id!==id));
  pintarPromosPanel();
  toast('Promo eliminada');
}

/* ===================== QR / COMPARTIR ===================== */
function abrirQR(){
  const link = getLinkTienda();
  $('qrLink').textContent = link;
  const box = $('qrBox'); box.innerHTML = '';
  if (typeof QRCode !== 'undefined'){
    new QRCode(box, { text: link, width: 224, height: 224, correctLevel: QRCode.CorrectLevel.M });
  } else {
    box.innerHTML = '<img alt="QR" width="224" height="224" src="https://api.qrserver.com/v1/create-qr-code/?size=224x224&data='+encodeURIComponent(link)+'">';
  }
  abrir('ovQR');
}
function descargarQR(){
  const box = $('qrBox');
  const canvas = box.querySelector('canvas');
  const img = box.querySelector('img');
  let url = '';
  if (canvas) { try{ url = canvas.toDataURL('image/png'); }catch(e){} }
  if (!url && img) url = img.src;
  if (!url) { toast('No se pudo generar la imagen'); return; }
  const a = document.createElement('a');
  a.href = url; a.download = 'qr-tienda.png';
  document.body.appendChild(a); a.click(); a.remove();
}
async function copiarLink(){
  try { await navigator.clipboard.writeText(getLinkTienda()); toast('🔗 Link copiado'); }
  catch(e){ toast('Copialo desde el texto de arriba 🙂'); }
}

/* ===================== VENTAS ===================== */
let ventasCache = [];
let _ventasIds = null;     // Set de ids conocidos (null = primera carga, no avisar)
let _ventasTimer = null;

function fmtFechaCorta(ts){
  try{ const d=new Date(ts);
    return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  }catch(e){ return ''; }
}

async function refrescarVentasNube(){
  const codigo = _tlCodigo();
  if (!codigo) return;
  try{
    const res = await fetch(
      `${SB_URL}/rest/v1/tiendalibre_backups?tenant_id=eq.${encodeURIComponent(codigo)}&select=datos&limit=1`,
      { cache:'no-store', headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } });
    if (!res.ok) return;
    const rows = await res.json();
    let ventas = [];
    if (rows && rows.length && rows[0].datos){
      try{ ventas = JSON.parse(rows[0].datos.ventas || '[]'); }catch(e){ ventas = []; }
    }
    ventas.sort((a,b)=>(b.fecha||0)-(a.fecha||0));
    const ids = new Set(ventas.map(v=>v.id));
    if (_ventasIds !== null){
      const nuevas = ventas.filter(v=>!_ventasIds.has(v.id));
      if (nuevas.length){
        toast('🔔 ¡Nuevo encargo! Código '+nuevas[0].codigo);
        $('tabVentas').classList.add('has-new');
      }
    }
    _ventasIds = ids;
    ventasCache = ventas;
    pintarVentas();
    actualizarBadgeVentas();
  }catch(e){ console.warn('ventas:', e); }
}

function actualizarBadgeVentas(){
  const pend = ventasCache.filter(v=>(v.estado||'pendiente')==='pendiente').length;
  const b = $('ventasBadge');
  if (pend>0){ b.textContent=pend; b.style.display='inline-grid'; }
  else b.style.display='none';
}

function pintarVentas(){
  const cont = $('listaVentas');
  if (!ventasCache.length){
    cont.innerHTML = `<div class="empty"><span class="e">🛍️</span>Todavía no hay encargos.<br>Cuando un cliente confirme uno, aparece acá.</div>`;
    return;
  }
  const lbl = {pendiente:'⏳ Pendiente', listo:'✅ Listo para retirar', entregado:'📦 Entregado'};
  cont.innerHTML = ventasCache.map(v=>{
    const est = v.estado || 'pendiente';
    const items = (v.items||[]).map(i=>`${i.cantidad}× ${escHtml(i.nombre)}`).join(' · ');
    const tel = (v.cliente && v.cliente.telefono) || '';
    const telLink = tel ? `<a href="https://wa.me/${tel.replace(/\D/g,'')}" target="_blank">📞 ${escHtml(tel)}</a>` : '';
    const via = (v.cliente && v.cliente.via==='email') ? `✉️ ${escHtml(v.cliente.email||'')}` : '🟢 WhatsApp';
    let acc = '';
    if (est!=='listo')     acc += `<button class="btn btn-soft btn-sm" data-vest="${v.id}|listo">✅ Listo</button>`;
    if (est!=='entregado') acc += `<button class="btn btn-sm" data-vest="${v.id}|entregado">📦 Entregado</button>`;
    if (est!=='pendiente') acc += `<button class="btn btn-ghost btn-sm" data-vest="${v.id}|pendiente">↩️ Reabrir</button>`;
    return `<div class="venta-card e-${est}">
      <div class="vc-top"><span class="vc-cod">${escHtml(v.codigo)}</span><span class="vc-est ${est}">${lbl[est]||est}</span></div>
      <div class="vc-cli">👤 <b>${escHtml((v.cliente&&v.cliente.nombre)||'')}</b> · ${telLink} · <span style="color:var(--muted)">${via}</span></div>
      <div class="vc-items">${items}</div>
      <div class="vc-foot"><span class="vc-total">Total: <b>${formatPrecio(v.total)}</b></span><span class="vc-fecha">${fmtFechaCorta(v.fecha)}</span></div>
      <div class="vc-acc">${acc}</div>
    </div>`;
  }).join('');
}

async function cambiarEstadoVenta(id, estado){
  const codigo = _tlCodigo();
  if (!codigo) return;
  ventasCache = ventasCache.map(v=>v.id===id?Object.assign({}, v, {estado}):v);
  pintarVentas(); actualizarBadgeVentas();
  try{
    const res = await fetch(
      `${SB_URL}/rest/v1/tiendalibre_backups?tenant_id=eq.${encodeURIComponent(codigo)}&select=datos&limit=1`,
      { cache:'no-store', headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } });
    let datos = {};
    if (res.ok){ const rows = await res.json(); if (rows && rows.length && rows[0].datos) datos = rows[0].datos; }
    let ventas = [];
    try{ ventas = JSON.parse(datos.ventas || '[]'); }catch(e){ ventas = []; }
    ventas = ventas.map(v=>v.id===id?Object.assign({}, v, {estado}):v);
    datos.ventas = JSON.stringify(ventas);
    await fetch(`${SB_URL}/rest/v1/tiendalibre_backups`, {
      method:'POST',
      headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates' },
      body: JSON.stringify({ tenant_id:codigo, datos, updated_at:new Date().toISOString() })
    });
  }catch(e){ console.warn('estado venta:', e); toast('⚠️ No se pudo guardar el cambio'); }
}

function iniciarVentas(){
  refrescarVentasNube();
  if (_ventasTimer) clearInterval(_ventasTimer);
  _ventasTimer = setInterval(refrescarVentasNube, 20000);
}

/* ===================== MODALES ===================== */
function abrir(id){ $(id).classList.add('show'); document.body.style.overflow='hidden'; }
function cerrarTodo(){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); document.body.style.overflow=''; }

/* ===================== SEGURIDAD (huella / PIN del celular) ===================== */
function bioDisponible(){ return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create); }
function bioActivado(){ return localStorage.getItem('tl_bio') === '1'; }
function _b64(buf){ let s=''; const b=new Uint8Array(buf); for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
function _unb64(s){ return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); }

async function bioRegistrar(){
  if(!bioDisponible()) return false;
  try{
    const cred = await navigator.credentials.create({ publicKey:{
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp:{ name:'Tienda Libre' },
      user:{ id: crypto.getRandomValues(new Uint8Array(16)), name:(localStorage.getItem('admin_user')||'admin'), displayName:'Admin' },
      pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
      authenticatorSelection:{ authenticatorAttachment:'platform', userVerification:'required' },
      timeout:60000
    }});
    if(!cred) return false;
    localStorage.setItem('tl_bio_id', _b64(cred.rawId));
    localStorage.setItem('tl_bio','1');
    return true;
  }catch(e){ console.warn('bio reg:', e); return false; }
}

async function bioVerificar(){
  if(!bioActivado()) return true;
  if(!bioDisponible()) return true;       // si el equipo no lo soporta, no bloqueamos
  const idb = localStorage.getItem('tl_bio_id');
  try{
    await navigator.credentials.get({ publicKey:{
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      timeout:60000, userVerification:'required',
      allowCredentials: idb ? [{ type:'public-key', id:_unb64(idb) }] : []
    }});
    return true;
  }catch(e){ console.warn('bio ver:', e); return false; }
}

function actualizarBtnBio(){
  const b=$('btnBio'); if(!b) return;
  b.textContent = bioActivado() ? 'Desactivar' : 'Activar';
}
async function toggleBio(){
  if(bioActivado()){
    localStorage.removeItem('tl_bio'); localStorage.removeItem('tl_bio_id');
    toast('Bloqueo desactivado'); actualizarBtnBio(); return;
  }
  if(!bioDisponible()){ toast('Tu navegador/equipo no permite huella o PIN'); return; }
  const ok = await bioRegistrar();
  toast(ok ? '🔒 Bloqueo activado' : 'No se pudo activar (probá desde el celular)');
  actualizarBtnBio();
}

/* ===================== EVENTOS ===================== */
$('loginBtn').addEventListener('click', async ()=>{
  const u=$('loginUser').value, p=$('loginPass').value;
  if (!loginAdmin(u,p)){
    const e=$('loginErr'); e.textContent='⚠️ Usuario o contraseña incorrectos.'; e.style.display='block'; $('loginPass').value=''; return;
  }
  if (bioActivado()){
    const ok = await bioVerificar();
    if(!ok){
      sessionStorage.removeItem('tl_logged');
      const e=$('loginErr'); e.textContent='🔒 No se pudo verificar tu huella/PIN. Probá de nuevo.'; e.style.display='block'; return;
    }
  }
  mostrarPanel();
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
$('btnRefVentas').addEventListener('click', refrescarVentasNube);
$('btnAddPromo').addEventListener('click', ()=>abrirPromo(null));
$('btnGuardarPromo').addEventListener('click', guardarPromo);
['promoEmoji','promoEtq','promoTit','promoDesc'].forEach(id=>$(id).addEventListener('input', renderPromoPreview));
$('promoFile').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  comprimirImagen(f, 700, b64=>{ promoImg=b64; renderPromoPreview(); });
});
$('btnQuitarPromoFoto').addEventListener('click', ()=>{ promoImg=''; $('promoFile').value=''; renderPromoPreview(); });
$('btnQR').addEventListener('click', abrirQR);
$('btnQRDesc').addEventListener('click', descargarQR);
$('btnQRCopy').addEventListener('click', copiarLink);
$('btnBio').addEventListener('click', toggleBio);

document.addEventListener('click', e=>{
  if (e.target.closest('[data-close]')) { cerrarTodo(); return; }
  if (e.target.classList.contains('overlay')) { cerrarTodo(); return; }
  const tab=e.target.closest('.tab');
  if (tab){ document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on')); tab.classList.add('on');
    document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on')); $(tab.dataset.sec).classList.add('on');
    if (tab.dataset.sec==='secVentas') tab.classList.remove('has-new');
    return; }
  const ve=e.target.closest('[data-vest]'); if(ve){ const a=ve.dataset.vest.split('|'); cambiarEstadoVenta(a[0], a[1]); return; }
  const epr=e.target.closest('[data-editpromo]'); if(epr){ abrirPromo(epr.dataset.editpromo); return; }
  const dpr=e.target.closest('[data-delpromo]'); if(dpr){ eliminarPromo(dpr.dataset.delpromo); return; }
  const sw=e.target.closest('[data-swatch]'); if(sw){ promoColor=sw.dataset.swatch; renderSwatches(); renderPromoPreview(); return; }
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
