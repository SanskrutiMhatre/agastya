'use strict';
// Password hashing and token primitives.
//
// Argon2id through the native binding when it loads; otherwise scrypt from
// node:crypto. Both produce self-describing PHC-style strings, so a database
// written under one verifies under the other build. Nothing here logs or
// returns plaintext material.

const crypto = require('node:crypto');

let argon2 = null;
try { argon2 = require('argon2'); } catch { argon2 = null; }

const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 32, saltlen: 16 };
const scryptOpts = (N, r, p) => ({ N, r, p, maxmem: 128 * N * r * 2 });

function scryptHash(password) {
  const salt = crypto.randomBytes(SCRYPT.saltlen);
  const key = crypto.scryptSync(Buffer.from(String(password), 'utf8'), salt, SCRYPT.keylen, scryptOpts(SCRYPT.N, SCRYPT.r, SCRYPT.p));
  return `$scrypt$N=${SCRYPT.N},r=${SCRYPT.r},p=${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function scryptVerify(stored, password) {
  const m = /^\$scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored);
  if (!m) return false;
  const [, N, r, p, saltB64, keyB64] = m;
  const expect = Buffer.from(keyB64, 'base64');
  let key;
  try {
    key = crypto.scryptSync(Buffer.from(String(password), 'utf8'), Buffer.from(saltB64, 'base64'), expect.length, scryptOpts(Number(N), Number(r), Number(p)));
  } catch { return false; }
  return key.length === expect.length && crypto.timingSafeEqual(key, expect);
}

async function hashPassword(password) {
  if (argon2) {
    return argon2.hash(String(password), { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
  }
  return scryptHash(password);
}

async function verifyPassword(stored, password) {
  if (!stored || typeof stored !== 'string') return false;
  if (stored.startsWith('$argon2')) {
    if (!argon2) return false; // argon2 hash but no binding: cannot verify
    try { return await argon2.verify(stored, String(password)); } catch { return false; }
  }
  if (stored.startsWith('$scrypt$')) return scryptVerify(stored, password);
  return false;
}

// Verification against a throwaway hash for unknown usernames, so "no such
// user" and "wrong password" cost the same time.
let dummyHashPromise = null;
async function dummyVerify(password) {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomBytes(16).toString('hex'));
  await verifyPassword(await dummyHashPromise, String(password || ''));
  return false;
}

// Opaque session token: 256 bits, URL-safe. Only its SHA-256 is stored.
const newToken = () => crypto.randomBytes(32).toString('base64url');
const sha256hex = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const newId = () => crypto.randomUUID();

module.exports = {
  hashPassword, verifyPassword, dummyVerify, newToken, sha256hex, newId,
  scryptHash, usingArgon2: () => !!argon2,
};
