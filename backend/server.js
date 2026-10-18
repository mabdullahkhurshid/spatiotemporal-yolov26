const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { rejectMongoOperators } = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimits');
const handleSocketConnection = require('./sockets/socketHandlers');

// Connect to database
connectDB();

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Behind nginx/a load balancer, trust the proxy so rate limits see the client IP, not the proxy's.
// TRUST_PROXY: number of proxy hops (e.g. 1), "true", or an Express trust-proxy value.
if (process.env.TRUST_PROXY) {
  const value = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(value) ? Number(value) : value === 'true' ? true : value);
}

// Rate limiting (per user when signed in, per IP otherwise; inference worker exempt)
app.use('/api/', apiLimiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/', rejectMongoOperators);

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/internal/inference', require('./routes/internalInference'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/users', require('./routes/users'));
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/subscription-plans', require('./routes/subscriptionPlans'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/cameras', require('./routes/cameras'));
app.use('/api/operator-assignments', require('./routes/operatorAssignments'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/incidents', require('./routes/incidents'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Socket.io connection handler
handleSocketConnection(io);

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  httpServer.close(() => process.exit(1));
});
