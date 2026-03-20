/**
 * Compute statistics from an array of parsed games.
 * @param {Array} games - Array of parsed game objects
 * @param {string} username - The player's username to compute stats for
 */
function computeStats(games, username) {
  if (!games || games.length === 0) {
    return { total: 0 };
  }

  const playerGames = username
    ? games.filter(
        g =>
          g.white.toLowerCase() === username.toLowerCase() ||
          g.black.toLowerCase() === username.toLowerCase()
      )
    : games;

  const total = playerGames.length;

  // Win/Loss/Draw counting
  let wins = 0;
  let losses = 0;
  let draws = 0;

  // Color breakdown
  let whiteGames = 0;
  let whiteWins = 0;
  let blackGames = 0;
  let blackWins = 0;

  // Rating over time
  const ratingHistory = [];

  // Opening stats
  const openingCounts = {};

  // Game length distribution
  const gameLengths = [];

  for (const game of playerGames) {
    const isWhite = username
      ? game.white.toLowerCase() === username.toLowerCase()
      : true;
    const result = game.result;

    // Determine outcome
    let outcome;
    if (result === '1-0') {
      outcome = isWhite ? 'win' : 'loss';
    } else if (result === '0-1') {
      outcome = isWhite ? 'loss' : 'win';
    } else if (result === '1/2-1/2') {
      outcome = 'draw';
    } else {
      outcome = 'unknown';
    }

    if (outcome === 'win') wins++;
    else if (outcome === 'loss') losses++;
    else if (outcome === 'draw') draws++;

    // Color stats
    if (isWhite) {
      whiteGames++;
      if (outcome === 'win') whiteWins++;
    } else {
      blackGames++;
      if (outcome === 'win') blackWins++;
    }

    // Rating history
    const myElo = isWhite ? game.whiteElo : game.blackElo;
    const oppElo = isWhite ? game.blackElo : game.whiteElo;
    if (myElo !== null && game.date) {
      ratingHistory.push({
        date: game.date,
        rating: myElo,
        opponentRating: oppElo,
        outcome,
        white: game.white,
        black: game.black,
      });
    }

    // Opening stats
    if (game.opening || game.eco) {
      const key = game.opening || game.eco;
      if (!openingCounts[key]) {
        openingCounts[key] = { name: key, total: 0, wins: 0, losses: 0, draws: 0 };
      }
      openingCounts[key].total++;
      if (outcome === 'win') openingCounts[key].wins++;
      else if (outcome === 'loss') openingCounts[key].losses++;
      else if (outcome === 'draw') openingCounts[key].draws++;
    }

    // Game length
    gameLengths.push(game.plyCount);
  }

  // Sort rating history by date
  ratingHistory.sort((a, b) => a.date.localeCompare(b.date));

  // Top openings
  const topOpenings = Object.values(openingCounts)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Average game length
  const avgGameLength =
    gameLengths.length > 0
      ? Math.round(gameLengths.reduce((a, b) => a + b, 0) / gameLengths.length)
      : 0;

  // Best and worst streaks
  let currentStreak = 0;
  let bestWinStreak = 0;
  let tempStreak = 0;

  for (const game of playerGames) {
    const isWhite = username
      ? game.white.toLowerCase() === username.toLowerCase()
      : true;
    const result = game.result;
    let outcome;
    if (result === '1-0') outcome = isWhite ? 'win' : 'loss';
    else if (result === '0-1') outcome = isWhite ? 'loss' : 'win';
    else outcome = 'other';

    if (outcome === 'win') {
      tempStreak++;
      bestWinStreak = Math.max(bestWinStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // Current streak from most recent games
  const reversedGames = [...playerGames].reverse();
  let streakType = null;
  currentStreak = 0;
  for (const game of reversedGames) {
    const isWhite = username
      ? game.white.toLowerCase() === username.toLowerCase()
      : true;
    const result = game.result;
    let outcome;
    if (result === '1-0') outcome = isWhite ? 'win' : 'loss';
    else if (result === '0-1') outcome = isWhite ? 'loss' : 'win';
    else if (result === '1/2-1/2') outcome = 'draw';
    else break;

    if (streakType === null) streakType = outcome;
    if (outcome === streakType) currentStreak++;
    else break;
  }

  return {
    total,
    wins,
    losses,
    draws,
    winRate: total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0',
    lossRate: total > 0 ? ((losses / total) * 100).toFixed(1) : '0.0',
    drawRate: total > 0 ? ((draws / total) * 100).toFixed(1) : '0.0',
    whiteGames,
    whiteWins,
    whiteWinRate: whiteGames > 0 ? ((whiteWins / whiteGames) * 100).toFixed(1) : '0.0',
    blackGames,
    blackWins,
    blackWinRate: blackGames > 0 ? ((blackWins / blackGames) * 100).toFixed(1) : '0.0',
    ratingHistory,
    topOpenings,
    avgGameLength,
    bestWinStreak,
    currentStreak,
    currentStreakType: streakType,
  };
}

module.exports = { computeStats };
