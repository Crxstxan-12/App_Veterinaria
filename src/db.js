'use strict';

/**
 * VetConecta - Capa de acceso a datos.
 * Usa el modulo integrado node:sqlite (sin dependencias nativas).
 */

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = process.env.VETCONECTA_DB || path.join(DATA_DIR, 'vetconecta.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('superusuario','administrador','recepcion','veterinario')),
  telefono      TEXT,
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tutores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL,
  apellido       TEXT NOT NULL,
  documento      TEXT,
  telefono       TEXT NOT NULL,
  email          TEXT,
  direccion      TEXT,
  consentimiento INTEGER NOT NULL DEFAULT 0,
  notas          TEXT,
  creado_en      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS mascotas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT NOT NULL,
  especie          TEXT NOT NULL,
  raza             TEXT,
  sexo             TEXT,
  color            TEXT,
  fecha_nacimiento TEXT,
  peso             REAL,
  microchip        TEXT,
  tutor_id         INTEGER NOT NULL REFERENCES tutores(id) ON DELETE RESTRICT,
  estado           TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','fallecido','egresado')),
  notas            TEXT,
  creado_en        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS antecedentes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mascota_id    INTEGER NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  usuario_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha         TEXT NOT NULL,
  tipo          TEXT NOT NULL,
  motivo        TEXT,
  diagnostico   TEXT,
  tratamiento   TEXT,
  observaciones TEXT,
  peso          REAL,
  temperatura   REAL,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS citas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  mascota_id  INTEGER NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha       TEXT NOT NULL,
  hora        TEXT NOT NULL,
  duracion    INTEGER NOT NULL DEFAULT 30,
  motivo      TEXT,
  estado      TEXT NOT NULL DEFAULT 'pendiente'
              CHECK (estado IN ('pendiente','confirmada','en_curso','completada','cancelada','no_asistio')),
  notas       TEXT,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS recordatorios (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cita_id          INTEGER REFERENCES citas(id) ON DELETE SET NULL,
  mascota_id       INTEGER REFERENCES mascotas(id) ON DELETE CASCADE,
  tutor_id         INTEGER REFERENCES tutores(id) ON DELETE CASCADE,
  canal            TEXT NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp','email')),
  mensaje          TEXT NOT NULL,
  fecha_programada TEXT NOT NULL,
  estado           TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviado','fallido')),
  enviado_en       TEXT,
  creado_en        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sesiones (
  id         TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_en  TEXT NOT NULL,
  creado_en  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS auditoria (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  accion     TEXT NOT NULL,
  detalle    TEXT,
  creado_en  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT
);

CREATE INDEX IF NOT EXISTS idx_mascotas_tutor   ON mascotas(tutor_id);
CREATE INDEX IF NOT EXISTS idx_antecedentes_m   ON antecedentes(mascota_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha      ON citas(fecha, hora);
CREATE INDEX IF NOT EXISTS idx_citas_usuario    ON citas(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_recordatorios_f  ON recordatorios(fecha_programada);
`;

db.exec(SCHEMA);

/** Ejecuta una consulta y devuelve todas las filas. */
function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

/** Ejecuta una consulta y devuelve la primera fila (o undefined). */
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

/** Ejecuta una sentencia de escritura y devuelve { changes, lastInsertRowid }. */
function run(sql, params = []) {
  const res = db.prepare(sql).run(...params);
  return {
    changes: Number(res.changes),
    lastInsertRowid: Number(res.lastInsertRowid),
  };
}

module.exports = { db, all, get, run, DB_PATH, DATA_DIR, ROOT };
