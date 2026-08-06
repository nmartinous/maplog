/**
 * Apple MusicKit developer token — baked in at build time.
 *
 * To regenerate (token expires every 180 days):
 *   node scripts/generate-musickit-token.mjs path/to/AuthKey_XXXXX.p8 TEAMID KEYID
 *
 * Paste the printed token string below and push.
 */
export const DEVELOPER_TOKEN = 'REPLACE_ME';
