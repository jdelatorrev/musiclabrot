# ⚡ Cierre de Sesión en Tiempo Real

## 🎯 Problema Resuelto

**Antes:** Cuando el profesor cerraba la sesión de un estudiante desde el panel, el estudiante seguía viendo la página `/music` hasta que recargaba manualmente la página.

**Ahora:** El estudiante es desconectado **automáticamente en 5-10 segundos** sin necesidad de recargar la página.

---

## 🔧 Cómo Funciona

### Sistema de Verificación Periódica (Polling)

1. **Cada 5 segundos**, la página del estudiante verifica si su sesión sigue activa
2. **Si la sesión fue cerrada** por el profesor, el sistema lo detecta
3. **Muestra un mensaje** informando al estudiante
4. **Redirige automáticamente** al login

### Flujo Completo

```
Estudiante conectado en /music
         ↓
[Cada 5 segundos] → Verifica sesión → ¿Activa?
                                        ↓
                                       SÍ → Continuar
                                        ↓
                                       NO → Mostrar alerta
                                        ↓
                                    Redirigir a login
```

---

## 🚀 Implementación

### 1. **Nuevo Endpoint: Verificar Sesión**

**Ruta:** `GET /api/auth/session-check`

**Respuesta si la sesión está activa:**
```json
{
  "active": true,
  "username": "juan",
  "role": "student"
}
```

**Respuesta si la sesión fue cerrada:**
```json
{
  "active": false,
  "reason": "no_session"
}
```

### 2. **Verificación Automática en el Cliente**

En `music.html` se ejecuta automáticamente:

```javascript
// Verificar cada 5 segundos
setInterval(checkSessionStatus, 5000);

// También verificar al recuperar el foco de la ventana
window.addEventListener('focus', checkSessionStatus);
```

### 3. **Tolerancia a Fallos**

Para evitar desconexiones accidentales por problemas de red:

- Permite **2 fallos consecutivos** antes de cerrar sesión
- Si hay problemas de red temporales, no desconecta al usuario
- Solo desconecta si confirma 2 veces seguidas que no hay sesión

---

## 📊 Escenarios de Uso

### Escenario 1: Profesor Cierra Sesión

1. **Estudiante** está en `/music` escuchando música
2. **Profesor** abre "Ver sesiones" → Clic en "Cerrar sesión"
3. **Backend** elimina la sesión de la base de datos
4. **5-10 segundos después**, estudiante ve alerta: "Tu sesión ha sido cerrada"
5. **3 segundos después**, es redirigido a `/login`

**Tiempo total: ~10-15 segundos máximo**

### Escenario 2: Sesión Expira

1. **Estudiante** permanece conectado 24 horas sin actividad
2. **Backend** marca la sesión como expirada (limpieza automática)
3. **5-10 segundos después**, estudiante ve alerta
4. Es redirigido al login

### Escenario 3: Usuario Cambia de Pestaña

1. **Estudiante** cambia a otra pestaña del navegador
2. La verificación **sigue corriendo en segundo plano**
3. Al **regresar a la pestaña**, verifica inmediatamente
4. Si la sesión fue cerrada, muestra alerta

---

## 🔍 Logs y Debugging

### En el Navegador (Consola del Estudiante)

**Sesión activa:**
```
(Ningún log, funciona silenciosamente)
```

**Sesión cerrada:**
```
[Session Check] Sesión inactiva detectada (intento 1/2)
[Session Check] Sesión inactiva detectada (intento 2/2)
→ Muestra alerta y redirige
```

**Problema de red:**
```
[Session Check] Error al verificar sesión: NetworkError
[Session Check] Error al verificar sesión: NetworkError
→ Desconecta (por seguridad)
```

### En el Backend (Logs de Railway)

**Verificación exitosa:**
```
(Ningún log, es una operación normal)
```

**Sesión cerrada por profesor:**
```
[INFO] Sesión abc123 cerrada por el profesor
```

---

## ⚙️ Configuración

### Cambiar la Frecuencia de Verificación

En `frontend/music.html`, línea ~153:

```javascript
// Verificar cada 5 segundos (5000 ms)
setInterval(checkSessionStatus, 5000);

// Para verificar cada 3 segundos:
setInterval(checkSessionStatus, 3000);

// Para verificar cada 10 segundos:
setInterval(checkSessionStatus, 10000);
```

⚠️ **Recomendación:** No bajar de 3 segundos para no saturar el servidor.

### Cambiar la Tolerancia a Fallos

En `frontend/music.html`, línea ~101:

