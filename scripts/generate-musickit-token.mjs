#!/usr/bin/env node
/**
 * Generates a 180-day Apple MusicKit developer token.
 *
 * Usage (run on your Mac in Terminal):
 *   node scripts/generate-musickit-token.mjs AuthKey_XXXXXXXXXX.p8 TEAMID12AB KEYID12345
 *
 * Arguments:
 *   1. Path to the .p8 file downloaded from Apple Developer portal
 *   2. Your 10-character Team ID  (developer.apple.com → Membership)
 *   3. Your 10-character Key ID   (developer.apple.com → Keys → your MusicKit key)
 *
 * Paste the printed TOKEN value into:
 *   artifacts/maplog/src/lib/developerToken.ts
 */

import { readFileSync } from 'fs';
import { createSign, createPrivateKey } from 'crypto';

const [,, p8Path, teamId, keyId] = process.argv;
if (!p8Path || !teamId || !keyId) {
  console.error('Usage: node scripts/generate-musickit-token.mjs AuthKey_XXXXXXXX.p8 TEAMID12AB KEYID12345');
  process.exit(1);
}

const pem = readFileSync(p8Path, 'utf8');
const privKey = createPrivateKey(pem);

const b64url = s => Buffer.from(s).toString('base64url');

const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 180; // 180 days (Apple's maximum)

const hdr = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: keyId }));
const pay = b64url(JSON.stringify({ iss: teamId, iat, exp }));
const msg = `${hdr}.${pay}`;

const signer = createSign('SHA256');
signer.update(msg);
const sigDer = signer.sign(privKey);

// Convert DER-encoded ECDSA signature → raw r||s (IEEE P1363) required by JWT ES256
let off = 2;              // skip 0x30 <total-len>
off++;                    // skip 0x02
const rLen = sigDer[off++];
const r = sigDer.slice(off, off + rLen); off += rLen;
off++;                    // skip 0x02
const sLen = sigDer[off++];
const s = sigDer.slice(off, off + sLen);

const pad32 = x => Buffer.concat([Buffer.alloc(Math.max(0, 32 - x.length)), x]);
const sig = Buffer.concat([pad32(r), pad32(s)]).toString('base64url');

const token = `${msg}.${sig}`;

console.log(`\n✓ Team ID : ${teamId}`);
console.log(`✓ Key ID  : ${keyId}`);
console.log(`✓ Expires : ${new Date(exp * 1000).toDateString()}`);
console.log(`\nPaste this into artifacts/maplog/src/lib/developerToken.ts:\n`);
console.log(`export const DEVELOPER_TOKEN = '${token}';\n`);
