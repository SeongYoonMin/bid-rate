import type { Prediction } from '@/lib/types'

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
const percent = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`

export function PredictionCard({ prediction }: { prediction: Prediction }) {
  const { low, high, mean, sd, backtest } = prediction
  const { evaluated, hits, baselineHits } = backtest

  return (
    <div className="rounded-lg border p-6">
      <p className="text-center text-sm text-gray-500">다음 사정률 예상 범위 (참고)</p>
      <p className="mt-1 text-center text-3xl font-bold">
        {signed(low)} ~ {signed(high)}
      </p>
      <p className="mt-1 text-center text-base text-gray-600">
        평균 {signed(mean)}, 표준편차 {sd.toFixed(2)}%p
      </p>

      {evaluated > 0 ? (
        <div className="mt-4 rounded bg-gray-50 p-3 text-center">
          <p className="text-sm text-gray-500">지난 공고로 확인한 적중률</p>
          <p className="text-2xl font-bold text-blue-600">{percent(hits, evaluated)}</p>
          <p className="mt-1 text-sm text-gray-600">
            {evaluated}건 중 {hits}건이 범위 안 (각 공고 이전 자료로만 계산)
          </p>
          <p className="text-sm text-gray-600">
            같은 폭을 0% 중심으로 잡으면 {percent(baselineHits, evaluated)}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded bg-amber-50 p-3 text-center text-base text-amber-800">
          공고가 적어 아직 적중률을 계산하지 못했습니다
        </p>
      )}

      <p className="mt-3 text-center text-sm text-gray-500">
        지금까지의 분포를 보여 주는 값이며, 다음 공고의 값을 맞히는 예측이 아닙니다.
      </p>
    </div>
  )
}
