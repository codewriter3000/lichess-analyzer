import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import ChessboardViewer from './ChessboardViewer';
import './StockfishAnalysis.css';

function readRgbVar(varName, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value ? `rgb(${value})` : fallback;
}

export default function StockfishAnalysis({ result, game, isAnalyzing }) {
  const [selectedMoveIndex, setSelectedMoveIndex] = useState(-1);

  // Reset board position whenever a new analysis result loads
  useEffect(() => { setSelectedMoveIndex(-1); }, [result]);
  if (isAnalyzing) {
    return (
      <div className="analysis-state-card">
        <span className="spinner" />
        <p className="font-label text-sm uppercase tracking-widest text-primary/60">
          Running Stockfish analysis… this may take up to a minute.
        </p>
        <div className="analysis-progress-track" aria-label="analysis in progress">
          <div className="analysis-progress-fill" />
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="analysis-state-card">
        <span className="material-symbols-outlined text-5xl text-primary/20">search</span>
        <p className="font-body text-primary/60 text-center">
          Select a game from the <strong className="font-semibold text-primary">Library</strong> tab and click{' '}
          <strong className="font-semibold text-primary">Analyze</strong> to see Stockfish analysis.
        </p>
      </div>
    );
  }

  const { moves, whiteAccuracy, blackAccuracy, summary, phaseAccuracy, tacticAccuracy } = result;

  const chartColors = {
    primary: readRgbVar('--color-primary', '#163428'),
    secondary: readRgbVar('--color-secondary', '#77574d'),
    grid: readRgbVar('--chart-grid', 'rgba(22,52,40,0.08)'),
    axis: readRgbVar('--chart-axis', '#163428'),
    tooltipBg: readRgbVar('--tooltip-bg', '#f2ede4'),
    tooltipBorder: readRgbVar('--tooltip-border', 'rgba(22,52,40,0.1)'),
  };

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
        <div className="content-card p-6">
          <h2 className="font-headline text-xl text-primary">
            {game.white} ({game.whiteElo ?? '?'}) vs {game.black} ({game.blackElo ?? '?'})
          </h2>
          <p className="font-body text-sm text-primary/60 mt-1">
            {game.date && <span>{game.date}</span>}
            {game.opening && <span> · {game.opening}</span>}
          </p>
        </div>
      )}

      {/* Board viewer */}
      <div className="analysis-section">
        <div className="card-section-header">
          <h3 className="card-title">Board</h3>
          <span className="material-symbols-outlined text-secondary">chess</span>
        </div>
        <ChessboardViewer
          moves={moves}
          selectedIndex={selectedMoveIndex}
          onSelectIndex={setSelectedMoveIndex}
        />
      </div>

      {/* Accuracy summary */}
      <div className="analysis-section">
        <div className="card-section-header">
          <h3 className="card-title">Accuracy</h3>
          <span className="material-symbols-outlined text-secondary">analytics</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AccuracyBlock label={whiteName} accuracy={whiteAccuracy} summary={summary} side="white" />
          <AccuracyBlock label={blackName} accuracy={blackAccuracy} summary={summary} side="black" />
        </div>
      </div>

      {/* Phase accuracy */}
      {phaseAccuracy && (
        <div className="analysis-section">
          <div className="card-section-header">
            <h3 className="card-title">Accuracy by Phase</h3>
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
        <div className="analysis-section">
          <div className="card-section-header">
            <h3 className="card-title">Tactic Accuracy</h3>
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
        <div className="analysis-section">
          <div className="card-section-header">
            <h3 className="card-title">Evaluation</h3>
            <span className="material-symbols-outlined text-secondary">show_chart</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartColors.primary} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="name" tick={false} />
              <YAxis domain={[-10, 10]} tick={{ fill: chartColors.axis, opacity: 0.8, fontSize: 11 }} />
              <ReferenceLine y={0} stroke={chartColors.secondary} strokeDasharray="4 2" />
              <Tooltip
                contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '2px', fontSize: '0.85rem' }}
                formatter={val => [`${val > 0 ? '+' : ''}${val.toFixed(2)}`, 'Eval']}
              />
              <Area type="monotone" dataKey="eval" stroke={chartColors.primary} fill="url(#evalGrad)" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="eval-legend">
            Positive = White advantage · Negative = Black advantage
          </p>
        </div>
      )}

      {/* Move list */}
      <div className="analysis-section">
        <div className="card-section-header">
          <h3 className="card-title">Move Analysis</h3>
          <span className="material-symbols-outlined text-secondary">table_rows</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10">
                {['#', 'White', 'Eval', 'CPL', '', 'Black', 'Eval', 'CPL', ''].map((h, i) => (
                  <th key={i} className="move-table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairMoves(moves).map(pair => {
                const whiteIdx = (pair.moveNumber - 1) * 2;
                const blackIdx = whiteIdx + 1;
                return (
                  <tr key={pair.moveNumber} className="border-b border-primary/5">
                    <td className="px-2 py-2 font-label text-xs text-primary/40">{pair.moveNumber}.</td>
                    <MoveCell
                      move={pair.white}
                      moveIndex={whiteIdx}
                      selectedIndex={selectedMoveIndex}
                      onSelect={setSelectedMoveIndex}
                    />
                    <MoveCell
                      move={pair.black}
                      moveIndex={blackIdx}
                      selectedIndex={selectedMoveIndex}
                      onSelect={setSelectedMoveIndex}
                    />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getAccuracyClass(accuracy) {
  if (accuracy === null) return 'acc-muted';
  if (accuracy >= 90)    return 'acc-good';
  if (accuracy >= 70)    return 'acc-warn';
  return 'acc-bad';
}

function AccuracyBlock({ label, accuracy, summary, side }) {
  return (
    <div className="inner-card">
      <div className="font-label text-xs uppercase tracking-widest text-primary/50 mb-1">{label}</div>
      <div className={`font-headline text-3xl font-bold mb-4 ${getAccuracyClass(accuracy)}`}>
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
    <div className="inner-card">
      <div className="font-label text-xs uppercase tracking-widest text-primary/50 mb-4">{label}</div>
      <div className="space-y-2">
        {Object.entries(PHASE_LABELS).map(([key, display]) => {
          const val = phaseData?.[key];
          return (
            <div key={key} className="flex justify-between items-center">
              <span className="font-body text-sm text-primary/70">{display}</span>
              <span className={`font-headline text-base ${getAccuracyClass(val)}`}>
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
  check:     '+ Check',
  fork:      '⑂ Fork',
  sacrifice: '✕ Sacrifice',
  capture:   '× Capture',
  promotion: '♛ Promotion',
};

function TacticAccuracyBlock({ label, tacticData }) {
  const total    = (tacticData?.found ?? 0) + (tacticData?.missed ?? 0);
  const foundPct = total > 0 ? Math.round((tacticData.found / total) * 100) : null;
  const byType   = tacticData?.byType ?? {};
  const types    = Object.keys(byType).sort();

  return (
    <div className="inner-card">
      <div className="font-label text-xs uppercase tracking-widest text-primary/50 mb-3">{label}</div>
      <div className="flex items-center gap-4 mb-4">
        <span className="font-body text-sm text-chess-success">✔ {tacticData?.found ?? 0} found</span>
        <span className="font-body text-sm text-chess-danger">✘ {tacticData?.missed ?? 0} missed</span>
        {foundPct !== null && (
          <span className={`font-headline text-lg ${getAccuracyClass(foundPct)}`}>{foundPct}%</span>
        )}
      </div>
      {types.length > 0 ? (
        <div className="space-y-1.5">
          {types.map(type => {
            const { found, missed } = byType[type];
            const t   = found + missed;
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

function MoveCell({ move, moveIndex, selectedIndex, onSelect }) {
  if (!move) return <><td /><td /><td /><td /></>;
  const evalStr = move.evalAfter !== null
    ? (move.evalAfter > 0 ? '+' : '') + (move.evalAfter / 100).toFixed(2)
    : '—';

  const cls = {
    blunder:    'move-blunder',
    mistake:    'move-mistake',
    inaccuracy: 'move-inaccuracy',
    good:       'move-good',
    book:       'move-book',
  }[move.classification] ?? 'move-good';

  const isSelected = moveIndex === selectedIndex;
  const tdCls = [
    'px-2 py-2 font-body cursor-pointer hover:bg-surface-container-high transition-colors',
    cls,
    isSelected ? 'move-selected' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <td
        className={tdCls}
        onClick={() => onSelect(moveIndex)}
        title={`Go to move ${move.moveNumber}${move.color === 'white' ? '.' : '…'}${move.san}${move.bestMove ? ` | Best move: ${move.bestMove}` : ''}`}
      >
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
          <span className={cls}>
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

