// Prints a new shared secret for the Gmail Apps Script.
//   npm run admin:ingest-secret
// Put the same value in Vercel (ADMIN_INGEST_SECRET) and in the Apps Script's
// Script Properties (INGEST_SECRET).
import { randomBytes } from "node:crypto";
console.log(`\nADMIN_INGEST_SECRET=${randomBytes(32).toString("base64url")}\n\nUse the same value as INGEST_SECRET in the Apps Script's Script Properties.\n`);
