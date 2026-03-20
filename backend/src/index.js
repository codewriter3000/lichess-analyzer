const express = require('express');
const cors = require('cors');
const uploadRouter = require('./routes/upload');
const statsRouter = require('./routes/stats');
const analyzeRouter = require('./routes/analyze');
const exportRouter = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Shared in-memory store for parsed games
app.locals.games = [];

// Routes
app.use('/api/upload', uploadRouter);
app.use('/api/stats', statsRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/export', exportRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Lichess Analyzer backend running on http://localhost:${PORT}`);
});

module.exports = app;
