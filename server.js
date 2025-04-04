const express = require('express');
const app = express();
const port = 3000;

app.use(express.json()); // Para analizar cuerpos de petición en formato JSON
app.use(express.urlencoded({ extended: true }));

// Middleware para registrar todas las peticiones
app.use((req, res, next) => {
  console.log('--- Nueva Petición ---');
  console.log(`Método: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log('Cabeceras:');
  console.log(req.headers);
  console.log('Parámetros:');
  console.log(`Params ${req.params.clienteId}`);
  console.log('Cuerpo:');
  console.log(req.body);
  next(); // Llama a la siguiente función middleware
});

app.post('/api/clientes/:clienteId/atletas', (req, res) => {
 const clienteId = req.params.clienteId;
 const { nombre, apellidos, fecha_nacimiento, categoria, peso, grado } = req.body;

 console.log("clienteId:", clienteId);
 console.log("nombre:", nombre);
 console.log("apellidos:", apellidos);
 console.log("fecha_nacimiento:", fecha_nacimiento);
 console.log("categoria:", categoria);
 console.log("peso:", peso);
 console.log("grado:", grado);

 res.status(201).json({ message: 'Atleta creado exitosamente', atletaId: "TEST" });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
  console.log('Listo para recibir peticiones.');
});