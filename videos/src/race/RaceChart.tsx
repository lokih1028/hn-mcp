import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, languageColors, mono, sans } from "../theme";

export type RaceFrame = { label: string; values: Record<string, number> };
export type RaceEvent = { label: string; text: string };

export type RaceChartProps = {
  heading: string;
  metric: string;
  frames: RaceFrame[];
  events: RaceEvent[];
  framesPerStep: number;
  top: number;
};

const CHART_TOP = 430;
const ROW = 112;
const BAR_MAX = 1080 - 2 * 90 - 170; // leaves room for the value after the bar

const ranksAt = (frame: RaceFrame): Record<string, number> => {
  const order = Object.keys(frame.values).sort((a, b) => frame.values[b] - frame.values[a]);
  return Object.fromEntries(order.map((name, i) => [name, i]));
};

export const raceDuration = (p: Pick<RaceChartProps, "frames" | "framesPerStep">) =>
  (p.frames.length - 1) * p.framesPerStep + 2 * p.framesPerStep; // hold the last year

// Bar chart race: values and rank positions glide between consecutive frames.
export const RaceChart: React.FC<RaceChartProps> = ({ heading, metric, frames, events, framesPerStep, top }) => {
  const frame = useCurrentFrame();
  const t = Math.min(frame / framesPerStep, frames.length - 1);
  const i = Math.floor(t);
  const next = Math.min(i + 1, frames.length - 1);
  const p = Easing.inOut(Easing.cubic)(t - i);

  const a = frames[i];
  const b = frames[next];
  const rankA = ranksAt(a);
  const rankB = ranksAt(b);
  const names = Object.keys(a.values);
  const value = (n: string) => a.values[n] + (b.values[n] - a.values[n]) * p;
  const rank = (n: string) => rankA[n] + (rankB[n] - rankA[n]) * p;
  const max = Math.max(...names.map(value), 0.01);

  const label = p < 0.5 ? a.label : b.label;
  const event = events.find((e) => {
    const k = frames.findIndex((f) => f.label === e.label);
    return k >= 0 && t >= k - 0.3 && t < k + 0.5; // the year label flips at +0.5
  });
  const eventIndex = event ? frames.findIndex((f) => f.label === event.label) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: sans, color: colors.text }}>
      <div style={{ position: "absolute", top: 130, left: 90, right: 90 }}>
        <div style={{ fontSize: 84, fontWeight: 900 }}>{heading}</div>
        <div style={{ fontSize: 40, color: colors.muted, marginTop: 16 }}>{metric}</div>
      </div>

      {names.map((n) => {
        const r = rank(n);
        return (
          <div
            key={n}
            style={{
              position: "absolute",
              left: 90,
              right: 90,
              top: CHART_TOP + r * ROW,
              // While two bars swap places, the higher-ranked row covers the other.
              zIndex: Math.round(1000 - r * 10),
              backgroundColor: colors.bg,
              opacity: interpolate(r, [top - 1, top - 0.4], [1, 0], clamp),
            }}
          >
            <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, height: 52 }}>{n}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div
                style={{
                  width: Math.max(8, (value(n) / max) * BAR_MAX),
                  height: 48,
                  borderRadius: 10,
                  backgroundColor: languageColors[n] ?? colors.accent,
                }}
              />
              <div style={{ fontFamily: mono, fontSize: 38, fontWeight: 700, color: colors.muted }}>
                {value(n).toFixed(1)}
              </div>
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          right: 90,
          bottom: 150,
          fontFamily: mono,
          fontSize: 200,
          fontWeight: 700,
          color: colors.accent,
          lineHeight: 1,
          textAlign: "right",
        }}
      >
        {label}
      </div>

      {event ? (
        <div
          style={{
            position: "absolute",
            left: 90,
            bottom: 190,
            maxWidth: 520,
            padding: "18px 28px",
            borderRadius: 16,
            backgroundColor: colors.panel,
            borderLeft: `8px solid ${colors.accent}`,
            fontSize: 44,
            fontWeight: 700,
            opacity: interpolate(t, [eventIndex - 0.3, eventIndex - 0.1, eventIndex + 0.35, eventIndex + 0.5], [0, 1, 1, 0], clamp),
          }}
        >
          {event.text}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
