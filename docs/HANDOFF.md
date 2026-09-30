# HANDOFF — 다음 세션은 여기서부터 (2026-09-30 기준)

이 문서 하나만 읽으면 이어서 작업할 수 있게 썼다. 순서대로 읽을 것:
**이 문서 → `CLAUDE.md` → `docs/SPEC.md` → `docs/superpowers/plans/2026-09-30-beacon-nav.md` → `docs/RESEARCH.md`**.

- 브랜치: `feat/beacon-nav` (`main`은 커밋이 하나도 없는 빈 브랜치다. 모든 작업은 이 브랜치에 있다)
- 원격: `https://github.com/kitavkdl/beacon` (**PUBLIC** 레포). 푸시 여부는 대표님이 결정한다 (아래 §8).
- 대표님 요청 원문: "웹에 바로 배포까지 가능하도록 끝까지 쭉 진행". superpowers, ponytail, 필요하면 서브에이전트 사용.
  사용자는 한국어로 대화하며 호칭은 "대표님". 전역 규칙(외부 전송·푸시·배포는 실행 전 보고)은 계속 유효하다.

---

## 1. 한 줄 요약

**Task 1(스캐폴드)·Task 2(엔진)는 끝나서 커밋됐다. Task 3(실측 도면 트레이싱)은 데이터까지 완성됐고, 테스트와 문서가 남았다.
Task 4~7(투어·벤치·3D 화면·Live BLE·배포)은 시작하지 않았다.**

## 2. 레포가 처음에 비어 있었다는 사실 (중요)

대표님이 붙여 준 `CLAUDE.md`와 `RESEARCH.md`는 **다른 환경에서 만든 레포**를 설명한다
(`ncs.placeholder.ts`, `docs/benchmark-sim.md`, `FLOORPLAN_TRACING.md` 등). 이 레포(`/home/jiyul/git/beacon`)는
**커밋 0개, 파일 0개**인 상태로 시작했다. 그래서 전부 새로 만들었다.

- `RESEARCH.md` §4의 벤치마크 표(가중 중심 3.9 m 등)는 **그 옛 placeholder 레포의 숫자**다. 이 레포에서 재현된 적 없다.
  Task 4에서 `npm run bench`로 새로 측정해서 `docs/benchmark-sim.md`를 만들고, RESEARCH.md §4에 "옛 수치"라고 표시하거나 새 수치로 바꿀 것.
- placeholder 도형은 만들지 않았다. 곧바로 실측 도면으로 `src/data/ncs.json`을 만들었다.

## 3. 완료된 것

### Task 1 — 스캐폴드 (커밋 `14724b9`)
- Vite 8 + React 19 + TypeScript **7.0.2** + three 0.186 + @react-three/fiber 9 + drei 10 + vitest **5** + vite-node 6.
- `npm run build` = `tsc --noEmit && vite build`. 빈 App으로 빌드 통과 확인함.
- `npm run bench` = `vite-node scripts/bench.ts` — **`scripts/bench.ts`는 아직 없다.** vite-node 6이 vitest 5/vite 8과
  함께 동작하는지도 아직 확인 안 했다. 안 되면 `tsx`를 devDependency로 넣거나 vitest 파일로 돌리는 방법으로 바꿀 것.
- `src/data/schema.ts`: `Vec2, Polygon, Category, Space, Floor, Beacon, Venue`. Category는 IMDF unit 카테고리
  (`office laboratory classroom conferenceroom walkway restroom stairs elevator mechanical storage lounge kitchen workroom`).
  `kitchen`은 이번에 추가됨(미커밋 → 이 핸드오프 커밋에 포함).
- `.gitignore`: `node_modules`, `dist`, `.vercel`, **`docs/floorplans/`** (도면 이미지 저작권 때문, §5 참조).

### Task 2 — 엔진 (커밋 `feat(engine)…`, 서브에이전트가 TDD로 작성, 내가 테스트·tsc 재확인)
`src/engine/` — react/three import 없음 (grep으로 확인). **33개 테스트 전부 통과.** `npx tsc --noEmit` 통과.

