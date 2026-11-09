'use strict';

const express = require('express');
const router = express.Router();

const { all, get } = require('../db');
const { requiereSesion } = require('../lib/auth');
const { today, addDays } = require('../lib/util');

router.get('/panel', requiereSesion, (req, res) => {
  const hoy = today();

  const stats = {
    mascotas: get("SELECT COUNT(*) n FROM mascotas WHERE estado='activo'").n,
    tutores: get('SELECT COUNT(*) n FROM tutores').n,
    citasHoy: get('SELECT COUNT(*) n FROM citas WHERE fecha = ?', [hoy]).n,
    pendientes: get("SELECT COUNT(*) n FROM citas WHERE estado IN ('pendiente','confirmada') AND fecha >= ?", [hoy]).n,
    recordatorios: get("SELECT COUNT(*) n FROM recordatorios WHERE estado='pendiente'").n,
    antecedentes: get('SELECT COUNT(*) n FROM antecedentes').n,
  };

  const proximas = all(
    `SELECT c.*, m.nombre AS mascota, m.especie, u.nombre AS veterinario,
            t.nombre || ' ' || t.apellido AS tutor, t.telefono AS tutor_telefono
     FROM citas c
     JOIN mascotas m ON m.id = c.mascota_id
     JOIN tutores t ON t.id = m.tutor_id
     LEFT JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.fecha >= ? AND c.estado NOT IN ('cancelada','no_asistio')
     ORDER BY c.fecha, c.hora LIMIT 8`, [hoy]);

  const recientes = all(
    `SELECT m.*, t.nombre || ' ' || t.apellido AS tutor
     FROM mascotas m JOIN tutores t ON t.id = m.tutor_id
     ORDER BY m.id DESC LIMIT 6`);

  const porEspecie = all(
    `SELECT especie, COUNT(*) n FROM mascotas WHERE estado='activo'
     GROUP BY especie ORDER BY n DESC`);

  const porEstado = all(
    `SELECT estado, COUNT(*) n FROM citas WHERE fecha >= ? GROUP BY estado`, [hoy]);

  // Serie de citas por dia (proximos 7 dias) para grafico
  const serie = [];
  for (let i = 0; i < 7; i++) {
    const f = addDays(hoy, i);
    serie.push({ fecha: f, n: get('SELECT COUNT(*) n FROM citas WHERE fecha = ?', [f]).n });
  }
  const maxSerie = Math.max(1, ...serie.map((s) => s.n));

  res.render('dashboard', {
    titulo: 'Panel principal',
    stats,
    proximas,
    recientes,
    porEspecie,
    porEstado,
    serie,
    maxSerie,
    hoy,
  });
});

module.exports = router;
