import { Request, Response, NextFunction } from 'express';
import http from 'node:http';
import https from 'node:https';

/** Proxy only the dedicated sales URL space; rental auth and data stay separate. */
export function salesProxy(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.SALES_SERVICE_URL;
  if (!configured) return res.status(503).json({ error: 'Sales workspace is not configured.' });
  let target: URL;
  try { target = new URL(configured); }
  catch { return res.status(503).json({ error: 'Sales workspace is not configured.' }); }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/')
    return res.status(503).json({ error: 'Invalid sales service configuration.' });
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host: target.host };
  for (const name of ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']) delete headers[name];
  // These headers are generated here, never trusted from the incoming request.
  headers['x-forwarded-host'] = req.get('host') || '';
  headers['x-forwarded-proto'] = req.get('x-forwarded-proto') === 'https' ? 'https' : req.protocol;
  headers['x-forwarded-for'] = req.ip || req.socket.remoteAddress || '';
  const transport = target.protocol === 'https:' ? https : http;
  const upstream = transport.request({ hostname: target.hostname, port: target.port || (target.protocol === 'https:' ? 443 : 80), path: req.originalUrl, method: req.method, headers, timeout: 30000 }, (response) => {
    res.status(response.statusCode || 502);
    for (const [name, value] of Object.entries(response.headers))
      if (value !== undefined && !['connection', 'keep-alive', 'transfer-encoding'].includes(name.toLowerCase())) res.setHeader(name, value);
    response.on('error', () => res.destroy());
    response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('Sales service timeout')));
  upstream.on('error', () => { if (!res.headersSent) res.status(502).json({ error: 'Sales workspace is temporarily unavailable.' }); else res.destroy(); });
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
  req.pipe(upstream);
}
