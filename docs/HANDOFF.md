# HANDOFF — 다음 세션은 여기서부터 (2026-09-30 기준, 2차 세션 갱신)

순서: **이 문서 → `CLAUDE.md` → `docs/SPEC.md` → `docs/superpowers/plans/2026-09-30-beacon-nav.md` → `docs/RESEARCH.md`**.

- 브랜치: 기본 브랜치는 `main`(2026-09-30 대표님 결정 "main으로 하고 지금 브랜치들 main에 다 반영해 줘"). `feat/beacon-nav`·`claude/keen-babbage-u2ik3q`·`claude/lucid-noether-x1ufq3`는 `main`에 반영된 옛 작업 브랜치다(앞의 둘은 `main`의 조상, lucid-noether는 rebase되어 `955c30a`로 들어감).
- 원격: `https://github.com/kitavkdl/beacon` (**PUBLIC**). 푸시·배포는 외부 전송이므로 매번 무엇이 나가는지 보고한다.
- 대표님 요청 원문: "웹에 바로 배포까지 가능하도록 끝까지 쭉 진행". 사용자는 한국어, 호칭은 "대표님".

---

## 1. 한 줄 요약

**Task 1–6 완료(M1–M5). 앱이 브라우저에서 동작하고 `npm test`(10 files, 55+ tests)·`npm run build` 통과.
남은 것은 M6 배포 하나이며, 대표님 결정(§8) 대기.**

## 2. 이번 세션(2차)에 한 일

| Task | 결과 |
|---|---|
| 3 마무리 | `src/data/venue.ts`(타입 로더), `venue.test.ts`(id 유일·외곽 안·방 번호 금지·고도 순서), `docs/FLOORPLAN_TRACING.md` |
| 4 | `src/data/tour.ts`(정문→아트리움→북서 계단→2층 갤러리→3층 갤러리→복귀, 약 365 s 루프, 계단 1개 층 8 s), `tour.test.ts`(복도·계단·라운지 위로만, void 위 금지), `src/engine/evaluate.ts`(walk/standAt/score), `integration.test.ts`, `scripts/bench.ts` → `docs/benchmark-sim.md` + `src/data/bench.json` |
| 5 | `src/scene/Building.tsx`, `Markers.tsx`, `src/ui/Panel.tsx`, `src/App.tsx`, `src/styles.css`. 헤드리스 Chromium(swiftshader)으로 데스크톱·모바일 화면 확인 |
| 6 | `src/live/eddystone.ts`(+테스트 6개), `src/live/scanner.ts`(보안 컨텍스트→`navigator.bluetooth`→`requestLEScan` 순 기능 감지, 미지원 사유 표시) |
| 7 | README(영어), CLAUDE.md·RESEARCH.md §4 갱신, 전체 리뷰 서브에이전트 |

엔진 변경 2가지(테스트 포함):
- `Locator.setOptions`로 필터를 바꾸면 이제 **비콘 상태를 지우지 않고** 새 필터를 현재 값에서 다시 시작한다 → "No signal" 한 틱 깜빡임 없음.
- `Locator.heardBeacons(now)`: 신선한 비콘을 필터 RSSI 내림차순으로(패널 표용).

시뮬레이션 결과 요약(σ 4 dB, Kalman, 걷기): 가중 중심 중앙값 2.3 m / p90 4.9 m, 층 97.7%. **층 오판은 전부 계단 전환 직후 2–2.5 s**
(히스테리시스+필터 지연). 아트리움 갤러리에서 층이 뒤집힌 경우는 없었다. 자세한 해석은 RESEARCH.md §4.

화면 결정:
- 층을 시각적으로만 2.2배 벌려 그린다(`STACK_SCALE`, 데이터 고도는 그대로).
- 보기: Follow(현재 층만 진하게, 위층 숨김) / All / 1 / 2 / 3. 추정 위치 점과 실제 위치 링은 항상 맨 위에 그린다.
- 3D 텍스트는 CDN 폰트를 받지 않도록 drei `<Html>` 라벨만 쓴다.
- 번들: 단일 청크 ~1.2 MB(gzip ~340 KB), 대부분 three.js. 경고 한도만 올렸다.

## 3. 도면 원본에 대해

1차 세션 기록 그대로 유효. 도면 이미지는 커밋·배포하지 않는다. `docs/screenshot.png`는 트레이스한 도형을 렌더링한 앱 화면이라 도면 이미지가 아니다.

