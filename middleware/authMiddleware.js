// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { sql } = require('../db');

const authorize = (dbPool, allowedRoles) => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                return res.status(401).json({ message: 'No autorizado: Token no proporcionado' });
            }

            jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
                if (err) {
                    return res.status(403).json({ message: 'No autorizado: Token inválido' });
                }

                const userId = decoded.userId;

                const request = dbPool.request();
                request.input('userId', sql.UniqueIdentifier, userId);

                const query = `
                    SELECT p.nombre AS rol
                    FROM Usuarios u
                    INNER JOIN Perfiles p ON u.perfil_id = p.id
                    WHERE u.id = @userId;
                `;

                const result = await request.query(query);

                if (result.recordset.length === 0) {
                    return res.status(404).json({ message: 'Usuario no encontrado' });
                }

                const userRole = result.recordset[0].rol;

                if (!allowedRoles.includes(userRole)) {
                    return res.status(403).json({ message: 'No autorizado: No tiene permisos para realizar esta acción' });
                }

                req.userId = userId;
                req.userRole = userRole;
                next();
            });
        } catch (err) {
            console.error('Error al autorizar usuario:', err);
            res.status(500).json({ message: 'Error interno del servidor al autorizar usuario', error: err.message });
        }
    };
};

module.exports = { authorize };