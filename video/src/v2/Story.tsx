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
import { film } from "./film-data";
import { guideCaptions as captions } from "./captions";
import "../style.css";

const C = {
  cream: "#f8f8f3",
  ink: "#263d34",
  green: "#285a45",
  olive: "#82956c",
  copper: "#b66d3d",
  blue: "#53788a",
  line: "#dce3d2",
  muted: "#677862",
  dark: "#153b2d",
};
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const smooth = { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) };
function Fonts() {
  const [h] = useState(() => delayRender("Local brand fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load("650 80px Manrope"),
      document.fonts.load("800 80px Manrope"),
      document.fonts.load('400 30px "DM Sans"'),
    ]).then(() => continueRender(h));
  }, [h]);
  return null;
}
function Logo({
  big = false,
  light = false,
}: {
  big?: boolean;
  light?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: big ? 22 : 12,
        alignItems: "center",
        color: light ? C.cream : C.green,
      }}
    >
      <CanvasImage
        src={staticFile("v2/proviso-logo.png")}
        style={{ width: big ? 82 : 42, height: big ? 82 : 42 }}
      />
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: big ? 112 : 39,
          fontWeight: 800,
          letterSpacing: big ? -7 : -2,
        }}
      >
        proviso<span style={{ color: "#c7833f" }}>.</span>
      </span>
    </div>
  );
}
function Enter({
  children,
  delay = 0,
  style = {},
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(f, [delay, delay + 18], [0, 1], smooth),
        translate: interpolate(
          f,
          [delay, delay + 28],
          ["0px 32px", "0px 0px"],
          smooth,
        ),
      }}
    >
      {children}
    </div>
  );
}
function Head({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <Interactive.Div
      name="Scene heading"
      style={{
        position: "absolute",
        left: 96,
        top: 155,
        fontFamily: "Manrope",
        fontSize: 65,
        lineHeight: 1.13,
        fontWeight: 650,
        letterSpacing: -3,
        color: light ? "#f8f8f3" : "#263d34",
      }}
    >
      {children}
    </Interactive.Div>
  );
}
function Eyebrow({
  children,
  color = C.muted,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: 19,
        fontWeight: 700,
        letterSpacing: 2.2,
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}
function Pill({
  children,
  color = C.green,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        border: `1px solid ${color}55`,
        background: `${color}10`,
        borderRadius: 40,
        color,
        padding: "11px 20px",
        fontSize: 23,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
function Box({
  children,
  x,
  y,
  w,
  h,
  style = {},
}: {
  children: React.ReactNode;
  x: number;
  y: number;
  w: number;
  h?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        padding: 32,
        borderRadius: 22,
        border: `1px solid ${C.line}`,
        background: "#fffef9",
        boxShadow: "0 20px 65px #142f2410",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function AppFrame({
  file,
  x = 96,
  y = 255,
  w = 1728,
  h = 610,
  pan = 0,
  zoom = 1,
}: {
  file: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  pan?: number;
  zoom?: number;
}) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 19,
        overflow: "hidden",
        border: "1px solid #d9e0d1",
        boxShadow: "0 24px 65px #142f2422",
        background: C.cream,
        opacity: 1,
        translate: interpolate(frame, [0, 28], ["0px 25px", "0px 0px"], smooth),
      }}
    >
      <CanvasImage
        src={staticFile(`v2/${file}.jpg`)}
        style={{
          position: "absolute",
          width: w * zoom,
          left: 0,
          top: (-pan * w) / 1280,
          scale: interpolate(frame, [0, 210], [1, 1.025], smooth),
          transformOrigin: "25% 30%",
        }}
      />
    </div>
  );
}
function QuoteCard({
  text,
  label,
  colour = C.copper,
  tag,
  style = {},
}: {
  text: string;
  label: string;
  colour?: string;
  tag?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: 30,
        borderRadius: 19,
        border: `1px solid ${colour}55`,
        background: "#fffef9",
        borderLeft: `5px solid ${colour}`,
        boxShadow: "0 18px 45px #142f2410",
        ...style,
      }}
    >
      <Eyebrow color={colour}>{label}</Eyebrow>
      <div style={{ fontSize: 32, lineHeight: 1.45, marginTop: 20 }}>
        “{text}”
      </div>
      {tag && (
        <div style={{ marginTop: 22 }}>
          <Pill color={colour}>{tag}</Pill>
        </div>
      )}
    </div>
  );
}
function ChapterCard({
  number,
  title,
  active,
  style = {},
}: {
  number: number;
  title: string;
  active: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 30,
        alignItems: "center",
        padding: "38px 42px",
        borderRadius: 20,
        border: `1px solid ${active ? "#c6d5b8" : "#dce3d2"}`,
        background: active ? "#e8eedc" : "#fffef9",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: 62,
          fontWeight: 650,
          color: active ? C.green : "#8a9781",
        }}
      >
        {number.toString().padStart(2, "0")}
      </span>
      <div
        style={{
          fontFamily: "Manrope",
          fontSize: 43,
          letterSpacing: -1.5,
          color: active ? C.ink : "#7a8772",
        }}
      >
        {title}
      </div>
    </div>
  );
}
function KensingtonMap({
  later = false,
  x,
  w = 520,
}: {
  later?: boolean;
  x: number;
  w?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 285,
        width: w,
        height: 535,
        overflow: "hidden",
        borderRadius: 16,
        border: "1px solid #dce3d2",
        background: "white",
      }}
    >
      <CanvasImage
        src={staticFile(
          `v2/kensington-${later ? "recommended" : "earlier"}.png`,
        )}
        style={{
          position: "absolute",
          width: later ? 1320 : 1250,
          maxWidth: "none",
          left: later ? -914 : -795,
          top: later ? -150 : -83,
        }}
      />
    </div>
  );
}
function PrecedentInner() {
  const f = useCurrentFrame();
  return (
    <>
      <Head>Public feedback can change a recommendation.</Head>
      <KensingtonMap x={96} />
      <KensingtonMap x={670} later />
      <div style={{ position: "absolute", left: 118, top: 300 }}>
        <Pill>Phase 3 design</Pill>
      </div>
      <div style={{ position: "absolute", left: 692, top: 300 }}>
        <Pill>Recommended design</Pill>
      </div>
      <Box
        x={1250}
        y={285}
        w={574}
        h={535}
        style={{ background: "#e8eedc", border: "none" }}
      >
        <Eyebrow>Kensington Market · Toronto · 2023</Eyebrow>
        <div
          style={{
            fontFamily: "Manrope",
            fontSize: 44,
            lineHeight: 1.22,
            letterSpacing: -1.5,
            marginTop: 35,
          }}
        >
          “Based on feedback heard through the public consultation…”
        </div>
        <div
          style={{
            height: 5,
            width: interpolate(f, [65, 110], [0, 470], smooth),
            background: "#c7833f",
            marginTop: 25,
          }}
        />
        <div style={{ fontSize: 27, lineHeight: 1.5, marginTop: 26 }}>
          Pedestrian priority.
          <br />
          Local vehicle access.
          <br />
          Business loading.
        </div>
      </Box>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 846,
          fontSize: 20,
          color: C.muted,
        }}
      >
        Source: City of Toronto · Design changes based on feedback from
        Consultation #3 · pp. 2, 5–6
      </div>
    </>
  );
}
function ChaptersInner() {
  const f = useCurrentFrame();
  return (
    <>
      <Enter style={{ position: "absolute", left: 96, top: 190 }}>
        <Logo big />
      </Enter>
      <Enter
        delay={12}
        style={{
          position: "absolute",
          left: 100,
          top: 355,
          fontSize: 42,
          lineHeight: 1.3,
          maxWidth: 1300,
        }}
      >
        Make your needs understood.
        <br />
        Stay involved as proposals change.
      </Enter>
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 545,
          width: 1720,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 28,
        }}
      >
        <Enter
          delay={45}
          style={{
            transformOrigin: "0 0",
            transform: `translate(${interpolate(f, [520, 569], [0, 230], smooth)}px, ${interpolate(f, [520, 569], [0, -484], smooth)}px) scale(${interpolate(f, [520, 569], [1, 0.48], smooth)})`,
          }}
        >
          <ChapterCard
            number={1}
            title="Understand community needs"
            active={f >= 275}
          />
        </Enter>
        <Enter
          delay={65}
          style={{
            filter: `opacity(${interpolate(f, [500, 560], [1, 0], clamp)})`,
          }}
        >
          <ChapterCard number={2} title="Follow what changes" active={false} />
        </Enter>
      </div>
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 795,
          width: 1720,
          height: 5,
          background: "#e3e9d9",
        }}
      >
        <div
          style={{
            height: 5,
            width: interpolate(f, [190, 390], [0, 1720], smooth),
            background: C.copper,
          }}
        />
      </div>
    </>
  );
}
function ExampleInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Head>One proposal. Different everyday needs.</Head>
      <Sequence durationInFrames={5 * fps} name="Find the application">
        <AppFrame file="search" pan={10} />
      </Sequence>
      <Sequence
        from={5 * fps}
        durationInFrames={4 * fps}
        name="Official notice"
      >
        <AppFrame file="official-notice" pan={100} />
      </Sequence>
      <Sequence
        from={9 * fps}
        durationInFrames={5 * fps}
        name="Earlier proposal"
      >
        <AppFrame file="earlier-overview" pan={90} />
      </Sequence>
    </>
  );
}
function BedroomIllustration() {
  const f = useCurrentFrame();
  return (
    <svg
      width="790"
      height="410"
      viewBox="0 0 790 410"
      style={{ display: "block" }}
    >
      <rect
        x="430"
        y="35"
        width="310"
        height="330"
        rx="18"
        fill="#e8eddd"
        stroke="#9baa8e"
        strokeWidth="2"
      />
      <rect
        x="463"
        y="90"
        width="90"
        height="100"
        rx="5"
        fill="#fffef9"
        stroke="#879979"
        strokeWidth="3"
      />
      <path d="M508 90V190M463 140H553" stroke="#879979" strokeWidth="3" />
      <rect x="470" y="240" width="220" height="24" rx="5" fill="#8b9b7e" />
      <rect x="470" y="218" width="70" height="27" rx="12" fill="#fffef9" />
      <path d="M470 265v42M690 265v42" stroke="#8b9b7e" strokeWidth="8" />
      <g
        style={{
          translate: interpolate(
            f,
            [15, 80],
            ["-120px 0px", "0px 0px"],
            smooth,
          ),
        }}
      >
        <rect x="50" y="200" width="190" height="105" rx="10" fill="#b66d3d" />
        <path d="M240 222h75l35 45v38H240Z" fill="#c99168" />
        <rect x="252" y="236" width="51" height="31" rx="5" fill="#fffef9" />
        <circle cx="105" cy="315" r="25" fill="#334b3e" />
        <circle cx="292" cy="315" r="25" fill="#334b3e" />
      </g>
      <path
        d="M355 185q65 55 0 110M380 163q90 80 0 151"
        fill="none"
        stroke="#c7833f"
        strokeWidth="4"
        strokeLinecap="round"
        opacity={interpolate(f, [60, 100], [0, 0.8], clamp)}
      />
      <path d="M30 365H760" stroke="#b9c7aa" strokeWidth="3" />
      <text x="52" y="390" fontFamily="DM Sans" fontSize="20" fill="#677862">
        Illustration of the fictional concern · not a site plan
      </text>
    </svg>
  );
}
function ResidentInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Head>Six in the morning is a daily-life issue.</Head>
      <Sequence durationInFrames={7 * fps} name="Loading beside a bedroom">
        <div style={{ position: "absolute", left: 93, top: 285 }}>
          <BedroomIllustration />
        </div>
        <Box x={1010} y={305} w={810} h={480}>
          <Eyebrow>Earlier arrangement</Eyebrow>
          <div
            style={{
              fontFamily: "Manrope",
              fontSize: 112,
              letterSpacing: -6,
              color: C.copper,
              marginTop: 20,
            }}
          >
            6 a.m.
          </div>
          <div style={{ fontSize: 37, marginTop: 10 }}>
            Routine deliveries may begin.
          </div>
          <div style={{ marginTop: 38 }}>
            <Pill color={C.copper}>Resident’s request: 9 a.m. or later</Pill>
          </div>
        </Box>
      </Sequence>
      <Sequence
        from={7 * fps}
        durationInFrames={8 * fps}
        name="Original comment and requirement"
      >
        <AppFrame
          file="delivery-group"
          x={96}
          y={260}
          w={1728}
          h={600}
          pan={160}
        />
        <Enter
          delay={15}
          style={{ position: "absolute", left: 965, top: 365, width: 800 }}
        >
          <QuoteCard
            text={film.resident.comment}
            label="The resident’s original words"
            tag="Start deliveries at 9 a.m. or later"
          />
        </Enter>
      </Sequence>
    </>
  );
}
function GroupInner() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Head>Different words. A shared request.</Head>
      <Sequence durationInFrames={9 * fps} name="Group original requests">
        {film.group.items.slice(0, 3).map((item, i) => (
          <Enter
            key={item.id}
            delay={i * 24}
            style={{
              position: "absolute",
              left: 96 + i * 582,
              top: 300,
              width: 550,
              transform: `translate(${interpolate(f, [120, 210], [0, (1 - i) * 582], smooth)}px, ${interpolate(f, [120, 210], [0, i * 10], smooth)}px)`,
            }}
          >
            <QuoteCard
              text={item.verbatim_quote}
              label={i === 0 ? "Our resident" : `Another resident · ${i + 1}`}
              tag="Later delivery starts"
              style={{ minHeight: 330 }}
            />
          </Enter>
        ))}
        <Enter
          delay={220}
          style={{ position: "absolute", left: 430, top: 350, width: 1060 }}
        >
          <Box x={0} y={0} w={1060} h={350} style={{ background: "#e8eedc" }}>
            <Eyebrow>Shared need · prepared demonstration group</Eyebrow>
            <div
              style={{
                fontFamily: "Manrope",
                fontSize: 68,
                fontWeight: 650,
                letterSpacing: -3,
                marginTop: 30,
              }}
            >
              Later delivery starts
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 35,
                marginTop: 30,
              }}
            >
              <Pill>{film.group.count} requests</Pill>
              <Pill>{film.group.items.length} distinct voices</Pill>
              <span style={{ fontSize: 28 }}>Original comments retained ↗</span>
            </div>
          </Box>
        </Enter>
      </Sequence>
      <Sequence
        from={9 * fps}
        durationInFrames={7 * fps}
        name="Open the actual group"
      >
        <AppFrame file="delivery-group" y={255} pan={150} />
        <div style={{ position: "absolute", left: 1190, top: 740 }}>
          <Pill>Expand to inspect each original comment</Pill>
        </div>
      </Sequence>
    </>
  );
}
function TimeRuler({ revised = false }: { revised?: boolean }) {
  const f = useCurrentFrame();
  const x = (h: number) => 90 + (h - 6) * 220;
  return (
    <svg width="1720" height="290" viewBox="0 0 1720 290">
      <path d="M90 60H1630" stroke="#c8d2bc" strokeWidth="3" />
      {[6, 7, 8, 9, 10, 11, 12].map((h) => (
        <g key={h}>
          <path d={`M${x(h)} 48V72`} stroke="#879979" strokeWidth="2" />
          <text
            x={x(h)}
            y="30"
            textAnchor="middle"
            fontFamily="DM Sans"
            fontSize="25"
            fill="#52664c"
          >
            {h === 12 ? "Noon" : `${h} a.m.`}
          </text>
        </g>
      ))}
      <rect
        x={x(9)}
        y="100"
        width="660"
        height="62"
        rx="12"
        fill="#e7eddc"
        stroke="#82956c"
      />
      <text
        x={x(9) + 20}
        y="140"
        fontFamily="DM Sans"
        fontSize="25"
        fill="#285a45"
      >
        Resident: 9 a.m. or later
      </text>
      <circle cx={x(7.5)} cy="212" r="10" fill="#53788a" />
      <path
        d={`M${x(7.5)} 72V198`}
        stroke="#53788a"
        strokeWidth="3"
        strokeDasharray="6 6"
      />
      <text
        x={x(7.5) + 20}
        y="220"
        fontFamily="DM Sans"
        fontSize="25"
        fill="#53788a"
      >
        Bakery: 7:30 a.m.
      </text>
      {revised && (
        <>
          <rect
            x={x(9)}
            y="75"
            width={interpolate(f, [20, 80], [0, 440], smooth)}
            height="10"
            rx="5"
            fill="#b66d3d"
          />
          <text
            x={x(9)}
            y="277"
            fontFamily="DM Sans"
            fontSize="27"
            fill="#b66d3d"
          >
            Revised delivery window: 9–11 a.m.
          </text>
        </>
      )}
    </svg>
  );
}
function TradeoffInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Head>Shared needs. A competing need.</Head>
      <Sequence durationInFrames={10 * fps} name="Same time scale">
        <Enter style={{ position: "absolute", left: 96, top: 280, width: 810 }}>
          <QuoteCard
            label="Nearby residents"
            text="Six in the morning? Please move that later. I work evenings and I’m barely asleep by two."
            tag="9 a.m. or later"
          />
        </Enter>
        <Enter
          delay={24}
          style={{ position: "absolute", left: 1000, top: 280, width: 824 }}
        >
          <QuoteCard
            colour={C.blue}
            label="The bakery"
            text={film.bakeryBefore.comment}
            tag="A 7:30 a.m. delivery slot"
          />
        </Enter>
        <div style={{ position: "absolute", left: 96, top: 610 }}>
          <TimeRuler />
        </div>
      </Sequence>
      <Sequence
        from={10 * fps}
        durationInFrames={6 * fps}
        name="Position and feature context"
      >
        <AppFrame file="earlier-community" pan={90} />
        <Box x={1120} y={520} w={620} h={265} style={{ background: "#fffef9" }}>
          <Eyebrow>Different questions</Eyebrow>
          <div style={{ fontSize: 35, lineHeight: 1.5, marginTop: 22 }}>
            Overall position
            <br />
            Delivery-specific rating
            <br />
            Specific request
          </div>
        </Box>
      </Sequence>
    </>
  );
}
function RevisionInner() {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  return (
    <>
      <Sequence durationInFrames={3 * fps} name="Select chapter two">
        <Head>Two connected approaches. The same proposal.</Head>
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 545,
            width: 1720,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
          }}
        >
          <div style={{ opacity: interpolate(f, [35, 75], [1, 0.3], clamp) }}>
            <ChapterCard
              number={1}
              title="Understand community needs"
              active={false}
            />
          </div>
          <div
            style={{
              transformOrigin: "0 0",
              transform: `translate(${interpolate(f, [50, 89], [0, -644], smooth)}px, ${interpolate(f, [50, 89], [0, -484], smooth)}px) scale(${interpolate(f, [50, 89], [1, 0.48], smooth)})`,
            }}
          >
            <ChapterCard number={2} title="Follow what changes" active />
          </div>
        </div>
      </Sequence>
      <Sequence
        from={3 * fps}
        durationInFrames={7 * fps}
        name="Switch proposal version"
      >
        <Head>Keep the same concern in view.</Head>
        <AppFrame file="delivery-comparison" y={260} pan={40} />
        <Box x={1110} y={580} w={650} h={230}>
          <Eyebrow>Earlier → Current</Eyebrow>
          <div
            style={{
              fontFamily: "Manrope",
              fontSize: 69,
              letterSpacing: -3,
              marginTop: 24,
            }}
          >
            6 a.m. → 9–11 a.m.
          </div>
        </Box>
      </Sequence>
      <Sequence
        from={10 * fps}
        durationInFrames={8 * fps}
        name="Requirement and passage"
      >
        <Head>A passage the resident can check.</Head>
        <Box x={96} y={290} w={800} h={320}>
          <Eyebrow color={C.copper}>Their earlier request</Eyebrow>
          <div style={{ fontSize: 43, lineHeight: 1.35, marginTop: 30 }}>
            Start routine deliveries at
            <br />
            <strong>9 a.m. or later.</strong>
          </div>
        </Box>
        <Box x={1024} y={290} w={800} h={320} style={{ background: "#e8eedc" }}>
          <Eyebrow>Revised wording</Eyebrow>
          <div style={{ fontSize: 43, lineHeight: 1.35, marginTop: 30 }}>
            Routine deliveries scheduled
            <br />
            from <strong>9 to 11 a.m.</strong>
          </div>
        </Box>
        <div style={{ position: "absolute", left: 96, top: 655 }}>
          <TimeRuler revised />
        </div>
        <div style={{ position: "absolute", left: 1390, top: 640 }}>
          <Pill>Potentially addressed</Pill>
        </div>
      </Sequence>
    </>
  );
}
function UnresolvedInner() {
  return (
    <>
      <Head>What still needs an answer?</Head>
      <Enter style={{ position: "absolute", left: 96, top: 290, width: 810 }}>
        <QuoteCard
          colour={C.blue}
          label="Bakery · earlier request"
          text={film.bakeryBefore.condition!.requirement}
          tag="7:30 a.m."
        />
      </Enter>
      <Enter
        delay={25}
        style={{ position: "absolute", left: 1010, top: 290, width: 814 }}
      >
        <QuoteCard
          colour={C.blue}
          label="Same bakery · current comment"
          text={film.bakeryAfter.comment}
          tag="Unresolved"
        />
      </Enter>
      <div style={{ position: "absolute", left: 96, top: 610 }}>
        <TimeRuler revised />
      </div>
    </>
  );
}
function ReviewInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Head>The resident decides what the revision means.</Head>
      <Sequence durationInFrames={5 * fps} name="Relevant changes">
        <AppFrame file="resident-review" pan={200} />
      </Sequence>
      <Sequence
        from={5 * fps}
        durationInFrames={4 * fps}
        name="Update delivery rating"
      >
        <AppFrame file="delivery-rating" pan={65} />
        <Box x={1100} y={490} w={620} h={290}>
          <Eyebrow>One response · separate answers</Eyebrow>
          <div style={{ fontSize: 34, lineHeight: 1.7, marginTop: 20 }}>
            Delivery hours: <strong>Support</strong>
            <br />
            Overall position: <strong>Neutral</strong>
          </div>
        </Box>
      </Sequence>
      <Sequence
        from={9 * fps}
        durationInFrames={4 * fps}
        name="Check and confirm"
      >
        <AppFrame file="confirm" pan={270} />
      </Sequence>
      <Sequence
        from={13 * fps}
        durationInFrames={4 * fps}
        name="Saved for this version"
      >
        <AppFrame file="saved-current" pan={115} />
        <Box x={1160} y={570} w={570} h={235} style={{ background: "#e8eedc" }}>
          <Eyebrow>Saved for Current</Eyebrow>
          <div style={{ fontSize: 34, lineHeight: 1.45, marginTop: 20 }}>
            Earlier response preserved.
            <br />
            Current response revised.
          </div>
        </Box>
      </Sequence>
    </>
  );
}
const order = [
  "strongly_oppose",
  "oppose",
  "neutral",
  "support",
  "strongly_support",
  "unsure",
] as const;
const positionColours = [
  "#91483c",
  "#c7814c",
  "#919687",
  "#638563",
  "#355d4c",
  "#7b8591",
];
function MatchedBar({
  counts,
  label,
}: {
  counts: Record<string, number>;
  label: string;
}) {
  const f = useCurrentFrame();
  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ fontSize: 26, fontWeight: 600, marginBottom: 15 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 4, height: 60, width: 1320 }}>
        {order.map((p, i) => (
          <div
            key={p}
            style={{
              width: interpolate(
                f,
                [15 + i * 4, 55 + i * 4],
                [0, (counts[p] / film.matched.participants) * 1296],
                smooth,
              ),
              background: positionColours[i],
              borderRadius: 4,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 14,
          fontSize: 20,
          color: C.muted,
        }}
      >
        {order.map((p, i) => (
          <span key={p}>
            <i
              style={{
                display: "inline-block",
                width: 11,
                height: 11,
                background: positionColours[i],
                marginRight: 8,
              }}
            />
            {p.replace("strongly_", "Strongly ").replace("_", " ")}: {counts[p]}
          </span>
        ))}
      </div>
    </div>
  );
}
function HistoryInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence durationInFrames={4 * fps} name="Actual matched comparison">
        <Head>The same people. Two versions.</Head>
        <AppFrame file="matched-history" pan={80} />
      </Sequence>
      <Sequence
        from={4 * fps}
        durationInFrames={8 * fps}
        name="Comparable respondents"
      >
        <Head>Compare the same {film.matched.participants} respondents.</Head>
        <Box x={96} y={270} w={1728} h={570}>
          <div style={{ marginLeft: 22 }}>
            <MatchedBar
              counts={film.matched.earlier}
              label="Earlier · Nov 12"
            />
            <MatchedBar
              counts={film.matched.current}
              label="Current · Nov 13"
            />
          </div>
          <div style={{ display: "flex", gap: 26, marginTop: 38 }}>
            <Pill>{film.reviewAfter.unreviewed} awaiting review</Pill>
            <Pill>{film.reviewAfter.reconfirmed} reconfirmed</Pill>
            <Pill>{film.reviewAfter.revised} revised</Pill>
            <span style={{ fontSize: 22, color: C.muted, paddingTop: 10 }}>
              Prepared example · not a representative vote
            </span>
          </div>
        </Box>
      </Sequence>
    </>
  );
}
function ClosingInner() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence durationInFrames={3 * fps} name="Recall the precedent">
        <Head>Kensington shows why the connection matters.</Head>
        <div
          style={{
            position: "absolute",
            left: 96,
            top: 290,
            width: 600,
            height: 500,
            overflow: "hidden",
            borderRadius: 20,
          }}
        >
          <CanvasImage
            src={staticFile("v2/kensington-recommended.png")}
            style={{
              width: 1680,
              left: -1165,
              top: -190,
              position: "absolute",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 800,
            top: 370,
            width: 900,
            fontSize: 52,
            lineHeight: 1.3,
          }}
        >
          Understand the needs.
          <br />
          Make the follow-through visible.
        </div>
      </Sequence>
      <Sequence
        from={3 * fps}
        durationInFrames={8 * fps}
        name="A practical pilot"
      >
        <Head>One connected public conversation.</Head>
        <div
          style={{
            position: "absolute",
            left: 96,
            top: 310,
            display: "flex",
            gap: 18,
          }}
        >
          {[
            "Individual voices",
            "Shared + competing needs",
            "Revised proposal",
            "Reviewed responses",
          ].map((t, i) => (
            <Enter delay={i * 14} key={t}>
              <div
                style={{
                  width: 414,
                  height: 155,
                  padding: 27,
                  borderTop: `4px solid ${i === 1 ? C.blue : C.copper}`,
                  background: "#fffef9",
                  borderRadius: 16,
                  fontFamily: "Manrope",
                  fontSize: 34,
                  lineHeight: 1.3,
                  letterSpacing: -1,
                }}
              >
                {t}
              </div>
            </Enter>
          ))}
        </div>
        <div style={{ position: "absolute", left: 96, top: 540 }}>
          <Eyebrow>Pilot next steps</Eyebrow>
          <div style={{ display: "flex", gap: 26, marginTop: 25 }}>
            <Pill>Verified participation windows</Pill>
            <Pill>Municipal staff responses</Pill>
            <Pill>Assisted access offline</Pill>
          </div>
          <div style={{ fontSize: 24, marginTop: 32, color: C.muted }}>
            Prototype feedback is not submitted to the City.
          </div>
        </div>
      </Sequence>
      <Sequence
        from={11 * fps}
        durationInFrames={6 * fps}
        name="Proviso closing"
      >
        <AbsoluteFill style={{ background: C.dark }} />
        <div style={{ position: "absolute", left: 150, top: 275 }}>
          <Logo big light />
          <div
            style={{
              fontFamily: "Manrope",
              fontSize: 67,
              lineHeight: 1.2,
              letterSpacing: -3,
              color: C.cream,
              marginTop: 50,
            }}
          >
            Make your needs understood.
            <br />
            Stay connected as decisions evolve.
          </div>
        </div>
      </Sequence>
    </>
  );
}
const schema = { ...Interactive.backgroundSchema };
export const Precedent = Interactive.create({
  Component: PrecedentInner,
  layout: "absolute-fill",
  schema,
});
const Chapters = Interactive.create({
  Component: ChaptersInner,
  layout: "absolute-fill",
  schema,
});
const Example = Interactive.create({
  Component: ExampleInner,
  layout: "absolute-fill",
  schema,
});
const Resident = Interactive.create({
  Component: ResidentInner,
  layout: "absolute-fill",
  schema,
});
const Group = Interactive.create({
  Component: GroupInner,
  layout: "absolute-fill",
  schema,
});
const Tradeoff = Interactive.create({
  Component: TradeoffInner,
  layout: "absolute-fill",
  schema,
});
const Revision = Interactive.create({
  Component: RevisionInner,
  layout: "absolute-fill",
  schema,
});
const Unresolved = Interactive.create({
  Component: UnresolvedInner,
  layout: "absolute-fill",
  schema,
});
const Review = Interactive.create({
  Component: ReviewInner,
  layout: "absolute-fill",
  schema,
});
const History = Interactive.create({
  Component: HistoryInner,
  layout: "absolute-fill",
  schema,
});
const Closing = Interactive.create({
  Component: ClosingInner,
  layout: "absolute-fill",
  schema,
});
function GuideCaptions() {
  const frame = useCurrentFrame();
  const c = captions.find(
    (c) => frame >= Math.round(c.start * 30) && frame < Math.round(c.end * 30),
  );
  return c ? (
    <div
      style={{
        position: "absolute",
        left: 120,
        right: 120,
        bottom: 35,
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "inline-block",
          background: "#173b2ef2",
          borderRadius: 10,
          padding: "16px 28px",
          color: "#fffef9",
          fontSize: 30,
          lineHeight: 1.4,
          maxWidth: 1660,
        }}
      >
        {c.text}
      </div>
    </div>
  ) : null;
}
function Overlay() {
  const f = useCurrentFrame();
  const dark = f >= 164 * 30;
  const chapter = f >= 94 * 30 ? 2 : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 52,
          opacity: dark ? 0 : 1,
        }}
      >
        <Logo />
      </div>
      {f >= 33 * 30 && f < 153 * 30 && (
        <div
          style={{
            position: "absolute",
            right: 96,
            top: 67,
            fontSize: 20,
            color: C.muted,
          }}
        >
          Demonstration: simulated feedback and revisions
        </div>
      )}
      {f >= 33 * 30 && f < 153 * 30 && !(f >= 94 * 30 && f < 97 * 30) && (
        <div
          style={{
            position: "absolute",
            left: 330,
            top: 61,
            borderLeft: "1px solid #cbd5c0",
            paddingLeft: 28,
            fontSize: 22,
            color: C.green,
          }}
        >
          <strong style={{ color: C.copper, marginRight: 12 }}>
            {chapter}.
          </strong>
          {chapter === 1 ? "Understand community needs" : "Follow what changes"}
        </div>
      )}
      {f >= 33 * 30 && f < 153 * 30 && (
        <div
          style={{
            position: "absolute",
            left: 96,
            top: 895,
            fontSize: 17,
            color: C.muted,
          }}
        >
          Actual app UI and explanatory graphics · prepared scenario · map ©
          OpenStreetMap contributors / Leaflet
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: interpolate(f, [0, 5099], [0, 1920], clamp),
          height: 4,
          background: "#c7833f",
        }}
      />
    </AbsoluteFill>
  );
}
function Wipes() {
  const f = useCurrentFrame();
  const cut = [14, 47, 62, 78, 94, 112, 124, 141, 153]
    .map((s) => s * 30)
    .find((t) => f >= t - 11 && f < t + 11);
  return cut === undefined ? null : (
    <AbsoluteFill
      style={{
        background: "#e2e9d5",
        borderRight: "9px solid #c7833f",
        translate: interpolate(
          f,
          [cut - 11, cut + 11],
          ["-1920px 0px", "1920px 0px"],
          { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) },
        ),
      }}
    />
  );
}
export function ProvisoStoryV2({
  guideCaptions = true,
  music = true,
}: {
  guideCaptions?: boolean;
  music?: boolean;
}) {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: C.cream,
        overflow: "hidden",
        overflowAnchor: "none",
        color: C.ink,
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      <Fonts />
      <Track name="Edited script">
        <Precedent
          name="Kensington historical evidence"
          durationInFrames={14 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Chapters
          name="Two connected approaches"
          from={14 * fps}
          durationInFrames={19 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Example
          name="Labatt application"
          from={33 * fps}
          durationInFrames={14 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Resident
          name="Delivery-noise resident"
          from={47 * fps}
          durationInFrames={15 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Group
          name="Shared delivery request"
          from={62 * fps}
          durationInFrames={16 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Tradeoff
          name="Bakery trade-off"
          from={78 * fps}
          durationInFrames={16 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Revision
          name="Follow what changes"
          from={94 * fps}
          durationInFrames={18 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Unresolved
          name="Keep unresolved needs visible"
          from={112 * fps}
          durationInFrames={12 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Review
          name="Resident review and confirmation"
          from={124 * fps}
          durationInFrames={17 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <History
          name="Preserved and matched responses"
          from={141 * fps}
          durationInFrames={12 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
        <Closing
          name="Pilot and closing"
          from={153 * fps}
          durationInFrames={17 * fps}
          style={{ backgroundColor: "#f8f8f3" }}
        />
      </Track>
      <Wipes />
      <Overlay />
      {guideCaptions ? <GuideCaptions /> : null}
      {music && (
        <Audio
          name="Original background sketch"
          src={staticFile("audio/story-bed-v2.wav")}
          volume={(frame) =>
            interpolate(
              frame,
              [0, 2 * fps, durationInFrames - 3 * fps, durationInFrames],
              [0, 0.45, 0.45, 0],
              clamp,
            )
          }
        />
      )}
    </AbsoluteFill>
  );
}
