// Traced Melville Library geometry (2014 Emergency Plan, SBU Libraries), plan pixels -> library meters.
// Procedure and calibration: docs/FLOORPLAN_TRACING.md "Melville Library".
//   node scripts/trace-melville.mjs          -> writes src/data/melville.json
//   node scripts/trace-melville.mjs --dump   -> prints { M_PER_PX, ORIGIN, REG, lib } (library in meters; for overlay checks)
import { writeFileSync } from 'node:fs';

// Reference sheet = floor 3 (p5): its outline matches OSM way 54723529 (IoU 0.98). Similarity fit on that outline:
// 0.1115 m/px, plan-up is rotated 9.5 deg from true north, vertex RMS 0.57 m. See docs/FLOORPLAN_TRACING.md.
const M_PER_PX = 0.1115;
const REF = 3;
// SW corner of the floor-1 outline bbox, in reference (floor 3) px. Origin of the library frame.
const ORIGIN = [188, 1389];
// Sheet px -> reference px, per axis, fitted on the column grid (yellow squares) by ICP: RMS 2.1-2.4 px, max <= 5 px.
const REG = {
  0: { ax: 1.0575, bx: -11.423, ay: 1.0541, by: -10.692 },
  1: { ax: 1.0674, bx: -36.063, ay: 1.0643, by: -15.866 },
  2: { ax: 0.9737, bx: 16.279, ay: 0.9762, by: 22.31 },
  3: { ax: 1, bx: 0, ay: 1, by: 0 },
  4: { ax: 0.9861, bx: -10.783, ay: 0.985, by: 18.533 },
  5: { ax: 1.0199, bx: -32.909, ay: 1.0141, by: -47.042 },
};
// Floor-to-floor height is not on the plans; assumed. Calibration knob.
const STOREY = 4.5;
const LATTICE = 0.5;

const snap = (m) => Math.round(m / LATTICE) * LATTICE;
/** Sheet px of floor `level` -> library meters (y up), snapped to the 0.5 m lattice. */
function toM(level, [px, py]) {
  const r = REG[level];
  const fx = r.ax * px + r.bx;
  const fy = r.ay * py + r.by;
  return [snap((fx - ORIGIN[0]) * M_PER_PX), snap((ORIGIN[1] - fy) * M_PER_PX)];
}
/** Axis-aligned rectangle from two sheet-px corners. */
const rectPx = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

// Per floor: outline (rectilinear px polygon), walkable rectangles {id, name, category, px: rectPx, door?: true}.
// Doors are 'walkway' rectangles named 'Doorway' spanning a wall gap.
const W = (id, name, category, x0, y0, x1, y1, door = false) => ({ id, name, category, px: rectPx(x0, y0, x1, y1), door });
const D = (id, x0, y0, x1, y1) => W(id, 'Doorway', 'walkway', x0, y0, x1, y1, true);

