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

---

# Melville Library (M7 길찾기 데모)

`src/data/melville.json`은 `scripts/trace-melville.mjs`가 만든다(`npm run trace:melville`, **직접 편집 금지**).
설계 근거: `docs/superpowers/specs/2026-10-01-melville-room-finder-design.md`.

## 1. 원본과 추출 (커밋 금지)

- 원본: "Melville Library Emergency Plan" (SBU Libraries, 2014-11-24),
  `https://library.stonybrook.edu/wp-content/uploads/2014/07/1Building-Emergencyplan-Fall-2014-1.pdf`
  (sha256 앞 16자 `07c1e2d661fc4731`). 3–8쪽이 도면: p3=5층, p4=4층, p5=3층, p6=2층, p7=1층, p8=지하. 각 1275 × 1725 px.
- 초록 화살표는 비상 대피 경로 덧그림이라 무시한다.
- 이미지는 `docs/floorplans/melville/`(gitignore)에만 둔다. PyMuPDF는 세션 스크래치에만 설치한다.

```bash
mkdir -p docs/floorplans/melville && cd docs/floorplans/melville
curl -sL -o melville-2014.pdf "https://library.stonybrook.edu/wp-content/uploads/2014/07/1Building-Emergencyplan-Fall-2014-1.pdf"
python3 -m pip install -q --target "$SCRATCH/pylib" pymupdf numpy
PYTHONPATH="$SCRATCH/pylib" python3 -c "
import pymupdf
d = pymupdf.open('melville-2014.pdf')
for pg, name in {3: 'f5', 4: 'f4', 5: 'f3', 6: 'f2', 7: 'f1', 8: 'basement'}.items():
    big = max(d[pg - 1].get_images(full=True), key=lambda x: x[2] * x[3])
    pymupdf.Pixmap(d, big[0]).save(name + '.png')
"
```

## 2. 축척과 방향 (M_PER_PX)

도면에 스케일바가 없다. OSM way **54723529**("Frank Melville Jr. Memorial Library", 37 노드, 면적 약 10,100 m²)를
로컬 미터로 투영하고(위도 40.9154의 등장방형), 각 층 외곽 마스크(잉크를 9 px 팽창 → 바깥 flood fill)와 IoU가 최대가 되도록
회전·등방 축척·이동을 탐색했다.

| 층 | IoU | 회전 | m/px |
|---|---|---|---|
| 3층 (p5) | **0.982** | 9.5° | **0.1115** |
| 4층 | 0.971 | 9.5° | 0.112 |
| 5층 | 0.974 | 9.5° | 0.114 |
| 1·2층 | 0.81 | — | — (1·2층은 OSM 지붕선보다 작다) |

- OSM 외곽선은 3층과 가장 잘 맞는다. 그래서 **3층 시트를 기준 시트(REF)** 로 삼았다. `M_PER_PX = 0.1115`, 꼭짓점→외곽 RMS 0.57 m.
- 회전 9.5°는 plan-up과 진북 사이 각도다. **기록만 하고 좌표에는 적용하지 않는다**(좌표는 plan-up = north, NCS와 같은 규칙).
- 계획에 적어 둔 예상 범위 0.115–0.135 m/px는 연구 노트의 거친 추정이었다. 실측 적합값 0.1115를 쓴다(구현 판정).

## 3. 층 사이 정합 (REG)

각 시트의 기둥 표시(노란 사각형, 색 조건 r,g > 225, b < 215, r−b > 35, 크기 4–14 px)를 뽑아,
3층 기둥에 대해 축별 선형변환 `x_ref = ax·x + bx`, `y_ref = ay·y + by`를 ICP(최근접 대응 + 최소제곱)로 맞췄다.
초기값은 축척 0.94–1.06을 훑으며 이동 벡터 히스토그램의 최빈값으로 잡는다(초기값 없이 돌리면 한 칸 어긋난 국소해에 빠진다).

