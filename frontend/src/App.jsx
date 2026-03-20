import { useState } from 'react';
import FileUpload from './components/FileUpload';
import GameList from './components/GameList';
import GameStats from './components/GameStats';
import StockfishAnalysis from './components/StockfishAnalysis';
import ExportButton from './components/ExportButton';
import './App.css';

export default function App() {
  const [games, setGames] = useState([]);
  const [username, setUsername] = useState('');
  const [activeTab, setActiveTab] = useState('stats');
  const [selectedGame, setSelectedGame] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  function handleUpload(uploadedGames) {
    setGames(uploadedGames);
    setActiveTab('stats');
    setSelectedGame(null);
    setAnalysisResult(null);
  }

  async function handleAnalyze(gameIndex, depth) {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameIndex, depth }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Analysis failed');
      }
      const data = await res.json();
      setAnalysisResult(data);
      setActiveTab('analysis');
    } catch (err) {
      alert('Analysis error: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const tabs = [
    { id: 'stats', label: '📊 Stats' },
    { id: 'games', label: '♟ Games' },
    { id: 'analysis', label: '🔍 Analysis' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="logo">♟ Lichess Analyzer</h1>
          <p className="subtitle">Parse your PGN files, get stats & Stockfish analysis</p>
        </div>
      </header>

      <main className="app-main">
        <div className="upload-section">
          <FileUpload onUpload={handleUpload} />
          {games.length > 0 && (
            <div className="username-row">
              <label htmlFor="username">Your username (for personalized stats):</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Magnus"
                className="username-input"
              />
              <ExportButton username={username} disabled={games.length === 0} />
            </div>
          )}
        </div>

        {games.length > 0 && (
          <>
            <nav className="tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="tab-content">
              {activeTab === 'stats' && (
                <GameStats username={username} gameCount={games.length} />
              )}
              {activeTab === 'games' && (
                <GameList
                  games={games}
                  selectedGame={selectedGame}
                  onSelectGame={idx => {
                    setSelectedGame(idx);
                  }}
                  onAnalyze={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                />
              )}
              {activeTab === 'analysis' && (
                <StockfishAnalysis
                  result={analysisResult}
                  game={selectedGame !== null ? games[selectedGame] : null}
                  isAnalyzing={isAnalyzing}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
