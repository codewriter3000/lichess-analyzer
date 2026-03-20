const express = require('express');
const multer = require('multer');
const { parsePgn, inferUsername } = require('../services/pgnParser');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.pgn')) {
      cb(null, true);
    } else {
      cb(new Error('Only PGN files are accepted'));
    }
  },
});

// POST /api/upload
// Upload and parse a PGN file. Stores parsed games in memory.
router.post('/', upload.single('pgn'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const pgnText = req.file.buffer.toString('utf8');
  const games = parsePgn(pgnText);
  const inferredUsername = inferUsername(games);

  if (games.length === 0) {
    return res.status(400).json({ error: 'No valid games found in PGN file' });
  }

  // Store in app-level store
  req.app.locals.games = games;
  req.app.locals.pgnText = pgnText;
  req.app.locals.username = inferredUsername;

  res.json({
    message: `Parsed ${games.length} game(s)`,
    total: games.length,
    username: inferredUsername,
    games: games.map((g, i) => ({
      index: i,
      white: g.white,
      black: g.black,
      whiteElo: g.whiteElo,
      blackElo: g.blackElo,
      result: g.result,
      date: g.date,
      opening: g.opening,
      eco: g.eco,
      plyCount: g.plyCount,
    })),
  });
});

module.exports = router;
