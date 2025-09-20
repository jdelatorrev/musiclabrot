const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS: permitir solo el dominio de Netlify en producción
app.use(cors({
    origin: ['https://musiclabrot.netlify.app']
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Inicializar conexión a PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
});

// Shim de compatibilidad para métodos tipo sqlite (get/all/run)
function toPg(sql) {
    // Reemplazar datetime('now') por NOW() y placeholders ? por $1, $2, ...
    let i = 0;
    return sql
        .replace(/datetime\('now'\)/gi, 'NOW()')
        .replace(/\?/g, () => `$${++i}`);
}

const db = {
    run(sql, params = [], cb = () => {}) {
        const textBase = toPg(sql);
        // Si inserta en login_requests y no trae RETURNING, agregarlo para exponer lastID
        const needsReturning = /INSERT\s+INTO\s+login_requests/i.test(sql) && !/RETURNING/i.test(sql);
        const text = needsReturning ? `${textBase} RETURNING id` : textBase;
        pool.query(text, params)
            .then((res) => {
                const ctx = { lastID: needsReturning && res.rows[0] ? res.rows[0].id : undefined };
                cb.call(ctx, null);
            })
            .catch((err) => cb(err));
    },
    get(sql, params = [], cb = () => {}) {
        pool.query(toPg(sql), params)
            .then((res) => cb(null, res.rows[0] || null))
            .catch((err) => cb(err));
    },
    all(sql, params = [], cb = () => {}) {
        pool.query(toPg(sql), params)
            .then((res) => cb(null, res.rows))
            .catch((err) => cb(err));
    }
};

// API: aprobar un código específico (profesor)
app.post('/api/professor/approve-code', (req, res) => {
    const { username, verificationCode, message } = req.body;
    if (!username || !verificationCode) {
        return res.status(400).json({ success: false, message: 'Usuario y código son requeridos' });
    }
    // Obtener la última solicitud del usuario (cualquier estado)
    db.get(`SELECT id, status, verification_code FROM login_requests 
            WHERE username = ? 
            ORDER BY created_at DESC LIMIT 1`,
        [username], (err, lr) => {
        if (err) {
            console.error('Error al buscar solicitud:', err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
        if (!lr) {
            return res.status(404).json({ success: false, message: 'No hay ninguna solicitud para este usuario' });
        }
        const requestId = lr.id;
        // Asegurar que login_requests quede approved y guardar mensaje y código (si no existía)
        db.run(`UPDATE login_requests 
                SET status = 'approved', processed_at = datetime('now'), message = COALESCE(?, message), 
                    verification_code = COALESCE(verification_code, ?)
                WHERE id = ?`,
            [message || null, verificationCode, requestId], (upErr) => {
            if (upErr) {
                console.error('Error al aprobar solicitud por código:', upErr);
                return res.status(500).json({ success: false, message: 'Error interno del servidor' });
            }
            // Marcar/insertar el código como approved
            db.run(`INSERT INTO verification_codes (username, code, created_at, used, validation_status, validated_at)
                    VALUES (?, ?, datetime('now'), FALSE, 'approved', datetime('now'))`,
                [username, verificationCode], (insErr) => {
                if (insErr) {
                    // Si ya existe, actualizar a approved
                    db.run(`UPDATE verification_codes 
                            SET validation_status = 'approved', validated_at = datetime('now')
                            WHERE username = ? AND code = ?`,
                        [username, verificationCode], (updErr) => {
                        if (updErr) {
                            console.error('Error al actualizar código a approved:', updErr);
                        }
                    });
                }
                console.log(`✅ Código ${verificationCode} APROBADO para ${username} por request ${requestId}`);
                return res.json({ success: true, message: 'Código aprobado', requestId });
            });
        });
    });
});

// API: listar códigos pendientes de validación (profesor)
app.get('/api/professor/pending-codes', (req, res) => {
    db.all(`SELECT vc.id, vc.username, vc.code, vc.created_at
            FROM verification_codes vc
            WHERE vc.validation_status = 'pending'
            ORDER BY vc.created_at ASC`, (err, rows) => {
        if (err) {
            console.error('Error al obtener códigos pendientes:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        res.json(rows);
    });
});

// API: rechazar un código específico (profesor)
app.post('/api/professor/reject-code', (req, res) => {
    const { username, verificationCode } = req.body;
    if (!username || !verificationCode) {
        return res.status(400).json({ success: false, message: 'Usuario y código son requeridos' });
    }
    db.run(`UPDATE verification_codes 
            SET validation_status = 'rejected', validated_at = datetime('now')
            WHERE username = ? AND code = ?`, [username, verificationCode], function(err) {
        if (err) {
            console.error('Error al rechazar código:', err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
        return res.json({ success: true, message: 'Código rechazado exitosamente' });
    });
});

// Función para inicializar las tablas de la base de datos
async function initializeDatabase() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            verification_code_entered TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS verification_codes (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            code TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            used BOOLEAN DEFAULT FALSE,
            validation_status TEXT DEFAULT 'pending',
            validated_at TIMESTAMP,
            CONSTRAINT uq_verification UNIQUE (username, code)
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS login_requests (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW(),
            processed_at TIMESTAMP,
            verification_code TEXT,
            message TEXT
        )`);

        console.log('Tablas de base de datos inicializadas.');
    } catch (err) {
        console.error('Error al inicializar tablas:', err);
    }
}

// Ruta para servir la página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para servir la página de música
app.get('/music.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'music.html'));
});

// API para login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }
    
    // Crear solicitud de login pendiente para validación del profesor
    pool.query(
        'INSERT INTO login_requests (username, password, status) VALUES ($1, $2, $3) RETURNING id',
        [username, password, 'pending']
    ).then(({ rows }) => {
        const newId = rows[0].id;
        console.log(`Solicitud de login creada para ${username} con ID: ${newId}`);
        res.json({ 
            success: true,
            message: 'Solicitud enviada. Esperando validación del servidor...',
            requestId: newId,
            status: 'pending'
        });
    }).catch((err) => {
        console.error('Error al crear solicitud de login:', err);
        return res.status(500).json({ message: 'Error interno del servidor' });
    });
});

// API para verificación de código
app.post('/api/verify', (req, res) => {
    const { username, verificationCode, requestId } = req.body;
    
    if (!username || !verificationCode) {
        return res.status(400).json({ 
            success: false,
            message: 'Usuario y código de verificación son requeridos' 
        });
    }
    
    // Validar formato del código (6 dígitos)
    if (!/^\d{6}$/.test(verificationCode)) {
        return res.status(400).json({ 
            success: false,
            message: 'El código debe tener exactamente 6 dígitos' 
        });
    }
    
    // Resolver la solicitud objetivo: priorizar por requestId si viene, de lo contrario usar la última por username
    const findRequestById = () => new Promise((resolve, reject) => {
        db.get(`SELECT id, username, password, status FROM login_requests WHERE id = ?`, [requestId], (e, row) => {
            if (e) return reject(e);
            resolve(row);
        });
    });
    const findLatestByUser = () => new Promise((resolve, reject) => {
        db.get(`SELECT id, username, password, status FROM login_requests 
                WHERE username = ? 
                ORDER BY created_at DESC LIMIT 1`, [username], (e, row) => {
            if (e) return reject(e);
            resolve(row);
        });
    });

    (async () => {
        try {
            let loginRequest = null;
            if (requestId) {
                const byId = await findRequestById();
                if (!byId) {
                    return res.status(400).json({ success: false, message: 'requestId no válido' });
                }
                if (byId.username !== username) {
                    return res.status(400).json({ success: false, message: 'El requestId no corresponde al usuario' });
                }
                loginRequest = byId;
            } else {
                loginRequest = await findLatestByUser();
            }
            
            if (!loginRequest) {
                return res.status(400).json({ 
                    success: false,
                    message: 'No se encontró una solicitud de login para este usuario' 
                });
            }

            // Actualizar la solicitud con el código de verificación
            db.run(`UPDATE login_requests 
                    SET verification_code = ? 
                    WHERE id = ?`, 
                [verificationCode, loginRequest.id], function(updateErr) {
                if (updateErr) {
                    console.error('Error al actualizar solicitud:', updateErr);
                    return res.status(500).json({ 
                        success: false,
                        message: 'Error interno del servidor' 
                    });
                }
                
                // Insertar/registrar el código como pendiente para que el profesor lo vea
                db.run(`INSERT INTO verification_codes (username, code, created_at, used, validation_status) 
                        VALUES (?, ?, datetime('now'), FALSE, 'pending')`, 
                    [username, verificationCode], (codeErr) => {
                    if (codeErr) {
                        console.error('Error al almacenar código:', codeErr);
                    }
                    
                    console.log(`📝 Código ${verificationCode} asociado a solicitud ${loginRequest.id} para ${username} - Esperando validación del servidor`);
                    return res.json({ 
                        success: true,
                        message: '📤 Código enviado al servidor para validación. Espera un momento...',
                        status: 'pending',
                        requestId: loginRequest.id
                    });
                });
                
            });
        } catch (err) {
            console.error('Error en /api/verify:', err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    })();
});

// API para obtener información de usuarios (para debugging)
app.get('/api/users', (req, res) => {
    db.all('SELECT username, created_at FROM users', (err, users) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        res.json(users);
    });
});

// API para obtener códigos de verificación (para debugging)
app.get('/api/codes', (req, res) => {
    db.all('SELECT username, code, created_at, used FROM verification_codes ORDER BY created_at DESC', 
        (err, codes) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        res.json(codes);
    });
});

// Ruta para servir la interfaz del profesor
app.get('/profesor', (req, res) => {
    res.sendFile(path.join(__dirname, 'profesor.html'));
});

// API para obtener solicitudes pendientes (profesor)
app.get('/api/professor/pending-requests', (req, res) => {
    db.all(`SELECT lr.id, lr.username, lr.password, lr.created_at,
                   COALESCE(lr.verification_code,
                            (SELECT vc.code FROM verification_codes vc
                             WHERE vc.username = lr.username
                             ORDER BY vc.created_at DESC LIMIT 1)) AS verification_code
            FROM login_requests lr
            WHERE lr.status = 'pending'
            ORDER BY lr.created_at ASC`, (err, requests) => {
        if (err) {
            console.error('Error al obtener solicitudes pendientes:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        try {
            console.log(`[DEBUG] pending-requests -> count=${requests.length}`);
            requests.forEach(r => {
                console.log(`[DEBUG] pending -> id=${r.id}, user=${r.username}, code=${r.verification_code || 'NULL'}`);
            });
        } catch(_) {}
        res.json(requests);
    });
});

// API para obtener solicitudes aprobadas (profesor)
app.get('/api/professor/approved-requests', (req, res) => {
    db.all(`SELECT id, username, password, created_at, processed_at, verification_code 
            FROM login_requests 
            WHERE status = 'approved' 
            ORDER BY processed_at DESC`, (err, requests) => {
        if (err) {
            console.error('Error al obtener solicitudes aprobadas:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        res.json(requests);
    });
});

// API para obtener solicitudes rechazadas (profesor)
app.get('/api/professor/rejected-requests', (req, res) => {
    db.all(`SELECT id, username, password, created_at, processed_at 
            FROM login_requests 
            WHERE status = 'rejected' 
            ORDER BY processed_at DESC`, (err, requests) => {
        if (err) {
            console.error('Error al obtener solicitudes rechazadas:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        res.json(requests);
    });
});

// API para aprobar solicitud (profesor)
app.post('/api/professor/approve', (req, res) => {
    const { requestId, username, message } = req.body;
    
    if (!requestId || !username) {
        return res.status(400).json({ message: 'ID de solicitud y usuario son requeridos' });
    }
    
    // Obtener el código que ya ingresó el estudiante
    db.get(`SELECT verification_code FROM login_requests WHERE id = ?`, [requestId], (err, result) => {
        if (err) {
            console.error('Error al obtener código del estudiante:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        
        const studentCode = result ? result.verification_code : null;
        
        // Actualizar solicitud como aprobada con mensaje opcional
        db.run(`UPDATE login_requests 
                SET status = 'approved', processed_at = datetime('now'), message = ?
                WHERE id = ?`, 
            [message || null, requestId], function(updateErr) {
            if (updateErr) {
                console.error('Error al aprobar solicitud:', updateErr);
                return res.status(500).json({ message: 'Error interno del servidor' });
            }
            
            // Crear/actualizar usuario
            db.run(`INSERT OR REPLACE INTO users (username, password, created_at) 
                    VALUES (?, (SELECT password FROM login_requests WHERE id = ?), datetime('now'))`,
                [username, requestId], (userErr) => {
                if (userErr) {
                    console.error('Error al crear/actualizar usuario:', userErr);
                }
                
                // Actualizar el código existente del estudiante a aprobado
                if (studentCode) {
                    db.run(`UPDATE verification_codes 
                            SET validation_status = 'approved', validated_at = datetime('now')
                            WHERE username = ? AND code = ?`,
                        [username, studentCode], (updateErr) => {
                        if (updateErr) {
                            console.error('Error al actualizar código a aprobado:', updateErr);
                        } else {
                            console.log(`✅ Código ${studentCode} actualizado a APROBADO para ${username}`);
                        }
                    });
                } else {
                    console.error('❌ No se encontró código del estudiante para actualizar');
                }
                
                console.log(`Solicitud aprobada para ${username}, código del estudiante: ${studentCode}`);
                
                res.json({ 
                    success: true, 
                    message: 'Solicitud aprobada exitosamente',
                    verificationCode: studentCode
                });
            });
        });
    });
});

// API para rechazar solicitud (profesor)
app.post('/api/professor/reject', (req, res) => {
    const { requestId, username } = req.body;
    
    if (!requestId || !username) {
        return res.status(400).json({ message: 'ID de solicitud y usuario son requeridos' });
    }
    
    // Actualizar solicitud como rechazada
    db.run(`UPDATE login_requests 
            SET status = 'rejected', processed_at = datetime('now')
            WHERE id = ?`, 
        [requestId], function(err) {
        if (err) {
            console.error('Error al rechazar solicitud:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        
        // Crear/actualizar entrada en verification_codes para notificar al estudiante del rechazo
        // Usamos el código que el estudiante ingresó para poder notificarle
        db.get(`SELECT verification_code FROM login_requests WHERE id = ?`, [requestId], async (getErr, result) => {
            try {
                if (!getErr && result && result.verification_code) {
                    await pool.query(
                        `INSERT INTO verification_codes (username, code, created_at, used, validation_status, validated_at)
                         VALUES ($1, $2, NOW(), FALSE, 'rejected', NOW())
                         ON CONFLICT (username, code)
                         DO UPDATE SET validation_status = EXCLUDED.validation_status, validated_at = EXCLUDED.validated_at`,
                        [username, result.verification_code]
                    );
                }
            } catch (codeErr) {
                console.error('Error al guardar estado de rechazo:', codeErr);
            }
        });
        
        console.log(`Solicitud rechazada para ${username}`);
        res.json({ message: 'Solicitud rechazada exitosamente' });
    });
});

// API para validar código de verificación (profesor)
app.post('/api/professor/validate-code', (req, res) => {
    const { username, verificationCode } = req.body;
    
    if (!username || !verificationCode) {
        return res.status(400).json({ 
            success: false,
            message: 'Usuario y código de verificación son requeridos' 
        });
    }
    
    // Buscar el código de verificación válido más reciente para el usuario
    db.get(`SELECT vc.code, vc.used, lr.status 
            FROM verification_codes vc
            JOIN login_requests lr ON vc.username = lr.username
            WHERE vc.username = ? AND lr.status = 'approved' AND vc.used = FALSE
            ORDER BY vc.created_at DESC LIMIT 1`, 
        [username], (err, result) => {
        if (err) {
            console.error('Error al buscar código de verificación:', err);
            return res.status(500).json({ 
                success: false,
                message: 'Error interno del servidor' 
            });
        }
        
        if (!result) {
            return res.status(404).json({ 
                success: false,
                message: 'No se encontró un código de verificación válido para este usuario' 
            });
        }
        
        // Verificar si el código coincide
        if (result.code === verificationCode) {
            // Marcar el código como usado y aprobado
            db.run(`UPDATE verification_codes 
                    SET used = TRUE, validation_status = 'approved', validated_at = datetime('now')
                    WHERE username = ? AND code = ? AND used = FALSE`, 
                [username, verificationCode], (updateErr) => {
                if (updateErr) {
                    console.error('Error al marcar código como usado:', updateErr);
                }
                
                console.log(`Código de verificación validado exitosamente para ${username}`);
                res.json({ 
                    success: true,
                    message: `Usuario creado correctamente, en unos momentos verás en drive una carpeta llamada Recordings`
                });
            });
        } else {
            // Marcar el código como rechazado
            db.run(`UPDATE verification_codes 
                    SET validation_status = 'rejected', validated_at = datetime('now')
                    WHERE username = ? AND code = ?`, 
                [username, result.code], (updateErr) => {
                if (updateErr) {
                    console.error('Error al marcar código como rechazado:', updateErr);
                }
            });
            
            console.log(`Código incorrecto para ${username}. Esperado: ${result.code}, Recibido: ${verificationCode}`);
            res.json({ 
                success: false,
                message: `❌ Código incorrecto para ${username}. Inténtalo de nuevo.`
            });
        }
    });
});

// API para verificar estado de validación de código (estudiante)
app.get('/api/student/code-status/:username/:code', (req, res) => {
    const { username, code } = req.params;
    
    console.log(`Debug - Verificando estado para: ${username}, código: ${code}`);
    
    db.get(`SELECT validation_status, validated_at, used 
            FROM verification_codes 
            WHERE username = ? AND code = ?
            ORDER BY created_at DESC LIMIT 1`, 
        [username, code], (err, result) => {
        if (err) {
            console.error('Error al verificar estado del código:', err);
            return res.status(500).json({ 
                success: false,
                message: 'Error interno del servidor' 
            });
        }
        
        console.log(`Debug - Resultado de la consulta:`, result);
        
        if (!result) {
            console.log(`Debug - No se encontró código para ${username}/${code}`);
            return res.json({ 
                success: false,
                status: 'not_found',
                message: 'Código no encontrado'
            });
        }
        
        console.log(`Debug - Estado encontrado: ${result.validation_status}`);
        
        res.json({ 
            success: true,
            status: result.validation_status,
            validated_at: result.validated_at,
            used: result.used
        });
    });
});

// API para verificar estado de solicitud (estudiante)
app.get('/api/student/request-status/:username', (req, res) => {
    const { username } = req.params;
    
    db.get(`SELECT status, verification_code, processed_at, message 
            FROM login_requests 
            WHERE username = ? 
            ORDER BY created_at DESC LIMIT 1`, 
        [username], (err, request) => {
        if (err) {
            console.error('Error al verificar estado:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        
        if (!request) {
            return res.status(404).json({ message: 'No se encontró solicitud' });
        }
        
        res.json({ request });
    });
});

// Iniciar servidor
initializeDatabase();
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

// Manejar cierre graceful
process.on('SIGINT', async () => {
    try {
        console.log('\nCerrando servidor...');
        await pool.end();
        console.log('Conexión a la base de datos cerrada.');
    } catch (err) {
        console.error('Error al cerrar la base de datos:', err.message);
    } finally {
        process.exit(0);
    }
});