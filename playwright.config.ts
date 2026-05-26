import { defineConfig, devices } from '@playwright/test'

const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 5193)
const webUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${webPort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: webUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev:web -- --port ${webPort} --strictPort`,
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
