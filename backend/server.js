// server.js
const express = require('express');
const mongoose = require("mongoose")
require('dotenv').config();
const cors = require("cors")

const app = express();

console.log(process.env.MONGODB_URI)

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error al conectar MongoDB:', err));

// Puerto
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors())
app.use(express.json())

// USES ROUTES
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tickers', require('./routes/tickers'));

// Levantar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
