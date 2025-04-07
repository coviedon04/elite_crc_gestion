// routes/atletasRoutes.js
const express = require('express');
const { sql } = require('../db'); // Importar sql para tipos
const router = express.Router();
const { authorize } = require('../middleware/authMiddleware'); // Importar el middleware authorize

// Función para configurar las rutas de atletas
const atletasRoutes = (dbPool) => {
    if (!dbPool) {
        throw new Error("El pool de conexiones no se ha proporcionado a atletasRoutes");
    }

    // POST /api/clientes/:clienteId/atletas - Crear un nuevo atleta asociado a un cliente
    router.post('/:clienteId/atletas', async (req, res) => { //RUTA CORREGIDA
        console.log("params", req.params.clienteId);
        console.log("body", req.body);
        const clienteId = req.params.clienteId; // Obtener el ID del cliente de los parámetros de la URL
        const { nombre, apellidos, fecha_nacimiento, categoria, peso, grado } = req.body; // Obtener datos del atleta del cuerpo de la petición

        // Validación básica
        if (!clienteId || !nombre || !apellidos || !fecha_nacimiento) {
            return res.status(400).json({ message: 'Faltan campos obligatorios: clienteId, nombre, apellidos, fecha_nacimiento' });
        }

        try {
            // Verificar que el clienteId sea un UUID válido
            if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clienteId)) {
                return res.status(400).json({ message: 'clienteId no tiene un formato UUID válido.' });
            }

            // Preparar la consulta SQL para insertar el atleta
            const request = dbPool.request();
            request.input('clienteId', sql.UniqueIdentifier, clienteId);
            request.input('nombre', sql.VarChar(256), nombre);
            request.input('apellidos', sql.VarChar(256), apellidos);
            request.input('fecha_nacimiento', sql.Date, fecha_nacimiento);

            // Campos opcionales
            if (categoria) request.input('categoria', sql.VarChar(50), categoria); else request.input('categoria', sql.VarChar(50), null);
            if (peso) request.input('peso', sql.Decimal(5, 2), peso); else request.input('peso', sql.Decimal(5, 2), null);
            if (grado) request.input('grado', sql.VarChar(20), grado); else request.input('grado', sql.VarChar(20), null);

            const query = `
                INSERT INTO Atletas (encargado_id, nombre, apellidos, fecha_nacimiento, categoria, peso, grado)
                OUTPUT inserted.id
                VALUES (@clienteId, @nombre, @apellidos, @fecha_nacimiento, @categoria, @peso, @grado);
            `;

            // Ejecutar la consulta
            const result = await request.query(query);

            // Enviar respuesta exitosa
            if (result.recordset && result.recordset.length > 0) {
                const nuevoAtletaId = result.recordset[0].id;
                return res.status(201).json({ message: 'Atleta creado exitosamente', atletaId: nuevoAtletaId }); // Return añadido
            } else {
                console.error('Error: Inserción exitosa pero no se devolvió el ID.');
                return res.status(500).json({ message: 'Error al crear el atleta, no se pudo obtener el ID.' }); // Return añadido
            }

        } catch (err) {
            console.error('Error al crear atleta:', err);
            return res.status(500).json({ message: 'Error interno del servidor al crear atleta', error: err.message }); // Return añadido
        }
    });

    // GET /api/clientes/:clienteId/atletas - Listar atletas asociados a un cliente (solo clientes, administradores y superusuarios)
    router.get('/:clienteId/atletas', authorize(dbPool,['Cliente', 'Administrator', 'SuperUsuario']), async (req, res) => {
        const clienteId = req.params.clienteId;

        // Validación básica
        if (!clienteId) {
            return res.status(400).json({ message: 'Falta el clienteId' });
        }

        try {
            // Verificar que el clienteId sea un UUID válido
            if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clienteId)) {
                return res.status(400).json({ message: 'clienteId no tiene un formato UUID válido.' });
            }

            // Preparar la consulta SQL para obtener los atletas
            const request = dbPool.request();
            request.input('clienteId', sql.UniqueIdentifier, clienteId);

            const query = `
                SELECT id, nombre, apellidos, categoria
                FROM Atletas
                WHERE encargado_id = @clienteId;
            `;

            // Ejecutar la consulta
            const result = await request.query(query);

            // Enviar la lista de atletas
            res.status(200).json(result.recordset);

        } catch (err) {
            console.error('Error al listar atletas:', err);
            res.status(500).json({ message: 'Error interno del servidor al listar atletas', error: err.message });
        }
    });


    // PUT /api/clientes/:clienteId/atletas/:atletaId - Editar atleta (Clientes: categoria, peso, grado; Administradores: todos los campos)
    router.put('/:clienteId/atletas/:atletaId', authorize(dbPool, ['Cliente', 'Administrator', 'SuperUsuario']), async (req, res) => {
        const clienteId = req.params.clienteId;
        const atletaId = req.params.atletaId;
        const { nombre, apellidos, fecha_nacimiento, categoria, peso, grado } = req.body; // Incluir todos los campos

        // Validación básica
        if (!clienteId || !atletaId) {
            return res.status(400).json({ message: 'Faltan clienteId o atletaId' });
        }

        // Obtener el rol del usuario desde el objeto de solicitud
        const userRole = req.userRole;

        // Construir la consulta SQL dinámicamente
        let query = 'UPDATE Atletas SET ';
        const updates = [];

        if (userRole === 'Cliente') {
            // Clientes solo pueden editar categoria, peso y grado
            if (categoria) {
                updates.push('categoria = @categoria');
            }
            if (peso) {
                updates.push('peso = @peso');
            }
            if (grado) {
                updates.push('grado = @grado');
            }

            // Validación para clientes
            if (!categoria && !peso && !grado) { // Verificar solo los campos permitidos para clientes
                return res.status(400).json({ message: 'Debe proporcionar al menos un campo para actualizar (categoria, peso, grado)' });
            }
        } else if (userRole === 'Administrator' || userRole === 'SuperUsuario') {
            // Administradores y SuperUsuarios pueden editar todos los campos
            if (nombre) {
                updates.push('nombre = @nombre');
            }
            if (apellidos) {
                updates.push('apellidos = @apellidos');
            }
            if (fecha_nacimiento) {
                updates.push('fecha_nacimiento = @fecha_nacimiento');
            }
            if (categoria) {
                updates.push('categoria = @categoria');
            }
            if (peso) {
                updates.push('peso = @peso');
            }
            if (grado) {
                updates.push('grado = @grado');
            }

            // Validación para administradores y superusuarios
            if (!nombre && !apellidos && !fecha_nacimiento && !categoria && !peso && !grado) { // Verificar todos los campos
                return res.status(400).json({ message: 'Debe proporcionar al menos un campo para actualizar' });
            }
        }

        // Si no hay campos para actualizar, devolver un error
        if (updates.length === 0) {
            return res.status(400).json({ message: 'No hay campos válidos para actualizar según su rol' });
        }

        query += updates.join(', ');

        // Construir la condición WHERE dinámicamente
        let whereClause = ' WHERE id = @atletaId';
        if (userRole === 'Cliente') {
            whereClause += ' AND encargado_id = @clienteId';
        }

        query += whereClause + ';';

        // Preparar la consulta SQL
        const request = dbPool.request();
        request.input('atletaId', sql.UniqueIdentifier, atletaId);
        request.input('clienteId', sql.UniqueIdentifier, clienteId);

        if (nombre) {
            request.input('nombre', sql.VarChar(256), nombre);
        }
        if (apellidos) {
            request.input('apellidos', sql.VarChar(256), apellidos);
        }
        if (fecha_nacimiento) {
            request.input('fecha_nacimiento', sql.Date, fecha_nacimiento);
        }
        if (categoria) {
            request.input('categoria', sql.VarChar(50), categoria);
        }
        if (peso) {
            request.input('peso', sql.Decimal(5, 2), peso);
        }
        if (grado) {
            request.input('grado', sql.VarChar(20), grado);
        }

        try {
            // Ejecutar la consulta
            const result = await request.query(query);

            // Verificar si se actualizó el atleta
            if (result.rowsAffected[0] > 0) {
                res.status(200).json({ message: 'Atleta actualizado exitosamente' });
            } else {
                res.status(404).json({ message: 'Atleta no encontrado o no pertenece al cliente especificado' });
            }
        } catch (err) {
            console.error('Error al editar atleta:', err);
            res.status(500).json({ message: 'Error interno del servidor al editar atleta', error: err.message });
        }
    });

    // DELETE /api/clientes/:clienteId/atletas/:atletaId - Inhabilitar/Habilitar un atleta (solo administradores)
    router.delete('/:clienteId/atletas/:atletaId', authorize(dbPool,['Administrator', 'SuperUsuario']), async (req, res) => {
        const clienteId = req.params.clienteId;
        const atletaId = req.params.atletaId;

        // Validación básica
        if (!clienteId || !atletaId) {
            return res.status(400).json({ message: 'Faltan clienteId o atletaId' });
        }

        try {
            // Verificar que el clienteId y el atletaId sean UUIDs válidos
            if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clienteId) ||
                !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(atletaId)) {
                return res.status(400).json({ message: 'clienteId o atletaId no tienen un formato UUID válido.' });
            }

            // Preparar la consulta SQL para alternar el estado del atleta
            const request = dbPool.request();
            request.input('atletaId', sql.UniqueIdentifier, atletaId);
            request.input('clienteId', sql.UniqueIdentifier, clienteId);

            const query = `
                UPDATE Atletas
                SET activo = CASE
                    WHEN activo = 1 THEN 0
                    ELSE 1
                END
                WHERE id = @atletaId AND encargado_id = @clienteId;
            `;

            // Ejecutar la consulta
            const result = await request.query(query);

            // Verificar si se actualizó el atleta
            if (result.rowsAffected[0] > 0) {
                res.status(200).json({ message: 'Estado del atleta actualizado exitosamente' });
            } else {
                res.status(404).json({ message: 'Atleta no encontrado o no pertenece al cliente especificado' });
            }

        } catch (err) {
            console.error('Error al actualizar estado del atleta:', err);
            res.status(500).json({ message: 'Error interno del servidor al actualizar estado del atleta', error: err.message });
        }
    });

    return router;
};

module.exports = atletasRoutes;