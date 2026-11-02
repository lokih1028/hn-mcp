import { Composition, Folder } from "remotion";
import { TitleCard } from "./common/TitleCard";
import onThisDay from "./data/onthisday.json";
import { StoryCard } from "./onthisday/StoryCard";
import { TimeMachine, TimeMachineProps, timeMachineDuration } from "./onthisday/TimeMachine";
import { techRaceProps } from "./race/content";
import { Podium } from "./race/Podium";
import { RaceChart, raceDuration } from "./race/RaceChart";
import { TechRace, TechRaceProps, techRaceDuration } from "./race/TechRace";
import { FPS, HEIGHT, WIDTH } from "./theme";

const timeMachineProps: TimeMachineProps = {
  currentYear: onThisDay.currentYear,
  hook: onThisDay.hook,
  stories: onThisDay.stories,
  outro: onThisDay.outro,
  titleFrames: 3 * FPS,
  cardFrames: Math.round(3.5 * FPS),
};

const frame = { width: WIDTH, height: HEIGHT, fps: FPS };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="TechRace"
      component={TechRace}
      {...frame}
      durationInFrames={techRaceDuration(techRaceProps)}
      defaultProps={techRaceProps}
      calculateMetadata={({ props }: { props: TechRaceProps }) => ({ durationInFrames: techRaceDuration(props) })}
    />
    <Composition
      id="TimeMachine"
      component={TimeMachine}
      {...frame}
      durationInFrames={timeMachineDuration(timeMachineProps)}
      defaultProps={timeMachineProps}
      calculateMetadata={({ props }: { props: TimeMachineProps }) => ({ durationInFrames: timeMachineDuration(props) })}
    />

    <Folder name="Scenes">
      <Composition
        id="RaceChart"
        component={RaceChart}
        {...frame}
        durationInFrames={raceDuration(techRaceProps.chart)}
        defaultProps={techRaceProps.chart}
      />
      <Composition
        id="RacePodium"
        component={Podium}
        {...frame}
        durationInFrames={techRaceProps.podiumFrames}
        defaultProps={techRaceProps.podium}
      />
      <Composition
        id="StoryCard"
        component={StoryCard}
        {...frame}
        durationInFrames={timeMachineProps.cardFrames}
        defaultProps={{ story: onThisDay.stories[0], yearsAgo: onThisDay.currentYear - onThisDay.stories[0].year }}
      />
      <Composition
        id="TitleCard"
        component={TitleCard}
        {...frame}
        durationInFrames={timeMachineProps.titleFrames}
        defaultProps={onThisDay.hook}
      />
    </Folder>
  </>
);