// Per floor, in that floor's own sheet px. Outline = union of rectangles (rectilinear, lattice-snapped).
// Walkable rectangles: corridors, open reading/stack areas, stair and elevator cores. Offices are not traced.
const FLOORS = [
  {
    level: 0,
    outline: [
      rectPx(360, 340, 885, 395), rectPx(310, 395, 885, 565), rectPx(205, 445, 310, 1105), rectPx(820, 565, 955, 1310),
    ],
    walk: [
      W('nws0', 'Northwest stairs', 'stairs', 315, 400, 343, 440),
      W('nwe0', 'Northwest elevator', 'elevator', 350, 400, 372, 440),
      W('nwl0', 'Northwest lobby, basement', 'walkway', 315, 440, 372, 455),
      W('w0', 'West corridor, basement', 'walkway', 340, 455, 355, 550),
      W('n0', 'North corridor, basement', 'walkway', 310, 550, 830, 565),
      W('e0', 'East corridor, basement', 'walkway', 830, 345, 850, 1275),
      W('nee0', 'Northeast elevators', 'elevator', 850, 575, 872, 610),
      W('ses0', 'Southeast stairs', 'stairs', 830, 1275, 852, 1310),
    ],
  },
  {
    level: 1,
    outline: [
      rectPx(390, 320, 835, 555), rectPx(325, 400, 390, 555), rectPx(210, 445, 325, 555), rectPx(210, 555, 400, 1090),
      rectPx(400, 555, 835, 1090), rectPx(835, 550, 950, 1255), rectPx(270, 1090, 835, 1320), rectPx(835, 1255, 890, 1310), rectPx(235, 1090, 270, 1100),
    ],
    walk: [
      W('nr1', 'North Reading Room', 'lounge', 390, 380, 835, 555),
      W('nws1', 'Northwest stairs', 'stairs', 330, 400, 360, 445),
      W('nwe1', 'Northwest elevator', 'elevator', 368, 400, 390, 445),
      W('nwl1', 'Northwest lobby, floor 1', 'walkway', 330, 445, 390, 460),
      W('nel1', 'North elevator (west)', 'elevator', 520, 350, 545, 380),
      W('nsl1', 'North stairs (west)', 'stairs', 552, 350, 590, 380),
      W('nsr1', 'North stairs (east)', 'stairs', 700, 350, 740, 380),
      W('ner1', 'North elevator (east)', 'elevator', 747, 350, 770, 380),
      W('w1', 'West corridor, floor 1', 'walkway', 400, 555, 420, 1090),
      W('e1', 'East corridor, floor 1', 'walkway', 765, 555, 785, 1090),
      W('nel1x', 'Northeast lobby, floor 1', 'walkway', 785, 590, 860, 605),
      W('nee1', 'Northeast elevators', 'elevator', 860, 570, 890, 620),
      W('crr1', 'Central Reading Room', 'lounge', 430, 780, 755, 995),
      W('s1', 'South corridor, floor 1', 'walkway', 270, 1090, 790, 1110),
      W('sws1', 'Southwest stairs', 'stairs', 235, 1065, 270, 1100),
      W('sp1', 'South passage, floor 1', 'walkway', 590, 1110, 605, 1255),
      W('sl1', 'South corridor (lower), floor 1', 'walkway', 270, 1255, 840, 1280),
      W('sel1', 'South elevator (west)', 'elevator', 400, 1280, 425, 1310),
      W('ssl1', 'South stairs (west)', 'stairs', 432, 1280, 460, 1310),
      W('ssr1', 'South stairs (east)', 'stairs', 600, 1280, 625, 1310),
      W('ser1', 'South elevator (east)', 'elevator', 630, 1280, 650, 1310),
      W('ses1', 'Southeast stairs', 'stairs', 840, 1260, 890, 1310),
      D('d1w', 420, 900, 430, 915),
      D('d1e', 755, 900, 765, 915),
    ],
  },
  {
    level: 5,
    outline: [
      rectPx(405, 370, 940, 630), rectPx(340, 455, 405, 495), rectPx(210, 495, 345, 1150), rectPx(345, 495, 405, 630),
      rectPx(345, 630, 880, 1180), rectPx(880, 630, 1010, 1345), rectPx(270, 1150, 345, 1180), rectPx(280, 1180, 815, 1440),
      rectPx(815, 1180, 880, 1345), rectPx(880, 1345, 925, 1400), rectPx(210, 1150, 270, 1180), rectPx(225, 1180, 280, 1195),
    ],
    // Centre is "EXISTING ROOF"; the band north of it reads "SKYLIGHT BELOW".
    voids: [rectPx(345, 615, 875, 1155)],
    walk: [
      W('w5', 'West corridor, floor 5', 'walkway', 320, 510, 342, 1160),
      W('nwl5', 'Northwest lobby, floor 5', 'walkway', 320, 495, 405, 510),
      W('nws5', 'Northwest stairs', 'stairs', 345, 458, 375, 495),
      W('nwe5', 'Northwest elevator', 'elevator', 382, 458, 402, 495),
      W('nr5', 'North corridor, floor 5', 'walkway', 405, 490, 935, 505),
      W('e5', 'East corridor, floor 5', 'walkway', 878, 615, 897, 1345),
      W('nee5', 'Northeast elevators', 'elevator', 897, 625, 925, 675),
      W('s5', 'South corridor, floor 5', 'walkway', 270, 1160, 878, 1180),
      W('sws5', 'Southwest stairs', 'stairs', 225, 1150, 270, 1195),
      W('ses5', 'Southeast stairs', 'stairs', 880, 1345, 925, 1400),
    ],
  },
  {
    level: 4,
    outline: [
      rectPx(390, 315, 945, 560), rectPx(320, 395, 390, 445), rectPx(195, 445, 335, 1130), rectPx(335, 445, 390, 560),
      rectPx(335, 560, 905, 1130), rectPx(905, 560, 1015, 1320), rectPx(265, 1130, 820, 1405), rectPx(820, 1130, 905, 1330),
      rectPx(885, 1330, 930, 1375), rectPx(195, 1130, 265, 1160),
    ],
    // Centre is "ROOF" around a "MECH. EQP. RM" penthouse: no floor-4 stacks.
    voids: [rectPx(340, 605, 800, 1120)],
    walk: [
      W('w4', 'West corridor, floor 4', 'walkway', 262, 460, 280, 1130),
      W('nwl4', 'Northwest lobby, floor 4', 'walkway', 262, 445, 410, 460),
      W('nws4', 'Northwest stairs', 'stairs', 325, 400, 355, 445),
      W('nwe4', 'Northwest elevator', 'elevator', 368, 400, 395, 445),
      W('nrw4', 'North corridor, floor 4', 'walkway', 410, 392, 430, 540),
      W('nrt4', 'North corridor, floor 4', 'walkway', 410, 372, 930, 392),
      W('nre4', 'North corridor, floor 4', 'walkway', 910, 392, 930, 540),
      W('nrs4', 'North corridor, floor 4', 'walkway', 410, 540, 930, 560),
      W('nel4', 'North elevator (west)', 'elevator', 535, 340, 563, 372),
      W('nsl4', 'North stairs (west)', 'stairs', 572, 340, 610, 372),
      W('nsr4', 'North stairs (east)', 'stairs', 730, 340, 775, 372),
      W('ner4', 'North elevator (east)', 'elevator', 782, 340, 810, 372),
      W('e4', 'East corridor, floor 4', 'walkway', 885, 560, 905, 1330),
      W('nee4', 'Northeast elevators', 'elevator', 905, 585, 930, 630),
      W('s4', 'South corridor, floor 4', 'walkway', 252, 1130, 885, 1160),
      W('sws4', 'Southwest stairs', 'stairs', 215, 1115, 252, 1160),
      W('sr4', 'South reading area, floor 4', 'lounge', 265, 1160, 820, 1350),
      W('sel4', 'South elevator (west)', 'elevator', 410, 1350, 435, 1385),
      W('ssl4', 'South stairs (west)', 'stairs', 445, 1350, 480, 1385),
      W('ssr4', 'South stairs (east)', 'stairs', 610, 1350, 645, 1385),
      W('ser4', 'South elevator (east)', 'elevator', 652, 1350, 680, 1385),
      W('ses4', 'Southeast stairs', 'stairs', 885, 1330, 930, 1375),
    ],
  },
  {
    level: 2,
    outline: [
      rectPx(375, 315, 930, 595), rectPx(300, 395, 375, 445), rectPx(170, 440, 305, 1140), rectPx(305, 445, 375, 595),
      rectPx(305, 595, 880, 1140), rectPx(880, 560, 1005, 1340), rectPx(200, 1140, 870, 1405), rectPx(870, 1140, 880, 1340),
      rectPx(870, 1340, 915, 1390),
    ],
    // Atrium over floor 1, and the strip printed "OPEN - UPPER PART OF GALLERIA" east of the stacks.
    voids: [rectPx(525, 400, 785, 480), rectPx(805, 605, 860, 1130)],
    walk: [
      W('w2', 'West corridor, floor 2', 'walkway', 285, 445, 305, 1140),
      W('nwl2', 'Northwest lobby, floor 2', 'walkway', 305, 445, 375, 460),
      W('nws2', 'Northwest stairs', 'stairs', 312, 400, 340, 445),
      W('nwe2', 'Northwest elevator', 'elevator', 348, 400, 370, 445),
      W('na2', 'North reading area, floor 2', 'lounge', 375, 372, 930, 400),
      W('nb2', 'North reading area, floor 2', 'lounge', 375, 400, 525, 480),
      W('nc2', 'North reading area, floor 2', 'lounge', 785, 400, 930, 480),
      W('nd2', 'North reading area, floor 2', 'lounge', 375, 480, 880, 595),
      W('nel2', 'North elevator (west)', 'elevator', 515, 340, 540, 372),
      W('nsl2', 'North stairs (west)', 'stairs', 548, 340, 595, 372),
      W('nsr2', 'North stairs (east)', 'stairs', 710, 340, 755, 372),
      W('ner2', 'North elevator (east)', 'elevator', 762, 340, 790, 372),
      W('e2', 'East corridor, floor 2', 'walkway', 865, 595, 880, 1340),
      W('nee2', 'Northeast elevators', 'elevator', 880, 600, 915, 630),
      W('stw2', 'Main stacks, floor 2', 'lounge', 415, 605, 555, 1130),
      W('stb2', 'Main stacks, floor 2', 'lounge', 555, 1050, 650, 1130),
      W('ste2', 'Main stacks, floor 2', 'lounge', 650, 605, 800, 1130),
      W('s2', 'South corridor, floor 2', 'walkway', 245, 1140, 865, 1160),
      W('sws2', 'Southwest stairs', 'stairs', 205, 1125, 245, 1160),
      W('sr2', 'South reading area, floor 2', 'lounge', 245, 1160, 700, 1355),
      W('sel2', 'South elevator (west)', 'elevator', 385, 1355, 405, 1390),
      W('ssl2', 'South stairs (west)', 'stairs', 415, 1355, 455, 1390),
      W('ssr2', 'South stairs (east)', 'stairs', 603, 1355, 635, 1390),
      W('ser2', 'South elevator (east)', 'elevator', 643, 1355, 662, 1390),
      W('ses2', 'Southeast stairs', 'stairs', 870, 1340, 910, 1390),
      D('d2n1', 480, 595, 495, 605),
      D('d2n2', 760, 595, 775, 605),
      D('d2s', 500, 1130, 515, 1140),
    ],
  },
  {
    level: 3,
    outline: [
      rectPx(380, 320, 925, 567), rectPx(312, 405, 380, 449), rectPx(204, 449, 320, 1150), rectPx(320, 449, 380, 567),
      rectPx(320, 567, 880, 1150), rectPx(880, 567, 975, 1330), rectPx(247, 1150, 795, 1405), rectPx(795, 1150, 880, 1330),
      rectPx(857, 1330, 905, 1370),
    ],
    // "ROOF" west of the stacks, and "OPEN - UPPER PART OF GALLERIA" east of them.
    voids: [rectPx(322, 600, 415, 1110), rectPx(805, 600, 858, 1110)],
    walk: [
      W('w3', 'West corridor, floor 3', 'walkway', 293, 465, 315, 1120),
      W('nwl3', 'Northwest lobby, floor 3', 'walkway', 293, 449, 380, 465),
      W('nws3', 'Northwest stairs', 'stairs', 312, 409, 350, 449),
      W('nwe3', 'Northwest elevator', 'elevator', 360, 409, 380, 449),
      W('nrw3', 'North corridor, floor 3', 'walkway', 380, 407, 403, 547),
      W('nrt3', 'North corridor, floor 3', 'walkway', 380, 387, 895, 407),
      W('nre3', 'North corridor, floor 3', 'walkway', 883, 407, 895, 547),
      W('nrs3', 'North corridor, floor 3', 'walkway', 380, 547, 895, 567),
      W('nel3', 'North elevator (west)', 'elevator', 520, 355, 545, 387),
      W('nsl3', 'North stairs (west)', 'stairs', 552, 355, 597, 387),
      W('nsr3', 'North stairs (east)', 'stairs', 710, 355, 753, 387),
      W('ner3', 'North elevator (east)', 'elevator', 760, 355, 787, 387),
      W('e3', 'East corridor, floor 3', 'walkway', 862, 567, 883, 1330),
      W('nee3', 'Northeast elevators', 'elevator', 883, 587, 910, 643),
      W('s3', 'South corridor, floor 3', 'walkway', 247, 1120, 862, 1150),
      W('sws3', 'Southwest stairs', 'stairs', 209, 1108, 247, 1150),
      W('sr3', 'South reading area, floor 3', 'lounge', 247, 1150, 720, 1345),
      W('sel3', 'South elevator (west)', 'elevator', 395, 1345, 415, 1375),
      W('ssl3', 'South stairs (west)', 'stairs', 425, 1345, 455, 1375),
      W('ssr3', 'South stairs (east)', 'stairs', 603, 1345, 630, 1375),
      W('ser3', 'South elevator (east)', 'elevator', 637, 1345, 657, 1375),
      W('ses3', 'Southeast stairs', 'stairs', 862, 1330, 900, 1370),
      W('stw3', 'Main stacks, floor 3', 'lounge', 420, 600, 555, 1110),
      W('stn3', 'Main stacks, floor 3', 'lounge', 555, 600, 665, 670),
      W('sts3', 'Main stacks, floor 3', 'lounge', 555, 1045, 665, 1110),
      W('ste3', 'Main stacks, floor 3', 'lounge', 665, 600, 800, 1110),
      D('d3s', 700, 1110, 715, 1120),
      D('d3n', 630, 567, 645, 600),
    ],
  },
];
// Pairs of walkable ids per floor that may share an edge (doorways and open joins). Anything else touching is an error.
const OPENINGS = {
  0: [
    ['nws0', 'nwl0'], ['nwe0', 'nwl0'], ['nwl0', 'w0'], ['w0', 'n0'], ['n0', 'e0'], ['e0', 'nee0'], ['e0', 'ses0'],
  ],
  1: [
    ['nr1', 'nwe1'], ['nws1', 'nwl1'], ['nwe1', 'nwl1'], ['nwl1', 'nr1'], ['nr1', 'nel1'], ['nr1', 'nsl1'], ['nr1', 'nsr1'],
    ['nr1', 'ner1'], ['nr1', 'w1'], ['nr1', 'e1'], ['e1', 'nel1x'], ['nel1x', 'nee1'], ['d1w', 'w1'], ['d1w', 'crr1'],
    ['d1e', 'crr1'], ['d1e', 'e1'], ['w1', 's1'], ['e1', 's1'], ['s1', 'sws1'], ['s1', 'sp1'], ['sp1', 'sl1'],
    ['sl1', 'sel1'], ['sl1', 'ssl1'], ['sl1', 'ssr1'], ['sl1', 'ser1'], ['sl1', 'ses1'],
  ],
  5: [
    ['w5', 'nwl5'], ['nwl5', 'nws5'], ['nwl5', 'nwe5'], ['nwl5', 'nr5'], ['e5', 'nee5'],
    ['w5', 's5'], ['s5', 'sws5'], ['s5', 'e5'], ['e5', 'ses5'],
  ],
  4: [
    ['w4', 'nwl4'], ['nwl4', 'nws4'], ['nwl4', 'nwe4'], ['nwl4', 'nrw4'], ['nrw4', 'nrt4'], ['nrw4', 'nrs4'],
    ['nrt4', 'nre4'], ['nre4', 'nrs4'], ['nrt4', 'nel4'], ['nrt4', 'nsl4'], ['nrt4', 'nsr4'], ['nrt4', 'ner4'],
    ['nrs4', 'e4'], ['e4', 'nee4'], ['w4', 's4'], ['s4', 'sws4'], ['s4', 'sr4'], ['s4', 'e4'], ['sr4', 'sel4'],
    ['sr4', 'ssl4'], ['sr4', 'ser4'], ['sr4', 'ssr4'], ['e4', 'ses4'],
  ],
  2: [
    ['w2', 'nwl2'], ['nwl2', 'nws2'], ['nwl2', 'nwe2'], ['nwl2', 'nb2'], ['na2', 'nb2'], ['na2', 'nc2'], ['nb2', 'nd2'],
    ['nc2', 'nd2'], ['na2', 'nel2'], ['na2', 'nsl2'], ['na2', 'nsr2'], ['na2', 'ner2'], ['nd2', 'e2'], ['e2', 'nee2'],
    ['stw2', 'stb2'], ['stb2', 'ste2'], ['d2n1', 'nd2'], ['d2n1', 'stw2'], ['d2n2', 'nd2'], ['d2n2', 'ste2'],
    ['d2s', 'stw2'], ['d2s', 's2'], ['w2', 's2'], ['s2', 'e2'], ['s2', 'sws2'],
    ['s2', 'sr2'], ['sr2', 'sel2'], ['sr2', 'ssl2'], ['sr2', 'ser2'], ['sr2', 'ssr2'], ['e2', 'ses2'],
  ],
  3: [
    ['w3', 'nwl3'], ['nwl3', 'nws3'], ['nwl3', 'nwe3'], ['nwe3', 'nrw3'], ['nwl3', 'nrw3'], ['nrw3', 'nrt3'], ['nrw3', 'nrs3'],
    ['nrt3', 'nre3'], ['nre3', 'nrs3'], ['nrt3', 'nel3'], ['nrt3', 'nsl3'], ['nrt3', 'nsr3'], ['nrt3', 'ner3'],
    ['nrs3', 'e3'], ['e3', 'nee3'], ['w3', 's3'], ['s3', 'sws3'], ['s3', 'sr3'], ['s3', 'e3'], ['sr3', 'sel3'],
    ['sr3', 'ssl3'], ['sr3', 'ser3'], ['sr3', 'ssr3'], ['e3', 'ses3'],
    ['stw3', 'stn3'], ['stw3', 'sts3'], ['stn3', 'ste3'], ['sts3', 'ste3'],
    ['d3s', 'ste3'], ['d3s', 's3'], ['d3n', 'nrs3'], ['d3n', 'stn3'],
  ],
};
// Cores: one reference-px (floor 3 sheet) point each, served floors. The point must lie inside the core rectangle on every listed floor.
const CONNECTORS = [
  { id: 'nw-elevator', kind: 'elevator', name: 'Northwest elevator', px: [368, 429], floors: [0, 1, 2, 3, 4, 5] },
  { id: 'nw-stairs', kind: 'stairs', name: 'Northwest stairs', px: [334, 429], floors: [0, 1, 2, 3, 4, 5] },
  { id: 'n-elevator-w', kind: 'elevator', name: 'North elevator (west)', px: [532, 371], floors: [1, 2, 3, 4] },
  { id: 'n-stairs-w', kind: 'stairs', name: 'North stairs (west)', px: [575, 371], floors: [1, 2, 3, 4] },
  { id: 'n-stairs-e', kind: 'stairs', name: 'North stairs (east)', px: [731, 371], floors: [1, 2, 3, 4] },
  { id: 'n-elevator-e', kind: 'elevator', name: 'North elevator (east)', px: [773, 371], floors: [1, 2, 3, 4] },
  { id: 'ne-elevators', kind: 'elevator', name: 'Northeast elevators', px: [896, 615], floors: [0, 1, 2, 3, 4, 5] },
  { id: 'sw-stairs', kind: 'stairs', name: 'Southwest stairs', px: [228, 1129], floors: [1, 2, 3, 4, 5] },
  { id: 'se-stairs', kind: 'stairs', name: 'Southeast stairs', px: [881, 1350], floors: [0, 1, 2, 3, 4, 5] },
  { id: 's-elevator-w', kind: 'elevator', name: 'South elevator (west)', px: [405, 1360], floors: [1, 2, 3, 4] },
  { id: 's-stairs-w', kind: 'stairs', name: 'South stairs (west)', px: [440, 1360], floors: [1, 2, 3, 4] },
  { id: 's-elevator-e', kind: 'elevator', name: 'South elevator (east)', px: [646, 1360], floors: [1, 2, 3, 4] },
  { id: 's-stairs-e', kind: 'stairs', name: 'South stairs (east)', px: [617, 1360], floors: [1, 2, 3, 4] },
];
// Wing zones per floor: { zone: rectPx, entry: [px, py] } keyed by wing letter N/S/E/W/C.
const ZONES = {
  0: {
    N: { zone: rectPx(360, 345, 800, 455), entry: [580, 557] },
    W: { zone: rectPx(210, 460, 335, 1100), entry: [347, 500] },
    E: { zone: rectPx(850, 615, 950, 1270), entry: [840, 900] },
  },
  1: {
    N: { zone: rectPx(390, 380, 835, 555), entry: [600, 470] },
    C: { zone: rectPx(430, 780, 755, 995), entry: [590, 900] },
    W: { zone: rectPx(210, 460, 400, 1085), entry: [410, 800] },
    E: { zone: rectPx(785, 620, 950, 1250), entry: [775, 950] },
    S: { zone: rectPx(270, 1110, 790, 1255), entry: [500, 1100] },
  },
  5: {
    N: { zone: rectPx(405, 505, 935, 615), entry: [660, 498] },
    W: { zone: rectPx(210, 510, 320, 1150), entry: [331, 800] },
    E: { zone: rectPx(897, 680, 1010, 1340), entry: [887, 950] },
    S: { zone: rectPx(280, 1180, 815, 1300), entry: [550, 1170] },
  },
  4: {
    N: { zone: rectPx(430, 392, 910, 540), entry: [670, 550] },
    E: { zone: rectPx(905, 640, 1015, 1320), entry: [895, 950] },
  },
  2: {
    W: { zone: rectPx(170, 450, 285, 1120), entry: [295, 800] },
    E: { zone: rectPx(880, 640, 1005, 1330), entry: [872, 950] },
  },
  3: {
    N: { zone: rectPx(403, 407, 883, 547), entry: [640, 557] },
    W: { zone: rectPx(204, 465, 293, 1110), entry: [304, 790] },
    E: { zone: rectPx(883, 650, 975, 1320), entry: [872, 950] },
    S: { zone: rectPx(720, 1150, 862, 1330), entry: [790, 1135] },
  },
};
// Tags at public points, descriptive names only.
const TAGS = [
  { id: 'b-north-corridor', name: 'Basement, north corridor', floor: 0, px: [500, 557] },
  { id: 'f1-north-reading-room', name: 'Floor 1, North Reading Room', floor: 1, px: [600, 500] },
  { id: 'f1-central-reading-room', name: 'Floor 1, Central Reading Room', floor: 1, px: [590, 860] },
  { id: 'f1-south-corridor', name: 'Floor 1, south corridor', floor: 1, px: [450, 1100] },
  { id: 'f5-northwest-lobby', name: 'Floor 5, northwest lobby', floor: 5, px: [360, 502] },
  { id: 'f4-north-elevators', name: 'Floor 4, north elevators', floor: 4, px: [548, 382] },
  { id: 'f2-north-reading', name: 'Floor 2, north reading area', floor: 2, px: [650, 540] },
  { id: 'f3-north-elevators', name: 'Floor 3, north elevators', floor: 3, px: [535, 397] },
  { id: 'f3-south-reading', name: 'Floor 3, south reading area', floor: 3, px: [480, 1250] },
];

