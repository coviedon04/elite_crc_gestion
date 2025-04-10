// routes/pagosRoutes.js
const express = require('express');
const { sql } = require('../db');
const router = express.Router();
const { authorize } = require('../middleware/authMiddleware');

module.exports = (dbPool) => {

    // POST /api/pagos - Registrar un nuevo pago (solo administradores y superusuarios)
    router.post('/', authorize(dbPool, ['Administrator', 'SuperUsuario']), async (req, res) => {
        const { atleta_id, tipo_pago, monto, fecha_pago, descripcion } = req.body;

        // Validación básica
        if (!atleta_id || !tipo_pago || !monto || !fecha_pago) {
            return res.status(400).json({ message: 'Faltan campos obligatorios: atleta_id, tipo_pago, monto, fecha_pago' });
        }

        try {
            // Verificar que el atleta_id sea un UUID válido
            if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(atleta_id)) {
                return res.status(400).json({ message: 'atleta_id no tiene un formato UUID válido.' });
            }

            // Preparar la consulta SQL para insertar el pago
            const request = dbPool.request();
            request.input('atleta_id', sql.UniqueIdentifier, atleta_id);
            request.input('tipo_pago', sql.VarChar(50), tipo_pago);
            request.input('monto', sql.Decimal(10, 2), monto);
            request.input('fecha_pago', sql.Date, fecha_pago);

            // Campos opcionales
            if (descripcion) request.input('descripcion', sql.VarChar(1024), descripcion); else request.input('descripcion', sql.VarChar(1024), null);

            const query = `
                INSERT INTO Pagos (atleta_id, tipo_pago, monto, fecha_pago, descripcion)
                OUTPUT inserted.id
                VALUES (@atleta_id, @tipo_pago, @monto, @fecha_pago, @descripcion);
            `;

            // Ejecutar la consulta
            const result = await request.query(query);

            // Enviar respuesta exitosa
            if (result.recordset && result.recordset.length > 0) {
                const nuevoPagoId = result.recordset[0].id;
                res.status(201).json({ message: 'Pago registrado exitosamente', pagoId: nuevoPagoId });
            } else {
                console.error('Error: Inserción exitosa pero no se devolvió el ID.');
                res.status(500).json({ message: 'Error al registrar el pago, no se pudo obtener el ID.' });
            }

        } catch (err) {
            console.error('Error al registrar pago:', err);
            res.status(500).json({ message: 'Error interno del servidor al registrar pago', error: err.message });
        }
    });

    // GET /api/pagos - Listar todos los pagos (todos los usuarios autenticados)
    router.get('/', authorize(dbPool, ['Cliente', 'Administrator', 'SuperUsuario']), async (req, res) => {
        const userRole = req.userRole;
        const userId = req.userId;

        try {
            // Preparar la consulta SQL
            const request = dbPool.request();
            let query = `
                SELECT
                    p.id,
                    a.nombre AS nombre_atleta, /* Agregar el nombre del atleta */
                    a.apellidos AS apellidos_atleta, /* Agregar los apellidos del atleta */
                    p.tipo_pago,
                    p.monto,
                    FORMAT(p.fecha_pago, 'yyyy-MM-dd') AS fecha_pago, /* Formatear la fecha */
                    p.descripcion
                FROM Pagos p
                INNER JOIN Atletas a ON p.atleta_id = a.id
            `;

            // Si el usuario es Cliente, agregar condición para filtrar por los atletas del cliente
            if (userRole === 'Cliente') {
                query += `
                    WHERE a.encargado_id = @userId
                `;
                request.input('userId', sql.UniqueIdentifier, userId);
            }

            // Ejecutar la consulta
            const result = await request.query(query);

            // Enviar la lista de pagos
            res.status(200).json(result.recordset);

        } catch (err) {
            console.error('Error al listar pagos:', err);
            res.status(500).json({ message: 'Error interno del servidor al listar pagos', error: err.message });
        }
    });

    // PUT /api/pagos/:id - Actualizar un pago específico (solo administradores y superusuarios)
    router.put('/:id', authorize(dbPool, ['Administrator', 'SuperUsuario']), async (req, res) => {
        const pagoId = req.params.id;
        const { tipo_pago, monto, fecha_pago, descripcion } = req.body;

        // Validación básica
        if (!pagoId) {
            return res.status(400).json({ message: 'Falta el ID del pago' });
        }

        // Verificar que el ID del pago sea un UUID válido
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(pagoId)) {
            return res.status(400).json({ message: 'El ID del pago no tiene un formato UUID válido.' });
        }

        // Si no hay campos para actualizar, devolver un error
        if (!tipo_pago && !monto && !fecha_pago && !descripcion) {
            return res.status(400).json({ message: 'Debe proporcionar al menos un campo para actualizar' });
        }

        try {
            // Construir la consulta SQL dinámicamente
            let query = 'UPDATE Pagos SET ';
            const updates = [];

            if (tipo_pago) {
                updates.push('tipo_pago = @tipo_pago');
            }
            if (monto) {
                updates.push('monto = @monto');
            }
            if (fecha_pago) {
                updates.push('fecha_pago = @fecha_pago');
            }
            if (descripcion) {
                updates.push('descripcion = @descripcion');
            }

            query += updates.join(', ');
            query += ' WHERE id = @pagoId;';

            // Preparar la consulta SQL
            const request = dbPool.request();
            request.input('pagoId', sql.UniqueIdentifier, pagoId);

            if (tipo_pago) {
                request.input('tipo_pago', sql.VarChar(50), tipo_pago);
            }
            if (monto) {
                request.input('monto', sql.Decimal(10, 2), monto);
            }
            if (fecha_pago) {
                request.input('fecha_pago', sql.Date, fecha_pago);
            }
            if (descripcion) {
                request.input('descripcion', sql.VarChar(1024), descripcion);
            }

            // Ejecutar la consulta
            const result = await request.query(query);

            // Verificar si se actualizó el pago
            if (result.rowsAffected[0] > 0) {
                res.status(200).json({ message: 'Pago actualizado exitosamente' });
            } else {
                res.status(404).json({ message: 'Pago no encontrado' });
            }

        } catch (err) {
            console.error('Error al actualizar pago:', err);
            res.status(500).json({ message: 'Error interno del servidor al actualizar pago', error: err.message });
        }
    });

    // DELETE /api/pagos/:id - Eliminar un pago específico (solo administradores y superusuarios)
    router.delete('/:id', authorize(dbPool, ['Administrator', 'SuperUsuario']), async (req, res) => {
        const pagoId = req.params.id;

        // Validación básica
        if (!pagoId) {
            return res.status(400).json({ message: 'Falta el ID del pago' });
        }

        // Verificar que el ID del pago sea un UUID válido
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(pagoId)) {
            return res.status(400).json({ message: 'El ID del pago no tiene un formato UUID válido.' });
        }

        try {
            // Preparar la consulta SQL para eliminar el pago
            const request = dbPool.request();
            request.input('pagoId', sql.UniqueIdentifier, pagoId);

            const query = `
                DELETE FROM Pagos
                WHERE id = @pagoId;
            `;

            // Ejecutar la consulta
            const result = await request.query(query);

            // Verificar si se eliminó el pago
            if (result.rowsAffected[0] > 0) {
                res.status(200).json({ message: 'Pago eliminado exitosamente' });
            } else {
                res.status(404).json({ message: 'Pago no encontrado' });
            }

        } catch (err) {
            console.error('Error al eliminar pago:', err);
            res.status(500).json({ message: 'Error interno del servidor al eliminar pago', error: err.message });
        }
    });

    return router;
};