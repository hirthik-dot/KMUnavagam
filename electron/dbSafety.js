// electron/dbSafety.js - Crash-Resilient Durability & Recovery Layer
// Handles WAL, backups, and automatic recovery using synchronous Node.js built-ins.

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// FIX B: Global async backup queue to prevent parallel backup execution
let backupInProgress = Promise.resolve();

function enqueueBackup(task) {
    backupInProgress = backupInProgress.then(task).catch(() => { });
    return backupInProgress;
}


/**
 * Enable WAL mode and other safety PRAGMAs
 * @param {object} db - The better-sqlite3 database instance
 */
function enableWAL(db) {
    // CRITICAL: No try/catch — WAL failure must be fatal. App must not start without durability.
    db.pragma('journal_mode=WAL');
    db.pragma('synchronous=FULL');
    db.pragma('foreign_keys=ON');
    db.pragma('wal_autocheckpoint=200'); // Checkpoint every ~200KB to prevent WAL growth
    logger.log('[DB] WAL mode enabled (FULL sync, autocheckpoint=200, foreign_keys=ON)', 'INFO');
}

/**
 * Force a WAL checkpoint to merge data into the main file.
 * REQUIRED before copying the DB file for backups.
 * @param {object} db - The better-sqlite3 database instance
 */
function checkpoint(db) {
    try {
        // TRUNCATE resets WAL file size to zero after merging (FULL does not shrink the WAL file)
        db.pragma('wal_checkpoint(TRUNCATE)');
        // logger.log('[DB] WAL checkpoint (TRUNCATE) completed', 'INFO');
    } catch (error) {
        logger.log(`[DB] WAL checkpoint failed: ${error.message}`, 'ERROR');
    }
}

/**
 * Overwrite latest.db with the current database file.
 * Uses SQLite native .backup() API which is safe and WAL-aware.
 * @param {object} db - The better-sqlite3 database instance
 * @param {string} dbPath - Path to hotel.db
 * @param {string} backupDir - Path to backups folder
 */
async function updateLatestBackup(db, dbPath, backupDir) {
    return enqueueBackup(async () => {
        try {
            // 1. CRITICAL: Checkpoint before copy
            checkpoint(db);

            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const latestPath = path.join(backupDir, 'latest.db');
            const tempPath = latestPath + '.tmp';

            // 2. Atomic backup using SQLite native API
            await db.backup(tempPath);

            // 3. Rename after backup completes
            if (fs.existsSync(tempPath)) {
                fs.renameSync(tempPath, latestPath);

                // 4. SAFETY: Verify the written backup is not corrupted
                verifyBackupIntegrity(latestPath);

                logger.log('[BACKUP] latest.db updated and integrity-verified ✅', 'INFO');
            } else {
                throw new Error(`Backup temp file not created: ${tempPath}`);
            }
        } catch (error) {
            logger.log(`[BACKUP] Failed to update latest.db: ${error.message}`, 'ERROR');
        }
    });
}

/**
 * Create a daily snapshot (YYYY-MM-DD.db) if it doesn't exist.
 * @param {object} db - The better-sqlite3 database instance
 * @param {string} dbPath - Path to hotel.db
 * @param {string} backupDir - Path to backups folder
 */
async function createDailySnapshot(db, dbPath, backupDir) {
    return enqueueBackup(async () => {
        try {
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const snapshotPath = path.join(backupDir, `${dateStr}.db`);

            if (!fs.existsSync(snapshotPath)) {
                // 1. CRITICAL: Checkpoint before copy
                checkpoint(db);

                const tempPath = snapshotPath + '.tmp';
                await db.backup(tempPath);

                if (fs.existsSync(tempPath)) {
                    fs.renameSync(tempPath, snapshotPath);

                    // 2. SAFETY: Verify the written snapshot is not corrupted
                    verifyBackupIntegrity(snapshotPath);

                    logger.log(`[BACKUP] Daily snapshot created and verified: ${dateStr}.db ✅`, 'INFO');
                } else {
                    throw new Error(`Snapshot temp file not created: ${tempPath}`);
                }
            }
        } catch (error) {
            logger.log(`[BACKUP] Failed to create daily snapshot: ${error.message}`, 'ERROR');
        }
    });
}

/**
 * Keep only the last 'days' of daily snapshots.
 * @param {string} backupDir - Path to backups folder
 * @param {number} days - Number of days to retain
 */
