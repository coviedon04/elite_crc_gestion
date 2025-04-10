// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql } = require('../db'); // Importa objetos sql para acceder a sus tipos de datos

// FRegistra un nuevo usuario
const register = async (req, res, dbPool) => {
    const { nombre, apellidos, correo, clave, telefono, direccion, cedula } = req.body;
    const defaultPerfilId = '5654AD77-943E-4F72-BB2F-2751C54128F0'; // ID del perfil "Cliente" (valor por default)
    //const defaultPerfilId = '6C8A2A6E-6DF4-4FA7-8CB8-1757D68345D8'; // ID del perfil "Administrator"
    //const defaultPerfilId = '3777ADDD-B138-42D3-9BFE-E7C089D501AC'; // ID del perfil "SuperUsuario"
    

    // Se realiza validación básica
    if (!nombre || !apellidos || !correo || !clave) {
        return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    try {
        // 1. Encripta la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(clave, salt);

        // 2. Convierte el valor encriptado a un buffer
        const hashedPasswordBuffer = Buffer.from(hashedPassword, 'utf-8');

        // 3. Inserta el nuevo usuario en la base de datos
        const request = dbPool.request();
        request.input('nombre', sql.VarChar(256), nombre);
        request.input('apellidos', sql.VarChar(256), apellidos);
        request.input('correo', sql.VarChar(128), correo);
        request.input('clave', sql.VarBinary, hashedPasswordBuffer);
        request.input('perfil_id', sql.UniqueIdentifier, defaultPerfilId);

        // Agrega campos opcionales
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

        // Agrega campos opcionales a la consulta
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

        // Agrega valores opcionales a la consulta
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

        // 4. Envia respuesta exitosa
        res.status(201).json({ message: 'Usuario registrado exitosamente' });

    } catch (err) {
        console.error('Error al registrar usuario:', err);
        res.status(500).json({ message: 'Error interno del servidor al registrar usuario', error: err.message });
    }
};
// Función para iniciar sesión
const login = async (req, res, dbPool) => {
    const { correo, clave } = req.body;

    // Validación básica
    if (!correo || !clave) {
        return res.status(400).json({ message: 'Faltan correo o contraseña' });
    }

    try {
        // 1. Busca el usuario en la base de datos
        const request = dbPool.request();
        request.input('correo', sql.VarChar(128), correo);

        const query = `
            SELECT id, clave
            FROM Usuarios
            WHERE correo = @correo;
        `;

        const result = await request.query(query);

        // 2. Si no se encuentra el usuario, devuelve un error
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Correo o contraseña incorrectos' });
        }

        const user = result.recordset[0];

        // 3. Convierte la contraseña ingresada a una cadena
        const claveIngresada = String(clave);

        // 4. Convierte el hash almacenado a una cadena (si no lo es)
        const claveAlmacenada = String(user.clave);

        // Imprime los valores en la consola
        console.log("Clave ingresada:", claveIngresada);
        console.log("Clave almacenada:", claveAlmacenada);

        // 5. Compara la contraseña ingresada con la contraseña encriptada en la base de datos
        const passwordMatch = await bcrypt.compare(claveIngresada, claveAlmacenada);

        // 6. Si las contraseñas no coinciden, devuelve un error
        if (!passwordMatch) {
            return res.status(404).json({ message: 'Correo o contraseña incorrectos' });
        }

        // 7. Genera un token de autenticación
        //console.log("JWT_SECRET (Registro):", process.env.JWT_SECRET); //Dejar desactivado para que no imprima la clave de .env
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' }); // Usa una clave secreta segura y un tiempo de expiración

        // 8. Envia el token en la respuesta
        res.status(200).json({ message: 'Inicio de sesión exitoso', token });

    } catch (err) {
        console.error('Error al iniciar sesión:', err);
        res.status(500).json({ message: 'Error interno del servidor al iniciar sesión', error: err.message });
    }
};

module.exports = { register, login };