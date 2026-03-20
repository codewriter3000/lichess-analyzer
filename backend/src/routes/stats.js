const express = require('express');
const { computeStats } = require('../services/statsService');

const router = express.Router();

// GET /api/stats?username=<name>
// Return computed statistics for the loaded games.
router.get('/', (req, res) => {
  const games = req.app.locals.games;
  if (!games || games.length === 0) {
    return res.status(404).json({ error: 'No games loaded. Please upload a PGN file first.' });
  }

  const username = req.query.username || req.app.locals.username || null;
  const stats = computeStats(games, username);
  res.json(stats);
});

module.exports = router;
