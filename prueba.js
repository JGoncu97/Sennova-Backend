const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');
const cors = require('cors');

const app = express();

// Configura CORS
app.use(cors({
    origin: 'http://127.0.0.1:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
}));

// Middleware para parsear cuerpos de solicitud
app.use(bodyParser.json());

// Configuración de la base de datos
const db = mysql.createConnection({
  host: '213.136.93.169',
  port: 3306,
  user: 'ki829222_adminkhs',
  password: 'SGPS-12446',
  database: 'ki829222_analisiskh_sena'
});

db.connect((err) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('Conectado a la base de datos');
});

// Ruta para registrar un nuevo usuario
app.post('/api/register',
  // Validación de datos
  body('nombre').notEmpty().withMessage('Nombre es requerido'),
  body('email').isEmail().withMessage('Email debe ser válido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres'),
  body('cargo').notEmpty().withMessage('Cargo es requerido'),
  body('estado').isInt().withMessage('Estado debe ser un número entero'),
  async (req, res) => {
    // Verifica errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array().map(error => error.msg).join(', ') });
    }

    const { nombre, email, password, cargo, estado } = req.body;

    // Verifica si el email ya existe
    const checkEmailSql = 'SELECT * FROM usuarios WHERE email = ?';
    db.query(checkEmailSql, [email], (err, results) => {
      if (err) {
        console.error('Error al verificar el email:', err);
        return res.status(500).json({ success: false, message: 'Error al verificar el email' });
      }

      if (results.length > 0) {
        return res.status(400).json({ success: false, message: 'El email ya está registrado' });
      }

      // Si el email no existe, procede a registrar el usuario
      const saltRounds = 10;
      bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
          console.error('Error al encriptar la contraseña:', err);
          return res.status(500).json({ success: false, message: 'Error al encriptar la contraseña' });
        }

        const sql = 'INSERT INTO usuarios (nombre, email, password, cargo, estado) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [nombre, email, hash, cargo, estado], (err, result) => {
          if (err) {
            console.error('Error al insertar el usuario:', err);
            if (err.code === 'ER_DUP_ENTRY') {
              return res.status(400).json({ success: false, message: 'El email ya está registrado' });
            } else {
              return res.status(500).json({ success: false, message: 'Error al insertar el usuario' });
            }
          } else {
            return res.json({ success: true, message: 'Usuario registrado' });
          }
        });
      });
    });
  }
);

// Ruta para validar el login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM usuarios WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ success: false, message: 'Error en la consulta' });
    }

    if (results.length > 0) {
      const user = results[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error('Error al comparar la contraseña:', err);
          return res.status(500).json({ success: false, message: 'Error al comparar la contraseña' });
        }

        if (isMatch) {
          return res.json({ success: true, message: 'Login exitoso', usuario: user });
        } else {
          return res.json({ success: false, message: 'Contraseña incorrecta' });
        }
      });
    } else {
      return res.json({ success: false, message: 'Usuario no encontrado' });
    }
  });
});

// Iniciar el servidor
app.listen(5000, () => {
  console.log('Servidor corriendo en el puerto 5000');
});
