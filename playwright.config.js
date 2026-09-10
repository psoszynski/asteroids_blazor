import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/rendering', timeout: 60000, workers: 1,
    use: { baseURL: 'http://127.0.0.1:4179', headless: true,
        browserName: process.env.RENDER_BROWSER || 'chromium',
        launchOptions: { args: !process.env.RENDER_BROWSER || process.env.RENDER_BROWSER === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] } },
    webServer: { command: 'node scripts/rendering-server.mjs', url: 'http://127.0.0.1:4179', reuseExistingServer: !process.env.CI }
});
