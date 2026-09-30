# 리서치 정리: SBU BLE 비콘 실내 위치 데모

작성일: 2026-09-30. 대상 건물은 New Computer Science 빌딩(NCS)이다.
범위: 3D 웹 데모로 "건물에 들어서면 내가 어디 있는지 보여준다"는 걸 증명하는 것까지. 수익 모델과 지속성(신입생이 3주 안에 캠퍼스 위치를 익히는 문제)은 이번 범위에서 뺐다.

> **2026-09-30 추가 메모 (구현 세션):** 이 문서는 다른 환경의 placeholder 레포 기준으로 쓰였다. 이 레포에서 달라진 점:
> 학교 도면 이미지 URL은 지금 404이고 Wayback 스냅샷으로 받았다. 도면은 실측으로 트레이싱 완료(`src/data/ncs.json`).
> §4 표는 옛 레포 수치라 이 레포에서 `npm run bench`로 다시 재야 한다. 자세한 내용은 `docs/HANDOFF.md`.

---

## 1. 대상 건물: New Computer Science Building

| 항목 | 내용 | 출처 |
|---|---|---|
| 층수 | 3층 | [CS 학과 뉴스](https://www.cs.stonybrook.edu/about-us/News/new-cs-building-officially-opens) |
| 면적 | 연면적 70,000 sq ft (약 6,500 m², 층당 약 2,170 m²) | 같은 출처 |
| 아트리움 | 3개 층을 관통하는 4,000 sq ft 유리 아트리움 | [Wikipedia: SBU 건물 목록](https://en.wikipedia.org/wiki/List_of_Stony_Brook_University_buildings) |
| 구성 | 교수·포닥 연구실 60개 이상, 연구실(lab) 14,000 sq ft 이상, 티칭 랩 2개, 회의실 5개, 대학원생 라운지 | CS 학과 뉴스 |
| 위치 | Engineering Quad 근처. 2015년 완공 | Wikipedia |
| **공식 도면** | 1·2·3층 도면 이미지(GIF)가 공개돼 있음 | [csbuilding-floor-plan](https://www.stonybrook.edu/commcms/csbuilding/csbuilding-floor-plan) |

도면 이미지 경로(페이지에 링크된 주소):
- `https://www.stonybrook.edu/commcms/csbuilding/images/CS-first-Floor.gif`
- `https://www.stonybrook.edu/commcms/csbuilding/images/CS-second-Floor.gif`
- `https://www.stonybrook.edu/commcms/csbuilding/images/CS-third-Floor.gif`
- 썸네일은 파일명이 `-th.jpg`로 끝남

> 이 작업 환경에서는 네트워크 정책 때문에 stonybrook.edu 이미지를 직접 받지 못했다. 그래서 지금 레포의 도면 데이터는 **임시(placeholder) 도형**이다. 실제 치수는 층 수, 면적, 아트리움 존재만 맞춰 놨다.
> 지율 PC에서 브라우저나 curl로 받은 뒤 `docs/FLOORPLAN_TRACING.md` 절차대로 따라 그리면 된다. Claude Code는 이미지를 직접 볼 수 있어서 이 작업을 맡길 수 있다.

왜 NCS인가:
- SBU 건물 중 층별 도면이 공개된 걸 확인한 유일한 건물이다.
- CS 학과 건물이라 교수님이나 학과 설득에 유리하다.
- 3층 관통 아트리움 때문에 "층 판별"이 쉽지 않다. 데모에서 보여줄 기술적 난제로 오히려 좋다.

다른 건물 참고 정보(Wikipedia):
- SAC: 4층, 135,000 sq ft. 캠퍼스의 중심 건물.
- Union: 3층, 170,000 sq ft. 2020년 리노베이션.
- Melville Library: 6층, 682,000 sq ft. 길 잃기 제일 좋은 건물.
- Frey Hall: 강의실 전용. 250석 강의실 3개와 강의실 24개 이상.

길 찾기 수요가 제일 큰 건 Melville Library와 Frey/Javits다. 도면을 구하면 2차 데모 후보로 삼을 만하다.

기존 솔루션: 대학용 인터랙티브 지도는 Concept3D 같은 상용 서비스가 흔하다([Concept3D](https://concept3d.com/use-cases/higher-education/interactive-campus-maps/)). 대부분 실외나 건물 단위까지만 지원하고, 실내에서 실시간으로 내 위치를 잡는 기능은 드물다. SBU 공식 지도는 [Maps & Directions](https://www.stonybrook.edu/about/maps-and-directions/)에 있다.

---

## 2. 제일 중요한 발견: 웹 브라우저는 BLE 비콘을 거의 못 읽는다

데모를 **웹**으로 만들려면 먼저 알아야 하는 제약이다.

| 플랫폼 | 비콘 스캔 가능 여부 |
|---|---|
| iOS Safari / iOS Chrome | **불가.** Web Bluetooth 자체가 없고, Apple도 도입 의사가 없다고 밝힘 ([caniuse](https://caniuse.com/web-bluetooth), [instantpwa](https://instantpwa.com/answers/pwa-bluetooth-access)) |
| Android Chrome | 스캔 API(`requestLEScan`)가 **실험 플래그 뒤에만** 있음: `chrome://flags/#enable-experimental-web-platform-features` ([구현 현황](https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md)) |
| macOS Chrome | Android와 같음(플래그 필요) |
| Windows / Linux Chrome | 스캔 API 미지원 |
| Firefox | 미지원. Mozilla는 이 API를 "harmful"로 분류 |

추가 함정: **iBeacon 광고 데이터는 Web Bluetooth에서 차단돼 있다.** 차단 목록에 `manufacturer 4c advdata-02/ff` 항목이 있는데, 사용자 위치가 노출될 수 있다는 이유다([manufacturer_data_blocklist](https://github.com/WebBluetoothCG/registries/blob/master/manufacturer_data_blocklist.txt)). 그래서 웹에서 실제 비콘을 읽으려면 **Eddystone-UID**(서비스 UUID 0xFEAA) 형식을 써야 한다.

그래서 데모는 이렇게 설계했다.
1. **메인은 시뮬레이션 모드.** 실제 전파 모델로 RSSI를 만들어 내고, 똑같은 위치 엔진이 그걸 처리한다. 어떤 기기에서 열어도 돌아가서 교수님 앞에서 안전하다.
2. **보너스는 Live BLE 모드.** Android Chrome에 플래그를 켜고, Eddystone 비콘이나 비콘을 흉내 내는 폰을 쓰면 실제로 동작한다.
3. **실제 제품이 되려면 네이티브 앱이 필요하다.** iOS는 Core Location의 iBeacon ranging으로, Android는 네이티브 BLE 스캔으로 한다. 웹 코드를 재사용하려면 Capacitor나 React Native로 감싸면 된다. 발표 때 이 점을 먼저 말해 두면 "그럼 아이폰은요?" 질문을 미리 막을 수 있다.

---

## 3. 위치 추정 방식 비교

| 방식 | 원리 | 정확도(문헌·업계) | 장점 | 단점 |
|---|---|---|---|---|
| **근접(Proximity/Zone)** | 신호가 제일 센 비콘 = 현재 위치 | 방 단위 | 제일 단순하고 튼튼함 | 방마다 비콘이 필요 |
| **가중 중심(Weighted centroid)** | 가까운 비콘 k개의 위치를 1/d² 가중 평균 | 2~5 m | 노이즈에 강하고 계산이 가벼움 | 비콘 배치 범위 바깥쪽 위치는 못 잡음 |
| **삼변측량(Trilateration)** | RSSI를 거리로 바꾸고 원 3개 이상의 교점을 최소제곱으로 풂 | 좁은 공간 약 1.5 m, 넓은 공간 약 5 m ([BeaconZone](https://www.beaconzone.co.uk/blog/category/trilateration/)) | 이론상 정밀함 | RSSI 노이즈에 매우 민감함 |
| **핑거프린팅** | 위치별 RSSI 패턴을 미리 수집해 두고 매칭 | 1~3 m ([실배포 연구](https://www.researchgate.net/publication/367762231_Fingerprint-based_indoor_positioning_system_using_BLE_real_deployment_study)) | 벽이나 반사 영향까지 학습됨 | 현장 수집 노동이 크고, 공간이 바뀌면 다시 수집해야 함 |
| **AoA(도래각)** | 안테나 배열로 신호 방향을 측정 | 1 m 미만 | 정밀함 | 전용 하드웨어가 비쌈 |

문헌에서 나온 수치:
- 통제된 교실에서 비콘을 3×3 m 안에 촘촘히 깔면 10 cm 수준까지 나온다. 일반 배치에서는 ±2 m, 기계가 많은 복잡한 공간이나 3D 조건에서는 m 단위로 떨어진다([Sensors 2021, 21(15):5181](https://www.mdpi.com/1424-8220/21/15/5181)).
- 등을 맞댄 방향(back-to-back)이면 신호가 평균 19 dB 떨어진다. 사람 몸이 신호를 크게 가린다는 뜻이다.
- 광고 주기는 100 ms가 일반적이고, BLE 5.0이 4.2보다 안정적이다.
- Kalman 필터를 쓰면 RSSI 노이즈가 약 37% 줄어든다(BeaconZone).
- iOS가 주는 `accuracy` 값도 심하게 흔들린다. 저역통과 필터(EMA)를 걸라는 권고가 있다([Twocanoes](https://twocanoes.com/smoothing-out-ibeacon-accuracy-data/)).

지난 수업 때 나온 "1~3 m 정확도"는 **비콘이 촘촘하거나 핑거프린팅을 써야 나오는 숫자**다. 데모에서는 "방·구역 단위로 맞춘다"로 기대치를 잡는 게 정직하고 안전하다.

---

## 4. 이 레포의 시뮬레이션 결과(참고용)

`npm run bench`로 측정했다. 전체 표는 [benchmark-sim.md](./benchmark-sim.md)에 있다. 조건은 임시 도형, 층당 비콘 10개, 층당 공간 약 16개, Kalman 필터다. 실측이 아니라 시뮬레이션 값이다.

| 노이즈 σ | 방식 | 중앙값 오차 | 층 정확도 | 방 정확도 |
|---|---|---|---|---|
| 4 dB | 근접 | 6.2 m | 100% | 49% |
| 4 dB | 가중 중심 | **3.9 m** | 100% | **56%** |
| 4 dB | 삼변측량 | 6.8 m | 100% | 39% |
| 6 dB | 가중 중심 | 4.6 m | 100% | 51% |
| 6 dB | 삼변측량 | 10.1 m | 100% | 26% |

해석:
- **기본값은 가중 중심 + Kalman**이 맞다. 삼변측량은 노이즈가 커지면 급격히 무너진다. 문헌과 같은 결론이다.
- 방 단위로 맞추려면 **방 하나에 비콘 하나** 수준으로 배치해야 한다. 지금 배치로는 절반 정도만 맞는다. 도면을 따라 그린 다음 비콘 배치 실험을 하는 게 다음 단계다.
- 시뮬레이션에서 층 정확도가 100%인 건 층 슬래브 감쇠를 18 dB로 가정했기 때문이다. **실제 NCS는 아트리움을 통해 층끼리 서로 보인다.** 아트리움 근처에서는 층 판별이 틀릴 수 있다. 이 부분은 기압계 센서와 섞어 쓰는 방법, 계단·엘리베이터 쪽 비콘으로 "층 전환 이벤트"를 잡는 방법으로 풀 수 있다.

---

## 5. 하드웨어와 비용(실제 설치할 때)

| 항목 | 예시 | 가격·수명 |
|---|---|---|
| 저가 비콘 | BeaconZone K11(CR2032, iBeacon과 Eddystone 모두 지원) | 약 £15, 최대 14개월 ([BeaconZone](https://www.beaconzone.co.uk/allbeacons)) |
| 효율형 | PC038(NXP QN9021) | 약 £15. 배터리 효율 개선 |
| AA 전지형 | K5(IP67) | 약 £23 |
| 무료 대안 | 안 쓰는 Android 폰이나 노트북을 **Eddystone 비콘으로 광고** (예: nRF Connect 앱의 Advertiser 기능) | 0원 |

- 수업 때 나온 "배터리 1년" 발언은 업계 수치(CR2032 기준 12~14개월)와 맞는다.
- NCS 한 층(약 2,170 m²)을 방 단위로 커버하려면 층당 15~25개, 3개 층에 45~75개가 필요하다. 저가 비콘 기준으로 약 £700~1,100다. 교수님이 말한 VIP 예산($1,000~2,000/년) 안에서 **한 층 파일럿**은 현실적이다. 비용은 invoice로 처리해야 한다(4강 발언).

---

## 6. 3D·웹 기술 선택

| 영역 | 선택 | 이유 |
|---|---|---|
| 번들러 | Vite | 빠르고 설정이 거의 없음 |
| 3D | three.js + @react-three/fiber + drei | React로 씬을 선언적으로 짬. 도면 폴리곤을 extrude해서 3D로 만들기 쉬움 |
| 실내 지도 데이터 | 자체 JSON 스키마(`src/data/schema.ts`) | 데모 규모에 맞게 단순하게. 나중에 Apple **IMDF**(GeoJSON 기반 실내지도 표준)로 내보낼 수 있게 필드를 맞춰 둠([IMDF](https://register.apple.com/resources/indoor/program/indoor_maps), [IBM 예제](https://github.com/IBM/Apple-Indoor-Maps)) |
| 대안 | Mapbox GL의 실내 extrusion([예제](https://docs.mapbox.com/mapbox-gl-js/example/3d-extrusion-floorplan/)) | 실외 지도와 이어 붙일 때 유리하지만 토큰과 요금 관리가 필요함 |
| 배포 | Vercel | 이미 연결돼 있음. 정적 빌드라 무료 플랜으로 충분 |

---

## 7. 발표할 때 예상되는 질문

- **아이폰에서도 돼요?** 웹으로는 안 된다(§2). 제품 단계에서는 네이티브 앱으로 가고, 데모는 시뮬레이션과 Android 라이브로 증명한다.
- **GPS나 Wi-Fi로는 안 돼요?** GPS는 실내에서 신호가 거의 안 잡힌다. Wi-Fi RTT나 핑거프린팅은 AP 위치를 학교가 제공해야 하고, iOS는 Wi-Fi 스캔 API를 막아 놨다. 비콘은 우리가 직접 설치하고 통제할 수 있다.
- **개인정보는요?** 폰이 비콘 신호를 **듣기만** 하고, 위치 계산은 폰 안에서 끝난다. 서버로 위치를 보내지 않는 구조로 설계할 수 있다(Web Bluetooth가 iBeacon을 막은 이유와 정반대 방향).
- **학교 허가는요?** 벽에 부착물을 붙이는 거라 시설팀(Facilities) 승인이 필요할 것이다. 교수님께 경로를 물어볼 것.
