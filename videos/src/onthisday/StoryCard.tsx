import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, mono, sans } from "../theme";

export type Story = {
  year: number;
  title: string;
  zh: string;
  score: number;
  comments: number;
  domain: string | null;
};

export type StoryCardProps = { story: Story; yearsAgo: number };

// One year of "on this day": the year, how long ago, and that day's top story.
export const StoryCard: React.FC<StoryCardProps> = ({ story, yearsAgo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 0.4 * fps], [0, 1], clamp),
    translate: interpolate(frame, [delay, delay + 0.5 * fps], ["60px 0px", "0px 0px"], {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
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
      <div style={{ fontSize: 52, fontWeight: 700, color: colors.muted, ...enter(0) }}>
        {yearsAgo} 年前的今天
      </div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 240,
          fontWeight: 700,
          lineHeight: 1,
          color: colors.accent,
          marginTop: 12,
          ...enter(0.1 * fps),
        }}
      >
        {story.year}
      </div>

      <div
        style={{
          marginTop: 110,
          padding: "56px 52px",
          borderRadius: 28,
          backgroundColor: colors.panel,
          borderTop: `8px solid ${colors.accent}`,
          ...enter(0.35 * fps),
        }}
      >
        {/* zh carries its own "\n" line breaks: automatic CJK wrapping splits words */}
        <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.3, whiteSpace: "pre-line" }}>{story.zh}</div>
        <div style={{ fontSize: 44, lineHeight: 1.4, color: colors.muted, marginTop: 36 }}>{story.title}</div>
      </div>

      <div
        style={{
          marginTop: 48,
          display: "flex",
          gap: 40,
          fontFamily: mono,
          fontSize: 44,
          fontWeight: 700,
          ...enter(0.7 * fps),
        }}
      >
        <span style={{ color: colors.accent }}>▲ {story.score}</span>
        <span style={{ color: colors.muted }}>💬 {story.comments}</span>
      </div>
      {story.domain ? (
        <div style={{ marginTop: 20, fontFamily: mono, fontSize: 40, color: colors.muted, ...enter(0.8 * fps) }}>
          {story.domain}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