```javascript
const MAX_FAILURES = 2; // Permitir 2 fallos consecutivos

// Para ser más estricto (desconectar más rápido):
const MAX_FAILURES = 1;

// Para ser más tolerante (ante redes inestables):
const MAX_FAILURES = 3;
```

---

## 🎨 Personalizar el Mensaje

En `frontend/music.html`, línea ~122:

```javascript
await Swal.fire({
  icon: 'warning',
  title: 'Sesión cerrada',
  text: 'Tu sesión ha sido cerrada. Serás redirigido al inicio de sesión.',
  confirmButtonText: 'Aceptar',
  timer: 3000 // Tiempo antes de auto-cerrar (ms)
});
```

**Opciones de personalización:**
- `icon`: 'warning', 'error', 'info'
- `title`: Título del mensaje
- `text`: Mensaje descriptivo
- `timer`: Tiempo antes de cerrar automáticamente (milisegundos)
- `timerProgressBar`: Mostrar barra de progreso (true/false)

---

## 📈 Impacto en Rendimiento

### Consumo de Recursos

**Por estudiante conectado:**
- 1 petición HTTP cada 5 segundos
- ~200 bytes de datos por petición
- Impacto mínimo en el servidor

**Con 100 estudiantes conectados:**
- 20 peticiones/segundo total
- ~20 KB/segundo de tráfico
- Completamente manejable para Railway

### Optimización

- ✅ La petición es **muy ligera** (solo verifica sesión)
- ✅ No requiere consultas complejas en la BD
- ✅ Usa caché del navegador (`cache: 'no-cache'`)
- ✅ Se detiene automáticamente al cerrar la pestaña

---

## 🧪 Cómo Probar

### Prueba 1: Cierre Manual por Profesor

1. **Estudiante:** Inicia sesión y abre `/music`
2. **Profesor:** Abre "Ver sesiones" → Encuentra al estudiante → Clic "Cerrar sesión"
3. **Observa:** En 5-10 segundos, el estudiante ve la alerta y es redirigido

### Prueba 2: Múltiples Estudiantes

1. Abre 3 pestañas con diferentes estudiantes en `/music`
2. Como profesor, cierra la sesión de uno de ellos
3. Solo ese estudiante debe ser desconectado
4. Los otros siguen conectados normalmente

### Prueba 3: Recuperación de Foco

1. Estudiante abre `/music`
2. Profesor cierra su sesión
3. Estudiante cambia de pestaña y regresa
4. Al regresar, inmediatamente ve la alerta

### Prueba 4: Red Lenta

1. En DevTools → Network → Throttling → Slow 3G
2. Profesor cierra sesión
3. Puede tardar ~15 segundos pero eventualmente desconecta

---

## 🚨 Troubleshooting

### Problema: Estudiante no se desconecta

**Causa posible:** JavaScript deshabilitado o bloqueado

**Solución:** El estudiante debe tener JavaScript habilitado

---

### Problema: Desconexión muy lenta (>30 segundos)

**Causa posible:** Red muy lenta o problemas de conectividad

**Solución:** Reducir intervalo de verificación a 3 segundos:
```javascript
setInterval(checkSessionStatus, 3000);
```

---

### Problema: Desconexiones aleatorias

**Causa posible:** Problemas de red intermitentes

**Solución:** Aumentar `MAX_FAILURES`:
```javascript
const MAX_FAILURES = 3; // Más tolerante
```

---

## 📚 Archivos Modificados

1. ✅ `backend/server.js`
   - Endpoint `/api/auth/session-check`

2. ✅ `frontend/music.html`
   - Sistema de polling cada 5 segundos
   - Manejo de desconexión automática
   - Alerta con SweetAlert2

---

## 🎉 Beneficios

- ✅ **Experiencia mejorada:** El estudiante sabe inmediatamente que fue desconectado
- ✅ **Seguridad:** Las sesiones cerradas se aplican en tiempo real
- ✅ **Transparencia:** Mensaje claro de por qué se cerró la sesión
- ✅ **Confiabilidad:** Tolerancia a fallos de red temporales
- ✅ **Eficiencia:** Mínimo impacto en el rendimiento

---

## 🔮 Futuras Mejoras (Opcional)

### WebSockets (Comunicación en Tiempo Real)

En lugar de polling, usar WebSockets para notificación instantánea:

**Ventajas:**
- Notificación **instantánea** (sin esperar 5 segundos)
- Menos tráfico de red
- Más eficiente

**Desventajas:**
- Más complejo de implementar
- Requiere configurar Socket.io o similar
- Más difícil de mantener

**Recomendación:** El polling actual es suficiente para este caso de uso. Solo considerar WebSockets si necesitas notificaciones completamente instantáneas (<1 segundo).

---

**Última actualización:** Noviembre 2025

