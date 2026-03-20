import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

export default function StockfishAnalysis({ result, game, isAnalyzing }) {
  if (isAnalyzing) {
    return (
      <div className="bg-surface-container rounded-sm p-12 shadow-sm flex flex-col items-center gap-4">
        <span className="spinner" />
        <p className="font-label text-sm uppercase tracking-widest text-primary/60">
          Running Stockfish analysis… this may take up to a minute.
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-surface-container rounded-sm p-12 shadow-sm flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-5xl text-primary/20">search</span>
        <p className="font-body text-primary/60 text-center">
          Select a game from the <strong className="font-semibold text-primary">Library</strong> tab and click{' '}
          <strong className="font-semibold text-primary">Analyze</strong> to see Stockfish analysis.
        </p>
      </div>
    );
  }

  const { moves, whiteAccuracy, blackAccuracy, summary, phaseAccuracy, tacticAccuracy } = result;

  const chartData = moves.map(m => ({
    name: `${m.moveNumber}${m.color === 'white' ? '.' : '…'}${m.san}`,
    eval: clampEval(m.evalAfter),
    color: m.color,
  }));

  if (moves.length > 0 && moves[0].evalBefore !== null) {
    chartData.unshift({ name: 'Start', eval: clampEval(moves[0].evalBefore), color: null });
  }

  const whiteName = game?.white ?? 'White';
  const blackName = game?.black ?? 'Black';

  return (
    <div className="space-y-6">
      {/* Game header */}
      {game && (
        <div className="bg-surface-container rounded-sm p-6 shadow-sm">
          <h2 className="font-headline text-xl text-primary">
            {game.white} ({game.whiteElo ?? '?'}) vs {game.black} ({game.blackElo ?? '?'})
          </h2>
          <p className="font-body text-sm text-primary/60 mt-1">
            {game.date && <span>{game.date}</span>}
            {game.opening && <span> · {game.opening}</span>}
          </p>
        </div>
      )}

      {/* Accuracy summary */}
      <div className="bg-surface-container rounded-sm p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline text-lg text-primary">Accuracy</h3>
          <span className="material-symbols-outlined text-secondary">analytics</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AccuracyBlock label={whiteName} accuracy={whiteAccuracy} summary={summary} side="white" />
          <AccuracyBlock label={blackName} accuracy={blackAccuracy} summary={summary} side="black" />
        </div>
      </div>

      {/* Phase accuracy */}
      {phaseAccuracy && (
        <div className="bg-surface-container rounded-sm p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline text-lg text-primary">Accuracy by Phase</h3>
            <span className="material-symbols-outlined text-secondary">stacked_line_chart</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PhaseAccuracyTable label={whiteName} phaseData={phaseAccuracy.white} />
            <PhaseAccuracyTable label={blackName} phaseData={phaseAccuracy.black} />
          </div>
        </div>
      )}

      {/* Tactic accuracy */}
      {tacticAccuracy && (
        <div className="bg-surface-container rounded-sm p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline text-lg text-primary">Tactic Accuracy</h3>
            <span className="material-symbols-outlined text-secondary">bolt</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TacticAccuracyBlock label={whiteName} tacticData={tacticAccuracy.white} />
            <TacticAccuracyBlock label={blackName} tacticData={tacticAccuracy.black} />
          </div>
        </div>
      )}

      {/* Evaluation chart */}
      {chartData.length > 1 && (
        <div className="bg-surface-container rounded-sm p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline text-lg text-primary">Evaluation</h3>
            <span className="material-symbols-outlined text-secondary">show_chart</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#163428" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#163428" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(22,52,40,0.08)" />
              <XAxis dataKey="name" tick={false} />
              <YAxis domain={[-10, 10]} tick={{ fill: '#163428', opacity: 0.4, fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#77574d" strokeDasharray="4 2" />
              <Tooltip
                contentStyle={{ background: '#f2ede4', border: '1px solid rgba(22,52,40,0.1)', borderRadius: '2px', fontSize: '0.85rem' }}
                formatter={val => [`${val > 0 ? '+' : ''}${val.toFixed(2)}`, 'Eval']}
              />
              <Area type="monotone" dataKey="eval" stroke="#163428" fill="url(#evalGrad)" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="font-label text-xs uppercase tracking-widest text-primary/40 mt-3 text-center">
            Positive = White advantage · Negative = Black advantage
          </p>
        </div>
      )}

      {/* Move list */}
      <div className="bg-surface-container rounded-sm p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline text-lg text-primary">Move Analysis</h3>
          <span className="material-symbols-outlined text-secondary">table_rows</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10">
                {['#', 'White', 'Eval', 'CPL', '', 'Black', 'Eval', 'CPL', ''].map((h, i) => (
                  <th key={i} className="font-label text-[10px] uppercase tracking-widest text-primary/40 px-2 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairMoves(moves).map(pair => (
                <tr key={pair.moveNumber} className="border-b border-primary/5 hover:bg-surface-container-high transition-colors">
                  <td className="px-2 py-2 font-label text-xs text-primary/40">{pair.moveNumber}.</td>
                  <MoveCell move={pair.white} />
                  <MoveCell move={pair.black} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function accColor(accuracy) {
  if (accuracy === null) return 'text-primary/40';
  if (accuracy >= 90) return 'text-chess-success';
  if (accuracy >= 70) return 'text-chess-warning';
  return 'text-chess-danger';
}

function AccuracyBlock({ label, accuracy, summary, side }) {
  return (
    <div className="bg-surface-container-high rounded-sm p-6">
      <div className="font-label text-xs uppercase tracking-widest text-primary/50 mb-1">{label}</div>
      <div className={`font-headline text-3xl font-bold mb-4 ${accColor(accuracy)}`}>
        {accuracy !== null ? `${accuracy}%` : 'N/A'}
      </div>
      <div className="space-y-1 font-body text-sm">
        <span className="block text-chess-danger">● {summary.blunders[side]} blunder{summary.blunders[side] !== 1 ? 's' : ''}</span>
        <span className="block text-chess-warning">● {summary.mistakes[side]} mistake{summary.mistakes[side] !== 1 ? 's' : ''}</span>
        <span className="block text-chess-inaccuracy">● {summary.inaccuracies[side]} inaccurac{summary.inaccuracies[side] !== 1 ? 'ies' : 'y'}</span>
      </div>
    </div>
  );
}

const PHASE_LABELS = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' };

function PhaseAccuracyTable({ label, phaseData }) {
  return (
    <div className="bg-surface-container-high rounded-sm p-6">
      <div className="font-label text-xs uppercase tracking-widest text-primary/50 mb-4">{label}</div>
      <div className="space-y-2">
        {Object.entries(PHASE_LABELS).map(([key, display]) => {
          const val = phaseData?.[key];
          return (
            <div key={key} className="flex justify-between items-center">
              <span className="font-body text-sm text-primary/70">{display}</span>
              <span className={`font-headline text-base ${accColor(val)}`}>
                {val !== null ? `${val}%` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TACTIC_LABELS = {
  checkmate: '# Checkmate',
  check: '+ Check',
  fork: '⑂ Fork',
  sacrifice: '✕ Sacrifice',
  capture: '× Capture',
  promotion: '♛ Promotion',
};

function TacticAccuracyBlock({ label, tacticData }) {
  const total = (tacticData?.found ?? 0) + (tacticData?.missed ?? 0);
  const foundPct = total > 0 ? Math.round((tacticData.found / total) * 100) : null;
  const byType = tacticData?.byType ?? {};
  const types = Object.keys(byType).sort();

  return (
    <div className="bg-surface-container-high rounded-sm p-6">
      <div className="font-label text-xs uppercase tracking-widest text-primary/50 mb-3">{label}</div>
      <div className="flex items-center gap-4 mb-4">
        <span className="font-body text-sm text-chess-success">✔ {tacticData?.found ?? 0} found</span>
        <span className="font-body text-sm text-chess-danger">✘ {tacticData?.missed ?? 0} missed</span>
        {foundPct !== null && (
          <span className={`font-headline text-lg ${accColor(foundPct)}`}>{foundPct}%</span>
        )}
      </div>
      {types.length > 0 ? (
        <div className="space-y-1.5">
          {types.map(type => {
            const { found, missed } = byType[type];
            const t = found + missed;
            const pct = t > 0 ? Math.round((found / t) * 100) : 0;
            return (
              <div key={type} className="flex items-center justify-between text-xs font-body">
                <span className="text-primary/70">{TACTIC_LABELS[type] ?? type}</span>
                <span className="flex gap-3 text-primary/50">
                  <span className="text-chess-success">✔{found}</span>
                  <span className="text-chess-danger">✘{missed}</span>
                  <span className="font-label">{pct}%</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="font-label text-xs uppercase tracking-widest text-primary/30">No tactical moments detected.</p>
      )}
    </div>
  );
}

function MoveCell({ move }) {
  if (!move) return <><td /><td /><td /><td /></>;
  const evalStr = move.evalAfter !== null
    ? (move.evalAfter > 0 ? '+' : '') + (move.evalAfter / 100).toFixed(2)
    : '—';

  const classCss = {
    blunder: 'text-chess-danger font-semibold',
    mistake: 'text-chess-warning',
    inaccuracy: 'text-chess-inaccuracy',
    good: 'text-primary',
    book: 'text-primary/50',
  }[move.classification] ?? 'text-primary';

  return (
    <>
      <td className={`px-2 py-2 font-body ${classCss}`}>
        {move.san}
        {move.tactic && (
          <span
            className={`ml-1 text-xs ${move.tactic.found ? 'text-chess-success' : 'text-primary/30'}`}
            title={`${move.tactic.found ? 'Tactic found' : 'Tactic missed'}: ${move.tactic.type}`}
          >
            {move.tactic.found ? '★' : '☆'}
          </span>
        )}
      </td>
      <td className="px-2 py-2 font-body text-xs text-primary/50">{evalStr}</td>
      <td className="px-2 py-2 font-body text-xs text-primary/40">{move.cploss > 0 ? `-${move.cploss}` : '0'}</td>
      <td className="px-2 py-2 font-label text-xs">
        {move.classification !== 'good' && move.classification !== 'book' && (
          <span className={classCss}>
            {move.classification === 'blunder' ? '??' : move.classification === 'mistake' ? '?' : '?!'}
          </span>
        )}
      </td>
    </>
  );
}

function pairMoves(moves) {
  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      moveNumber: moves[i].moveNumber,
      white: moves[i],
      black: moves[i + 1] || null,
    });
  }
  return pairs;
}

function clampEval(cp) {
  if (cp === null) return null;
  return Math.max(-10, Math.min(10, cp / 100));
}

