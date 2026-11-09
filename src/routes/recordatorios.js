'use strict';

const express = require('express');
const router = express.Router();

const { all, get, run } = require('../db');
const { requiereSesion } = require('../lib/auth');
const { today, nowStamp, formatDate } = require('../lib/util');

function volver(res, ruta, tipo, mensaje) {
  res.redirect(`${ruta}?${tipo}=${encodeURIComponent(mensaje)}`);
}

router.get('/recordatorios', requiereSesion, (req, res) => {
  const estadoF = String(req.query.estado || '').trim();
  const canalF = String(req.query.canal || '').trim();

  let sql = `SELECT r.*, m.nombre AS mascota,
                    t.nombre || ' ' || t.apellido AS tutor, t.telefono AS tutor_telefono,
                    t.email AS tutor_email
             FROM recordatorios r
             LEFT JOIN mascotas m ON m.id = r.mascota_id
             LEFT JOIN tutores t ON t.id = r.tutor_id
             WHERE 1=1`;
  const params = [];
  if (estadoF) { sql += ' AND r.estado = ?'; params.push(estadoF); }
  if (canalF) { sql += ' AND r.canal = ?'; params.push(canalF); }
  sql += ` ORDER BY CASE r.estado WHEN 'pendiente' THEN 0 ELSE 1 END, r.fecha_programada DESC, r.id DESC`;

  const recordatorios = all(sql, params).map((r) => ({ ...r, waLink: enlaceWhatsapp(r) }));

  const tutores = all('SELECT id, nombre, apellido, telefono FROM tutores ORDER BY apellido, nombre');
  const mascotas = all(`SELECT m.id, m.nombre, t.nombre || ' ' || t.apellido AS tutor
                        FROM mascotas m JOIN tutores t ON t.id = m.tutor_id ORDER BY m.nombre`);

  res.render('recordatorios', {
    titulo: 'Recordatorios',
    recordatorios, tutores, mascotas, estadoF, canalF, hoy: today(),
  });
});

/** Construye un enlace de WhatsApp si el telefono es valido. */
function enlaceWhatsapp(r) {
  if (!r.tutor_telefono) return null;
  const numero = r.tutor_telefono.replace(/[^\d]/g, '');
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(r.mensaje)}`;
}

router.post('/recordatorios', requiereSesion, (req, res) => {
  const tutor_id = Number(req.body.tutor_id) || 0;
  const mascota_id = Number(req.body.mascota_id) || null;
  const canal = String(req.body.canal || 'whatsapp');
  const fecha_programada = String(req.body.fecha_programada || '').trim() || today();
  let mensaje = String(req.body.mensaje || '').trim();

  if (!tutor_id || !get('SELECT id FROM tutores WHERE id = ?', [tutor_id])) {
    return volver(res, '/recordatorios', 'err', 'Debe seleccionar un tutor válido.');
  }
  if (!['whatsapp', 'email'].includes(canal)) {
    return volver(res, '/recordatorios', 'err', 'El canal seleccionado no es válido.');
  }
  if (!mensaje) {
    const tutor = get('SELECT nombre FROM tutores WHERE id = ?', [tutor_id]);
    const mascota = mascota_id ? get('SELECT nombre FROM mascotas WHERE id = ?', [mascota_id]) : null;
    mensaje = mascota
      ? `Estimado/a ${tutor.nombre}, le recordamos la próxima atención de ${mascota.nombre} en nuestra clínica.`
      : `Estimado/a ${tutor.nombre}, le recordamos su próxima atención en nuestra clínica.`;
  }

  run(`INSERT INTO recordatorios (mascota_id, tutor_id, canal, mensaje, fecha_programada, estado)
       VALUES (?,?,?,?,?,'pendiente')`,
    [mascota_id, tutor_id, canal, mensaje, fecha_programada]);
  volver(res, '/recordatorios', 'ok', 'Recordatorio programado.');
});

router.post('/recordatorios/desde-cita/:id', requiereSesion, (req, res) => {
  const citaId = Number(req.params.id);
  const cita = get(
    `SELECT c.*, m.nombre AS mascota, m.tutor_id,
            t.nombre AS tutor_nombre, t.apellido AS tutor_apellido
     FROM citas c JOIN mascotas m ON m.id = c.mascota_id
     JOIN tutores t ON t.id = m.tutor_id WHERE c.id = ?`, [citaId]);
  if (!cita) return volver(res, '/citas', 'err', 'La cita indicada no existe.');

  const canal = String(req.body.canal || 'whatsapp');
  const mensaje = `Estimado/a ${cita.tutor_nombre} ${cita.tutor_apellido}, le recordamos la cita de ` +
    `${cita.mascota} el ${formatDate(cita.fecha)} a las ${cita.hora}. ¡Le esperamos!`;

  run(`INSERT INTO recordatorios (cita_id, mascota_id, tutor_id, canal, mensaje, fecha_programada, estado)
       VALUES (?,?,?,?,?,?,'pendiente')`,
    [cita.id, cita.mascota_id, cita.tutor_id, canal, mensaje, cita.fecha]);
  volver(res, `/citas?fecha=${cita.fecha}`, 'ok', 'Recordatorio creado a partir de la cita.');
});

router.post('/recordatorios/:id/enviar', requiereSesion, (req, res) => {
  const id = Number(req.params.id);
  const r = get('SELECT * FROM recordatorios WHERE id = ?', [id]);
  if (!r) return volver(res, '/recordatorios', 'err', 'El recordatorio indicado no existe.');
  run("UPDATE recordatorios SET estado='enviado', enviado_en=? WHERE id=?", [nowStamp(), id]);
  volver(res, '/recordatorios', 'ok', `Recordatorio marcado como enviado vía ${r.canal}.`);
});

router.post('/recordatorios/:id/eliminar', requiereSesion, (req, res) => {
  const id = Number(req.params.id);
  if (!get('SELECT id FROM recordatorios WHERE id = ?', [id])) {
    return volver(res, '/recordatorios', 'err', 'El recordatorio indicado no existe.');
  }
  run('DELETE FROM recordatorios WHERE id = ?', [id]);
  volver(res, '/recordatorios', 'ok', 'Recordatorio eliminado.');
});

module.exports = router;
