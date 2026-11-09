'use strict';

const express = require('express');
const router = express.Router();

const { all } = require('../db');
const { requiereSesion } = require('../lib/auth');
const { calcularEdad } = require('../lib/util');

router.get('/busqueda', requiereSesion, (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q}%`;

  let mascotas = [];
  let tutores = [];
  let citas = [];

  if (q) {
    mascotas = all(
      `SELECT m.*, t.nombre || ' ' || t.apellido AS tutor, t.telefono AS tutor_telefono
       FROM mascotas m JOIN tutores t ON t.id = m.tutor_id
       WHERE m.nombre LIKE ? OR m.microchip LIKE ? OR t.nombre LIKE ? OR t.apellido LIKE ? OR t.telefono LIKE ?
       ORDER BY m.nombre LIMIT 25`, [like, like, like, like, like])
      .map((m) => ({ ...m, edad: calcularEdad(m.fecha_nacimiento) }));

    tutores = all(
      `SELECT * FROM tutores
       WHERE nombre LIKE ? OR apellido LIKE ? OR telefono LIKE ? OR documento LIKE ? OR email LIKE ?
       ORDER BY apellido LIMIT 25`, [like, like, like, like, like]);

    citas = all(
      `SELECT c.*, m.nombre AS mascota, t.nombre || ' ' || t.apellido AS tutor
       FROM citas c JOIN mascotas m ON m.id = c.mascota_id JOIN tutores t ON t.id = m.tutor_id
       WHERE m.nombre LIKE ? OR t.nombre LIKE ? OR t.apellido LIKE ? OR t.telefono LIKE ?
       ORDER BY c.fecha DESC LIMIT 25`, [like, like, like, like]);
  }

  res.render('busqueda', {
    titulo: 'Búsqueda de registros',
    q, mascotas, tutores, citas,
    total: mascotas.length + tutores.length + citas.length,
  });
});

module.exports = router;
