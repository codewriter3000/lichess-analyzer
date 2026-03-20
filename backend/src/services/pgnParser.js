const { Chess } = require('chess.js');

/**
 * Parse a PGN string containing one or more games.
 * Returns an array of game objects with parsed headers and moves.
 */
function parsePgn(pgnText) {
  const games = [];
  // Split multiple games by looking for game boundaries
  // A new game starts with a '[' after a result line
  const gameStrings = splitGames(pgnText);

  for (const gameStr of gameStrings) {
    if (!gameStr.trim()) continue;
    try {
      const chess = new Chess();
      chess.loadPgn(gameStr, { strict: false });
      const headers = chess.header();
      const moves = chess.history({ verbose: true });
      const result = headers.Result || '*';

      games.push({
        headers,
        moves,
        pgn: gameStr.trim(),
        white: headers.White || 'Unknown',
        black: headers.Black || 'Unknown',
        whiteElo: parseElo(headers.WhiteElo),
        blackElo: parseElo(headers.BlackElo),
        result,
        date: parseDate(headers.UTCDate || headers.Date),
        opening: headers.Opening || headers.ECO || null,
        eco: headers.ECO || null,
        timeControl: headers.TimeControl || null,
        termination: headers.Termination || null,
        plyCount: moves.length,
      });
    } catch (err) {
      // Skip unparseable games
    }
  }

  return games;
}

/**
 * Split a multi-game PGN string into individual game strings.
 */
function splitGames(pgnText) {
  const lines = pgnText.replace(/\r\n/g, '\n').split('\n');
  const games = [];
  let current = [];
  let hasResult = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // New game starts when we encounter a tag after having a result
    if (hasResult && trimmed.startsWith('[')) {
      games.push(current.join('\n'));
      current = [];
      hasResult = false;
    }

    current.push(line);

    // Check if this line contains a result token
    if (!trimmed.startsWith('[') && /\b(1-0|0-1|1\/2-1\/2|\*)\s*$/.test(trimmed)) {
      hasResult = true;
    }
  }

  if (current.some(l => l.trim())) {
    games.push(current.join('\n'));
  }

  return games;
}

function parseElo(eloStr) {
  if (!eloStr) return null;
  const n = parseInt(eloStr, 10);
  return isNaN(n) ? null : n;
}

function parseDate(dateStr) {
  if (!dateStr || dateStr === '????.??.??') return null;
  // Format: YYYY.MM.DD
  const match = dateStr.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return dateStr;
}

module.exports = { parsePgn };
