#!/usr/bin/env node
/**
 * Creates a local Docker `.env` from `.env.docker.example`, filling in strong
 * random secrets. Existing files are never overwritten.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.env');
const templatePath = join(root, '.env.docker.example');

if (existsSync(target)) {
  console.log('.env already exists — leaving it untouched.');
  process.exit(0);
}

const template = readFileSync(templatePath, 'utf8');
const password = randomBytes(18).toString('base64url');
const accessSecret = randomBytes(48).toString('hex');
const refreshSecret = randomBytes(48).toString('hex');

const contents = template
  .replace('CHANGE_ME_POSTGRES_PASSWORD', password)
  .replace('CHANGE_ME_ACCESS_SECRET', accessSecret)
  .replace('CHANGE_ME_REFRESH_SECRET', refreshSecret);

writeFileSync(target, contents, { encoding: 'utf8', mode: 0o600 });
console.log('Created .env with freshly generated database and JWT secrets.');