// Places: number + department/room name only. Sources opened 2026-10-01 (research note §5 A, B; PDF pp. 9-10).
// PDF rows were read with PyMuPDF word positions, keeping only the "Departments" and "Room #" columns (names and
// phones were never extracted). Review ② re-checks every row against pp. 9-10.
// Rules: same number or same name in both sources -> keep the library-web row (so PDF E2321 "Special Collections"
// and N1000 "North Reading Room" give way to web E2320 and N1001). Sub-basement (SB0003) and truncated source names
// (E0319) are left out. Duplicate numbers in the PDF are merged (W5510: the PDF lists "Grants Management" and
// "Sponsored Programs" as two rows with one room number; the name joins both) or dropped (E0305 housekeeping).
// Facility names that contain a donor's name ("William and Jane Knapp Alumni Center") are names of places, not people.
const PLACES = [
  // floor 5 (emergency-plan-2014)
  ['E5450', 'Center for India Studies'], ['N5520', 'Center for Korean Studies'], ['S5410', 'Client Support'],
  ['S5420', 'Application Support for Administration'], ['W5510', 'Grants Management and Sponsored Programs'],
  ['E5320', 'Intensive English Center'], ['E5311', 'International Programs Study Abroad'],
  ['N5004', 'Language Learning and Research Center'], ['N5002', 'Office of Technology Licensing and Industry Relations'],
  ['S5422', 'Office of the Vice President of Research'], ['W5530', 'Research Compliance and Informatics'],
  ['S5415', 'United University Professions'], ['E5310', 'Visa and Immigration Services'],
  // floor 4
  ['E4340', 'Center for Italian Studies'], ['E4341', 'European Languages, Literatures, and Cultures'],
  ['N4064', 'Professional Education Program'], ['N4004', 'School of Journalism'],
  // floor 3
  ['E3320', 'College of Arts and Sciences'], ['W3520', 'EOP/AIM'], ['N3022', 'Hispanic Languages and Literature'],
  ['N3071', 'Honors College'], ['S3417', 'Library Circulation Stacks / Interlibrary Loan'],
  ['S3413', 'Library Photocopy Service'], ['E3310', 'Office of Undergraduate Education'],
  ['W3519', 'Student Orientation Programs'],
  // floor 2
  ['E2360', 'Academic Advising'], ['W2550', 'Library Preservation'], ['W2523', 'Library Technical Services'],
  // floor 1
  ['C1600', 'Central Reading Room'], ['S1460', 'The Faculty Center'], ['E1340', 'International Academic Programs'],
  ['W1508', 'Library Administration'], ['S1464', 'Library SINC Site'], ['E1337', 'Newsroom'],
  ['S1430', 'Teaching Learning Lab'], ['E1315', 'William and Jane Knapp Alumni Center'],
  // basement
  ['W0550', 'Career Development Center'], ['E0305', 'Employee Assistance'], ['E0320', 'UPS Store'],
  ['W0521', 'Sustainability Studies'], ['N0001', 'University Bookstore'],
].map(([number, name]) => ({ number, name, source: 'emergency-plan-2014' }))
  .concat([
    // library web (guides.library.stonybrook.edu/firstyearstudents/libraries)
    { number: 'W1530', name: 'Music Library', source: 'library-web' },
    { number: 'N1001', name: 'North Reading Room', source: 'library-web' },
    { number: 'E2320', name: 'Special Collections & University Archives', source: 'library-web' },
  ]);

