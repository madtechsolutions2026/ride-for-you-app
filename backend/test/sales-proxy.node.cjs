const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { salesProxy } = require('../dist/middleware/sales-proxy');

test('sales prefix streams requests, cookies and PDF bytes without changing rental routes', async () => {
  const seen = [];
  const upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', x => body += x);
    req.on('end', () => {
      seen.push({ path: req.url, body, cookie: req.headers.cookie, host: req.headers.host });
      if (req.url === '/sales') { res.writeHead(308, { Location: '/sales/' }); return res.end(); }
      if (req.url.endsWith('/pdf')) { res.setHeader('Content-Type', 'application/pdf'); return res.end(Buffer.from('%PDF-test')); }
      res.setHeader('Set-Cookie', 'rfy_sales=test; Path=/sales/; Secure; HttpOnly; SameSite=Strict');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ received: body.length }));
    });
  });
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  const original = process.env.SALES_SERVICE_URL;
  process.env.SALES_SERVICE_URL = `http://127.0.0.1:${upstream.address().port}`;
  const app = express();
  app.use('/sales', salesProxy);
  app.get('/auth/check', (_req,res) => res.json({ rental: true }));
  app.use((_req,res) => res.status(404).end());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const redirect = await fetch(base + '/sales', { redirect: 'manual' });
    assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/sales/');
    const payload = JSON.stringify({ csv: 'x'.repeat(300000) });
    const response = await fetch(base + '/sales/api/import?preview=1', { method: 'POST', headers: { 'Content-Type':'application/json', Cookie:'rfy_sales=test' }, body:payload });
    assert.equal(response.status, 200); assert.equal((await response.json()).received, payload.length);
    assert(response.headers.get('set-cookie').includes('Path=/sales/'));
    assert.equal(seen.at(-1).path,'/sales/api/import?preview=1'); assert.equal(seen.at(-1).cookie,'rfy_sales=test'); assert.equal(seen.at(-1).body,payload);
    const pdf = await fetch(base + '/sales/api/invoices/id/pdf'); assert.equal(pdf.headers.get('content-type'),'application/pdf'); assert.equal(await pdf.text(),'%PDF-test');
    assert.deepEqual(await (await fetch(base + '/auth/check')).json(),{rental:true});
    assert.equal((await fetch(base + '/sales-other')).status,404);
    delete process.env.SALES_SERVICE_URL; assert.equal((await fetch(base + '/sales/')).status,503);
  } finally {
    if(original===undefined)delete process.env.SALES_SERVICE_URL;else process.env.SALES_SERVICE_URL=original;
    await new Promise(r=>server.close(r)); await new Promise(r=>upstream.close(r));
  }
});
