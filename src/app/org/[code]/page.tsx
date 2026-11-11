import Link from 'next/link'
import { getLatestAnalysisWithDate, getBidsForTrend } from '@/lib/db'
import { LOW_SAMPLE_THRESHOLD } from '@/lib/types'
import { DistributionChart } from '../../components/DistributionChart'
import { DistributionTable } from '../../components/DistributionTable'
import { MethodTabs, methodHref, parseMethod } from '../../components/MethodTabs'
import { TrendChart } from '../../components/TrendChart'

interface Props {
  params: Promise<{ code: string }>
  searchParams: Promise<{ method?: string }>
}

export const dynamic = 'force-dynamic'

export default async function OrgDetailPage({ params, searchParams }: Props) {
  const { code } = await params
  const method = parseMethod((await searchParams).method)
  const [latest, trendData] = await Promise.all([
    getLatestAnalysisWithDate(),
    getBidsForTrend(method, { orgCode: code }),
  ])

  if (!latest) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-xl text-gray-500">분석 결과가 아직 없습니다</p>
      </div>
    )
  }

  const { snapshot, computedDate } = latest
  const result = snapshot.methods[method]
  const recs = result.recommendations[code] ?? []
  const top3 = recs.slice(0, 3)
  const top = top3[0]
  // 한 낙찰방법에만 공고가 있는 발주처도 탭을 옮길 수 있도록 404로 보내지 않는다
  const { bins, total } = result.byOrg[code] ?? { bins: [], total: 0 }
  const hasData = total > 0
  const orgName =
    result.orgNames?.[code] ??
    Object.values(snapshot.methods).find((r) => r.orgNames?.[code])?.orgNames?.[code] ??
    code

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={methodHref('/org', method)} className="text-sm text-blue-600 hover:underline">
          ← 발주처 목록
        </Link>
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold">{orgName}</h1>
        <span className="shrink-0 text-sm text-gray-400">{computedDate} 기준</span>
      </div>

      <MethodTabs path={`/org/${code}`} method={method} />

      {!hasData ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">
          <p className="text-lg">이 낙찰방법의 사정률 데이터가 없습니다</p>
        </div>
      ) : (
        <>
          {top && (
            <div className="rounded-lg border p-6 text-center">
              <p className="text-sm text-gray-500 mb-1">최빈 구간</p>
              <p className="text-5xl font-bold text-blue-600">{top.binStart.toFixed(2)}%</p>
              <p className="mt-2 text-lg text-gray-600">
                확률 {(top.probability * 100).toFixed(1)}%
              </p>
              {total < LOW_SAMPLE_THRESHOLD ? (
                <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-base font-medium text-amber-800">
                  표본 부족: 이 발주처는 {total}건뿐이라 전체 분포 위주로 계산한 값입니다
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  이 발주처 {total}건과 전체 분포를 함께 반영한 값입니다
                </p>
              )}
            </div>
          )}

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

          <div>
            <h2 className="text-lg font-semibold mb-2">이 발주처의 분포 ({total}건)</h2>
            <DistributionChart bins={bins} total={total} recommendations={recs} />
            <div className="mt-4">
              <DistributionTable bins={bins} total={total} recommendations={recs} />
            </div>
          </div>

          {trendData.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">사정률 추이 ({trendData.length}건)</h2>
              <TrendChart key={method} data={trendData} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
