# 📊 Sistema de Historial de Sesiones

## Resumen

Se ha implementado un sistema completo de historial de sesiones que registra **todas** las sesiones (inicio, fin, duración, IP, razón de cierre) en una nueva tabla `session_history` de PostgreSQL.

---

## ✅ **Qué se Registra**

Cada vez que alguien inicia o cierra sesión, el sistema registra:

### Al Iniciar Sesión:
- 👤 **Usuario** (username)
- 🎭 **Rol** (student / professor)
- 🔑 **Session ID** (identificador único)
- 📅 **Fecha y hora de inicio**
- 🌐 **Dirección IP**
- 💻 **User Agent** (navegador/dispositivo)

### Al Cerrar Sesión:
- 📅 **Fecha y hora de cierre**
- 🏷️ **Razón del cierre**:
  - `logout_student` - Estudiante cerró sesión manualmente
  - `logout_professor` - Profesor cerró sesión manualmente
  - `closed_by_professor` - Profesor cerró la sesión del estudiante remotamente
  - `expired` - La sesión expiró (24 horas de inactividad)
  - `unknown` - Razón desconocida

---

## 🎯 **Funcionalidades Implementadas**

### 1. **Tabla de Historial** (`session_history`)

```sql
CREATE TABLE session_history (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    session_id TEXT NOT NULL,
    login_at TIMESTAMP NOT NULL,
    logout_at TIMESTAMP,
    logout_reason TEXT,
    ip_address TEXT,
    user_agent TEXT
);
```

**Índices optimizados para:**
- Búsqueda por usuario
- Búsqueda por fecha de inicio
- Filtrado por rol

### 2. **Endpoint de Historial**

**Ruta:** `GET /api/professor/session-history`

**Parámetros opcionales:**
- `role` - Filtrar por rol (student/professor)
- `username` - Buscar por nombre de usuario (búsqueda parcial)
- `days` - Últimos X días (default: 30)
- `limit` - Máximo de resultados (default: 100)

**Ejemplo de uso:**
```javascript
// Últimos 7 días, solo estudiantes
GET /api/professor/session-history?role=student&days=7

// Buscar usuario específico en los últimos 30 días
GET /api/professor/session-history?username=juan&days=30

// Últimas 50 sesiones de cualquier tipo
GET /api/professor/session-history?limit=50
```

**Respuesta:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": 1,
      "username": "juan",
      "role": "student",
      "session_id": "abc123...",
      "login_at": "2025-11-12T10:00:00Z",
      "logout_at": "2025-11-12T11:30:00Z",
      "logout_reason": "logout_student",
      "ip_address": "192.168.1.100",
      "status": "closed",
      "duration_seconds": 5400
    }
  ],
  "stats": {
    "total": 50,
    "active": 5,
    "closed": 45,
    "students": 40,
    "professors": 10
  }
}
```

### 3. **Interfaz en el Panel del Profesor**

#### Botón "📊 Historial" en la barra superior

Al hacer clic, se abre un modal con:

#### **A) Filtros**
- 🎭 **Rol**: Todos / Estudiantes / Profesores
- 👤 **Usuario**: Campo de búsqueda
- 📅 **Período**: 24 horas / 7 días / 30 días / 90 días

#### **B) Estadísticas**
- 📊 Total de sesiones
- 🟢 Activas
- ⚫ Cerradas
- 👨‍🎓 Estudiantes
- 👨‍🏫 Profesores

#### **C) Lista de Sesiones**

Cada sesión muestra:
- 👤 Nombre de usuario
- 🎭 Badge de rol (Estudiante/Profesor)
- 🔴/🟢 Estado (Activa/Cerrada)
- 🔐 Fecha de inicio
- 🔓 Fecha de cierre (con razón)
- ⏱️ Duración total
- 🌐 IP (si está disponible)

---

## 🔄 **Registro Automático de Sesiones**

### ✅ Se registra automáticamente cuando:

1. **Login de estudiante** (`/api/auth/login-student`)
   - ✅ Registra inicio de sesión
   - Log: `[INFO] Estudiante {username} inició sesión exitosamente. SessionID: {sid}`

2. **Login de profesor** (`/api/auth/login-professor`)
   - ✅ Registra inicio de sesión
   - Log: `[INFO] Sesión registrada en historial: {username} ({role}) - SID: {sid}`

3. **Logout manual** (`/api/auth/logout`)
   - ✅ Registra cierre con razón `logout_student` o `logout_professor`
   - Log: `[INFO] Fin de sesión registrado: SID {sid} - Razón: {reason}`

4. **Profesor cierra sesión de estudiante** (`/api/professor/logout-student`)
   - ✅ Registra cierre con razón `closed_by_professor`
   - Log: `[INFO] Sesión {sid} cerrada por el profesor`

5. **Sesiones expiradas** (limpieza automática cada hora)
   - ✅ Marca sesiones expiradas con razón `expired`
   - Log: `[INFO] Limpieza automática: X sesiones expiradas eliminadas y registradas en historial`

---

## 📈 **Casos de Uso**

### 1. **Auditoría de Acceso**
Ver quién ha accedido al sistema y cuándo:
```
Filtro: Últimos 30 días → Ver todos los accesos
```

### 2. **Seguimiento de Estudiantes**
Ver cuándo y cuánto tiempo estuvo conectado un estudiante específico:
```
Filtro: Username = "juan" + Role = Student + Últimos 7 días
```

### 3. **Detección de Problemas**
Ver sesiones que fueron cerradas por el profesor o expiraron:
```
Buscar sesiones con logout_reason = "closed_by_professor" o "expired"
```

### 4. **Estadísticas de Uso**
Ver cuántos estudiantes se conectan diariamente:
```
Filtro: Últimas 24 horas + Role = Student
```

### 5. **Análisis de Duración**
Ver cuánto tiempo permanecen conectados los usuarios:
```
Revisar columna "duration_seconds" en el historial
```

---

## 🚀 **Despliegue**

### Paso 1: Commit y Push

```bash
git add backend/server.js frontend/profesor.html
git commit -m "feat: sistema completo de historial de sesiones"
git push origin main
```

### Paso 2: Esperar Despliegue (2-3 minutos)

Railway creará automáticamente:
- ✅ Tabla `session_history`
- ✅ Índices optimizados
- ✅ Proceso de limpieza automática

### Paso 3: Verificar en Logs

```
[INFO] Tabla de historial de sesiones inicializada
```

### Paso 4: Probar

1. Haz que un estudiante inicie sesión
2. Ve al panel del profesor
3. Haz clic en "📊 Historial"
4. Verás la sesión registrada

---

## 🔍 **Consultas SQL Útiles**

### Ver todas las sesiones de hoy:
```sql
SELECT username, role, login_at, logout_at, logout_reason
FROM session_history
WHERE login_at >= CURRENT_DATE
ORDER BY login_at DESC;
```

### Ver sesiones activas (sin cerrar):
```sql
SELECT username, role, login_at, 
       EXTRACT(EPOCH FROM (NOW() - login_at))/3600 as hours_active
