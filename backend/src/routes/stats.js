import express from 'express';
import { computeStats } from '../services/statsService.js';

const router = express.Router();

// GET /api/stats?username=<name>
// Return computed statistics for the loaded games.
router.get('/', (req, res) => {
  const games = req.app.locals.games;
  if (!games || games.length === 0) {
    return res.status(404).json({ error: 'No games loaded. Please upload a PGN file first.' });
  }

  const username = req.query.username || req.app.locals.username || null;
  const analysisByGame = req.app.locals.analysisByGame || {};
  const stats = computeStats(games, username, analysisByGame);
  res.json(stats);
});

export default router;
