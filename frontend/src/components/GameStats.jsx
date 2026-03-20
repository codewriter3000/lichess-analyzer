import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';

const RESULT_COLORS = {
  Wins: '#163428',
  Losses: '#77574d',
  Draws: '#1e323c',
};

export default function GameStats({ username, gameCount }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
  }, [username, gameCount]);

  if (loading) return (
    <div className="flex items-center gap-3 py-12 text-primary/60 font-label text-sm uppercase tracking-widest">
      <span className="spinner" /> Loading stats…
    </div>
  );
  if (error) return (
    <div className="bg-error-container text-on-error-container rounded-sm p-4 font-body text-sm">
      ⚠ {error}
    </div>
  );
  if (!stats) return null;

  const pieData = [
    { name: 'Wins', value: stats.wins },
    { name: 'Losses', value: stats.losses },
    { name: 'Draws', value: stats.draws },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Overview grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Summary stats */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container rounded-sm p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline text-lg text-primary">
              Overview {username && `— ${username}`}
            </h3>
            <span className="material-symbols-outlined text-secondary">query_stats</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Games" value={stats.total} />
            <StatCard label={`Wins (${stats.winRate}%)`} value={stats.wins} valueClass="text-chess-success" />
            <StatCard label={`Losses (${stats.lossRate}%)`} value={stats.losses} valueClass="text-chess-danger" />
            <StatCard label={`Draws (${stats.drawRate}%)`} value={stats.draws} valueClass="text-primary/60" />
            <StatCard label="Avg. Plies" value={stats.avgGameLength} />
            {stats.currentStreak > 0 && (
              <StatCard
                label={`Current ${stats.currentStreakType} streak`}
                value={stats.currentStreak}
                valueClass={stats.currentStreakType === 'win' ? 'text-chess-success' : 'text-chess-danger'}
              />
            )}
            {stats.bestWinStreak > 0 && (
              <StatCard label="Best Win Streak" value={stats.bestWinStreak} valueClass="text-chess-success" />
            )}
          </div>
        </div>

        {/* Performance pie chart */}
        {pieData.length > 0 && (
          <div className="col-span-12 lg:col-span-4 bg-surface-container p-8 rounded-sm shadow-sm flex flex-col items-center justify-center">
            <h3 className="font-headline text-lg text-primary mb-6 self-start">Performance Matrix</h3>
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
                    contentStyle={{ background: '#f2ede4', border: '1px solid rgba(22,52,40,0.1)', borderRadius: '2px', fontFamily: 'Inter' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Color performance */}
      {(stats.whiteGames > 0 || stats.blackGames > 0) && (
        <div className="bg-surface-container rounded-sm p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline text-lg text-primary">Performance by Color</h3>
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(22,52,40,0.08)" />
              <XAxis dataKey="color" tick={{ fill: '#163428', opacity: 0.5, fontSize: 11, fontFamily: 'Work Sans' }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#163428', opacity: 0.5, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#f2ede4', border: '1px solid rgba(22,52,40,0.1)', borderRadius: '2px' }} />
              <Bar dataKey="Win %" fill="#163428" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rating history */}
      {stats.ratingHistory && stats.ratingHistory.length > 1 && (
        <div className="bg-surface-container rounded-sm p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline text-lg text-primary">Rating History</h3>
            <span className="material-symbols-outlined text-secondary">trending_up</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.ratingHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(22,52,40,0.08)" />
              <XAxis dataKey="date" tick={{ fill: '#163428', opacity: 0.5, fontSize: 11 }} />
              <YAxis tick={{ fill: '#163428', opacity: 0.5 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#f2ede4', border: '1px solid rgba(22,52,40,0.1)', borderRadius: '2px' }}
                formatter={(val, name) => [val, name === 'rating' ? 'Your rating' : 'Opp. rating']}
              />
              <Line type="monotone" dataKey="rating" stroke="#163428" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="opponentRating" stroke="#77574d" dot={false} strokeWidth={1} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top openings — Repertoire Usage */}
      {stats.topOpenings && stats.topOpenings.length > 0 && (
        <div className="bg-surface-container rounded-sm p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline text-lg text-primary">Repertoire Usage</h3>
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
                  <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, valueClass = 'text-primary' }) {
  return (
    <div className="bg-surface-container-high rounded-sm p-4 text-center">
      <div className={`font-headline text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className="font-label text-[10px] uppercase tracking-widest text-primary/50 mt-1">{label}</div>
    </div>
  );
}

function ColorPerfCard({ color, games, winRate }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-surface-container-high rounded-sm">
      <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${color === 'White' ? 'bg-surface-container-lowest border border-primary/20' : 'bg-primary'}`}>
        <span className={`material-symbols-outlined text-sm ${color === 'White' ? 'text-primary' : 'text-on-primary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
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

