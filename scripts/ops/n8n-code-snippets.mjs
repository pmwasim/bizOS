/**
 * Code-node sources shared by the sanitized n8n workflow templates.
 * n8n 1.70 Code nodes do not expose fetch; require() needs NODE_FUNCTION_ALLOW_BUILTIN.
 */

export const VERIFY_SIGNATURE_CUSTOMIZATION = `const crypto = require('crypto');

const secret = $env.BIZOS_WEBHOOK_SECRET;
if (!secret) {
  throw new Error('BIZOS_WEBHOOK_SECRET is not configured in n8n');
}

const headers = $input.first().json.headers ?? {};
const signature = headers['x-signature'] ?? headers['X-Signature'];
if (!signature) {
  throw new Error('Missing X-Signature header');
}

const idempotencyKey = headers['x-idempotency-key'] ?? headers['X-Idempotency-Key'];
const body = $input.first().json.body;
const rawBody = typeof body === 'string' ? body : JSON.stringify(body);

const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
  throw new Error('Invalid webhook signature');
}

const payload = typeof body === 'string' ? JSON.parse(body) : body;
if (idempotencyKey && payload.id && idempotencyKey !== payload.id) {
  throw new Error('Idempotency key does not match request id');
}

return [{ json: { ...payload, idempotencyKey: idempotencyKey ?? payload.id, verified: true } }];`;

export const VERIFY_SIGNATURE_OPS = `const crypto = require('crypto');

const secret = $env.BIZOS_WEBHOOK_SECRET;
if (!secret) {
  throw new Error('BIZOS_WEBHOOK_SECRET is not configured in n8n');
}

const item = $input.first().json;
const headers = item.headers ?? {};
const signature = headers['x-signature'] ?? headers['X-Signature'];
if (!signature) {
  throw new Error('Missing X-Signature header');
}

const idempotencyKey = headers['x-idempotency-key'] ?? headers['X-Idempotency-Key'];
const body = item.body;
const rawBody = typeof item.rawBody === 'string' ? item.rawBody : (typeof body === 'string' ? body : JSON.stringify(body));

const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
  throw new Error('Invalid webhook signature');
}

const payload = typeof body === 'string' ? JSON.parse(body) : body;
if (idempotencyKey && payload.idempotencyKey && idempotencyKey !== payload.idempotencyKey) {
  throw new Error('Idempotency key mismatch');
}

return [{ json: { ...payload, idempotencyKey: idempotencyKey ?? payload.idempotencyKey, verified: true } }];`;

export const VERIFY_SIGNATURE_CI = `const crypto = require('crypto');

const secret = $env.BIZOS_WEBHOOK_SECRET;
if (!secret) {
  throw new Error('BIZOS_WEBHOOK_SECRET is not configured in n8n');
}

const headers = $input.first().json.headers ?? {};
const signature = headers['x-signature'] ?? headers['X-Signature'];
if (!signature) {
  throw new Error('Missing X-Signature header');
}

const idempotencyKey = headers['x-idempotency-key'] ?? headers['X-Idempotency-Key'];
const body = $input.first().json.body;
const rawBody = typeof body === 'string' ? body : JSON.stringify(body);

const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
  throw new Error('Invalid webhook signature');
}

const payload = typeof body === 'string' ? JSON.parse(body) : body;
if (idempotencyKey && payload.idempotencyKey && idempotencyKey !== payload.idempotencyKey) {
  throw new Error('Idempotency key mismatch');
}

return [{ json: { ...payload, verified: true } }];`;

export const HTTP_POST_JSON = `const http = require('http');
const https = require('https');

function parseHttpUrl(targetUrl) {
  const raw = String(targetUrl);
  const protocol = raw.startsWith('https:') ? 'https:' : 'http:';
  const withoutProtocol = raw.replace(/^https?:\\/\\//, '');
  const slash = withoutProtocol.indexOf('/');
  const hostPort = slash === -1 ? withoutProtocol : withoutProtocol.slice(0, slash);
  const path = slash === -1 ? '/' : withoutProtocol.slice(slash);
  const colon = hostPort.lastIndexOf(':');
  const hostname = colon === -1 ? hostPort : hostPort.slice(0, colon);
  const port = colon === -1 ? (protocol === 'https:' ? 443 : 80) : Number(hostPort.slice(colon + 1));
  return { protocol, hostname, port, path };
}

function postJson(targetUrl, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const parsed = parseHttpUrl(targetUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
`;

export const DELIVER_ALERT = `${HTTP_POST_JSON}
const item = $input.first().json;
const mailpit = $env.BIZOS_OPS_MAILPIT_URL;
const webhook = $env.BIZOS_OPS_ALERT_WEBHOOK_URL;
const to = $env.BIZOS_OPS_ALERT_EMAIL || 'ops@bizos.local';
const from = $env.BIZOS_OPS_ALERT_FROM || 'n8n@bizos.local';
const title = item.title || '[bizOS] alert';
const message = item.message || JSON.stringify(item);
const severity = item.severity || (item.channel === 'ops-urgent' ? 'high' : 'medium');

async function deliver() {
  if (mailpit) {
    const url = String(mailpit).replace(/\\/$/, '') + '/api/v1/send';
    const response = await postJson(url, {
      From: { Email: from, Name: 'bizOS n8n' },
      To: [{ Email: to }],
      Subject: title,
      Text: String(severity).toUpperCase() + '\\n\\n' + message,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error('Mailpit send failed: ' + response.status + ' ' + response.text);
    }
    return { deliveredVia: 'mailpit', status: 'delivered' };
  }
  if (webhook) {
    const response = await postJson(webhook, { ...item, title, message, severity });
    if (response.status < 200 || response.status >= 300) {
      throw new Error('Alert webhook failed: ' + response.status);
    }
    return { deliveredVia: 'webhook', status: 'delivered' };
  }
  return { deliveredVia: 'log', status: 'logged' };
}

const result = await deliver();
return [{ json: { ...item, ...result, deliveredAt: new Date().toISOString() } }];`;

export const FETCH_GITHUB_RUNS = `const https = require('https');

function getJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('GitHub API ' + res.statusCode + ': ' + text));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch {
          reject(new Error('GitHub API returned non-JSON: ' + text.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const token = $env.GITHUB_TOKEN;
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'bizos-n8n-github-poll',
};
if (token) {
  headers.Authorization = 'Bearer ' + token;
}

const payload = await getJson(
  'https://api.github.com/repos/pmwasim/bizOS/actions/runs?status=completed&per_page=10',
  headers,
);
return [{ json: payload }];`;
