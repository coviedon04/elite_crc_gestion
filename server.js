// server.js
require('dotenv').config(); // Carga .env (importante que esté antes de db.js)
const express = require('express');
const { sql, connectDB } = require('./db'); // Importa desde db.js
const path = require('path');
const fs = require('fs'); // Importa el módulo 'fs'
const https = require('https'); // Importa el módulo 'https'
const authRoutes = require('./routes/authRoutes'); // Importa las rutas de autenticación

//Variables para HTTPS
const selfsigned = require('selfsigned');
const attributes = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attributes, { days: 365 });

const app = express();
const port = process.env.PORT || 3000;

// Variable global para almacenar el pool de conexiones
let dbPool;

// Opciones para HTTPS
/*const options = {
    key: fs.readFileSync(path.resolve(__dirname, 'private.key'), { passphrase: '4162310651' }), 
    cert: fs.readFileSync(path.resolve(__dirname, 'certificate.crt'))
};*/

const options = {
    key: pems.private,
    cert: pems.cert
};

// Ruta de Bienvenida
app.get('/', (req, res) => {
    res.send('¡Bienvenido al backend de Elite CRC Taekwondo!');
});

// Ruta de Prueba de BD
app.get('/test-db', async (req, res) => {
    if (!dbPool) {
        return res.status(500).send('Error: Pool de conexiones no inicializado.');
    }
    try {
        console.log('Probando conexión con el pool...');
        // Obtener una conexión del pool y liberarla inmediatamente
        const request = dbPool.request();
        // Hacer una consulta simple
        const result = await request.query('SELECT 1 AS number');
        console.log('Consulta de prueba exitosa:', result.recordset);
        res.status(200).send('Conexión a la base de datos usando el pool exitosa!');
    } catch (err) {
        console.error('Error al probar la conexión con el pool:', err);
        res.status(500).send('Error al probar la conexión con la base de datos.');
    }
});

// Función para iniciar el servidor (asíncrona)
const startServer = async () => {
    try {
        // 1. Conectar a la base de datos y obtener el pool
        dbPool = await connectDB(); // dbPool se asigna aquí

        app.use(express.json()); // Middleware para analizar JSON (IMPORTANTE: debe estar antes de las rutas)
        app.use(express.urlencoded({ extended: true }));

        app.use('/api/auth', authRoutes(dbPool)); // Usa las rutas de autenticación bajo el prefijo /api/auth y pasa el dbPool

        // Middleware para registrar todas las peticiones
        app.use((req, res, next) => {
            console.log('--- Nueva Petición ---');
            console.log(`Método: ${req.method}`);
            console.log(`URL: ${req.url}`);
            console.log('Cabeceras:');
            console.log(req.headers);
            console.log('Parámetros:');
            console.log(req.params);
            console.log('Cuerpo:');
            console.log(req.body);
            next(); // Llama a la siguiente función middleware
        });

        // --- Rutas de la API ---

        /*En todas se crea la ruta pasándole el pool de conexiones.
        En todas se montan las rutas bajo prefijo 
        /api/{clientes,atletas,clientes,torneos, inscripciones, pagos}*/

        // Importa y usar las rutas de clientes
        const createClienteRoutes = require('./routes/clienteRoutes');        
        const clienteRoutes = createClienteRoutes(dbPool);        
        app.use('/api/clientes', clienteRoutes);

        // Importa y usar las rutas de atletas
        const createAtletasRoutes = require('./routes/atletasRoutes');
        const atletasRoutes = createAtletasRoutes(dbPool);
        app.use('/api/clientes', atletasRoutes); // Montar las rutas bajo /api/clientes

        // Importa y usar las rutas de torneos
        const createTorneosRoutes = require('./routes/torneosRoutes');
        const torneosRoutes = createTorneosRoutes(dbPool);
        app.use('/api/torneos', torneosRoutes); // Montar las rutas bajo /api/torneos

        // Importa y usar rutas de inscripciones
        const createInscripcionesRoutes = require('./routes/inscripcionesRoutes');
        const inscripcionesRoutes = createInscripcionesRoutes(dbPool);
        app.use('/api/inscripciones', inscripcionesRoutes);

        // Importa y usar rutas de pagos
        const createPagosRoutes = require('./routes/pagosRoutes');
        const pagosRoutes = createPagosRoutes(dbPool);
        app.use('/api/pagos', pagosRoutes);

        // --- Fin Rutas de la API ---

        // 2. Una vez conectado a la BD y rutas configuradas, inicia el servidor Express
        https.createServer(options, app).listen(port, () => {
            console.log(`Servidor corriendo en https://localhost:${port}`);
            console.log('Listo para recibir peticiones.');
            
            /*// Imprime las rutas, se debe desactivar esta función, es solo para debuggear
            console.log("Rutas disponibles:");
            app._router.stack.forEach(function(middleware){
                if(middleware.route){ // routes registered directly
                    console.log(middleware.route.path, middleware.route.stack[0].method)
                } else if(middleware.handle.stack){ // router middleware
                    middleware.handle.stack.forEach(function(handler){
                        route = handler.route
                        route && console.log(route.path, route.stack[0].method)
                    })
                }
            })*/

        });

    } catch (err) {
        console.error('Error al iniciar el servidor:', err);
        process.exit(1); // Sale si no se puede iniciar
    }
};

// Llama a la función para iniciar todo
console.log("cargando aplicación");
startServer();