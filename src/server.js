'use strict';

const path = require('node:path');
const express = require('express');

const { cargarUsuario, limpiarSesiones, COOKIE } = require('./lib/auth');
const { formatDate, calcularEdad, dayName, DIAS } = require('./lib/util');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Parseo de cookies + usuario autenticado
app.use(cargarUsuario);

// Helpers disponibles en todas las plantillas
app.locals.formatDate = formatDate;
app.locals.calcularEdad = calcularEdad;
app.locals.dayName = dayName;
app.locals.DIAS = DIAS;
app.locals.SITE = 'VetConecta';
app.locals.anioActual = 2026;
app.locals.etiquetaRol = (rol) => ({
  superusuario: 'Superusuario',
  administrador: 'Administrador',
  recepcion: 'Recepción',
  veterinario: 'Veterinario',
}[rol] || rol);
// Un superusuario hereda todas las atribuciones de un administrador.
app.locals.esAdmin = (u) => !!u && (u.rol === 'administrador' || u.rol === 'superusuario');
app.locals.estadoCita = (estado) => ({
  pendiente: { texto: 'Pendiente', clase: 'badge-warn' },
  confirmada: { texto: 'Confirmada', clase: 'badge-info' },
  en_curso: { texto: 'En curso', clase: 'badge-primary' },
  completada: { texto: 'Completada', clase: 'badge-ok' },
  cancelada: { texto: 'Cancelada', clase: 'badge-danger' },
  no_asistio: { texto: 'No asistió', clase: 'badge-muted' },
}[estado] || { texto: estado, clase: 'badge-muted' });
app.locals.estadoRecordatorio = (estado) => ({
  pendiente: { texto: 'Pendiente', clase: 'badge-warn' },
  enviado: { texto: 'Enviado', clase: 'badge-ok' },
  fallido: { texto: 'Fallido', clase: 'badge-danger' },
}[estado] || { texto: estado, clase: 'badge-muted' });

// Mensajes flash sencillos transportados por query string
app.use((req, res, next) => {
  const ok = req.query.ok ? String(req.query.ok) : null;
  const err = req.query.err ? String(req.query.err) : null;
  res.locals.flash = { ok, err };
  next();
});

// Datos de la clinica disponibles en todas las plantillas
const { all: consultar } = require('./db');
app.use((req, res, next) => {
  const cfg = {};
  for (const fila of consultar('SELECT clave, valor FROM configuracion')) cfg[fila.clave] = fila.valor;
  res.locals.config = cfg;
  next();
});

// Rutas
app.use(require('./routes/auth'));
app.use(require('./routes/dashboard'));
app.use(require('./routes/tutores'));
app.use(require('./routes/mascotas'));
app.use(require('./routes/antecedentes'));
app.use(require('./routes/citas'));
app.use(require('./routes/recordatorios'));
app.use(require('./routes/busqueda'));
app.use(require('./routes/usuarios'));
app.use(require('./routes/configuracion'));

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    titulo: 'Página no encontrada',
    codigo: 404,
    mensaje: 'La página que busca no existe o fue movida.',
  });
});

// Manejo central de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[VetConecta] Error:', err);
  const codigo = err.status || 500;
  res.status(codigo).render('error', {
    titulo: 'Ocurrió un problema',
    codigo,
    mensaje: err.expuesto ? err.message : 'Se produjo un error inesperado en el servidor.',
  });
});

limpiarSesiones();

app.listen(PORT, () => {
  console.log(`\n  VetConecta en ejecución`);
  console.log(`  -> http://localhost:${PORT}\n`);
});

module.exports = app;