| 파일 | export |
|---|---|
| `geometry.ts` | `pointInPolygon(p, poly)`, `polygonArea(poly)`, `polygonCentroid(poly)` |
| `pathLoss.ts` | `PATH_LOSS_N = 2.2`, `rssiAt(d, txPower, n?)`, `distanceFrom(rssi, txPower, n?)` |
| `filters.ts` | `FilterKind = 'none'\|'ema'\|'kalman'`, `RssiFilter {update(x)}`, `makeFilter(kind)` (EMA α=0.3, Kalman q=0.5 r=16) |
| `estimators.ts` | `Anchor {x,y,rssi,txPower}`, `EstimatorKind = 'proximity'\|'centroid'\|'trilateration'`, `estimate(kind, anchors): Vec2\|null` |
| `simulator.ts` | `mulberry32(seed)`, `gaussian(rng)`, `Pose {floor,x,y}`, `SimOptions`, `DEFAULT_SIM = {seed:1, sigma:4, dropRate:0.1, slabDb:18, atriumSlabDb:3}`, `class RadioSim(venue, opts?)` — `sample(pose, t): Reading[]`, 공개 가변 필드 `sigma` |
| `locator.ts` | `Reading {beaconId, rssi, t(ms)}`, `Fix {floor,x,y,spaceId,spaceName,used}`, `LocatorOptions {estimator, filter}`, `class Locator(venue, opts)` — `ingest(readings)`, `locate(now): Fix\|null`, `setOptions(partial)`, `reset()` |
| `fixture.ts` | 테스트용 가상 2층 venue `FIXTURE` (30×20 m, 층고 4.2 m, 2층에 아트리움 void `ATRIUM`) |

동작 규칙(SPEC과 같음):
- 가중 중심 = 상위 4개, 1/d² 가중. 삼변측량 = 상위 6개 선형 최소제곱, 3개 미만·특이행렬·NaN이면 가중 중심으로 폴백,
  결과는 앵커 bbox+5 m로 클램프.
- 층 판정: 층별 점수 = 신선한 비콘 상위 3개 필터 RSSI 평균. 다른 층이 **3 dB 이상, 3회 연속** 앞서야 전환.
  첫 fix는 최고 점수 층. 현재 층 비콘이 모두 stale이면 즉시 전환.
- 3000 ms 넘게 안 들린 비콘은 stale(필터 상태도 버림). venue에 없는 비콘 id는 무시. 판독이 하나도 없으면 `null`.
- 공간 조회: 포함하는 polygon, 없으면 centroid가 가장 가까운 공간.
- 시뮬레이터: 폰 높이 층+1.2 m, 비콘 층+2.5 m, 3D 거리. 슬래브를 지날 때마다 18 dB, **교차점이 그 층 void 안이면 3 dB**
  (= 아트리움 너머로 층끼리 보이는 현상 모델링). 정수 반올림, 10% 드롭, −100 dBm 미만은 드롭.

서브에이전트가 보고한 스펙 차이 (전부 수용함):
1. 시뮬레이터 "1 m에서 ≈txPower" 테스트는 불가능(폰·비콘 높이차 1.3 m)해서 비콘 바로 아래에서 `rssiAt(1.3)`과 비교.
2. `Fix.used`는 estimator에 넘긴 **신선한 앵커 전체 수**(상위 4/6개가 아님).
3. `setOptions`로 **filter**를 바꾸면 비콘 상태 전체 초기화 → 다음 `locate()` 한 번은 `null`(250 ms 루프에선 한 틱).
   UI에서 "No signal"이 한 틱 깜빡일 수 있으니 Task 5에서 확인할 것.

### Task 3 — 도면 트레이싱 (데이터 완성, **이 핸드오프 커밋에 포함**)
- `scripts/trace-ncs.mjs`: 픽셀 좌표로 따라 그린 도형 + 보정값 → `src/data/ncs.json` 생성. `npm run trace`.
  `--dump` 옵션은 픽셀 폴리곤 JSON을 출력한다(오버레이 검사용). 이미지가 있으면 `docs/floorplans/overlay-N.svg`도 만든다.
