/**
 * Encrypt/decrypt auth tokens in HTTP-only cookies.
 * Uses AES-256-GCM with COOKIE_SECRET (32-byte hex).
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

function getKey() {
  const secret = process.env.COOKIE_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error('COOKIE_SECRET must be a 32-byte hex string (64 chars)');
  }
  return Buffer.from(secret.slice(0, 64), 'hex');
}

export function encrypt(data) {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

export function decrypt(encoded) {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64url');
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid cookie');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return JSON.parse(decipher.update(encrypted) + decipher.final('utf8'));
}

export const COOKIE_NAME = 'bungie_auth';
export const COOKIE_OPTS = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000'; // 30 days
