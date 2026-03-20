const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parsePgn } = require('../services/pgnParser');
const { computeStats } = require('../services/statsService');
const { buildCsv } = require('../services/csvExport');

// Sample PGN with 2 games
const SAMPLE_PGN = `[Event "Rated Bullet game"]
[Site "https://lichess.org"]
[Date "2024.01.10"]
[UTCDate "2024.01.10"]
[UTCTime "12:00:00"]
[White "Magnus"]
[Black "Hikaru"]
[Result "1-0"]
[WhiteElo "2850"]
[BlackElo "2800"]
[ECO "C65"]
[Opening "Ruy Lopez: Berlin Defense"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. Re1 Nd6 6. Nxe5 Be7 1-0

[Event "Rated Rapid game"]
[Site "https://lichess.org"]
[Date "2024.01.11"]
[UTCDate "2024.01.11"]
[UTCTime "14:00:00"]
[White "Hikaru"]
[Black "Magnus"]
[Result "0-1"]
[WhiteElo "2800"]
[BlackElo "2855"]
[ECO "D00"]
[Opening "Queen's Pawn Game"]

1. d4 d5 2. Nf3 Nf6 3. e3 e6 0-1
`;

describe('PGN Parser', () => {
  it('parses multiple games from PGN text', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games.length, 2);
  });

  it('extracts player names correctly', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].white, 'Magnus');
    assert.equal(games[0].black, 'Hikaru');
  });

  it('extracts Elo ratings', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].whiteElo, 2850);
    assert.equal(games[0].blackElo, 2800);
  });

  it('extracts result', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].result, '1-0');
    assert.equal(games[1].result, '0-1');
  });

  it('extracts date', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].date, '2024-01-10');
  });

  it('extracts opening info', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].eco, 'C65');
    assert.equal(games[0].opening, 'Ruy Lopez: Berlin Defense');
  });

  it('counts ply correctly', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].plyCount, 12); // 6 full moves = 12 plies
  });

  it('returns empty array for empty input', () => {
    const games = parsePgn('');
    assert.equal(games.length, 0);
  });

  it('handles single game without newline at end', () => {
    const singleGame = `[White "A"][Black "B"][Result "1/2-1/2"][WhiteElo "1500"][BlackElo "1500"] 1. e4 e5 1/2-1/2`;
    const games = parsePgn(singleGame);
    assert.equal(games.length, 1);
    assert.equal(games[0].result, '1/2-1/2');
  });
});

describe('Stats Service', () => {
  it('computes total games', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, 'Magnus');
    assert.equal(stats.total, 2);
  });

  it('computes wins and losses for a player', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, 'Magnus');
    assert.equal(stats.wins, 2);
    assert.equal(stats.losses, 0);
  });

  it('computes win rate', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, 'Magnus');
    assert.equal(stats.winRate, '100.0');
  });

  it('builds rating history', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, 'Magnus');
    assert.ok(stats.ratingHistory.length > 0);
    assert.equal(stats.ratingHistory[0].rating, 2850);
  });

  it('handles no games gracefully', () => {
    const stats = computeStats([], 'player');
    assert.equal(stats.total, 0);
  });

  it('computes stats without username filter', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, null);
    assert.equal(stats.total, 2);
  });
});

describe('CSV Export', () => {
  it('generates a CSV with correct headers', () => {
    const games = parsePgn(SAMPLE_PGN);
    const csv = buildCsv(games, null);
    const lines = csv.split('\r\n');
    assert.equal(lines[0], 'Date,White,WhiteRating,Black,BlackRating,Result,Winner');
  });

  it('generates correct number of data rows', () => {
    const games = parsePgn(SAMPLE_PGN);
    const csv = buildCsv(games, null);
    const lines = csv.split('\r\n').filter(l => l.trim());
    assert.equal(lines.length, 3); // header + 2 games
  });

  it('includes correct winner in CSV', () => {
    const games = parsePgn(SAMPLE_PGN);
    const csv = buildCsv(games, null);
    const lines = csv.split('\r\n');
    assert.ok(lines[1].includes('Magnus'));
    assert.ok(lines[2].includes('Magnus'));
  });

  it('includes ratings in CSV', () => {
    const games = parsePgn(SAMPLE_PGN);
    const csv = buildCsv(games, null);
    const lines = csv.split('\r\n');
    assert.ok(lines[1].includes('2850'));
    assert.ok(lines[1].includes('2800'));
  });

  it('handles draw result correctly', () => {
    const drawPgn = `[White "A"][Black "B"][Result "1/2-1/2"][WhiteElo "1500"][BlackElo "1500"][UTCDate "2024.01.01"] 1. e4 e5 1/2-1/2`;
    const games = parsePgn(drawPgn);
    const csv = buildCsv(games, null);
    assert.ok(csv.includes('Draw'));
  });
});
