'use strict';

const express = require('express');
const router = express.Router();

const { all, get, run } = require('../db');
const { requiereSesion, requiereRol } = require('../lib/auth');

const puedeEditar = requiereRol('superusuario', 'administrador', 'recepcion');

/** Redirige adjuntando un mensaje flash por query string. */
function volver(res, ruta, tipo, mensaje) {
  res.redirect(`${ruta}?${tipo}=${encodeURIComponent(mensaje)}`);
}

function normalizar(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    apellido: String(body.apellido || '').trim(),
    documento: String(body.documento || '').trim(),
    telefono: String(body.telefono || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    direccion: String(body.direccion || '').trim(),
    consentimiento: body.consentimiento ? 1 : 0,
    notas: String(body.notas || '').trim(),
  };
}

function validar(d) {
  if (!d.nombre || !d.apellido) return 'El nombre y el apellido son obligatorios.';
  if (!d.telefono) return 'El teléfono es obligatorio.';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'El correo electrónico no es válido.';
  return null;
}

router.get('/tutores', requiereSesion, (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q}%`;
  const tutores = q
    ? all(`SELECT * FROM tutores
           WHERE nombre LIKE ? OR apellido LIKE ? OR telefono LIKE ? OR documento LIKE ? OR email LIKE ?
           ORDER BY apellido, nombre`, [like, like, like, like, like])
    : all('SELECT * FROM tutores ORDER BY apellido, nombre');

  const conConteo = tutores.map((t) => ({
    ...t,
    mascotas: get('SELECT COUNT(*) n FROM mascotas WHERE tutor_id = ?', [t.id]).n,
  }));

  res.render('tutores', { titulo: 'Tutores', tutores: conConteo, q });
});

router.post('/tutores', requiereSesion, puedeEditar, (req, res) => {
  const d = normalizar(req.body);
  const error = validar(d);
  if (error) return volver(res, '/tutores', 'err', error);

  run(`INSERT INTO tutores (nombre, apellido, documento, telefono, email, direccion, consentimiento, notas)
       VALUES (?,?,?,?,?,?,?,?)`,
    [d.nombre, d.apellido, d.documento, d.telefono, d.email, d.direccion, d.consentimiento, d.notas]);
  volver(res, '/tutores', 'ok', `Tutor ${d.nombre} ${d.apellido} registrado correctamente.`);
});

router.post('/tutores/:id', requiereSesion, puedeEditar, (req, res) => {
  const id = Number(req.params.id);
  const actual = get('SELECT * FROM tutores WHERE id = ?', [id]);
  if (!actual) return volver(res, '/tutores', 'err', 'El tutor indicado no existe.');

  const d = normalizar(req.body);
  const error = validar(d);
  if (error) return volver(res, '/tutores', 'err', error);

  run(`UPDATE tutores SET nombre=?, apellido=?, documento=?, telefono=?, email=?, direccion=?, consentimiento=?, notas=?
       WHERE id=?`,
    [d.nombre, d.apellido, d.documento, d.telefono, d.email, d.direccion, d.consentimiento, d.notas, id]);
  volver(res, '/tutores', 'ok', 'Datos del tutor actualizados.');
});

router.post('/tutores/:id/eliminar', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  const id = Number(req.params.id);
  const tutor = get('SELECT * FROM tutores WHERE id = ?', [id]);
  if (!tutor) return volver(res, '/tutores', 'err', 'El tutor indicado no existe.');

  const mascotas = get('SELECT COUNT(*) n FROM mascotas WHERE tutor_id = ?', [id]).n;
  if (mascotas > 0) {
    return volver(res, '/tutores', 'err',
      `No se puede eliminar: el tutor tiene ${mascotas} mascota(s) registrada(s).`);
  }
  run('DELETE FROM tutores WHERE id = ?', [id]);
  volver(res, '/tutores', 'ok', 'Tutor eliminado.');
});

module.exports = router;
