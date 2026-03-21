import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_VERSION = 'v1';
const CACHE_DIR = path.resolve(
  process.env.ANALYSIS_CACHE_DIR || path.join(process.cwd(), 'cache', 'analysis')
);

const memoryCache = new Map();
let cacheDirReady = false;

async function ensureCacheDir() {
  if (cacheDirReady) return;
  await fs.mkdir(CACHE_DIR, { recursive: true });
  cacheDirReady = true;
}

function buildCacheKey(game, depth) {
  const payload = `${CACHE_VERSION}|depth:${depth}|${game?.pgn || ''}`;
  return createHash('sha256').update(payload).digest('hex');
}

function getCacheFilePath(cacheKey) {
  return path.join(CACHE_DIR, `${cacheKey}.json`);
}

async function getCachedAnalysis(game, depth) {
  const cacheKey = buildCacheKey(game, depth);
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  await ensureCacheDir();
  const filePath = getCacheFilePath(cacheKey);

  try {
    const file = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(file);
    memoryCache.set(cacheKey, parsed);
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function setCachedAnalysis(game, depth, analysisResult) {
  const cacheKey = buildCacheKey(game, depth);
  await ensureCacheDir();

  const filePath = getCacheFilePath(cacheKey);
  const payload = JSON.stringify(analysisResult);
  await fs.writeFile(filePath, payload, 'utf8');
  memoryCache.set(cacheKey, analysisResult);
}

export { getCachedAnalysis, setCachedAnalysis };