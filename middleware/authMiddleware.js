// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { sql } = require('../db'); // Importar sql para tipos

const authorize = (dbPool, allowedRoles) => { // <- Agrega dbPool como parámetro
    return async (req, res, next) => {
        try {
            // 1. Obtener el token de autenticación de la cabecera
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

            // 2. Si no hay token, devolver un error
            if (!token) {
                return res.status(401).json({ message: 'No autorizado: Token no proporcionado' });
            }

            // 3. Verificar la validez del token
            jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
                if (err) {
                    return res.status(403).json({ message: 'No autorizado: Token inválido' });
                }

                // 4. Obtener el ID del usuario del token
                const userId = user.userId;

                // 5. Obtener el rol del usuario desde la base de datos
                const request = dbPool.request(); // <- Usa el dbPool que se pasa como parámetro
                request.input('userId', sql.UniqueIdentifier, userId);

                const query = `
                    SELECT p.nombre AS rol
                    FROM Usuarios u
                    INNER JOIN Perfiles p ON u.perfil_id = p.id
                    WHERE u.id = @userId;
                `;

                const result = await request.query(query);

                // 6. Si no se encuentra el usuario, devolver un error
                if (result.recordset.length === 0) {
                    return res.status(404).json({ message: 'Usuario no encontrado' });
                }

                // 7. Obtener el rol del usuario
                const userRole = result.recordset[0].rol;

                // 8. Verificar si el usuario tiene uno de los roles permitidos
                if (!allowedRoles.includes(userRole)) {
                    return res.status(403).json({ message: 'No autorizado: No tiene permisos para realizar esta acción' });
                }

                // 9. Agregar el ID del usuario y el rol al objeto de solicitud
                req.userId = userId;
                req.userRole = userRole;

                // 10. Si el usuario tiene uno de los roles permitidos, permitir que la petición continúe
                next();
            });

        } catch (err) {
            console.error('Error al autorizar usuario:', err);
            res.status(500).json({ message: 'Error interno del servidor al autorizar usuario', error: err.message });
        }
    }
    };

module.exports = { authorize };