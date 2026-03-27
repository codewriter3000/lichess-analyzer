import { Chess } from 'chess.js';

/**
 * Parse CSV text handling quoted fields, escaped quotes, and commas within quotes.
 * Returns an array of arrays (rows × columns).
 */
function parseCsvRows(csvText) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const ch = csvText[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        current.push(field);
        field = '';
        i++;
      } else if (ch === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
        i++;
      } else if (ch === '\r') {
        // Handle \r\n
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
        i++;
        if (i < csvText.length && csvText[i] === '\n') {
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push remaining field/row
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

/**
 * Parse CSV text and return an array of game objects keyed by header names.
 */
function parseCsvGames(csvText) {
  if (!csvText || !csvText.trim()) return [];

  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  const games = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < headers.length) continue;

    const game = {};
    for (let c = 0; c < headers.length; c++) {
      game[headers[c]] = row[c];
    }

    // Skip rows that look empty
    if (!game.moves && !game.result) continue;

    games.push(game);
  }

  return games;
}

/**
 * Strip annotations from a PGN moves string and return an array of clean SAN moves,
 * validated through chess.js.
 */
function stripAnnotations(movesText) {
  if (!movesText) return [];

  // Remove curly-brace annotations: { ... }
  let cleaned = movesText.replace(/\{[^}]*\}/g, '');
  // Remove move numbers: "1." "1..." "12." "12..."
  cleaned = cleaned.replace(/\d+\.{1,3}/g, '');
  // Remove result tokens at end
  cleaned = cleaned.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/g, '');
  // Split into tokens
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);

  // Validate each token via chess.js
  const chess = new Chess();
  const validMoves = [];

  for (const token of tokens) {
    // Strip annotation glyphs: ?!, ??, ?, !, !!, ‼, ⁈, ⁉, etc.
    const san = token.replace(/[?!]+$/, '');
    if (!san) continue;

    try {
      const result = chess.move(san);
      if (result) {
        validMoves.push(result.san);
      }
    } catch {
      // Not a valid move token, skip
    }
  }

  return validMoves;
}

/**
 * Create a new trie node.
 */
function createNode() {
  return {
    totalGames: 0,
    whiteWins: 0,
    blackWins: 0,
    draws: 0,
    avgWhiteElo: 0,
    avgBlackElo: 0,
    children: new Map(),
    opening: null,
    eco: null,
    // Internal accumulators for computing averages
    _whiteEloSum: 0,
    _blackEloSum: 0,
    _eloCount: 0,
    _openingDepth: 0,
  };
}

/**
 * Build an opening explorer trie from CSV text.
 * Returns the root node of the trie.
 */
function buildExplorerTree(csvText) {
  const games = parseCsvGames(csvText);
  return buildExplorerTreeFromGames(games);
}

/**
 * Build an opening explorer trie from a pre-parsed array of game objects.
 * Returns the root node of the trie.
 */
function buildExplorerTreeFromGames(games) {
  const root = createNode();

  for (const game of games) {
    const moves = stripAnnotations(game.moves);
    const result = (game.result || '').trim();
    const whiteElo = parseInt(game.white_elo, 10) || 0;
    const blackElo = parseInt(game.black_elo, 10) || 0;
    const opening = (game.opening || '').trim() || null;
    const eco = (game.eco || '').trim() || null;
    const depth = moves.length;

    // Walk down the trie, updating each node along the path
    let node = root;
    updateNode(node, result, whiteElo, blackElo, opening, eco, depth);

    for (const san of moves) {
      if (!node.children.has(san)) {
        node.children.set(san, createNode());
      }
      node = node.children.get(san);
      updateNode(node, result, whiteElo, blackElo, opening, eco, depth);
    }
  }

  // Finalize averages across the whole tree
  finalizeAverages(root);

  return root;
}

/**
 * Update a node with a game's result, ELO, and opening info.
 * Opening/eco are updated only when a game with a longer move sequence
 * contributes, so deeper positions get more specific opening names.
 */
function updateNode(node, result, whiteElo, blackElo, opening, eco, gameDepth) {
  node.totalGames++;

  if (result === '1-0') node.whiteWins++;
  else if (result === '0-1') node.blackWins++;
  else if (result === '1/2-1/2') node.draws++;

  if (whiteElo > 0 && blackElo > 0) {
    node._whiteEloSum += whiteElo;
    node._blackEloSum += blackElo;
    node._eloCount++;
  }

  // Prefer opening/eco from games with more moves (more specific classification)
  if (opening && gameDepth >= node._openingDepth) {
    node.opening = opening;
    node._openingDepth = gameDepth;
  }
  if (eco && gameDepth >= node._openingDepth) {
    node.eco = eco;
  }
}

/**
 * Recursively finalize ELO averages and clean up internal accumulators.
 */
function finalizeAverages(node) {
  if (node._eloCount > 0) {
    node.avgWhiteElo = Math.round(node._whiteEloSum / node._eloCount);
    node.avgBlackElo = Math.round(node._blackEloSum / node._eloCount);
  }
  delete node._whiteEloSum;
  delete node._blackEloSum;
  delete node._eloCount;
  delete node._openingDepth;

  for (const child of node.children.values()) {
    finalizeAverages(child);
  }
}

/**
 * Query a position in the opening tree.
 * @param {Object} root - The root trie node
 * @param {string[]} moveList - Array of SAN moves to traverse
 * @returns Position stats or null if position not found
 */
function queryPosition(root, moveList) {
  if (!root) return null;

  let node = root;
  for (const san of moveList) {
    if (!node.children.has(san)) {
      return null;
    }
    node = node.children.get(san);
  }

  // Build the response with child move stats
  const moves = [];
  for (const [san, child] of node.children) {
    moves.push({
      san,
      totalGames: child.totalGames,
      whiteWins: child.whiteWins,
      blackWins: child.blackWins,
      draws: child.draws,
      avgWhiteElo: child.avgWhiteElo,
      avgBlackElo: child.avgBlackElo,
    });
  }

  // Sort moves by popularity (most games first)
  moves.sort((a, b) => b.totalGames - a.totalGames);

  return {
    totalGames: node.totalGames,
    whiteWins: node.whiteWins,
    blackWins: node.blackWins,
    draws: node.draws,
    opening: node.opening,
    eco: node.eco,
    moves,
  };
}

export { buildExplorerTree, buildExplorerTreeFromGames, queryPosition, parseCsvGames };
