// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql } = require('../db'); // Importar sql para tipos

// Función para registrar un nuevo usuario
const register = async (req, res, dbPool) => {
    const { nombre, apellidos, correo, clave, telefono, direccion, cedula } = req.body;
    const defaultPerfilId = '5654AD77-943E-4F72-BB2F-2751C54128F0'; // Reemplaza con el ID del perfil "Cliente"

    // Validación básica
    if (!nombre || !apellidos || !correo || !clave) {
        return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    try {
        // 1. Encriptar la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(clave, salt);

        // 2. Convertir el valor encriptado a un buffer
        const hashedPasswordBuffer = Buffer.from(hashedPassword, 'utf-8');

        // 3. Insertar el nuevo usuario en la base de datos
        const request = dbPool.request();
        request.input('nombre', sql.VarChar(256), nombre);
        request.input('apellidos', sql.VarChar(256), apellidos);
        request.input('correo', sql.VarChar(128), correo);
        request.input('clave', sql.VarBinary, hashedPasswordBuffer);
        request.input('perfil_id', sql.UniqueIdentifier, defaultPerfilId);

        // Agregar campos opcionales
        if (telefono) {
            request.input('telefono', sql.VarChar(20), telefono);
        }
        if (direccion) {
            request.input('direccion', sql.VarChar(512), direccion);
        }
        if (cedula) {
            request.input('cedula', sql.VarChar(24), cedula);
        }

        let query = `
            INSERT INTO Usuarios (nombre, apellidos, correo, clave, perfil_id`;

        // Agregar campos opcionales a la consulta
        if (telefono) {
            query += `, telefono`;
        }
        if (direccion) {
            query += `, direccion`;
        }
        if (cedula) {
            query += `, cedula`;
        }

        query += `) VALUES (@nombre, @apellidos, @correo, @clave, @perfil_id`;

        // Agregar valores opcionales a la consulta
        if (telefono) {
            query += `, @telefono`;
        }
        if (direccion) {
            query += `, @direccion`;
        }
        if (cedula) {
            query += `, @cedula`;
        }

        query += `);`;

        await request.query(query);

        // 4. Enviar respuesta exitosa
        res.status(201).json({ message: 'Usuario registrado exitosamente' });

    } catch (err) {
        console.error('Error al registrar usuario:', err);
        res.status(500).json({ message: 'Error interno del servidor al registrar usuario', error: err.message });
    }
};
// Función para iniciar sesión
const login = async (req, res, dbPool) => {  // <- Agrega dbPool como parámetro
    const { correo, clave } = req.body;

    // Validación básica
    if (!correo || !clave) {
        return res.status(400).json({ message: 'Faltan correo o contraseña' });
    }

    try {
        // 1. Buscar el usuario en la base de datos
        const request = dbPool.request(); // <- Usa el dbPool que se pasa como parámetro
        request.input('correo', sql.VarChar(128), correo);

        const query = `
            SELECT id, clave
            FROM Usuarios
            WHERE correo = @correo;
        `;

        const result = await request.query(query);

        // 2. Si no se encuentra el usuario, devolver un error
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Correo o contraseña incorrectos' });
        }

        const user = result.recordset[0];

        // 3. Comparar la contraseña ingresada con la contraseña encriptada en la base de datos
        const passwordMatch = await bcrypt.compare(clave, user.clave);

        // 4. Si las contraseñas no coinciden, devolver un error
        if (!passwordMatch) {
            return res.status(404).json({ message: 'Correo o contraseña incorrectos' });
        }

        // 5. Generar un token de autenticación
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' }); // Usa una clave secreta segura y un tiempo de expiración

        // 6. Enviar el token en la respuesta
        res.status(200).json({ message: 'Inicio de sesión exitoso', token });

    } catch (err) {
        console.error('Error al iniciar sesión:', err);
        res.status(500).json({ message: 'Error interno del servidor al iniciar sesión', error: err.message });
    }
};

module.exports = { register, login };