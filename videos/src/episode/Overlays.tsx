import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { TitleCardProps } from "../common/TitleCard";
import { clamp, colors, mono, sans } from "../theme";
import { phaseAt } from "./timeline";
import type { EpisodeProps, EpisodeStory } from "./types";

const HN_BG = "#f6f6ef"; // the real HN page colours
const HN_GREY = "#828282";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const Scrims: React.FC<{ bottom: boolean }> = ({ bottom }) => (
  <>
    <AbsoluteFill
      style={{ background: "linear-gradient(#000c 0%, #0000 32%)" }}
    />
    {bottom ? (
      <AbsoluteFill
        style={{
          background: "linear-gradient(#0000 45%, #000d 78%, #000f 100%)",
        }}
      />
    ) : null}
  </>
);

// The year counter on top and, unless `text` is false (the template prints the
// story itself), the Chinese headline and an HN front-page row at the bottom.
export const StoryOverlay: React.FC<{
  story: EpisodeStory;
  prevYear: number;
  currentYear: number;
  local: number;
  holdFrames: number;
  text?: boolean;
}> = ({ story, prevYear, currentYear, local, holdFrames, text = true }) => {
  const shown = interpolate(
    local,
    [0, 8, holdFrames - 10, holdFrames],
    [0, 1, 1, 0],
    clamp,
  );
  const year = Math.round(
    interpolate(local, [0, 16], [prevYear, story.year], {
      ...clamp,
      easing: ease,
    }),
  );
  const rise = (delay: number) => ({
    opacity: interpolate(local, [delay, delay + 10], [0, 1], clamp),
    translate: interpolate(
      local,
      [delay, delay + 14],
      ["0px 50px", "0px 0px"],
      { ...clamp, easing: ease },
    ),
  });
  const score = Math.round(
    interpolate(local, [18, 48], [0, story.score], { ...clamp, easing: ease }),
  );
  const comments = Math.round(
    interpolate(local, [22, 52], [0, story.comments], {
      ...clamp,
      easing: ease,
    }),
  );

  return (
    <AbsoluteFill
      style={{ opacity: shown, fontFamily: sans, color: colors.text }}
    >
      <Scrims bottom={text} />
      <div style={{ position: "absolute", top: 120, left: 90, right: 90 }}>
        <div
          style={{
            fontSize: 50,
            fontWeight: 700,
            color: "#d9d4ca",
            ...rise(0),
          }}
        >
          {currentYear - story.year} 年前的今天
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 230,
            fontWeight: 700,
            lineHeight: 1,
            color: colors.accent,
            textShadow: `0 0 40px ${colors.accent}aa, 0 0 90px ${colors.accent}55`,
          }}
        >
          {year}
        </div>
      </div>

      {text ? (
        <div style={{ position: "absolute", left: 90, right: 90, bottom: 150 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 1.25,
              whiteSpace: "pre-line",
              textShadow: "0 4px 24px #000",
              marginBottom: 40,
              ...rise(6),
            }}
          >
            {story.zh}
          </div>
          {/* A Hacker News front-page row, as it looked on the day */}
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 20px 60px #000a",
              ...rise(12),
            }}
          >
            <div
              style={{
                backgroundColor: colors.accent,
                padding: "12px 22px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontFamily: "Verdana, Geneva, sans-serif",
                fontWeight: 700,
                fontSize: 30,
                color: "#000",
              }}
            >
              <span
                style={{
                  border: "3px solid #fff",
                  color: "#fff",
                  padding: "0 8px",
                  lineHeight: 1.2,
                }}
              >
                Y
              </span>
              Hacker News
            </div>
            <div
              style={{
                backgroundColor: HN_BG,
                padding: "20px 24px 22px",
                fontFamily: "Verdana, Geneva, sans-serif",
                color: "#000",
              }}
            >
              <div style={{ fontSize: 31, lineHeight: 1.35 }}>
                <span style={{ color: HN_GREY }}>1. ▲ </span>
                {story.title}
                {story.domain ? (
                  <span style={{ color: HN_GREY, fontSize: 24 }}>
                    {" "}
                    ({story.domain})
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 25,
                  color: HN_GREY,
                  marginTop: 10,
                  fontFamily: mono,
                }}
              >
                {score} points | {comments} comments
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const TitleOverlay: React.FC<
  TitleCardProps & { local: number; frames: number }
> = ({ kicker, title, subtitle, local, frames }) => {
  const rise = (delay: number) => ({
    opacity: interpolate(
      local,
      [delay, delay + 12, frames - 12, frames],
      [0, 1, 1, 0],
      clamp,
    ),
    translate: interpolate(
      local,
      [delay, delay + 16],
      ["0px 40px", "0px 0px"],
      { ...clamp, easing: ease },
    ),
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 90px",
        fontFamily: sans,
        color: colors.text,
      }}
    >
      <AbsoluteFill
        style={{
          background: "radial-gradient(circle at 50% 50%, #000a 0%, #0000 70%)",
        }}
      />
      {kicker ? (
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: colors.accent,
            marginBottom: 30,
            ...rise(0),
          }}
        >
          {kicker}
        </div>
      ) : null}
      <div
        style={{
          fontSize: 104,
          fontWeight: 900,
          lineHeight: 1.15,
          textShadow: "0 6px 40px #000",
          ...rise(5),
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            fontSize: 50,
            lineHeight: 1.45,
            color: "#d9d4ca",
            marginTop: 40,
            ...rise(12),
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Flash as the camera crosses a portal, plus grain and vignette over everything.
export const Finish: React.FC<{ flash: number; frame: number }> = ({
  flash,
  frame,
}) => (
  <>
    <AbsoluteFill style={{ backgroundColor: "#fff3e4", opacity: flash }} />
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 45%, #0000 62%, #0008 100%)",
      }}
    />
    <AbsoluteFill style={{ opacity: 0.09, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            seed={frame % 100}
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  </>
);

// Everything every template draws on top of its stage: hook and outro titles,
// the held story's text, the transition flash, vignette and grain.
export const EpisodeChrome: React.FC<{
  episode: EpisodeProps;
  flash?: number;
  storyText?: boolean;
}> = ({ episode, flash = 0, storyText = true }) => {
  const frame = useCurrentFrame();
  const { timing, stories, currentYear, hook, outro } = episode;
  const phase = phaseAt(frame, timing, stories.length);
  return (
    <>
      {phase.kind === "hook" ? (
        <TitleOverlay
          {...hook}
          local={phase.local}
          frames={timing.hookFrames}
        />
      ) : null}
      {phase.kind === "hold" ? (
        <StoryOverlay
          story={stories[phase.index]}
          prevYear={
            phase.index === 0 ? currentYear : stories[phase.index - 1].year
          }
          currentYear={currentYear}
          local={phase.local}
          holdFrames={timing.holdFrames}
          text={storyText}
        />
      ) : null}
      {phase.kind === "outro" ? (
        <TitleOverlay
          {...outro}
          local={phase.local}
          frames={timing.outroFrames}
        />
      ) : null}
      <Finish flash={flash} frame={frame} />
    </>
  );
};