- 결과: **F1 58 공간, F2 81 공간, F3 52 공간, 비콘 55개(19/20/16)**. `ncs.json` 68 KB.
- 세 층 모두 오버레이 이미지로 눈 검사를 마쳤다 — 동쪽 사무실 열, 서쪽 연구실 칸, 가운데 코어, 남쪽 날개, 아트리움 void가 도면과 겹친다.
- 층 외곽 범위(m): F1 x 0–50.97, y 0–78.79 / F2 x 1.57–51.54, y 0.12–79.27 / F3 x 1.55–49.47, y 6–78.96(본동 + 3층 기계실 B 별동, outline 2조각).
- 고도: F1 0 m, F2 4.3 m, F3 8.6 m (층고 4.3 m는 **가정**, 도면에 없음).

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

## 5. 남은 작업 (플랜 순서 그대로)

### Task 3 마무리
1. `src/data/venue.ts` — 타입 로더: `import raw from './ncs.json'; export const NCS = raw as Venue;` 정도면 충분(ponytail: 검증 라이브러리 넣지 말 것).
2. `src/data/venue.test.ts` — 플랜의 테스트: ① 공간 id 유일 ② 모든 비콘의 floor가 존재 ③ 모든 공간 꼭짓점이 자기 층 outline
   중 하나 안(경계 허용 오차 0.3 m 정도 — 트레이스가 벽 중심선이라 경계에 걸림) ④ 모든 비콘이 outline 안 ⑤ 이름에 방 번호
   패턴 없음 `/\b\d{3,4}[A-Z]?\b/` ⑥ 층 elevation 오름차순. 실패하면 **데이터를 고친다**(`trace-ncs.mjs` 수정 → `npm run trace`).
   주의: F2 "Tel./Elec."는 트레이스에서 y 1315부터로 정리했다(원래 1305와 겹침). F1 서쪽 계단 `Stair (west)`는 x 137–167.
3. `docs/FLOORPLAN_TRACING.md` — §4의 내용을 절차 문서로: 이미지 받기 → 보정(스케일바) → 정합(REG) → `trace-ncs.mjs`에 R/P 추가
   → `npm run trace` → `overlay-N.svg`를 브라우저로 열어 확인. 헬퍼: R(name, category, x0,y0,x1,y1), P(name, category, [[x,y]…]),
   row(x0,x1,walls,names) = 동쪽 사무실 열, hrow(y0,y1,walls,names,category) = 가로 방 열.
4. 커밋.

### Task 4 — 투어 + 통합 테스트 + 벤치
- `src/data/tour.ts`: 웨이포인트 `{floor,x,y}[]`(미터) + `tourPose(tSeconds): Pose` (1.2 m/s 선형보간, 층 전환은 계단 위치에서 즉시).
  경로 제안(미터는 `trace-ncs.mjs`의 변환으로 픽셀에서 계산): 정문(F1 px 447,1590) → 아트리움 북진(447,330) → 북쪽 로비 →
  남쪽 계단(265,1238)에서 F2로 → F2 서쪽 갤러리 북진 → 동쪽 사무실 앞 → F2 남쪽 계단 → F3 → F3 갤러리 → 끝.
  **벽을 통과하지 않게** 복도·아트리움 공간 위로만 지나가게 할 것.
- `src/engine/integration.test.ts`: NCS + 투어, 시드 고정, σ=4, centroid+kalman → 중앙값 오차 < 6 m, 층 정확도 > 90%.
  (아트리움 때문에 층 정확도가 떨어질 수 있다. 그게 이 데모의 요점이니, 숫자가 안 나오면 임계값을 속이지 말고 원인을 보고할 것.)
- `scripts/bench.ts`: σ ∈ {2,4,6,8} × estimator 3종 × filter(kalman) → 중앙값/90퍼센타일 오차, 층 정확도, 공간 정확도 마크다운 표 출력.
  결과를 `docs/benchmark-sim.md`에 붙이고 "simulated"라고 명시. RESEARCH.md §4 갱신.

### Task 5 — 3D 화면 + 패널 + 루프 (M3, M4)
- `src/scene/Building.tsx`: 층마다 outline을 `THREE.Shape`(void는 `holes`)로 만들어 얇은 슬래브로 extrude, 공간은 카테고리 색으로
  낮은 벽(또는 평면 채움 + 외곽선). CLAUDE.md의 좌표 규칙: three 좌표 = (x, 고도, −y), 층 그룹을 X축 기준 −90° 회전해서
  (x,y)로 그리고 위로 extrude. 층 포커스(All/1/2/3), 비포커스 층은 반투명.
