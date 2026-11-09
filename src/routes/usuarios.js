'use strict';

const express = require('express');
const router = express.Router();

const { all, get, run } = require('../db');
const { requiereSesion, requiereRol } = require('../lib/auth');
const { hashPassword } = require('../lib/util');

const ROLES = ['superusuario', 'administrador', 'recepcion', 'veterinario'];

function volver(res, tipo, mensaje) {
  res.redirect(`/usuarios?${tipo}=${encodeURIComponent(mensaje)}`);
}

router.get('/usuarios', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  const usuarios = all('SELECT * FROM usuarios ORDER BY rol, nombre');
  res.render('usuarios', { titulo: 'Usuarios y accesos', usuarios, ROLES });
});

router.post('/usuarios', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const rol = String(req.body.rol || '');
  const telefono = String(req.body.telefono || '').trim();
  const password = String(req.body.password || '');

  if (!nombre || !email) return volver(res, 'err', 'El nombre y el correo son obligatorios.');
  if (!ROLES.includes(rol)) return volver(res, 'err', 'Debe seleccionar un rol válido.');
  if (password.length < 6) return volver(res, 'err', 'La contraseña debe tener al menos 6 caracteres.');
  if (get('SELECT id FROM usuarios WHERE email = ?', [email])) {
    return volver(res, 'err', 'Ya existe un usuario registrado con ese correo.');
  }

  run('INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, activo) VALUES (?,?,?,?,?,1)',
    [nombre, email, hashPassword(password), rol, telefono]);
  volver(res, 'ok', `Usuario ${nombre} creado correctamente.`);
});

router.post('/usuarios/:id', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  const id = Number(req.params.id);
  const actual = get('SELECT * FROM usuarios WHERE id = ?', [id]);
  if (!actual) return volver(res, 'err', 'El usuario indicado no existe.');

  const nombre = String(req.body.nombre || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const rol = String(req.body.rol || '');
  const telefono = String(req.body.telefono || '').trim();
  const activo = req.body.activo ? 1 : 0;
  const password = String(req.body.password || '');

  if (!nombre || !email) return volver(res, 'err', 'El nombre y el correo son obligatorios.');
  if (!ROLES.includes(rol)) return volver(res, 'err', 'Debe seleccionar un rol válido.');

  const duplicado = get('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [email, id]);
  if (duplicado) return volver(res, 'err', 'Ese correo ya está en uso por otro usuario.');

  if (actual.id === req.usuario.id && !activo) {
    return volver(res, 'err', 'No puede desactivar su propia cuenta.');
  }

  // Evitar que el sistema quede sin administrador activo
  if (actual.rol === 'administrador' && (rol !== 'administrador' || !activo)) {
    const admins = get("SELECT COUNT(*) n FROM usuarios WHERE rol='administrador' AND activo=1 AND id <> ?", [id]).n;
    if (admins === 0) return volver(res, 'err', 'Debe existir al menos un administrador activo.');
  }

  // Evitar que el sistema quede sin superusuario activo
  if (actual.rol === 'superusuario' && (rol !== 'superusuario' || !activo)) {
    const supers = get("SELECT COUNT(*) n FROM usuarios WHERE rol='superusuario' AND activo=1 AND id <> ?", [id]).n;
    if (supers === 0) return volver(res, 'err', 'Debe existir al menos un superusuario activo.');
  }

  if (password) {
    if (password.length < 6) return volver(res, 'err', 'La nueva contraseña debe tener al menos 6 caracteres.');
    run('UPDATE usuarios SET nombre=?, email=?, rol=?, telefono=?, activo=?, password_hash=? WHERE id=?',
      [nombre, email, rol, telefono, activo, hashPassword(password), id]);
  } else {
    run('UPDATE usuarios SET nombre=?, email=?, rol=?, telefono=?, activo=? WHERE id=?',
      [nombre, email, rol, telefono, activo, id]);
  }
  volver(res, 'ok', 'Usuario actualizado.');
});

router.post('/usuarios/:id/eliminar', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  const id = Number(req.params.id);
  const usuario = get('SELECT * FROM usuarios WHERE id = ?', [id]);
  if (!usuario) return volver(res, 'err', 'El usuario indicado no existe.');
  if (usuario.id === req.usuario.id) return volver(res, 'err', 'No puede eliminar su propia cuenta.');

  if (usuario.rol === 'administrador') {
    const admins = get("SELECT COUNT(*) n FROM usuarios WHERE rol='administrador' AND id <> ?", [id]).n;
    if (admins === 0) return volver(res, 'err', 'No se puede eliminar al único administrador.');
  }

  if (usuario.rol === 'superusuario') {
    const supers = get("SELECT COUNT(*) n FROM usuarios WHERE rol='superusuario' AND id <> ?", [id]).n;
    if (supers === 0) return volver(res, 'err', 'No se puede eliminar al único superusuario.');
  }

  run('DELETE FROM usuarios WHERE id = ?', [id]);
  volver(res, 'ok', 'Usuario eliminado.');
});

module.exports = router;
