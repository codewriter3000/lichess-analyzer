import { useEffect, useMemo, useState } from 'react';
import ChessboardViewer from './ChessboardViewer';
import './TacticsDetailPage.css';

const TACTIC_LABELS = {
  checkmate: 'Checkmate',
  check: 'Check',
  fork: 'Fork',
  sacrifice: 'Sacrifice',
  capture: 'Capture',
  promotion: 'Promotion',
};

function bucketEvents(events, found) {
  return events.filter(event => event.found === found);
}

export default function TacticsDetailPage({ username }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedBoardMoveIndex, setSelectedBoardMoveIndex] = useState(-1);

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      setError('');
      setSelectedEvent(null);
      setSelectedBoardMoveIndex(-1);

      try {
        const query = username ? `?username=${encodeURIComponent(username)}` : '';
        const res = await fetch(`/api/stats/tactics-details${query}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load tactic details');
        setDetails(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [username]);

  const selectedGame = useMemo(() => {
    if (!details || !selectedEvent) return null;
    return details.analyzedGames.find(g => g.gameIndex === selectedEvent.gameIndex) || null;
  }, [details, selectedEvent]);

  if (loading) {
    return (
      <div className="tactic-loading-card">
        <span className="spinner" /> Loading tactic details...
      </div>
    );
  }

  if (error) {
    return <div className="tactic-error-card">{error}</div>;
  }

  if (!details) return null;

  const playerFound = bucketEvents(details.playerEvents, true);
  const playerMissed = bucketEvents(details.playerEvents, false);
  const oppFound = bucketEvents(details.opponentEvents, true);
  const oppMissed = bucketEvents(details.opponentEvents, false);

  return (
    <div className="space-y-6">
      <div className="content-card p-6">
        <h3 className="card-title">Detailed Tactic Explorer</h3>
        <p className="font-body text-sm text-primary/60 mt-2">
          Last 30 games: {details.gamesWithAnalysis}/{details.gamesConsidered} analyzed
          {details.gamesWithoutAnalysis > 0 ? ` (${details.gamesWithoutAnalysis} without analysis)` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <TacticBucket
            title={`${username || 'You'} - Found`}
            events={playerFound}
            selectedEvent={selectedEvent}
            onSelectEvent={event => {
              setSelectedEvent(event);
              setSelectedBoardMoveIndex(event.moveIndex);
            }}
          />
          <TacticBucket
            title={`${username || 'You'} - Missed`}
            events={playerMissed}
            selectedEvent={selectedEvent}
            onSelectEvent={event => {
              setSelectedEvent(event);
              setSelectedBoardMoveIndex(event.moveIndex);
            }}
          />
          <TacticBucket
            title="Opponents - Found"
            events={oppFound}
            selectedEvent={selectedEvent}
            onSelectEvent={event => {
              setSelectedEvent(event);
              setSelectedBoardMoveIndex(event.moveIndex);
            }}
          />
          <TacticBucket
            title="Opponents - Missed"
            events={oppMissed}
            selectedEvent={selectedEvent}
            onSelectEvent={event => {
              setSelectedEvent(event);
              setSelectedBoardMoveIndex(event.moveIndex);
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="content-card p-5">
            <h4 className="font-headline text-lg text-primary mb-3">Board Detail</h4>
            {!selectedEvent || !selectedGame ? (
              <p className="font-body text-sm text-primary/60">Select a tactic from the lists to inspect it on the board.</p>
            ) : (
              <>
                <p className="font-body text-sm text-primary/70 mb-1">
                  {selectedGame.white} vs {selectedGame.black}
                </p>
                <p className="font-label text-xs uppercase tracking-widest text-primary/50 mb-3">
                  {selectedGame.date || 'Unknown date'}
                  {selectedGame.opening ? ` • ${selectedGame.opening}` : ''}
                </p>
                <p className="font-body text-sm text-primary mb-3">
                  {selectedEvent.moveNumber}{selectedEvent.color === 'white' ? '.' : '...'} {selectedEvent.san}
                  {' • '}
                  {selectedEvent.found ? 'Found' : 'Missed'} {TACTIC_LABELS[selectedEvent.tacticType] || selectedEvent.tacticType}
                </p>
                <ChessboardViewer
                  moves={selectedGame.moves}
                  selectedIndex={selectedBoardMoveIndex}
                  onSelectIndex={() => {}}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TacticBucket({ title, events, selectedEvent, onSelectEvent }) {
  return (
    <div className="content-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-headline text-lg text-primary">{title}</h4>
        <span className="font-label text-xs uppercase tracking-widest text-primary/50">{events.length}</span>
      </div>

      {events.length === 0 ? (
        <p className="font-label text-xs uppercase tracking-widest text-primary/30">No events available.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-auto pr-1">
          {events.map(event => {
            const isSelected = selectedEvent?.id === event.id;
            return (
              <button
                type="button"
                key={event.id}
                className={`tactic-event-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectEvent(event)}
                title={`Best move: ${event.bestMove || 'N/A'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-body text-sm text-primary">
                    {event.moveNumber}{event.color === 'white' ? '.' : '...'} {event.san}
                  </span>
                  <span className={`font-label text-[10px] uppercase ${event.found ? 'text-chess-success' : 'text-chess-danger'}`}>
                    {event.found ? 'Found' : 'Missed'}
                  </span>
                </div>
                <div className="font-label text-[10px] uppercase tracking-widest text-primary/50 mt-1">
                  {TACTIC_LABELS[event.tacticType] || event.tacticType}
                  {event.bestMove ? ` • best ${event.bestMove}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
