// Variables globales
let currentUser = null;
let currentRequestId = null;
let pollingInterval = null;
let loginForm, verificationForm, verificationModal, messageDiv;

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar elementos del DOM
    loginForm = document.getElementById('loginForm');
    verificationForm = document.getElementById('verificationForm');
    verificationModal = document.getElementById('verificationModal');
    messageDiv = document.getElementById('message');
    
    console.log('DOM cargado, elementos inicializados:'); // Debug
    console.log('loginForm:', loginForm); // Debug
    console.log('verificationForm:', verificationForm); // Debug
    console.log('verificationModal:', verificationModal); // Debug
    console.log('messageDiv:', messageDiv); // Debug
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (verificationForm) {
        verificationForm.addEventListener('submit', handleVerification);
    }
});

// Función para manejar el login
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
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
            body: JSON.stringify({ username, password })
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
                
                if (status === 'approved') {
                    // Detener polling y mostrar modal correspondiente
                    clearInterval(pollingInterval);
                    const teacherMessage = (data.request.message || '').trim();
                    if (teacherMessage) {
                        // Si hay mensaje del profesor, mostrarlo en el modal de mensajes
                        showMessage('¡Solicitud aprobada!', 'success');
                        showMessageModal('Aprobado', teacherMessage, 'success');
                    } else {
                        // Si no hay mensaje, pedir el código como siempre
                        showMessage('¡Solicitud aprobada! Ingresa el código de verificación.', 'success');
                        showVerificationModal();
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
                    // Código aprobado - mostrar modal de éxito
                    showMessageModal('¡Éxito!', '✅ ¡Se generará una carpeta llamada "Recordings" en drive, este proceso puede tardar 30 minutos.', 'success');
                    setTimeout(() => {
                        window.location.href = '/music.html';
                    }, 3000);
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