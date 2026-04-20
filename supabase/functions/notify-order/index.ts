const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + ' ₫'
    const items = (order.items || [])
      .map((i: { name: string; qty: number }) => `${i.name} ×${i.qty}`)
      .join(', ')

    const lines = [
      `🧾 <b>Đơn ${order.order_num || ''}</b>`,
      `💰 ${fmt(order.total || 0)}`,
      `💳 ${order.method || ''}`,
      order.discount_amount ? `🏷 Chiết khấu: ${fmt(order.discount_amount)}` : null,
      order.staff_name      ? `👤 ${order.staff_name}` : null,
      items                 ? `📋 ${items}` : null,
    ].filter(Boolean).join('\n')

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines, parse_mode: 'HTML' }),
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
