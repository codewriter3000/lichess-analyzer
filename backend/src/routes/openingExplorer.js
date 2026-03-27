import express from 'express';
import multer from 'multer';
import { buildExplorerTree, queryPosition, parseCsvGames } from '../services/openingExplorerService.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

// POST /api/opening-explorer
// Upload a CSV file with Lichess game data and build the opening explorer tree.
router.post('/', upload.single('csv'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const csvText = req.file.buffer.toString('utf8');
  const tree = buildExplorerTree(csvText);
  const games = parseCsvGames(csvText);

  req.app.locals.explorerTree = tree;
  req.app.locals.explorerGames = games;

  res.json({
    message: `Opening explorer built from ${tree.totalGames} game(s)`,
    totalGames: tree.totalGames,
  });
});

// POST /api/opening-explorer/query
// Query the opening tree at a specific position.
router.post('/query', (req, res) => {
  const tree = req.app.locals.explorerTree;
  if (!tree) {
    return res.status(400).json({ error: 'No opening explorer data loaded. Upload a CSV first.' });
  }

  const { moves } = req.body;
  if (!Array.isArray(moves)) {
    return res.status(400).json({ error: 'Request body must include a "moves" array of SAN strings.' });
  }

  const result = queryPosition(tree, moves);
  if (!result) {
    return res.json({
      totalGames: 0,
      whiteWins: 0,
      blackWins: 0,
      draws: 0,
      opening: null,
      eco: null,
      moves: [],
    });
  }

  res.json(result);
});

export default router;