## 4. 도면·보정 — 내가 알아낸 사실 (다시 조사하지 말 것)

- **학교 사이트의 도면 이미지 URL은 2026-09-30 현재 404다.** 페이지(`/commcms/csbuilding/csbuilding-floor-plan`)는 링크를 걸고 있지만 파일이 없다.
- **Wayback Machine 원본은 받아진다** (2015-06-22 스냅샷, GIF 1233×1969):
  ```bash
  mkdir -p docs/floorplans && cd docs/floorplans
  curl -sL -o f1.gif "https://web.archive.org/web/20150622001310id_/http://www.stonybrook.edu/commcms/csbuilding/images/CS-first-Floor.gif"
  curl -sL -o f2.gif "https://web.archive.org/web/20150622001313id_/http://www.stonybrook.edu/commcms/csbuilding/images/CS-second-Floor.gif"
  curl -sL -o f3.gif "https://web.archive.org/web/20150622001316id_/http://www.stonybrook.edu/commcms/csbuilding/images/CS-third-Floor.gif"
  python3 -c "from PIL import Image
  for i in (1,2,3): Image.open(f'f{i}.gif').convert('RGB').save(f'floor{i}.png')"
  ```
  (`id_` 접미사가 있어야 Wayback 래퍼 HTML이 아니라 원본 GIF가 온다.) 클라우드 환경에서 archive.org가 막혀 있으면
  이미지 없이 진행해도 된다 — 트레이스 데이터는 이미 `scripts/trace-ncs.mjs`에 다 들어 있다. 이미지는 재검사용일 뿐이다.
- 도면 작성: Mitchell | Giurgola Architects, LLP. **방 번호가 없다.** 라벨은 연구그룹 약어(RIS, RVG, RVI, RVR, RAL, RWM,
  RCS, RCY, SYA, UNG, GRD, ADM) + "OFF."/"P.DOC OFF."/"GRAD LABS" 형태. 이 약어의 풀네임은 모르므로 **풀어 쓰지 않았다**(지어내기 금지 규칙).
  이름 없는 곳은 서술형 이름("Atrium (main hall)", "Lab passage", "Meeting nook", "Grad labs (south bay)").
- **축척**: 세 장 모두 스케일바 16 ft ≈ 88.5 px → **0.0551 m/px** (floor-1 이미지 기준).
  검증: 1·2층 추정 면적 ≈ 2,280 m², 3층 ≈ 1,430 m², 합계 ≈ 6,200 m² vs 공식 70,000 sq ft(6,500 m²). OSM 외곽선과도 일치(아래).
- **층별 이미지 정합**: 세 장은 오프셋과 배율이 조금씩 다르다(3층 이미지가 ~1.7% 크게 그려짐). 각 층 픽셀 → floor-1 픽셀 선형변환:
  F2 `x1 = 1.0088x + 1.3, y1 = 1.0045y + 45.8`, F3 `x1 = 0.9860x + 21.8, y1 = 0.9823y + 111.0`.
  동쪽 사무실 벽 18개, 스파인 벽, void 경계로 최소제곱 적합. 최대 잔차 3 px(≈0.17 m).
  교차 확인: 2층 void를 1층 좌표로 옮기면 1층 도면의 점선 "위층 void" 사각형(x 417–471, y 305)과 1 px 이내로 겹친다.
- **원점**: floor-1 픽셀 (105, 1605) = 발자국의 SW 모서리(교육실 서쪽 벽, 정문 현관 앞). x=동, y=북(도면 위쪽 = "북").
- **실제 방위**: OpenStreetMap way **529707497** ("New Computer Science")와 비교. 본동 막대 ≈ 57 m × 25 m, 남쪽부 ≈ 52 m 폭,
  동쪽으로 뻗은 날개까지 일치. **도면 위쪽은 진북에서 약 9° 동쪽**. 코드에서는 쓰지 않는다(SPEC에 기록만).
  (way 54719325 "Computer Science"는 **옛 CS 건물**이니 헷갈리지 말 것.)
- **아트리움**: 3층 관통 유리 아트리움 = 건물 중앙의 남북 스파인(x≈385–505 px). 2·3층 도면의 X 표시 사각형이 void다.
  F2 void 4개(남쪽부 포함), F3 void 3개. 1층은 void 없음(바닥 슬래브). 3층 남쪽은 지붕이라 공간 없음(기계실 B와 동쪽 계단만).