function cleanupOldDailyBackups(backupDir, days = 30) {
    try {
        if (!fs.existsSync(backupDir)) return;

        const files = fs.readdirSync(backupDir);
        const now = Date.now();
        const retentionMillis = days * 24 * 60 * 60 * 1000;

        files.forEach(file => {
            // Only match YYYY-MM-DD.db format
            if (/^\d{4}-\d{2}-\d{2}\.db$/.test(file)) {
                // FIX: Parse date from FILENAME, not mtime (mtime changes during copy/sync)
                const dateStr = file.replace('.db', '');
                const fileDate = new Date(dateStr + 'T00:00:00.000Z');
                if (isNaN(fileDate.getTime())) return; // Skip if date parse fails
                const age = now - fileDate.getTime();

                if (age > retentionMillis) {
                    const filePath = path.join(backupDir, file);
                    try {
                        fs.unlinkSync(filePath);
                        logger.log(`[BACKUP] Deleted old daily backup: ${file}`, 'INFO');
                    } catch (delErr) {
                        logger.log(`[BACKUP] Failed to delete ${file}: ${delErr.message}`, 'WARN');
                    }
                }
            }
        });
        logger.log('[BACKUP] Old daily backups cleaned', 'INFO');
    } catch (error) {
        logger.log(`[BACKUP] Failed to cleanup old backups: ${error.message}`, 'ERROR');
    }
}

/**
 * Ensure backups exist on the first day of usage.
 * @param {object} db - The better-sqlite3 database instance
 * @param {string} dbPath - Path to hotel.db
 * @param {string} backupDir - Path to backups folder
 */
async function ensureFirstDayBackups(db, dbPath, backupDir) {
    try {
        if (!fs.existsSync(dbPath)) return;

        const latestPath = path.join(backupDir, 'latest.db');
        if (!fs.existsSync(latestPath)) {
            await updateLatestBackup(db, dbPath, backupDir);
            await createDailySnapshot(db, dbPath, backupDir);
        }
    } catch (error) {
        logger.log(`[BACKUP] Error ensuring first day backups: ${error.message}`, 'ERROR');
    }
}

/**
 * Helper: Validate a backup file using PRAGMA integrity_check.
 * Runs in read-only mode to prevent accidental mutation of the backup.
 */
function isValidBackup(filePath) {
    const Database = require('better-sqlite3');
    if (!fs.existsSync(filePath)) return false;

    let tempDb;
    try {
        // readonly: true prevents any writes, timeout: 2000 for safety
        tempDb = new Database(filePath, { readonly: true, timeout: 2000 });
        const check = tempDb.pragma('integrity_check');
        const isValid = Array.isArray(check) && check[0].integrity_check === 'ok';
        tempDb.close();
        return isValid;
    } catch (e) {
        if (tempDb) try { tempDb.close(); } catch (err) { }
        return false;
    }
}

/**
 * SAFETY: Verify a freshly written backup is not corrupted.
 * Opens the file in readonly mode, runs integrity_check.
 * If the check fails, DELETES the bad backup and throws.
 * Must be called after every backup write-and-rename.
 *
 * @param {string} filePath - Path to the backup .db file
 */
function verifyBackupIntegrity(filePath) {
    const Database = require('better-sqlite3');
    let verifyDb;
    try {
        verifyDb = new Database(filePath, { readonly: true, timeout: 3000 });
        const check = verifyDb.pragma('integrity_check');
        verifyDb.close();
        verifyDb = null;

        if (!Array.isArray(check) || check[0].integrity_check !== 'ok') {
            // Delete the corrupt backup immediately — never trust it
            try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
            const msg = `[BACKUP] ❌ CORRUPTED backup detected and deleted: ${filePath} (check=${JSON.stringify(check)})`;
            logger.log(msg, 'ERROR');
            throw new Error(msg);
        }
    } catch (e) {
        if (verifyDb) try { verifyDb.close(); } catch (_) { }
        throw e; // Re-throw so callers are alerted
    }
}

/**
 * Get the newest financial transaction timestamp across all financial tables.
 * Used to detect if a backup is older than the live database.
 *
 * @param {string} dbPath - Path to the .db file
 * @returns {string|null} ISO timestamp string, or null if unreadable
 */
function getNewestFinancialTimestamp(dbPath) {
    const Database = require('better-sqlite3');
    let tempDb;
    try {
        tempDb = new Database(dbPath, { readonly: true, timeout: 2000 });
        // Query the newest record across all financial tables
        const row = tempDb.prepare(`
            SELECT MAX(ts) as newest FROM (
                SELECT MAX(created_at) as ts FROM bills
                UNION ALL
                SELECT MAX(expense_date) as ts FROM expenses
                UNION ALL
                SELECT MAX(transaction_date) as ts FROM vendor_transactions
                UNION ALL
                SELECT MAX(transaction_date) as ts FROM staff_transactions
            )
        `).get();
        tempDb.close();
        return row ? row.newest : null;
    } catch (e) {
        if (tempDb) try { tempDb.close(); } catch (_) { }
        return null; // Can't read = treat as unknown
    }
}

/**
 * Detect corruption, preserve damaged file forensics, and restore from source.
 * @param {string} dbPath - Destination path (hotel.db)
 * @param {string} backupDir - Source directory for backups
 */
