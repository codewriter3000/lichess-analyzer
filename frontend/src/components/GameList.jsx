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

  function resultIcon(result) {
    if (result === '1-0')     return { icon: 'emoji_events', cls: 'result-icon-win'  };
    if (result === '0-1')     return { icon: 'emoji_events', cls: 'result-icon-loss' };
    if (result === '1/2-1/2') return { icon: 'handshake',   cls: 'result-icon-draw' };
    return                           { icon: 'help_outline', cls: 'result-icon-draw' };
  }

  function resultLabel(result) {
    if (result === '1-0')     return '1 – 0';
    if (result === '0-1')     return '0 – 1';
    if (result === '1/2-1/2') return '½ – ½';
    return result;
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div id="game-list-toolbar">
        <div className="flex-1 min-w-48">
          <input
            type="text"
            placeholder="Search by player or opening…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="game-list-search"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="font-label text-xs uppercase tracking-widest text-primary/50">Analysis depth</label>
          <input
            type="number"
            min="5"
            max="25"
            value={depth}
            onChange={e => setDepth(Number(e.target.value))}
            className="game-list-depth"
          />
        </div>
        <span className="font-label text-xs uppercase tracking-widest text-primary/40">
          {filtered.length} game{filtered.length !== 1 ? 's' : ''}
        </span>
        {isAnalyzing && (
          <div className="game-list-progress-track" aria-label="analysis in progress">
            <div className="game-list-progress-fill" />
          </div>
        )}
      </div>

      {/* Games feed */}
      <div className="game-feed">
        <div id="game-feed-header">
          <h3 className="card-title">Recent Manuscripts</h3>
          <span className="material-symbols-outlined text-secondary">history_edu</span>
        </div>
        <div className="divide-y divide-primary/5">
          {filtered.map(game => {
            const { icon, cls } = resultIcon(game.result);
            return (
              <div
                key={game.index}
                className={`game-row${selectedGame === game.index ? ' selected' : ''}`}
                onClick={() => onSelectGame(game.index)}
              >
                <div className="game-row-icon">
                  <span className={`material-symbols-outlined ${cls}`}>{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-headline text-base text-primary truncate">
                      {game.white}
                      {game.whiteElo && <span className="font-body text-xs text-primary/40 ml-1">({game.whiteElo})</span>}
                      {' vs. '}
                      {game.black}
                      {game.blackElo && <span className="font-body text-xs text-primary/40 ml-1">({game.blackElo})</span>}
                    </h4>
                    {game.date && (
                      <span className="font-label text-[10px] uppercase text-primary/40 whitespace-nowrap flex-shrink-0">{game.date}</span>
                    )}
                  </div>
                  <p className="text-xs text-primary/60 mt-0.5">
                    {resultLabel(game.result)}
                    {game.opening && ` • ${game.opening}`}
                    {` • ${Math.floor(game.plyCount / 2)} moves`}
                  </p>
                </div>
                <button
                  className="analyze-btn"
                  onClick={e => {
                    e.stopPropagation();
                    onSelectGame(game.index);
                    onAnalyze(game.index, depth);
                  }}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing && selectedGame === game.index ? (
                    <><span className="spinner" />Analyzing…</>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">search</span>
                      Analyze
                    </>
                  )}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-primary/20 block mb-2">search_off</span>
              <p className="font-label text-xs uppercase tracking-widest text-primary/40">No games found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
