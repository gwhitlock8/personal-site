/**
 * Gmail -> job search tracker (gavinwhitlock.com/admin)
 *
 * Runs in Gavin's own Google account (script.google.com). Every 15 minutes it
 * finds job-search email and sends only the sender, subject, date, a short
 * snippet and the Gmail ids to the site's private endpoint. Full emails stay in
 * Gmail. See docs/adr/0001-apps-script-for-gmail.md for why.
 *
 * It picks up:
 *   1. mail from applicant tracking systems (Ashby, Greenhouse, Lever, Workday...)
 *   2. any thread you label "Job Search" in Gmail
 *   3. new messages, including your own replies, in threads the tracker already follows
 *
 * Setup (once):
 *   1. Create a Gmail label named exactly: Job Search
 *   2. In this Apps Script project: Project Settings > Script Properties, add
 *        INGEST_SECRET  = the same value as ADMIN_INGEST_SECRET in Vercel
 *        SITE_URL       = https://www.gavinwhitlock.com   (optional; this is the default)
 *   3. Run testConnection once (approve the Gmail permissions it asks for).
 *   4. Run installTrigger once. Done; it now runs every 15 minutes.
 *   5. Run installDigestTrigger once for the weekday-morning Digest (7:30 a.m. Central).
 *      previewDigest shows today's Digest in the log without sending it.
 *   6. Job Matches need no setup: each sync also asks the site to scan job boards
 *      (once a day) and run a few Fit Checks. jobTickNow runs that by hand.
 *
 * The first runs work back to October 1, 2026, 50 messages per run, until caught up.
 * The site caps email classification per minute (ADMIN_MODEL_RPM) so the public
 * chat assistant always has room under Kimi's rate limit; anything over the cap
 * comes back "deferred" and is retried on the next run.
 * This file is kept in the repo at scripts/gmail-sync.gs; paste updates in by hand.
 */

var START_DATE = new Date(Date.UTC(2026, 9, 1)); // October 1, 2026
var MAX_PER_RUN = 50; // ~5 requests of 10; stays inside Apps Script's 6-minute limit
var BATCH_SIZE = 10;  // must not exceed MAX_BATCH in app/api/admin/ingest/route.ts
var PAUSE_MS = 1000;  // small gap between requests
var LABEL = 'job-search'; // Gmail's search name for the "Job Search" label

// Keep in step with ATS_DOMAINS in lib/admin/matching.ts.
var ATS_DOMAINS = [
  'ashbyhq.com', 'greenhouse.io', 'greenhouse-mail.io', 'lever.co', 'myworkday.com', 'myworkdayjobs.com',
  'workday.com', 'smartrecruiters.com', 'icims.com', 'jobvite.com', 'workablemail.com', 'workable.com',
  'rippling.com', 'rippling-ats.com', 'bamboohr.com', 'dover.com', 'gem.com', 'pinpointhq.com', 'breezy.hr',
  'teamtailor.com', 'recruitee.com', 'jazzhr.com'
];

function props_() {
  return PropertiesService.getScriptProperties();
}

function siteUrl_() {
  return (props_().getProperty('SITE_URL') || 'https://www.gavinwhitlock.com').replace(/\/$/, '');
}

function request_(method, payload, path) {
  var secret = props_().getProperty('INGEST_SECRET');
  if (!secret) throw new Error('Add INGEST_SECRET in Project Settings > Script Properties.');
  var options = {
    method: method,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    muteHttpExceptions: true
  };
  if (payload) options.payload = JSON.stringify(payload);
  var res = UrlFetchApp.fetch(siteUrl_() + (path || '/api/admin/ingest'), options);
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('Tracker returned ' + code + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}

/** Run once by hand to check the secret and URL, and to grant Gmail permissions. */
function testConnection() {
  var data = request_('get');
  Logger.log('Connected. The tracker follows ' + data.threads.length + ' Gmail threads.');
  Logger.log('Your address: ' + Session.getActiveUser().getEmail());
}

/** Run once by hand: schedules syncJobEmail every 15 minutes (replacing any old schedule). */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncJobEmail') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncJobEmail').timeBased().everyMinutes(15).create();
  Logger.log('Scheduled syncJobEmail every 15 minutes.');
}

