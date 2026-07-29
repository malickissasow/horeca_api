const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

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
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'HORECA AFRICA API is running smoothly', time: new Date().toISOString() });
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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Le port ${PORT} est déjà utilisé par un autre processus Node ou service.`);
    console.error(`💡 Pour libérer le port, exécutez la commande : lsof -i :${PORT} | grep LISTEN | awk '{print $2}' | xargs kill -9`);
  } else {
    console.error('❌ Erreur serveur:', err);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 HORECA AFRICA API & WebSockets running on http://localhost:${PORT}`);
});


