import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
http.createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = pathname === '/baseline.js' && process.env.BASELINE_SOURCE
            ? process.env.BASELINE_SOURCE : path.resolve(root, `.${pathname === '/' ? '/tests/rendering/fixture.html' : pathname}`);
        if (!file.startsWith(root + path.sep) && file !== process.env.BASELINE_SOURCE) throw new Error('Forbidden');
        // Keep this development-only server scoped to renderer fixtures and static game assets.
        if (file !== process.env.BASELINE_SOURCE && !['tests/rendering/', 'wwwroot/'].some(p => file.startsWith(path.join(root, p)))) throw new Error('Forbidden');
        res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.end(await readFile(file));
    } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4179, '127.0.0.1', () => console.log('Renderer fixture: http://127.0.0.1:4179'));
