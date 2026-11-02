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
import tunnelProto from "./data/tunnel-proto.json";
import type { EpisodeProps } from "./episode/types";
import { episodeDuration, TimeTunnel } from "./tunnel/TimeTunnel";
import ringsTest from "./data/rings-test.json";
import { Rings, ringsDuration } from "./rings/Rings";
import frontPage2017 from "./spike/frontpage-2017-11-03.json";
import { Teardown } from "./spike/Teardown";
import { SHOT_SECONDS } from "./spike/shot";
import { TeardownShot } from "./spike/TeardownShot";
import { GpuProbe } from "./spike/GpuProbe";
import barrelRollPage from "./shots/2011-11-03-barrel-roll/frontpage.json";
import { BarrelRoll, SECONDS as BARREL_ROLL_SECONDS } from "./shots/2011-11-03-barrel-roll/BarrelRoll";

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

    <Composition
      id="TimeTunnel"
      component={TimeTunnel}
      {...frame}
      durationInFrames={episodeDuration(tunnelProto as EpisodeProps)}
      defaultProps={tunnelProto as EpisodeProps}
      calculateMetadata={({ props }: { props: EpisodeProps }) => ({ durationInFrames: episodeDuration(props) })}
    />

    <Composition
      id="Rings"
      component={Rings}
      {...frame}
      durationInFrames={ringsDuration(ringsTest as EpisodeProps)}
      defaultProps={ringsTest as EpisodeProps}
      calculateMetadata={({ props }: { props: EpisodeProps }) => ({ durationInFrames: ringsDuration(props) })}
    />

    <Folder name="Shots">
      <Composition
        id="BarrelRoll"
        component={BarrelRoll}
        {...frame}
        durationInFrames={BARREL_ROLL_SECONDS * FPS}
        defaultProps={{ items: barrelRollPage }}
      />
    </Folder>

    <Folder name="Spike">
      <Composition id="GpuProbe" component={GpuProbe} {...frame} durationInFrames={1} />
      <Composition
        id="TeardownShot"
        component={TeardownShot}
        {...frame}
        durationInFrames={SHOT_SECONDS * FPS}
        defaultProps={{ items: frontPage2017 }}
      />
      {(["zh", "en"] as const).map((lang) => (
        <Composition
          key={lang}
          id={`Teardown-${lang}`}
          component={Teardown}
          {...frame}
          durationInFrames={1}
          defaultProps={{
            lang,
            items: frontPage2017,
            view: { yaw: -0.3, pitch: -1.17, roll: 0.0, fov: 24, distance: 76, targetY: 2.4 },
          }}
        />
      ))}
    </Folder>

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
