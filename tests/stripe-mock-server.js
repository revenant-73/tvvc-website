const http = require('node:http');

const host = '127.0.0.1';
const port = 4322;
let checkoutCounter = 0;
const checkoutSessions = new Map();

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Request-Id': 'req_playwright_mock',
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
    const requestBody = await readRequestBody(request);
    const params = new URLSearchParams(requestBody);
    checkoutCounter += 1;
    const sessionId = `cs_test_playwright_${checkoutCounter}`;
    const expiresAt = Number(params.get('expires_at'));
    checkoutSessions.set(sessionId, { expires_at: expiresAt });
    sendJson(response, 200, {
      id: sessionId,
      object: 'checkout.session',
      expires_at: expiresAt,
      url: `http://${host}:${port}/mock-checkout/${checkoutCounter}`,
    });
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/test/checkout-sessions/')) {
    const sessionId = url.pathname.split('/').pop();
    const session = checkoutSessions.get(sessionId);
    sendJson(response, session ? 200 : 404, session || { error: 'Session not found' });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/billing_portal/sessions') {
    sendJson(response, 200, {
      id: 'bps_playwright',
      object: 'billing_portal.session',
      url: `http://${host}:${port}/mock-billing`,
    });
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/v1/checkout/sessions/')) {
    const sessionId = url.pathname.split('/').pop();
    sendJson(response, 200, {
      id: sessionId,
      object: 'checkout.session',
      payment_intent: {
        id: 'pi_playwright',
        object: 'payment_intent',
        latest_charge: {
          id: 'ch_playwright',
          object: 'charge',
          receipt_url: `http://${host}:${port}/mock-receipt/${sessionId}`,
        },
      },
    });
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/mock-')) {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<html><body><h1>${url.pathname}</h1></body></html>`);
    return;
  }

  sendJson(response, 404, {
    error: {
      type: 'invalid_request_error',
      message: `Unhandled Stripe mock route: ${request.method} ${url.pathname}`,
    },
  });
});

server.listen(port, host, () => {
  console.log(`Stripe mock listening at http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
