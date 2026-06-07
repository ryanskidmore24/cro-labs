import { randomBytes } from 'crypto';

export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

export function generatePublicKey(): string {
  // 24 char alphanumeric key prefixed with "pk_"
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let key = 'pk_';
  const bytes = randomBytes(24);
  for (let i = 0; i < 24; i++) {
    key += chars[bytes[i] % chars.length];
  }
  return key;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 48);
}