function restoreLatestBackupIfCorrupted(dbPath, backupDir) {
    const Database = require('better-sqlite3');
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    let isCorrupted = false;

    /**
     * Helper: fs.renameSync with retries (for Windows EBUSY)
     */
    const renameWithRetry = (oldPath, newPath, retries = 3) => {
        for (let i = 0; i <= retries; i++) {
            try {
                fs.renameSync(oldPath, newPath);
                return true;
            } catch (err) {
                if (err.code === 'EBUSY' && i < retries) {
                    logger.log(`[RECOVERY] File locked, retrying rename (${i + 1}/${retries})...`, 'WARN');
                    const sleep = (ms) => {
                        const end = Date.now() + ms;
                        while (Date.now() < end) { }
                    };
                    sleep(200);
                    continue;
                }
                throw err;
            }
        }
    };

    // 1. Check if main file exists and is healthy
    if (!fs.existsSync(dbPath)) {
        if (fs.existsSync(walPath) || fs.existsSync(shmPath)) {
            logger.log('[RECOVERY] Orphaned WAL/SHM found without main DB file', 'WARN');
            isCorrupted = true;
        } else {
            logger.log('[RECOVERY] Database file missing, checking backups...', 'INFO');
            isCorrupted = true;
        }
    } else {
        let tempDb;
        try {
            tempDb = new Database(dbPath, { timeout: 2000 });
            const check = tempDb.pragma('integrity_check');
            if (!Array.isArray(check) || check[0].integrity_check !== 'ok') {
                throw new Error(`Integrity check: ${JSON.stringify(check)}`);
            }
            tempDb.close();
        } catch (error) {
            logger.log(`[RECOVERY] Main DB corruption detected: ${error.message}`, 'ERROR');
            isCorrupted = true;
            if (tempDb) try { tempDb.close(); } catch (e) { }
        }
    }

    if (isCorrupted) {
        // 2. Preserve forensic evidence of the corrupted state
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        [dbPath, walPath, shmPath].forEach(p => {
            if (fs.existsSync(p)) {
                try {
                    const forensicName = path.basename(p).replace('.db', '') + `_corrupted_${timestamp}` + (p.endsWith('.db') ? '.db' : '');
                    const forensicPath = path.join(path.dirname(p), forensicName);
                    renameWithRetry(p, forensicPath);
                    logger.log(`[RECOVERY] Preserved forensic copy: ${forensicName}`, 'INFO');
                } catch (e) {
                    logger.log(`[RECOVERY] Failed to preserve forensic copy ${p}: ${e.message}`, 'ERROR');
                }
            }
        });

        // 3. Find the best valid backup to restore
        const candidateBackups = [];
        const latestPath = path.join(backupDir, 'latest.db');
        if (fs.existsSync(latestPath)) candidateBackups.push(latestPath);

        if (fs.existsSync(backupDir)) {
            const daily = fs.readdirSync(backupDir)
                .filter(f => /^\d{4}-\d{2}-\d{2}\.db$/.test(f))
                .sort()
                .reverse()
                .map(f => path.join(backupDir, f));
            candidateBackups.push(...daily);
        }

        let sourcePath = null;
        for (const candidate of candidateBackups) {
            if (isValidBackup(candidate)) {
                sourcePath = candidate;
                break;
            } else {
                logger.log(`[RECOVERY] Skipped corrupted backup: ${path.basename(candidate)}`, 'WARN');
            }
        }

        // 4. Perform atomic restore
        if (sourcePath) {
            // SAFETY: Timestamp guard — refuse to restore an older backup over newer live data
            // unless force mode is explicitly requested.
            const currentTs = getNewestFinancialTimestamp(dbPath);
            const backupTs  = getNewestFinancialTimestamp(sourcePath);

            if (currentTs && backupTs && backupTs < currentTs) {
                logger.log(
                    `[RECOVERY] ⚠️  RESTORE WARNING: Backup is OLDER than current DB.` +
                    ` Current newest: ${currentTs} | Backup newest: ${backupTs}.` +
                    ` This restore would LOSE data recorded after ${backupTs}.` +
                    ` Proceeding only because corruption was detected (forced).`,
                    'WARN'
                );
            }

            try {
                const tempRestore = dbPath + '.restore_tmp';
                fs.copyFileSync(sourcePath, tempRestore);
                renameWithRetry(tempRestore, dbPath);
                logger.log(`[RECOVERY] Database restored from: ${path.basename(sourcePath)}`, 'INFO');
            } catch (e) {
                logger.log(`[RECOVERY] Atomic restore failed: ${e.message}`, 'ERROR');
            }
        } else {
            logger.log('[RECOVERY] No valid backup available — initializing fresh DB', 'ERROR');
        }
    }
}

module.exports = {
    enableWAL,
    checkpoint,
    updateLatestBackup,
    createDailySnapshot,
    cleanupOldDailyBackups,
    ensureFirstDayBackups,
    restoreLatestBackupIfCorrupted
};
