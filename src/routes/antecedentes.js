'use strict';

const express = require('express');
const router = express.Router();

const { get, run } = require('../db');
const { requiereSesion, requiereRol } = require('../lib/auth');
const { today } = require('../lib/util');

const TIPOS = ['Consulta', 'Vacuna', 'Desparasitación', 'Cirugía', 'Examen', 'Control', 'Otro'];

function volver(res, ruta, tipo, mensaje) {
  res.redirect(`${ruta}?${tipo}=${encodeURIComponent(mensaje)}`);
}

router.post('/antecedentes', requiereSesion, requiereRol('superusuario', 'administrador', 'veterinario'), (req, res) => {
  const mascotaId = Number(req.body.mascota_id) || 0;
  const mascota = get('SELECT id FROM mascotas WHERE id = ?', [mascotaId]);
  if (!mascota) return volver(res, '/mascotas', 'err', 'La mascota indicada no existe.');

  const tipo = String(req.body.tipo || '').trim();
  const fecha = String(req.body.fecha || '').trim() || today();
  if (!tipo) return volver(res, `/mascotas/${mascotaId}`, 'err', 'Debe indicar el tipo de atención.');

  const peso = req.body.peso === '' || req.body.peso == null ? null : Number(req.body.peso);
  const temperatura = req.body.temperatura === '' || req.body.temperatura == null ? null : Number(req.body.temperatura);
  if (peso != null && (Number.isNaN(peso) || peso < 0)) {
    return volver(res, `/mascotas/${mascotaId}`, 'err', 'El peso debe ser un número válido.');
  }
  if (temperatura != null && (Number.isNaN(temperatura) || temperatura < 0)) {
    return volver(res, `/mascotas/${mascotaId}`, 'err', 'La temperatura debe ser un número válido.');
  }

  run(`INSERT INTO antecedentes (mascota_id, usuario_id, fecha, tipo, motivo, diagnostico, tratamiento, observaciones, peso, temperatura)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [mascotaId, req.usuario.id, fecha, tipo,
      String(req.body.motivo || '').trim(), String(req.body.diagnostico || '').trim(),
      String(req.body.tratamiento || '').trim(), String(req.body.observaciones || '').trim(),
      peso, temperatura]);

  volver(res, `/mascotas/${mascotaId}`, 'ok', 'Antecedente clínico registrado.');
});

router.post('/antecedentes/:id/eliminar', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  const id = Number(req.params.id);
  const ant = get('SELECT * FROM antecedentes WHERE id = ?', [id]);
  if (!ant) return volver(res, '/mascotas', 'err', 'El antecedente indicado no existe.');
  run('DELETE FROM antecedentes WHERE id = ?', [id]);
  volver(res, `/mascotas/${ant.mascota_id}`, 'ok', 'Antecedente eliminado.');
});

module.exports = router;
