import express from 'express';
import { randomUUID } from 'crypto';
import { analyzeGame } from '../services/stockfishService.js';
import { getCachedAnalysis, setCachedAnalysis } from '../services/analysisCache.js';

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

function createBatchJob({ username, depth, concurrency, considered, skipped }) {
  return {
    id: randomUUID(),
    status: 'running',
    username: username || null,
    depth,
    concurrency,
    considered,
    skipped,
    analyzed: 0,
    failed: 0,
    failedGames: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  };
}

function summarizeBatchJob(job) {
  const done = job.analyzed + job.failed + job.skipped;
  const percent = job.considered > 0 ? Math.round((done / job.considered) * 100) : 100;

  return {
    jobId: job.id,
    status: job.status,
    username: job.username,
    depth: job.depth,
    concurrency: job.concurrency,
    considered: job.considered,
    analyzed: job.analyzed,
    skipped: job.skipped,
    failed: job.failed,
    failedGames: job.failedGames,
    done,
    percent,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
  };
}

async function analyzeWithCache(game, depth) {
  const cached = await getCachedAnalysis(game, depth);
  if (cached) {
    return { result: cached, fromCache: true };
  }

  const computed = await analyzeGame(game, depth);
  await setCachedAnalysis(game, depth, computed);
  return { result: computed, fromCache: false };
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
    const { result, fromCache } = await analyzeWithCache(games[gameIndex], depth);
    if (!req.app.locals.analysisByGame) {
      req.app.locals.analysisByGame = {};
    }
    req.app.locals.analysisByGame[gameIndex] = result;
    res.json({ ...result, meta: { fromCache, depth } });
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

// POST /api/analyze/batch-last30
// Body: { username?: string, depth?: number, reanalyze?: boolean }
// Analyzes last 30 games for the selected player (or all games if username unavailable).
router.post('/batch-last30', (req, res) => {
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
  if (!req.app.locals.batchAnalyzeJobs) {
    req.app.locals.batchAnalyzeJobs = {};
  }

  const last30Indexes = getLast30Indexes(games, username);
  const queue = last30Indexes.filter(index => reanalyze || !req.app.locals.analysisByGame[index]);
  const skipped = last30Indexes.length - queue.length;
  const job = createBatchJob({
    username,
    depth,
    concurrency,
    considered: last30Indexes.length,
    skipped,
  });

  req.app.locals.batchAnalyzeJobs[job.id] = job;

  if (queue.length === 0) {
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    return res.json(summarizeBatchJob(job));
  }

  void (async () => {
    try {
      let cursor = 0;
      async function worker() {
        while (cursor < queue.length) {
          const current = queue[cursor++];
          try {
            const { result, fromCache } = await analyzeWithCache(games[current], depth);
            req.app.locals.analysisByGame[current] = result;
            if (fromCache) {
              job.skipped++;
            } else {
              job.analyzed++;
            }
          } catch (err) {
            job.failed++;
            job.failedGames.push({ gameIndex: current, error: err.message });
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
      job.completedAt = new Date().toISOString();
    }
  })();

  return res.json(summarizeBatchJob(job));
});

// GET /api/analyze/batch-last30/:jobId
// Returns progress for a background batch analysis job.
router.get('/batch-last30/:jobId', (req, res) => {
  const jobs = req.app.locals.batchAnalyzeJobs || {};
  const job = jobs[req.params.jobId];
  if (!job) {
    return res.status(404).json({ error: 'Batch analysis job not found' });
  }

  return res.json(summarizeBatchJob(job));
});

export default router;
