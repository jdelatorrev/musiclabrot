# 🔔 Sistema de Notificaciones de Audio - Panel del Profesor

## 🎯 Problema Resuelto

**Antes:** Los navegadores modernos bloqueaban el audio hasta que el usuario interactuara con la página, causando que las notificaciones de sonido no funcionaran.

**Ahora:** Sistema de audio robusto con activación automática, logging detallado y indicador visual del estado.

---

## 🔧 Cómo Funciona

### 1. **Activación Automática del Audio**

El audio se activa automáticamente con la **primera interacción** del usuario:
- ✅ Primer clic en cualquier parte de la página
- ✅ Primer toque (móvil/tablet)
- ✅ Primera tecla presionada

```javascript
// Se activa con cualquiera de estos eventos
document.addEventListener('click', activateAudio);
document.addEventListener('keydown', activateAudio);
document.addEventListener('touchstart', activateAudio);
```

### 2. **Estados del Audio**

El sistema tiene 3 estados posibles:

| Estado | Descripción | Indicador Visual |
|--------|-------------|------------------|
| **Activo** | AudioContext funcionando, listo para reproducir | 🔔 Sonido (Activo) 🟢 |
| **Pendiente** | Sonido habilitado pero esperando interacción | 🔔 Sonido (Pendiente) 🟡 |
| **Deshabilitado** | Usuario desactivó el sonido | 🔔 Sonido |

### 3. **Notificaciones Sonoras**

El sistema reproduce un sonido cuando:
- ✅ Llega una nueva solicitud pendiente
- ✅ Llega un nuevo código de verificación
- ✅ Llega una nueva verificación final (Google)

---

## 🎨 Interfaz de Usuario

### Checkbox de Sonido

```
┌──────────────────────────────────┐
│ ☑ 🔔 Sonido (Activo) 🟢         │
│   [Ajustes]  [Ver sesiones]     │
└──────────────────────────────────┘
```

**Indicadores de estado:**
- `🔔 Sonido` - Deshabilitado
- `🔔 Sonido (Pendiente) 🟡` - Esperando activación
- `🔔 Sonido (Activo) 🟢` - Funcionando correctamente

### Panel de Ajustes

```
┌─────────────────────────────────┐
│ Frecuencia (Hz)    [880  ]     │
│ Volumen            [━━━○━] 0.20 │
│ Duración (ms)      [300  ]     │
│ [Probar]                        │
└─────────────────────────────────┘
```

---

## 📊 Logging y Debugging

### Logs en la Consola del Navegador

#### **Activación del Audio**
```
[Audio] Activando audio después de interacción del usuario...
[Audio] AudioContext creado. Estado inicial: suspended
[Audio] AudioContext suspendido, intentando reanudar...
[Audio] AudioContext reanudado. Estado: running
[Audio] AudioContext listo y funcionando
[Audio] Audio activado exitosamente
```

#### **Nueva Notificación**
```
[Notificación] Nueva solicitud detectada, reproduciendo sonido...
[Audio] Sonido reproducido correctamente
```

#### **Prueba de Sonido**
```
[Audio Test] Botón de prueba presionado
[Audio] Sonido reproducido correctamente
[Audio Test] Estado del AudioContext: running
[Audio Test] Sonido habilitado: true
[Audio Test] Frecuencia: 880 Hz
[Audio Test] Volumen: 0.2
[Audio Test] Duración: 300 ms
```

#### **Errores Comunes**
```
[Audio] AudioContext no soportado en este navegador
[Audio] No se pudo crear AudioContext
[Audio] AudioContext no está listo. Estado: suspended
[Audio] Sonido deshabilitado
```

---

## 🧪 Cómo Probar

### Prueba 1: Activación del Audio

1. Abre el panel del profesor
2. Abre la consola del navegador (F12)
3. Haz clic en cualquier parte de la página
4. Verifica en la consola: `[Audio] Audio activado exitosamente`
5. Verifica el indicador visual: `🔔 Sonido (Activo) 🟢`

### Prueba 2: Botón de Prueba

1. Haz clic en **"Ajustes"** (en el panel de sonido)
2. Haz clic en **"Probar"**
3. Deberías escuchar un beep
4. Verifica en la consola los logs de prueba

### Prueba 3: Notificación Real

1. Ten el panel del profesor abierto con sonido habilitado
2. Haz que un estudiante envíe una solicitud de login
3. En ~5 segundos (cuando se detecte la solicitud), deberías:
   - Escuchar el sonido de notificación
   - Ver en consola: `[Notificación] Nueva solicitud detectada`

### Prueba 4: Cambio de Configuración

1. Abre **"Ajustes"**
2. Cambia la **Frecuencia** a 1200 Hz (más agudo)
3. Cambia el **Volumen** a 0.5 (más fuerte)
4. Cambia la **Duración** a 500 ms (más largo)
5. Haz clic en **"Probar"**
6. El sonido debe reflejar los cambios

---

## ⚙️ Configuración

### Valores por Defecto

```javascript
beepFreq = 880;      // Hz (frecuencia)
beepVol = 0.2;       // 0.0 - 1.0 (volumen)
beepDuration = 300;  // ms (duración)
```

