import { build } from 'esbuild';
import { mkdir, readdir, unlink, rm } from 'node:fs/promises';
const outdir = 'wwwroot/js/dist';
await mkdir(outdir, { recursive: true });
await rm(`${outdir}/chunks`, { recursive: true, force: true });
// Remove obsolete content-hashed chunks so publish does not accumulate old bundles.
for (const file of await readdir(outdir)) {
    if (/\.(js|map)$/.test(file)) await unlink(`${outdir}/${file}`);
}
await build({
    entryPoints: { rendering: 'wwwroot/js/rendering/renderer-host.js' },
    outdir, bundle: true, splitting: true, format: 'esm', minify: true,
    target: ['es2022'], chunkNames: 'chunks/[name]-[hash]', logLevel: 'info'
});
