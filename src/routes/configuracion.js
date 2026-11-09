'use strict';

const express = require('express');
const router = express.Router();
const fs = require('node:fs');
const path = require('node:path');

const { all, get, run, db, DB_PATH, DATA_DIR } = require('../db');
const { requiereSesion, requiereRol } = require('../lib/auth');

const CAMPOS = ['clinica_nombre', 'clinica_direccion', 'clinica_telefono', 'clinica_email',
  'horario_apertura', 'horario_cierre', 'duracion_cita'];

function leerConfig() {
  const cfg = {};
  for (const fila of all('SELECT clave, valor FROM configuracion')) cfg[fila.clave] = fila.valor;
  return cfg;
}

router.get('/configuracion', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  const auditoria = all(
    `SELECT a.*, u.nombre AS usuario FROM auditoria a
     LEFT JOIN usuarios u ON u.id = a.usuario_id
     ORDER BY a.id DESC LIMIT 30`);
  res.render('configuracion', {
    titulo: 'Configuración y respaldo',
    config: leerConfig(),
    auditoria,
    CAMPOS,
  });
});

router.post('/configuracion', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  for (const clave of CAMPOS) {
    const valor = String(req.body[clave] || '').trim();
    if (get('SELECT clave FROM configuracion WHERE clave = ?', [clave])) {
      run('UPDATE configuracion SET valor = ? WHERE clave = ?', [valor, clave]);
    } else {
      run('INSERT INTO configuracion (clave, valor) VALUES (?,?)', [clave, valor]);
    }
  }
  run('INSERT INTO auditoria (usuario_id, accion, detalle) VALUES (?,?,?)',
    [req.usuario.id, 'configuracion', 'Actualización de parámetros de la clínica']);
  res.redirect('/configuracion?ok=' + encodeURIComponent('Configuración guardada correctamente.'));
});

router.get('/configuracion/respaldo', requiereSesion, requiereRol('superusuario', 'administrador'), (req, res) => {
  try {
    // Asegura que los datos en WAL queden volcados al archivo principal
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    const dir = path.join(DATA_DIR, 'respaldos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const destino = path.join(dir, `vetconecta_respaldo_${sello}.db`);
    fs.copyFileSync(DB_PATH, destino);
    run('INSERT INTO auditoria (usuario_id, accion, detalle) VALUES (?,?,?)',
      [req.usuario.id, 'respaldo', `Respaldo generado: ${path.basename(destino)}`]);
    res.download(destino, path.basename(destino));
  } catch (e) {
    res.redirect('/configuracion?err=' + encodeURIComponent('No fue posible generar el respaldo.'));
  }
});

module.exports = router;
module.exports.leerConfig = leerConfig;
