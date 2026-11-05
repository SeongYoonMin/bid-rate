'use client'

import { useState } from 'react'
import { ResponsiveLine, type DefaultSeries, type LineCustomSvgLayerProps } from '@nivo/line'

export interface TrendPoint {
  date: string
  rate: number
  sourceId: string
  name: string
}

interface Props {
  data: TrendPoint[]
}

const PAGE_SIZE = 100

/** N건 이동평균 계산 */
function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += values[j]
    return sum / window
  })
}

/** N건 이동 표준편차 계산 */
function movingStd(values: number[], window: number): (number | null)[] {
  const ma = movingAverage(values, window)
  return values.map((_, i) => {
    if (ma[i] === null) return null
    let sumSq = 0
    for (let j = i - window + 1; j <= i; j++) {
      const diff = values[j] - ma[i]!
      sumSq += diff * diff
    }
    return Math.sqrt(sumSq / window)
  })
}

export function TrendChart({ data }: Props) {
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const [page, setPage] = useState(totalPages - 1) // 최근 페이지부터

  // 전체 데이터로 MA/밴드 계산 (페이지 경계에서도 연속)
  const allRates = data.map((d) => (d.rate - 1) * 100)
  const allMa5 = movingAverage(allRates, 5)
  const allMa10 = movingAverage(allRates, 10)
  const allStd10 = movingStd(allRates, 10)

  // 페이지 범위 슬라이스
  const start = page * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, data.length)
  const pageData = data.slice(start, end)
  const rates = allRates.slice(start, end)
  const ma5 = allMa5.slice(start, end)
  const ma10 = allMa10.slice(start, end)
  const std10 = allStd10.slice(start, end)

  const xStr = (i: number) => String(i + 1)

  const series: DefaultSeries[] = [
    {
      id: '사정률',
      data: rates.map((y, i) => ({ x: xStr(i), y: Number(y.toFixed(4)) })),
    },
    {
      id: 'MA5',
      data: ma5.map((y, i) => ({ x: xStr(i), y: y !== null ? Number(y.toFixed(4)) : null })),
    },
    {
      id: 'MA10',
      data: ma10.map((y, i) => ({ x: xStr(i), y: y !== null ? Number(y.toFixed(4)) : null })),
    },
    {
      id: '+2σ',
      data: ma10.map((y, i) => ({
        x: xStr(i),
        y: y !== null && std10[i] !== null ? Number((y + std10[i]! * 2).toFixed(4)) : null,
      })),
    },
    {
      id: '-2σ',
      data: ma10.map((y, i) => ({
        x: xStr(i),
        y: y !== null && std10[i] !== null ? Number((y - std10[i]! * 2).toFixed(4)) : null,
      })),
    },
  ]

  const count = pageData.length
  const step = count <= 20 ? 1 : count <= 50 ? 5 : 10
  const tickValues: number[] = []
  for (let i = 0; i < count; i += step) tickValues.push(i + 1)
  if (tickValues[tickValues.length - 1] !== count) tickValues.push(count)

  const BandLayer = ({ series: s }: LineCustomSvgLayerProps<DefaultSeries>) => {
    const upper = s.find((se: { id: string }) => se.id === '+2σ')
    const lower = s.find((se: { id: string }) => se.id === '-2σ')
    if (!upper || !lower) return null

    const coords: string[] = []
    const validUpper: { x: number; y: number }[] = []
    const validLower: { x: number; y: number }[] = []

    upper.data.forEach((d: { position: { x: number | null; y: number | null } }) => {
      if (d.position.x != null && d.position.y != null) {
        validUpper.push({ x: d.position.x, y: d.position.y })
      }
    })
    lower.data.forEach((d: { position: { x: number | null; y: number | null } }) => {
      if (d.position.x != null && d.position.y != null) {
        validLower.push({ x: d.position.x, y: d.position.y })
      }
    })

    if (validUpper.length === 0) return null

    validUpper.forEach((p) => coords.push(`${p.x},${p.y}`))
    ;[...validLower].reverse().forEach((p) => coords.push(`${p.x},${p.y}`))

    return <polygon points={coords.join(' ')} fill="#2563eb" fillOpacity={0.08} />
  }

  const colorMap: Record<string, string> = {
    사정률: '#ef4444',
    MA5: '#f59e0b',
    MA10: '#f59e0b',
    '+2σ': '#22c55e',
    '-2σ': '#3b82f6',
  }

  return (
    <div>
      {/* 페이징 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-sm rounded border disabled:opacity-30"
          >
            ← 이전
          </button>
          <span className="text-sm text-gray-500">
            {start + 1}–{Math.min(start + PAGE_SIZE, data.length)}건 / 총 {data.length}건
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1 text-sm rounded border disabled:opacity-30"
          >
            다음 →
          </button>
        </div>
      )}

      <div className="h-72 w-full">
        <ResponsiveLine
          data={series.filter((s) => s.data.some((d) => d.y !== null))}
          margin={{ top: 12, right: 80, bottom: 56, left: 56 }}
          xScale={{ type: 'linear', min: 1, max: count }}
          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          axisBottom={{
            tickValues,
            legend: '공고 순번',
            legendPosition: 'middle',
            legendOffset: 44,
            format: (v) => {
              const idx = Number(v) - 1
              return pageData[idx]?.date?.slice(5) ?? ''
            },
            tickRotation: -45,
          }}
          axisLeft={{
            legend: '사정률 (%)',
            legendPosition: 'middle',
            legendOffset: -48,
            format: (v) => `${v}%`,
          }}
          colors={(d) => colorMap[d.id as string] ?? '#999'}
          lineWidth={1.5}
          enablePoints
          pointSize={3}
          pointColor={{ from: 'serieColor' }}
          layers={[
            'grid',
            'markers',
            'axes',
            BandLayer,
            'lines',
            'points',
            'slices',
            'mesh',
            'legends',
            'crosshair',
          ]}
          useMesh
          tooltip={({ point }) => {
            const idx = Number(point.data.x) - 1
            const d = pageData[idx]
            if (!d) return null
            return (
              <div className="bg-white px-3 py-2 rounded shadow text-sm border whitespace-nowrap">
                <strong>{d.date}</strong> · 사정률: {point.data.yFormatted}%
                <br />
                공고번호 : {d.sourceId}
                <br />
                공고명 : {d.name}
              </div>
            )
          }}
          legends={[
            {
              anchor: 'right',
              direction: 'column',
              translateX: 80,
              itemWidth: 70,
              itemHeight: 18,
              symbolSize: 10,
              symbolShape: 'circle',
            },
          ]}
          theme={{
            crosshair: { line: { stroke: '#999', strokeDasharray: '4 4' } },
          }}
          animate={false}
        />
      </div>
    </div>
  )
}
