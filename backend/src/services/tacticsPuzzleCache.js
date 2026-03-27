import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_DIR = path.resolve(
  process.env.TACTICS_CACHE_DIR || path.join(process.cwd(), 'cache', 'tactics')
);
const PUZZLES_FILE = path.join(CACHE_DIR, 'puzzles.json');

let cacheDirReady = false;
let memoryCache = null;

async function ensureCacheDir() {
  if (cacheDirReady) return;
  await fs.mkdir(CACHE_DIR, { recursive: true });
  cacheDirReady = true;
}

/**
 * Build a short stable key for a game based on its PGN text.
 */
function buildGameKey(game) {
  return createHash('sha256').update(game?.pgn || '').digest('hex').slice(0, 16);
}

/**
 * Extract puzzle positions from a Stockfish analysis result.
 * Each puzzle corresponds to a tactic move (bestMove exists + tactic detected).
 * The FEN is taken from the fenBefore field stored on each move.
 *
 * @param {Object} game - Parsed game object with .pgn, .white, .black, etc.
 * @param {Object} analysisResult - Result from analyzeGame / cache
 * @returns {Array} Array of puzzle objects
 */
function extractPuzzlesFromAnalysis(game, analysisResult) {
  if (!analysisResult?.moves || analysisResult.moves.length === 0) return [];

  const gameKey = buildGameKey(game);
  const puzzles = [];

  for (let i = 0; i < analysisResult.moves.length; i++) {
    const move = analysisResult.moves[i];

    // Only create puzzles for positions where a tactic was identified and we
    // know the best move UCI string and the FEN before the move.
    if (!move.tactic || !move.bestMove || !move.fenBefore) continue;

    puzzles.push({
      id: `${gameKey}:${i}`,
      gameKey,
      moveIndex: i,
      fen: move.fenBefore,
      bestMove: move.bestMove,
      tacticType: move.tactic.type,
      found: move.tactic.found,
      color: move.color,
      moveNumber: move.moveNumber,
      san: move.san,
      cploss: move.cploss,
      gameInfo: {
        white: game.white || '',
        black: game.black || '',
        date: game.date || null,
        opening: game.opening || null,
      },
    });
  }

  return puzzles;
}

/**
 * Load all puzzles from the filesystem cache (or from memory if already loaded).
 */
async function loadAllPuzzles() {
  if (memoryCache !== null) return memoryCache;

  await ensureCacheDir();
  try {
    const data = await fs.readFile(PUZZLES_FILE, 'utf8');
    memoryCache = JSON.parse(data);
    return memoryCache;
  } catch (err) {
    if (err.code === 'ENOENT') {
      memoryCache = [];
      return memoryCache;
    }
    throw err;
  }
}

/**
 * Persist the full puzzle list to disk and update the in-memory cache.
 */
async function saveAllPuzzles(puzzles) {
  await ensureCacheDir();
  await fs.writeFile(PUZZLES_FILE, JSON.stringify(puzzles), 'utf8');
  memoryCache = puzzles;
}

/**
 * Save (replace) the puzzles extracted from a single game.
 * Existing puzzles for the same game key are removed and replaced.
 *
 * @param {Object} game - Game object (used to derive the game key)
 * @param {Array} puzzles - Puzzles to persist (output of extractPuzzlesFromAnalysis)
 */
async function savePuzzlesForGame(game, puzzles) {
  const gameKey = buildGameKey(game);
  const all = await loadAllPuzzles();
  const filtered = all.filter(p => p.gameKey !== gameKey);
  const updated = [...filtered, ...puzzles];
  await saveAllPuzzles(updated);
}

/**
 * Return puzzles, optionally filtered by tactic type.
 *
 * @param {Object} options
 * @param {string[]} [options.types] - Tactic types to include (e.g. ['fork', 'checkmate']).
 *   Pass an empty array or omit to return all puzzles.
 * @returns {Promise<Array>}
 */
async function getPuzzlesByFilter({ types = [] } = {}) {
  const all = await loadAllPuzzles();
  if (!types || types.length === 0) return all;
  return all.filter(p => types.includes(p.tacticType));
}

export { extractPuzzlesFromAnalysis, savePuzzlesForGame, getPuzzlesByFilter };
