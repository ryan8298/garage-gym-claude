// Creates an account for someone holding a valid invitation and puts them in
// the inviter's group. Accounts cannot be created any other way: the database
// refuses a new user that this function has not marked as invited.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = (await req.json()) as { code?: string; email?: string; password?: string; name?: string }
    const code = (body.code ?? '').trim().toUpperCase()
    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''
    const name = (body.name ?? '').trim().slice(0, 40)
    if (!/^[A-Z0-9]{8}$/.test(code)) return json({ error: 'Check the invitation code: it is 8 letters and numbers.' }, 400)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400)
    if (password.length < 8) return json({ error: 'Choose a password of at least 8 characters.' }, 400)
    if (name.length < 1) return json({ error: 'Enter your name.' }, 400)

    const { data: invite } = await admin.from('invites').select('code, group_id, used_at, expires_at').eq('code', code).maybeSingle()
    if (!invite || invite.used_at || Date.parse(invite.expires_at as string) < Date.now()) return json({ error: 'That invitation is not valid any more. Ask for a new one.' }, 400)
    const { count } = await admin.from('group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', invite.group_id)
    if ((count ?? 0) >= 6) return json({ error: 'That group is full.' }, 400)

    // Claim the invitation first, so one code can never make two accounts.
    const { data: claimed } = await admin.from('invites').update({ used_at: new Date().toISOString() }).eq('code', code).is('used_at', null).select('code')
    if (!claimed?.length) return json({ error: 'That invitation has just been used.' }, 400)

    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { invited: true }, user_metadata: { display_name: name } })
    if (error || !created.user) {
      await admin.from('invites').update({ used_at: null }).eq('code', code)
      const taken = /already|registered|exists/i.test(error?.message ?? '')
      return json({ error: taken ? 'There is already an account with that email. Sign in, then enter the code in Settings.' : 'The account could not be created. Try again.' }, 400)
    }
    await admin.from('group_members').insert({ group_id: invite.group_id, user_id: created.user.id })
    await admin.from('invites').update({ used_by: created.user.id }).eq('code', code)
    return json({ ok: true })
  } catch {
    return json({ error: 'The account could not be created. Try again.' }, 500)
  }
})