const errors = [];
/** Collects every check failure; build() throws them all at once. */
function fail(msg) {
  errors.push(msg);
}

// --- checks on snapped rectangles (meters) ---
const rectM = (level, r) => {
  const [ax, ay] = toM(level, [r.x0, r.y1]);
  const [bx, by] = toM(level, [r.x1, r.y0]);
  return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
};
const sharedEdge = (a, b) => {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (ox > 0 && oy > 0) return { overlap: true, len: 0 };
  if ((a.x1 === b.x0 || b.x1 === a.x0) && oy > 0) return { overlap: false, len: oy };
  if ((a.y1 === b.y0 || b.y1 === a.y0) && ox > 0) return { overlap: false, len: ox };
  return { overlap: false, len: 0 };
};

function checkFloor(f) {
  const rs = f.walk.map((w) => ({ ...w, m: rectM(f.level, w.px) }));
  const allowed = new Set((OPENINGS[f.level] ?? []).map(([a, b]) => [a, b].sort().join('|')));
  const used = new Set();
  for (const r of rs) {
    const wM = r.m.x1 - r.m.x0;
    const hM = r.m.y1 - r.m.y0;
    if (!r.door && Math.min(wM, hM) < 1) fail(`${r.id}: narrower than 1 m after snapping`);
  }
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i];
      const b = rs[j];
      const key = [a.id, b.id].sort().join('|');
      const e = sharedEdge(a.m, b.m);
      if (e.overlap) fail(`${a.id} overlaps ${b.id}`);
      if (e.len > 0) {
        if (!allowed.has(key)) fail(`${a.id} touches ${b.id} but is not in OPENINGS (a wall would vanish)`);
        // A door's width is the edge it shares with the room or corridor on either side.
        if ((a.door || b.door) && e.len < 1) fail(`${a.id}/${b.id}: door opening narrower than 1 m`);
        used.add(key);
      }
      // No separate wall-gap check: every coordinate is on the 0.5 m lattice, so non-touching rectangles are >= 0.5 m apart.
    }
  for (const k of allowed) if (!used.has(k)) fail(`OPENINGS ${k} on floor ${f.level} does not touch`);
}

