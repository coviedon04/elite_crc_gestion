// routes/atletasRoutes.js
const express = require('express');
const { sql } = require('../db'); // Importar sql para tipos

const router = express.Router();

// Función para configurar rutas con el pool de BD inyectado
const atletasRoutes = (dbPool) => {
    if (!dbPool) {
        throw new Error("El pool de conexiones no se ha proporcionado a atletasRoutes");
    }

    // POST /api/clientes/:clienteId/atletas - Crear un nuevo atleta asociado a un cliente
    router.post('/:clienteId/atletas', async (req, res) => {
        console.log ("params",  req.params.clienteId)
        console.log ("body", req.body)
        const clienteId = req.params.clienteId; // Obtener el ID del cliente de los parámetros de la URL
        const { nombre, apellidos, fecha_nacimiento, categoria, peso, grado } = req.body; // Obtener datos del atleta del cuerpo de la petición

        // Validación básica
        if (!clienteId || !nombre || !apellidos || !fecha_nacimiento) {
            return res.status(400).json({ message: 'Faltan campos obligatorios: clienteId, nombre, apellidos, fecha_nacimiento' });
        }

        /*try {
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
                res.status(201).json({ message: 'Atleta creado exitosamente', atletaId: nuevoAtletaId });
            } else {
                console.error('Error: Inserción exitosa pero no se devolvió el ID.');
                res.status(500).json({ message: 'Error al crear el atleta, no se pudo obtener el ID.' });
            }

        } catch (err) {
            console.error('Error al crear atleta:', err);
            res.status(500).json({ message: 'Error interno del servidor al crear atleta', error: err.message });
        }*/

        res.send("Ok")
    });

    return router;
};

module.exports = atletasRoutes;