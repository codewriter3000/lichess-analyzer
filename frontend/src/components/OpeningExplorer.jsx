import { useState, useCallback, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import './OpeningExplorer.css';

function readRgbVar(varName, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

function formatMoveNumber(index) {
  return `${Math.floor(index / 2) + 1}${index % 2 === 0 ? '.' : '…'}`;
}

export default function OpeningExplorer() {
  const [tree, setTree] = useState(null);
  const [totalGames, setTotalGames] = useState(0);
  const [movePath, setMovePath] = useState([]);
  const [positionData, setPositionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  // Compute FEN from move path
  const currentFen = useMemo(() => {
    const chess = new Chess();
    for (const san of movePath) {
      try {
        chess.move(san);
      } catch {
        break;
      }
    }
    return chess.fen();
  }, [movePath]);

  // Highlight squares for last move
  const lastMoveSquares = useMemo(() => {
    if (movePath.length === 0) return {};
    const chess = new Chess();
    let lastMove = null;
    for (const san of movePath) {
      try {
        lastMove = chess.move(san);
      } catch {
        break;
      }
    }
    if (!lastMove) return {};
    const lastFrom = `rgb(${readRgbVar('--board-last-from', '119 87 77')} / 0.35)`;
    const lastTo = `rgb(${readRgbVar('--board-last-to', '119 87 77')} / 0.58)`;
    return {
      [lastMove.from]: { background: lastFrom },
      [lastMove.to]: { background: lastTo },
    };
  }, [movePath]);

  async function queryPosition(moves) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/opening-explorer/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setPositionData(data);
    } catch (e) {
      setError(e.message);
      setPositionData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file) {
    if (!file) return;
    setUploading(true);
    setError('');
    setFileName(file.name);
    const formData = new FormData();
    formData.append('csv', file);

    try {
      const res = await fetch('/api/opening-explorer', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setTree(true);
      setTotalGames(data.totalGames);
      setMovePath([]);
      await queryPosition([]);
    } catch (e) {
      setError(e.message);
      setTree(null);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleUpload(file);
    } else {
      setError('Please drop a CSV file.');
    }
  }

  async function handleMoveClick(san) {
    const newPath = [...movePath, san];
    setMovePath(newPath);
    await queryPosition(newPath);
  }

  async function handleGoToMove(index) {
    const newPath = movePath.slice(0, index);
    setMovePath(newPath);
    await queryPosition(newPath);
  }

  const handlePieceDrop = useCallback((sourceSquare, targetSquare) => {
    const chess = new Chess();
    for (const san of movePath) {
      try { chess.move(san); } catch { break; }
    }
    try {
      const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (move) {
        const newPath = [...movePath, move.san];
        setMovePath(newPath);
        queryPosition(newPath);
        return true;
      }
    } catch { /* invalid move */ }
    return false;
  }, [movePath]);

  const boardDark = `rgb(${readRgbVar('--board-dark', '45 75 62')})`;
  const boardLight = `rgb(${readRgbVar('--board-light', '254 249 240')})`;

  // Upload state
  if (!tree) {
    return (
      <div className="space-y-6">
        <div
          className={`oe-upload-zone${dragging ? ' dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <span className="material-symbols-outlined oe-upload-icon" style={{ fontVariationSettings: "'FILL' 1" }}>
            upload_file
          </span>
          <span className="oe-upload-label">Upload Game CSV</span>
          <span className="oe-upload-hint">
            Drop a Lichess CSV export here, or click to browse
          </span>
          {fileName && !error && <span className="oe-upload-file-label">{fileName}</span>}
          {error && <span className="oe-upload-error">{error}</span>}
          {uploading && (
            <div className="flex items-center gap-3">
              <span className="spinner" />
              <span className="oe-upload-hint">Building opening tree…</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    );
  }

  // Explorer state
  return (
    <div className="space-y-6">
      {/* Upload new CSV button row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="oe-game-count">{totalGames} games loaded</span>
          {positionData?.opening && (
            <>
              <span className="oe-crumb-sep">·</span>
              <span className="font-headline text-primary">
                {positionData.opening}
              </span>
              {positionData.eco && (
                <span className="oe-eco-badge">{positionData.eco}</span>
              )}
            </>
          )}
        </div>
        <button
          className="oe-upload-btn"
          onClick={() => { setTree(null); setMovePath([]); setPositionData(null); setFileName(''); }}
        >
          New CSV
        </button>
      </div>

      {/* Move path breadcrumb */}
      {movePath.length > 0 && (
        <div className="oe-breadcrumb">
          <button className="oe-crumb-start" onClick={() => handleGoToMove(0)}>
            Start
          </button>
          {movePath.map((san, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="oe-crumb-sep">›</span>
              <button
                className={`oe-crumb-btn${i === movePath.length - 1 ? ' active' : ''}`}
                onClick={() => handleGoToMove(i + 1)}
              >
                {formatMoveNumber(i)}{san}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Main layout: Board + Data */}
      <div className="oe-layout">
        {/* Board column */}
        <div className="oe-board-col">
          <div className="oe-board-wrap">
            <Chessboard
              id="explorer-board"
              position={currentFen}
              onPieceDrop={handlePieceDrop}
              customDarkSquareStyle={{ backgroundColor: boardDark }}
              customLightSquareStyle={{ backgroundColor: boardLight }}
              customSquareStyles={lastMoveSquares}
              boardWidth={360}
            />
          </div>
          {/* Navigation */}
          <div className="oe-nav">
            <button
              className="oe-nav-btn"
              onClick={() => handleGoToMove(0)}
              disabled={movePath.length === 0}
              title="Go to start"
            >
              <span className="material-symbols-outlined">first_page</span>
            </button>
            <button
              className="oe-nav-btn"
              onClick={() => handleGoToMove(Math.max(0, movePath.length - 1))}
              disabled={movePath.length === 0}
              title="Previous move"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="font-label text-xs uppercase tracking-widest text-primary/40 w-12 text-center">
              {movePath.length === 0 ? 'Start' : formatMoveNumber(movePath.length - 1)}
            </span>
            <button
              className="oe-nav-btn"
              disabled
              title="Next move"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button
              className="oe-nav-btn"
              disabled
              title="Go to end"
            >
              <span className="material-symbols-outlined">last_page</span>
            </button>
          </div>
          <p className="font-label text-[10px] uppercase tracking-widest text-primary/30">
            Click a move or drag a piece to explore
          </p>
        </div>

        {/* Data column */}
        <div className="oe-data-col">
          {/* Position overview */}
          {positionData && (
            <div className="oe-opening-header">
              <div className="flex items-center justify-between">
                <h3 className="card-title">
                  {positionData.opening || (movePath.length === 0 ? 'Starting Position' : 'Position')}
                  {positionData.eco && <span className="oe-eco-badge">{positionData.eco}</span>}
                </h3>
              </div>
              <div className="oe-position-stats">
                <span className="oe-stat-item">
                  <span className="oe-stat-value">{positionData.totalGames}</span>
                  games
                </span>
                <span className="oe-stat-item">
                  <span className="oe-stat-value" style={{ color: 'rgb(var(--color-primary))' }}>
                    {positionData.totalGames > 0 ? ((positionData.whiteWins / positionData.totalGames) * 100).toFixed(1) : 0}%
                  </span>
                  white
                </span>
                <span className="oe-stat-item">
                  <span className="oe-stat-value" style={{ color: 'rgb(var(--chess-draw))' }}>
                    {positionData.totalGames > 0 ? ((positionData.draws / positionData.totalGames) * 100).toFixed(1) : 0}%
                  </span>
                  draws
                </span>
                <span className="oe-stat-item">
                  <span className="oe-stat-value" style={{ color: 'rgb(var(--chess-danger))' }}>
                    {positionData.totalGames > 0 ? ((positionData.blackWins / positionData.totalGames) * 100).toFixed(1) : 0}%
                  </span>
                  black
                </span>
              </div>
              {/* Overall results bar */}
              {positionData.totalGames > 0 && (
                <div className="mt-3">
                  <ResultsBar
                    whiteWins={positionData.whiteWins}
                    draws={positionData.draws}
                    blackWins={positionData.blackWins}
                    total={positionData.totalGames}
                    height="h-5"
                    maxWidth="max-w-full"
                  />
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="oe-loading">
              <span className="spinner" /> Loading position data…
            </div>
          )}

          {/* Move table */}
          {positionData && positionData.moves.length > 0 && (
            <div className="oe-move-table-card">
              <div className="oe-move-table-header">
                <h3 className="card-title">Moves</h3>
                <span className="oe-game-count">{positionData.moves.length} continuations</span>
              </div>
              <table className="oe-move-table">
                <thead>
                  <tr>
                    <th>Move</th>
                    <th>Games</th>
                    <th>Results</th>
                    <th>Avg Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {positionData.moves.map(move => (
                    <tr
                      key={move.san}
                      className="oe-move-row"
                      onClick={() => handleMoveClick(move.san)}
                    >
                      <td>
                        <span className="oe-move-san">{move.san}</span>
                      </td>
                      <td>
                        <span className="oe-move-games">{move.totalGames}</span>
                        <span className="oe-move-pct ml-2">
                          ({positionData.totalGames > 0
                            ? ((move.totalGames / positionData.totalGames) * 100).toFixed(1)
                            : 0}%)
                        </span>
                      </td>
                      <td>
                        <ResultsBar
                          whiteWins={move.whiteWins}
                          draws={move.draws}
                          blackWins={move.blackWins}
                          total={move.totalGames}
                        />
                      </td>
                      <td>
                        <span className="oe-avg-rating">
                          {move.avgWhiteElo > 0 && move.avgBlackElo > 0 ? Math.round((move.avgWhiteElo + move.avgBlackElo) / 2) : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {positionData && positionData.moves.length === 0 && !loading && (
            <div className="oe-empty">
              <span className="material-symbols-outlined oe-empty-icon">
                search_off
              </span>
              <p className="oe-empty-text">No games continue from this position</p>
            </div>
          )}

          {error && <p className="font-body text-sm text-chess-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function ResultsBar({ whiteWins, draws, blackWins, total, height = 'h-4', maxWidth = 'max-w-[200px]' }) {
  if (total === 0) return <span className="oe-bar-label">—</span>;
  const wPct = (whiteWins / total) * 100;
  const dPct = (draws / total) * 100;
  const bPct = (blackWins / total) * 100;

  return (
    <div className="oe-results-bar-wrap">
      <div className={`oe-results-bar ${height} ${maxWidth}`}>
        {wPct > 0 && <div className="oe-bar-white" style={{ width: `${wPct}%` }} />}
        {dPct > 0 && <div className="oe-bar-draw" style={{ width: `${dPct}%` }} />}
        {bPct > 0 && <div className="oe-bar-black" style={{ width: `${bPct}%` }} />}
      </div>
      <div className="flex gap-2">
        <span className="oe-bar-label">{wPct.toFixed(0)}</span>
        <span className="oe-bar-label">{dPct.toFixed(0)}</span>
        <span className="oe-bar-label">{bPct.toFixed(0)}</span>
      </div>
    </div>
  );
}
