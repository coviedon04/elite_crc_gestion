// routes/inscripcionesRoutes.js
const express = require('express');
const { sql } = require('../db');
const router = express.Router();
const { authorize } = require('../middleware/authMiddleware');

//Configura las rutas de inscripciones
module.exports = (dbPool) => {

    // POST /api/inscripciones - Crea una nueva inscripción (administradores, superusuarios y clientes)
    router.post('/', authorize(dbPool, ['Cliente', 'Administrator', 'SuperUsuario']), async (req, res) => {
        const { atleta_id, torneo_id, fecha_inscripcion, pago_confirmado } = req.body;
        const userRole = req.userRole;
        const userId = req.userId; // Obtener el ID del usuario autenticado

        // Validación básica
        if (!atleta_id || !torneo_id || !fecha_inscripcion) {
            return res.status(400).json({ message: 'Faltan campos obligatorios: atleta_id, torneo_id, fecha_inscripcion' });
        }

        try {
            // Verifica que el atleta_id y el torneo_id sean UUIDs válidos
            if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(atleta_id) ||
                !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(torneo_id)) {
                return res.status(400).json({ message: 'atleta_id o torneo_id no tienen un formato UUID válido.' });
            }

            // Prepara la consulta SQL para insertar la inscripción
            const request = dbPool.request();
            request.input('atleta_id', sql.UniqueIdentifier, atleta_id);
            request.input('torneo_id', sql.UniqueIdentifier, torneo_id);
            request.input('fecha_inscripcion', sql.Date, fecha_inscripcion);

            // Campos opcionales
            if (pago_confirmado !== undefined) request.input('pago_confirmado', sql.Bit, pago_confirmado); else request.input('pago_confirmado', sql.Bit, 0); // Valor predeterminado: 0

            let query = `
                INSERT INTO Inscripciones (atleta_id, torneo_id, fecha_inscripcion, pago_confirmado)
                OUTPUT inserted.id
                VALUES (@atleta_id, @torneo_id, @fecha_inscripcion, @pago_confirmado)
            `;

            // Si el usuario es Cliente, verifica que el atleta pertenece al cliente
            if (userRole === 'Cliente') {
                // Verifica si el atleta pertenece al cliente
                const checkAtletaQuery = `
                    SELECT 1
                    FROM Atletas
                    WHERE id = @atleta_id AND encargado_id = @userId
                `;
                request.input('userId', sql.UniqueIdentifier, userId);

                const checkAtletaResult = await request.query(checkAtletaQuery);

                if (checkAtletaResult.recordset.length === 0) {
                    return res.status(403).json({ message: 'No tiene permisos para inscribir a este atleta' });
                }
            }

            // Ejecutar la consulta
            const result = await request.query(query);

            // Envia respuesta exitosa
            if (result.recordset && result.recordset.length > 0) {
                const nuevaInscripcionId = result.recordset[0].id;
                res.status(201).json({ message: 'Inscripción creada exitosamente', inscripcionId: nuevaInscripcionId });
            } else {
                console.error('Error: Inserción exitosa pero no se devolvió el ID.');
                res.status(500).json({ message: 'Error al crear la inscripción, no se pudo obtener el ID.' });
            }

        } catch (err) {
            console.error('Error al crear inscripción:', err);
            res.status(500).json({ message: 'Error interno del servidor al crear inscripción', error: err.message });
        }
    });

    // GET /api/inscripciones - Lista todas las inscripciones (todos los usuarios autenticados)
    router.get('/', authorize(dbPool, ['Cliente', 'Administrator', 'SuperUsuario']), async (req, res) => {
        const userRole = req.userRole;
        const userId = req.userId;

        try {
            // Prepara la consulta SQL
            const request = dbPool.request();
            let query = `
                SELECT
                    i.id,
                    a.nombre AS nombre_atleta, /* Agregar el nombre del atleta */
                    a.apellidos AS apellidos_atleta,  /* Agregar los apellidos del atleta */
                    t.nombre AS nombre_torneo,  /* Agregar el nombre del torneo */
                    FORMAT(i.fecha_inscripcion, 'yyyy-MM-dd') AS fecha_inscripcion, /* Formatear la fecha */
                    i.pago_confirmado
                FROM Inscripciones i
                INNER JOIN Atletas a ON i.atleta_id = a.id
                INNER JOIN Torneos t ON i.torneo_id = t.id
            `;

            // Si el usuario es Cliente, agrega condición para filtrar por los atletas del cliente
            if (userRole === 'Cliente') {
                query += `
                    WHERE a.encargado_id = @userId
                `;
                request.input('userId', sql.UniqueIdentifier, userId);
            }

            // Ejecuta la consulta
            const result = await request.query(query);

            // Envia la lista de inscripciones
            res.status(200).json(result.recordset);

        } catch (err) {
            console.error('Error al listar inscripciones:', err);
            res.status(500).json({ message: 'Error interno del servidor al listar inscripciones', error: err.message });
        }
    });

    // GET /api/inscripciones/:id - Obtiene la información de una inscripción específica (todos los usuarios autenticados)
    router.get('/:id', authorize(dbPool, ['Cliente', 'Administrator', 'SuperUsuario']), async (req, res) => {
        const inscripcionId = req.params.id;
        const userRole = req.userRole;
        const userId = req.userId;

        // Validación básica
        if (!inscripcionId) {
            return res.status(400).json({ message: 'Falta el ID de la inscripción' });
        }

        try {
            // Verifica que el ID de la inscripción sea un UUID válido
            if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(inscripcionId)) {
                return res.status(400).json({ message: 'El ID de la inscripción no tiene un formato UUID válido.' });
            }

            // Prepara la consulta SQL para obtener la información de la inscripción
            const request = dbPool.request();
            request.input('inscripcionId', sql.UniqueIdentifier, inscripcionId);

            let query = `
                SELECT
                    i.id,
                    a.nombre AS nombre_atleta,
                    t.nombre AS nombre_torneo,
                    FORMAT(i.fecha_inscripcion, 'yyyy-MM-dd') AS fecha_inscripcion,
                    i.pago_confirmado
                FROM Inscripciones i
                INNER JOIN Atletas a ON i.atleta_id = a.id
                INNER JOIN Torneos t ON i.torneo_id = t.id
                WHERE i.id = @inscripcionId
            `;

            // Si el usuario es Cliente, agrega la condición para verificar que la inscripción pertenece al cliente
            if (userRole === 'Cliente') {
                query += ` AND a.encargado_id = @userId`;
                request.input('userId', sql.UniqueIdentifier, userId);
            }

            // Ejecuta la consulta
            const result = await request.query(query);

            // Verifica si se encontró la inscripción
            if (result.recordset && result.recordset.length > 0) {
                // Envia la información de la inscripción
                res.status(200).json(result.recordset[0]);
            } else {
                res.status(404).json({ message: 'Inscripción no encontrada' });
            }

        } catch (err) {
            console.error('Error al obtener la información de la inscripción:', err);
            res.status(500).json({ message: 'Error interno del servidor al obtener la información de la inscripción', error: err.message });
        }
    });

    // PUT /api/inscripciones/:id - Actualiza la información de una inscripción específica (solo administradores y superusuarios)
    router.put('/:id', authorize(dbPool, ['Administrator', 'SuperUsuario']), async (req, res) => {
        const inscripcionId = req.params.id;
        const { atleta_id, torneo_id, fecha_inscripcion, pago_confirmado } = req.body;

        // Validación básica
        if (!inscripcionId) {
            return res.status(400).json({ message: 'Falta el ID de la inscripción' });
        }

        // Verifica que el ID de la inscripción sea un UUID válido
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(inscripcionId)) {
            return res.status(400).json({ message: 'El ID de la inscripción no tiene un formato UUID válido.' });
        }

        // Si no hay campos para actualizar, devolver un error
        if (!atleta_id && !torneo_id && !fecha_inscripcion && (pago_confirmado === undefined)) {
            return res.status(400).json({ message: 'Debe proporcionar al menos un campo para actualizar' });
        }

        try {
            // Construye la consulta SQL dinámicamente
            let query = 'UPDATE Inscripciones SET ';
            const updates = [];

            if (atleta_id) {
                updates.push('atleta_id = @atleta_id');
            }
            if (torneo_id) {
                updates.push('torneo_id = @torneo_id');
            }
            if (fecha_inscripcion) {
                updates.push('fecha_inscripcion = @fecha_inscripcion');
            }
            if (pago_confirmado !== undefined) {
                updates.push('pago_confirmado = @pago_confirmado');
            }

            query += updates.join(', ');
            query += ' WHERE id = @inscripcionId;';

            // Prepara la consulta SQL
            const request = dbPool.request();
            request.input('inscripcionId', sql.UniqueIdentifier, inscripcionId);

            if (atleta_id) {
                request.input('atleta_id', sql.UniqueIdentifier, atleta_id);
            }
            if (torneo_id) {
                request.input('torneo_id', sql.UniqueIdentifier, torneo_id);
            }
            if (fecha_inscripcion) {
                request.input('fecha_inscripcion', sql.Date, fecha_inscripcion);
            }
            if (pago_confirmado !== undefined) {
                request.input('pago_confirmado', sql.Bit, pago_confirmado);
            }

            // Ejecuta la consulta
            const result = await request.query(query);

            // Verifica si se actualizó la inscripción
            if (result.rowsAffected[0] > 0) {
                res.status(200).json({ message: 'Inscripción actualizada exitosamente' });
            } else {
                res.status(404).json({ message: 'Inscripción no encontrada' });
            }

        } catch (err) {
            console.error('Error al actualizar inscripción:', err);
            res.status(500).json({ message: 'Error interno del servidor al actualizar inscripción', error: err.message });
        }
    });

    // DELETE /api/inscripciones/:id - Elimina una inscripción específica (solo administradores y superusuarios)
    router.delete('/:id', authorize(dbPool, ['Administrator', 'SuperUsuario']), async (req, res) => {
        const inscripcionId = req.params.id;

        // Validación básica
        if (!inscripcionId) {
            return res.status(400).json({ message: 'Falta el ID de la inscripción' });
        }

        // Verifica que el ID de la inscripción sea un UUID válido
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(inscripcionId)) {
            return res.status(400).json({ message: 'El ID de la inscripción no tiene un formato UUID válido.' });
        }

        try {
            // Prepara la consulta SQL para eliminar la inscripción
            const request = dbPool.request();
            request.input('inscripcionId', sql.UniqueIdentifier, inscripcionId);

            const query = `
                DELETE FROM Inscripciones
                WHERE id = @inscripcionId;
            `;

            // Ejecuta la consulta
            const result = await request.query(query);

            // Verifica si se eliminó la inscripción
            if (result.rowsAffected[0] > 0) {
                res.status(200).json({ message: 'Inscripción eliminada exitosamente' });
            } else {
                res.status(404).json({ message: 'Inscripción no encontrada' });
            }

        } catch (err) {
            console.error('Error al eliminar inscripción:', err);
            res.status(500).json({ message: 'Error interno del servidor al eliminar inscripción', error: err.message });
        }
    });

    return router;
};