### Rangos Permitidos

| Parámetro | Mínimo | Máximo | Recomendado |
|-----------|--------|--------|-------------|
| Frecuencia | 100 Hz | 4000 Hz | 800-1200 Hz |
| Volumen | 0.001 | 1.0 | 0.2-0.5 |
| Duración | 50 ms | 2000 ms | 200-500 ms |

### Persistencia

Los ajustes se guardan automáticamente en `localStorage`:
- `profSoundEnabled` - Si el sonido está habilitado
- `profBeepFreq` - Frecuencia del beep
- `profBeepVol` - Volumen del beep
- `profBeepDur` - Duración del beep

---

## 🚨 Troubleshooting

### Problema: No se escucha ningún sonido

**Solución 1: Verificar que el sonido esté habilitado**
1. Verifica que el checkbox `🔔 Sonido` esté marcado
2. Verifica que el indicador muestre `(Activo) 🟢`

**Solución 2: Activar el audio manualmente**
1. Haz clic en **"Ajustes"**
2. Haz clic en **"Probar"**
3. Esto forzará la activación del audio

**Solución 3: Verificar volumen del sistema**
- Asegúrate de que el volumen del sistema no esté en 0
- Asegúrate de que el navegador no esté silenciado

**Solución 4: Revisar logs**
1. Abre la consola (F12)
2. Busca mensajes `[Audio]`
3. Si ves `suspended`, haz clic en "Probar"

---

### Problema: Sonido muy bajo

**Solución:**
1. Abre **"Ajustes"**
2. Aumenta el **Volumen** a 0.5 o más
3. Haz clic en **"Probar"** para verificar

---

### Problema: Sonido muy corto/largo

**Solución:**
1. Abre **"Ajustes"**
2. Ajusta la **Duración** (ms)
   - Más corto: 150-200 ms
   - Más largo: 500-1000 ms
3. Haz clic en **"Probar"**

---

### Problema: Sonido muy agudo/grave

**Solución:**
1. Abre **"Ajustes"**
2. Ajusta la **Frecuencia** (Hz)
   - Más grave: 400-600 Hz
   - Más agudo: 1200-2000 Hz
3. Haz clic en **"Probar"**

---

### Problema: Indicador siempre en "Pendiente"

**Causa:** El audio no se ha activado aún.

**Solución:**
1. Haz clic en cualquier parte de la página
2. Espera 1-2 segundos
3. El indicador debería cambiar a "Activo"

Si no cambia:
1. Haz clic en "Ajustes" → "Probar"
2. Esto forzará la activación

---

### Problema: No funciona en navegador X

**Navegadores Soportados:**
- ✅ Chrome/Chromium (v60+)
- ✅ Firefox (v55+)
- ✅ Safari (v14+)
- ✅ Edge (v79+)

**No soportados:**
- ❌ Internet Explorer (cualquier versión)
- ❌ Navegadores muy antiguos

**Solución:**
Actualiza a la última versión de tu navegador.

---

## 🔬 Debugging Avanzado

### Verificar Estado del AudioContext

Ejecuta en la consola:

```javascript
// Ver estado actual
console.log('AudioContext:', audioCtx);
console.log('Estado:', audioCtx?.state);
console.log('Sonido habilitado:', soundEnabled);
console.log('Audio inicializado:', audioInitialized);

// Forzar activación
await activateAudio();

// Probar sonido directamente
await playNotify();
```

### Logs Detallados

Para habilitar logs más detallados, todos los mensajes de audio ya incluyen el prefijo `[Audio]` para facilitar el filtrado en la consola.

### Simular Nueva Solicitud

Para probar el sonido sin esperar una solicitud real:

```javascript
// Ejecutar en la consola del navegador
playNotify();
```

---

## 📈 Mejoras Implementadas

✅ **Activación automática** con primera interacción
✅ **Múltiples listeners** (click, keydown, touchstart)
✅ **Logging detallado** para debugging
✅ **Indicador visual** del estado del audio
✅ **Reintentos automáticos** si el AudioContext está suspendido
✅ **Manejo robusto de errores**
✅ **Persistencia de configuración**
✅ **Botón de prueba mejorado**

---

## 🎓 Información Técnica

### Web Audio API

El sistema usa la [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) para generar sonidos sintéticos:

```javascript
// Crear oscilador (genera el tono)
const oscillator = audioCtx.createOscillator();
oscillator.frequency.value = 880; // Frecuencia en Hz

// Crear ganancia (controla el volumen)
const gain = audioCtx.createGain();
gain.gain.value = 0.2; // Volumen 0.0 - 1.0

// Conectar y reproducir
oscillator.connect(gain).connect(audioCtx.destination);
oscillator.start();
```

### Políticas de Autoplay

Los navegadores modernos bloquean el audio sin interacción del usuario por:
- **Seguridad:** Prevenir sitios maliciosos
- **UX:** Evitar sonidos no deseados

**Nuestra solución:** Activar el audio con la primera interacción del usuario.

---

## 📚 Referencias

- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Autoplay Policy - Chrome](https://developer.chrome.com/blog/autoplay/)
- [AudioContext - MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)

---

**Última actualización:** Noviembre 2025

