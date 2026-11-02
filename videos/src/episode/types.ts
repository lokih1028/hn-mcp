import type { TitleCardProps } from "../common/TitleCard";
import type { Timing } from "./timeline";

export type EpisodeStory = {
  year: number;
  title: string;
  zh: string;
  score: number;
  comments: number;
  domain: string | null;
  image: string | null; // paths under public/
  video?: string | null;
};

// Props shared by every daily template (TimeTunnel, TvChannels, NewsArchive,
// TimelineScroll, StarRoute), so daily.py can render any of them.
export type EpisodeProps = {
  currentYear: number;
  hook: TitleCardProps;
  stories: EpisodeStory[];
  outro: TitleCardProps;
  timing: Timing;
};
