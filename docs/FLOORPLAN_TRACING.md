# 도면 → venue JSON 트레이싱 절차

공식 도면 이미지가 `src/data/ncs.json`이 되는 과정. 도형을 고치거나 층을 다시 따라 그릴 때 이 순서대로 하면 된다.
결과물은 `scripts/trace-ncs.mjs` 하나에 모여 있고, `ncs.json`은 그 스크립트가 만드는 생성물이다(**직접 편집 금지**).

## 1. 도면 이미지 받기 (커밋 금지)

도면은 © Mitchell | Giurgola Architects. `docs/floorplans/`는 `.gitignore`에 들어 있고 배포 번들에도 포함하지 않는다.

학교 페이지(`stonybrook.edu/commcms/csbuilding/csbuilding-floor-plan`)의 이미지 URL은 2026-09-30 기준 404다.
Wayback Machine 2015-06-22 스냅샷의 원본을 받는다(`id_` 접미사가 있어야 래퍼 HTML이 아닌 GIF 원본이 온다).

```bash
mkdir -p docs/floorplans && cd docs/floorplans
curl -sL -o f1.gif "https://web.archive.org/web/20150622001310id_/http://www.stonybrook.edu/commcms/csbuilding/images/CS-first-Floor.gif"
curl -sL -o f2.gif "https://web.archive.org/web/20150622001313id_/http://www.stonybrook.edu/commcms/csbuilding/images/CS-second-Floor.gif"
curl -sL -o f3.gif "https://web.archive.org/web/20150622001316id_/http://www.stonybrook.edu/commcms/csbuilding/images/CS-third-Floor.gif"
python3 -c "from PIL import Image
for i in (1,2,3): Image.open(f'f{i}.gif').convert('RGB').save(f'floor{i}.png')"
```

세 장 모두 1233 × 1969 px. 이미지가 없어도 `npm run trace`는 동작한다(오버레이만 안 만들어진다).

## 2. 축척 (M_PER_PX)

각 도면 하단 스케일바: **16 ft = 88.5 px** (floor-1 이미지 기준) → 4.8768 m / 88.5 px = **0.0551 m/px**.

검산:
- 1·2층 추정 면적 ≈ 2,280 m², 3층 ≈ 1,430 m², 합계 ≈ 6,200 m². 공식 연면적 70,000 sq ft(≈ 6,500 m²)와 5% 안쪽.
  (트레이스는 외벽 두께와 일부 테라스를 빼서 약간 작게 나오는 게 정상.)
- OpenStreetMap way **529707497** ("New Computer Science") 외곽선: 본동 ≈ 57 m × 25 m, 남쪽부 ≈ 52 m 폭, 동쪽 날개까지 일치.
  (way 54719325 "Computer Science"는 옛 CS 건물이다. 헷갈리지 말 것.)

## 3. 층 사이 정합 (REG)

세 장은 여백과 배율이 조금씩 다르다(3층 이미지가 ~1.7% 크게 그려짐). 그래서 각 층 픽셀을 **floor-1 픽셀**로 옮기는
축별 선형변환을 둔다: `x1 = ax·x + bx`, `y1 = ay·y + by`.

| 층 | ax | bx | ay | by |
|---|---|---|---|---|
| 1 | 1 | 0 | 1 | 0 |
| 2 | 1.0088 | 1.3 | 1.0045 | 45.8 |
| 3 | 0.9860 | 21.8 | 0.9823 | 111.0 |

적합 방법: 층마다 같은 벽으로 보이는 좌표(동쪽 사무실 벽 18개, 중앙 스파인 벽, 아트리움 void 경계)를 짝지어 최소제곱.
최대 잔차 3 px(≈ 0.17 m).
교차 확인: 2층 void를 1층 좌표로 옮기면 1층 도면의 점선 "위층 void" 사각형(x 417–471)과 1 px 안에서 겹친다.

## 4. 원점과 축

