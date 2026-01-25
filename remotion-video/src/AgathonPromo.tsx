import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  spring,
  Easing,
  Img,
  staticFile,
} from "remotion";

// Color palette
const colors = {
  bg: "#0f1419",
  white: "#ffffff",
  gray: "#6b7280",
  accent: "#00d4aa",
  warm: "#faf8f5",
};

// Scene 1: Logo
const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [0, 20], [0.9, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Fade out at the end
  const fadeOut = interpolate(frame, [50, 60], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          opacity: opacity * fadeOut,
          transform: `scale(${scale})`,
        }}
      >
        <Img
          src={staticFile("agathon.png")}
          style={{
            width: 120,
            height: 120,
            borderRadius: 24,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: Tagline
const Tagline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line2 = "not harder.";

  const line1Spring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const line2Spring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  // Fade out
  const fadeOut = interpolate(frame, [70, 85], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", opacity: fadeOut }}>
        <div
          style={{
            opacity: line1Spring,
            transform: `translateY(${(1 - line1Spring) * 40}px)`,
          }}
        >
          <span
            style={{
              fontSize: 88,
              fontWeight: 600,
              color: colors.white,
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: "-2px",
            }}
          >
            Learn{" "}
            <span style={{ color: colors.accent }}>smarter,</span>
          </span>
        </div>
        <div
          style={{
            opacity: line2Spring,
            transform: `translateY(${(1 - line2Spring) * 40}px)`,
          }}
        >
          <span
            style={{
              fontSize: 88,
              fontWeight: 600,
              color: colors.white,
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: "-2px",
            }}
          >
            {line2}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: Whiteboard
const Whiteboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const words = ["Draw", "Solve", "Understand"];

  // Fade out
  const fadeOut = interpolate(frame, [70, 85], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", opacity: fadeOut }}>
        <div style={{ opacity: labelOpacity, marginBottom: 32 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: colors.gray,
              fontFamily: "system-ui, -apple-system, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "4px",
            }}
          >
            Whiteboard
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {words.map((word, i) => {
            const wordSpring = spring({
              frame: frame - 10 - i * 8,
              fps,
              config: { damping: 14, stiffness: 80 },
            });

            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 48 }}>
                <span
                  style={{
                    fontSize: 64,
                    fontWeight: 600,
                    color: colors.white,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    letterSpacing: "-1px",
                    opacity: wordSpring,
                    transform: `translateY(${(1 - wordSpring) * 30}px)`,
                  }}
                >
                  {word}
                </span>
                {i < words.length - 1 && (
                  <span
                    style={{
                      fontSize: 48,
                      color: colors.gray,
                      opacity: wordSpring * 0.4,
                    }}
                  >
                    ·
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: Journal
const Journal: React.FC = () => {
  const frame = useCurrentFrame();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const cardOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  const cardY = interpolate(frame, [10, 25], [20, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Typing animation
  const text = "Today I finally understood derivatives...";
  const charsVisible = Math.floor(
    interpolate(frame, [25, 70], [0, text.length], {
      extrapolateRight: "clamp",
    })
  );

  const cursorBlink = Math.floor(frame / 15) % 2 === 0;

  // Fade out
  const fadeOut = interpolate(frame, [70, 85], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.warm,
        justifyContent: "center",
        alignItems: "center",
        padding: 120,
      }}
    >
      <div style={{ width: "100%", maxWidth: 800, opacity: fadeOut }}>
        <div style={{ opacity: labelOpacity, marginBottom: 32 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: colors.gray,
              fontFamily: "system-ui, -apple-system, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "4px",
            }}
          >
            Journal
          </span>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: 40,
            boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
            border: "1px solid #e5e5e5",
            opacity: cardOpacity,
            transform: `translateY(${cardY}px)`,
          }}
        >
          <span
            style={{
              fontSize: 32,
              color: "#1a1a1a",
              fontFamily: "Georgia, serif",
              lineHeight: 1.5,
            }}
          >
            {text.slice(0, charsVisible)}
            <span
              style={{
                opacity: cursorBlink && charsVisible < text.length ? 1 : 0,
                color: colors.accent,
              }}
            >
              |
            </span>
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 5: The shift
const TheShift: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const answersOpacity = interpolate(frame, [0, 15], [0, 0.5], {
    extrapolateRight: "clamp",
  });

  const strikeWidth = interpolate(frame, [20, 40], [0, 100], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const understandingSpring = spring({
    frame: frame - 45,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  // Fade out
  const fadeOut = interpolate(frame, [75, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", opacity: fadeOut }}>
        <div
          style={{
            position: "relative",
            display: "inline-block",
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontSize: 56,
              fontWeight: 500,
              color: colors.gray,
              fontFamily: "system-ui, -apple-system, sans-serif",
              opacity: answersOpacity,
            }}
          >
            Answers
          </span>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "-5%",
              width: `${strikeWidth}%`,
              height: 3,
              backgroundColor: "#ef4444",
              transform: "translateY(-50%)",
            }}
          />
        </div>

        <div
          style={{
            opacity: understandingSpring,
            transform: `translateY(${(1 - understandingSpring) * 30}px)`,
          }}
        >
          <span
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: colors.white,
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: "-2px",
            }}
          >
            Understanding
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 6: End
const End: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          opacity,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Img
          src={staticFile("agathon.png")}
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
          }}
        />
        <span
          style={{
            fontSize: 42,
            fontWeight: 600,
            color: colors.white,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "-1px",
          }}
        >
          agathon.app
        </span>
      </div>
    </AbsoluteFill>
  );
};

// Main
export const AgathonPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Sequence from={0} durationInFrames={60}>
        <LogoReveal />
      </Sequence>

      <Sequence from={55} durationInFrames={90}>
        <Tagline />
      </Sequence>

      <Sequence from={140} durationInFrames={90}>
        <Whiteboard />
      </Sequence>

      <Sequence from={225} durationInFrames={90}>
        <Journal />
      </Sequence>

      <Sequence from={310} durationInFrames={95}>
        <TheShift />
      </Sequence>

      <Sequence from={400} durationInFrames={110}>
        <End />
      </Sequence>
    </AbsoluteFill>
  );
};
