import { Composition, Folder } from "remotion";
import { ProvisoDraft, Problem, Intro, Response, Updates } from "./Composition";
export const RemotionRoot = () => (
  <>
    <Composition
      id="Proviso-Draft"
      component={ProvisoDraft}
      durationInFrames={4560}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ music: true }}
    />
    <Folder name="Scenes">
      <Composition
        id="Opening"
        component={Problem}
        durationInFrames={360}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#f8f8f3" } }}
      />
      <Composition
        id="Brand"
        component={Intro}
        durationInFrames={240}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#163b2e" } }}
      />
      <Composition
        id="Response"
        component={Response}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#f8f8f3" } }}
      />
      <Composition
        id="Updates"
        component={Updates}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#f8f8f3" } }}
      />
    </Folder>
  </>
);
