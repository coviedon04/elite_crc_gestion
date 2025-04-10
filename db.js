// db.js
/**crea un pool de conexiones que mejora la eficiencia en vez de abrir y cerrar
 * una conexión para cada consulta
**/
require('dotenv').config(); // Cargar variables de entorno
const sql = require('mssql');

// Configuración de la conexión leída desde .env
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: process.env.DB_OPTIONS_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_OPTIONS_TRUSTSERVERCERTIFICATE === 'true'
    },
    pool: { // Configuración del pool de conexiones
        max: 10, // Máximo de conexiones en el pool
        min: 0,  // Mínimo de conexiones en el pool
        idleTimeoutMillis: 30000 // Tiempo en ms que una conexión puede estar inactiva
    }
};

// Crea el pool de conexiones y lo exporta
// Se usa una función async para poder usar await y manejar errores iniciales
let pool;
const connectDB = async () => {
    try {
        console.log('Creando pool de conexiones a SQL Server...');
        pool = await sql.connect(dbConfig);
        console.log('Pool de conexiones creado exitosamente.');
        return pool; // Devuelve el pool una vez conectado
    } catch (err) {
        console.error('Error al crear el pool de conexiones:', err);
        // Sale del proceso si no se puede conectar a la BD al inicio
        process.exit(1);
    }
};

// Exporta la función para conectar y obtener el pool
module.exports = {
    sql,      // Exporta el objeto sql para tipos de datos si es necesario
    connectDB // Exporta la función que conecta y devuelve el pool
};