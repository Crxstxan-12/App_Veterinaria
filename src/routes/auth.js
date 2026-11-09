'use strict';

const express = require('express');
const router = express.Router();

const { get } = require('../db');
const { verifyPassword } = require('../lib/util');
const { crearSesion, cerrarSesion, COOKIE, DIAS_VALIDEZ } = require('../lib/auth');

router.get('/', (req, res) => {
  res.redirect(req.usuario ? '/panel' : '/login');
});

router.get('/login', (req, res) => {
  if (req.usuario) return res.redirect('/panel');
  res.render('login', { titulo: 'Iniciar sesión', email: '' });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).render('login', {
      titulo: 'Iniciar sesión',
      email,
      error: 'Debe ingresar correo y contraseña.',
    });
  }

  const usuario = get('SELECT * FROM usuarios WHERE email = ?', [email]);
  if (!usuario || !verifyPassword(password, usuario.password_hash)) {
    return res.status(401).render('login', {
      titulo: 'Iniciar sesión',
      email,
      error: 'Credenciales inválidas. Verifique sus datos.',
    });
  }

  if (!usuario.activo) {
    return res.status(403).render('login', {
      titulo: 'Iniciar sesión',
      email,
      error: 'Su cuenta se encuentra desactivada. Contacte al administrador.',
    });
  }

  const sid = crearSesion(usuario.id);
  res.cookie(COOKIE, sid, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: DIAS_VALIDEZ * 86400000,
  });
  res.redirect('/panel?ok=' + encodeURIComponent(`Bienvenido/a, ${usuario.nombre}`));
});

router.post('/logout', (req, res) => {
  if (req.sid) cerrarSesion(req.sid);
  res.clearCookie(COOKIE);
  res.redirect('/login?ok=' + encodeURIComponent('Sesión cerrada correctamente.'));
});

module.exports = router;
