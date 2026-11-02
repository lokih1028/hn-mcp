import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, sans } from "../theme";

export type TitleCardProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
};

// Full-screen title used for hooks and endings: kicker, headline, subtitle
// rising in one after another.
export const TitleCard: React.FC<TitleCardProps> = ({ kicker, title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 0.5 * fps], [0, 1], {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
    translate: interpolate(frame, [delay, delay + 0.6 * fps], ["0px 40px", "0px 0px"], {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 35%, #2a1608 0%, ${colors.bg} 60%)`,
        justifyContent: "center",
        padding: "0 90px",
        fontFamily: sans,
        color: colors.text,
      }}
    >
      {kicker ? (
        <div style={{ fontSize: 48, fontWeight: 700, color: colors.accent, marginBottom: 36, ...rise(0) }}>
          {kicker}
        </div>
      ) : null}
      <div style={{ fontSize: 112, fontWeight: 900, lineHeight: 1.15, textWrap: "balance", ...rise(0.2 * fps) }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ fontSize: 52, lineHeight: 1.45, color: colors.muted, marginTop: 48, ...rise(0.5 * fps) }}>
          {subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