FROM session_history
WHERE logout_at IS NULL
ORDER BY login_at DESC;
```

### Ver estadísticas por día:
```sql
SELECT 
    DATE(login_at) as dia,
    role,
    COUNT(*) as total_sesiones,
    COUNT(DISTINCT username) as usuarios_unicos,
    AVG(EXTRACT(EPOCH FROM (COALESCE(logout_at, NOW()) - login_at))) as duracion_promedio_seg
FROM session_history
WHERE login_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(login_at), role
ORDER BY dia DESC;
```

### Ver usuarios más activos:
```sql
SELECT 
    username,
    role,
    COUNT(*) as total_sesiones,
    SUM(EXTRACT(EPOCH FROM (COALESCE(logout_at, NOW()) - login_at)))/3600 as horas_totales
FROM session_history
WHERE login_at >= NOW() - INTERVAL '30 days'
GROUP BY username, role
ORDER BY total_sesiones DESC
LIMIT 10;
```

---

## ⚠️ **Notas Importantes**

### Sesiones Antiguas NO se Recuperan
Las sesiones que existían antes de implementar este sistema **NO** aparecerán en el historial porque:
- Estaban en memoria (MemoryStore)
- No se guardaban en la base de datos
- Se perdieron al reiniciar el servidor

**Solo se registrarán las sesiones nuevas** a partir del momento en que despliegues estos cambios.

### Retención de Datos
El sistema actualmente **NO limpia** el historial automáticamente. Todas las sesiones se guardan indefinidamente.

Si quieres limitar la retención, puedes agregar un job de limpieza:
```sql
-- Eliminar sesiones de hace más de 90 días
DELETE FROM session_history 
WHERE login_at < NOW() - INTERVAL '90 days';
```

### Performance
Los índices optimizan las consultas para:
- ✅ Búsquedas por usuario (rápido)
- ✅ Búsquedas por fecha (rápido)
- ✅ Filtrado por rol (rápido)

Con 10,000+ sesiones, las consultas seguirán siendo instantáneas.

---

## 🎉 **Resultado Final**

Ahora puedes:
- ✅ Ver todas las sesiones activas (como antes)
- ✅ Ver el historial completo de sesiones
- ✅ Filtrar por usuario, rol, período
- ✅ Ver cuándo iniciaron y cerraron sesión
- ✅ Ver por qué se cerró cada sesión
- ✅ Ver la duración de cada sesión
- ✅ Ver la IP de donde se conectaron
- ✅ Obtener estadísticas de uso

**Todo registrado automáticamente, sin intervención manual.**

---

**Última actualización**: Noviembre 2025

