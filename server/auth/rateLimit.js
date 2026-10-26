'use strict';
// Sliding-window limiter for authentication attempts, keyed by username + IP.
// In memory on purpose: one server process, and losing counters on restart
// only errs towards letting a legitimate user try again. Login, forgot
// password and voluntary password change share it.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

class RateLimiter {
  constructor({ windowMs = WINDOW_MS, max = MAX_ATTEMPTS, now = () => Date.now() } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.now = now;
    this.buckets = new Map(); // key -> [timestamps]
  }

  key(username, ip) {
    return `${String(username || '').toLowerCase()}|${ip || ''}`;
  }

  // Record an attempt BEFORE any credential work, so a limited caller learns
  // nothing about the account. Returns { allowed } or { allowed:false, retryAfterSeconds }.
  attempt(username, ip) {
    const k = this.key(username, ip);
    const t = this.now();
    let arr = this.buckets.get(k);
    if (!arr) { arr = []; this.buckets.set(k, arr); }
    while (arr.length && t - arr[0] > this.windowMs) arr.shift();
    if (arr.length >= this.max) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((arr[0] + this.windowMs - t) / 1000)) };
    }
    arr.push(t);
    if (this.buckets.size > 10000) {
      for (const [key, list] of this.buckets) {
        if (!list.length || t - list[list.length - 1] > this.windowMs) this.buckets.delete(key);
      }
    }
    return { allowed: true };
  }

  // A successful authentication clears the caller's counter.
  clear(username, ip) {
    this.buckets.delete(this.key(username, ip));
  }
}

module.exports = { RateLimiter, WINDOW_MS, MAX_ATTEMPTS };
