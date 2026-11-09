'use strict';

const { get, run } = require('../db');
const { randomId, nowStamp } = require('./util');

const COOKIE = 'vc_sid';
const DIAS_VALIDEZ = 7;

/** Parsea el encabezado Cookie en un objeto simple. */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=');
    if (i === -1) continue;
    out[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return out;
}

/** Crea una sesion para un usuario y devuelve su identificador. */
function crearSesion(usuarioId) {
  const id = randomId(32);
  const expira = new Date(Date.now() + DIAS_VALIDEZ * 86400000)
    .toISOString().slice(0, 19).replace('T', ' ');
  run('INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?,?,?)', [id, usuarioId, expira]);
  return id;
}

/** Elimina una sesion. */
function cerrarSesion(id) {
  if (id) run('DELETE FROM sesiones WHERE id = ?', [id]);
}

/** Elimina sesiones expiradas (limpieza). */
function limpiarSesiones() {
  run("DELETE FROM sesiones WHERE expira_en < ?", [nowStamp()]);
}

/** Middleware: carga el usuario autenticado en req.usuario y res.locals. */
function cargarUsuario(req, res, next) {
  res.locals.usuario = null;
  res.locals.rutaActual = req.path;
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[COOKIE];
  if (sid) {
    const fila = get(
      `SELECT s.id AS sid, u.id, u.nombre, u.email, u.rol, u.activo
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.id = ? AND s.expira_en > ?`, [sid, nowStamp()]);
    if (fila && fila.activo) {
      req.usuario = fila;
      req.sid = sid;
      res.locals.usuario = fila;
    } else if (fila && !fila.activo) {
      cerrarSesion(sid);
    }
  }
  next();
}

/** Middleware: exige sesion activa. */
function requiereSesion(req, res, next) {
  if (!req.usuario) {
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    return res.redirect('/login?err=' + encodeURIComponent('Debe iniciar sesion para continuar.'));
  }
  next();
}

/** Middleware generador: exige uno de los roles indicados. */
function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.redirect('/login');
    if (!roles.includes(req.usuario.rol)) {
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'No tiene permisos para esta accion' });
      }
      return res.status(403).render('error', {
        titulo: 'Acceso denegado',
        codigo: 403,
        mensaje: 'Su rol no tiene permisos para acceder a esta seccion.',
      });
    }
    next();
  };
}

module.exports = {
  COOKIE,
  DIAS_VALIDEZ,
  parseCookies,
  crearSesion,
  cerrarSesion,
  limpiarSesiones,
  cargarUsuario,
  requiereSesion,
  requiereRol,
};
