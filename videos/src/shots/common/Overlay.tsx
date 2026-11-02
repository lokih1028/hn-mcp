import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import { mono, sans } from "../../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// A callout: a dot on the subject, a line drawn out to the text.
export type Callout = {
  key: string;
  title: string;
  sub: string;
  dx: number; // label position relative to the anchor, px
  dy: number;
  x?: number; // or: the label's inner edge at this absolute x (lines up a column of labels)
  at: number; // seconds when it starts drawing
  mono?: boolean; // sub line in a monospace face (code)
};

export const Callouts: React.FC<{
  t: number;
  items: (Callout & { ax: number; ay: number })[];
}> = ({ t, items }) => {
  const { width, height } = useVideoConfig();
  return (
    <>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0 }}
      >
        {items.map((l) => {
          const p = interpolate(t, [l.at, l.at + 0.45], [0, 1], clamp);
          if (p <= 0) return null;
          const dx = l.x === undefined ? l.dx : l.x - l.ax;
          const len = Math.hypot(dx, l.dy);
          return (
            <g key={l.key} opacity={Math.min(1, p * 2)}>
              <line
                x1={l.ax}
                y1={l.ay}
                x2={l.ax + dx}
                y2={l.ay + l.dy}
                stroke="rgba(255,255,255,0.8)"
                strokeWidth={1.8}
                strokeDasharray={len}
                strokeDashoffset={len * (1 - p)}
              />
              <circle
                cx={l.ax}
                cy={l.ay}
                r={5 * Math.min(1, p * 3)}
                fill="#fff"
              />
              <circle
                cx={l.ax}
                cy={l.ay}
                r={13 * p}
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth={1.4}
              />
            </g>
          );
        })}
      </svg>
      {items.map((l) => {
        const p = interpolate(t, [l.at + 0.25, l.at + 0.6], [0, 1], clamp);
        if (p <= 0) return null;
        const dx = l.x === undefined ? l.dx : l.x - l.ax;
        const right = dx > 0;
        const x = l.ax + dx + (right ? 12 : -12);
        return (
          <div
            key={l.key}
            style={{
              position: "absolute",
              top: l.ay + l.dy - 30,
              ...(right
                ? { left: Math.min(x, width - 36 - 280) }
                : { right: Math.min(width - x, width - 36 - 280) }),
              width: 280,
              textAlign: right ? "left" : "right",
              color: "#f4f2ec",
              opacity: p,
              transform: `translateY(${(1 - p) * 10}px)`,
              textShadow:
                "0 2px 10px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.9)",
            }}
          >
            <div
              style={{
                fontFamily: sans,
                fontWeight: 900,
                fontSize: 32,
                lineHeight: 1.1,
              }}
            >
              {l.title}
            </div>
            <div
              style={{
                fontFamily: l.mono ? mono : sans,
                fontWeight: l.mono ? 500 : 400,
                fontSize: l.mono ? 19 : 21,
                marginTop: 6,
                color: "rgba(244,242,236,0.75)",
              }}
            >
              {l.sub}
            </div>
          </div>
        );
      })}
    </>
  );
};

// Series title block plus the opening date caption.
export const TitleBlock: React.FC<{
  t: number;
  date: string; // 2011.11.03
  points: number;
  comments: number;
  title: string;
  sub: string;
  titleAt: number;
  subAt: number;
  statsAt: number;
  captionUntil: number;
  titleSize?: number;
}> = ({
  t,
  date,
  points,
  comments,
  title,
  sub,
  titleAt,
  subAt,
  statsAt,
  captionUntil,
  titleSize = 92,
}) => {
  const titleIn = interpolate(t, [titleAt, titleAt + 0.7], [0, 1], clamp);
  const subIn = interpolate(t, [subAt, subAt + 0.6], [0, 1], clamp);
  const statsIn = interpolate(t, [statsAt, statsAt + 0.6], [0, 1], clamp);
  const capIn = interpolate(
    t,
    [0.3, 0.8, captionUntil - 0.5, captionUntil],
    [0, 1, 1, 0],
    clamp,
  );
  return (
    <>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(5,7,9,0.85) 0%, rgba(5,7,9,0.45) 16%, rgba(5,7,9,0) 26%)",
          opacity: titleIn,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 210,
          display: "flex",
          justifyContent: "center",
          opacity: capIn,
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: "0.12em",
            color: "#fff",
            background: "rgba(10,10,12,0.82)",
            padding: "16px 30px",
            borderRadius: 999,
          }}
        >
          {date} · HACKER NEWS
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 96,
          right: 60,
          color: "#f4f2ec",
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: "0.14em",
            color: "#ff6a1a",
            opacity: titleIn,
          }}
        >
          HN 上的今天 · {date}
          <span
            style={{
              color: "rgba(244,242,236,0.6)",
              fontWeight: 500,
              opacity: statsIn,
            }}
          >
            {"  "}▲{points} · {comments} 评论
          </span>
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 900,
            fontSize: titleSize,
            lineHeight: 1.05,
            marginTop: 16,
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 24}px)`,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 400,
            fontSize: 34,
            marginTop: 14,
            color: "rgba(244,242,236,0.78)",
            opacity: subIn,
          }}
        >
          {sub}
        </div>
      </div>
    </>
  );
};
