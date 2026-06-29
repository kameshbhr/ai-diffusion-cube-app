'use client';

import { useRef, useState } from 'react';

export type FaceStatus = 'dark' | 'green' | 'amber' | 'red';

export interface FaceState {
  status: FaceStatus;
  phrase: string;
}

export type CubeState = Record<string, FaceState>;

const DIMENSIONS: { code: string; name: string }[] = [
  { code: 'A', name: 'Problem Orientation' },
  { code: 'B', name: 'Architecture' },
  { code: 'C', name: 'Institution' },
  { code: 'D', name: 'Ecosystem' },
  { code: 'E', name: 'Workforce' },
  { code: 'F', name: 'Operating Model' },
];

const STATUS_COLORS: Record<FaceStatus, string> = {
  dark: '#1A3A5C',
  green: '#3D8B37',
  amber: '#E8A838',
  red: '#D64045',
};

// Six faces: front, back, right, left, top, bottom
const FACE_TRANSFORMS = [
  'rotateY(0deg) translateZ(110px)',
  'rotateY(180deg) translateZ(110px)',
  'rotateY(90deg) translateZ(110px)',
  'rotateY(-90deg) translateZ(110px)',
  'rotateX(90deg) translateZ(110px)',
  'rotateX(-90deg) translateZ(110px)',
];

interface Props {
  cubeState: CubeState;
  onFaceClick: (code: string) => void;
}

export default function Cube3D({ cubeState, onFaceClick }: Props) {
  const [rotX, setRotX] = useState(-20);
  const [rotY, setRotY] = useState(30);
  const dragging = useRef(false);
  const moved = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true;
    moved.current = false;
    last.current = { x: e.clientX, y: e.clientY };
    start.current = { x: e.clientX, y: e.clientY };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    const totalDx = e.clientX - start.current.x;
    const totalDy = e.clientY - start.current.y;
    if (Math.abs(totalDx) > 4 || Math.abs(totalDy) > 4) moved.current = true;
    setRotY((r) => r + dx * 0.5);
    setRotX((r) => r - dy * 0.5);
    last.current = { x: e.clientX, y: e.clientY };
  }

  function onMouseUp() {
    dragging.current = false;
  }

  return (
    <div
      className="flex items-center justify-center w-full h-full select-none"
      style={{ perspective: '800px' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        style={{
          width: 220,
          height: 220,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: dragging.current ? 'none' : 'transform 0.1s',
        }}
      >
        {DIMENSIONS.map((dim, i) => {
          const face = cubeState[dim.code] ?? { status: 'dark', phrase: '' };
          const bg = STATUS_COLORS[face.status];
          return (
            <div
              key={dim.code}
              onClick={() => { if (!moved.current) onFaceClick(dim.code); }}
              style={{
                position: 'absolute',
                width: 220,
                height: 220,
                background: bg,
                transform: FACE_TRANSFORMS[i],
                backfaceVisibility: 'hidden',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                boxSizing: 'border-box',
                color: '#fff',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.95, lineHeight: 1.2, textAlign: 'center' }}>
                {dim.name}
              </span>
              {face.phrase && (
                <span style={{ fontSize: 11, marginTop: 8, opacity: 0.75, lineHeight: 1.3, textAlign: 'center' }}>
                  {face.phrase}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
