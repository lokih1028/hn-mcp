import { Series } from "remotion";
import { TitleCard, TitleCardProps } from "../common/TitleCard";
import { Story, StoryCard } from "./StoryCard";

export type TimeMachineProps = {
  currentYear: number;
  hook: TitleCardProps;
  stories: Story[];
  outro: TitleCardProps;
  titleFrames: number;
  cardFrames: number;
};

export const timeMachineDuration = (p: TimeMachineProps) => 2 * p.titleFrames + p.stories.length * p.cardFrames;

export const TimeMachine: React.FC<TimeMachineProps> = ({ currentYear, hook, stories, outro, titleFrames, cardFrames }) => (
  <Series>
    <Series.Sequence name="Hook" durationInFrames={titleFrames}>
      <TitleCard {...hook} />
    </Series.Sequence>
    {stories.map((s) => (
      <Series.Sequence key={s.year} name={String(s.year)} durationInFrames={cardFrames}>
        <StoryCard story={s} yearsAgo={currentYear - s.year} />
      </Series.Sequence>
    ))}
    <Series.Sequence name="Outro" durationInFrames={titleFrames}>
      <TitleCard {...outro} />
    </Series.Sequence>
  </Series>
);
