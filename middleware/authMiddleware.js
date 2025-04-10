// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { sql } = require('../db');

// Autoriza el acceso a una ruta según el rol del usuario
const authorize = (dbPool, allowedRoles) => {
    return async (req, res, next) => {
        try {
            // 1. Obtiene el token de autenticación de la cabecera
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];

            // 2. Si no hay token, devuelve un error
            if (!token) {
                return res.status(401).json({ message: 'No autorizado: Token no proporcionado' });
            }
            // 3. Verifica la validez del token
            jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
                if (err) {
                    return res.status(403).json({ message: 'No autorizado: Token inválido' });
                }

                // 4. Obtiene el ID del usuario del token
                const userId = decoded.userId;

                // 5. Obtiene el rol del usuario desde la base de datos
                const request = dbPool.request();
                request.input('userId', sql.UniqueIdentifier, userId);

                const query = `
                    SELECT p.nombre AS rol
                    FROM Usuarios u
                    INNER JOIN Perfiles p ON u.perfil_id = p.id
                    WHERE u.id = @userId;
                `;

                const result = await request.query(query);

                // 6. Si no se encuentra el usuario, devuelve un error
                if (result.recordset.length === 0) {
                    return res.status(404).json({ message: 'Usuario no encontrado' });
                }

                // 7. Obtiene el rol del usuario
                const userRole = result.recordset[0].rol;

                // 8. Verifica si el usuario tiene uno de los roles permitidos
                if (!allowedRoles.includes(userRole)) {
                    return res.status(403).json({ message: 'No autorizado: No tiene permisos para realizar esta acción' });
                }

                // 9. Agrega el ID del usuario y el rol al objeto de solicitud
                req.userId = userId;
                req.userRole = userRole;

                // 10. Si el usuario tiene uno de los roles permitidos, permite que la petición continúe
                next();
            });
        } catch (err) {
            console.error('Error al autorizar usuario:', err);
            res.status(500).json({ message: 'Error interno del servidor al autorizar usuario', error: err.message });
        }
    };
};

module.exports = { authorize };