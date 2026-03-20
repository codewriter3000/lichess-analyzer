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
  const [activeTab, setActiveTab] = useState('library');
  const [selectedGame, setSelectedGame] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
    { id: 'library', icon: 'library_books', label: 'Library' },
    { id: 'analysis', icon: 'query_stats', label: 'Analysis' },
    { id: 'statistics', icon: 'auto_graph', label: 'Statistics' },
    { id: 'manuscripts', icon: 'history_edu', label: 'Manuscripts' },
  ];

  const displayName = username || 'Scholar';

  return (
    <div className="min-h-screen bg-background font-body text-on-background">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-gradient-to-b from-surface-container to-background border-b border-primary/10 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-headline italic text-primary">The Scholar's Ledger</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <button className="text-primary/70 font-medium hover:text-secondary transition-colors duration-300 cursor-pointer font-label text-sm uppercase tracking-wide bg-transparent border-none" onClick={() => setActiveTab('library')}>Library</button>
          <button className="text-primary/70 font-medium hover:text-secondary transition-colors duration-300 cursor-pointer font-label text-sm uppercase tracking-wide bg-transparent border-none" onClick={() => setActiveTab('analysis')}>Analysis</button>
          <button className="text-primary/70 font-medium hover:text-secondary transition-colors duration-300 cursor-pointer font-label text-sm uppercase tracking-wide bg-transparent border-none" onClick={() => setActiveTab('statistics')}>Statistics</button>
        </nav>
        <div className="flex items-center gap-6">
          <span className="material-symbols-outlined text-primary hover:text-secondary transition-colors cursor-pointer">menu_book</span>
          <span className="material-symbols-outlined text-primary hover:text-secondary transition-colors cursor-pointer">settings</span>
          <div className="h-10 w-10 rounded-full border border-primary/20 bg-primary flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-on-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
          </div>
        </div>
      </header>

      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full pt-20 flex flex-col z-40 bg-surface-container border-r border-primary/10 w-72 shadow-[4px_0_24px_rgba(29,28,22,0.04)]">
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-sm">
              <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            </div>
            <div>
              <h3 className="font-headline text-primary text-lg leading-tight">Master's Study</h3>
              {username && (
                <p className="font-label text-xs uppercase tracking-widest text-primary/60">{username}</p>
              )}
            </div>
          </div>
          <label
            htmlFor="pgn-upload-sidebar"
            className="w-full bg-primary text-on-primary py-3 px-4 rounded-sm font-label text-sm uppercase tracking-widest hover:opacity-90 transition-opacity mb-6 text-center cursor-pointer block"
          >
            New Analysis
          </label>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 font-label text-sm uppercase tracking-wide text-left ${
                activeTab === item.id
                  ? 'bg-surface-container-highest text-primary font-bold border-r-4 border-secondary'
                  : 'text-primary/60 hover:bg-surface-container-highest/50 hover:pl-6'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-primary/5">
          {games.length > 0 && (
            <div className="mb-3 px-4">
              <label className="font-label text-xs uppercase tracking-widest text-primary/50 block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Magnus"
                className="w-full bg-background border border-primary/20 rounded-sm text-on-background px-3 py-2 text-sm font-body focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          )}
          {games.length > 0 && (
            <div className="px-4 mb-2">
              <ExportButton username={username} disabled={games.length === 0} />
            </div>
          )}
          <button className="flex items-center gap-3 px-4 py-3 text-primary/60 hover:bg-surface-container-highest/50 transition-all duration-200 w-full">
            <span className="material-symbols-outlined">memory</span>
            <span className="font-label text-sm uppercase tracking-wide">Engine Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="ml-72 pt-24 px-8 pb-12 min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-parchment-texture pointer-events-none"></div>
        <div className="relative z-10 max-w-7xl mx-auto">

          {/* Page header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <span className="font-label text-sm uppercase tracking-[0.2em] text-secondary mb-2 block">
                {activeTab === 'library' && 'Game Collection'}
                {activeTab === 'analysis' && 'Stockfish Engine'}
                {activeTab === 'statistics' && 'Performance Record'}
                {activeTab === 'manuscripts' && 'Upload Archive'}
              </span>
              <h1 className="font-headline text-4xl font-bold text-primary tracking-tight">
                {activeTab === 'library' && 'Library'}
                {activeTab === 'analysis' && 'Analysis'}
                {activeTab === 'statistics' && 'Statistics'}
                {activeTab === 'manuscripts' && 'Manuscripts'}
              </h1>
              {username && (
                <p className="font-headline italic text-lg text-primary/60 mt-1">{username}</p>
              )}
            </div>
            {games.length > 0 && (
              <div className="flex gap-4">
                <div className="bg-surface-container p-4 px-8 rounded-sm text-center border-b-2 border-primary/10">
                  <span className="font-label text-xs uppercase text-primary/50 tracking-widest block mb-1">Total Games</span>
                  <span className="font-headline text-3xl font-bold text-primary">{games.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Content area */}
          {(activeTab === 'manuscripts' || games.length === 0) && (
            <div className="bg-surface-container rounded-sm p-8 shadow-sm">
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
      <label
        htmlFor="pgn-upload-fab"
        className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-on-primary shadow-xl flex items-center justify-center rounded-full hover:scale-105 transition-transform z-50 cursor-pointer"
        title="Upload PGN"
      >
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
