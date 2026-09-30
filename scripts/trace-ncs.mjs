// Traced NCS geometry, in pixels of each official plan image, converted to venue meters.
// Procedure and calibration: docs/FLOORPLAN_TRACING.md.
//   node scripts/trace-ncs.mjs          -> writes src/data/ncs.json (+ docs/floorplans/overlay-N.svg if images exist)
//   node scripts/trace-ncs.mjs --dump   -> prints the pixel polygons as JSON (for overlay checks)
import { existsSync, writeFileSync } from 'node:fs';

// Scale bar on every sheet: 16 ft = 88.5 px (floor-1 image) -> 4.8768 m / 88.5 px.
const M_PER_PX = 0.0551;
// Origin = SW corner of the footprint, in floor-1 pixels (west wall of the teaching lab, front of the entrance vestibule).
const ORIGIN = [105, 1605];
// Each sheet is drawn at a slightly different offset/scale. Map sheet pixels to floor-1 pixels.
// Fitted by least squares on the east-office walls, spine walls and atrium voids (max residual 3 px ~ 0.17 m).
const REG = {
  1: { ax: 1, bx: 0, ay: 1, by: 0 },
  2: { ax: 1.0088, bx: 1.3, ay: 1.0045, by: 45.8 },
  3: { ax: 0.986, bx: 21.8, ay: 0.9823, by: 111.0 },
};
// Floor-to-floor height is not on the plans; 4.3 m (14 ft) is typical for a lab building. Calibration knob.
const STOREY = 4.3;

