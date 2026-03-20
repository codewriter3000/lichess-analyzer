import { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import './ChessboardViewer.css';

const CLASSIFICATION_LABELS = {
  blunder:    { symbol: '??', label: 'Blunder',    cls: 'cb-badge-blunder'    },
  mistake:    { symbol: '?',  label: 'Mistake',    cls: 'cb-badge-mistake'    },
  inaccuracy: { symbol: '?!', label: 'Inaccuracy', cls: 'cb-badge-inaccuracy' },
  good:       { symbol: '!',  label: 'Good',       cls: 'cb-badge-good'       },
  book:       { symbol: '',   label: 'Book',       cls: 'cb-badge-book'       },
};

/**
 * Pre-computes all FEN strings for a list of analysed moves.
 * Index 0 is the starting position; index i+1 is after moves[i].
 */
function buildFens(moves) {
  const chess = new Chess();
  const fens = [chess.fen()];
  for (const move of moves) {
    try {
      chess.move(move.san);
      fens.push(chess.fen());
    } catch {
      break; // stop if move is invalid
    }
  }
  return fens;
}

/**
 * Format a move index as a human-readable label (e.g. "1." or "1…").
 * Returns 'Start' when index is -1.
 */
function moveLabel(index) {
  if (index === -1) return 'Start';
  return `${Math.floor(index / 2) + 1}${index % 2 === 0 ? '.' : '…'}`;
}

export default function ChessboardViewer({ moves, selectedIndex, onSelectIndex }) {
  const [fens, setFens] = useState([]);

  useEffect(() => {
    if (moves && moves.length > 0) {
      setFens(buildFens(moves));
    } else {
      setFens([]);
    }
  }, [moves]);

  // Keyboard navigation (← → = prev/next move; Home/End = first/last position)
  const handleKeyDown = useCallback((e) => {
    if (!moves || moves.length === 0) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSelectIndex(Math.max(-1, selectedIndex - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSelectIndex(Math.min(moves.length - 1, selectedIndex + 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSelectIndex(-1);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSelectIndex(moves.length - 1);
    }
  }, [moves, selectedIndex, onSelectIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!moves || moves.length === 0 || fens.length === 0) return null;

  // selectedIndex == -1 → starting position (fens[0])
  const fenIndex = selectedIndex + 1;
  const currentFen = fens[Math.min(fenIndex, fens.length - 1)] ?? fens[0];
  const currentMove = selectedIndex >= 0 ? moves[selectedIndex] : null;

  // Highlight the last-move squares
  const customSquareStyles = {};
  if (currentMove) {
    customSquareStyles[currentMove.from] = { background: 'rgba(119, 87, 77, 0.35)' };
    customSquareStyles[currentMove.to]   = { background: 'rgba(119, 87, 77, 0.55)' };
  }

  const evalStr = currentMove?.evalAfter !== null && currentMove?.evalAfter !== undefined
    ? (currentMove.evalAfter > 0 ? '+' : '') + (currentMove.evalAfter / 100).toFixed(2)
    : null;

  const classInfo = currentMove
    ? (CLASSIFICATION_LABELS[currentMove.classification] ?? CLASSIFICATION_LABELS.good)
    : null;

  return (
    <div className="cb-root">
      {/* Board */}
      <div className="cb-board-wrap">
        <Chessboard
          id="analysis-board"
          position={currentFen}
          arePiecesDraggable={false}
          customDarkSquareStyle={{ backgroundColor: '#2d4b3e' }}
          customLightSquareStyle={{ backgroundColor: '#fef9f0' }}
          customSquareStyles={customSquareStyles}
          boardWidth={360}
        />
      </div>

      {/* Move info strip */}
      <div className="cb-info-strip">
        {currentMove ? (
          <>
            <span className="cb-move-label">
              {moveLabel(selectedIndex)}{currentMove.san}
            </span>
            {classInfo?.symbol && (
              <span className={`cb-badge ${classInfo.cls}`}>
                {classInfo.symbol}
              </span>
            )}
            {classInfo?.label && (
              <span className="cb-class-label">{classInfo.label}</span>
            )}
            {evalStr && <span className="cb-eval">{evalStr}</span>}
          </>
        ) : (
          <span className="cb-move-label cb-start-label">Starting position</span>
        )}
      </div>

      {/* Navigation controls */}
      <div className="cb-nav">
        <button
          className="cb-nav-btn"
          onClick={() => onSelectIndex(-1)}
          disabled={selectedIndex === -1}
          title="Go to start"
          aria-label="Go to start"
        >
          <span className="material-symbols-outlined">first_page</span>
        </button>
        <button
          className="cb-nav-btn"
          onClick={() => onSelectIndex(Math.max(-1, selectedIndex - 1))}
          disabled={selectedIndex === -1}
          title="Previous move"
          aria-label="Previous move"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <span className="cb-nav-counter">
          {moveLabel(selectedIndex)}
        </span>
        <button
          className="cb-nav-btn"
          onClick={() => onSelectIndex(Math.min(moves.length - 1, selectedIndex + 1))}
          disabled={selectedIndex === moves.length - 1}
          title="Next move"
          aria-label="Next move"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
        <button
          className="cb-nav-btn"
          onClick={() => onSelectIndex(moves.length - 1)}
          disabled={selectedIndex === moves.length - 1}
          title="Go to end"
          aria-label="Go to end"
        >
          <span className="material-symbols-outlined">last_page</span>
        </button>
      </div>

      <p className="cb-kbd-hint">← → arrow keys to navigate</p>
    </div>
  );
}
