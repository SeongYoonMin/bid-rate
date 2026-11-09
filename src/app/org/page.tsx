import Link from 'next/link'
import { getLatestAnalysisWithDate, getOrgCodesInRegion } from '@/lib/db'
import { ALL_REGIONS, HOME_REGION } from '@/lib/types'
import { MethodTabs, methodHref, parseMethod } from '../components/MethodTabs'
import { RegionFilter, RegionNotice } from '../components/RegionFilter'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ method?: string; region?: string }>
}

export default async function OrgListPage({ searchParams }: Props) {
  const params = await searchParams
  const method = parseMethod(params.method)
  // URL에 지역이 없으면 기본 지역, '전체'면 지역 구분 없이 본다
  const regionParam = params.region || undefined
  const region = regionParam ?? HOME_REGION
  const isAll = region === ALL_REGIONS
  const [latest, orgCodes] = await Promise.all([
    getLatestAnalysisWithDate(),
    isAll ? null : getOrgCodesInRegion(method, region),
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
  const orgs = Object.entries(result.byOrg)
    .filter(([code]) => !orgCodes || orgCodes.has(code))
    .map(([code, dist]) => ({ code, name: result.orgNames?.[code] ?? code, total: dist.total }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">발주처별 분석</h1>
        <span className="text-sm text-gray-400">{computedDate} 기준</span>
      </div>

      <MethodTabs path="/org" method={method} region={regionParam} />

      <RegionFilter
        path="/org"
        method={method}
        region={region}
        regions={result.regions ?? {}}
        total={result.overall.total}
      />

      <RegionNotice path="/org" method={method} region={region} />

      {orgs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {isAll ? '발주처 데이터가 없습니다' : `${region} 공사를 낸 발주처가 없습니다`}
        </p>
      ) : (
        <>
          {!isAll && (
            <p className="text-sm text-gray-500">
              {region} 공사를 낸 발주처 {orgs.length}곳. 건수는 그 발주처의 전체 공고 수입니다.
            </p>
          )}
          <ul className="divide-y rounded-lg border">
            {orgs.map(({ code, name, total }) => (
              <li key={code}>
                <Link
                  href={methodHref(`/org/${code}`, method, regionParam)}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
                >
                  <span className="font-medium">{name}</span>
                  <span className="shrink-0 text-sm text-gray-500">{total}건</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
