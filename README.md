# VetConecta

Plataforma de registro y gestión para clínica veterinaria: tutores, mascotas,
antecedentes clínicos, agenda de citas con control de duplicidades, recordatorios
y administración de accesos por rol.

## Características

- Registro de tutores y mascotas (datos, microchip, peso, edad calculada).
- Ficha clínica por mascota con antecedentes, diagnósticos y tratamientos.
- Agenda de citas con **detección de conflictos** (evita solapes de profesionales y de mascotas).
- Recordatorios por WhatsApp / correo (enlace directo pre-cargado).
- Búsqueda rápida por mascota, tutor o teléfono.
- Control de acceso por roles: Superusuario, Administrador, Recepción y Veterinario.
- Panel con indicadores y serie de actividad de 7 días.
- Configuración de la clínica y **respaldo** descargable de la base.
- Interfaz responsiva con Bootstrap 5 (recursos incluidos localmente, funciona sin internet).

## Requisitos

- **Node.js >= 22.5.0** (se usa el módulo integrado `node:sqlite`; no requiere compilar dependencias nativas).

## Instalación

```bash
npm install
npm run seed   # crea la base y el usuario Superusuario
npm start      # levanta el servidor en http://localhost:3000
```

## Acceso

Cuenta inicial (cámbiala después del primer ingreso):

| Correo               | Contraseña       | Rol          |
| -------------------- | ---------------- | ------------ |
| `vetconecta@muni.cl` | `VetConecta2026` | Superusuario |

> El superusuario puede crear más cuentas (administradores, recepción y veterinarios)
> desde **Usuarios y accesos**.

## Primeros pasos

El seed incluye tutores y mascotas de ejemplo, pero **no crea cuentas de veterinario**.
Para poder agendar citas desde la interfaz:

1. Ingresa como Superusuario.
2. Ve a **Usuarios y accesos** y crea al menos un usuario con rol **Veterinario**.
3. Luego usa **Agenda de citas** para programar atenciones.

## Roles y permisos

| Función                            | Superusuario | Administrador | Recepción | Veterinario |
| ---------------------------------- | :----------: | :-----------: | :-------: | :---------: |
| Ver panel y búsqueda               |      ✓       |       ✓       |     ✓     |      ✓      |
| Gestionar tutores y mascotas       |      ✓       |       ✓       |     ✓     |      ✗      |
| Registrar antecedentes clínicos    |      ✓       |       ✓       |     ✗     |      ✓      |
| Administrar agenda y recordatorios |      ✓       |       ✓       |     ✓     |      ✓      |
| Gestionar usuarios y configuración |      ✓       |       ✓       |     ✗     |      ✗      |

## Estructura del proyecto

```text
src/
  db.js                 Esquema y acceso a datos (node:sqlite)
  server.js             Arranque de Express y configuración de vistas
  seed.js               Carga inicial de datos
  lib/
    auth.js             Sesiones, cookies y control de roles
    util.js             Utilidades (fechas, hashing de contraseñas)
  routes/               Rutas por módulo (auth, dashboard, citas, ...)
views/                  Plantillas EJS
public/                 CSS, JS y Bootstrap incluidos localmente
data/                   Base SQLite y respaldos (no versionado)
```

## Scripts

- `npm start` — inicia el servidor.
- `npm run seed` — carga datos iniciales (solo si la base está vacía).
- `npm run reset` — borra y recarga los datos de ejemplo.

## Seguridad

- Las contraseñas se almacenan con `scrypt` (nunca en texto plano).
- Sesiones guardadas en la base de datos y cookie `HttpOnly` (`SameSite=Lax`).
- La carpeta `data/` está excluida del control de versiones.
