'use strict';

const crypto = require('node:crypto');

/** Genera hash de contrasena usando scrypt (sin dependencias externas). */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/** Verifica una contrasena contra un hash almacenado. */
function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Identificador aleatorio seguro para sesiones. */
function randomId(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Fecha de hoy en formato YYYY-MM-DD (zona local). */
function today() {
  return new Date().toLocaleDateString('en-CA');
}

/** Fecha y hora actual en formato "YYYY-MM-DD HH:MM:SS" (zona local). */
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Suma dias a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD. */
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

/** Devuelve el lunes de la semana de una fecha YYYY-MM-DD. */
function startOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
}

/** Convierte "HH:MM" a minutos desde medianoche. */
function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Formatea "YYYY-MM-DD" a "DD-MM-YYYY". */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const DIAS_SHORT = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Nombre del dia de la semana para una fecha YYYY-MM-DD. */
function dayName(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return DIAS[(d.getDay() + 6) % 7];
}

/** Calcula la edad aproximada a partir de fecha de nacimiento. */
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return '';
  const n = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(n.getTime())) return '';
  const hoy = new Date();
  let meses = (hoy.getFullYear() - n.getFullYear()) * 12 + (hoy.getMonth() - n.getMonth());
  if (hoy.getDate() < n.getDate()) meses -= 1;
  if (meses < 0) return '';
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anios === 0) return `${resto} ${resto === 1 ? 'mes' : 'meses'}`;
  if (resto === 0) return `${anios} ${anios === 1 ? 'ano' : 'anos'}`;
  return `${anios}a ${resto}m`;
}

module.exports = {
  hashPassword,
  verifyPassword,
  randomId,
  today,
  nowStamp,
  addDays,
  startOfWeek,
  timeToMinutes,
  formatDate,
  dayName,
  calcularEdad,
  DIAS,
  DIAS_SHORT,
  MESES,
};
