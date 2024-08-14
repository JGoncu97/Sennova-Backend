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
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'pipe123.',
  database: 'ecommergy'
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

// Ruta para registrar un nuevo operador
app.post('/api/comercializadores',
  // Validación de datos
  body('nombre').notEmpty().withMessage('Nombre es requerido'),
  body('sitioweb').isURL().withMessage('Sitio web debe ser una URL válida'),
  body('contacto').notEmpty().withMessage('Contacto es requerido'),
  (req, res) => {
    const { nombre, sitioweb, contacto } = req.body;

    // Verifica si el operador ya existe
    const checkNombreSql = 'SELECT * FROM operadores WHERE nombre = ?';
    db.query(checkNombreSql, [nombre], (err, results) => {
      if (err) {
        console.error('Error al verificar el nombre del operador:', err);
        return res.status(500).json({ success: false, message: 'Error al verificar el nombre del operador' });
      }

      if (results.length > 0) {
        return res.status(400).json({ success: false, message: 'Ya existe un operador con ese nombre' });
      }

      // Si el nombre no existe, procede a registrar el operador
      const sql = 'INSERT INTO operadores (nombre, sitioweb, contacto) VALUES (?, ?, ?)';
      db.query(sql, [nombre, sitioweb, contacto], (err, result) => {
        if (err) {
          console.error('Error al insertar el operador:', err);
          return res.status(500).json({ success: false, message: 'Error al insertar el operador' });
        } else {
          return res.json({ success: true, message: 'Operador registrado' });
        }
      });
    });
  }
);

// Ruta para obtener la lista de operadores
app.get('/api/operadores', (req, res) => {
  const sql = 'SELECT * FROM operadores';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ success: false, message: 'Error en la consulta' });
    }

    return res.json(results);
  });
});

// Ruta para registrar una nueva tarifa
app.post('/api/tarifas',
  // Validación de datos
  body('operador').isInt().withMessage('ID del operador es requerido y debe ser un número entero'),
  body('anio').isInt({ min: 2000, max: new Date().getFullYear() }).withMessage('Año debe ser un número entero válido'),
  body('mes').isInt({ min: 1, max: 12 }).withMessage('Mes debe ser un número entero entre 1 y 12'),
  body('valorkh').isFloat({ min: 0 }).withMessage('Valor kWh debe ser un número positivo'),
  (req, res) => {
    // Verifica errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array().map(error => error.msg).join(', ') });
    }

    const { operador, anio, mes, valorkh } = req.body;

    // Verifica si la tarifa ya existe
    const checkTarifaSql = 'SELECT * FROM operadores_tarifa WHERE operadores_idoperador = ? AND anio = ? AND mes = ?';
    db.query(checkTarifaSql, [operador, anio, mes], (err, results) => {
      if (err) {
        console.error('Error al verificar la tarifa:', err);
        return res.status(500).json({ success: false, message: 'Error al verificar la tarifa' });
      }

      if (results.length > 0) {
        return res.status(400).json({ success: false, message: 'Ya existe una tarifa registrada para ese operador en el mes y año seleccionados' });
      }

      // Si la tarifa no existe, procede a registrarla
      const sql = 'INSERT INTO operadores_tarifa (operadores_idoperador, anio, mes, valorkh) VALUES (?, ?, ?, ?)';
      db.query(sql, [operador, anio, mes, valorkh], (err, result) => {
        if (err) {
          console.error('Error al insertar la tarifa:', err);
          return res.status(500).json({ success: false, message: 'Error al insertar la tarifa' });
        } else {
          return res.json({ success: true, message: 'Tarifa registrada' });
        }
      });
    });
  }
);

// Ruta para obtener tarifas registradas
app.get('/api/tarifas', (req, res) => {
  const sql = 'SELECT operadores.nombre AS nombreOperador, operadores_tarifa.anio, operadores_tarifa.mes, operadores_tarifa.valorkh FROM operadores_tarifa JOIN operadores ON operadores_tarifa.operadores_idoperador = operadores.idoperador';
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ success: false, message: 'Error en la consulta' });
    }

    return res.json(results);
  });
});

// Ruta para buscar tarifas con filtros
app.get('/api/tarifas/buscar', (req, res) => {
  const { operador, anio, mes } = req.query;
  
  let sql = 'SELECT operadores.nombre AS nombreOperador, operadores_tarifa.anio, operadores_tarifa.mes, operadores_tarifa.valorkh FROM operadores_tarifa JOIN operadores ON operadores_tarifa.operadores_idoperador = operadores.idoperador WHERE 1=1';
  const queryParams = [];
  
  if (operador) {
    sql += ' AND operadores_idoperador = ?';
    queryParams.push(operador);
  }
  
  if (anio) {
    sql += ' AND anio = ?';
    queryParams.push(anio);
  }
  
  if (mes) {
    sql += ' AND mes = ?';
    queryParams.push(mes);
  }

  db.query(sql, queryParams, (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ success: false, message: 'Error en la consulta' });
    }

    return res.json(results);
  });
});

// Inicia el servidor
const port = 5000;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
