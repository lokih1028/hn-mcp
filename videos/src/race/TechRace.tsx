import { Series } from "remotion";
import { TitleCard, TitleCardProps } from "../common/TitleCard";
import { Podium, PodiumProps } from "./Podium";
import { RaceChart, RaceChartProps, raceDuration } from "./RaceChart";

export type TechRaceProps = {
  hook: TitleCardProps;
  chart: RaceChartProps;
  podium: PodiumProps;
  outro: TitleCardProps;
  titleFrames: number;
  podiumFrames: number;
};

export const techRaceDuration = (p: TechRaceProps) => 2 * p.titleFrames + raceDuration(p.chart) + p.podiumFrames;

export const TechRace: React.FC<TechRaceProps> = ({ hook, chart, podium, outro, titleFrames, podiumFrames }) => (
  <Series>
    <Series.Sequence name="Hook" durationInFrames={titleFrames}>
      <TitleCard {...hook} />
    </Series.Sequence>
    <Series.Sequence name="Race" durationInFrames={raceDuration(chart)}>
      <RaceChart {...chart} />
    </Series.Sequence>
    <Series.Sequence name="Podium" durationInFrames={podiumFrames}>
      <Podium {...podium} />
    </Series.Sequence>
    <Series.Sequence name="Outro" durationInFrames={titleFrames}>
      <TitleCard {...outro} />
    </Series.Sequence>
  </Series>
);
