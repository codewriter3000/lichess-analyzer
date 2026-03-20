import { useState } from 'react';

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
    if (result === '1-0') return { icon: 'emoji_events', cls: 'text-primary' };
    if (result === '0-1') return { icon: 'emoji_events', cls: 'text-secondary' };
    if (result === '1/2-1/2') return { icon: 'handshake', cls: 'text-primary/30' };
    return { icon: 'help_outline', cls: 'text-primary/30' };
  }

  function resultLabel(result) {
    if (result === '1-0') return '1 – 0';
    if (result === '0-1') return '0 – 1';
    if (result === '1/2-1/2') return '½ – ½';
    return result;
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-surface-container rounded-sm p-6 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-48">
          <input
            type="text"
            placeholder="Search by player or opening…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-background border border-primary/20 rounded-sm text-on-background px-4 py-2.5 font-body text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-primary/30"
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
            className="w-16 bg-background border border-primary/20 rounded-sm text-on-background px-2 py-2 text-sm text-center font-body focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <span className="font-label text-xs uppercase tracking-widest text-primary/40">
          {filtered.length} game{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Games feed */}
      <div className="bg-surface-container rounded-sm shadow-sm overflow-hidden">
        <div className="flex justify-between items-center p-6 pb-4 border-b border-primary/5">
          <h3 className="font-headline text-lg text-primary">Recent Manuscripts</h3>
          <span className="material-symbols-outlined text-secondary">history_edu</span>
        </div>
        <div className="divide-y divide-primary/5">
          {filtered.map(game => {
            const { icon, cls } = resultIcon(game.result);
            return (
              <div
                key={game.index}
                className={`flex items-center gap-4 py-4 px-6 cursor-pointer transition-colors ${
                  selectedGame === game.index ? 'bg-surface-container-high' : 'hover:bg-surface-container-high'
                }`}
                onClick={() => onSelectGame(game.index)}
              >
                <div className="w-10 h-10 bg-primary/5 flex items-center justify-center rounded-sm flex-shrink-0">
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
                  className="bg-secondary text-on-secondary px-4 py-2 rounded-sm font-label text-[10px] uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
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

