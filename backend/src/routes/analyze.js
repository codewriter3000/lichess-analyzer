const express = require('express');
const { analyzeGame } = require('../services/stockfishService');

const router = express.Router();

// POST /api/analyze
// Body: { gameIndex: number, depth: number (optional, default 15) }
// Runs Stockfish analysis on the specified game.
router.post('/', async (req, res) => {
  const games = req.app.locals.games;
  if (!games || games.length === 0) {
    return res.status(404).json({ error: 'No games loaded. Please upload a PGN file first.' });
  }

  const gameIndex = parseInt(req.body.gameIndex, 10);
  if (isNaN(gameIndex) || gameIndex < 0 || gameIndex >= games.length) {
    return res.status(400).json({ error: `Invalid gameIndex. Must be 0–${games.length - 1}` });
  }

  const depth = Math.min(Math.max(parseInt(req.body.depth, 10) || 15, 5), 25);

  try {
    const result = await analyzeGame(games[gameIndex], depth);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

module.exports = router;
