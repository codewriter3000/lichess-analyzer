import express from 'express';
import { getPuzzlesByFilter } from '../services/tacticsPuzzleCache.js';

const router = express.Router();

const VALID_TACTIC_TYPES = new Set(['checkmate', 'check', 'fork', 'sacrifice', 'capture', 'promotion']);

/**
 * GET /api/tactics/puzzles
 * Query params:
 *   types  – comma-separated list of tactic types to include, e.g. "fork,checkmate"
 *            (omit to return all puzzles)
 *
 * Response: { total: number, puzzles: [...] }
 */
router.get('/puzzles', async (req, res) => {
  try {
    const rawTypes = req.query.types ? String(req.query.types) : '';
    const types = rawTypes
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => VALID_TACTIC_TYPES.has(t));

    const puzzles = await getPuzzlesByFilter({ types });
    res.json({ total: puzzles.length, puzzles });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load puzzles' });
  }
});

export default router;
