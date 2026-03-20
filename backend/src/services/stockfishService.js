const { spawn } = require('child_process');
const { Chess } = require('chess.js');

const STOCKFISH_PATH = process.env.STOCKFISH_PATH || '/usr/games/stockfish';
const DEFAULT_DEPTH = 15;
const ANALYSIS_TIMEOUT_MS = 60000;

/**
 * Analyze a chess game using Stockfish.
 * Returns per-move evaluations and accuracy metrics.
 * @param {Object} game - Parsed game object with .pgn property
 * @param {number} depth - Search depth (default 15)
 */
function analyzeGame(game, depth = DEFAULT_DEPTH) {
  return new Promise((resolve, reject) => {
    const chess = new Chess();
    try {
      chess.loadPgn(game.pgn, { strict: false });
    } catch (e) {
      return reject(new Error('Failed to load PGN: ' + e.message));
    }

    const moves = chess.history({ verbose: true });
    if (moves.length === 0) {
      return resolve({ moves: [], accuracy: null });
    }

    const sf = spawn(STOCKFISH_PATH);
    const results = [];
    let output = '';
    let moveIndex = 0;
    let analysisStarted = false;
    let currentFen = null;

    const timer = setTimeout(() => {
      sf.kill();
      reject(new Error('Analysis timed out'));
    }, ANALYSIS_TIMEOUT_MS);

    // Build list of FENs to analyze (position before each move)
    const fens = [];
    const replayChess = new Chess();
    fens.push(replayChess.fen()); // starting position
    for (const move of moves) {
      replayChess.move(move.san);
      fens.push(replayChess.fen());
    }

    let readyReceived = false;

    sf.stdout.on('data', data => {
      output += data.toString();
      const lines = output.split('\n');
      output = lines.pop(); // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Wait for readyok before starting analysis
        if (!readyReceived && trimmed === 'readyok') {
          readyReceived = true;
          analysisStarted = true;
          moveIndex = 0;
          analyzeNextPosition();
          continue;
        }

        if (!analysisStarted) continue;

        // Collect the last info line with score for current position
        if (trimmed.startsWith('info') && trimmed.includes('score')) {
          const cp = parseCentipawn(trimmed, currentFen);
          if (cp !== null && results.length > 0) {
            results[results.length - 1].eval = cp;
          }
        }

        if (trimmed.startsWith('bestmove')) {
          moveIndex++;
          analyzeNextPosition();
        }
      }
    });

    sf.stderr.on('data', () => {});

    sf.on('error', err => {
      clearTimeout(timer);
      reject(new Error('Failed to start Stockfish: ' + err.message));
    });

    sf.on('close', () => {
      clearTimeout(timer);
      if (results.length === 0) {
        return reject(new Error('No analysis results'));
      }
      const classified = classifyMoves(results, moves);
      resolve(classified);
    });

    function send(cmd) {
      sf.stdin.write(cmd + '\n');
    }

    function analyzeNextPosition() {
      // moveIndex points to the position index (0 = start, 1 = after move 1, etc.)
      // We analyze positions 0..moves.length (fens.length positions)
      if (moveIndex >= fens.length) {
        send('quit');
        return;
      }

      currentFen = fens[moveIndex];
      results.push({ fen: currentFen, eval: null });
      waitingForBestmove = true;
      send(`position fen ${currentFen}`);
      send(`go depth ${depth}`);
    }

    // Start: initialize engine then wait for readyok
    send('uci');
    send('setoption name UCI_AnalyseMode value true');
    send('setoption name Threads value 1');
    send('isready');
  });
}

/**
 * Parse the centipawn score from a Stockfish info line.
 * Normalizes from the perspective of the side to move.
 */
function parseCentipawn(infoLine, fen) {
  // Determine whose turn it is from FEN
  let isBlackToMove = false;
  if (fen) {
    const parts = fen.split(' ');
    isBlackToMove = parts[1] === 'b';
  }

  const mateMatch = infoLine.match(/score mate (-?\d+)/);
  if (mateMatch) {
    const mateIn = parseInt(mateMatch[1], 10);
    const score = mateIn > 0 ? 10000 : -10000;
    return isBlackToMove ? -score : score;
  }

  const cpMatch = infoLine.match(/score cp (-?\d+)/);
  if (cpMatch) {
    const cp = parseInt(cpMatch[1], 10);
    return isBlackToMove ? -cp : cp;
  }

  return null;
}

/**
 * Classify moves as brilliant, good, inaccuracy, mistake, or blunder.
 * Returns enriched move data with accuracy score.
 */
function classifyMoves(evaluations, moves) {
  const classified = [];
  let whiteAccuracy = 0;
  let blackAccuracy = 0;
  let whiteCount = 0;
  let blackCount = 0;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const isWhiteMove = i % 2 === 0;

    // eval[i] = eval of position BEFORE the move (from white's perspective)
    // eval[i+1] = eval AFTER the move
    const evalBefore = evaluations[i] ? evaluations[i].eval : null;
    const evalAfter = evaluations[i + 1] ? evaluations[i + 1].eval : null;

    let classification = 'book';
    let cploss = 0;
    let accuracy = 100;

    if (evalBefore !== null && evalAfter !== null) {
      // From the moving player's perspective, a better position = higher eval
      const movingPerspBefore = isWhiteMove ? evalBefore : -evalBefore;
      const movingPerspAfter = isWhiteMove ? evalAfter : -evalAfter;
      cploss = Math.max(0, movingPerspBefore - movingPerspAfter);

      // Winrate-based accuracy (similar to Lichess)
      const wrBefore = winRate(movingPerspBefore);
      const wrAfter = winRate(movingPerspAfter);
      accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * (wrBefore - wrAfter) * 100) - 3.1669));

      if (cploss >= 300) classification = 'blunder';
      else if (cploss >= 100) classification = 'mistake';
      else if (cploss >= 50) classification = 'inaccuracy';
      else classification = 'good';
    }

    classified.push({
      moveNumber: Math.floor(i / 2) + 1,
      color: isWhiteMove ? 'white' : 'black',
      san: move.san,
      from: move.from,
      to: move.to,
      evalBefore,
      evalAfter,
      cploss: Math.round(cploss),
      accuracy: Math.round(accuracy),
      classification,
    });

    if (isWhiteMove) {
      whiteAccuracy += accuracy;
      whiteCount++;
    } else {
      blackAccuracy += accuracy;
      blackCount++;
    }
  }

  return {
    moves: classified,
    whiteAccuracy: whiteCount > 0 ? Math.round(whiteAccuracy / whiteCount) : null,
    blackAccuracy: blackCount > 0 ? Math.round(blackAccuracy / blackCount) : null,
    summary: {
      blunders: {
        white: classified.filter(m => m.color === 'white' && m.classification === 'blunder').length,
        black: classified.filter(m => m.color === 'black' && m.classification === 'blunder').length,
      },
      mistakes: {
        white: classified.filter(m => m.color === 'white' && m.classification === 'mistake').length,
        black: classified.filter(m => m.color === 'black' && m.classification === 'mistake').length,
      },
      inaccuracies: {
        white: classified.filter(m => m.color === 'white' && m.classification === 'inaccuracy').length,
        black: classified.filter(m => m.color === 'black' && m.classification === 'inaccuracy').length,
      },
    },
  };
}

/**
 * Convert centipawn score to win probability (0-1).
 */
function winRate(cp) {
  return 1 / (1 + Math.exp(-0.00368208 * cp));
}

module.exports = { analyzeGame };
