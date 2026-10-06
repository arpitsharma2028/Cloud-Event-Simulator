const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const simulationRoutes = require('./routes/simulations');
const presetRoutes = require('./routes/presets');
const compareRoutes = require('./routes/compare');

const app = express();
const PORT = process.env.PORT || 5050;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: '*', // Allow frontend development servers
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiter: max 300 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again later." }
});
app.use('/api/', limiter);

// Request Parsing
app.use(express.json({ limit: '1mb' }));

// Structured Observability Logging
app.use((req, res, next) => {
  const reqId = uuidv4();
  const start = Date.now();
  req.id = reqId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${reqId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: "HEALTHY",
    service: "Cloud Event Simulator Backend API",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/simulations', simulationRoutes);
app.use('/api/presets', presetRoutes);
app.use('/api/compare', compareRoutes);

// Static frontend serving if built
const path = require('path');
const fs = require('fs');
const distPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 Handler for API routes
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Centralized Safe Error Handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] [${req.id || 'N/A'}]`, err.message);
  
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: err.message || "An unexpected internal error occurred in the simulation server.",
    code: err.code || "INTERNAL_ERROR",
    requestId: req.id
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Cloud Event Simulator Backend API running on port ${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/health`);
    console.log(` Presets API:  http://localhost:${PORT}/api/presets`);
    console.log(`====================================================`);
  });
}

module.exports = app;
