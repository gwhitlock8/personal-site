// One-time setup for the admin login.
//   npm run admin:setup
// Prompts for a password (hidden), then prints the three values to add in
// Vercel (Settings > Environment Variables) and to .env.local, plus the
// authenticator key to add in your authenticator app.

import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/admin/crypto";
import { newTotpSecret, otpauthUrl } from "../lib/admin/totp";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let input = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (ch === "\u0003") {
        process.exit(1);
      } else if (ch === "\u007f") {
        input = input.slice(0, -1);
      } else {
        input += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await askHidden("Choose an admin password (12+ characters): ");
if (password.length < 12) {
  console.error("Use at least 12 characters.");
  process.exit(1);
}
const again = await askHidden("Type it again: ");
if (again !== password) {
  console.error("The passwords didn't match.");
  process.exit(1);
}

const totp = newTotpSecret();
console.log(`
Add these three environment variables in Vercel (Production) and to .env.local:

ADMIN_PASSWORD_HASH=${hashPassword(password)}
ADMIN_TOTP_SECRET=${totp}
ADMIN_SESSION_SECRET=${randomBytes(32).toString("base64url")}

In your authenticator app, add an account by entering this setup key
(time-based, 6 digits):

  ${totp.match(/.{1,4}/g)!.join(" ")}

Or, if your app accepts a setup link:

  ${otpauthUrl(totp)}

Keep the setup key private; anyone with it can generate your codes.
`);
