'use strict';

const express = require('express');
const router = express.Router();

const { all, get, run } = require('../db');
const { requiereSesion } = require('../lib/auth');
const { today, addDays, startOfWeek, timeToMinutes, DIAS_SHORT } = require('../lib/util');

const ESTADOS = ['pendiente', 'confirmada', 'en_curso', 'completada', 'cancelada', 'no_asistio'];

function volver(res, ruta, tipo, mensaje) {
  const sep = ruta.includes('?') ? '&' : '?';
  res.redirect(`${ruta}${sep}${tipo}=${encodeURIComponent(mensaje)}`);
}

function minutosATexto(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** Detecta choques de agenda para un veterinario y una mascota. */
function detectarConflicto({ id = 0, usuario_id, mascota_id, fecha, hora, duracion }) {
  const inicio = timeToMinutes(hora);
  const fin = inicio + Number(duracion || 30);

  const candidatas = all(
    `SELECT c.id, c.hora, c.duracion, c.usuario_id, c.mascota_id,
            m.nombre AS mascota, u.nombre AS veterinario
     FROM citas c
     JOIN mascotas m ON m.id = c.mascota_id
     LEFT JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.fecha = ? AND c.id <> ? AND c.estado NOT IN ('cancelada','no_asistio')`,
    [fecha, id]);

  for (const c of candidatas) {
    const ci = timeToMinutes(c.hora);
    const cf = ci + Number(c.duracion || 30);
    const solapa = inicio < cf && ci < fin;
    if (!solapa) continue;
    const rango = `${c.hora} a ${minutosATexto(cf)}`;
    if (usuario_id && c.usuario_id === usuario_id) {
      return `El/la ${c.veterinario || 'veterinario/a'} ya tiene la cita de "${c.mascota}" (${rango}, ${c.duracion} min) en ese horario.`;
    }
    if (mascota_id && c.mascota_id === mascota_id) {
      return `La mascota "${c.mascota}" ya tiene una cita de ${rango} ese día.`;
    }
  }
  return null;
}

function datosFormulario() {
  return {
    mascotas: all(`SELECT m.id, m.nombre, m.especie, t.nombre || ' ' || t.apellido AS tutor
                   FROM mascotas m JOIN tutores t ON t.id = m.tutor_id
                   WHERE m.estado = 'activo' ORDER BY m.nombre`),
    veterinarios: all("SELECT id, nombre FROM usuarios WHERE rol = 'veterinario' AND activo = 1 ORDER BY nombre"),
    ESTADOS,
  };
}

router.get('/citas', requiereSesion, (req, res) => {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || '') ? req.query.fecha : today();
  const vetFiltro = Number(req.query.vet) || 0;

  let sql = `SELECT c.*, m.nombre AS mascota, m.especie,
                    t.nombre || ' ' || t.apellido AS tutor, t.telefono AS tutor_telefono,
                    u.nombre AS veterinario
             FROM citas c
             JOIN mascotas m ON m.id = c.mascota_id
             JOIN tutores t ON t.id = m.tutor_id
             LEFT JOIN usuarios u ON u.id = c.usuario_id
             WHERE c.fecha = ?`;
  const params = [fecha];
  if (vetFiltro) { sql += ' AND c.usuario_id = ?'; params.push(vetFiltro); }
  sql += ' ORDER BY c.hora';

  const citas = all(sql, params);

  // Franja semanal (lunes a domingo) con conteo por dia
  const lunes = startOfWeek(fecha);
  const semana = [];
  for (let i = 0; i < 7; i++) {
    const f = addDays(lunes, i);
    let cond = 'fecha = ?';
    const p = [f];
    if (vetFiltro) { cond += ' AND usuario_id = ?'; p.push(vetFiltro); }
    semana.push({
      fecha: f,
      dia: DIAS_SHORT[i],
      numero: Number(f.slice(8, 10)),
      n: get(`SELECT COUNT(*) n FROM citas WHERE ${cond} AND estado NOT IN ('cancelada','no_asistio')`, p).n,
    });
  }

  res.render('citas', {
    titulo: 'Agenda de citas',
    citas, fecha, vetFiltro, semana,
    ...datosFormulario(),
  });
});

