import { Img, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { colors } from "../theme";
import { storyStart } from "./timeline";
import type { EpisodeProps, EpisodeStory } from "./types";

// A story's picture: its Grok clip when there is one (muted, started at the
// story's travel so it moves while held), else its image, else a dark panel.
export const StoryMedia: React.FC<{
  story: EpisodeStory;
  index: number;
  episode: EpisodeProps;
  style?: React.CSSProperties;
}> = ({ story, index, episode, style }) => {
  const { fps } = useVideoConfig();
  const fill: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    ...style,
  };
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {story.image ? (
        <Img src={staticFile(story.image)} style={fill} />
      ) : (
        <div style={{ ...fill, background: `linear-gradient(160deg, #2a1608, ${colors.bg})` }} />
      )}
      {story.video ? (
        // Templates keep media at the composition root, so `from` is in composition frames.
        <Sequence from={storyStart(episode.timing, index)} durationInFrames={6 * fps} layout="none">
          <OffthreadVideo src={staticFile(story.video)} muted style={fill} />
        </Sequence>
      ) : null}
    </div>
  );
};
