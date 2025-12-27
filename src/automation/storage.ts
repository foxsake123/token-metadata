/**
 * Persistent Storage for LIST Token Automation
 *
 * SQLite-based storage for burn state persistence
 * Survives server restarts
 */

import fs from 'fs';
import path from 'path';

// Storage file path
const DATA_DIR = process.env.DATA_DIR || './data';
const STORAGE_FILE = path.join(DATA_DIR, 'burns.json');

export interface StoredBurn {
  slug: string;
  name: string;
  burnAllocationPercent: number;
  status: 'pending' | 'confirmed' | 'executed';
  detectedAt: string;
  executedAt?: string;
  txSignature?: string;
}

export interface StorageData {
  burns: StoredBurn[];
  lastCheck: string;
  version: number;
}

const CURRENT_VERSION = 1;

/**
 * Initialize storage directory and file
 */
function initStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Created data directory: ${DATA_DIR}`);
  }

  if (!fs.existsSync(STORAGE_FILE)) {
    const initialData: StorageData = {
      burns: [],
      lastCheck: new Date().toISOString(),
      version: CURRENT_VERSION,
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(initialData, null, 2));
    console.log(`📄 Created storage file: ${STORAGE_FILE}`);
  }
}

/**
 * Load storage data from disk
 */
export function loadStorage(): StorageData {
  initStorage();

  try {
    const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(data) as StorageData;

    // Migration if needed
    if (parsed.version !== CURRENT_VERSION) {
      console.log(`📦 Migrating storage from v${parsed.version} to v${CURRENT_VERSION}`);
      parsed.version = CURRENT_VERSION;
      saveStorage(parsed);
    }

    return parsed;
  } catch (error) {
    console.error('❌ Failed to load storage, creating new:', error);
    const initialData: StorageData = {
      burns: [],
      lastCheck: new Date().toISOString(),
      version: CURRENT_VERSION,
    };
    saveStorage(initialData);
    return initialData;
  }
}

/**
 * Save storage data to disk
 */
export function saveStorage(data: StorageData): void {
  initStorage();
  data.lastCheck = new Date().toISOString();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Check if a burn has been recorded
 */
export function isBurnRecorded(slug: string): boolean {
  const data = loadStorage();
  return data.burns.some(b => b.slug === slug);
}

/**
 * Check if a burn has been executed
 */
export function isBurnExecuted(slug: string): boolean {
  const data = loadStorage();
  return data.burns.some(b => b.slug === slug && b.status === 'executed');
}

/**
 * Record a new burn detection
 */
export function recordBurnDetected(
  slug: string,
  name: string,
  burnAllocationPercent: number
): StoredBurn {
  const data = loadStorage();

  // Check if already exists
  const existing = data.burns.find(b => b.slug === slug);
  if (existing) {
    return existing;
  }

  const burn: StoredBurn = {
    slug,
    name,
    burnAllocationPercent,
    status: 'confirmed',
    detectedAt: new Date().toISOString(),
  };

  data.burns.push(burn);
  saveStorage(data);

  console.log(`💾 Recorded burn detection: ${name} (${slug})`);
  return burn;
}

/**
 * Record a burn execution
 */
export function recordBurnExecuted(
  slug: string,
  txSignature: string
): StoredBurn | null {
  const data = loadStorage();

  const burn = data.burns.find(b => b.slug === slug);
  if (!burn) {
    console.error(`❌ Cannot record execution: burn ${slug} not found`);
    return null;
  }

  burn.status = 'executed';
  burn.executedAt = new Date().toISOString();
  burn.txSignature = txSignature;

  saveStorage(data);

  console.log(`💾 Recorded burn execution: ${burn.name} - TX: ${txSignature}`);
  return burn;
}

/**
 * Get all pending (unexecuted) burns
 */
export function getPendingBurns(): StoredBurn[] {
  const data = loadStorage();
  return data.burns.filter(b => b.status !== 'executed');
}

/**
 * Get all executed burns
 */
export function getExecutedBurns(): StoredBurn[] {
  const data = loadStorage();
  return data.burns.filter(b => b.status === 'executed');
}

/**
 * Get storage statistics
 */
export function getStorageStats(): {
  totalBurns: number;
  pendingBurns: number;
  executedBurns: number;
  lastCheck: string;
} {
  const data = loadStorage();
  return {
    totalBurns: data.burns.length,
    pendingBurns: data.burns.filter(b => b.status !== 'executed').length,
    executedBurns: data.burns.filter(b => b.status === 'executed').length,
    lastCheck: data.lastCheck,
  };
}
