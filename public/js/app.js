'use strict';

/* Utilidades de interfaz para VetConecta */

// Cierre automático de mensajes flash
document.querySelectorAll('.alert-auto').forEach((el) => {
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 4500);
});

// Confirmación antes de acciones destructivas (formularios con data-confirm)
document.addEventListener('submit', (e) => {
  const form = e.target;
  const msg = form.getAttribute('data-confirm');
  if (msg && !window.confirm(msg)) e.preventDefault();
});

// Relleno de formularios de edición dentro de modales.
// Elemento con  data-fill="#selectorModal"  y opcionalmente  data-json='{...}'  y  data-action="/ruta"
document.querySelectorAll('.modal form').forEach((form) => {
  form.dataset.originalAction = form.getAttribute('action') || '';
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-fill]');
  if (!btn) return;
  const selector = btn.getAttribute('data-fill');
  const modal = document.querySelector(selector);
  if (!modal) return;

  const form = modal.querySelector('form');
  const json = btn.getAttribute('data-json');

  if (json) {
    let datos = {};
    try { datos = JSON.parse(json); } catch (_) { datos = {}; }
    for (const [campo, valor] of Object.entries(datos)) {
      const el = form.querySelector(`[name="${campo}"]`);
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!valor;
      else el.value = valor == null ? '' : valor;
    }
  } else if (form) {
    form.reset();
  }

  if (form) {
    const action = btn.getAttribute('data-action');
    form.setAttribute('action', action || form.dataset.originalAction || '');
  }
});

// Fecha por defecto de los formularios de recordatorio/cita
document.querySelectorAll('[data-default-today]').forEach((input) => {
  if (!input.value) input.value = new Date().toLocaleDateString('en-CA');
});

// Filtro de búsqueda con envío automático tras pausa
document.querySelectorAll('[data-autosubmit]').forEach((input) => {
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => input.form.submit(), 450);
  });
});
