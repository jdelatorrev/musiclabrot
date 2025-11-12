# 🔧 Fix Rápido: Sesiones No Aparecen

## 🎯 Problema
Cuando inicias sesión como estudiante en `/music`, la sesión no aparece en el panel del profesor cuando haces clic en "Ver sesiones".

## ❌ Causa Raíz
El paquete `connect-pg-simple` **NO estaba instalado** en `package.json`. Sin este paquete, Express usa MemoryStore (memoria temporal) en lugar de guardar las sesiones en PostgreSQL.

**Resultado**: Las sesiones se pierden al reiniciar el servidor y no pueden ser consultadas desde otros procesos.

## ✅ Solución Aplicada

He agregado `connect-pg-simple` a las dependencias en `backend/package.json`:

```json
"connect-pg-simple": "^9.0.1"
```

## 📋 Pasos Para Desplegar en Railway

### 1. Hacer Commit y Push

```bash
git add .
git commit -m "fix: agregar connect-pg-simple para sesiones persistentes"
git push origin main
```

### 2. Esperar Despliegue en Railway

- Railway detectará los cambios automáticamente
- Ejecutará `npm install` (instalará `connect-pg-simple`)
- Reiniciará el servidor
- **Tiempo estimado**: 2-3 minutos

### 3. Verificar en los Logs de Railway

**✅ Logs Correctos (después del fix):**
```
[INFO] connect-pg-simple cargado correctamente
[INFO] Usando PostgreSQL para almacenar sesiones
[INFO] Tabla de sesiones inicializada correctamente
```

**❌ Logs Incorrectos (antes del fix):**
```
[WARN] connect-pg-simple no está instalado
[WARN] Usando MemoryStore para sesiones (no persistente)
```

### 4. Probar la Funcionalidad

1. **Hacer que un estudiante inicie sesión en `/music`**
   - Verás en los logs: `[INFO] Estudiante {username} inició sesión exitosamente. SessionID: {sid}`

2. **Ir al panel del profesor → Clic en "Ver sesiones"**
   - Ahora debería aparecer la sesión del estudiante con:
     - Nombre de usuario
     - Fecha de creación
     - Última actividad
     - Fecha de expiración
     - Botón "Cerrar sesión"

3. **Cerrar la sesión del estudiante**
   - Clic en "Cerrar sesión"
   - El estudiante será desconectado
   - Si recarga la página, será redirigido a `/login`

## 🔍 Cómo Verificar si Funciona

### Opción 1: Revisar Logs al Iniciar
En Railway → Tu servicio → Deployments → Logs

Busca:
- ✅ `[INFO] connect-pg-simple cargado correctamente`
- ✅ `[INFO] Usando PostgreSQL para almacenar sesiones`

### Opción 2: Prueba Manual
1. Estudiante inicia sesión
2. Profesor abre "Ver sesiones"
3. ¿Aparece la sesión? → ✅ Funciona
4. ¿No aparece? → ❌ Revisa logs

## 🚨 Si Aún No Funciona

### Verifica Variables de Entorno en Railway

1. Ve a Railway → Tu servicio → Variables
2. Asegúrate de que exista: `DATABASE_URL=postgresql://...`
3. Si falta, agrégala con los datos de tu base de datos

### Reinicia Manualmente el Servicio

1. Railway → Tu servicio → Settings
2. Clic en "Restart Service"
3. Espera 1-2 minutos
4. Prueba nuevamente

### Verifica la Tabla de Sesiones en PostgreSQL

Conéctate a tu base de datos y ejecuta:

```sql
-- Verificar que la tabla existe
SELECT * FROM session LIMIT 5;

-- Ver cuántas sesiones hay
SELECT COUNT(*) as total_sessions FROM session WHERE expire > NOW();

-- Ver sesiones de estudiantes
SELECT 
  sid, 
  sess->>'username' as username, 
  sess->>'role' as role,
  expire 
FROM session 
WHERE expire > NOW() 
  AND sess->>'role' = 'student';
```

## 📊 Diagrama del Flujo Correcto

```
Estudiante inicia sesión
         ↓
/api/auth/login-student
         ↓
Express Session guarda en PostgreSQL (tabla "session")
         ↓
Profesor abre "Ver sesiones"
         ↓
/api/professor/active-students
         ↓
Consulta tabla "session" en PostgreSQL
         ↓
Filtra role='student'
         ↓
Devuelve lista de sesiones
         ↓
Modal muestra las sesiones
```

## 🎉 Resultado Final

Después del fix, podrás:
- ✅ Ver todas las sesiones activas de estudiantes
- ✅ Ver cuándo iniciaron sesión
- ✅ Ver su última actividad
- ✅ Cerrar sesiones remotamente
- ✅ Las sesiones persisten entre reinicios del servidor

---

**Última actualización**: Noviembre 2025

