import Link from 'next/link'
import { getLatestAnalysisWithDate, getBidsForTrend } from '@/lib/db'
import { DistributionChart } from './components/DistributionChart'
import { TrendChart } from './components/TrendChart'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [latest, trendData] = await Promise.all([getLatestAnalysisWithDate(), getBidsForTrend()])

  if (!latest) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-xl text-gray-500">분석 결과가 아직 없습니다</p>
        <p className="mt-2 text-gray-400">데이터가 수집되면 자동으로 갱신됩니다</p>
      </div>
    )
  }

  const { result, computedDate } = latest
  const recs = result.recommendations['overall'] ?? []
  const top3 = recs.slice(0, 3)
  const top = top3[0]

  const { bins, total } = result.overall
  const hasData = total > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">오늘의 추천</h1>
        <span className="text-sm text-gray-400">{computedDate} 기준</span>
      </div>

      {!hasData ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">
          <p className="text-lg">사정률 데이터가 아직 없습니다</p>
          <p className="mt-1 text-sm text-gray-400">나라장터 데이터가 수집되면 분포가 표시됩니다</p>
        </div>
      ) : (
        <>
          {/* 핵심 추천 */}
          {top && (
            <div className="rounded-lg border p-6 text-center">
              <p className="text-sm text-gray-500 mb-1">최빈 구간</p>
              <p className="text-5xl font-bold text-blue-600">{top.binStart.toFixed(2)}%</p>
              <p className="mt-2 text-lg text-gray-600">
                확률 {(top.probability * 100).toFixed(1)}%
              </p>
            </div>
          )}

          {/* 상위 3개 구간 카드 */}
          {top3.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {top3.map((rec, i) => (
                <div
                  key={rec.binStart}
                  className={`rounded-lg border p-4 text-center ${i === 0 ? 'bg-blue-50 border-blue-200' : ''}`}
                >
                  <p className="text-sm text-gray-500">{i + 1}순위</p>
                  <p className="text-2xl font-bold">{rec.binStart.toFixed(2)}%</p>
                  <p className="text-sm text-gray-600">{(rec.probability * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}

          {/* 분포 차트 */}
          <div>
            <h2 className="text-lg font-semibold mb-2">전체 분포 ({total}건)</h2>
            <DistributionChart bins={bins} total={total} recommendations={recs} />
          </div>

          {/* 추이 차트 */}
          {trendData.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">사정률 추이 ({trendData.length}건)</h2>
              <TrendChart data={trendData} />
            </div>
          )}
        </>
      )}

      {/* 발주처 목록 링크 */}
      <Link
        href="/org"
        className="block rounded-lg border p-4 text-center text-blue-600 hover:bg-blue-50"
      >
        발주처별 분석 보기 →
      </Link>
    </div>
  )
}
