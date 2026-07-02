interface Props {
  size?: number;
  className?: string;
}

const FACE_COLORS = ['#D9861F', '#7A5C44', '#C4A882', '#2C1A0E', '#D9B98C', '#3A2414'];

export default function CubeIcon({ size = 28, className = '' }: Props) {
  const half = size / 2;
  const faceTransforms = [
    `rotateY(0deg) translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ];

  return (
    <div
      className={`inline-block flex-shrink-0 ${className}`}
      style={{ width: size, height: size, perspective: size * 4 }}
    >
      <div
        className="animate-cube-icon-spin"
        style={{
          width: size,
          height: size,
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}
      >
        {faceTransforms.map((transform, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              background: FACE_COLORS[i],
              transform,
              backfaceVisibility: 'hidden',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: Math.max(2, size * 0.08),
            }}
          />
        ))}
      </div>
    </div>
  );
}
