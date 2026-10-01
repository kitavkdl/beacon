// Plays camera shots. OrbitControls is disabled during playback (its update() would re-aim the camera every frame);
// any pointer or wheel input on the canvas ends playback at the current pose, and control is handed back without a snap.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { poseAt, totalDuration, type Shot } from './cameraScript';

interface Controls {
  enabled: boolean;
  target: THREE.Vector3;
  update(): void;
}

export interface PlayCommand {
  id: number;
  kind: 'play' | 'skip';
}

export function Director({ shots, command, onShot, stepAt, onStep, onDone }: {
  shots: Shot[];
  command: PlayCommand;
  onShot: (i: number) => void;
  /** Which directions step a shot at progress u shows (null = none); onStep fires only when it changes. */
  stepAt: (shot: number, u: number) => number | null;
  onStep: (step: number | null) => void;
  onDone: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const dom = useThree((s) => s.gl.domElement);
  const t = useRef(0);
  const playing = useRef(false);
  const lastTarget = useRef<[number, number, number] | null>(null);
  const shotIdx = useRef(-1);
  const stepIdx = useRef<number | null>(null);

  const apply = (time: number) => {
    let acc = 0;
    for (let i = 0; i < shots.length; i++) {
      const d = shots[i].durationS;
      if (time <= acc + d || i === shots.length - 1) {
        const u = d ? (time - acc) / d : 1;
        const p = poseAt(shots[i], u);
        const st = stepAt(i, u);
        if (st !== stepIdx.current) {
          stepIdx.current = st;
          onStep(st);
        }
        camera.position.set(...p.pos);
        camera.lookAt(...p.target);
        lastTarget.current = p.target;
        if (shotIdx.current !== i) {
          shotIdx.current = i;
          onShot(i);
        }
        return;
      }
      acc += d;
    }
  };

  const finish = () => {
    if (!playing.current) return;
    playing.current = false;
    if (controls) {
      if (lastTarget.current) controls.target.set(...lastTarget.current);
      controls.enabled = true;
      controls.update();
    }
    onDone();
  };

  useEffect(() => {
    if (!shots.length) return;
    if (command.kind === 'skip') {
      playing.current = true;
      apply(totalDuration(shots));
      finish();
      return;
    }
    t.current = 0;
    shotIdx.current = -1;
    stepIdx.current = null;
    playing.current = true;
    if (controls) controls.enabled = false;
    apply(0);
    // Capture phase, so playback ends (and controls are re-enabled) before OrbitControls sees the same event.
    const stop = () => finish();
    dom.addEventListener('pointerdown', stop, { capture: true });
    dom.addEventListener('wheel', stop, { capture: true, passive: true });
    return () => {
      dom.removeEventListener('pointerdown', stop, { capture: true });
      dom.removeEventListener('wheel', stop, { capture: true });
      finish();
    };
    // Deliberately keyed on the command id and the shot list only: either one restarts playback.
  }, [command.id, shots]);

  useFrame((_, dt) => {
    if (!playing.current) return;
    t.current += dt;
    apply(t.current);
    if (t.current >= totalDuration(shots)) finish();
  });
  return null;
}
