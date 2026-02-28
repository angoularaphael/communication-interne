const http = require('http');
const https = require('https');
const env = require('../config/env');

function callProducts(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(env.PRODUCTS_SERVICE_URL);
    const transport = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': env.INTER_SERVICE_KEY
      }
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(parsed.error || `Products Service ${res.statusCode}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          resolve(parsed);
        } catch (_e) {
          reject(new Error('Réponse invalide du Products Service'));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Products Service injoignable: ${err.message}`)));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Products Service timeout (5s)')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getProduct(productId) {
  return callProducts('GET', `/internal/products/${productId}`);
}

module.exports = { getProduct };
