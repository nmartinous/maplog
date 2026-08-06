import React from "react";
import { VIEWPORT_W, VIEWPORT_H } from "./zoneConstants";

interface PhoneFrameProps {
  children?: React.ReactNode;
  /** Scale factor to fit in the design canvas. Defaults to auto-fit. */
  scale?: number;
}

/**
 * iPhone-shaped frame rendered at the canonical 390 × 844 CSS-px viewport
 * ratio, scaled to fit the available canvas area.
 *
 * Children fill the interior content area (inside the bezels).
 */
export function PhoneFrame({ children, scale }: PhoneFrameProps) {
  // Frame shell dimensions (a bit bigger than the screen area)
  const BEZEL = 12;
  const CORNER = 52;
  const frameW = VIEWPORT_W + BEZEL * 2;
  const frameH = VIEWPORT_H + BEZEL * 2;

  const resolvedScale = scale ?? 1;

  return (
    <div
      style={{
        position: "relative",
        width: frameW,
        height: frameH,
        borderRadius: CORNER,
        background: "linear-gradient(160deg, #2a2a2e 0%, #1a1a1d 60%, #111114 100%)",
        boxShadow:
          "0 0 0 1px #ffffff18 inset, 0 0 0 2px #00000060, 0 32px 80px -12px #000000cc, 0 8px 24px -4px #000000aa",
        transform: `scale(${resolvedScale})`,
        transformOrigin: "top center",
        flexShrink: 0,
      }}
    >
      {/* Side button — power */}
      <div
        style={{
          position: "absolute",
          right: -3,
          top: 140,
          width: 3,
          height: 64,
          borderRadius: "0 2px 2px 0",
          background: "#333",
        }}
      />
      {/* Volume buttons */}
      {[100, 148].map((top) => (
        <div
          key={top}
          style={{
            position: "absolute",
            left: -3,
            top,
            width: 3,
            height: 36,
            borderRadius: "2px 0 0 2px",
            background: "#333",
          }}
        />
      ))}
      {/* Mute switch */}
      <div
        style={{
          position: "absolute",
          left: -3,
          top: 68,
          width: 3,
          height: 22,
          borderRadius: "2px 0 0 2px",
          background: "#333",
        }}
      />

      {/* Screen area */}
      <div
        style={{
          position: "absolute",
          inset: BEZEL,
          borderRadius: CORNER - BEZEL,
          overflow: "hidden",
          background: "#0a0a0f",
        }}
      >
        {/* Dynamic island notch */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 34,
            borderRadius: 17,
            background: "#000",
            zIndex: 100,
          }}
        />
        {children}
      </div>
    </div>
  );
}
