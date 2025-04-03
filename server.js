// server.js
require('dotenv').config(); // Carga .env (importante que esté antes de db.js)
const express = require('express');
const { sql, connectDB } = require('./db'); // Importar desde db.js
const path = require('path')

const app = express();
const port = process.env.PORT || 3001;



// Variable global para almacenar el pool de conexiones
let dbPool;

// Ruta de Bienvenida (sin cambios)
app.get('/', (req, res) => {
    res.send('¡Bienvenido al backend de Elite CRC Taekwondo!');
});

// Ruta de Prueba de BD (modificada para usar el pool)
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

// --- Aquí añadiremos las rutas de la API más adelante ---


// Función para iniciar el servidor (asíncrona)
const startServer = async () => {
    try {
        // 1. Conectar a la base de datos y obtener el pool
        dbPool = await connectDB(); // dbPool se asigna aquí

        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

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
        // Importar la función que define las rutas de cliente
        const createClienteRoutes = require('./routes/clienteRoutes');
        // Crear las rutas de cliente pasándoles el pool de conexiones
        const clienteRoutes = createClienteRoutes(dbPool);
        // Montar las rutas de cliente bajo el prefijo /api/clientes
        app.use('/api/clientes', clienteRoutes); 

        // Importar y usar las rutas de atletas
        const createAtletasRoutes = require('./routes/atletasRoutes');
        const atletasRoutes = createAtletasRoutes(dbPool);
        app.use('/api/clientes/:clienteId/atletas', atletasRoutes);
        // --- Fin Rutas de la API ---

        // 2. Una vez conectado a la BD y rutas configuradas, iniciar el servidor Express
        app.listen(port, () => {
            console.log(`Servidor corriendo en http://localhost:${port}`);
            console.log('Listo para recibir peticiones.');
        });

    } catch (err) {
        console.error('Error al iniciar el servidor:', err);
        process.exit(1); // Salir si no se puede iniciar
    }
};

// Llamar a la función para iniciar todo
console.log ("cargando aplicación")
startServer();