const { spawn } = require('child_process');
const { Chess } = require('chess.js');

const STOCKFISH_PATH = process.env.STOCKFISH_PATH || '/usr/games/stockfish';
const DEFAULT_DEPTH = 15;
const ANALYSIS_TIMEOUT_MS = 60000;

// Minimum centipawn loss to count a missed best move as a "tactic missed"
const TACTIC_CPL_THRESHOLD = 100;

/**
 * Analyze a chess game using Stockfish.
 * Returns per-move evaluations, accuracy metrics, per-phase accuracy, and tactic tracking.
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

    // Build list of FENs to analyze (position before each move + final position)
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
          // Capture bestmove UCI string (e.g. "bestmove e2e4 ponder e7e5")
          const bmMatch = trimmed.match(/^bestmove\s+(\S+)/);
          if (bmMatch && results.length > 0) {
            const bm = bmMatch[1];
            results[results.length - 1].bestMoveUci = bm !== '(none)' ? bm : null;
          }
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
      const classified = classifyMoves(results, moves, fens);
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
      results.push({ fen: currentFen, eval: null, bestMoveUci: null });
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
 * Determine game phase from FEN and half-move index.
 *   opening    – first 20 half-moves
 *   endgame    – no queens on board + ≤ 6 major/minor pieces, or ≤ 4 major/minor pieces total
 *   middlegame – everything else
 */
function getGamePhase(fen, halfMoveIndex) {
  if (halfMoveIndex < 20) return 'opening';

  try {
    const chess = new Chess(fen);
    const board = chess.board();

    let queenCount = 0;
    let majorMinorCount = 0;

    for (const row of board) {
      for (const piece of row) {
        if (!piece) continue;
        if (piece.type === 'q') queenCount++;
        if (['r', 'b', 'n', 'q'].includes(piece.type)) majorMinorCount++;
      }
    }

    if (queenCount === 0 && majorMinorCount <= 6) return 'endgame';
    if (majorMinorCount <= 4) return 'endgame';
    return 'middlegame';
  } catch (e) {
    return 'middlegame';
  }
}

/**
 * Count how many enemy pieces (including the king when in check) are attacked
 * by the piece that just moved to `square`, using a FEN-swap trick so chess.js
 * returns moves for the just-moved piece.
 */
function getAttackedEnemyCount(chessBoardAfterMove, square) {
  const fen = chessBoardAfterMove.fen();
  const parts = fen.split(' ');
  // After the move it is the opponent's turn; swap it back so chess.js
  // considers it the just-moved piece's turn and returns its legal moves.
  parts[1] = parts[1] === 'w' ? 'b' : 'w';

  try {
    const tempChess = new Chess(parts.join(' '));
    const attacks = tempChess.moves({ square, verbose: true });
    const capturedSquares = new Set(
      attacks.filter(m => m.captured).map(m => m.to)
    );
    // If the opponent king is in check, find its square and add it to attacked squares
    if (tempChess.inCheck()) {
      const board = tempChess.board();
      const kingColor = parts[1]; // swapped back, so this is the just-moved piece's color
      const opponentColor = kingColor === 'w' ? 'b' : 'w';
      outer: for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.type === 'k' && p.color === opponentColor) {
            const file = String.fromCharCode(97 + c);
            const rank = 8 - r;
            capturedSquares.add(`${file}${rank}`);
            break outer;
          }
        }
      }
    }
    return capturedSquares.size;
  } catch (_) {
    return 0;
  }
}

/**
 * Classify the tactic type of a UCI move in a given FEN position.
 * Returns one of: 'checkmate', 'check', 'fork', 'sacrifice', 'capture', 'promotion', or null.
 */