- 원점: floor-1 픽셀 **(105, 1605)** = 발자국의 SW 모서리(Wireless Teaching Lab 서쪽 벽, 정문 현관 앞 선).
- x = 동(이미지 오른쪽), y = 북(이미지 위쪽). 이미지 y는 아래로 커지므로 `y_m = (1605 − y1) · 0.0551`.
- 진북은 도면 위쪽에서 약 9° 서쪽(OSM 비교). 코드에서는 쓰지 않는다.
- 층고 4.3 m(14 ft)는 **가정**이다(도면에 없음). `STOREY` 상수 하나로 바꿀 수 있다.

## 5. 도형 추가·수정

`scripts/trace-ncs.mjs`의 `floors` 배열에 **그 층 이미지의 픽셀 좌표**로 적는다. 벽 중심선을 따른다.

| 헬퍼 | 용도 |
|---|---|
| `R(name, category, x0, y0, x1, y1)` | 축 정렬 사각형 공간 |
| `P(name, category, [[x, y], …])` | 임의 다각형 공간(ㄱ자, 사선 벽) |
| `row(x0, x1, walls, names)` | 동쪽 사무실 열: 세로로 이어진 칸, `walls[i]..walls[i+1]`이 `names[i]`. 이름이 `Meeting nook`이면 lounge |
| `hrow(y0, y1, walls, names, category)` | 가로로 이어진 방 열 |

층 객체 필드: `outline`(외곽, 여러 조각 가능), `voids`(아트리움처럼 아래층이 보이는 구멍), `spaces`, `beacons`(픽셀 점).

이름 규칙(CLAUDE.md):
- 도면에 인쇄된 라벨만 쓴다("RVG Off.", "Conf. Room", "GRD PhD Workspace"). 연구그룹 약어(RIS, RVG, RVI, RVR, RAL, RWM, RCS, RCY,
  SYA, UNG, GRD, ADM)는 풀네임을 모르니 풀어 쓰지 않는다.
- **방 번호는 도면에 없으므로 절대 만들지 않는다.** `venue.test.ts`가 `/\b\d{3,4}[A-Z]?\b/`로 막는다.
- 라벨이 없는 곳은 서술형 이름("West corridor", "Lab passage", "Atrium gallery (west side)").

카테고리는 `src/data/schema.ts`의 IMDF unit 카테고리 중에서 고른다.

비콘 id는 `0000000{층}{번호 4자리}`(Eddystone-UID instance 12 hex), txPower −59 dBm, namespace `53425542454143304e31`("SBUBEACON1").
배열 순서가 곧 번호이므로 **비콘을 중간에 끼워 넣으면 뒤 번호가 밀린다.** 실제 비콘을 설치한 뒤에는 끝에만 추가할 것.

## 6. 생성과 검사

```bash
npm run trace                        # src/data/ncs.json (+ docs/floorplans/overlay-N.svg, 이미지가 있을 때)
npm test                             # venue.test.ts: id 유일, 비콘·공간이 외곽 안(허용 0.3 m), 방 번호 없음, 고도 오름차순
node scripts/trace-ncs.mjs --dump    # 픽셀 폴리곤 JSON (다른 도구로 오버레이를 그릴 때)
```

`overlay-N.svg`를 브라우저로 열면 도면 위에 외곽(초록), void(주황), 공간(파랑), 비콘(빨강)이 겹쳐 보인다.
벽과 어긋난 곳을 찾아 픽셀 값을 고치고 다시 `npm run trace`.

## 7. 알려진 근사

- 벽 중심선 기준 사각형 근사라 경계에서 0.1–0.3 m 오차. 문 위치·가구는 무시.
- F1 동쪽 날개 북쪽(x 512–590, y 1212–1255)은 외부 notch로 처리(출입문 주변).
- F2 서쪽 남단(x < 205, y > 1205)은 1층 교육실 지붕/테라스라 외곽에서 뺐다.
- F3 남쪽은 지붕. 기계실 B와 동쪽 계단만 별동 outline으로 있다.
- 1층에는 void가 없다(아트리움 바닥). 2층 void 4개, 3층 void 3개.
