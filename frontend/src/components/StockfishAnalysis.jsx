import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import './StockfishAnalysis.css';

export default function StockfishAnalysis({ result, game, isAnalyzing }) {
  if (isAnalyzing) {
    return (
      <div className="analysis-loading">
        <span className="spinner" />
        <p>Running Stockfish analysis… this may take up to a minute.</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="analysis-empty">
        <p>Select a game from the Games tab and click <strong>🔍 Analyze</strong> to see Stockfish analysis.</p>
      </div>
    );
  }

  const { moves, whiteAccuracy, blackAccuracy, summary, phaseAccuracy, tacticAccuracy } = result;

  // Build eval chart data
  const chartData = moves.map((m, i) => ({
    name: `${m.moveNumber}${m.color === 'white' ? '.' : '…'}${m.san}`,
    eval: clampEval(m.evalAfter),
    color: m.color,
  }));

  // Add starting position eval
  if (moves.length > 0 && moves[0].evalBefore !== null) {
    chartData.unshift({ name: 'Start', eval: clampEval(moves[0].evalBefore), color: null });
  }

  const whiteName = game?.white ?? 'White';
  const blackName = game?.black ?? 'Black';

  return (
    <div className="analysis">
      {game && (
        <div className="card analysis-header">
          <h2>
            {game.white} ({game.whiteElo ?? '?'}) vs {game.black} ({game.blackElo ?? '?'})
          </h2>
          <p className="game-info">
            {game.date && <span>{game.date}</span>}
            {game.opening && <span> · {game.opening}</span>}
          </p>
        </div>
      )}

      {/* Overall accuracy summary */}
      <div className="card">
        <h2>Accuracy</h2>
        <div className="accuracy-row">
          <AccuracyBlock label={whiteName} accuracy={whiteAccuracy} color="white" summary={summary} side="white" />
          <AccuracyBlock label={blackName} accuracy={blackAccuracy} color="black" summary={summary} side="black" />
        </div>
      </div>

      {/* Per-phase accuracy */}
      {phaseAccuracy && (
        <div className="card">
          <h2>Accuracy by Phase</h2>
          <div className="phase-accuracy-grid">
            <PhaseAccuracyTable label={whiteName} phaseData={phaseAccuracy.white} color="white" />
            <PhaseAccuracyTable label={blackName} phaseData={phaseAccuracy.black} color="black" />
          </div>
        </div>
      )}

      {/* Tactic accuracy */}
      {tacticAccuracy && (
        <div className="card">
          <h2>Tactic Accuracy</h2>
          <div className="tactic-accuracy-grid">
            <TacticAccuracyBlock label={whiteName} tacticData={tacticAccuracy.white} color="white" />
            <TacticAccuracyBlock label={blackName} tacticData={tacticAccuracy.black} color="black" />
          </div>
        </div>
      )}

      {/* Evaluation chart */}
      {chartData.length > 1 && (
        <div className="card">
          <h2>Evaluation</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#769656" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#769656" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" />
              <XAxis dataKey="name" tick={false} />
              <YAxis domain={[-10, 10]} tick={{ fill: '#8a9bb5', fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#4a90d9" strokeDasharray="4 2" />
              <Tooltip
                contentStyle={{ background: '#16213e', border: '1px solid #2a3a5c', fontSize: '0.85rem' }}
                formatter={val => [`${val > 0 ? '+' : ''}${val.toFixed(2)}`, 'Eval']}
              />
              <Area type="monotone" dataKey="eval" stroke="var(--primary)" fill="url(#evalGrad)" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="eval-legend">Positive = White advantage · Negative = Black advantage</p>
        </div>
      )}

      {/* Move list */}
      <div className="card">
        <h2>Move Analysis</h2>
        <div className="move-table-wrapper">
          <table className="move-table">
            <thead>
              <tr>
                <th>#</th>
                <th>White</th>
                <th>Eval</th>
                <th>CPL</th>
                <th></th>
                <th>Black</th>
                <th>Eval</th>
                <th>CPL</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pairMoves(moves).map(pair => (
                <tr key={pair.moveNumber}>
                  <td className="move-number">{pair.moveNumber}.</td>
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

function AccuracyBlock({ label, accuracy, color, summary, side }) {
  const accColor =
    accuracy >= 90 ? '#27ae60' : accuracy >= 70 ? '#f39c12' : '#e74c3c';

  return (
    <div className={`accuracy-block accuracy-${color}`}>
      <div className="acc-label">{label}</div>
      <div className="acc-value" style={{ color: accColor }}>
        {accuracy !== null ? `${accuracy}%` : 'N/A'}
      </div>
      <div className="acc-breakdown">
        <span className="blunder">● {summary.blunders[side]} blunder{summary.blunders[side] !== 1 ? 's' : ''}</span>
        <span className="mistake">● {summary.mistakes[side]} mistake{summary.mistakes[side] !== 1 ? 's' : ''}</span>
        <span className="inaccuracy">● {summary.inaccuracies[side]} inaccurac{summary.inaccuracies[side] !== 1 ? 'ies' : 'y'}</span>
      </div>
    </div>
  );
}

const PHASE_LABELS = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' };

function PhaseAccuracyTable({ label, phaseData, color }) {
  return (
    <div className={`phase-accuracy-block phase-${color}`}>
      <div className="phase-player-label">{label}</div>
      <table className="phase-table">
        <tbody>
          {Object.entries(PHASE_LABELS).map(([key, display]) => {
            const val = phaseData?.[key];
            const accColor = val === null ? '#8a9bb5'
              : val >= 90 ? '#27ae60'
              : val >= 70 ? '#f39c12'
              : '#e74c3c';
            return (
              <tr key={key}>
                <td className="phase-name">{display}</td>
                <td className="phase-val" style={{ color: accColor }}>
                  {val !== null ? `${val}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

function TacticAccuracyBlock({ label, tacticData, color }) {
  const total = (tacticData?.found ?? 0) + (tacticData?.missed ?? 0);
  const foundPct = total > 0 ? Math.round((tacticData.found / total) * 100) : null;
  const pctColor = foundPct === null ? '#8a9bb5'
    : foundPct >= 75 ? '#27ae60'
    : foundPct >= 50 ? '#f39c12'
    : '#e74c3c';

  const byType = tacticData?.byType ?? {};
  const types = Object.keys(byType).sort();

  return (
    <div className={`tactic-block tactic-${color}`}>
      <div className="tactic-player-label">{label}</div>
      <div className="tactic-summary">
        <span className="tactic-found">✔ {tacticData?.found ?? 0} found</span>
        <span className="tactic-missed">✘ {tacticData?.missed ?? 0} missed</span>
        {foundPct !== null && (
          <span className="tactic-pct" style={{ color: pctColor }}>{foundPct}%</span>
        )}
      </div>
      {types.length > 0 && (
        <table className="tactic-type-table">
          <tbody>
            {types.map(type => {
              const { found, missed } = byType[type];
              const total = found + missed;
              const pct = total > 0 ? Math.round((found / total) * 100) : 0;
              return (
                <tr key={type}>
                  <td className="tactic-type-name">{TACTIC_LABELS[type] ?? type}</td>
                  <td className="tactic-type-found">✔{found}</td>
                  <td className="tactic-type-missed">✘{missed}</td>
                  <td className="tactic-type-pct">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {types.length === 0 && (
        <p className="tactic-none">No tactical moments detected.</p>
      )}
    </div>
  );
}

function MoveCell({ move }) {
  if (!move) return <><td /><td /><td /><td /></>;
  const evalStr = move.evalAfter !== null
    ? (move.evalAfter > 0 ? '+' : '') + (move.evalAfter / 100).toFixed(2)
    : '—';

  return (
    <>
      <td className={`move-san ${move.classification}`}>
        {move.san}
        {move.tactic && (
          <span className={`tactic-icon tactic-icon-${move.tactic.found ? 'found' : 'missed'}`}
            title={`${move.tactic.found ? 'Tactic found' : 'Tactic missed'}: ${move.tactic.type}`}>
            {move.tactic.found ? '★' : '☆'}
          </span>
        )}
      </td>
      <td className="move-eval">{evalStr}</td>
      <td className="move-cpl">{move.cploss > 0 ? `-${move.cploss}` : '0'}</td>
      <td>
        {move.classification !== 'good' && move.classification !== 'book' && (
          <span className={`class-icon ${move.classification}`}>
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
  // Convert centipawns to pawns, clamp to [-10, 10]
  return Math.max(-10, Math.min(10, cp / 100));
}
