import { useEffect, useState } from 'react';
import FileUpload from './components/FileUpload';
import GameList from './components/GameList';
import GameStats from './components/GameStats';
import StockfishAnalysis from './components/StockfishAnalysis';
import ExportButton from './components/ExportButton';
import './App.css';

export default function App() {
  const [games, setGames] = useState([]);
  const [username, setUsername] = useState('');
  const [activeTab, setActiveTab] = useState('library');
  const [selectedGame, setSelectedGame] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  function handleUpload(uploadedGames, inferredUsername = '') {
    setGames(uploadedGames);
    setUsername(inferredUsername);
    setActiveTab('library');
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

  const navItems = [
    { id: 'library',     icon: 'library_books', label: 'Library'     },
    { id: 'analysis',    icon: 'query_stats',   label: 'Analysis'    },
    { id: 'statistics',  icon: 'auto_graph',    label: 'Statistics'  },
    { id: 'manuscripts', icon: 'history_edu',   label: 'Manuscripts' },
  ];

  const PAGE_LABELS = {
    library:     { section: 'Game Collection',   title: 'Library'     },
    analysis:    { section: 'Stockfish Engine',   title: 'Analysis'    },
    statistics:  { section: 'Performance Record', title: 'Statistics'  },
    manuscripts: { section: 'Upload Archive',     title: 'Manuscripts' },
  };

  return (
    <div className="app-root">
      {/* TopAppBar */}
      <header id="app-topbar">
        <div className="flex items-center gap-4">
          <span className="font-headline text-2xl italic text-primary">The Scholar's Ledger</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <button className="topnav-btn" onClick={() => setActiveTab('library')}>Library</button>
          <button className="topnav-btn" onClick={() => setActiveTab('analysis')}>Analysis</button>
          <button className="topnav-btn" onClick={() => setActiveTab('statistics')}>Statistics</button>
        </nav>
        <div className="flex items-center gap-6">
          <span className="material-symbols-outlined topbar-icon-btn">menu_book</span>
          <button
            type="button"
            className="topbar-icon-btn inline-flex items-center"
            onClick={() => setIsDarkMode(prev => !prev)}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="material-symbols-outlined">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <span className="material-symbols-outlined topbar-icon-btn">settings</span>
          <div id="topbar-avatar">
            <span className="material-symbols-outlined text-on-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
          </div>
        </div>
      </header>

      {/* SideNavBar */}
      <aside id="app-sidebar">
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-4">
            <div id="sidebar-icon-box">
              <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            </div>
            <div>
              <h3 className="font-headline text-primary text-lg leading-tight">Master's Study</h3>
              {username && <p className="sidebar-field-label">{username}</p>}
            </div>
          </div>
          <label htmlFor="pgn-upload-sidebar" id="new-analysis-btn">New Analysis</label>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`sidenav-btn${activeTab === item.id ? ' active' : ''}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-primary/5">
          {games.length > 0 && (
            <div className="mb-3 px-4">
              <label className="sidebar-field-label">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Magnus"
                className="sidebar-username-input"
              />
            </div>
          )}
          {games.length > 0 && (
            <div className="px-4 mb-2">
              <ExportButton username={username} disabled={games.length === 0} />
            </div>
          )}
          <button id="engine-settings-btn">
            <span className="material-symbols-outlined">memory</span>
            <span className="font-label text-sm uppercase tracking-wide">Engine Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main id="app-main">
        <div className="parchment-overlay"></div>
        <div className="relative z-10 max-w-7xl mx-auto">

          {/* Page header */}
          <div id="page-header-row">
            <div>
              <span className="page-section-label">{PAGE_LABELS[activeTab]?.section}</span>
              <h1 className="font-headline text-4xl font-bold text-primary tracking-tight">
                {PAGE_LABELS[activeTab]?.title}
              </h1>
              {username && (
                <p className="font-headline italic text-lg text-primary/60 mt-1">{username}</p>
              )}
            </div>
            {games.length > 0 && (
              <div className="flex gap-4">
                <div id="total-games-card">
                  <span className="total-games-label">Total Games</span>
                  <span className="font-headline text-3xl font-bold text-primary">{games.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Content area */}
          {(activeTab === 'manuscripts' || games.length === 0) && (
            <div id="upload-section-card">
              <h2 className="font-headline text-xl text-primary mb-6">Upload PGN Archive</h2>
              <FileUpload onUpload={handleUpload} uploadId="pgn-upload-sidebar" />
            </div>
          )}

          {games.length > 0 && activeTab === 'library' && (
            <GameList
              games={games}
              selectedGame={selectedGame}
              onSelectGame={idx => setSelectedGame(idx)}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
            />
          )}

          {games.length > 0 && activeTab === 'statistics' && (
            <GameStats username={username} gameCount={games.length} />
          )}

          {activeTab === 'analysis' && (
            <StockfishAnalysis
              result={analysisResult}
              game={selectedGame !== null ? games[selectedGame] : null}
              isAnalyzing={isAnalyzing}
            />
          )}
        </div>
      </main>

      {/* FAB */}
      <label htmlFor="pgn-upload-fab" id="app-fab" title="Upload PGN">
        <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </label>
      <input
        id="pgn-upload-fab"
        type="file"
        accept=".pgn"
        className="hidden"
        onChange={e => {
          if (e.target.files?.[0]) {
            const event = new CustomEvent('pgn-file-selected', { detail: e.target.files[0] });
            window.dispatchEvent(event);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}
