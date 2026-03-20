import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import './GameStats.css';

const RESULT_COLORS = {
  Wins: '#27ae60',
  Losses: '#e74c3c',
  Draws: '#7f8c8d',
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

  if (loading) return <div className="loading-state"><span className="spinner" /> Loading stats…</div>;
  if (error) return <div className="error-state">⚠ {error}</div>;
  if (!stats) return null;

  const pieData = [
    { name: 'Wins', value: stats.wins },
    { name: 'Losses', value: stats.losses },
    { name: 'Draws', value: stats.draws },
  ].filter(d => d.value > 0);

  const colorPieData = [
    { name: 'White wins', value: stats.whiteWins },
    { name: 'Black wins', value: stats.blackWins },
  ].filter(d => d.value > 0);

  return (
    <div className="stats-container">
      {/* Summary row */}
      <div className="card">
        <h2>Overview {username && `— ${username}`}</h2>
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Games</div>
          </div>
          <div className="stat-item">
            <div className="stat-value win">{stats.wins}</div>
            <div className="stat-label">Wins ({stats.winRate}%)</div>
          </div>
          <div className="stat-item">
            <div className="stat-value loss">{stats.losses}</div>
            <div className="stat-label">Losses ({stats.lossRate}%)</div>
          </div>
          <div className="stat-item">
            <div className="stat-value draw">{stats.draws}</div>
            <div className="stat-label">Draws ({stats.drawRate}%)</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.avgGameLength}</div>
            <div className="stat-label">Avg. Plies</div>
          </div>
          {stats.currentStreak > 0 && (
            <div className="stat-item">
              <div className={`stat-value ${stats.currentStreakType}`}>
                {stats.currentStreak}
              </div>
              <div className="stat-label">Current {stats.currentStreakType} streak</div>
            </div>
          )}
          {stats.bestWinStreak > 0 && (
            <div className="stat-item">
              <div className="stat-value win">{stats.bestWinStreak}</div>
              <div className="stat-label">Best Win Streak</div>
            </div>
          )}
        </div>
      </div>

      <div className="charts-row">
        {/* Win/Loss/Draw pie chart */}
        {pieData.length > 0 && (
          <div className="card chart-card">
            <h2>Results</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={RESULT_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Color performance */}
        {(stats.whiteGames > 0 || stats.blackGames > 0) && (
          <div className="card chart-card">
            <h2>Performance by Color</h2>
            <div className="color-perf">
              <div className="color-item">
                <span className="color-dot white-dot" />
                <span>White: {stats.whiteGames} games, {stats.whiteWinRate}% win rate</span>
              </div>
              <div className="color-item">
                <span className="color-dot black-dot" />
                <span>Black: {stats.blackGames} games, {stats.blackWinRate}% win rate</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[
                { color: 'White', 'Win %': parseFloat(stats.whiteWinRate) },
                { color: 'Black', 'Win %': parseFloat(stats.blackWinRate) },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" />
                <XAxis dataKey="color" tick={{ fill: '#8a9bb5' }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#8a9bb5' }} />
                <Tooltip contentStyle={{ background: '#16213e', border: '1px solid #2a3a5c' }} />
                <Bar dataKey="Win %" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Rating history */}
      {stats.ratingHistory && stats.ratingHistory.length > 1 && (
        <div className="card">
          <h2>Rating History</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.ratingHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" />
              <XAxis dataKey="date" tick={{ fill: '#8a9bb5', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8a9bb5' }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#16213e', border: '1px solid #2a3a5c' }}
                formatter={(val, name) => [val, name === 'rating' ? 'Your rating' : 'Opp. rating']}
              />
              <Line type="monotone" dataKey="rating" stroke="var(--primary)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="opponentRating" stroke="var(--secondary)" dot={false} strokeWidth={1} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top openings */}
      {stats.topOpenings && stats.topOpenings.length > 0 && (
        <div className="card">
          <h2>Top Openings</h2>
          <div className="opening-table">
            <table>
              <thead>
                <tr>
                  <th>Opening Name</th>
                  <th>ECO</th>
                  <th>Games</th>
                  <th>Wins</th>
                  <th>Losses</th>
                  <th>Draws</th>
                  <th>Win %</th>
                </tr>
              </thead>
              <tbody>
                {stats.topOpenings.map(op => (
                  <tr key={`${op.eco || 'no-eco'}-${op.openingName || op.name}`}>
                    <td>{op.openingName || op.name}</td>
                    <td>{op.eco || '-'}</td>
                    <td>{op.total}</td>
                    <td className="win">{op.wins}</td>
                    <td className="loss">{op.losses}</td>
                    <td className="draw">{op.draws}</td>
                    <td>{op.total > 0 ? ((op.wins / op.total) * 100).toFixed(0) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
