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

/* ---------- rol / usuario actual ---------- */
function rolActual(){ return sessionStorage.getItem('tl_rol') || 'dueno'; }
function esDueno(){ return rolActual() !== 'colab'; }
function nombreUsuario(){ return sessionStorage.getItem('tl_user') || 'Dueño'; }

/* Si llega ?equipo=CODIGO, este equipo queda asociado al local (sin credenciales de dueño).
   IMPORTANTE: no pisa la licencia del dueño si ya existe, y guarda el formato JSON correcto. */
(function(){
  try{
    const eq = new URLSearchParams(location.search).get('equipo');
    if (!eq) return;
    let cur = null;
    try { cur = JSON.parse(localStorage.getItem('tl_licencia') || 'null'); } catch(e){}
    if (cur && cur.codigo) return;   // ya hay una licencia con código (dueño): NO tocar
    localStorage.setItem('tl_licencia', JSON.stringify({
      codigo: eq.trim().toUpperCase(), valida: true, equipo: true
    }));
  }catch(e){}
})();

function aplicarRol(){
  const dueno = esDueno();
  const tabEq = $('tabEquipo'); if (tabEq) tabEq.style.display = dueno ? '' : 'none';
  const tabCtrl = $('tabControl'); if (tabCtrl) tabCtrl.style.display = dueno ? '' : 'none';
  const seg = $('bloqueSeguridad'); if (seg) seg.style.display = dueno ? '' : 'none';
  const cfgB = $('bloqueConfig'); if (cfgB) cfgB.style.display = dueno ? '' : 'none';
}

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
  pintarColabs();
  aplicarRol();
  actualizarBtnBio();
  iniciarVentas();
  marcarLock();
  resetLockTimer();
  // Bienvenida
  const b = sessionStorage.getItem('tl_bienvenida');
  if (b) { sessionStorage.removeItem('tl_bienvenida'); setTimeout(()=>toast('🎉 ¡Bienvenido/a! Cargá tus productos y elegí tu modelo.'), 400); }
}

