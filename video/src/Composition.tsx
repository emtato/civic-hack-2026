import React, { useEffect, useState } from "react";
import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  CanvasImage,
  continueRender,
  delayRender,
  Easing,
  Interactive,
  interpolate,
  Sequence,
  staticFile,
  Track,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "./style.css";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) };

function FontsReady() {
  const [handle] = useState(() => delayRender("Loading local fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load("800 100px Manrope"),
      document.fonts.load("600 60px Manrope"),
      document.fonts.load('400 30px "DM Sans"'),
      document.fonts.load('600 30px "DM Sans"'),
    ])
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
  return null;
}
function Brand({
  large = false,
  light = false,
}: {
  large?: boolean;
  light?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: large ? 30 : 14,
        color: light ? "#f8f8f3" : "#285a45",
      }}
    >
      <CanvasImage
        src={staticFile("proviso.svg")}
        style={{ width: large ? 126 : 46, height: large ? 126 : 46 }}
      />
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: large ? 178 : 42,
          fontWeight: 800,
          letterSpacing: large ? -12 : -2,
        }}
      >
        proviso<span style={{ color: "#c7833f" }}>.</span>
      </span>
    </div>
  );
}
function Entry({
  children,
  delay = 0,
  style = {},
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(frame, [delay, delay + 22], [0, 1], ease),
        translate: interpolate(
          frame,
          [delay, delay + 32],
          ["0px 38px", "0px 0px"],
          ease,
        ),
      }}
    >
      {children}
    </div>
  );
}
function Kicker({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: 21,
        fontWeight: 700,
        letterSpacing: 3,
        color: light ? "#b5c6b3" : "#6b8068",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}
function Note({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: 22,
        lineHeight: 1.5,
        color: light ? "#bdcbbf" : "#657565",
      }}
    >
      {children}
    </div>
  );
}
function Title({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <Interactive.Div
      name="Scene headline"
      style={{
        fontFamily: "Manrope",
        fontSize: 76,
        fontWeight: 650,
        lineHeight: 1.08,
        letterSpacing: -4,
        position: "relative",
        ...style,
      }}
    >
      {children}
    </Interactive.Div>
  );
}
function Chrome({ file, width = 1170 }: { file: string; width?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const close = file === "explore" ? 1.2 : 1.42;
  const pan = file === "conditions" ? "-12px -200px" : "-12px -25px";
  return (
    <div
      style={{
        width,
        borderRadius: 19,
        overflow: "hidden",
        background: "#fffef9",
        border: "1px solid #d7dfd1",
        boxShadow: "0 32px 90px #152f2524",
      }}
    >
      <div
        style={{
          height: 42,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 20px",
          borderBottom: "1px solid #e6e8df",
          background: "#fbfbf5",
        }}
      >
        <i
          style={{
            height: 9,
            width: 9,
            borderRadius: 20,
            background: "#c8967b",
          }}
        />
        <i
          style={{
            height: 9,
            width: 9,
            borderRadius: 20,
            background: "#d7c58d",
          }}
        />
        <i
          style={{
            height: 9,
            width: 9,
            borderRadius: 20,
            background: "#9bab8f",
          }}
        />
        <span
          style={{
            marginLeft: 18,
            fontSize: 16,
            letterSpacing: 1,
            color: "#74836d",
          }}
        >
          proviso / resident view
        </span>
        <span style={{ marginLeft: "auto", fontSize: 14, color: "#74836d" }}>
          STAGED DEMO
        </span>
      </div>
      <div style={{ height: (width * 720) / 1280, overflow: "hidden" }}>
        <CanvasImage
          src={staticFile(`captures/${file}.jpg`)}
          style={{
            width: "100%",
            display: "block",
            transformOrigin: "0% 25%",
            scale: interpolate(
              frame,
              [35, 120, durationInFrames],
              [1, close, close + 0.025],
              ease,
            ),
            translate: interpolate(frame, [35, 120], ["0px 0px", pan], ease),
          }}
        />
      </div>
    </div>
  );
}
function Shot({
  file,
  x = 650,
  y = 225,
  width = 1170,
}: {
  file: string;
  x?: number;
  y?: number;
  width?: number;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          scale: interpolate(frame, [0, durationInFrames], [1, 1.02], clamp),
          transformOrigin: "55% 45%",
          translate: interpolate(
            frame,
            [0, 32],
            ["70px 28px", "0px 0px"],
            ease,
          ),
          opacity: interpolate(frame, [0, 18], [0, 1], ease),
        }}
      >
        <Chrome file={file} width={width} />
      </div>
      <div
        style={{
          position: "absolute",
          left: x,
          top: 980,
          fontSize: 16,
          color: "#79846e",
        }}
      >
        Actual app UI · staged data / Map © OpenStreetMap contributors · Leaflet
      </div>
    </>
  );
}
function StageHeading({
  step,
  title,
  body,
}: {
  step: string;
  title: React.ReactNode;
  body: React.ReactNode;
}) {
  return (
    <div style={{ position: "absolute", left: 96, top: 246, width: 485 }}>
      <Entry>
        <Kicker>{step}</Kicker>
      </Entry>
      <Entry delay={8}>
        <Title style={{ marginTop: 28 }}>{title}</Title>
      </Entry>
      <Entry delay={22}>
        <div
          style={{
            fontSize: 30,
            lineHeight: 1.5,
            marginTop: 36,
            color: "#687965",
            maxWidth: 430,
          }}
        >
          {body}
        </div>
      </Entry>
    </div>
  );
}
function CursorClick() {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: interpolate(frame, [100, 145], [1630, 922], ease),
        top: interpolate(frame, [100, 145], [790, 550], ease),
        opacity: interpolate(frame, [95, 110, 175, 190], [0, 1, 1, 0], clamp),
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 80,
          height: 80,
          left: -30,
          top: -30,
          borderRadius: 80,
          border: "4px solid #c7833f",
          scale: interpolate(frame, [145, 170], [0.2, 1.7], clamp),
          opacity: interpolate(frame, [145, 170], [0.8, 0], clamp),
        }}
      />
      <svg width="44" height="54" viewBox="0 0 44 54">
        <path
          d="M4 3 38 30 23 32 17 47Z"
          fill="#285a45"
          stroke="#fffef9"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
function ProblemInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence durationInFrames={6 * fps} name="Everyday consequences">
        <div style={{ position: "absolute", left: 96, top: 252, width: 1000 }}>
          <Entry>
            <Kicker>Municipal decisions. Everyday consequences.</Kicker>
          </Entry>
          <Entry delay={9}>
            <Title style={{ fontSize: 112, marginTop: 34 }}>
              A proposal changes.
              <br />
              Your day changes
              <br />
              with it.
            </Title>
          </Entry>
          <Entry delay={24}>
            <div style={{ marginTop: 44, fontSize: 33, color: "#6b7b64" }}>
              Your street. Your access. Your say.
            </div>
          </Entry>
        </div>
        <Entry
          delay={22}
          style={{ position: "absolute", left: 1190, top: 310, width: 590 }}
        >
          <div
            style={{
              background: "#fffef9",
              border: "1px solid #dce2d3",
              borderRadius: 28,
              padding: 44,
              boxShadow: "0 24px 70px #285a4510",
              rotate: "3deg",
            }}
          >
            <Kicker>A resident’s perspective</Kicker>
            <div style={{ fontSize: 42, lineHeight: 1.4, marginTop: 28 }}>
              “More space for people?
              <br />
              Yes. But I still need
              <br />
              accessible pickup.”
            </div>
            <div
              style={{
                width: 54,
                height: 5,
                background: "#c7833f",
                marginTop: 35,
                borderRadius: 5,
              }}
            />
          </div>
        </Entry>
      </Sequence>
      <Sequence
        from={6 * fps}
        durationInFrames={6 * fps}
        name="Conditional support"
      >
        <div style={{ position: "absolute", left: 96, top: 258, width: 1700 }}>
          <Entry>
            <Kicker>The meaning behind a position</Kicker>
          </Entry>
          <Entry delay={7}>
            <Title style={{ fontSize: 123, marginTop: 38 }}>
              “I support this<span style={{ color: "#bd7940" }}> if…</span>”
            </Title>
          </Entry>
          <Entry delay={20}>
            <div
              style={{
                marginTop: 60,
                background: "#e8eddd",
                borderLeft: "6px solid #c7833f",
                borderRadius: 12,
                padding: "34px 42px",
                width: 1500,
                fontSize: 44,
                lineHeight: 1.4,
              }}
            >
              accessible pickup stays near the entrance until{" "}
              <strong>8 p.m.</strong>
            </div>
          </Entry>
          <Entry delay={42}>
            <div style={{ fontSize: 32, color: "#6b7b64", marginTop: 42 }}>
              The condition is part of the answer.
            </div>
          </Entry>
        </div>
      </Sequence>
    </>
  );
}
function IntroInner() {
  const frame = useCurrentFrame();
  return (
    <>
      <div
        style={{
          position: "absolute",
          width: 950,
          height: 950,
          border: "1px solid #74917733",
          borderRadius: "50%",
          left: 1060,
          top: 90,
          scale: interpolate(frame, [0, 240], [0.85, 1.1], clamp),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 650,
          height: 650,
          border: "1px solid #74917733",
          borderRadius: "50%",
          left: 1210,
          top: 240,
        }}
      />
      <div style={{ position: "absolute", left: 150, top: 280 }}>
        <Entry>
          <Brand large light />
        </Entry>
        <Entry delay={16}>
          <Title
            style={{
              fontSize: 64,
              color: "#e8eddd",
              lineHeight: 1.25,
              marginTop: 32,
              letterSpacing: -2,
            }}
          >
            Local decisions.
            <br />
            Lived experience.
          </Title>
        </Entry>
        <Entry delay={34}>
          <div
            style={{
              display: "flex",
              gap: 30,
              marginTop: 60,
              color: "#b6c7b1",
              fontSize: 26,
            }}
          >
            <span>01 Discover</span>
            <span>↗</span>
            <span>02 Participate</span>
            <span>↗</span>
            <span>03 Follow changes</span>
          </div>
        </Entry>
      </div>
      <Entry delay={25} style={{ position: "absolute", left: 1390, top: 380 }}>
        <svg
          width="270"
          height="290"
          viewBox="0 0 270 290"
          fill="none"
          stroke="#dce7c8"
          strokeWidth="6"
          strokeLinejoin="round"
        >
          <path d="M135 20 250 90 135 160 20 90Z" />
          <path d="m20 140 115 70 115-70M20 190l115 70 115-70" />
        </svg>
      </Entry>
    </>
  );
}
function ExploreInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <StageHeading
        step="01 / Discover"
        title={
          <>
            Find a proposal.
            <br />
            See the place.
          </>
        }
        body={
          <>
            Explore the map, then open a proposal that affects your everyday
            life.
          </>
        }
      />
      <Sequence durationInFrames={9 * fps} name="Explore app">
        <Shot file="explore" />
        <CursorClick />
      </Sequence>
      <Sequence
        from={9 * fps}
        durationInFrames={9 * fps}
        name="Open Kensington"
      >
        <Shot file="overview" />
      </Sequence>
      <Entry delay={45} style={{ position: "absolute", left: 100, top: 820 }}>
        <div className="pill">Kensington Market · Toronto</div>
      </Entry>
    </>
  );
}
function OverviewInner() {
  return (
    <>
      <StageHeading
        step="02 / Understand"
        title={
          <>
            Know what’s
            <br />
            proposed.
          </>
        }
        body={
          <>
            Read the changes.
            <br />
            Check the official source.
            <br />
            See the community context.
          </>
        }
      />
      <Shot file="overview" y={210} />
      <Entry delay={60} style={{ position: "absolute", left: 1010, top: 748 }}>
        <div
          style={{
            background: "#285a45",
            color: "#fffef3",
            padding: "26px 36px",
            borderRadius: 18,
            boxShadow: "0 14px 40px #12352125",
            fontSize: 29,
          }}
        >
          Read the official proposal ↗
        </div>
      </Entry>
      <div style={{ position: "absolute", left: 96, top: 840, width: 460 }}>
        <Note>
          Example reference. Current participation status requires source
          verification.
        </Note>
      </div>
    </>
  );
}
function ResponseInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence durationInFrames={7 * fps} name="Choose position">
        <StageHeading
          step="03 / Participate"
          title={
            <>
              Say where
              <br />
              you stand.
            </>
          }
          body={
            <>
              Your overall position and your connection to the place stay
              separate.
            </>
          }
        />
        <Shot file="position" />
        <Entry delay={55} style={{ position: "absolute", left: 99, top: 800 }}>
          <div className="pill">Support · Local resident</div>
        </Entry>
      </Sequence>
      <Sequence
        from={7 * fps}
        durationInFrames={10 * fps}
        name="Record requirement"
      >
        <StageHeading
          step="03 / Your condition"
          title={
            <>
              Keep the
              <br />
              condition.
            </>
          }
          body={<>Describe what needs to happen, where it matters, and when.</>}
        />
        <Shot file="condition" y={210} />
        <Entry
          delay={55}
          style={{ position: "absolute", left: 102, top: 810, width: 440 }}
        >
          <div
            style={{
              fontSize: 29,
              lineHeight: 1.5,
              color: "#285a45",
              borderLeft: "4px solid #c7833f",
              paddingLeft: 24,
            }}
          >
            Accessible pickup.
            <br />
            Clinic entrance.
            <br />
            Until 8 p.m.
          </div>
        </Entry>
        <Sequence
          from={5 * fps}
          durationInFrames={5 * fps}
          name="Magnified requirement"
        >
          <Entry
            style={{ position: "absolute", left: 770, top: 558, width: 980 }}
          >
            <div
              style={{
                background: "#fffef9",
                border: "1px solid #b5c4a8",
                borderRadius: 20,
                boxShadow: "0 20px 70px #163b2e25",
                padding: 34,
              }}
            >
              <Kicker>Your recorded requirement</Kicker>
              <div style={{ fontSize: 37, lineHeight: 1.35, marginTop: 20 }}>
                Keep accessible pickup near the clinic entrance until{" "}
                <strong>8 p.m.</strong>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
                <div className="pill">Nassau Street entrance</div>
                <div className="pill">Evenings · until 8 p.m.</div>
              </div>
            </div>
          </Entry>
        </Sequence>
      </Sequence>
      <Sequence
        from={17 * fps}
        durationInFrames={8 * fps}
        name="Review requirement"
      >
        <StageHeading
          step="03 / Review"
          title={
            <>
              Check the
              <br />
              meaning.
            </>
          }
          body={
            <>Your original words stay beside the requirement you confirm.</>
          }
        />
        <Shot file="review" />
        <Entry delay={50} style={{ position: "absolute", left: 100, top: 820 }}>
          <div className="pill">Resident-confirmed wording</div>
        </Entry>
      </Sequence>
      <Sequence
        from={25 * fps}
        durationInFrames={5 * fps}
        name="Saved response"
      >
        <StageHeading
          step="03 / Saved"
          title={
            <>
              Save.
              <br />
              Return.
              <br />
              Edit.
            </>
          }
          body={<>Your perspective can change as your needs do.</>}
        />
        <Shot file="saved" />
        <Entry delay={15} style={{ position: "absolute", left: 990, top: 800 }}>
          <div
            className="pill"
            style={{ background: "#285a45", color: "#fffef9", fontSize: 28 }}
          >
            ✓ Saved in the staged demo
          </div>
        </Entry>
      </Sequence>
    </>
  );
}
function Distribution() {
  const frame = useCurrentFrame();
  const segments = [
    { n: 7, c: "#91483c" },
    { n: 4, c: "#c7814c" },
    { n: 2, c: "#919687" },
    { n: 20, c: "#638563" },
    { n: 10, c: "#355d4c" },
    { n: 3, c: "#7b8591" },
  ];
  return (
    <div
      style={{
        display: "flex",
        height: 24,
        gap: 4,
        width: 440,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      {segments.map((s, i) => (
        <div
          key={s.c}
          style={{
            width: interpolate(
              frame,
              [30 + i * 5, 70 + i * 5],
              [0, (s.n / 46) * 440],
              ease,
            ),
            background: s.c,
          }}
        />
      ))}
    </div>
  );
}
function CommunityInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence durationInFrames={12 * fps} name="Every position counts">
        <StageHeading
          step="04 / Community"
          title={
            <>
              Every voice.
              <br />
              Every position.
            </>
          }
          body={
            <>
              See support, opposition, and uncertainty without flattening them
              into one score.
            </>
          }
        />
        <Shot file="community" />
        <div style={{ position: "absolute", left: 100, top: 800, width: 440 }}>
          <Distribution />
          <div
            style={{
              fontSize: 21,
              lineHeight: 1.5,
              color: "#75836b",
              marginTop: 20,
            }}
          >
            46 fictional responses.
            <br />
            Not a representative vote.
          </div>
        </div>
      </Sequence>
      <Sequence
        from={12 * fps}
        durationInFrames={12 * fps}
        name="Inspect original words"
      >
        <StageHeading
          step="04 / Behind the group"
          title={
            <>
              Keep the
              <br />
              original words.
            </>
          }
          body={
            <>Expand a requirement group to inspect the comments behind it.</>
          }
        />
        <Shot file="conditions" y={200} />
        <Entry
          delay={55}
          style={{ position: "absolute", left: 96, top: 755, width: 455 }}
        >
          <div
            style={{
              fontSize: 29,
              lineHeight: 1.5,
              paddingLeft: 24,
              borderLeft: "4px solid #c7833f",
            }}
          >
            Specific access needs
            <br />
            remain visible.
          </div>
        </Entry>
      </Sequence>
    </>
  );
}
function UpdateInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence durationInFrames={8 * fps} name="Compare in the app">
        <StageHeading
          step="05 / Follow changes"
          title={
            <>
              See what
              <br />
              changed.
            </>
          }
          body={<>Compare earlier and later wording, side by side.</>}
        />
        <Shot file="updates" />
        <div style={{ position: "absolute", left: 96, top: 820, width: 440 }}>
          <Note>Fictional before-and-after wording for this draft.</Note>
        </div>
      </Sequence>
      <Sequence
        from={8 * fps}
        durationInFrames={12 * fps}
        name="Explain the change"
      >
        <div style={{ position: "absolute", left: 96, top: 220 }}>
          <Entry>
            <Kicker>Illustrative change · both versions fictional</Kicker>
          </Entry>
          <Entry delay={8}>
            <Title style={{ fontSize: 91, marginTop: 30 }}>
              A detail worth noticing.
            </Title>
          </Entry>
        </div>
        <Entry
          delay={18}
          style={{ position: "absolute", left: 96, top: 460, width: 800 }}
        >
          <div
            style={{
              border: "1px solid #d7dfd1",
              borderRadius: 24,
              padding: 42,
              background: "#fffef9",
            }}
          >
            <Kicker>Earlier wording</Kicker>
            <div style={{ fontSize: 36, marginTop: 28, lineHeight: 1.4 }}>
              Accessible pickup until
            </div>
            <div
              style={{
                fontFamily: "Manrope",
                fontSize: 112,
                fontWeight: 650,
                letterSpacing: -5,
                color: "#a46d59",
                textDecoration: "line-through",
                textDecorationThickness: 5,
              }}
            >
              6 p.m.
            </div>
          </div>
        </Entry>
        <Entry
          delay={35}
          style={{ position: "absolute", left: 1024, top: 460, width: 800 }}
        >
          <div
            style={{
              border: "1px solid #9baa8d",
              borderRadius: 24,
              padding: 42,
              background: "#e8eddd",
            }}
          >
            <Kicker>Later wording</Kicker>
            <div style={{ fontSize: 36, marginTop: 28, lineHeight: 1.4 }}>
              Accessible pickup until
            </div>
            <div
              style={{
                fontFamily: "Manrope",
                fontSize: 112,
                fontWeight: 650,
                letterSpacing: -5,
                color: "#285a45",
              }}
            >
              8 p.m.
            </div>
          </div>
        </Entry>
        <Entry delay={70} style={{ position: "absolute", left: 96, top: 850 }}>
          <div style={{ fontSize: 31, color: "#687965" }}>
            Detected changes still need human review.
          </div>
        </Entry>
      </Sequence>
    </>
  );
}
function ReadinessInner() {
  return (
    <>
      <div style={{ position: "absolute", left: 96, top: 215 }}>
        <Entry>
          <Kicker>Built for a practical next step</Kicker>
        </Entry>
        <Entry delay={8}>
          <Title style={{ fontSize: 94, marginTop: 28 }}>
            From prototype
            <br />
            to a municipal pilot.
          </Title>
        </Entry>
      </div>
      <Entry
        delay={22}
        style={{ position: "absolute", left: 96, top: 520, width: 540 }}
      >
        <div className="readiness-card">
          <Kicker>01 / The source</Kicker>
          <h3>Public records.</h3>
          <p>
            Toronto proposal references.
            <br />
            Official links stay visible.
          </p>
          <div className="card-bottom">
            Summaries and locations are illustrative.
          </div>
        </div>
      </Entry>
      <Entry
        delay={60}
        style={{ position: "absolute", left: 690, top: 520, width: 540 }}
      >
        <div className="readiness-card">
          <Kicker>02 / This draft</Kicker>
          <h3>Staged examples.</h3>
          <p>
            Actual frontend captures.
            <br />
            Memory-only demo API.
          </p>
          <div className="card-bottom">
            Fictional feedback and version changes.
          </div>
        </div>
      </Entry>
      <Entry
        delay={105}
        style={{ position: "absolute", left: 1284, top: 520, width: 540 }}
      >
        <div className="readiness-card">
          <Kicker>03 / A pilot needs</Kicker>
          <h3>People + process.</h3>
          <p>
            A verified source feed.
            <br />
            Staff review and a response workflow.
          </p>
          <div className="card-bottom">
            Feedback here is not sent to the City.
          </div>
        </div>
      </Entry>
      <Entry delay={200} style={{ position: "absolute", left: 96, top: 928 }}>
        <Note>
          Prototype demonstration · no official municipal consultation or
          measured impact claimed.
        </Note>
      </Entry>
    </>
  );
}
function OutroInner() {
  return (
    <>
      <div style={{ position: "absolute", left: 150, top: 240 }}>
        <Entry>
          <Brand large light />
        </Entry>
        <Entry delay={16}>
          <Title
            style={{
              fontSize: 77,
              color: "#f8f8f3",
              lineHeight: 1.2,
              marginTop: 48,
              letterSpacing: -3,
            }}
          >
            A place for the conditions
            <br />
            behind your position.
          </Title>
        </Entry>
        <Entry delay={36}>
          <div style={{ fontSize: 30, color: "#b5c6ad", marginTop: 42 }}>
            Discover. Explain. Participate.
          </div>
        </Entry>
      </div>
      <Entry delay={50} style={{ position: "absolute", left: 150, top: 900 }}>
        <Note light>Visual draft 01 · your narration comes next.</Note>
      </Entry>
      <div
        style={{
          position: "absolute",
          left: 1450,
          top: 430,
          width: 260,
          height: 260,
          border: "1px solid #76947666",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontSize: 100,
          color: "#c7833f",
        }}
      >
        ↗
      </div>
    </>
  );
}
const sceneSchema = { ...Interactive.backgroundSchema };
export const Problem = Interactive.create({
  Component: ProblemInner,
  layout: "absolute-fill",
  schema: sceneSchema,
});
export const Intro = Interactive.create({
  Component: IntroInner,
  layout: "absolute-fill",
  schema: sceneSchema,
});
export const Explore = Interactive.create({
  Component: ExploreInner,
  layout: "absolute-fill",
  schema: sceneSchema,
});
export const Overview = Interactive.create({
  Component: OverviewInner,
  layout: "absolute-fill",
  schema: sceneSchema,
});
export const Response = Interactive.create({
  Component: ResponseInner,
  layout: "absolute-fill",
  schema: sceneSchema,
});
export const Community = Interactive.create({
  Component: CommunityInner,
  layout: "absolute-fill",
  schema: sceneSchema,
});
export const Updates = Interactive.create({
  Component: UpdateInner,
  layout: "absolute-fill",
  schema: sceneSchema,
});
export const Readiness = Interactive.create({
  Component: ReadinessInner,
  layout: "absolute-fill",
  schema: sceneSchema,
});
export const Outro = Interactive.create({
  Component: OutroInner,
  layout: "absolute-fill",
  schema: sceneSchema,
});
function MusicBed() {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <Audio
      name="Original ambient draft score"
      src={staticFile("audio/draft-bed.wav")}
      volume={(frame) =>
        interpolate(
          frame,
          [0, 2 * fps, durationInFrames - 3 * fps, durationInFrames],
          [0, 0.5, 0.5, 0],
          clamp,
        )
      }
    />
  );
}
function Overlay() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dark = (frame >= 360 && frame < 600) || frame >= 4320;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 61,
          opacity: dark ? 0 : 1,
        }}
      >
        <Brand />
      </div>
      <div
        style={{
          position: "absolute",
          right: 96,
          top: 78,
          fontSize: 19,
          letterSpacing: 2.3,
          color: dark ? "#bdcbbf" : "#79846e",
        }}
      >
        CIVIC HACK 2026 / VISUAL DRAFT 01
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          bottom: 42,
          fontSize: 18,
          color: dark ? "#bdcbbf" : "#79846e",
        }}
      >
        PROTOTYPE · FICTIONAL FEEDBACK · STAGED APP CAPTURES
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 5,
          width: interpolate(
            frame,
            [0, durationInFrames - 1],
            [0, 1920],
            clamp,
          ),
          background: "#c7833f",
        }}
      />
    </AbsoluteFill>
  );
}
function SceneWipe() {
  const frame = useCurrentFrame();
  const cut = [
    180, 360, 600, 870, 1140, 1500, 1710, 2010, 2250, 2400, 2760, 3120, 3360,
    3720, 4320,
  ].find((c) => frame >= c - 16 && frame < c + 16);
  if (cut === undefined) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: "#dce5cd",
        borderRight: "12px solid #c7833f",
        translate: interpolate(
          frame,
          [cut - 16, cut + 16],
          ["-1920px 0px", "1920px 0px"],
          { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) },
        ),
      }}
    />
  );
}
export const ProvisoDraft = ({ music = true }: { music?: boolean }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        fontFamily: "DM Sans, sans-serif",
        color: "#263d34",
        background: "#f8f8f3",
      }}
    >
      <FontsReady />
      <Track name="Story">
        <Problem
          name="The resident’s problem"
          durationInFrames={12 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Intro
          name="Introducing Proviso"
          from={12 * fps}
          durationInFrames={8 * fps}
          style={{ backgroundColor: "#163b2e" }}
        />
        <Explore
          name="Find a proposal"
          from={20 * fps}
          durationInFrames={18 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Overview
          name="Understand the proposal"
          from={38 * fps}
          durationInFrames={12 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Response
          name="A complete response"
          from={50 * fps}
          durationInFrames={30 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Community
          name="See community concerns"
          from={80 * fps}
          durationInFrames={24 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Updates
          name="Inspect a version change"
          from={104 * fps}
          durationInFrames={20 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Readiness
          name="Data limits and pilot"
          from={124 * fps}
          durationInFrames={20 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Outro
          name="Closing"
          from={144 * fps}
          durationInFrames={8 * fps}
          style={{ backgroundColor: "#163b2e" }}
        />
      </Track>
      <SceneWipe />
      <Overlay />
      {music ? <MusicBed /> : null}
    </AbsoluteFill>
  );
};
