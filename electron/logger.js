const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * electron/logger.js
 * Synchronous, crash-safe production logger.
 */

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Get the path to the logs directory.
 */
function getLogsDir() {
    try {
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
            // In development, store logs in the project root
            return path.join(__dirname, '..', 'logs');
        }
        return path.join(app.getPath('userData'), 'logs');
    } catch (error) {
        // Basic fallback if Electron app is not yet fully initialized
        return path.join(process.cwd(), 'logs');
    }
}

/**
 * Rotates the log file if it exceeds the size limit.
 */
function rotateLogsIfNeeded(logPath) {
    try {
        if (fs.existsSync(logPath)) {
            const stats = fs.statSync(logPath);
            if (stats.size > MAX_LOG_SIZE) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const dir = path.dirname(logPath);
                const oldLogPath = path.join(dir, `app_old_${timestamp}.log`);
                fs.renameSync(logPath, oldLogPath);
            }
        }
    } catch (err) {
        // Ignore rotation errors to avoid crashing the app
    }
}

/**
 * Log a message to app.log and the console.
 * @param {string} message - The message to log
 * @param {string} level - Log level (INFO, WARN, ERROR)
 */
function log(message, level = 'INFO') {
    // 1. Generate local timestamp (DD/MM/YYYY, HH:MM:SS AM/PM)
    const now = new Date();
    const timestamp = now.toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).replace(',', '');

    // Ensure message is a string (handle error objects)
    const formattedMessage = message instanceof Error ? message.stack : message;
    const logLine = `[${timestamp}] [${level}] ${formattedMessage}\n`;

    // 1. Always output to console
    if (level === 'ERROR') {
        console.error(logLine.trim());
    } else {
        console.log(logLine.trim());
    }

    // 2. Write to file
    try {
        const logsDir = getLogsDir();
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        const logPath = path.join(logsDir, 'app.log');

        // Check for rotation
        rotateLogsIfNeeded(logPath);

        fs.appendFileSync(logPath, logLine);
    } catch (err) {
        // Fallback to console if file logging fails (disk full, permission denied, etc)
        console.warn('[LOGGER] Failed to write to log file:', err.message);
    }
}

module.exports = { log };
