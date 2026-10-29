// staffLock.js - PIN lock for the Staff Maintenance page (privacy of wages and salary records)
// The PIN is never stored: only a salted scrypt hash in app_settings ("salt:hash", hex).
// The lock is always on: until a PIN exists, Staff Maintenance asks to create one before opening.
// A forgotten PIN is reset with the reset password given to the shop owner by LancingHub.

const crypto = require('crypto');
const db = require('./database');

const SETTING_KEY = 'staffLockPinHash';
const PIN_PATTERN = /^\d{4,6}$/;

// Hash of the reset password ("salt:hash"). The password itself is not in the code:
// it is shared with the owner separately. To change it, generate a new hash with scrypt (32-byte key).
const RESET_PASSWORD_HASH = 'c5baf2fbd50bc3e6d1470391725252a5:3149302e0a7dc28cd7eb30d65a7629a5b757070c3f0089ae7eddd417524b8da9';

function hashSecret(secret, salt) {
  return crypto.scryptSync(secret, salt, 32).toString('hex');
}

function matchesHash(secret, stored) {
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  const actual = hashSecret(String(secret || ''), salt);
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function hasPin() {
  return Boolean(db.getSetting(SETTING_KEY));
}

/**
 * Check a PIN against the stored hash. False when no PIN has been created yet.
 */
function verifyPin(pin) {
  return matchesHash(pin, db.getSetting(SETTING_KEY));
}

/**
 * Create the first PIN, or change it. Changing needs the current PIN, so nobody can
 * simply replace it from Admin to get in.
 */
function setPin(pin, currentPin) {
  pin = String(pin || '');
  if (!PIN_PATTERN.test(pin)) throw new Error('PIN must be 4 to 6 digits');
  if (hasPin() && !verifyPin(currentPin)) throw new Error('Current PIN is wrong');
  const salt = crypto.randomBytes(16).toString('hex');
  db.setSetting(SETTING_KEY, `${salt}:${hashSecret(pin, salt)}`);
  return true;
}

/**
 * Forgotten PIN: with the correct reset password the PIN is cleared,
 * and the next visit to Staff Maintenance asks to create a new one.
 */
function resetPin(resetPassword) {
  const password = String(resetPassword || '').trim().toUpperCase();
  if (!matchesHash(password, RESET_PASSWORD_HASH)) throw new Error('Reset password is wrong');
  db.setSetting(SETTING_KEY, '');
  return true;
}

module.exports = { hasPin, setPin, resetPin, verifyPin };
