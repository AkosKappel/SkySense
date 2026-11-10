import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	// The recorded Open-Meteo responses, so tests never depend on the live API or today's weather.
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		env: { SKYSENSE_FIXTURES: '1' }
	},
	use: { baseURL: 'http://localhost:4173', locale: 'en-GB' },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	]
});