const rectPoly = (m) => [[m.x0, m.y0], [m.x1, m.y0], [m.x1, m.y1], [m.x0, m.y1]];
const canon = (n) => n.toUpperCase().replace(/-/g, '');

function build() {
  FLOORS.forEach(checkFloor);
  const ids = new Set();
  const library = {
    id: 'melville',
    name: 'Frank Melville Jr. Memorial Library',
    source: 'Melville Library Emergency Plan, SBU Libraries, 2014-11-24 (pp. 3-8), traced; room numbers from its directory (pp. 9-10) and the library website',
    floors: [...FLOORS].sort((a, b) => a.level - b.level).map((f) => ({
      level: f.level,
      name: f.level === 0 ? 'Basement' : `Floor ${f.level}`,
      elevation: (f.level - 1) * STOREY, // slab top above ground: floor 1 at 0, basement at -STOREY
      height: STOREY,
      outline: f.outline.map((r) => rectPoly(rectM(f.level, r))),
      voids: (f.voids ?? []).map((r) => rectPoly(rectM(f.level, r))),
      spaces: f.walk.map((w) => ({ id: w.id, name: w.name, category: w.category, polygon: rectPoly(rectM(f.level, w.px)) })),
    })),
    tags: TAGS.map((t) => {
      const [x, y] = toM(t.floor, t.px);
      return { id: t.id, name: t.name, floor: t.floor, x: x + 0.25, y: y + 0.25 };
    }),
    connectors: CONNECTORS.map((c) => {
      const [x, y] = toM(REF, c.px);
      return { id: c.id, kind: c.kind, name: c.name, x: x + 0.25, y: y + 0.25, floors: c.floors };
    }),
    places: PLACES.flatMap((p) => {
      const number = canon(p.number);
      const wing = number[0];
      const floor = Number(number[1]);
      const z = ZONES[floor]?.[wing];
      if (!z) {
        console.warn(`left out ${number}: no ${wing} zone on floor ${floor}`);
        return [];
      }
      if (ids.has(number)) fail(`duplicate place ${number}`);
      ids.add(number);
      const [ex, ey] = toM(floor, z.entry);
      return [{ id: number, number, name: p.name, floor, zone: rectPoly(rectM(floor, z.zone)), entry: [ex + 0.25, ey + 0.25], source: p.source }];
    }),
  };
  if (errors.length) throw new Error(`trace-melville:\n  ${errors.join('\n  ')}`);
  return library;
}

const lib = build();
if (process.argv.includes('--dump')) console.log(JSON.stringify({ M_PER_PX, ORIGIN, REG, lib }, null, 1));
else writeFileSync(new URL('../src/data/melville.json', import.meta.url), JSON.stringify(lib, null, 1) + '\n');
