/**
 * Build a CSV string from an array of games.
 * Columns: Date, White, WhiteElo, Black, BlackElo, Result, Winner
 */
function buildCsv(games, username) {
  const header = ['Date', 'White', 'WhiteRating', 'Black', 'BlackRating', 'Result', 'Winner'];
  const rows = [header.join(',')];

  for (const game of games) {
    const winner = getWinner(game.result, game.white, game.black);
    const row = [
      csvEscape(game.date || ''),
      csvEscape(game.white),
      game.whiteElo !== null ? game.whiteElo : '',
      csvEscape(game.black),
      game.blackElo !== null ? game.blackElo : '',
      csvEscape(game.result),
      csvEscape(winner),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

function getWinner(result, white, black) {
  if (result === '1-0') return white;
  if (result === '0-1') return black;
  if (result === '1/2-1/2') return 'Draw';
  return 'Unknown';
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export { buildCsv };
