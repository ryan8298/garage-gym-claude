// The workout screen shows the song playing in Spotify and can skip it. Spotify itself is simulated.
// Run `npm run build` first, then:
//   PLAYWRIGHT_PATH=/path/to/playwright node tests/e2e/spotify.e2e.cjs
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const PORT = 4188
const URL = `http://localhost:${PORT}`

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 2500))
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.route('**/*.supabase.co/**', (route) => route.abort())
    const calls = []
    // Nothing is playing when the workout starts: the music comes later.
    let song = ''
    let playing = true
    await context.route('https://api.spotify.com/**', (route) => {
      const req = route.request()
      const path = new globalThis.URL(req.url()).pathname
      calls.push(`${req.method()} ${path}`)
      if (path.endsWith('/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ display_name: 'Ryan', product: 'premium' }) })
      if (path.endsWith('/next')) song = 'Second Song'
      if (path.endsWith('/play')) playing = true
      if (req.method() === 'GET' && song === '') return route.fulfill({ status: 204, body: '' })
      if (path.endsWith('/pause')) playing = false
      if (req.method() !== 'GET') return route.fulfill({ status: 204, body: '' })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ is_playing: playing, item: { name: song, artists: [{ name: 'Some Band' }], album: { images: [] } } }) })
    })
    let tokenBody = ''
    await context.route('https://accounts.spotify.com/api/token', (route) => {
      tokenBody = route.request().postData() ?? ''
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 }) })
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(URL)
    await page.evaluate(() => {
      localStorage.setItem('gg.user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', email: 'test@example.com' }))
      // As if the person had just been sent to Spotify from Settings.
      localStorage.setItem('gg.spotify.pending', JSON.stringify({ clientId: 'a'.repeat(32), verifier: 'v'.repeat(64) }))
    })

    // Spotify sends them back with a code: the app exchanges it and lands on Settings, connected.
    await page.goto(`${URL}/spotify?code=the-code`)
    await page.waitForURL('**/settings')
    await page.getByText('Connected. The song playing in Spotify').waitFor()
    await page.getByText('Connected as Ryan.').waitFor()
    assert.match(tokenBody, /grant_type=authorization_code/)
    assert.match(tokenBody, /code=the-code/)
    assert.match(tokenBody, /code_verifier=v{64}/)
    assert.doesNotMatch(tokenBody, /client_secret/, 'no secret is ever sent')

    await page.goto(URL)
    await page.getByRole('button', { name: 'Start workout' }).click()
    await page.waitForURL('**/session')
    await page.getByText('Nothing playing').waitFor()
    song = 'First Song'
    await page.getByText('First Song').waitFor({ timeout: 9000 })
    await page.getByText('Some Band').waitFor()
    await page.getByRole('button', { name: 'Next song' }).click()
    await page.getByText('Second Song').waitFor({ timeout: 8000 })
    await page.getByRole('button', { name: 'Pause music' }).click()
    await page.getByRole('button', { name: 'Play music' }).click()
    await page.getByRole('button', { name: 'Pause music' }).waitFor({ timeout: 8000 })
    assert.ok(calls.includes('POST /v1/me/player/next'))
    assert.ok(calls.includes('PUT /v1/me/player/pause'))

    // Disconnecting removes the bar.
    await page.evaluate(() => localStorage.removeItem('gg.spotify'))
    await page.reload()
    await page.getByRole('heading', { name: 'Barbell back squat' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Next song' }).count(), 0)
    assert.deepEqual(errors, [], 'no errors on the page')
    console.log('spotify e2e passed: connected, showed the song, skipped and paused')
  } finally {
    await browser.close()
    server.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
