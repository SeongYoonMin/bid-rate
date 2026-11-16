import Link from 'next/link'
import { getLatestAnalysisWithDate, getOrgCodesInRegion } from '@/lib/db'
import { HOME_REGION } from '@/lib/types'
import { MethodTabs, methodHref, parseMethod } from '../components/MethodTabs'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ method?: string }>
}

export default async function OrgListPage({ searchParams }: Props) {
  const method = parseMethod((await searchParams).method)
  // 전남광주 공사를 낸 발주처만 보여 준다 (docs/decisions.md)
  const [latest, orgCodes] = await Promise.all([
    getLatestAnalysisWithDate(),
    getOrgCodesInRegion(method, HOME_REGION),
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
    .filter(([code]) => orgCodes.has(code))
    .map(([code, dist]) => ({ code, name: result.orgNames?.[code] ?? code, total: dist.total }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">발주처별 분석</h1>
        <span className="text-sm text-gray-400">{computedDate} 기준</span>
      </div>

      <MethodTabs path="/org" method={method} />

      {orgs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{HOME_REGION} 공사를 낸 발주처가 없습니다</p>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            {HOME_REGION} 공사를 낸 발주처 {orgs.length}곳. 건수는 그 발주처의 전체 공고 수입니다.
          </p>
          <ul className="divide-y rounded-lg border">
            {orgs.map(({ code, name, total }) => (
              <li key={code}>
                <Link
                  href={methodHref(`/org/${code}`, method)}
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