function pintarBarra(){
  const logo = cfg('logo','🛍️');
  $('barLogo').innerHTML = esImg(logo) ? `<img src="${logo}">` : escHtml(logo||'🛍️');
  $('barNombre').textContent = cfg('nombre_local','Tienda Libre');
  let u=''; try { u=(obtenerLicencia()||{}).usuario||''; } catch(e){}
  $('barUser').textContent = esDueno() ? (u ? ('@'+u) : '') : ('👤 '+nombreUsuario());
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

/* ===================== COLABORADORES (equipo) ===================== */
let colabEdit = null;
function getColabs(){ try{ return JSON.parse(localStorage.getItem('colaboradores')||'[]'); }catch(e){ return []; } }
function setColabs(a){ localStorage.setItem('colaboradores', JSON.stringify(a)); }
function _enc(s){ try{ return btoa(unescape(encodeURIComponent(s))); }catch(e){ return s; } }
function _dec(s){ try{ return decodeURIComponent(escape(atob(s||''))); }catch(e){ return ''; } }

function pintarColabs(){
  const arr = getColabs();
  const cont = $('listaColabs');
  if(!arr.length){
    cont.innerHTML = `<div class="empty"><span class="e">👥</span>Todavía no agregaste colaboradores.</div>`;
  } else {
    cont.innerHTML = arr.map(c=>`
      <div class="promo-li">
        <div class="sw" style="background:linear-gradient(135deg,#7a5bf0,#5b8bf0)">${escHtml((c.nombre||'?').slice(0,1).toUpperCase())}</div>
        <div class="pi"><div class="t">${escHtml(c.nombre||'')}</div><div class="d">usuario: ${escHtml(c.usuario||'')}</div></div>
        <div class="prod-actions">
          <button class="btn btn-ghost btn-sm" data-editcolab="${c.id}">✏️</button>
          <button class="btn btn-bad btn-sm" data-delcolab="${c.id}">🗑️</button>
        </div>
      </div>`).join('');
  }
  const codigo = _tlCodigo();
  const box = $('colabLinkBox');
  if (codigo && arr.length) {
    const base = location.origin + location.pathname.replace(/[^/]*$/, 'admin.html');
    $('colabLink').textContent = base + '?equipo=' + encodeURIComponent(codigo);
    if (box) box.style.display = 'block';
  } else {
    if (box) box.style.display = 'none';
  }
}
function abrirColab(id){
  colabEdit = id || null;
  const c = id ? getColabs().find(x=>x.id===id) : null;
  $('colabModalTit').textContent = c ? 'Editar colaborador' : 'Nuevo colaborador';
  $('colabNombre').value = c ? (c.nombre||'') : '';
  $('colabUser').value   = c ? (c.usuario||'') : '';
  $('colabPass').value   = '';
  $('colabPass').type    = 'password';
  const hint = $('colabPassHint');
  if (hint) hint.textContent = c
    ? 'Dejá la contraseña en blanco para no cambiarla.'
    : 'Mínimo 6 caracteres. Evitá "1234" o el mismo usuario.';
  pintarFuerzaPass();
  $('colabErr').textContent = '';
  abrir('ovColab');
}
const _PASS_DEBILES = ['1234','12345','123456','1234567','12345678','0000','00000','000000','1111','111111','password','passw0rd','contraseña','contrasena','qwerty','asdfgh','admin','abc123','123123','654321','tienda','sofia'];
function claveFuerte(pass, usuario){
  const p = String(pass||'');
  if (p.length < 6) return { ok:false, msg:'La contraseña debe tener al menos 6 caracteres.' };
  if (/^(.)\1+$/.test(p)) return { ok:false, msg:'Evitá repetir el mismo carácter (ej: "aaaaaa").' };
  if (/^(?:0123456789|123456789|123456|1234567|abcdefg?|qwerty)/i.test(p)) return { ok:false, msg:'Evitá secuencias como "123456" o "qwerty".' };
  if (_PASS_DEBILES.includes(p.toLowerCase())) return { ok:false, msg:'Esa contraseña es muy común. Elegí otra más difícil.' };
  if (usuario && p.toLowerCase() === String(usuario).toLowerCase()) return { ok:false, msg:'La contraseña no puede ser igual al usuario.' };
  return { ok:true, msg:'' };
}
function _scorePass(p){
  let s = 0;
  if (p.length >= 6) s++;
  if (p.length >= 10) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}
function pintarFuerzaPass(){
  const bar = $('colabPassBar'); if(!bar) return;
  const p = $('colabPass').value || '';
  const sc = _scorePass(p);
  const pct = [10,30,55,80,100][sc];
  const col = ['#dc2626','#dc2626','#d97706','#16a34a','#16a34a'][sc];
  bar.style.width = (p ? pct : 0) + '%';
  bar.style.background = col;
}
async function guardarColab(){
  const nombre = $('colabNombre').value.trim();
  const usuario = $('colabUser').value.trim().toLowerCase();
  const pass = $('colabPass').value;
  const err = $('colabErr');
  if(!nombre || !usuario){ err.textContent='Completá nombre y usuario.'; return; }
  let arr = getColabs();
  if(arr.some(c=>c.usuario===usuario && c.id!==colabEdit)){ err.textContent='Ya hay un colaborador con ese usuario.'; return; }

  const editando = !!colabEdit;
  const existente = editando ? arr.find(c=>c.id===colabEdit) : null;
  let passField;

  if (pass) {
    const fuerte = claveFuerte(pass, usuario);
    if(!fuerte.ok){ err.textContent = fuerte.msg; return; }
    const tenant = _tlCodigo() || '';
    const hash = (typeof tlHash==='function') ? await tlHash(pass, 'colab:'+usuario+':'+tenant) : null;
    passField = hash || _enc(pass);
  } else if (editando && existente) {
    if (existente.usuario !== usuario){ err.textContent='Cambiaste el usuario: volvé a escribir la contraseña.'; return; }
    passField = existente.pass;   // mantener la actual
  } else {
    err.textContent='Poné una contraseña (mínimo 6 caracteres).'; return;
  }

  const colab = { id: colabEdit || ('c'+Date.now().toString(36)), nombre, usuario, pass: passField };
  if(colabEdit) arr = arr.map(c=>c.id===colabEdit?colab:c);
  else arr.unshift(colab);
  setColabs(arr);
  if (typeof tlNubeGuardar === 'function') tlNubeGuardar();   // subir YA (no esperar el retardo)
  cerrarTodo(); pintarColabs();
  toast(colabEdit?'✅ Colaborador actualizado':'✅ Colaborador agregado');
}
function eliminarColab(id){
  if(!confirm('¿Eliminar este colaborador?')) return;
  setColabs(getColabs().filter(c=>c.id!==id));
  if (typeof tlNubeGuardar === 'function') tlNubeGuardar();
  pintarColabs();
  toast('Colaborador eliminado');
}
async function validarColaborador(user, pass){
  const codigo = _tlCodigo(); if(!codigo) return null;
  try{
    const res = await fetch(`${SB_URL}/rest/v1/tiendalibre_backups?tenant_id=eq.${encodeURIComponent(codigo)}&select=datos&limit=1`,
      { cache:'no-store', headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } });
    if(!res.ok) return null;
    const rows = await res.json();
    let colabs = [];
    if(rows && rows.length && rows[0].datos){ try{ colabs = JSON.parse(rows[0].datos.colaboradores||'[]'); }catch(e){} }
    const u = String(user).trim().toLowerCase();
    for (const c of colabs){
      if ((c.usuario||'').toLowerCase() !== u) continue;
      if (_esHash(c.pass)) {
        const h = await tlHash(pass, 'colab:'+(c.usuario||'')+':'+codigo);
        if (h !== null && h === c.pass) return c;
      } else {
        if (_dec(c.pass) === pass) return c;   // legado base64 (sigue funcionando)
      }
    }
    return null;
  }catch(e){ console.warn('validar colab:', e); return null; }
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
    pintarControl();
    actualizarBadgeVentas();
  }catch(e){ console.warn('ventas:', e); }
}

