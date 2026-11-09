'use strict';

const express = require('express');
const router = express.Router();

const { all, get, run } = require('../db');
const { requiereSesion, requiereRol } = require('../lib/auth');
const { calcularEdad } = require('../lib/util');

const puedeEditar = requiereRol('superusuario', 'administrador', 'recepcion');

const ESPECIES = ['Perro', 'Gato', 'Ave', 'Conejo', 'Roedor', 'Reptil', 'Otro'];
const ESTADOS = ['activo', 'fallecido', 'egresado'];

function volver(res, ruta, tipo, mensaje) {
  res.redirect(`${ruta}?${tipo}=${encodeURIComponent(mensaje)}`);
}

function normalizar(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    especie: String(body.especie || '').trim(),
    raza: String(body.raza || '').trim(),
    sexo: String(body.sexo || '').trim(),
    color: String(body.color || '').trim(),
    fecha_nacimiento: String(body.fecha_nacimiento || '').trim(),
    peso: body.peso === '' || body.peso == null ? null : Number(body.peso),
    microchip: String(body.microchip || '').trim(),
    tutor_id: Number(body.tutor_id) || 0,
    estado: String(body.estado || 'activo').trim(),
    notas: String(body.notas || '').trim(),
  };
}

function validar(d) {
  if (!d.nombre) return 'El nombre de la mascota es obligatorio.';
  if (!d.especie) return 'Debe indicar la especie.';
  if (!d.tutor_id) return 'Debe asignar un tutor responsable.';
  if (d.peso != null && (Number.isNaN(d.peso) || d.peso < 0)) return 'El peso debe ser un número válido.';
  if (!ESTADOS.includes(d.estado)) return 'El estado de la mascota no es válido.';
  return null;
}

router.get('/mascotas', requiereSesion, (req, res) => {
  const q = String(req.query.q || '').trim();
  const especieF = String(req.query.especie || '').trim();
  const like = `%${q}%`;

  let sql = `SELECT m.*, t.nombre || ' ' || t.apellido AS tutor, t.telefono AS tutor_telefono
             FROM mascotas m JOIN tutores t ON t.id = m.tutor_id WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ` AND (m.nombre LIKE ? OR m.microchip LIKE ? OR t.nombre LIKE ? OR t.apellido LIKE ? OR t.telefono LIKE ?)`;
    params.push(like, like, like, like, like);
  }
  if (especieF) { sql += ' AND m.especie = ?'; params.push(especieF); }
  sql += ' ORDER BY m.nombre';

  const mascotas = all(sql, params).map((m) => ({ ...m, edad: calcularEdad(m.fecha_nacimiento) }));
  const tutores = all('SELECT id, nombre, apellido FROM tutores ORDER BY apellido, nombre');
  res.render('mascotas', { titulo: 'Mascotas', mascotas, q, especieF, ESPECIES, tutores });
});

router.get('/mascotas/:id', requiereSesion, (req, res) => {
  const id = Number(req.params.id);
  const mascota = get(
    `SELECT m.*, t.nombre || ' ' || t.apellido AS tutor, t.telefono AS tutor_telefono,
            t.email AS tutor_email, t.id AS tutor_ref
     FROM mascotas m JOIN tutores t ON t.id = m.tutor_id WHERE m.id = ?`, [id]);
  if (!mascota) {
    return res.status(404).render('error', {
      titulo: 'Mascota no encontrada', codigo: 404,
      mensaje: 'La mascota solicitada no existe.',
    });
  }
  const antecedentes = all(
    `SELECT a.*, u.nombre AS profesional FROM antecedentes a
     LEFT JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.mascota_id = ? ORDER BY a.fecha DESC, a.id DESC`, [id]);
  const citas = all(
    `SELECT c.*, u.nombre AS profesional FROM citas c
     LEFT JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.mascota_id = ? ORDER BY c.fecha DESC, c.hora DESC`, [id]);

  const tutores = all('SELECT id, nombre, apellido FROM tutores ORDER BY apellido, nombre');

  res.render('mascota-detalle', {
    titulo: `Mascota: ${mascota.nombre}`,
    mascota, antecedentes, citas, tutores,
    edad: calcularEdad(mascota.fecha_nacimiento),
    ESPECIES, ESTADOS,
  });
});

router.post('/mascotas', requiereSesion, puedeEditar, (req, res) => {
  const d = normalizar(req.body);
  const error = validar(d);
  if (error) return volver(res, '/mascotas', 'err', error);
  if (!get('SELECT id FROM tutores WHERE id = ?', [d.tutor_id])) {
    return volver(res, '/mascotas', 'err', 'El tutor seleccionado no existe.');
  }

  const r = run(
    `INSERT INTO mascotas (nombre, especie, raza, sexo, color, fecha_nacimiento, peso, microchip, tutor_id, estado, notas)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [d.nombre, d.especie, d.raza, d.sexo, d.color, d.fecha_nacimiento, d.peso, d.microchip, d.tutor_id, d.estado, d.notas]);
  volver(res, `/mascotas/${r.lastInsertRowid}`, 'ok', 'Mascota registrada correctamente.');
});

router.post('/mascotas/:id', requiereSesion, puedeEditar, (req, res) => {
  const id = Number(req.params.id);
  if (!get('SELECT id FROM mascotas WHERE id = ?', [id])) {
    return volver(res, '/mascotas', 'err', 'La mascota indicada no existe.');
  }
  const d = normalizar(req.body);
  const error = validar(d);
  if (error) return volver(res, `/mascotas/${id}`, 'err', error);

  run(`UPDATE mascotas SET nombre=?, especie=?, raza=?, sexo=?, color=?, fecha_nacimiento=?,
       peso=?, microchip=?, tutor_id=?, estado=?, notas=? WHERE id=?`,
    [d.nombre, d.especie, d.raza, d.sexo, d.color, d.fecha_nacimiento, d.peso, d.microchip, d.tutor_id, d.estado, d.notas, id]);
  volver(res, `/mascotas/${id}`, 'ok', 'Ficha de la mascota actualizada.');
});

router.post('/mascotas/:id/eliminar', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  const id = Number(req.params.id);
  if (!get('SELECT id FROM mascotas WHERE id = ?', [id])) {
    return volver(res, '/mascotas', 'err', 'La mascota indicada no existe.');
  }
  run('DELETE FROM mascotas WHERE id = ?', [id]);
  volver(res, '/mascotas', 'ok', 'Mascota eliminada junto con sus registros asociados.');
});

module.exports = router;
