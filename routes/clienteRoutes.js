// routes/clienteRoutes.js 
const express = require('express');
const { sql } = require('../db'); // Importar sql para tipos, pool se pasará
const bcrypt = require('bcrypt');
const saltRounds = 10; // Factor de coste para bcrypt

const router = express.Router(); // Crear un objeto router

// Función para configurar rutas con el pool de BD inyectado
const clienteRoutes = (dbPool) => { // Renombrado de userRoutes
    if (!dbPool) {
        throw new Error("El pool de conexiones no se ha proporcionado a clienteRoutes"); // Mensaje actualizado
    }

    // GET /api/clientes - Obtener todos los clientes // Ruta y comentario actualizados
    router.get('/', async (req, res) => {
        try {
            const request = dbPool.request();
            // Seleccionar solo columnas necesarias y NUNCA la clave
            const result = await request.query(`
                SELECT
                    u.id,
                    u.nombre,
                    u.apellidos,
                    u.correo,
                    u.telefono,
                    u.direccion,
                    u.cedula,
                    u.perfil_id,
                    p.nombre as nombre_perfil
                FROM Usuarios u
                JOIN Perfiles p ON u.perfil_id = p.id
            `);

            res.status(200).json(result.recordset); // Enviar la lista de clientes como JSON // Comentario actualizado

        } catch (err) {
            console.error('Error al obtener clientes:', err); // Mensaje actualizado
            res.status(500).json({ message: 'Error interno del servidor al obtener clientes', error: err.message }); // Mensaje actualizado
        }
    });

    // POST /api/clientes - Crear un nuevo cliente // Ruta y comentario actualizados
    router.post('/', async (req, res) => {
        // 1. Extraer datos del cuerpo de la petición (req.body)
        const { nombre, apellidos, correo, clave, perfil_id, telefono, direccion, cedula } = req.body;

        // 2. Validación básica (podríamos añadir más validaciones después)
        if (!nombre || !apellidos || !correo || !clave || !perfil_id) {
            return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, apellidos, correo, clave, perfil_id' });
        }

        try {
            // 3. Hashear la contraseña
            const claveHasheada = await bcrypt.hash(clave, saltRounds);

            // 4. Preparar la consulta SQL para insertar
            const request = dbPool.request();
            // Usar parámetros para prevenir inyección SQL
            request.input('nombre', sql.VarChar(256), nombre);
            request.input('apellidos', sql.VarChar(256), apellidos);
            request.input('correo', sql.VarChar(128), correo);
            request.input('clave', sql.VarBinary(sql.MAX), Buffer.from(claveHasheada, 'utf8')); // Guardar como VarBinary
            request.input('perfil_id', sql.UniqueIdentifier, perfil_id);
            // Añadir campos opcionales si vienen en la petición
            if (telefono) request.input('telefono', sql.VarChar(20), telefono); else request.input('telefono', sql.VarChar(20), null);
            if (direccion) request.input('direccion', sql.VarChar(512), direccion); else request.input('direccion', sql.VarChar(512), null);
            if (cedula) request.input('cedula', sql.VarChar(24), cedula); else request.input('cedula', sql.VarChar(24), null);

            // La consulta devuelve el ID del usuario recién creado
            const query = `
                INSERT INTO Usuarios (nombre, apellidos, correo, clave, perfil_id, telefono, direccion, cedula)
                OUTPUT inserted.id -- Devuelve el ID generado
                VALUES (@nombre, @apellidos, @correo, @clave, @perfil_id, @telefono, @direccion, @cedula);
            `;

            // 5. Ejecutar la consulta
            const result = await request.query(query);

            // 6. Enviar respuesta exitosa
            if (result.recordset && result.recordset.length > 0) {
                const nuevoClienteId = result.recordset[0].id;
                res.status(201).json({ message: 'Cliente creado exitosamente', clienteId: nuevoClienteId }); // Mensaje y variable actualizados
            } else {
                // Esto no debería pasar si la inserción fue exitosa y OUTPUT está bien
                console.error('Error: Inserción exitosa pero no se devolvió el ID.');
                res.status(500).json({ message: 'Error al crear cliente, no se pudo obtener el ID.' }); // Mensaje actualizado
            }

        } catch (err) {
            console.error('Error al crear cliente:', err); // Mensaje actualizado
            // Manejar errores específicos de la BD (ej. correo/cédula duplicados)
            if (err.number === 2627 || err.number === 2601) { // Códigos de error SQL Server para UNIQUE constraint violation
                if (err.message.includes('correo')) {
                    return res.status(409).json({ message: 'Error: El correo electrónico ya está registrado.' });
                } else if (err.message.includes('cedula')) {
                    return res.status(409).json({ message: 'Error: La cédula ya está registrada.' });
                }
            }
            // Error genérico
            res.status(500).json({ message: 'Error interno del servidor al crear cliente', error: err.message }); // Mensaje actualizado
        }
    }); // Fin de router.post

    return router; // Devuelve el router configurado
};

module.exports = clienteRoutes; // Exportar la función que crea las rutas // Nombre de exportación actualizado