function classifyTacticType(uciMove, fen) {
  if (!uciMove || uciMove === '(none)') return null;

  const from = uciMove.slice(0, 2);
  const to = uciMove.slice(2, 4);
  const promotion = uciMove.length === 5 ? uciMove[4] : undefined;

  try {
    const chess = new Chess(fen);
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

    const pieceOnFrom = chess.get(from);
    const pieceOnTo = chess.get(to);

    // Promotion
    if (promotion) return 'promotion';

    const moveResult = chess.move({ from, to, promotion });
    if (!moveResult) return null;

    // Checkmate
    if (chess.isCheckmate()) return 'checkmate';

    // Check (before fork – a checking move is itself a tactic)
    if (chess.inCheck()) return 'check';

    // Fork: after the move the piece attacks ≥ 2 enemy pieces
    const attackedEnemies = getAttackedEnemyCount(chess, to);
    if (attackedEnemies >= 2) return 'fork';

    // Sacrifice or plain capture
    if (pieceOnTo || moveResult.flags.includes('e')) {
      if (pieceOnTo) {
        const attackerValue = pieceValues[pieceOnFrom.type] || 0;
        const capturedValue = pieceValues[pieceOnTo.type] || 0;
        if (attackerValue > capturedValue) return 'sacrifice';
      }
      return 'capture';
    }

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Classify moves as brilliant, good, inaccuracy, mistake, or blunder.
 * Adds per-phase accuracy and tactic accuracy tracking.
 * Returns enriched move data with accuracy score.
 */
function classifyMoves(evaluations, moves, fens) {
  const classified = [];
  let whiteAccuracy = 0;
  let blackAccuracy = 0;
  let whiteCount = 0;
  let blackCount = 0;

  // Per-phase accuracy accumulators
  const phaseAccSum = {
    white: { opening: 0, middlegame: 0, endgame: 0 },
    black: { opening: 0, middlegame: 0, endgame: 0 },
  };
  const phaseCount = {
    white: { opening: 0, middlegame: 0, endgame: 0 },
    black: { opening: 0, middlegame: 0, endgame: 0 },
  };

  // Tactic tracking accumulators
  const tacticStats = {
    white: { found: 0, missed: 0, byType: {} },
    black: { found: 0, missed: 0, byType: {} },
  };

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const isWhiteMove = i % 2 === 0;
    const side = isWhiteMove ? 'white' : 'black';

    // eval[i] = eval of position BEFORE the move (from white's perspective)
    // eval[i+1] = eval AFTER the move
    const evalBefore = evaluations[i] ? evaluations[i].eval : null;
    const evalAfter = evaluations[i + 1] ? evaluations[i + 1].eval : null;
    const bestMoveUci = evaluations[i] ? evaluations[i].bestMoveUci : null;
    const fenBefore = fens ? fens[i] : null;

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

    // Determine game phase for this move
    const phase = fenBefore ? getGamePhase(fenBefore, i) : 'middlegame';

    // Determine tactic info
    let tacticInfo = null;
    if (bestMoveUci && fenBefore) {
      const tacticType = classifyTacticType(bestMoveUci, fenBefore);
      if (tacticType) {
        // A tactic was "found" if the player played the engine's best move
        const actualUci = move.from + move.to + (move.promotion || '');
        const tacticFound = actualUci === bestMoveUci;

        // Record as a tactic event only when found OR when the miss is significant
        if (tacticFound || cploss >= TACTIC_CPL_THRESHOLD) {
          tacticInfo = { type: tacticType, found: tacticFound };

          if (!tacticStats[side].byType[tacticType]) {
            tacticStats[side].byType[tacticType] = { found: 0, missed: 0 };
          }

          if (tacticFound) {
            tacticStats[side].found++;
            tacticStats[side].byType[tacticType].found++;
          } else {
            tacticStats[side].missed++;
            tacticStats[side].byType[tacticType].missed++;
          }
        }
      }
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
      phase,
      tactic: tacticInfo,
      bestMove: bestMoveUci,
    });

    if (isWhiteMove) {
      whiteAccuracy += accuracy;
      whiteCount++;
      phaseAccSum.white[phase] += accuracy;
      phaseCount.white[phase]++;
    } else {
      blackAccuracy += accuracy;
      blackCount++;
      phaseAccSum.black[phase] += accuracy;
      phaseCount.black[phase]++;
    }
  }

  // Average per-phase accuracy (null when no moves in that phase)
  const avgPhase = (sideAcc, sideCnt) => {
    const result = {};
    for (const ph of ['opening', 'middlegame', 'endgame']) {
      result[ph] = sideCnt[ph] > 0 ? Math.round(sideAcc[ph] / sideCnt[ph]) : null;
    }
    return result;
  };

  return {
    moves: classified,
    whiteAccuracy: whiteCount > 0 ? Math.round(whiteAccuracy / whiteCount) : null,
    blackAccuracy: blackCount > 0 ? Math.round(blackAccuracy / blackCount) : null,
    phaseAccuracy: {
      white: avgPhase(phaseAccSum.white, phaseCount.white),
      black: avgPhase(phaseAccSum.black, phaseCount.black),
    },
    tacticAccuracy: tacticStats,
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

module.exports = { analyzeGame, getGamePhase, classifyTacticType };