- `src/scene/Markers.tsx`: 비콘(작은 구), 실제 위치(시뮬, 회색 링), 추정 위치(파란 점 + 궤적).
- `src/ui/Panel.tsx`: 모드(Simulation/Live BLE), estimator, filter, 노이즈 σ 슬라이더, 층 보기, 판독값(층·공간·오차 — 오차 옆에 "simulated"),
  들리는 비콘 표. **영어 UI, 이모지·슬로건 금지, 장식 없는 스타일.**
- `src/App.tsx`: 250 ms마다 `sim.sample(tourPose(t), now)` → `locator.ingest` → `locate(now)` → state. null이면 "No signal".
- `run` 스킬이나 브라우저(claude-in-chrome)로 실제 화면 확인.

### Task 6 — Live BLE (M5)
- `src/live/eddystone.ts` + 테스트: 서비스 UUID 0xFEAA 서비스 데이터 파싱. 바이트0 frame type 0x00(UID), 바이트1 Tx power@0m(int8),
  2–11 namespace(10B), 12–17 instance(6B). RSSI@1m ≈ Tx@0m − 41 dB. 알려진 프레임으로 테스트.
- `src/live/scanner.ts`: `navigator.bluetooth?.requestLEScan` 기능 감지(`acceptAllAdvertisements` 또는 serviceData 필터),
  `advertisementreceived` → `Reading`. 미지원이면 패널에 이유 표시(iOS 불가, Android/macOS Chrome은 실험 플래그 필요 — RESEARCH §2).

### Task 7 — 문서·리뷰·배포 (M6)
- README(영어, 짧게), CLAUDE.md 갱신. 전체 브랜치 리뷰 서브에이전트. `npm test && npm run build` 통과 확인.
- 배포는 **§8의 결정이 난 뒤에만**.

## 6. 검증 명령

```bash
npm install
npm test                 # 현재: 6 files, 33 tests pass
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

1. ~~GitHub 푸시~~ **결정됨(2026-09-30)**: 대표님이 "public 그대로 푸시"를 선택. `feat/beacon-nav`를 `origin`에 푸시했다.
   원격 `main`은 비어 있을 수 있으니 클론 후 `git checkout feat/beacon-nav`. 이후 푸시도 외부 전송이므로 매번 무엇이 나가는지 보고할 것.
2. **Vercel 배포**: 팀 `kita`(slug `kitaa`, id `team_Y52MwjHkR5WJTIyBkbyF4OgT`)에 beacon 프로젝트는 **없다**. 로컬에 `vercel` CLI도 없다.
   가장 간단한 경로: Vercel 프로젝트를 GitHub 레포에 연결(framework `vite`, build `npm run build`, output `dist`) → 푸시하면 자동 배포.
   Vercel Hobby는 private 레포도 된다. 배포 전 무엇이 올라가는지(= `dist/`의 정적 파일만) 보고할 것.

## 9. 알려진 한계·주의

- 층고 4.3 m는 가정. 벽 감쇠는 모델에 없음(SPEC "Out of scope").
- 트레이스는 벽 중심선 기준 사각형 근사라 경계에서 0.1–0.3 m 오차. 사무실 문 위치, 가구는 무시.
- F1 동쪽 날개 북쪽(x 512–590 px, y 1212–1255 px)은 외부 notch로 처리했다(도면상 출입문 주변). 틀렸으면 outline 한 줄만 고치면 된다.
- F2 서쪽 남단(x < 205 px, y > 1205 px)은 1층 교육실 지붕/테라스라 외곽에서 뺐다.
- 로컬 스크래치(`/tmp/claude-1000/...`)의 오버레이 PNG와 검사 스크립트는 클라우드로 넘어가지 않는다. 필요하면 `--dump` 출력 +
  PIL로 다시 그리면 된다(10줄 정도: 공간 폴리곤 반투명 채움, void 주황, outline 초록, 비콘 빨간 점).
