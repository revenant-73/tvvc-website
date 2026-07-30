const http = require('node:http');

const host = '127.0.0.1';
const port = 4322;
let checkoutCounter = 0;

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Request-Id': 'req_playwright_mock',
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
    checkoutCounter += 1;
    sendJson(response, 200, {
      id: `cs_test_playwright_${checkoutCounter}`,
      object: 'checkout.session',
      url: `http://${host}:${port}/mock-checkout/${checkoutCounter}`,
    });
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
