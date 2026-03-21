/**
 * Compute statistics from an array of parsed games.
 * @param {Array} games - Array of parsed game objects
 * @param {string} username - The player's username to compute stats for
 * @param {Object} analysisByGame - Map of gameIndex -> Stockfish analysis result
 */
function computeStats(games, username, analysisByGame = {}) {
  if (!games || games.length === 0) {
    return { total: 0 };
  }

  const gamesWithIndex = games.map((game, index) => ({ game, index }));

  const playerGames = username
    ? gamesWithIndex.filter(
        ({ game }) =>
          game.white.toLowerCase() === username.toLowerCase() ||
          game.black.toLowerCase() === username.toLowerCase()
      )
    : gamesWithIndex;

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

  for (const { game } of playerGames) {
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
      const eco = game.eco || null;
      const openingName =
        game.opening && game.opening !== game.eco
          ? game.opening
          : null;
      const aggregateKey = `${eco || ''}|${openingName || ''}`;

      if (!openingCounts[aggregateKey]) {
        openingCounts[aggregateKey] = {
          name: openingName || (eco ? `ECO ${eco}` : 'Unknown Opening'),
          openingName,
          eco,
          total: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        };
      }
      openingCounts[aggregateKey].total++;
      if (outcome === 'win') openingCounts[aggregateKey].wins++;
      else if (outcome === 'loss') openingCounts[aggregateKey].losses++;
      else if (outcome === 'draw') openingCounts[aggregateKey].draws++;
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

  for (const { game } of playerGames) {
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
  for (const { game } of reversedGames) {
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

  const tacticsLast30 = aggregateTacticsLast30(games, playerGames, username, analysisByGame);

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
    tacticsLast30,
  };
}

function emptyTacticBucket() {
  return { found: 0, missed: 0, byType: {} };
}

function addTacticBucket(target, source) {
  if (!source) return;
  target.found += source.found || 0;
  target.missed += source.missed || 0;

  const byType = source.byType || {};
  for (const [type, stats] of Object.entries(byType)) {
    if (!target.byType[type]) {
      target.byType[type] = { found: 0, missed: 0 };
    }
    target.byType[type].found += stats.found || 0;
    target.byType[type].missed += stats.missed || 0;
  }
}

function finalizeTacticBucket(bucket) {
  const total = bucket.found + bucket.missed;
  const byType = Object.entries(bucket.byType)
    .sort(([, a], [, b]) => (b.found + b.missed) - (a.found + a.missed))
    .map(([type, stats]) => {
      const typeTotal = stats.found + stats.missed;
      return {
        type,
        found: stats.found,
        missed: stats.missed,
        total: typeTotal,
        foundRate: typeTotal > 0 ? Number(((stats.found / typeTotal) * 100).toFixed(1)) : 0,
      };
    });

  return {
    found: bucket.found,
    missed: bucket.missed,
    total,
    foundRate: total > 0 ? Number(((bucket.found / total) * 100).toFixed(1)) : 0,
    byType,
  };
}

function aggregateTacticsLast30(games, playerGames, username, analysisByGame) {
  const recentGames = playerGames.slice(-30);
  const playerBucket = emptyTacticBucket();
  const opponentBucket = emptyTacticBucket();
  let gamesWithAnalysis = 0;

  for (const { game, index } of recentGames) {
    const analysis = analysisByGame[index];
    const tacticAccuracy = analysis?.tacticAccuracy;
    if (!tacticAccuracy) continue;

    let playerSide = 'white';
    let opponentSide = 'black';

    if (username) {
      const lower = username.toLowerCase();
      if (game.white.toLowerCase() === lower) {
        playerSide = 'white';
        opponentSide = 'black';
      } else if (game.black.toLowerCase() === lower) {
        playerSide = 'black';
        opponentSide = 'white';
      } else {
        continue;
      }
    }

    addTacticBucket(playerBucket, tacticAccuracy[playerSide]);
    addTacticBucket(opponentBucket, tacticAccuracy[opponentSide]);
    gamesWithAnalysis++;
  }

  return {
    window: 30,
    gamesConsidered: recentGames.length,
    gamesWithAnalysis,
    gamesWithoutAnalysis: Math.max(0, recentGames.length - gamesWithAnalysis),
    player: finalizeTacticBucket(playerBucket),
    opponents: finalizeTacticBucket(opponentBucket),
  };
}

function computeTacticsDetailsLast30(games, username, analysisByGame = {}) {
  if (!games || games.length === 0) {
    return {
      window: 30,
      gamesConsidered: 0,
      gamesWithAnalysis: 0,
      gamesWithoutAnalysis: 0,
      analyzedGames: [],
      playerEvents: [],
      opponentEvents: [],
    };
  }

  const gamesWithIndex = games.map((game, index) => ({ game, index }));
  const playerGames = username
    ? gamesWithIndex.filter(
        ({ game }) =>
          game.white.toLowerCase() === username.toLowerCase() ||
          game.black.toLowerCase() === username.toLowerCase()
      )
    : gamesWithIndex;

  const recentGames = playerGames.slice(-30);
  const analyzedGames = [];
  const playerEvents = [];
  const opponentEvents = [];

  for (const { game, index } of recentGames) {
    const analysis = analysisByGame[index];
    if (!analysis?.moves) continue;

    analyzedGames.push({
      gameIndex: index,
      white: game.white,
      black: game.black,
      whiteElo: game.whiteElo,
      blackElo: game.blackElo,
      date: game.date,
      opening: game.opening,
      result: game.result,
      moves: analysis.moves,
    });

    let playerSide = 'white';
    let opponentSide = 'black';

    if (username) {
      const lower = username.toLowerCase();
      if (game.white.toLowerCase() === lower) {
        playerSide = 'white';
        opponentSide = 'black';
      } else if (game.black.toLowerCase() === lower) {
        playerSide = 'black';
        opponentSide = 'white';
      }
    }

    analysis.moves.forEach((move, moveIndex) => {
      if (!move?.tactic) return;

      const event = {
        id: `${index}:${moveIndex}`,
        gameIndex: index,
        moveIndex,
        moveNumber: move.moveNumber,
        color: move.color,
        san: move.san,
        bestMove: move.bestMove || null,
        tacticType: move.tactic.type,
        found: Boolean(move.tactic.found),
        classification: move.classification,
        cploss: move.cploss,
        white: game.white,
        black: game.black,
        date: game.date,
        opening: game.opening,
      };

      if (move.color === playerSide) {
        playerEvents.push(event);
      } else if (move.color === opponentSide) {
        opponentEvents.push(event);
      }
    });
  }

  const sortFn = (a, b) => {
    if (a.gameIndex !== b.gameIndex) return b.gameIndex - a.gameIndex;
    return a.moveIndex - b.moveIndex;
  };

  playerEvents.sort(sortFn);
  opponentEvents.sort(sortFn);

  return {
    window: 30,
    gamesConsidered: recentGames.length,
    gamesWithAnalysis: analyzedGames.length,
    gamesWithoutAnalysis: Math.max(0, recentGames.length - analyzedGames.length),
    analyzedGames,
    playerEvents,
    opponentEvents,
  };
}

export { computeStats, computeTacticsDetailsLast30 };
