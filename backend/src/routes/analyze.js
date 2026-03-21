import express from 'express';
import { analyzeGame } from '../services/stockfishService.js';

const router = express.Router();

function clampDepth(value) {
  return Math.min(Math.max(parseInt(value, 10) || 15, 5), 25);
}

function clampConcurrency(value) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return 2;
  return Math.min(Math.max(parsed, 1), 8);
}

function getLast30Indexes(games, username) {
  if (!username) {
    return games.map((_, i) => i).slice(-30);
  }

  const lower = username.toLowerCase();
  return games
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.white.toLowerCase() === lower || g.black.toLowerCase() === lower)
    .map(({ i }) => i)
    .slice(-30);
}

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

  const depth = clampDepth(req.body.depth);

  try {
    const result = await analyzeGame(games[gameIndex], depth);
    if (!req.app.locals.analysisByGame) {
      req.app.locals.analysisByGame = {};
    }
    req.app.locals.analysisByGame[gameIndex] = result;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

// POST /api/analyze/batch-last30
// Body: { username?: string, depth?: number, reanalyze?: boolean }
// Analyzes last 30 games for the selected player (or all games if username unavailable).
router.post('/batch-last30', async (req, res) => {
  const games = req.app.locals.games;
  if (!games || games.length === 0) {
    return res.status(404).json({ error: 'No games loaded. Please upload a PGN file first.' });
  }

  const depth = clampDepth(req.body.depth);
  const username = (req.body.username || req.app.locals.username || '').trim();
  const reanalyze = Boolean(req.body.reanalyze);
  const concurrency = clampConcurrency(process.env.ANALYZE_BATCH_CONCURRENCY);

  if (!req.app.locals.analysisByGame) {
    req.app.locals.analysisByGame = {};
  }

  const last30Indexes = getLast30Indexes(games, username);
  const queue = last30Indexes.filter(index => reanalyze || !req.app.locals.analysisByGame[index]);
  const failedGames = [];
  let analyzed = 0;

  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const current = queue[cursor++];
      try {
        const result = await analyzeGame(games[current], depth);
        req.app.locals.analysisByGame[current] = result;
        analyzed++;
      } catch (err) {
        failedGames.push({ gameIndex: current, error: err.message });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));

  const failed = failedGames.length;
  const skipped = last30Indexes.length - analyzed - failed;

  res.json({
    considered: last30Indexes.length,
    analyzed,
    skipped,
    failed,
    failedGames,
    depth,
    concurrency,
    username: username || null,
  });
});

export default router;
