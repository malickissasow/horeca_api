const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();
const pool = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const jobRoutes = require('./routes/jobRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const messageRoutes = require('./routes/messageRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const server = http.createServer(app);

// Global CORS Middleware Guarantee
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(express.json());

// Socket.io Setup with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }
});

const PORT = process.env.PORT || 5000;

// Serve uploads static folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Store io instance in app
app.set('io', io);

// Socket.io Connection & Room Logic
io.on('connection', (socket) => {
  socket.on('join_user_room', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
    }
  });
});

// Root Welcome Route
app.get('/', (req, res) => {
  res.json({
    name: 'HORECA AFRICA 2026 API',
    status: 'ONLINE',
    version: '1.0.0',
    documentation: 'https://api.horecafrica.org/api/health',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      meetings: '/api/meetings',
      jobs: '/api/jobs',
      admin: '/api/admin',
      payment: '/api/payment'
    }
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '1.0.0',
    service: 'HORECA AFRICA 2026 API',
    message: 'HORECA AFRICA API is running smoothly',
    timestamp: new Date().toISOString()
  });
});

// DB Connection Diagnostic Check
app.get('/api/db-check', async (req, res) => {
  try {
    const [tables] = await pool.promise().query('SHOW TABLES');
    const [users] = await pool.promise().query('SELECT id, email, name, role FROM users');
    res.json({ success: true, tables, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, code: err.code });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/payment', paymentRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: err.message || 'Erreur interne du serveur' });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Le port ${PORT} est déjà utilisé par un autre processus Node ou service.`);
  } else {
    console.error('❌ Erreur serveur:', err);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 HORECA AFRICA API & WebSockets running on port ${PORT}`);
});
