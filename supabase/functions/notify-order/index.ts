const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function escStr(s: string): string {
  let out = '"'
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if      (c === 0x22) out += '\\"'
    else if (c === 0x5C) out += '\\\\'
    else if (c === 0x0A) out += '\\n'
    else if (c === 0x0D) out += '\\r'
    else if (c < 0x20)   out += '\\u' + c.toString(16).padStart(4, '0')
    else if (c < 0x80)   out += s[i]
    else                 out += '\\u' + c.toString(16).padStart(4, '0')
  }
  return out + '"'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const chatId   = Deno.env.get('TELEGRAM_CHAT_ID')
    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ error: 'Missing TELEGRAM config' }), { status: 500, headers: CORS })
    }

    const order = await req.json()

    const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + ' \u20ab'
    const items = (order.items || [])
      .map((i: { name: string; qty: number }) => `${i.name} \u00d7${i.qty}`)
      .join(', ')

    const lines = [
      `\ud83e\uddfe <b>\u0110\u01a1n ${order.order_num || ''}</b>`,
      `\ud83d\udcb0 ${fmt(order.total || 0)}`,
      `\ud83d\udcb3 ${order.method || ''}`,
      order.discount_amount ? `\ud83c\udff7 Chi\u1ebft kh\u1ea5u: ${fmt(order.discount_amount)}` : null,
      order.staff_name      ? `\ud83d\udc64 ${order.staff_name}` : null,
      items                 ? `\ud83d\udccb ${items}` : null,
    ].filter(Boolean).join('\n')

    const tgBody = `{"chat_id":${escStr(chatId)},"text":${escStr(lines)},"parse_mode":"HTML"}`
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: tgBody,
    })

    const tgData = await tgRes.json()
    if (!tgRes.ok) throw new Error(tgData.description || 'Telegram error')

    return new Response(JSON.stringify({ ok: true }), { headers: CORS })
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: CORS }
    )
  }
})
