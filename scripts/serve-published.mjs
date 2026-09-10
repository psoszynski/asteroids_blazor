import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
const root = path.resolve(process.env.PUBLISH_ROOT || 'artifacts/publish/wwwroot');
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
    '.wasm':'application/wasm', '.png':'image/png', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
http.createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + path.sep)) throw new Error('Forbidden');
        res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
        res.end(await readFile(file));
    } catch { res.writeHead(404); res.end('Not found'); }
}).listen(5239, '127.0.0.1', () => console.log('Published game: http://127.0.0.1:5239'));
