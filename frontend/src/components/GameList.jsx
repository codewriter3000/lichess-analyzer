import { useState } from 'react';
import './GameList.css';

export default function GameList({ games, selectedGame, onSelectGame, onAnalyze, isAnalyzing }) {
  const [depth, setDepth] = useState(15);
  const [search, setSearch] = useState('');

  const filtered = games.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.white.toLowerCase().includes(q) ||
      g.black.toLowerCase().includes(q) ||
      (g.opening && g.opening.toLowerCase().includes(q))
    );
  });

  function resultBadge(result) {
    if (result === '1-0') return <span className="badge badge-win">White wins</span>;
    if (result === '0-1') return <span className="badge badge-loss">Black wins</span>;
    if (result === '1/2-1/2') return <span className="badge badge-draw">Draw</span>;
    return <span className="badge badge-unknown">{result}</span>;
  }

  return (
    <div className="game-list">
      <div className="list-toolbar">
        <input
          type="text"
          placeholder="Search by player or opening…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <div className="depth-row">
          <label htmlFor="depth">Analysis depth:</label>
          <input
            id="depth"
            type="number"
            min="5"
            max="25"
            value={depth}
            onChange={e => setDepth(Number(e.target.value))}
            className="depth-input"
          />
        </div>
      </div>

      <p className="list-count">{filtered.length} game{filtered.length !== 1 ? 's' : ''}</p>

      <div className="game-rows">
        {filtered.map(game => (
          <div
            key={game.index}
            className={`game-row ${selectedGame === game.index ? 'selected' : ''}`}
            onClick={() => onSelectGame(game.index)}
          >
            <div className="game-players">
              <span className="player-name">{game.white}</span>
              {game.whiteElo && <span className="elo">({game.whiteElo})</span>}
              <span className="vs">vs</span>
              <span className="player-name">{game.black}</span>
              {game.blackElo && <span className="elo">({game.blackElo})</span>}
            </div>
            <div className="game-meta">
              {game.date && <span className="game-date">{game.date}</span>}
              {game.opening && <span className="game-opening">{game.opening}</span>}
              {resultBadge(game.result)}
              <span className="ply-count">{Math.floor(game.plyCount / 2)} moves</span>
            </div>
            <button
              className="btn btn-secondary analyze-btn"
              onClick={e => {
                e.stopPropagation();
                onSelectGame(game.index);
                onAnalyze(game.index, depth);
              }}
              disabled={isAnalyzing}
            >
              {isAnalyzing && selectedGame === game.index
                ? <><span className="spinner" />Analyzing…</>
                : '🔍 Analyze'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
