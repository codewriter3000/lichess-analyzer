import express from 'express';
import { buildCsv } from '../services/csvExport.js';

const router = express.Router();

// GET /api/export/csv?username=<name>
// Download a CSV of all loaded games with rating, opponent rating, date, winner.
router.get('/csv', (req, res) => {
  const games = req.app.locals.games;
  if (!games || games.length === 0) {
    return res.status(404).json({ error: 'No games loaded. Please upload a PGN file first.' });
  }

  const username = req.query.username || req.app.locals.username || null;
  const csv = buildCsv(games, username);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="chess-games.csv"');
  res.send(csv);
});

export default router;
