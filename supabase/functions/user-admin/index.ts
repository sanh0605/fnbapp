import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-service-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const url        = new URL(req.url)
  const pathSuffix = url.pathname.replace(/.*\/user-admin/, '') // '' | '/uuid' | '/migrate'

  try {
    // ── /migrate — one-time migration, requires service key ──
    if (req.method === 'POST' && pathSuffix === '/migrate') {
      if (req.headers.get('x-service-key') !== serviceKey) return err('Forbidden', 403)
      const { temp_password } = await req.json().catch(() => ({}))
      if (!temp_password) return err('temp_password required', 400)

      const { data: existing } = await admin
        .from('users').select('*').is('auth_id', null)

      const results = []
      for (const u of (existing || [])) {
        const email = `${u.username}@fnbapp.internal`
        const { data: au, error: e } = await admin.auth.admin.createUser({
          email, password: temp_password, email_confirm: true,
          user_metadata: { username: u.username, name: u.name },
        })
        if (e) { results.push({ username: u.username, error: e.message }); continue }
        await admin.from('users').update({
          auth_id: au.user.id, password_hash: 'supabase_auth'
        }).eq('id', u.id)
        results.push({ username: u.username, ok: true })
      }
      return ok(results)
    }

    // ── All other routes: verify JWT + owner role ──
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return err('Unauthorized', 401)

    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return err('Unauthorized', 401)

    const { data: profile } = await admin
      .from('users').select('role').eq('auth_id', user.id).single()
    if (profile?.role !== 'owner') return err('Forbidden', 403)

    const body = (req.method !== 'GET' && req.method !== 'DELETE')
      ? await req.json().catch(() => ({}))
      : {}

    // GET / — list users
    if (req.method === 'GET' && !pathSuffix) {
      const { data } = await admin.from('users').select('*').order('role').order('name')
      return ok(data)
    }

    // POST / — create user
    if (req.method === 'POST' && !pathSuffix) {
      const { name, username, password, role } = body
      if (!name || !username || !password || !role) return err('Missing fields', 400)

      const email = `${username.toLowerCase()}@fnbapp.internal`
      const { data: au, error: e } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { username: username.toLowerCase(), name },
      })
      if (e) return err(e.message, 400)

      await admin.from('users').insert({
        auth_id: au.user.id,
        username: username.toLowerCase(),
        name, role, active: true,
        password_hash: 'supabase_auth',
      })
      return ok({ ok: true })
    }

    // PATCH /:id — update (name, role, active) + optional password reset
    if (req.method === 'PATCH' && pathSuffix.startsWith('/')) {
      const id = pathSuffix.slice(1)
      const { name, role, active, password } = body

      const { data: target } = await admin
        .from('users').select('auth_id').eq('id', id).single()
      if (!target) return err('Not found', 404)

      if (password) {
        const { error: e } = await admin.auth.admin.updateUserById(target.auth_id, { password })
        if (e) return err(e.message, 400)
      }

      const upd: Record<string, unknown> = {}
      if (name   !== undefined) upd.name   = name
      if (role   !== undefined) upd.role   = role
      if (active !== undefined) upd.active = active
      if (Object.keys(upd).length) await admin.from('users').update(upd).eq('id', id)
      return ok({ ok: true })
    }

    // DELETE /:id
    if (req.method === 'DELETE' && pathSuffix.startsWith('/')) {
      const id = pathSuffix.slice(1)
      const { data: target } = await admin
        .from('users').select('auth_id').eq('id', id).single()
      if (!target) return err('Not found', 404)

      await admin.auth.admin.deleteUser(target.auth_id)
      await admin.from('users').delete().eq('id', id)
      return ok({ ok: true })
    }

    return err('Not found', 404)
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e), 500)
  }
})

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}
function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}
