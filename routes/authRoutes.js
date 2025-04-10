// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

module.exports = (dbPool) => {  // Exporta una función que recibe dbPool
    // Ruta para registrar un nuevo usuario
    router.post('/register', async (req, res) => {
        await register(req, res, dbPool); // Pasa el dbPool a la función register
    });

    // Ruta para iniciar sesión
    router.post('/login', async (req, res) => {
        await login(req, res, dbPool); // Pasa dbPool a la función login
    });

    return router;
};