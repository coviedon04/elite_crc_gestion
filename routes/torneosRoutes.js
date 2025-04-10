// routes/torneosRoutes.js
const express = require('express');
const { sql } = require('../db');
const router = express.Router();
const { authorize } = require('../middleware/authMiddleware');

module.exports = (dbPool) => {

    // POST /api/torneos - Crear un nuevo torneo (solo administradores y superusuarios)
    router.post('/', authorize(dbPool, ['Administrator', 'SuperUsuario']), async (req, res) => {
        const { nombre, fecha_inicio, fecha_fin, lugar, descripcion, costo } = req.body;

        // Validación básica
        if (!nombre || !fecha_inicio || !fecha_fin) {
            return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, fecha_inicio, fecha_fin' });
        }

        try {
            // Preparar la consulta SQL para insertar el torneo
            const request = dbPool.request();
            request.input('nombre', sql.VarChar(255), nombre);
            request.input('fecha_inicio', sql.Date, fecha_inicio);
            request.input('fecha_fin', sql.Date, fecha_fin);

            // Campos opcionales
            if (lugar) request.input('lugar', sql.VarChar(255), lugar); else request.input('lugar', sql.VarChar(255), null);
            if (descripcion) request.input('descripcion', sql.VarChar(1024), descripcion); else request.input('descripcion', sql.VarChar(1024), null);
            if (costo) request.input('costo', sql.Decimal(10, 2), costo); else request.input('costo', sql.Decimal(10, 2), null);

            const query = `
                INSERT INTO Torneos (nombre, fecha_inicio, fecha_fin, lugar, descripcion, costo)
                OUTPUT inserted.id
                VALUES (@nombre, @fecha_inicio, @fecha_fin, @lugar, @descripcion, @costo);
            `;

            // Ejecutar la consulta
            const result = await request.query(query);

            // Enviar respuesta exitosa
            if (result.recordset && result.recordset.length > 0) {
                const nuevoTorneoId = result.recordset[0].id;
                res.status(201).json({ message: 'Torneo creado exitosamente', torneoId: nuevoTorneoId });
            } else {
                console.error('Error: Inserción exitosa pero no se devolvió el ID.');
                res.status(500).json({ message: 'Error al crear el torneo, no se pudo obtener el ID.' });
            }

        } catch (err) {
            console.error('Error al crear torneo:', err);
            res.status(500).json({ message: 'Error interno del servidor al crear torneo', error: err.message });
        }
    });

    // GET /api/torneos - Listar todos los torneos activos (todos los usuarios autenticados)
    router.get('/', authorize(dbPool, ['Cliente', 'Administrator', 'SuperUsuario']), async (req, res) => {
        try {
            // Preparar la consulta SQL para obtener los torneos activos
            const request = dbPool.request();
            const query = `
                SELECT id, nombre, fecha_inicio, fecha_fin, lugar, descripcion, costo
                FROM Torneos
                WHERE CONVERT(DATE, fecha_fin) >= CONVERT(DATE, GETDATE());
            `;

            // Ejecutar la consulta
            const result = await request.query(query);

            // Enviar la lista de torneos
            res.status(200).json(result.recordset);

        } catch (err) {
            console.error('Error al listar torneos:', err);
            res.status(500).json({ message: 'Error interno del servidor al listar torneos', error: err.message });
        }
    });
    
     // GET /api/torneos/:id - Obtener la información de un torneo específico (todos los usuarios autenticados)
     router.get('/:id', authorize(dbPool, ['Cliente', 'Administrator', 'SuperUsuario']), async (req, res) => {
        const torneoId = req.params.id;

        // Validación básica
        if (!torneoId) {
            return res.status(400).json({ message: 'Falta el ID del torneo' });
        }

        try {
            // Verificar que el ID del torneo sea un UUID válido
            if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(torneoId)) {
                return res.status(400).json({ message: 'El ID del torneo no tiene un formato UUID válido.' });
            }

            // Preparar la consulta SQL para obtener la información del torneo
            const request = dbPool.request();
            request.input('torneoId', sql.UniqueIdentifier, torneoId);

            const query = `
                SELECT id, nombre, fecha_inicio, fecha_fin, lugar, descripcion, costo
                FROM Torneos
                WHERE id = @torneoId;
            `;

            // Ejecutar la consulta
            const result = await request.query(query);

            // Verificar si se encontró el torneo
            if (result.recordset && result.recordset.length > 0) {
                // Enviar la información del torneo
                res.status(200).json(result.recordset[0]);
            } else {
                res.status(404).json({ message: 'Torneo no encontrado' });
            }

        } catch (err) {
            console.error('Error al obtener la información del torneo:', err);
            res.status(500).json({ message: 'Error interno del servidor al obtener la información del torneo', error: err.message });
        }
    });

       // PUT /api/torneos/:id - Actualizar la información de un torneo específico (solo administradores y superusuarios)
       router.put('/:id', authorize(dbPool, ['Administrator', 'SuperUsuario']), async (req, res) => {
        const torneoId = req.params.id;
        const { nombre, fecha_inicio, fecha_fin, lugar, descripcion, costo } = req.body;

        // Validación básica
        if (!torneoId) {
            return res.status(400).json({ message: 'Falta el ID del torneo' });
        }

        // Verificar que el ID del torneo sea un UUID válido
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(torneoId)) {
            return res.status(400).json({ message: 'El ID del torneo no tiene un formato UUID válido.' });
        }

        // Si no hay campos para actualizar, devolver un error
        if (!nombre && !fecha_inicio && !fecha_fin && !lugar && !descripcion && !costo) {
            return res.status(400).json({ message: 'Debe proporcionar al menos un campo para actualizar' });
        }

        try {
            // Construir la consulta SQL dinámicamente
            let query = 'UPDATE Torneos SET ';
            const updates = [];

            if (nombre) {
                updates.push('nombre = @nombre');
            }
            if (fecha_inicio) {
                updates.push('fecha_inicio = @fecha_inicio');
            }
            if (fecha_fin) {
                updates.push('fecha_fin = @fecha_fin');
            }
            if (lugar) {
                updates.push('lugar = @lugar');
            }
            if (descripcion) {
                updates.push('descripcion = @descripcion');
            }
            if (costo) {
                updates.push('costo = @costo');
            }

            query += updates.join(', ');
            query += ' WHERE id = @torneoId;';

            // Preparar la consulta SQL
            const request = dbPool.request();
            request.input('torneoId', sql.UniqueIdentifier, torneoId);

            if (nombre) {
                request.input('nombre', sql.VarChar(255), nombre);
            }
            if (fecha_inicio) {
                request.input('fecha_inicio', sql.Date, fecha_inicio);
            }
            if (fecha_fin) {
                request.input('fecha_fin', sql.Date, fecha_fin);
            }
            if (lugar) {
                request.input('lugar', sql.VarChar(255), lugar);
            }
            if (descripcion) {
                request.input('descripcion', sql.VarChar(1024), descripcion);
            }
            if (costo) {
                request.input('costo', sql.Decimal(10, 2), costo);
            }

            // Ejecutar la consulta
            const result = await request.query(query);

            // Verificar si se actualizó el torneo
            if (result.rowsAffected[0] > 0) {
                res.status(200).json({ message: 'Torneo actualizado exitosamente' });
            } else {
                res.status(404).json({ message: 'Torneo no encontrado' });
            }

        } catch (err) {
            console.error('Error al actualizar torneo:', err);
            res.status(500).json({ message: 'Error interno del servidor al actualizar torneo', error: err.message });
        }
    });

        // DELETE /api/torneos/:id - Eliminar un torneo específico (solo administradores y superusuarios)
        router.delete('/:id', authorize(dbPool, ['Administrator', 'SuperUsuario']), async (req, res) => {
            const torneoId = req.params.id;
    
            // Validación básica
            if (!torneoId) {
                return res.status(400).json({ message: 'Falta el ID del torneo' });
            }
    
            // Verificar que el ID del torneo sea un UUID válido
            if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(torneoId)) {
                return res.status(400).json({ message: 'El ID del torneo no tiene un formato UUID válido.' });
            }
    
            try {
                // Preparar la consulta SQL para eliminar el torneo
                const request = dbPool.request();
                request.input('torneoId', sql.UniqueIdentifier, torneoId);
    
                const query = `
                    DELETE FROM Torneos
                    WHERE id = @torneoId;
                `;
    
                // Ejecutar la consulta
                const result = await request.query(query);
    
                // Verificar si se eliminó el torneo
                if (result.rowsAffected[0] > 0) {
                    res.status(200).json({ message: 'Torneo eliminado exitosamente' });
                } else {
                    res.status(404).json({ message: 'Torneo no encontrado' });
                }
    
            } catch (err) {
                console.error('Error al eliminar el torneo:', err);
                res.status(500).json({ message: 'Error interno del servidor al eliminar el torneo', error: err.message });
            }
        });
        
    return router;
};