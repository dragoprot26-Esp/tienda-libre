/* ===== comun.js — Tienda Libre ===== */

/* EmailJS (se completan en la Etapa C, para los avisos de encargo) */
const EMAILJS_SERVICE_ID  = 'TU_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'TU_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY  = 'TU_PUBLIC_KEY';

/* =====================================================================
   SUPABASE (CyC Admin v2 — misma base que Dulzura). Compartido con licencia.js
   ===================================================================== */
const SB_URL = 'https://pcxlhgdpxfuybzfsquem.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGxoZ2RweGZ1eWJ6ZnNxdWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDIyOTQsImV4cCI6MjA5NjE3ODI5NH0.HJWpFO8TkRsmUx15GtSsUusjvVEhUsi5b_QGoPoPU00';

/* =====================================================================
   SYNC MULTI-INQUILINO — 1 fila por local. Tabla: tiendalibre_backups
   ===================================================================== */
const TL_SYNC_KEYS = [
  'productos',
  'nombre_local', 'tagline', 'logo', 'direccion', 'telefono', 'tema'
];

let _tlPush = false;
let _tlTimer = null;
const _origSetItem = localStorage.setItem.bind(localStorage);

function _tlCodigo() {
  try {
    const lic = JSON.parse(localStorage.getItem('tl_licencia') || 'null');
    const c = lic && lic.codigo ? lic.codigo : null;
    if (!c || c === 'TRIAL-15') return null;
    return c;
  } catch (e) { return null; }
}

function tlHabilitarSync() { _tlPush = true; }

function _tlDebounce() {
  if (_tlTimer) clearTimeout(_tlTimer);
  _tlTimer = setTimeout(tlNubeGuardar, 800);
}

async function tlNubeGuardar() {
  if (!_tlPush) return;
  const codigo = _tlCodigo();
  if (!codigo) return;
  const datos = {};
  TL_SYNC_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) datos[k] = v;
  });
  try {
    await fetch(`${SB_URL}/rest/v1/tiendalibre_backups`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ tenant_id: codigo, datos, updated_at: new Date().toISOString() })
    });
  } catch (e) { console.warn('[TL] No se pudo subir a la nube:', e); }
}

async function tlNubeCargar() {
  const codigo = _tlCodigo();
  if (!codigo) return { hydrated: false, changed: false };
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/tiendalibre_backups?tenant_id=eq.${encodeURIComponent(codigo)}&select=datos&limit=1`,
      { cache: 'no-store', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    let rows = [];
    if (res.ok) rows = await res.json();
    if (rows && rows.length && rows[0].datos) {
      const datos = rows[0].datos;
      let changed = false;
      Object.keys(datos).forEach(k => {
        if (TL_SYNC_KEYS.includes(k)) {
          if (localStorage.getItem(k) !== datos[k]) changed = true;
          _origSetItem(k, datos[k]);
        }
      });
      return { hydrated: true, changed, nuevo: false };
    }
    _tlPush = true;
    return { hydrated: true, changed: false, nuevo: true };
  } catch (e) {
    console.warn('[TL] No se pudo bajar de la nube:', e);
    return { hydrated: false, changed: false };
  }
}

// Interceptar setItem para sincronizar automáticamente
localStorage.setItem = function (k, v) {
  _origSetItem(k, v);
  if (_tlPush && TL_SYNC_KEYS.includes(k)) _tlDebounce();
};

/* =====================================================================
   HELPERS
   ===================================================================== */
function getProductos() {
  try { return JSON.parse(localStorage.getItem('productos') || '[]'); }
  catch (e) { return []; }
}
function setProductos(arr) { localStorage.setItem('productos', JSON.stringify(arr)); }

function cfg(k, def) {
  const v = localStorage.getItem(k);
  return (v !== null && v !== undefined) ? v : (def || '');
}
function setCfg(k, v) { localStorage.setItem(k, v); }

function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function formatPrecio(n) { return '$' + Number(n || 0).toLocaleString('es-AR'); }
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function categoriasDe(prods) {
  return [...new Set((prods || []).map(p => (p.cat || '').trim()).filter(Boolean))];
}

/* =====================================================================
   AUTH (admin) — solo credenciales que generó el panel (sin admin/1234)
   ===================================================================== */
function isAdminLogged() { return sessionStorage.getItem('tl_logged') === 'true'; }

function loginAdmin(user, pass) {
  const u = localStorage.getItem('admin_user');
  const stored = localStorage.getItem('admin_pass');
  if (!u || !stored) return false;
  let p = '';
  try { p = atob(stored); } catch (e) { return false; }
  if (String(user).trim() === u && pass === p) {
    sessionStorage.setItem('tl_logged', 'true');
    return true;
  }
  return false;
}
function logoutAdmin() {
  sessionStorage.removeItem('tl_logged');
  location.reload();
}

/* Link público de la tienda (lleva el código del local) */
function getLinkTienda() {
  const base = location.href.replace('admin.html', 'index.html').split('?')[0].split('#')[0];
  let codigo = '';
  try { codigo = (obtenerLicencia() || {}).codigo || ''; } catch (e) {}
  return codigo ? (base + '?tienda=' + encodeURIComponent(codigo)) : base;
}
