# 단계별 프롬프트 모음

`[ ]` 부분을 채워서 사용한다. 단계 순서와 완료 기준은 "사정률 서비스 작업 시작 가이드" 문서를 따른다.

---

## 0단계 — 데이터 출처 확인 (data-inspector)

API 응답이나 엑셀을 `scratch/`에 넣은 뒤:

```
data-inspector 에이전트로 scratch/[파일명]을 확인해줘.
출처는 [나라장터 낙찰정보서비스 / 전기넷 엑셀]이야.
사정률을 계산할 수 있는지, 각 금액 필드가 실제로 무엇인지 값으로 확인해줘.
docs/domain.md는 아직 고치지 말고, 반영할 내용만 제안해줘.
```

→ 결과를 보고 **본인이** `docs/domain.md`에 반영

---

## 1단계 — 설계 리뷰 (design-reviewer)

`docs/design.md`를 본인이 먼저 채운다.

```
design-reviewer 에이전트로 docs/design.md를 리뷰해줘.
특히 [걱정되는 부분, 예: 한전 엑셀과 나라장터 API를 같은 Bid 형식으로 합치는 부분]을 봐줘.
```

→ 리뷰를 보고 **본인이** 결정 → `docs/decisions.md` "확정"에 기록

---

## 2단계 — 수집기 (implementer + add-collector)

```
implementer 에이전트로 [한전 / 나라장터] 수집기를 add-collector 절차대로 구현해줘.
범위: [예: toBid 변환과 테스트까지. fetch와 DB 저장은 다음 작업]
fixture: scratch/[샘플 파일]에서 공사 1건, 물품 1건을 뽑아서 키 없이 저장
```

---

## 3단계 — 분석 로직

테스트 케이스(`docs/test-cases.md` A 섹션)를 본인이 먼저 채운다.

```
test-writer 에이전트로 docs/test-cases.md의 [TC-A01 ~ TC-A06]을 테스트 코드로 만들어줘.
```

```
implementer 에이전트로 src/lib/analysis/[distribution.ts]를 구현해서 [TC-A02]를 통과시켜줘.
설계: docs/design.md의 "4. 분석 흐름"
```

실패가 나오면:
```
[TC-xxx]가 실패했어. 구현 버그인지 케이스 오류인지 코드를 근거로 설명만 해줘. 아직 고치지 마.
```

---

## 4단계 — 엑셀 업로드

```
implementer 에이전트로 엑셀 업로드를 구현해줘.
범위: 파일 받기 → toBid 변환 → 저장 → recomputeAll 호출. 결과로 받은 건수/저장/제외 사유를 보여주기
샘플: scratch/[전기넷 엑셀]
```

---

## 5단계 — 화면

화면 구성은 본인이 먼저 스케치(종이도 좋음)하고 결정한다.

```
implementer 에이전트로 [발주처 분석] 화면을 구현해줘.
구성: [사정률 추이 차트 + 0.25% 구간 분포표 + 추천 지점과 확률을 크게 표시]
원칙: CLAUDE.md "5. 화면 원칙"
범위 밖: [투찰금액 계산]
```

---

## 6단계 — 자동화·배포

```
implementer 에이전트로 매일 08:00 KST 수집·재계산을 [Vercel Cron / GitHub Actions]로 설정해줘.
cron 식은 UTC 기준(23:00)으로 쓰고, 실패 시 기존 결과를 유지하도록.
```

---

## 7단계 — 백테스트 (run-backtest)

```
run-backtest 절차대로 백테스트를 돌려줘.
k 값은 [10, 30, 60]으로 비교해줘. 어느 값을 쓸지는 내가 정할게.
```

---

## 단계 마무리 — 검증 (verifier)

```
verifier 에이전트로 [N단계 / 기능 이름] 변경 전체를 검증해줘.
```

→ 차단 이슈가 있으면 해당 단계로 돌아간다.