const R = (name, category, x0, y0, x1, y1) => ({ name, category, px: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
const P = (name, category, px) => ({ name, category, px });
const NOOK = 'Meeting nook';
/** East office row: one space per bay between consecutive horizontal walls. */
const row = (x0, x1, walls, names) =>
  names.map((n, i) => R(n, n === NOOK ? 'lounge' : 'office', x0, walls[i], x1, walls[i + 1]));
/** Horizontal row of rooms between vertical walls. */
const hrow = (y0, y1, walls, names, category = 'office') =>
  names.map((n, i) => R(n, category, walls[i], y0, walls[i + 1], y1));

const floors = [
  {
    level: 1,
    name: 'Floor 1',
    outline: [[[137, 265], [292, 265], [292, 222], [398, 202], [590, 175], [590, 1212], [512, 1212], [512, 1255], [1030, 1255], [1010, 1380], [995, 1380], [995, 1480], [925, 1480], [925, 1545], [500, 1545], [500, 1605], [395, 1605], [395, 1545], [105, 1545], [105, 1262], [137, 1262]]],
    voids: [],
    spaces: [
      P('Stair (northwest)', 'stairs', [[292, 222], [398, 202], [398, 280], [292, 280]]),
      P('Conf. Room', 'conferenceroom', [[410, 200], [472, 191], [472, 270], [410, 270]]),
      P('RIS Off.', 'office', [[472, 191], [530, 183], [530, 270], [472, 270]]),
      P('RIS Off.', 'office', [[530, 183], [590, 175], [590, 270], [530, 270]]),
      P('North lobby', 'walkway', [[292, 280], [398, 280], [398, 270], [590, 270], [590, 328], [385, 328], [385, 300], [292, 300]]),
      R('Stair (west)', 'stairs', 137, 270, 167, 410),
      R('SYA Equip. Stor.', 'storage', 167, 270, 245, 410),
      R('Lobby Stor.', 'storage', 245, 285, 292, 410),
      R('Restrooms', 'restroom', 292, 300, 385, 437),
      R('Elec. Clo.', 'mechanical', 292, 437, 385, 485),
      R('RVI Stor.', 'storage', 292, 485, 340, 550),
      R('Pantry', 'kitchen', 340, 485, 385, 550),
      R('RVI Digital Med./Grad Labs, RVG Graphics Labs', 'laboratory', 140, 410, 292, 545),
      R('West corridor', 'walkway', 140, 545, 385, 577),
      R('RVI Grad Labs', 'laboratory', 140, 577, 273, 742),
      R('RVI Grad Labs', 'laboratory', 140, 742, 273, 907),
      R('RVG Grad Labs', 'laboratory', 140, 907, 273, 1075),
      P('Grad labs (south bay)', 'laboratory', [[140, 1075], [385, 1075], [385, 1165], [337, 1165], [337, 1212], [140, 1212]]),
      R('Elevator', 'elevator', 337, 1165, 385, 1212),
      R('Lab passage', 'walkway', 273, 577, 385, 602),
      R('RVG 3D Modeling', 'laboratory', 273, 602, 385, 675),
      R('RVI Light Dome Lab', 'laboratory', 273, 675, 385, 780),
      R('SYA Mach. Room', 'mechanical', 273, 780, 385, 837),
      R('Cent. UPS Rm.', 'mechanical', 273, 837, 385, 885),
      R('Lab passage', 'walkway', 273, 885, 385, 935),
      R("RVG Virtual Env'ts Lab", 'laboratory', 273, 935, 385, 1075),
      R('Atrium (main hall)', 'walkway', 385, 328, 505, 1545),
      ...row(505, 587, [328, 382, 438, 493, 550, 603, 659, 714, 770, 826, 883, 936, 992, 1047, 1103, 1159, 1212], [
        'RIS Off.', 'RIS Off.', 'RIS Off.', 'RIS P.Doc Off.', NOOK, 'RIS P.Doc Off.', 'RVG Off.', 'RVG Off.',
        'RVG Off.', 'RVG P.Doc Off.', NOOK, 'RVG P.Doc Off.', 'RVI Off. Fut.', 'RVI Off.', 'RVI Off.', 'RVI Off.',
      ]),
      R('Stair (south)', 'stairs', 200, 1215, 330, 1262),
      R('Wireless Teaching Lab', 'classroom', 105, 1262, 385, 1545),
      R('Main entrance', 'walkway', 395, 1545, 500, 1605),
      R('UNG Teaching Lab', 'classroom', 505, 1262, 675, 1425),
      R('UNG/GRD Comp. Prac. Lab', 'laboratory', 675, 1262, 855, 1370),
      R('Restrooms', 'restroom', 675, 1370, 825, 1430),
      P('UNG/GRD Student Workspace', 'workroom', [[855, 1255], [1030, 1255], [1010, 1380], [855, 1380]]),
      P('East corridor', 'walkway', [[505, 1430], [825, 1430], [825, 1380], [940, 1380], [940, 1475], [505, 1475]]),
      R('Stair (east)', 'stairs', 940, 1380, 995, 1480),
      ...hrow(1475, 1545, [505, 560, 620, 679, 733, 788], ['UNG Adm.', 'GRD Adm.', 'UNG Copy', 'Visitor Off.', 'Visitor Off.']),
      R('Conference Room', 'conferenceroom', 788, 1475, 915, 1545),
    ],
    beacons: [
      [445, 330], [445, 620], [445, 900], [445, 1180], [445, 1480],
      [545, 410], [545, 740], [545, 1075],
      [205, 480], [205, 660], [205, 990], [260, 1140], [330, 720], [450, 235],
      [245, 1400], [590, 1340], [760, 1450], [940, 1320], [850, 1510],
    ],
  },
  {
    level: 2,
    name: 'Floor 2',
    outline: [[[131, 140], [300, 140], [300, 165], [405, 145], [585, 120], [585, 1164], [505, 1164], [505, 1203], [1030, 1203], [1016, 1285], [1012, 1300], [995, 1310], [995, 1440], [915, 1440], [915, 1495], [500, 1495], [500, 1550], [370, 1550], [370, 1440], [205, 1440], [205, 1164], [131, 1164]]],
    voids: [[412, 258, 466, 510], [412, 545, 466, 842], [412, 876, 466, 1128], [412, 1222, 466, 1438]].map(([a, b, c, d]) => [[a, b], [c, b], [c, d], [a, d]]),
    spaces: [
      R('SYA Dir. Off.', 'office', 131, 140, 192, 225),
      R('SYA Off.', 'office', 192, 140, 245, 225),
      R('SYA Off.', 'office', 245, 140, 300, 225),
      P('Stair (northwest)', 'stairs', [[300, 165], [405, 145], [405, 225], [300, 225]]),
      P('Conf. Room', 'conferenceroom', [[405, 145], [470, 135], [470, 225], [405, 225]]),
      P('GRD Fac./Staff Lounge', 'lounge', [[470, 135], [585, 120], [585, 225], [470, 225]]),
      R('North corridor', 'walkway', 131, 225, 500, 252),
      R('SYA Off.', 'office', 131, 252, 207, 305),
      R('SYA Off.', 'office', 131, 305, 207, 362),
      R('SYA Future', 'office', 131, 362, 207, 418),
      R('SYA Off.', 'office', 230, 252, 302, 305),
      R('SYA Off.', 'office', 230, 305, 302, 362),
      P('West corridor', 'walkway', [[207, 252], [230, 252], [230, 362], [270, 362], [270, 377], [207, 377]]),
      R('SYA Copy', 'workroom', 207, 377, 270, 418),
      R('RIS Sound Booths', 'laboratory', 270, 377, 320, 500),
      R('Restrooms', 'restroom', 302, 255, 378, 390),
      R('Elec.', 'mechanical', 320, 390, 378, 445),
      R('Elevator', 'elevator', 322, 455, 378, 500),
      R('RIS Grad Labs', 'laboratory', 131, 418, 270, 528),
      R('RIS Grad Labs', 'laboratory', 131, 528, 270, 693),
      R('RVR Grad Labs', 'laboratory', 131, 693, 270, 858),
      R('RAL Grad Labs', 'laboratory', 131, 858, 270, 1025),
      P('GRD PhD Workspace', 'laboratory', [[131, 1025], [378, 1025], [378, 1125], [330, 1125], [330, 1164], [131, 1164]]),
      R('Elevator', 'elevator', 330, 1125, 378, 1164),
      R('Lab passage', 'walkway', 270, 500, 378, 553),
      R('SYA Work Rm.', 'workroom', 270, 553, 378, 640),
      R('SYA Cent. Mach. Rm.', 'mechanical', 270, 640, 378, 830),
      R('Lab passage', 'walkway', 270, 830, 378, 885),
      R('RAL Grad Labs', 'laboratory', 270, 885, 378, 1000),
      R('Lab passage', 'walkway', 270, 1000, 378, 1025),
      R('Atrium gallery (west side)', 'walkway', 378, 252, 412, 1455),
      R('Atrium gallery (east side)', 'walkway', 466, 252, 500, 1455),
      R('Atrium bridge', 'walkway', 412, 510, 466, 545),
      R('Atrium bridge', 'walkway', 412, 842, 466, 876),
      R('Atrium bridge', 'walkway', 412, 1128, 466, 1222),
      R('South lounge', 'lounge', 370, 1455, 500, 1550),
      ...row(500, 578, [225, 280, 335, 390, 445, 502, 555, 610, 666, 721, 776, 831, 886, 942, 997, 1052, 1107, 1164], [
        'RIS Off.', 'RIS Off.', 'RIS Off. Fut.', 'RVR Off.', 'RVR P.Doc Off.', NOOK, 'RVR P.Doc Off.', 'RVR Off.',
        'RVR Off.', 'RVR Off.', 'RAL P.Doc Off.', NOOK, 'RAL P.Doc Off.', 'RAL Off.', 'RAL Off.', 'RAL Off.', 'RAL Off.',
      ]),
      R('Stair (south)', 'stairs', 205, 1164, 330, 1205),
      R('Pantry', 'kitchen', 325, 1205, 375, 1250),
      P('ADM Work Rm.', 'workroom', [[205, 1205], [325, 1205], [325, 1250], [375, 1250], [375, 1290], [205, 1290]]),
      R('Conference Room', 'conferenceroom', 205, 1290, 375, 1440),
      ...hrow(1205, 1285, [505, 563, 617, 672, 727, 782, 836, 891, 946], Array(8).fill('UNG Off.')),
      P('UNG Dir. Off.', 'office', [[946, 1205], [1030, 1203], [1016, 1285], [946, 1285]]),
      R('East corridor (north)', 'walkway', 505, 1285, 935, 1315),
      R('ADM File', 'storage', 505, 1315, 550, 1400),
      R('ADM Mail/Copy', 'workroom', 550, 1315, 620, 1400),
      R('Restrooms', 'restroom', 620, 1315, 780, 1400),
      R('ADM Conf. A', 'conferenceroom', 780, 1315, 880, 1400),
      R('Tel./Elec.', 'mechanical', 880, 1315, 935, 1400),
      R('Stair (east)', 'stairs', 935, 1310, 995, 1440),
      R('East corridor (south)', 'walkway', 505, 1400, 935, 1420),
      ...hrow(1420, 1495, [505, 564, 618, 672, 727, 782, 837], Array(6).fill('ADM Off.')),
      R("ADM Chair's Off.", 'office', 837, 1420, 915, 1495),
    ],
    beacons: [
      [395, 300], [483, 600], [395, 900], [483, 1200], [435, 1500],
      [540, 360], [540, 690], [540, 1020],
      [170, 470], [170, 610], [170, 940], [250, 1090], [170, 320], [325, 720], [440, 190],
      [290, 1360], [620, 1245], [860, 1245], [700, 1410], [780, 1460],
    ],
  },
  {
    level: 3,
    name: 'Floor 3',
    outline: [
      [[113, 80], [290, 80], [290, 105], [395, 88], [575, 62], [574, 1124], [315, 1124], [315, 1170], [185, 1170], [185, 1124], [113, 1124]],
      [[595, 1220], [935, 1220], [935, 1280], [995, 1280], [995, 1410], [935, 1410], [935, 1390], [595, 1390]],
    ],
    voids: [[401, 198, 457, 456], [401, 491, 457, 794], [401, 830, 457, 1087]].map(([a, b, c, d]) => [[a, b], [c, b], [c, d], [a, d]]),
    spaces: [
      ...hrow(80, 160, [113, 175, 232, 290], Array(3).fill('RWM Off.')),
      P('Stair (northwest)', 'stairs', [[290, 105], [395, 88], [395, 160], [290, 160]]),
      P('Conf. Room', 'conferenceroom', [[395, 88], [455, 78], [455, 160], [395, 160]]),
      P('GRD Stud. Lounge', 'lounge', [[455, 78], [575, 62], [575, 160], [455, 160]]),
      R('North corridor', 'walkway', 113, 160, 490, 190),
      R('RWM Off.', 'office', 113, 190, 195, 255),
      R('RWM P.Doc Off.', 'office', 113, 255, 195, 305),
      R('Pantry / Jan.', 'kitchen', 205, 190, 290, 245),
      R('RWM P.Doc Off.', 'office', 195, 245, 290, 305),
      R('Restrooms', 'restroom', 290, 190, 368, 330),
      R('Elec.', 'mechanical', 305, 330, 368, 385),
      P('RWM Wireless Sensor Lab', 'laboratory', [[255, 305], [290, 305], [290, 330], [305, 330], [305, 385], [368, 385], [368, 445], [255, 445]]),
      R('RWM Grad Labs', 'laboratory', 113, 305, 255, 473),
      R('RCS Grad Labs', 'laboratory', 113, 473, 255, 643),
      R('RCS Grad Labs', 'laboratory', 113, 643, 255, 812),
      R('RCY Grad Labs', 'laboratory', 113, 812, 255, 981),
      P('GRD PhD Workspace', 'laboratory', [[113, 981], [368, 981], [368, 1055], [318, 1055], [318, 1124], [113, 1124]]),
      R('Elevator', 'elevator', 318, 1055, 368, 1124),
      R('Lab passage', 'walkway', 255, 445, 368, 500),
      R('RVR Grad Labs', 'laboratory', 255, 500, 368, 610),
      R('RWM Grad Labs', 'laboratory', 255, 610, 368, 690),
      R('SYA Machine Room', 'mechanical', 255, 690, 368, 785),
      R('Lab passage', 'walkway', 255, 785, 368, 838),
      R('RCY Grad Labs', 'laboratory', 255, 838, 368, 955),
      R('Lab passage', 'walkway', 255, 955, 368, 981),
      R('Atrium gallery (west side)', 'walkway', 368, 190, 401, 1124),
      R('Atrium gallery (east side)', 'walkway', 457, 190, 490, 1124),
      R('Atrium bridge', 'walkway', 401, 456, 457, 491),
      R('Atrium bridge', 'walkway', 401, 794, 457, 830),
      R('Atrium gallery (south end)', 'walkway', 401, 1087, 457, 1124),
      ...row(490, 572, [164, 220, 276, 333, 389, 445, 502, 558, 613, 671, 728, 785, 840, 896, 953, 1009, 1066, 1124], [
        'RCS P.Doc Off.', 'RCS Off.', 'RCS Off.', 'RCS Off.', 'RCS P.Doc Off.', NOOK, 'RCS Off.', 'RCS Off.',
        'RCS Off.', 'RCY Off.', 'RCY P.Doc Off.', NOOK, 'RCY P.Doc Off.', 'RCY Off.', 'RCY Off.', 'RCY Off.', 'RCY Off.',
      ]),
      R('Stair (south)', 'stairs', 185, 1124, 315, 1170),
      R('Mech. Room B', 'mechanical', 595, 1220, 935, 1390),
      R('Stair (east)', 'stairs', 935, 1280, 995, 1410),
    ],
    beacons: [
      [385, 300], [473, 600], [385, 900], [473, 1100],
      [530, 300], [530, 640], [530, 980],
      [180, 390], [180, 560], [180, 900], [240, 1050], [430, 125], [160, 240], [310, 560], [310, 890],
      [760, 1300],
    ],
  },
];

if (process.argv.includes('--dump')) {
  console.log(JSON.stringify(floors.map((f) => ({ level: f.level, outline: f.outline, voids: f.voids, spaces: f.spaces, beacons: f.beacons }))));
  process.exit(0);
}

const r2 = (v) => Math.round(v * 100) / 100;
const toM = (level) => ([x, y]) => {
  const g = REG[level];
  return [r2((g.ax * x + g.bx - ORIGIN[0]) * M_PER_PX), r2((ORIGIN[1] - (g.ay * y + g.by)) * M_PER_PX)];
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const venue = {
  id: 'ncs',
  name: 'New Computer Science Building',
  source: 'Traced from the official floor plans (Mitchell | Giurgola Architects, 2015) published at stonybrook.edu/commcms/csbuilding. See docs/FLOORPLAN_TRACING.md.',
  // ASCII "SBUBEACON1"; demo namespace, program real beacons with it for Live BLE.
  eddystoneNamespace: '53425542454143304e31',
  floors: floors.map((f) => {
    const m = toM(f.level);
    const seen = {};
    return {
      level: f.level,
      name: f.name,
      elevation: r2((f.level - 1) * STOREY),
      height: STOREY,
      outline: f.outline.map((p) => p.map(m)),
      voids: f.voids.map((p) => p.map(m)),
      spaces: f.spaces.map((s) => {
        const base = `f${f.level}-${slug(s.name)}`;
        seen[base] = (seen[base] ?? 0) + 1;
        return { id: `${base}-${seen[base]}`, name: s.name, category: s.category, polygon: s.px.map(m) };
      }),
    };
  }),
  beacons: floors.flatMap((f) =>
    f.beacons.map((p, i) => {
      const [x, y] = toM(f.level)(p);
      return { id: `0000000${f.level}${String(i + 1).padStart(4, '0')}`, floor: f.level, x, y, txPower: -59 };
    }),
  ),
};

writeFileSync(new URL('../src/data/ncs.json', import.meta.url), JSON.stringify(venue, null, 1) + '\n');
console.log(`ncs.json: ${venue.floors.map((f) => `F${f.level} ${f.spaces.length} spaces`).join(', ')}, ${venue.beacons.length} beacons`);

// Overlays for checking a trace against its sheet (open in a browser).
for (const f of floors) {
  const img = new URL(`../docs/floorplans/floor${f.level}.png`, import.meta.url);
  if (!existsSync(img)) continue;
  const poly = (pts, style) => `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" ${style}/>`;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1233 1969">',
    `<image href="floor${f.level}.png" width="1233" height="1969"/>`,
    ...f.outline.map((p) => poly(p, 'fill="none" stroke="#0a0" stroke-width="3"')),
    ...f.voids.map((p) => poly(p, 'fill="#f808" stroke="#f80"')),
    ...f.spaces.map((s) => poly(s.px, 'fill="#08f3" stroke="#00f"')),
    ...f.beacons.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#e00"/>`),
    '</svg>',
  ].join('\n');
  writeFileSync(new URL(`../docs/floorplans/overlay-${f.level}.svg`, import.meta.url), svg);
}
