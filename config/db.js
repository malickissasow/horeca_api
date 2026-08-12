const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || 'u208608546_apphoreca',
  password: process.env.DB_PASSWORD || 'B5@9ll@c',
  database: process.env.DB_NAME || 'u208608546_apphoreca',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000
});

// Non-blocking diagnostic connection check
pool.getConnection((err, connection) => {
  if (err) {
    console.warn('⚠️ MySQL connection diagnostic warning:', err.message);
  } else {
    console.log('✅ MySQL Database connected successfully!');
    connection.release();
  }
});

module.exports = pool;