| 시트 | ax | bx | ay | by | 대응 기둥 | RMS px | max px |
|---|---|---|---|---|---|---|---|
| 지하 | 1.0575 | −11.423 | 1.0541 | −10.692 | 74/93 | 2.1 | 4.5 |
| 1층 | 1.0674 | −36.063 | 1.0643 | −15.866 | 149/177 | 2.35 | 4.9 |
| 2층 | 0.9737 | 16.279 | 0.9762 | 22.31 | 142/183 | 2.35 | 5.0 |
| 4층 | 0.9861 | −10.783 | 0.985 | 18.533 | 135/151 | 2.18 | 4.5 |
| 5층 | 1.0199 | −32.909 | 1.0141 | −47.042 | 133/146 | 2.17 | 4.1 |

앵커는 각 시트에서 수십 개(최소 74)이므로 "앵커 3개 이상" 조건을 넘는다. 잔차 기준은 RMS ≤ 3 px, max ≤ 5 px로 잡았다.

## 4. 좌표·트레이스 규칙

- 원점: 1층 외곽 bbox의 남서 모서리, 기준(3층) px로 `ORIGIN = [188, 1389]`. 지하·다른 층의 튀어나온 부분은 음수 좌표가 될 수 있다.
- 층고는 도면에 없다. **STOREY = 4.5 m 가정**, 1층 = 0, 지하 = −4.5 m.
- 모든 보행 공간·외곽·void는 **축에 평행한 직사각형**이고 0.5 m 격자에 맞춘다(셀 중심이 변 위에 오지 않게).
- 보행 직사각형 두 개가 변을 공유하면 그곳이 통로다. 공유하는 쌍은 모두 `OPENINGS`에 적어야 하고,
  적지 않은 쌍이 닿으면 `npm run trace:melville`이 실패한다(벽이 몰래 통로가 되지 않게).
- 벽 너머 문은 벽 간격을 가로지르는 `Doorway` 직사각형으로 그린다. 문 폭(공유 변 길이) ≥ 1 m,
  나머지 복도·열람 공간은 짧은 변 ≥ 1 m. 스크립트가 둘 다 검사한다.
- 계단·엘리베이터 코어는 복도로 한 면만 열린 막다른 공간이다. 커넥터는 기준 px 한 점으로 두고,
  그 점이 섬기는 모든 층에서 같은 종류의 코어 안에 있어야 한다(`melville.test`).
- 개별 사무실은 그리지 않는다(방 번호 글자가 판독되지 않는다). 방은 날개(N/S/E/W/C)·층 구역에 둔다.
- 층별 확인 결과: 5층은 북쪽·남쪽 코어가 "SHAFT"로만 그려져 그 엘리베이터·계단이 서지 않는다고 봤다.
  지하는 북쪽·남쪽 코어 위치가 위층과 맞지 않아 연결하지 않았고, 남서 계단은 지하 복도와 연결이 보이지 않아 뺐다.

## 5. 방 번호 출처

- PDF 9–10쪽 부서표의 "Departments"와 "Room #" 열만 PyMuPDF 단어 좌표로 읽었다(이름·전화 열은 읽지도 옮기지도 않는다).
- 도서관 웹(guides.library.stonybrook.edu/firstyearstudents/libraries): W-1530 Music Library, N-1001 North Reading Room,
  E-2320 Special Collections & University Archives.
- 같은 번호나 같은 이름이 두 출처에 있으면 웹 쪽을 남긴다(PDF E2321, N1000은 웹 E2320, N1001에 양보).
  지하 아래층(SB0003)과 잘린 이름(E0319)은 뺐다. PDF 중복 번호는 합치거나(W5510) 뺐다(E0305 housekeeping).
- 스크립트의 41개 PDF 행은 모두 PDF 텍스트에 있다(2026-10-01 대조).

## 6. 검수

`node scripts/trace-melville.mjs --dump`가 `{M_PER_PX, ORIGIN, REG, lib}`을 출력한다. 이것을 각 시트 위에 되그려
(기준 px → 시트 px 역변환) 복도·코어·구역이 도면과 맞는지 눈으로 확인했다(6장 모두).