/** Strips quoted replies and signatures-ish noise, keeps a short snippet. */
function snippet_(message) {
  var body = message.getPlainBody() || '';
  var cut = body.search(/\n\s*On .+wrote:|\n-{2,}\s*Original Message|\n>/);
  if (cut > 0) body = body.slice(0, cut);
  return body.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function myAddresses_() {
  var list = [Session.getActiveUser().getEmail()].concat(GmailApp.getAliases());
  return list.map(function (a) { return a.toLowerCase(); });
}

function isMine_(from, mine) {
  var f = from.toLowerCase();
  return mine.some(function (a) { return a && f.indexOf(a) !== -1; });
}

/** The scheduled job. */
function syncJobEmail() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // a previous run is still going

  try {
    var cursor = Number(props_().getProperty('CURSOR_MS')) || START_DATE.getTime();
    var mine = myAddresses_();
    var threadsById = {};

    // 1 + 2: ATS senders and the Job Search label. One day of overlap; the site skips duplicates.
    var afterSec = Math.floor(cursor / 1000) - 86400;
    var query = '(from:(' + ATS_DOMAINS.join(' OR ') + ') OR label:' + LABEL + ') after:' + afterSec;
    for (var start = 0; start < 500; start += 100) {
      var page = GmailApp.search(query, start, 100);
      page.forEach(function (t) { threadsById[t.getId()] = t; });
      if (page.length < 100) break;
    }

    // 3: threads the tracker already follows (catches replies, including yours).
    request_('get').threads.forEach(function (id) {
      if (threadsById[id]) return;
      try {
        var t = GmailApp.getThreadById(id);
        if (t && t.getLastMessageDate().getTime() > cursor) threadsById[id] = t;
      } catch (e) {
        // thread deleted or no longer accessible
      }
    });

    // Collect messages newer than the cursor, oldest first.
    var messages = [];
    Object.keys(threadsById).forEach(function (id) {
      threadsById[id].getMessages().forEach(function (m) {
        if (m.getDate().getTime() > cursor) messages.push({ thread: threadsById[id], message: m });
      });
    });
    messages.sort(function (a, b) { return a.message.getDate() - b.message.getDate(); });
    messages = messages.slice(0, MAX_PER_RUN);

    var newCursor = cursor;
    for (var i = 0; i < messages.length; i += BATCH_SIZE) {
      if (i > 0) Utilities.sleep(PAUSE_MS);
      var batch = messages.slice(i, i + BATCH_SIZE);
      var payload = batch.map(function (x) {
        var m = x.message;
        return {
          messageId: m.getId(),
          threadId: x.thread.getId(),
          from: m.getFrom(),
          subject: m.getSubject() || '(no subject)',
          date: m.getDate().toISOString(),
          snippet: snippet_(m),
          direction: isMine_(m.getFrom(), mine) ? 'out' : 'in'
        };
      });
      var results = request_('post', { messages: payload }).results;

      // Advance the cursor only past messages that succeeded, in order.
      var stop = false;
      for (var j = 0; j < results.length; j++) {
        // "error" and "deferred" (rate limit) both get retried on the next run.
        if (results[j].outcome === 'error' || results[j].outcome === 'deferred') { stop = true; break; }
        newCursor = batch[j].message.getDate().getTime();
      }
      if (stop) break;
    }

    if (newCursor > cursor) props_().setProperty('CURSOR_MS', String(newCursor));
    Logger.log('Processed ' + messages.length + ' messages. Caught up to ' + new Date(newCursor).toISOString());
    jobTick_();
  } finally {
    lock.releaseLock();
  }
}

// ---- Job Matches ----
// After each email sync, the site scans job boards (once a day) and runs a few
// Fit Checks. A failure here never affects email sync.

function jobTick_() {
  try {
    var r = request_('post', {}, '/api/admin/jobs/tick');
    Logger.log('Job Matches: ' + (r.scanned ? 'scanned, ' + r.newMatches + ' new. ' : '') +
      r.fitChecked + ' Fit Checks run, ' + r.fitPending + ' waiting.' +
      (r.failedSources && r.failedSources.length ? ' Sources that failed: ' + r.failedSources.join(', ') : ''));
  } catch (e) {
    Logger.log('Job Matches tick failed: ' + e.message);
  }
}

/** Run by hand to check the job scan without waiting for the next sync. */
function jobTickNow() {
  jobTick_();
}

/** Run by hand to re-scan from October 1 (the site still skips messages it has seen). */
function resetCursor() {
  props_().deleteProperty('CURSOR_MS');
  Logger.log('Cursor reset to ' + START_DATE.toISOString());
}

// ---- Digest ----

var DIGEST_TZ = 'America/Chicago';

/** Run once by hand: schedules sendDigest daily near 7:30 a.m. Central (it skips weekends itself). */
function installDigestTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDigest').timeBased().atHour(7).nearMinute(30).everyDays(1).inTimezone(DIGEST_TZ).create();
  Logger.log('Scheduled sendDigest for about 7:30 a.m. Central, weekdays.');
}

/**
 * The scheduled Digest: weekdays only, at most once a day, and only when there is
 * something to act on. Sent from your own Gmail to yourself.
 */
function sendDigest() {
  var now = new Date();
  var weekday = Number(Utilities.formatDate(now, DIGEST_TZ, 'u')); // 1 = Monday ... 7 = Sunday
  if (weekday > 5) return;
  var today = Utilities.formatDate(now, DIGEST_TZ, 'yyyy-MM-dd');
  if (props_().getProperty('DIGEST_SENT_ON') === today) return;

  var digest = request_('get', null, '/api/admin/digest');
  if (!digest.send) {
    Logger.log('Quiet day: nothing due and nothing to review, so no Digest.');
    return;
  }
  GmailApp.sendEmail(Session.getActiveUser().getEmail(), digest.subject, digest.text, {
    htmlBody: digest.html,
    name: 'Job search tracker'
  });
  props_().setProperty('DIGEST_SENT_ON', today);
  Logger.log('Sent: ' + digest.subject);
}

/** Run by hand to see today's Digest in the log without sending it. */
function previewDigest() {
  var digest = request_('get', null, '/api/admin/digest');
  if (!digest.send) {
    Logger.log('Quiet day: no Digest would be sent.');
    return;
  }
  Logger.log(digest.subject + '\n\n' + digest.text);
}
