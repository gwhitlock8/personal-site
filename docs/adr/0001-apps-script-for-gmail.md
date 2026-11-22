# Read Gmail and send the Digest with Google Apps Script, not the Gmail API

The admin needs Gavin's job-search email. A personal, unverified Google OAuth app needs the restricted Gmail read scope, and in testing mode its refresh tokens expire every 7 days; publishing it requires a paid security assessment. Instead, an Apps Script in Gavin's own Google account runs on a timer, searches for job-search mail (ATS sender domains, the "Job Search" label, and his replies in tracked threads), and posts only the minimal fields (sender, subject, date, snippet, thread link) to a secret-protected endpoint on the site. The same script fetches the Digest from the site each weekday morning and sends it from Gavin's Gmail, so there is no email provider to run.

## Considered Options

- **Gmail API with Google sign-in on the site**: weekly reconnects in testing mode, or a security review to publish.
- **Gmail filter forwarding to an inbound-email service**: adds a third-party service that receives full emails.

## Consequences

- The script lives in Gavin's Google account, not in this repo's deploys; a copy is kept in the repo and must be pasted in by hand when it changes.
- The site never holds Google credentials, and full email bodies stay in Gmail.
