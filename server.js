
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── PUT YOUR API KEY HERE ───────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
// ────────────────────────────────────────────────────────────────────────────

const PORT = 3000;

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }


  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); }
      catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const payload = JSON.stringify({
        model:      parsed.model      || 'claude-sonnet-4-6',
        max_tokens: parsed.max_tokens || 1024,
        stream:     true,
        messages:   parsed.messages,
      });

      const options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length':  Buffer.byteLength(payload),
        },
      };

      // Stream Anthropic's SSE response straight back to the browser
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      });

      const apiReq = https.request(options, apiRes => {
        apiRes.on('data', chunk => res.write(chunk));
        apiRes.on('end', () => res.end());
      });

      apiReq.on('error', err => {
        console.error('Anthropic API error:', err.message);
        res.end(`data: {"type":"error","error":{"message":"${err.message}"}}\n\n`);
      });

      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  // ── Static file server: serve index.html and assets ──
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅  SymptomSense running at http://localhost:${PORT}\n`);
  if (ANTHROPIC_API_KEY === '') {
    console.warn('⚠️  No API key set!\n');
  }
});