router.post('/citas', requiereSesion, (req, res) => {
  const mascota_id = Number(req.body.mascota_id) || 0;
  const usuario_id = Number(req.body.usuario_id) || 0;
  const fecha = String(req.body.fecha || '').trim();
  const hora = String(req.body.hora || '').trim();
  const duracion = Number(req.body.duracion) || 30;
  const motivo = String(req.body.motivo || '').trim();

  const base = `/citas?fecha=${fecha}`;

  if (!mascota_id || !get('SELECT id FROM mascotas WHERE id = ?', [mascota_id])) {
    return volver(res, base, 'err', 'Debe seleccionar una mascota válida.');
  }
  if (!usuario_id || !get("SELECT id FROM usuarios WHERE id = ? AND rol='veterinario'", [usuario_id])) {
    return volver(res, base, 'err', 'Debe seleccionar un veterinario válido.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    return volver(res, base, 'err', 'Debe indicar una fecha y hora válidas.');
  }
  if (duracion < 5 || duracion > 240) {
    return volver(res, base, 'err', 'La duración debe estar entre 5 y 240 minutos.');
  }

  const conflicto = detectarConflicto({ usuario_id, mascota_id, fecha, hora, duracion });
  if (conflicto) return volver(res, base, 'err', 'Conflicto de agenda: ' + conflicto);

  run(`INSERT INTO citas (mascota_id, usuario_id, fecha, hora, duracion, motivo, estado)
       VALUES (?,?,?,?,?,?,'pendiente')`,
    [mascota_id, usuario_id, fecha, hora, duracion, motivo]);

  volver(res, `/citas?fecha=${fecha}`, 'ok', 'Cita agendada correctamente.');
});

router.post('/citas/:id', requiereSesion, (req, res) => {
  const id = Number(req.params.id);
  const cita = get('SELECT * FROM citas WHERE id = ?', [id]);
  if (!cita) return volver(res, '/citas', 'err', 'La cita indicada no existe.');

  const mascota_id = Number(req.body.mascota_id) || cita.mascota_id;
  const usuario_id = Number(req.body.usuario_id) || cita.usuario_id;
  const fecha = String(req.body.fecha || cita.fecha).trim();
  const hora = String(req.body.hora || cita.hora).trim();
  const duracion = Number(req.body.duracion) || cita.duracion;
  const motivo = String(req.body.motivo || '').trim();
  const notas = String(req.body.notas || '').trim();

  const conflicto = detectarConflicto({ id, usuario_id, mascota_id, fecha, hora, duracion });
  if (conflicto) return volver(res, `/citas?fecha=${fecha}`, 'err', 'Conflicto de agenda: ' + conflicto);

  run(`UPDATE citas SET mascota_id=?, usuario_id=?, fecha=?, hora=?, duracion=?, motivo=?, notas=? WHERE id=?`,
    [mascota_id, usuario_id, fecha, hora, duracion, motivo, notas, id]);
  volver(res, `/citas?fecha=${fecha}`, 'ok', 'Cita actualizada.');
});

router.post('/citas/:id/estado', requiereSesion, (req, res) => {
  const id = Number(req.params.id);
  const cita = get('SELECT * FROM citas WHERE id = ?', [id]);
  if (!cita) return volver(res, '/citas', 'err', 'La cita indicada no existe.');

  const estado = String(req.body.estado || '');
  if (!ESTADOS.includes(estado)) return volver(res, `/citas?fecha=${cita.fecha}`, 'err', 'Estado no válido.');

  run('UPDATE citas SET estado = ? WHERE id = ?', [estado, id]);
  volver(res, `/citas?fecha=${cita.fecha}`, 'ok', `Estado de la cita actualizado a "${estado}".`);
});

router.post('/citas/:id/eliminar', requiereSesion, (req, res) => {
  const id = Number(req.params.id);
  const cita = get('SELECT * FROM citas WHERE id = ?', [id]);
  if (!cita) return volver(res, '/citas', 'err', 'La cita indicada no existe.');
  run('DELETE FROM citas WHERE id = ?', [id]);
  volver(res, `/citas?fecha=${cita.fecha}`, 'ok', 'Cita eliminada.');
});

module.exports = router;
