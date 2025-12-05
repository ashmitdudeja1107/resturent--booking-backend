
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIO = require('socket.io');


const bookingRoutes = require('./routes/bookings');
const weatherRoutes = require('./routes/weather');
const agentRoutes = require('./routes/agent');

const app = express();
const server = http.createServer(app);


const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});


app.set('io', io);


app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));


mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-booking', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});


const connectedUsers = new Map();
const activeSessions = new Map();


io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);
  

  socket.emit('connected', {
    socketId: socket.id,
    message: 'Connected to Restaurant Booking Server',
    timestamp: new Date()
  });
  

  socket.on('join', (data) => {
    const { sessionId, userName } = data || {};
    
    if (!sessionId) {
      socket.emit('error', { message: 'Session ID is required' });
      return;
    }
    
  
    socket.join(sessionId);
    socket.join('all-users'); 
    
 
    connectedUsers.set(socket.id, {
      sessionId,
      userName: userName || 'Guest',
      connectedAt: new Date()
    });
    

    if (!activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, new Set());
    }
    activeSessions.get(sessionId).add(socket.id);
    
    console.log(`👤 User ${userName || 'Guest'} joined session: ${sessionId}`);
    

    socket.emit('joined', {
      message: 'Successfully joined booking session',
      sessionId,
      userName: userName || 'Guest',
      timestamp: new Date()
    });
    

    io.to('admin').emit('user-connected', {
      socketId: socket.id,
      sessionId,
      userName: userName || 'Guest',
      totalUsers: connectedUsers.size,
      activeSessions: activeSessions.size,
      timestamp: new Date()
    });
  });
  
 
  socket.on('join-admin', () => {
    socket.join('admin');
    console.log(`👨‍💼 Admin connected: ${socket.id}`);
    

    socket.emit('admin-stats', {
      totalConnectedUsers: connectedUsers.size,
      activeSessions: activeSessions.size,
      users: Array.from(connectedUsers.entries()).map(([id, data]) => ({
        socketId: id,
        ...data
      }))
    });
  });
  

  socket.on('voice-transcript', (data) => {
    const { sessionId, transcript, isFinal } = data;
    
    console.log(`🎤 Transcript [${isFinal ? 'FINAL' : 'INTERIM'}] from ${sessionId}: ${transcript}`);
    
  
    socket.to(sessionId).emit('transcript-update', {
      transcript,
      isFinal,
      timestamp: new Date()
    });
    
 
    io.to('admin').emit('live-transcript', {
      socketId: socket.id,
      sessionId,
      transcript,
      isFinal,
      timestamp: new Date()
    });
  });
  

  socket.on('agent-processing', (data) => {
    const { sessionId, status } = data;
    
  
    io.to(sessionId).emit('processing-status', {
      status,
      timestamp: new Date()
    });
    
    
    io.to('admin').emit('agent-status', {
      sessionId,
      status,
      timestamp: new Date()
    });
  });
  

  socket.on('typing', (data) => {
    const { sessionId, isTyping } = data;
    socket.to(sessionId).emit('user-typing', { isTyping });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    const userData = connectedUsers.get(socket.id);
    
    if (userData) {
      const { sessionId, userName } = userData;
      

      if (activeSessions.has(sessionId)) {
        activeSessions.get(sessionId).delete(socket.id);
        if (activeSessions.get(sessionId).size === 0) {
          activeSessions.delete(sessionId);
        }
      }
      

      connectedUsers.delete(socket.id);
      
      console.log(`👋 User ${userName} left session: ${sessionId}`);

      io.to('admin').emit('user-disconnected', {
        socketId: socket.id,
        sessionId,
        userName,
        totalUsers: connectedUsers.size,
        activeSessions: activeSessions.size,
        timestamp: new Date()
      });
    }
  });
  

  socket.on('error', (error) => {
    console.error(`❌ Socket error from ${socket.id}:`, error);
  });
});


app.use('/api/bookings', bookingRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/agent', agentRoutes);


app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Restaurant Booking API is running',
    socketConnections: connectedUsers.size,
    activeSessions: activeSessions.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/socket/status', (req, res) => {
  res.json({
    success: true,
    data: {
      connectedUsers: connectedUsers.size,
      activeSessions: activeSessions.size,
      users: Array.from(connectedUsers.entries()).map(([id, data]) => ({
        socketId: id,
        ...data
      }))
    }
  });
});


app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Restaurant Booking Voice Agent API',
    version: '2.0.0',
    features: ['Socket.IO Real-time Updates', 'Voice Agent', 'Weather Integration'],
    endpoints: {
      bookings: '/api/bookings',
      weather: '/api/weather',
      agent: '/api/agent',
      health: '/api/health',
      socketStatus: '/api/socket/status'
    }
  });
});


app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path 
  });
});


app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO enabled`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});


process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = { app, server, io };