function kFmt(n){ n=Number(n)||0; return n>=1000 ? (Math.round(n/100)/10)+'k' : String(n); }
function pintarControl(){
  if (!$('secControl')) return;
  const entregados = ventasCache.filter(v => v.estado==='entregado');
  const total = entregados.reduce((s,v)=>s+(Number(v.total)||0),0);
  const cant = entregados.length;
  $('stTotal').textContent  = formatPrecio(total);
  $('stCant').textContent   = cant;
  $('stTicket').textContent = formatPrecio(cant ? Math.round(total/cant) : 0);

  // Por día (últimos 7)
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const dias = [];
  for (let i=6;i>=0;i--){ const d=new Date(hoy); d.setDate(d.getDate()-i); dias.push(d); }
  const nomDia = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
  const montos = dias.map(d=>{
    const ini=d.getTime(), fin=ini+86400000;
    return entregados.filter(v=>{ const t=v.fecha||0; return t>=ini && t<fin; }).reduce((s,v)=>s+(Number(v.total)||0),0);
  });
  const maxD = Math.max(1, ...montos);
  $('barsDias').innerHTML = `<div class="bars-v">` + dias.map((d,i)=>{
    const h = Math.round((montos[i]/maxD)*100);
    return `<div class="bar-col"><div class="bar" style="height:${h}%">${montos[i]?`<span class="bv">${kFmt(montos[i])}</span>`:''}</div><span class="bl">${nomDia[d.getDay()]}</span></div>`;
  }).join('') + `</div>`;

  // Por vendedor
  const porV = {};
  entregados.forEach(v=>{ const k=v.atendidoPor||'—'; porV[k]=(porV[k]||0)+(Number(v.total)||0); });
  const vends = Object.entries(porV).sort((a,b)=>b[1]-a[1]);
  const maxV = Math.max(1, ...vends.map(x=>x[1]));
  $('barsVend').innerHTML = vends.length
    ? vends.map(([n,m])=>`<div class="bar-h"><span class="hl">${escHtml(n)}</span><div class="ht"><div class="hf" style="width:${Math.round((m/maxV)*100)}%"></div></div><span class="hn">${formatPrecio(m)}</span></div>`).join('')
    : `<div class="hint">Todavía no hay ventas entregadas.</div>`;

  // Historial
  const cont = $('histVentas');
  if (!entregados.length){ cont.innerHTML = `<div class="hint">Cuando entregues encargos, el historial aparece acá.</div>`; return; }
  cont.innerHTML = entregados.slice().sort((a,b)=>(b.fecha||0)-(a.fecha||0)).slice(0,50).map(v=>`
    <div class="venta-card e-entregado">
      <div class="vc-top"><span class="vc-cod">${escHtml(v.codigo)}</span><span class="vc-est entregado">📦 Entregado</span></div>
      <div class="vc-cli">👤 ${escHtml((v.cliente&&v.cliente.nombre)||'')} · <b>${formatPrecio(v.total)}</b></div>
      <div class="vc-fecha">${fmtFechaCorta(v.fecha)}${v.atendidoPor?` · Vendedor: <b>${escHtml(v.atendidoPor)}</b>`:''}</div>
    </div>`).join('');
}

