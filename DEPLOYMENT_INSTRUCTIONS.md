# Instrucciones de Despliegue - Sistema de Sesiones Activas

## Cambios Realizados

Se han agregado las siguientes funcionalidades al backend:

### 1. **Endpoint para Ver Sesiones Activas**
- **Ruta**: `GET /api/professor/active-students`
- **Función**: Lista todas las sesiones activas de estudiantes
- **Requiere**: Autenticación de profesor

### 2. **Endpoint para Cerrar Sesiones**
- **Ruta**: `POST /api/professor/logout-student`
- **Función**: Permite al profesor cerrar la sesión de un estudiante específico
- **Parámetros**: `{ sid: "session_id" }`
- **Requiere**: Autenticación de profesor

### 3. **Mejoras en la Tabla de Sesiones**
- Índice en la columna `expire` para mejorar el rendimiento
- Limpieza automática de sesiones expiradas cada hora
- Mejor logging para debugging

## Despliegue en Railway

### Paso 1: Commit y Push de los Cambios

```bash
# Añadir los archivos modificados
git add backend/server.js

# Hacer commit
git commit -m "feat: agregar gestión de sesiones activas para profesor"

# Push a tu repositorio
git push origin main
```

### Paso 2: Railway Desplegará Automáticamente

Railway detectará los cambios y desplegará automáticamente la nueva versión. Este proceso toma aproximadamente 2-3 minutos.

### Paso 3: Verificar el Despliegue

1. Ve a tu dashboard de Railway
2. Busca el servicio del backend
3. Ve a la pestaña "Deployments"
4. Espera a que el estado sea "Success"

### Paso 4: Verificar los Logs

Una vez desplegado, revisa los logs en Railway para confirmar:

```
[INFO] Tabla de sesiones inicializada correctamente
```

## Uso en el Panel del Profesor

### Ver Sesiones Activas

1. Inicia sesión como profesor en `/profesor`
2. Haz clic en el botón "Ver sesiones" (esquina superior derecha)
3. Se abrirá un modal con todas las sesiones activas

### Cerrar una Sesión

1. En el modal de sesiones activas
2. Encuentra la sesión del estudiante que deseas desconectar
3. Haz clic en el botón "Cerrar sesión"
4. La sesión se cerrará inmediatamente y el estudiante será desconectado

## Verificación de Funcionamiento

### Test 1: Ver Sesiones (Sin Estudiantes Conectados)
1. Abre el panel de profesor
2. Clic en "Ver sesiones"
3. Deberías ver: "No hay sesiones activas."

### Test 2: Ver Sesiones (Con Estudiantes Conectados)
1. Haz que un estudiante inicie sesión en `/music`
2. Abre el panel de profesor
3. Clic en "Ver sesiones"
4. Deberías ver la sesión del estudiante con:
   - Nombre de usuario
   - Fecha de creación
   - Última actividad
   - Fecha de expiración

### Test 3: Cerrar Sesión
1. Con un estudiante conectado
2. En el panel de profesor, ve a "Ver sesiones"
3. Haz clic en "Cerrar sesión" para ese estudiante
4. El estudiante debería ser desconectado automáticamente
5. Si el estudiante recarga la página, será redirigido a `/login`

## Variables de Entorno Requeridas

Asegúrate de que Railway tenga configuradas estas variables:

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=tu_secreto_seguro_aqui
NODE_ENV=production
PROFESSOR_USER=tu_usuario_profesor
PROFESSOR_PASS=tu_password_profesor
```

## Logs Importantes

Una vez desplegado, estos logs te ayudarán a verificar el funcionamiento:

- `[INFO] Tabla de sesiones inicializada correctamente` - Tabla creada exitosamente
- `[INFO] Sesiones totales activas en BD: X` - Cantidad de sesiones en la BD
- `[INFO] Sesiones de estudiantes activas: X` - Cantidad de sesiones de estudiantes
- `[INFO] Limpieza automática: X sesiones expiradas eliminadas` - Limpieza automática funcionando
- `Sesión {sid} cerrada por el profesor` - Sesión cerrada exitosamente

## Troubleshooting

### Error: "Tabla de sesiones no encontrada"

**Causa**: La tabla `session` no se ha creado aún.

**Solución**:
1. Espera 1-2 minutos después del despliegue
2. Recarga la página del profesor
3. Si persiste, revisa los logs de Railway

### Error: "DB no configurada"

**Causa**: Variable `DATABASE_URL` no está configurada.

**Solución**:
1. Ve a Railway → Tu servicio → Variables
2. Asegúrate de que `DATABASE_URL` esté configurada
3. Si no está, añádela con los datos de tu base de datos PostgreSQL

### No aparecen sesiones de estudiantes conectados

**Posibles causas**:
1. El estudiante no ha iniciado sesión correctamente
2. La sesión del estudiante expiró
3. Problemas de sincronización con la base de datos

**Solución**:
1. Verifica que el estudiante esté realmente conectado (puede acceder a `/music`)
2. Revisa los logs del backend en Railway
3. Busca líneas como: `[INFO] Sesiones de estudiantes activas: X`

### La sesión no se cierra cuando hago clic

**Causa**: Posible error en el endpoint o permisos.

**Solución**:
1. Verifica que estés autenticado como profesor
2. Revisa los logs de Railway para ver errores
3. Verifica que el `sid` se esté enviando correctamente

## Contacto y Soporte

Si tienes problemas:
1. Revisa primero los logs en Railway
2. Verifica que todas las variables de entorno estén configuradas
3. Asegúrate de que el despliegue fue exitoso

---

**Última actualización**: Noviembre 2025

