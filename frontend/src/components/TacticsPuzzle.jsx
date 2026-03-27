import { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import './TacticsPuzzle.css';

const TACTIC_TYPES = ['checkmate', 'check', 'fork', 'sacrifice', 'capture', 'promotion'];

const TACTIC_LABELS = {
  checkmate: 'Checkmate',
  check: 'Check',
  fork: 'Fork',
  sacrifice: 'Sacrifice',
  capture: 'Capture',
  promotion: 'Promotion',
};

function readRgbVar(varName, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

/**
 * Convert a UCI move string (e.g. "e2e4" or "e7e8q") to the object format
 * accepted by chess.js move().
 */
function uciToMoveObj(uci) {
  if (!uci || uci.length < 4) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}

export default function TacticsPuzzle() {
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]); // empty = all
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [status, setStatus] = useState('idle'); // 'idle' | 'correct' | 'incorrect'
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});

  // Load puzzles whenever the type filter changes
  useEffect(() => {
    async function fetchPuzzles() {
      setLoading(true);
      setError('');
      setPuzzleIndex(0);
      setStatus('idle');
      setSelectedSquare(null);
      setHighlightSquares({});

      try {
        const query = selectedTypes.length > 0
          ? `?types=${selectedTypes.join(',')}`
          : '';
        const res = await fetch(`/api/tactics/puzzles${query}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load puzzles');
        setPuzzles(data.puzzles || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPuzzles();
  }, [selectedTypes]);

  const currentPuzzle = puzzles[puzzleIndex] ?? null;

  function resetPuzzleState() {
    setStatus('idle');
    setSelectedSquare(null);
    setHighlightSquares({});
  }

  function goNext() {
    if (puzzleIndex < puzzles.length - 1) {
      setPuzzleIndex(i => i + 1);
      resetPuzzleState();
    }
  }

  function goPrev() {
    if (puzzleIndex > 0) {
      setPuzzleIndex(i => i - 1);
      resetPuzzleState();
    }
  }

  function toggleType(type) {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  // CSS theme colours are read once per mount (values don't change at runtime)
  const boardDark = useMemo(() => `rgb(${readRgbVar('--board-dark', '45 75 62')})`, []);
  const boardLight = useMemo(() => `rgb(${readRgbVar('--board-light', '254 249 240')})`, []);
  const colourCorrect = useMemo(() => readRgbVar('--board-correct', '80 200 120'), []);
  const colourIncorrect = useMemo(() => readRgbVar('--board-incorrect', '220 60 60'), []);
  const colourLastFrom = useMemo(() => readRgbVar('--board-last-from', '119 87 77'), []);

  // Determine board orientation from FEN (whose turn it is)
  const boardOrientation = (() => {
    if (!currentPuzzle) return 'white';
    try {
      const parts = currentPuzzle.fen.split(' ');
      return parts[1] === 'b' ? 'black' : 'white';
    } catch {
      return 'white';
    }
  })();

  // Handle piece drop
  const onPieceDrop = useCallback((sourceSquare, targetSquare) => {
    if (!currentPuzzle || status !== 'idle') return false;

    const chess = new Chess(currentPuzzle.fen);

    // Determine promotion piece: if it's a pawn reaching last rank, default to queen
    let promotion;
    const movingPiece = chess.get(sourceSquare);
    if (
      movingPiece?.type === 'p' &&
      ((movingPiece.color === 'w' && targetSquare[1] === '8') ||
        (movingPiece.color === 'b' && targetSquare[1] === '1'))
    ) {
      promotion = 'q';
    }

    // Try to make the move
    let moveResult;
    try {
      moveResult = chess.move({ from: sourceSquare, to: targetSquare, promotion });
    } catch {
      return false;
    }
    if (!moveResult) return false;

    // Build the UCI string for what the player played
    const playedUci = sourceSquare + targetSquare + (promotion || '');
    const bestMove = currentPuzzle.bestMove;

    // Normalise both to lower-case for comparison (promotion piece may differ in case)
    const isCorrect = playedUci.toLowerCase() === bestMove.toLowerCase();

    const newSquareStyles = {
      [sourceSquare]: { background: isCorrect
        ? `rgb(${colourCorrect} / 0.45)`
        : `rgb(${colourIncorrect} / 0.45)` },
      [targetSquare]: { background: isCorrect
        ? `rgb(${colourCorrect} / 0.65)`
        : `rgb(${colourIncorrect} / 0.65)` },
    };

    if (!isCorrect && bestMove) {
      // Highlight the correct best-move squares too
      const bm = uciToMoveObj(bestMove);
      if (bm) {
        newSquareStyles[bm.from] = { background: `rgb(${colourCorrect} / 0.30)` };
        newSquareStyles[bm.to] = { background: `rgb(${colourCorrect} / 0.55)` };
      }
    }

    setHighlightSquares(newSquareStyles);
    setStatus(isCorrect ? 'correct' : 'incorrect');
    setSelectedSquare(null);
    return true;
  }, [currentPuzzle, status, colourCorrect, colourIncorrect]);

  // Handle click-to-move: first click selects, second click moves
  const onSquareClick = useCallback((square) => {
    if (!currentPuzzle || status !== 'idle') return;

    if (selectedSquare === null) {
      const chess = new Chess(currentPuzzle.fen);
      const piece = chess.get(square);
      if (!piece) return;
      // Only allow picking up pieces of the side to move
      const turn = currentPuzzle.fen.split(' ')[1];
      if (piece.color !== turn) return;

      setSelectedSquare(square);
      setHighlightSquares({ [square]: { background: `rgb(${colourLastFrom} / 0.45)` } });
    } else {
      if (square === selectedSquare) {
        // Deselect
        setSelectedSquare(null);
        setHighlightSquares({});
        return;
      }
      onPieceDrop(selectedSquare, square);
    }
  }, [currentPuzzle, status, selectedSquare, onPieceDrop, colourLastFrom]);

  // ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="puzzle-loading-card">
        <span className="spinner" /> Loading puzzles...
      </div>
    );
  }

  if (error) {
    return <div className="puzzle-error-card">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filter row */}
      <div className="content-card p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-label text-xs uppercase tracking-widest text-primary/50 mr-1">Filter:</span>
          <button
            type="button"
            className={`puzzle-type-chip${selectedTypes.length === 0 ? ' active' : ''}`}
            onClick={() => setSelectedTypes([])}
          >
            All
          </button>
          {TACTIC_TYPES.map(type => (
            <button
              key={type}
              type="button"
              className={`puzzle-type-chip${selectedTypes.includes(type) ? ' active' : ''}`}
              onClick={() => toggleType(type)}
            >
              {TACTIC_LABELS[type]}
            </button>
          ))}
        </div>
        <p className="font-label text-[11px] uppercase tracking-widest text-primary/40 mt-3">
          {puzzles.length} puzzle{puzzles.length !== 1 ? 's' : ''} available
          {puzzles.length > 0 && ` · ${puzzleIndex + 1} / ${puzzles.length}`}
        </p>
      </div>

      {puzzles.length === 0 ? (
        <div className="content-card p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-primary/30 mb-3 block">extension</span>
          <p className="font-headline text-lg text-primary/60">No puzzles yet</p>
          <p className="font-body text-sm text-primary/40 mt-2">
            Analyze your games first. Tactic positions are extracted automatically
            and saved here for practice.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Board column */}
          <div className="xl:col-span-2 space-y-4">
            <div className="content-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-headline text-lg text-primary">
                  {TACTIC_LABELS[currentPuzzle.tacticType] || currentPuzzle.tacticType}
                  &nbsp;&mdash;&nbsp;
                  <span className="font-body text-base font-normal text-primary/60">
                    {currentPuzzle.color === 'white' ? 'White' : 'Black'} to move
                  </span>
                </h4>
                <span className="font-label text-xs uppercase tracking-widest text-primary/40">
                  {puzzleIndex + 1} / {puzzles.length}
                </span>
              </div>

              {/* Board */}
              <div className="flex justify-center">
                <div className="puzzle-board-wrap">
                  <Chessboard
                    id="tactics-puzzle-board"
                    position={currentPuzzle.fen}
                    boardOrientation={boardOrientation}
                    arePiecesDraggable={status === 'idle'}
                    onPieceDrop={onPieceDrop}
                    onSquareClick={onSquareClick}
                    customDarkSquareStyle={{ backgroundColor: boardDark }}
                    customLightSquareStyle={{ backgroundColor: boardLight }}
                    customSquareStyles={highlightSquares}
                    boardWidth={360}
                  />
                </div>
              </div>

              {/* Feedback */}
              <div className="mt-4 min-h-[2.5rem] flex items-center justify-center">
                {status === 'idle' && (
                  <p className="font-label text-sm uppercase tracking-widest text-primary/50">
                    Find the best move!
                  </p>
                )}
                {status === 'correct' && (
                  <p className="puzzle-feedback correct">
                    <span className="material-symbols-outlined text-base mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Correct!
                  </p>
                )}
                {status === 'incorrect' && (
                  <p className="puzzle-feedback incorrect">
                    <span className="material-symbols-outlined text-base mr-1">cancel</span>
                    Not the best move. Best was&nbsp;
                    <span className="font-mono font-semibold">{currentPuzzle.bestMove}</span>
                  </p>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  className="puzzle-nav-btn"
                  onClick={goPrev}
                  disabled={puzzleIndex === 0}
                  title="Previous puzzle"
                  aria-label="Previous puzzle"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {(status === 'correct' || status === 'incorrect') && (
                  <button className="puzzle-next-btn" onClick={goNext} disabled={puzzleIndex === puzzles.length - 1}>
                    Next puzzle
                    <span className="material-symbols-outlined text-base ml-1">chevron_right</span>
                  </button>
                )}
                <button
                  className="puzzle-nav-btn"
                  onClick={goNext}
                  disabled={puzzleIndex === puzzles.length - 1}
                  title="Next puzzle"
                  aria-label="Next puzzle"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* Info column */}
          <div className="space-y-4">
            <div className="content-card p-5">
              <h4 className="font-headline text-lg text-primary mb-3">Puzzle Info</h4>
              <div className="space-y-2">
                <div className="puzzle-info-row">
                  <span className="puzzle-info-label">Tactic</span>
                  <span className="puzzle-info-value">{TACTIC_LABELS[currentPuzzle.tacticType] || currentPuzzle.tacticType}</span>
                </div>
                <div className="puzzle-info-row">
                  <span className="puzzle-info-label">Move</span>
                  <span className="puzzle-info-value">
                    {currentPuzzle.moveNumber}{currentPuzzle.color === 'white' ? '.' : '...'} {currentPuzzle.san}
                  </span>
                </div>
                <div className="puzzle-info-row">
                  <span className="puzzle-info-label">Game</span>
                  <span className="puzzle-info-value text-xs">
                    {currentPuzzle.gameInfo.white} vs {currentPuzzle.gameInfo.black}
                  </span>
                </div>
                {currentPuzzle.gameInfo.date && (
                  <div className="puzzle-info-row">
                    <span className="puzzle-info-label">Date</span>
                    <span className="puzzle-info-value">{currentPuzzle.gameInfo.date}</span>
                  </div>
                )}
                {currentPuzzle.gameInfo.opening && (
                  <div className="puzzle-info-row">
                    <span className="puzzle-info-label">Opening</span>
                    <span className="puzzle-info-value text-xs">{currentPuzzle.gameInfo.opening}</span>
                  </div>
                )}
                {status !== 'idle' && (
                  <div className="puzzle-info-row mt-3">
                    <span className="puzzle-info-label">Solution</span>
                    <span className="font-mono text-sm text-primary font-semibold">{currentPuzzle.bestMove}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
