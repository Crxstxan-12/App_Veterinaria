'use strict';

/**
 * Carga inicial de datos de VetConecta.
 * Uso:
 *   node src/seed.js           -> crea datos solo si la base esta vacia
 *   node src/seed.js --reset   -> borra y vuelve a cargar todos los datos
 */

const { db, all, get, run } = require('./db');
const { hashPassword, today, addDays } = require('./lib/util');

const reset = process.argv.includes('--reset');

const TABLAS = ['auditoria', 'sesiones', 'recordatorios', 'citas', 'antecedentes',
  'mascotas', 'tutores', 'usuarios', 'configuracion'];

function limpiar() {
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of TABLAS) db.exec(`DELETE FROM ${t};`);
  db.exec("DELETE FROM sqlite_sequence;");
  db.exec('PRAGMA foreign_keys = ON;');
}

function sembrar() {
  // Unica cuenta inicial: el Superusuario. El resto de cuentas se crean desde la interfaz.
  const usuarios = [
    ['Superusuario', 'vetconecta@muni.cl', 'VetConecta2026', 'superusuario', '+56 9 0000 0000'],
  ];
  for (const [nombre, email, pass, rol, tel] of usuarios) {
    run('INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES (?,?,?,?,?)',
      [nombre, email, hashPassword(pass), rol, tel]);
  }

  const tutores = [
    ['Maria', 'Gonzalez', '14.552.331-2', '+56 9 8765 4321', 'maria.gonzalez@mail.cl', 'Av. Providencia 1234, Santiago', 1, 'Tutora frecuente'],
    ['Pedro', 'Fuentes', '9.887.221-5', '+56 9 7788 9900', 'pedro.fuentes@mail.cl', 'Los Aromos 45, Nunoa', 1, ''],
    ['Camila', 'Riquelme', '18.221.004-K', '+56 9 6655 4433', 'camila.r@mail.cl', 'Pasaje El Sol 88, Maipu', 0, 'Pendiente firma de consentimiento'],
    ['Jorge', 'Contreras', '12.334.556-7', '+56 9 5544 3322', 'jcontreras@mail.cl', 'Av. Matta 2200, Santiago', 1, ''],
  ];
  for (const t of tutores) {
    run('INSERT INTO tutores (nombre, apellido, documento, telefono, email, direccion, consentimiento, notas) VALUES (?,?,?,?,?,?,?,?)', t);
  }

  const mascotas = [
    ['Luna', 'Perro', 'Labrador', 'Hembra', 'Dorado', '2020-03-15', 24.5, 'CH-0001', 1, 'activo', 'Muy sociable'],
    ['Rocky', 'Perro', 'Bulldog Frances', 'Macho', 'Atigrado', '2021-07-02', 12.3, 'CH-0002', 1, 'activo', 'Alergia leve a pollo'],
    ['Michi', 'Gato', 'Siames', 'Hembra', 'Crema', '2019-11-20', 4.1, 'CH-0003', 2, 'activo', ''],
    ['Nube', 'Gato', 'Comun europeo', 'Macho', 'Blanco', '2022-01-10', 5.0, 'CH-0004', 2, 'activo', 'Castrado'],
    ['Toby', 'Perro', 'Beagle', 'Macho', 'Tricolor', '2018-05-30', 15.7, 'CH-0005', 3, 'activo', ''],
    ['Kiwi', 'Ave', 'Periquito', 'Hembra', 'Verde', '2023-02-14', 0.04, '', 4, 'activo', ''],
  ];
  for (const m of mascotas) {
    run(`INSERT INTO mascotas (nombre, especie, raza, sexo, color, fecha_nacimiento, peso, microchip, tutor_id, estado, notas)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`, m);
  }

  // Los datos clinicos de ejemplo quedan asociados al Superusuario (usuario_id = 1).
  const hoy = today();
  const antecedentes = [
    [1, 1, addDays(hoy, -120), 'Consulta', 'Control anual', 'Paciente sano', 'Vacuna antirrabica', 'Sin observaciones', 24.0, 38.5],
    [1, 1, addDays(hoy, -30), 'Vacuna', 'Refuerzo polivalente', '-', 'Polivalente anual', 'Proxima dosis en 12 meses', 24.5, 38.6],
    [2, 1, addDays(hoy, -60), 'Consulta', 'Picazon en la piel', 'Dermatitis alergica', 'Antihistaminico 7 dias', 'Recomendada dieta hipoalergenica', 12.1, 38.9],
    [3, 1, addDays(hoy, -45), 'Examen', 'Control de peso', 'Peso estable', '-', 'Sin novedad', 4.1, 38.2],
    [5, 1, addDays(hoy, -15), 'Desparasitacion', 'Desparasitacion interna', '-', 'Antiparasitario oral', 'Repetir en 3 meses', 15.5, 38.4],
  ];
  for (const a of antecedentes) {
    run(`INSERT INTO antecedentes (mascota_id, usuario_id, fecha, tipo, motivo, diagnostico, tratamiento, observaciones, peso, temperatura)
         VALUES (?,?,?,?,?,?,?,?,?,?)`, a);
  }

  const citas = [
    [1, 1, addDays(hoy, 0), '10:00', 30, 'Control post vacuna', 'confirmada'],
    [2, 1, addDays(hoy, 0), '11:00', 30, 'Revision dermatologica', 'confirmada'],
    [3, 1, addDays(hoy, 1), '09:30', 30, 'Control de peso', 'pendiente'],
    [5, 1, addDays(hoy, 2), '16:00', 45, 'Desparasitacion', 'pendiente'],
    [6, 1, addDays(hoy, -3), '12:00', 30, 'Consulta general', 'completada'],
  ];
  for (const c of citas) {
    run(`INSERT INTO citas (mascota_id, usuario_id, fecha, hora, duracion, motivo, estado)
         VALUES (?,?,?,?,?,?,?)`, c);
  }

  const recordatorios = [
    [1, 1, 1, 'whatsapp', 'Hola Maria, le recordamos la cita de Luna hoy a las 10:00.', addDays(hoy, 0), 'pendiente'],
    [2, 2, 1, 'email', 'Recordatorio: Rocky tiene control dermatologico hoy a las 11:00.', addDays(hoy, 0), 'enviado'],
    [3, 3, 2, 'whatsapp', 'Estimado Pedro, Michi tiene control manana a las 09:30.', addDays(hoy, 1), 'pendiente'],
  ];
  for (const r of recordatorios) {
    run(`INSERT INTO recordatorios (cita_id, mascota_id, tutor_id, canal, mensaje, fecha_programada, estado, enviado_en)
         VALUES (?,?,?,?,?,?,?, CASE WHEN ? = 'enviado' THEN datetime('now','localtime') ELSE NULL END)`,
      [...r, r[6]]);
  }

  const config = [
    ['clinica_nombre', 'Clinica Veterinaria VetConecta'],
    ['clinica_direccion', 'Av. Providencia 1234, Santiago'],
    ['clinica_telefono', '+56 2 2345 6789'],
    ['clinica_email', 'contacto@vetconecta.cl'],
    ['horario_apertura', '09:00'],
    ['horario_cierre', '19:00'],
    ['duracion_cita', '30'],
  ];
  for (const [k, v] of config) run('INSERT INTO configuracion (clave, valor) VALUES (?,?)', [k, v]);

  run('INSERT INTO auditoria (usuario_id, accion, detalle) VALUES (?,?,?)',
    [1, 'seed', 'Carga inicial de datos de demostracion']);
}

const total = get('SELECT COUNT(*) AS n FROM usuarios').n;
if (reset || total === 0) {
  limpiar();
  sembrar();
  console.log('Datos cargados correctamente.');
  console.log('Usuario de acceso:');
  console.log('  vetconecta@muni.cl / VetConecta2026  (Superusuario)');
} else {
  console.log('La base ya contiene datos. Use "npm run reset" para recargar el demo.');
}