- 비콘 id: Eddystone-UID instance 12 hex = `0000000{층}{번호4자리}` (예: `000000010001`).
  namespace = `53425542454143304e31` (ASCII "SBUBEACON1", 데모용). txPower(1 m RSSI) = −59 dBm.

## 5. 남은 작업

1. **배포(M6)** — §8 결정 후. 빌드 설정: framework Vite, build `npm run build`, output `dist`, Node 22+ (`package.json` engines).
2. (선택) 실측: 비콘 몇 개를 실제로 붙여 Live BLE로 오차를 재고, 시뮬레이션 수치 옆에 "measured"로 따로 기록.
3. (선택) 층 전환 지연 줄이기: 계단 비콘 이벤트나 기압계. 바꾸면 `npm run bench` 다시 돌리고 표 갱신.

## 6. 검증 명령

```bash
npm install
npm test                 # 현재: 10 files, 55+ tests pass
npm run bench            # docs/benchmark-sim.md, src/data/bench.json 재생성 (~16 s)
npx tsc --noEmit -p .    # 현재: 에러 0
npm run trace            # ncs.json 재생성 (결과가 커밋본과 같아야 함: git diff --stat src/data/ncs.json)
npm run build
```

## 7. 결정 기록 (다시 논의하지 말 것)

- 시뮬레이션이 메인, Live BLE는 보너스. 백엔드·텔레메트리 없음.
- 기본 estimator = 가중 중심 + Kalman.
- Codex(외부 모델)는 부르지 않았다: 스키마 마이그레이션·인증·과금 같은 되돌리기 어려운 결정이 없는 정적 데모라서.
  배포 직전 전체 리뷰도 내부 서브에이전트로 충분하다고 판단.
- 도면 이미지는 저작권(Mitchell | Giurgola) 때문에 커밋하지 않고 `.gitignore` 처리. 배포 번들에도 넣지 않는다.
- 브레인스토밍/플랜 단계의 승인 대기는 대표님의 "끝까지 쭉 진행" 지시로 생략했다(가정은 SPEC에 적어 둠).

## 8. 대표님 결정이 필요한 것 (외부로 나가는 작업 — 실행 전 반드시 확인)

1. ~~GitHub 푸시~~ **결정됨(2026-09-30)**: 대표님이 "public 그대로 푸시"를 선택. `feat/beacon-nav`를 `origin`에 푸시했고, 지금은 `main`이 기준이다. GitHub Default branch가 아직 `feat/beacon-nav`일 수 있으니 클론은 `git clone -b main`으로 한다. 이후 푸시도 외부 전송이므로 매번 무엇이 나가는지 보고할 것.
2. **Vercel 배포** (2026-09-30 확인): 팀 `kita`(slug `kitaa`, id `team_Y52MwjHkR5WJTIyBkbyF4OgT`)에 beacon 프로젝트는 **없다**.
   레포를 Vercel에 연결하면 production 브랜치의 코드가 production이 된다. production 브랜치는 `main`으로 둔다
   (GitHub 레포의 Default branch도 `main`이어야 한다).
   연결 설정: framework Vite, build `npm run build`, output `dist`. 올라가는 것은 `dist/`의 정적 파일(HTML·JS·CSS)뿐, 도면 이미지 없음.

## 9. 알려진 한계·주의

- 층고 4.3 m는 가정. 벽 감쇠는 모델에 없음(SPEC "Out of scope").
- 트레이스는 벽 중심선 기준 사각형 근사라 경계에서 0.1–0.3 m 오차. 사무실 문 위치, 가구는 무시.
- F1 동쪽 날개 북쪽(x 512–590 px, y 1212–1255 px)은 외부 notch로 처리했다(도면상 출입문 주변). 틀렸으면 outline 한 줄만 고치면 된다.
- F2 서쪽 남단(x < 205 px, y > 1205 px)은 1층 교육실 지붕/테라스라 외곽에서 뺐다.
- 1차 세션 로컬 스크래치의 오버레이 PNG와 검사 스크립트는 남아 있지 않다. 필요하면 `--dump` 출력 +
  PIL로 다시 그리면 된다(10줄 정도: 공간 폴리곤 반투명 채움, void 주황, outline 초록, 비콘 빨간 점).
