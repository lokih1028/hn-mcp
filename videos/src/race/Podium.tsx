import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, languageColors, mono, sans } from "../theme";

export type PodiumProps = {
  kicker: string;
  title: string;
  ranking: { name: string; value: number }[];
  note: string;
};

// Verdict scene: the headline finding plus the final top three.
export const Podium: React.FC<PodiumProps> = ({ kicker, title, ranking, note }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 0.4 * fps], [0, 1], clamp),
    scale: interpolate(frame, [delay, delay + 0.5 * fps], [0.85, 1], {
      ...clamp,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      output: "perceptual-scale",
    }),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: sans,
        color: colors.text,
        padding: "0 90px 80px",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 52, fontWeight: 700, color: colors.accent, ...pop(0) }}>{kicker}</div>
      <div style={{ marginTop: 24, fontSize: 104, fontWeight: 900, lineHeight: 1.15, whiteSpace: "pre-line", ...pop(0.2 * fps) }}>
        {title}
      </div>

      <div style={{ marginTop: 110, display: "flex", flexDirection: "column", gap: 34 }}>
        {ranking.map((r, i) => (
          <div
            key={r.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 36,
              padding: "30px 40px",
              borderRadius: 24,
              backgroundColor: colors.panel,
              borderLeft: `12px solid ${languageColors[r.name] ?? colors.accent}`,
              ...pop((0.8 + 0.25 * i) * fps),
            }}
          >
            <div style={{ fontFamily: mono, fontSize: 64, fontWeight: 700, color: colors.muted, width: 60 }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 64, fontWeight: 900, flex: 1 }}>{r.name}</div>
            <div style={{ fontFamily: mono, fontSize: 52, fontWeight: 700 }}>{r.value.toFixed(1)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 60, fontSize: 40, color: colors.muted, lineHeight: 1.5, ...pop(1.6 * fps) }}>
        {note}
      </div>
    </AbsoluteFill>
  );
};
