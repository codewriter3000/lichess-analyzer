import { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import './GameStats.css';

function readRgbVar(varName, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value ? `rgb(${value})` : fallback;
}

export default function GameStats({ username, gameCount, onOpenTacticsDetails }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isAnalyzingLast30, setIsAnalyzingLast30] = useState(false);
  const [analyzeLast30Message, setAnalyzeLast30Message] = useState('');
  const [analyzeLast30Progress, setAnalyzeLast30Progress] = useState(null);
  const pollTimerRef = useRef(null);
  const pollErrorCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError('');
      try {
        const url = username ? `/api/stats?username=${encodeURIComponent(username)}` : '/api/stats';
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load stats');
        setStats(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    if (gameCount > 0) fetchStats();
  }, [username, gameCount, reloadKey]);

  async function pollBatchJob(jobId) {
    const res = await fetch(`/api/analyze/batch-last30/${jobId}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to read analysis progress');
    }

    setAnalyzeLast30Progress(data);

    if (data.status === 'completed' || data.status === 'failed') {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      setIsAnalyzingLast30(false);
      if (data.status === 'completed') {
        setAnalyzeLast30Message(
          `Analyzed ${data.analyzed}, skipped ${data.skipped}, failed ${data.failed} (window: ${data.considered}).`
        );
        setReloadKey(prev => prev + 1);
      } else {
        setAnalyzeLast30Message(`Analysis failed: ${data.error || 'Unexpected error'}`);
      }
    }
  }

  async function handleAnalyzeLast30() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    pollErrorCountRef.current = 0;
    setIsAnalyzingLast30(true);
    setAnalyzeLast30Message('');
    setAnalyzeLast30Progress(null);

    try {
      const res = await fetch('/api/analyze/batch-last30', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, depth: 15 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze last 30 games');
      }

      setAnalyzeLast30Progress(data);

      if (data.status === 'completed' || data.status === 'failed') {
        setIsAnalyzingLast30(false);
        if (data.status === 'completed') {
          setAnalyzeLast30Message(
            `Analyzed ${data.analyzed}, skipped ${data.skipped}, failed ${data.failed} (window: ${data.considered}).`
          );
          setReloadKey(prev => prev + 1);
        } else {
          setAnalyzeLast30Message(`Analysis failed: ${data.error || 'Unexpected error'}`);
        }
        return;
      }

      pollTimerRef.current = setInterval(async () => {
        try {
          await pollBatchJob(data.jobId);
          pollErrorCountRef.current = 0;
        } catch (pollErr) {
          pollErrorCountRef.current += 1;
          if (pollErrorCountRef.current >= 2) {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            setIsAnalyzingLast30(false);
            setAnalyzeLast30Message(
              `Lost connection to backend while tracking progress: ${pollErr.message}. Restart backend and run Analyze Last 30 again.`
            );
          }
        }
      }, 1000);
    } catch (e) {
      setAnalyzeLast30Message(`Analysis failed: ${e.message}`);
      setIsAnalyzingLast30(false);
    }
  }

  if (loading) return (
    <div className="stats-loading">
      <span className="spinner" /> Loading stats…
    </div>
  );
  if (error) return (
    <div className="stats-error">⚠ {error}</div>
  );
  if (!stats) return null;

  const chartColors = {
    wins: readRgbVar('--color-primary', '#163428'),
    losses: readRgbVar('--chess-danger', '#e74c3c'),
    draws: readRgbVar('--color-tertiary', '#1e323c'),
    grid: readRgbVar('--chart-grid', 'rgba(22,52,40,0.08)'),
    axis: readRgbVar('--chart-axis', '#163428'),
    tooltipBg: readRgbVar('--tooltip-bg', '#f2ede4'),
    tooltipBorder: readRgbVar('--tooltip-border', 'rgba(22,52,40,0.1)'),
    secondary: readRgbVar('--color-secondary', '#77574d'),
  };

  const RESULT_COLORS = {
    Wins: chartColors.wins,
    Losses: chartColors.losses,
    Draws: chartColors.draws,
  };

  const pieData = [
    { name: 'Wins',   value: stats.wins   },
    { name: 'Losses', value: stats.losses },
    { name: 'Draws',  value: stats.draws  },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Overview grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Summary stats */}
        <div id="stats-overview">
          <div className="card-section-header">
            <h3 className="card-title">Overview {username && `— ${username}`}</h3>
            <span className="material-symbols-outlined text-secondary">query_stats</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Games"                value={stats.total}         />
            <StatCard label={`Wins (${stats.winRate}%)`}   value={stats.wins}          colorClass="stat-value-win"  />
            <StatCard label={`Losses (${stats.lossRate}%)`} value={stats.losses}       colorClass="stat-value-loss" />
            <StatCard label={`Draws (${stats.drawRate}%)`}  value={stats.draws}        colorClass="stat-value-draw" />
            <StatCard label="Avg. Plies"                value={stats.avgGameLength} />
            {stats.currentStreak > 0 && (
              <StatCard
                label={`Current ${stats.currentStreakType} streak`}
                value={stats.currentStreak}
                colorClass={stats.currentStreakType === 'win' ? 'stat-value-win' : 'stat-value-loss'}
              />
            )}
            {stats.bestWinStreak > 0 && (
              <StatCard label="Best Win Streak" value={stats.bestWinStreak} colorClass="stat-value-win" />
            )}
          </div>
        </div>

        {/* Performance pie chart */}
        {pieData.length > 0 && (
          <div id="stats-perf-matrix">
            <h3 className="card-title mb-6 self-start">Performance Matrix</h3>
            <div className="w-full">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={false}>
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={RESULT_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value) => (
                      <span className="font-label text-xs uppercase tracking-wide text-primary/70">{value}</span>
                    )}
                  />
                  <Tooltip
                    contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '2px', fontFamily: 'Inter' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Color performance */}
      {(stats.whiteGames > 0 || stats.blackGames > 0) && (
        <div className="stats-section">
          <div className="card-section-header">
            <h3 className="card-title">Performance by Color</h3>
            <span className="material-symbols-outlined text-secondary">contrast</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <ColorPerfCard color="White" games={stats.whiteGames} winRate={stats.whiteWinRate} />
            <ColorPerfCard color="Black" games={stats.blackGames} winRate={stats.blackWinRate} />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { color: 'White', 'Win %': parseFloat(stats.whiteWinRate) },
              { color: 'Black', 'Win %': parseFloat(stats.blackWinRate) },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="color" tick={{ fill: chartColors.axis, opacity: 0.7, fontSize: 11, fontFamily: 'Work Sans' }} />
              <YAxis domain={[0, 100]} tick={{ fill: chartColors.axis, opacity: 0.7, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '2px' }} />
              <Bar dataKey="Win %" fill={chartColors.wins} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rating history */}
      {stats.ratingHistory && stats.ratingHistory.length > 1 && (
        <div className="stats-section">
          <div className="card-section-header">
            <h3 className="card-title">Rating History</h3>
            <span className="material-symbols-outlined text-secondary">trending_up</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.ratingHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="date" tick={{ fill: chartColors.axis, opacity: 0.7, fontSize: 11 }} />
              <YAxis tick={{ fill: chartColors.axis, opacity: 0.7 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '2px' }}
                formatter={(val, name) => [val, name === 'rating' ? 'Your rating' : 'Opp. rating']}
              />
              <Line type="monotone" dataKey="rating"         stroke={chartColors.wins} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="opponentRating" stroke={chartColors.secondary} dot={false} strokeWidth={1} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top openings — Repertoire Usage */}
      {stats.topOpenings && stats.topOpenings.length > 0 && (
        <div className="stats-section">
          <div className="card-section-header">
            <h3 className="card-title">Repertoire Usage</h3>
            <span className="material-symbols-outlined text-secondary">menu_book</span>
          </div>
          <div className="space-y-5">
            {stats.topOpenings.map(op => {
              const maxGames = stats.topOpenings[0]?.total ?? 1;
              const pct = Math.round((op.total / maxGames) * 100);
              const winPct = op.total > 0 ? ((op.wins / op.total) * 100).toFixed(0) : 0;
              return (
                <div key={`${op.eco || 'no-eco'}-${op.openingName || op.name}`} className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="font-body font-medium text-primary text-sm">
                      {op.openingName || op.name}
                      {op.eco && <span className="font-label text-xs text-primary/40 ml-2">{op.eco}</span>}
                    </span>
                    <span className="font-label text-xs text-primary/60">{op.total} Games · {winPct}% wins</span>
                  </div>
                  <div className="opening-bar-track">
                    <div className="opening-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Last 30 games tactic summary */}
      {stats.tacticsLast30 && (
        <div className="stats-section">
          <div className="card-section-header">
            <h3 className="card-title">Tactics in Last 30 Games</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="stats-action-btn"
                onClick={() => onOpenTacticsDetails?.()}
                disabled={!onOpenTacticsDetails}
              >
                Open Detail Page
              </button>
              <button
                type="button"
                className="stats-action-btn"
                onClick={handleAnalyzeLast30}
                disabled={isAnalyzingLast30}
              >
                {isAnalyzingLast30 ? 'Analyzing…' : 'Analyze Last 30'}
              </button>
              <span className="material-symbols-outlined text-secondary">bolt</span>
            </div>
          </div>
          <p className="stats-subtext">
            Based on analyzed games: {stats.tacticsLast30.gamesWithAnalysis}/{stats.tacticsLast30.gamesConsidered}
            {stats.tacticsLast30.gamesWithoutAnalysis > 0
              ? ` (${stats.tacticsLast30.gamesWithoutAnalysis} game${stats.tacticsLast30.gamesWithoutAnalysis === 1 ? '' : 's'} without analysis)`
              : ''}
          </p>
          {analyzeLast30Message && (
            <p className="stats-subtext mt-2">{analyzeLast30Message}</p>
          )}
          {analyzeLast30Progress && (
            <div className="stats-progress-wrap mt-3">
              <div className="stats-progress-head">
                <span>
                  {analyzeLast30Progress.done}/{analyzeLast30Progress.considered} games
                </span>
                <span>{analyzeLast30Progress.percent}%</span>
              </div>
              <div className="stats-progress-track">
                <div
                  className="stats-progress-fill"
                  style={{ width: `${analyzeLast30Progress.percent}%` }}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <TacticSummaryCard
              label={username || 'You'}
              tacticData={stats.tacticsLast30.player}
              emptyMessage="Analyze more games to see your tactic profile."
            />
            <TacticSummaryCard
              label="Opponents"
              tacticData={stats.tacticsLast30.opponents}
              emptyMessage="Analyze more games to see opponents' tactic profile."
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, colorClass = 'stat-value-default' }) {
  return (
    <div className="stat-card">
      <div className={`stat-value ${colorClass}`}>{value}</div>
      <div className="stat-inner-label">{label}</div>
    </div>
  );
}

function ColorPerfCard({ color, games, winRate }) {
  return (
    <div className="color-perf-item">
      <div className={`color-icon-box color-icon-box--${color.toLowerCase()}`}>
        <span
          className={`material-symbols-outlined text-sm ${color === 'White' ? 'text-primary' : 'text-on-primary'}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          radio_button_checked
        </span>
      </div>
      <div>
        <p className="font-label text-xs uppercase tracking-widest text-primary/50">{color}</p>
        <p className="font-headline text-base text-primary">{games} games · {winRate}% win rate</p>
      </div>
    </div>
  );
}

const TACTIC_LABELS = {
  checkmate: 'Checkmate',
  check: 'Check',
  fork: 'Fork',
  sacrifice: 'Sacrifice',
  capture: 'Capture',
  promotion: 'Promotion',
};

function TacticSummaryCard({ label, tacticData, emptyMessage }) {
  const hasData = tacticData && tacticData.total > 0;

  return (
    <div className="inner-card">
      <div className="font-label text-xs uppercase tracking-widest text-primary/50 mb-3">{label}</div>
      {hasData ? (
        <>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <span className="font-body text-sm text-chess-success">✔ {tacticData.found} found</span>
            <span className="font-body text-sm text-chess-danger">✘ {tacticData.missed} missed</span>
            <span className="font-headline text-xl text-primary">{tacticData.foundRate}%</span>
          </div>
          <div className="space-y-1.5">
            {tacticData.byType.map(item => (
              <div key={item.type} className="flex items-center justify-between text-xs font-body">
                <span className="text-primary/70">{TACTIC_LABELS[item.type] || item.type}</span>
                <span className="flex gap-3 text-primary/50">
                  <span className="text-chess-success">✔{item.found}</span>
                  <span className="text-chess-danger">✘{item.missed}</span>
                  <span className="font-label">{item.foundRate}%</span>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="font-label text-xs uppercase tracking-widest text-primary/30">{emptyMessage}</p>
      )}
    </div>
  );
}

