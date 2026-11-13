// First run: four steps, then Today shows the chosen program at the chosen place.
// Run `npm run build` first, then:
//   PLAYWRIGHT_PATH=/path/to/playwright node tests/e2e/onboarding.e2e.cjs
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const PORT = 4186
const URL = `http://localhost:${PORT}`
const shot = process.env.SHOT_DIR

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 2500))
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.route('**/*.supabase.co/**', (route) => route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(URL)
    await page.evaluate(() => localStorage.setItem('gg.user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000009', email: 'new@example.com' })))
    await page.reload()
    await page.evaluate(() => navigator.serviceWorker.ready)
    // With no connection the app does not wait for a first sync before asking.
    await context.setOffline(true)
    await page.reload().catch(() => undefined)

    await page.getByRole('heading', { name: 'First, about you' }).waitFor({ timeout: 15000 })
    await page.getByRole('textbox').fill('Sam')
    if (shot) await page.screenshot({ path: `${shot}/ob-1.png` })
    await page.getByRole('button', { name: 'Next' }).click()

    await page.getByRole('heading', { name: 'What are you training for?' }).waitFor()
    await page.getByRole('button', { name: 'Build muscle' }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()
    await page.getByText('Full body', { exact: true }).waitFor()
    if (shot) await page.screenshot({ path: `${shot}/ob-2.png` })
    await page.getByRole('button', { name: 'Next' }).click()

    await page.getByRole('heading', { name: 'Where do you train?' }).waitFor()
    for (const gone of ['Barbell', 'Smith bar', 'Cable', 'Landmine']) await page.getByRole('button', { name: gone, exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Next' }).isDisabled(), true, 'the pull-up question must be answered')
    await page.getByRole('button', { name: 'Not yet' }).click()
    if (shot) await page.screenshot({ path: `${shot}/ob-3.png` })
    await page.getByRole('button', { name: 'Next' }).click()

    await page.getByRole('heading', { name: 'Who do you train with?' }).waitFor()
    await page.getByRole('button', { name: /On my own for now/ }).click()
    if (shot) await page.screenshot({ path: `${shot}/ob-4.png` })
    await page.getByRole('button', { name: 'Start training' }).click()

    // Today: the recommended program, adapted to a dumbbell-only home gym.
    await page.getByRole('heading', { name: 'Full Body 1' }).waitFor()
    await page.getByText('Evening, Sam').or(page.getByText('Morning, Sam')).or(page.getByText('Afternoon, Sam')).waitFor()
    await page.getByText(/Adapted for Home gym/).waitFor()
    if (shot) await page.screenshot({ path: `${shot}/ob-5.png` })
    assert.deepEqual(errors, [], 'no errors on the page')
    console.log('onboarding e2e passed: four steps, program and place applied')
  } finally {
    await browser.close()
    server.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
