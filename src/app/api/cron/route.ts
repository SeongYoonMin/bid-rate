import { NextRequest, NextResponse } from 'next/server'
import { collectAndRecompute } from '@/lib/orchestrate'

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET 미설정' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 })
  }

  const start = Date.now()
  try {
    const { bidsCount } = await collectAndRecompute()
    const elapsed = Date.now() - start
    return NextResponse.json({ ok: true, bidsCount, elapsed })
  } catch (e) {
    const elapsed = Date.now() - start
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron] collectAndRecompute 실패:', message)
    return NextResponse.json({ ok: false, error: message, elapsed }, { status: 500 })
  }
}
