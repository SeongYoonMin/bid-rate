// 나라장터 과거 공고 중 전남광주 공고만 모아 저장한다 (docs/decisions.md 2026-11-11).
// 1) 입찰공고 검색을 7일 단위로 받아 전남광주 공고를 고른다
// 2) 고른 공고만 예비가격상세를 받아 저장한다
// 호출 한도에 걸리면 진행 상태를 남기고 멈춘다. 다음 날 같은 명령으로 이어 받는다.
// 사용법: pnpm backfill:g2b [시작일 YYYY-MM-DD] [끝일 YYYY-MM-DD]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fetchG2bBidForNotice, fetchG2bNotices, type G2bNotice } from '../src/lib/collect/g2b'
import { getCompleteBidIds, saveRawResponse, upsertBids } from '../src/lib/db'
import { recomputeAll } from '../src/lib/orchestrate'
import { ANALYSIS_METHODS, HOME_REGION } from '../src/lib/types'

const DEFAULT_FROM = '2024-11-11' // 2년 전
const DEFAULT_TO = '2026-08-30' // 2026-08-31 이후는 이미 수집됨
const WINDOW_DAYS = 7 // 입찰공고 검색의 조회 기간 상한 (1개월은 범위 초과 오류)
const DELAY_MS = 200
const STATE_DIR = '.backfill'
const STATE_FILE = `${STATE_DIR}/g2b.json`

interface State {
  from: string
  to: string
  doneWindows: string[] // 받은 기간의 시작일
  notices: Record<string, G2bNotice> // 고른 전남광주 공고
  finished: string[] // 예비가격상세까지 처리한 공고 (저장했거나 15행 미만)
}

class LimitError extends Error {}

/** 분석하는 낙찰방법만 예비가격상세를 받아 호출을 아낀다. 2024년 옛 형식 공고는 "공고서참조"라 빠진다. */
const ANALYZED: readonly string[] = ANALYSIS_METHODS
const isAnalyzed = (notice: G2bNotice) => ANALYZED.includes(notice.bidMethod)

async function main() {
  process.loadEnvFile('.env')
  const g2bKey = process.env.G2B_API_KEY
  const g2bBidKey = process.env.G2B_BID_API_KEY
  if (!g2bKey || !g2bBidKey) throw new Error('G2B_API_KEY, G2B_BID_API_KEY 환경변수가 필요합니다.')

  const from = process.argv[2] ?? DEFAULT_FROM
  const to = process.argv[3] ?? DEFAULT_TO
  const state = loadState(from, to)
  const save = () => writeFileSync(STATE_FILE, JSON.stringify(state))

  // 원본 저장은 기다렸다가 끝낸다 (끝나기 전에 프로세스가 종료되지 않도록)
  const pending: Promise<void>[] = []
  const onRawResponse = (endpoint: string, params: Record<string, string>, body: unknown) => {
    pending.push(
      saveRawResponse('g2b', endpoint, params, body).catch((e) =>
        console.warn('원본 저장 실패:', e instanceof Error ? e.message : e),
      ),
    )
  }

  let stoppedByLimit = false
  let saved = 0
  try {
    // 1단계: 기간별 공고 목록
    const windows = makeWindows(from, to)
    for (const [begin, end] of windows) {
      if (state.doneWindows.includes(begin)) continue
      const notices = await callWithLimit(() =>
        fetchG2bNotices(g2bBidKey, `${compact(begin)}0000`, `${compact(end)}2359`, {
          region: HOME_REGION,
          onRawResponse,
        }),
      )
      for (const notice of notices) state.notices[notice.bidNtceNo] = notice
      state.doneWindows.push(begin)
      save()
      await delay(DELAY_MS)
    }
    console.log(
      `공고 목록: 기간 ${state.doneWindows.length}/${windows.length}, 전남광주 공고 ${Object.keys(state.notices).length}건`,
    )

    // 2단계: 아직 처리하지 않은 공고의 예비가격상세
    const finished = new Set(state.finished)
    const candidates = Object.values(state.notices).filter(
      (n) => isAnalyzed(n) && !finished.has(n.bidNtceNo),
    )
    const complete = await getCompleteBidIds(candidates.map((n) => n.bidNtceNo))
    for (const id of complete) state.finished.push(id)
    const targets = candidates.filter((n) => !complete.has(n.bidNtceNo))
    console.log(
      `예비가격상세 대상 ${targets.length}건 (이미 저장된 공고 ${complete.size}건 건너뜀)`,
    )

    for (const notice of targets) {
      const bid = await callWithLimit(() => fetchG2bBidForNotice(g2bKey, notice, onRawResponse))
      if (bid) {
        await upsertBids([bid])
        saved++
      }
      state.finished.push(notice.bidNtceNo)
      save()
      await delay(DELAY_MS)
    }
  } catch (e) {
    if (!(e instanceof LimitError)) throw e
    stoppedByLimit = true
  } finally {
    save()
    await Promise.all(pending)
  }

  const done = new Set(state.finished)
  const remaining = Object.values(state.notices).filter(
    (n) => isAnalyzed(n) && !done.has(n.bidNtceNo),
  ).length
  console.log(
    `이번 실행 저장 ${saved}건, 남은 공고 ${remaining}건${stoppedByLimit ? ', 호출 한도로 멈춤 (내일 다시 실행)' : ''}`,
  )
  if (saved > 0) {
    await recomputeAll()
    console.log('재분석 완료')
  }
}

/** 호출 한도 오류(HTTP 429, 서비스 요청 제한 코드 22)는 LimitError로 바꾼다 */
async function callWithLimit<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (/HTTP 429|code: 22|LIMITED_NUMBER/.test(message)) throw new LimitError(message)
    throw e
  }
}

function loadState(from: string, to: string): State {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR)
  if (!existsSync(STATE_FILE)) return { from, to, doneWindows: [], notices: {}, finished: [] }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State
  if (state.from !== from || state.to !== to) {
    throw new Error(
      `진행 중인 수집 기간(${state.from}~${state.to})과 다릅니다. 새로 시작하려면 ${STATE_FILE}을 지우세요.`,
    )
  }
  return state
}

/** [시작일, 끝일] 7일 단위 목록 (YYYY-MM-DD, 끝일 포함) */
function makeWindows(from: string, to: string): [string, string][] {
  const windows: [string, string][] = []
  const last = Date.parse(`${to}T00:00:00Z`)
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= last; t += WINDOW_DAYS * 86400000) {
    const end = Math.min(t + (WINDOW_DAYS - 1) * 86400000, last)
    windows.push([toYmd(t), toYmd(end)])
  }
  return windows
}

const toYmd = (t: number) => new Date(t).toISOString().slice(0, 10)
const compact = (ymd: string) => ymd.replaceAll('-', '')
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

main().catch((e) => {
  console.error('수집 실패:', e instanceof Error ? e.message : e)
  process.exit(1)
})
