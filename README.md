# 사정률 분석 서비스

전기공사 입찰의 **다음 사정률로 가장 가능성 높은 구간과 신뢰도**를 매일 오전 8시에 갱신해 보여주는 웹 서비스.

## 기술 스택

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS 4
- **Test**: Vitest
- **Linter/Formatter**: ESLint + Prettier

## 시작하기

```bash
pnpm install
cp .env.example .env.local  # API 키 설정
pnpm dev
```

## 스크립트

| 명령어 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 (Turbopack) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm test` | 테스트 실행 |
| `pnpm lint` | ESLint 검사 |
| `pnpm format` | Prettier 포맷 적용 |
| `pnpm format:check` | 포맷 검사만 |

## 프로젝트 구조

```
src/
├── app/           # Next.js App Router (페이지, API)
│   └── api/       # 엑셀 업로드, cron 진입점
├── lib/
│   ├── analysis/  # 순수 계산 로직 (사정률, 분포, 추천)
│   └── collect/   # 출처별 수집기 + Bid 변환
docs/
├── domain.md      # 용어, 계산식, 필드 매핑
├── design.md      # 설계 문서
├── test-cases.md  # 테스트 케이스
└── decisions.md   # 결정 기록
```

## 데이터 출처

- 한전 전자입찰 계약정보 API
- 나라장터 Open API
- 엑셀 업로드 (전기넷 등에서 수동 다운로드)

## 환경 변수

`.env.example` 참고. `NEXT_PUBLIC_` 접두사는 사용하지 않는다.