function actualizarBadgeVentas(){
  const pend = ventasCache.filter(v=>(v.estado||'pendiente')==='pendiente').length;
  const b = $('ventasBadge');
  if (pend>0){ b.textContent=pend; b.style.display='inline-grid'; }
  else b.style.display='none';
}

function pintarVentas(){
  const cont = $('listaVentas');
  const activas = ventasCache.filter(v => (v.estado||'pendiente') !== 'entregado');
  if (!activas.length){
    cont.innerHTML = `<div class="empty"><span class="e">🛍️</span>No hay encargos activos.<br>Los entregados están en 📊 Control.</div>`;
    return;
  }
  const lbl = {pendiente:'⏳ Pendiente', listo:'✅ Listo para retirar', entregado:'📦 Entregado'};
  cont.innerHTML = activas.map(v=>{
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
      ${v.atendidoPor?`<div class="vc-fecha" style="margin-top:4px">✅ Atendido por <b>${escHtml(v.atendidoPor)}</b></div>`:''}
      <div class="vc-acc">${acc}</div>
    </div>`;
  }).join('');
}

async function cambiarEstadoVenta(id, estado){
  const codigo = _tlCodigo();
  if (!codigo) return;
  const quien = nombreUsuario();
  ventasCache = ventasCache.map(v=>v.id===id?Object.assign({}, v, {estado, atendidoPor:quien}):v);
  pintarVentas(); actualizarBadgeVentas();
  try{
    const res = await fetch(
      `${SB_URL}/rest/v1/tiendalibre_backups?tenant_id=eq.${encodeURIComponent(codigo)}&select=datos&limit=1`,
      { cache:'no-store', headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } });
    let datos = {};
    if (res.ok){ const rows = await res.json(); if (rows && rows.length && rows[0].datos) datos = rows[0].datos; }
    let ventas = [];
    try{ ventas = JSON.parse(datos.ventas || '[]'); }catch(e){ ventas = []; }
    ventas = ventas.map(v=>v.id===id?Object.assign({}, v, {estado, atendidoPor:quien}):v);
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
  let rol=null, nombre='';
  if (await loginAdmin(u,p)) { rol='dueno'; nombre='Dueño'; }
  else {
    const c = await validarColaborador(u,p);
    if (c){ rol='colab'; nombre=c.nombre||c.usuario; sessionStorage.setItem('tl_logged','true'); }
  }
  if (!rol){
    const e=$('loginErr'); e.textContent='⚠️ Usuario o contraseña incorrectos.'; e.style.display='block'; $('loginPass').value=''; return;
  }
  if (bioActivado()){
    const ok = await bioVerificar();
    if(!ok){
      sessionStorage.removeItem('tl_logged');
      const e=$('loginErr'); e.textContent='🔒 No se pudo verificar tu huella/PIN. Probá de nuevo.'; e.style.display='block'; return;
    }
  }
  sessionStorage.setItem('tl_rol', rol);
  sessionStorage.setItem('tl_user', nombre);
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

$('btnVista').addEventListener('click', ()=>{
  const url = getLinkTienda();
  const w = window.open(url, '_blank');
  if (!w) location.href = url;   // si el navegador bloquea la pestaña nueva, abrimos la tienda acá
});
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
$('btnAddColab').addEventListener('click', ()=>abrirColab(null));
$('btnGuardarColab').addEventListener('click', guardarColab);
$('colabPass').addEventListener('input', pintarFuerzaPass);
$('colabPassEye').addEventListener('click', ()=>{
  const i=$('colabPass'); i.type = (i.type==='password') ? 'text' : 'password';
});
$('btnCopyColabLink').addEventListener('click', async ()=>{
  try{ await navigator.clipboard.writeText($('colabLink').textContent); toast('🔗 Link del equipo copiado'); }
  catch(e){ toast('Copialo del texto de arriba 🙂'); }
});

document.addEventListener('click', e=>{
  if (e.target.closest('[data-close]')) { cerrarTodo(); return; }
  if (e.target.classList.contains('overlay')) { cerrarTodo(); return; }
  const tab=e.target.closest('.tab');
  if (tab){ document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on')); tab.classList.add('on');
    document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on')); $(tab.dataset.sec).classList.add('on');
    if (tab.dataset.sec==='secVentas') tab.classList.remove('has-new');
    if (tab.dataset.sec==='secControl') pintarControl();
    return; }
  const ve=e.target.closest('[data-vest]'); if(ve){ const a=ve.dataset.vest.split('|'); cambiarEstadoVenta(a[0], a[1]); return; }
  const ec=e.target.closest('[data-editcolab]'); if(ec){ abrirColab(ec.dataset.editcolab); return; }
  const dc=e.target.closest('[data-delcolab]'); if(dc){ eliminarColab(dc.dataset.delcolab); return; }
  const epr=e.target.closest('[data-editpromo]'); if(epr){ abrirPromo(epr.dataset.editpromo); return; }
  const dpr=e.target.closest('[data-delpromo]'); if(dpr){ eliminarPromo(dpr.dataset.delpromo); return; }
  const sw=e.target.closest('[data-swatch]'); if(sw){ promoColor=sw.dataset.swatch; renderSwatches(); renderPromoPreview(); return; }
  const ed=e.target.closest('[data-edit]'); if(ed){ abrirProd(ed.dataset.edit); return; }
  const dl=e.target.closest('[data-del]');  if(dl){ eliminarProd(dl.dataset.del); return; }
  const rm=e.target.closest('[data-rmextra]'); if(rm){ rm.closest('.extra-row').remove(); return; }
  const tm=e.target.closest('[data-tema]');
  if (tm){ temaSel=tm.dataset.tema; pintarModelos(); return; }
  const ta=e.target.closest('#temasAdmin [data-temaadmin]');
  if (ta){ aplicarTemaAdmin(ta.dataset.temaadmin); return; }
  const lk=e.target.closest('#lockOpts [data-lockmin]');
  if (lk){ elegirLock(parseInt(lk.dataset.lockmin,10)||0); return; }
});

/* ===================== TEMA DEL PANEL (por dispositivo) ===================== */
function marcarTemaAdmin(){
  const actual = document.documentElement.getAttribute('data-temaadmin') || 'claro';
  document.querySelectorAll('#temasAdmin .tema-op').forEach(b=>{
    b.classList.toggle('on', b.dataset.temaadmin === actual);
  });
}
function aplicarTemaAdmin(t){
  if (!t || t==='claro') document.documentElement.removeAttribute('data-temaadmin');
  else document.documentElement.setAttribute('data-temaadmin', t);
  try{ localStorage.setItem('tl_admin_tema', t||'claro'); }catch(e){}
  marcarTemaAdmin();
  toast('🎨 Tema aplicado');
}

/* ===================== AUTO-BLOQUEO POR INACTIVIDAD ===================== */
let _lockTimer = null, _lastActiv = 0;
function lockMin(){
  const raw = localStorage.getItem('tl_lock_min');
  if (raw === null) return 10;            // default 10 min
  const n = parseInt(raw, 10);
  return isNaN(n) ? 10 : n;               // 0 = nunca
}
function marcarLock(){
  const cur = String(lockMin());
  document.querySelectorAll('#lockOpts .tema-op').forEach(b=>{
    b.classList.toggle('on', b.dataset.lockmin === cur);
  });
}
function resetLockTimer(){
  if (_lockTimer){ clearTimeout(_lockTimer); _lockTimer = null; }
  const min = lockMin();
  if (!min || min <= 0) return;           // 0 = nunca
  if (!isAdminLogged()) return;           // sólo con sesión abierta
  _lockTimer = setTimeout(bloquearPorInactividad, min * 60 * 1000);
}
function bloquearPorInactividad(){
  if (!isAdminLogged()) return;
  sessionStorage.removeItem('tl_logged');
  try{ cerrarTodo(); }catch(e){}
  mostrarLogin();
  const e = $('loginErr');
  if (e){ e.textContent = '🔒 Se bloqueó por inactividad. Ingresá de nuevo.'; e.style.display = 'block'; }
}
function _onActividad(){
  const now = Date.now();
  if (now - _lastActiv < 3000) return;    // no resetear más de 1 vez cada 3s
  _lastActiv = now;
  resetLockTimer();
}
['click','keydown','touchstart','mousemove','scroll'].forEach(ev=>{
  document.addEventListener(ev, _onActividad, { passive:true });
});
function elegirLock(min){
  localStorage.setItem('tl_lock_min', String(min));
  marcarLock();
  resetLockTimer();
  toast(min>0 ? ('🔒 Bloqueo a los '+min+' min') : '🔓 Bloqueo automático desactivado');
}

/* ===================== INIT ===================== */
(function init(){
  marcarTemaAdmin();
  marcarLock();
  if (isAdminLogged() && (rolActual()==='colab' || verificarLicencia())) mostrarPanel();
  else mostrarLogin();
})();
