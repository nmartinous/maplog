import React, { useState } from "react";
import { PhoneFrame } from "./PhoneFrame";
import {
  VIEWPORT_W,
  VIEWPORT_H,
  TOP_CHROME,
  BOTTOM_CHROME,
  MINI_PLAYER,
  MOBILE_NAV,
  CARD_BG_H,
  DEFAULT_SLOT_W_RATIO,
  slotDimensions,
} from "./zoneConstants";

// ── Inline keyframes injected once ───────────────────────────────────────────
const STYLE_TAG = `
@keyframes shimmer-sweep {
  0%   { transform: translateX(-100%) skewX(-15deg); }
  100% { transform: translateX(300%)  skewX(-15deg); }
}
@keyframes rainbow-border {
  0%   { border-color: #ff0080; }
  16%  { border-color: #ff8000; }
  33%  { border-color: #ffff00; }
  50%  { border-color: #00ff80; }
  66%  { border-color: #0080ff; }
  83%  { border-color: #8000ff; }
  100% { border-color: #ff0080; }
}
@keyframes radiant-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes twinkle {
  0%, 100% { opacity: 0.2; }
  50%       { opacity: 1; }
}
`;

// ── Rarity badge (self-contained, no maplog imports) ──────────────────────────
function Badge({
  label,
  color,
  bgColor,
  borderColor,
  shiny,
}: {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  shiny?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "system-ui, sans-serif",
        color,
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        animation: shiny ? "rainbow-border 2s linear infinite" : undefined,
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </span>
  );
}

// ── Card presets ─────────────────────────────────────────────────────────────

interface CardPreset {
  id: string;
  tabLabel: string;
  accentColor: string;
  bgBleed: string; // radial-gradient for the card background zone
  renderCard: (w: number, h: number) => React.ReactNode;
}

const PRESETS: CardPreset[] = [
  // ── Common ────────────────────────────────────────────────────────────────
  {
    id: "common",
    tabLabel: "Common",
    accentColor: "#4ade80",
    bgBleed: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(74,222,128,0.22) 0%, transparent 70%)",
    renderCard: (w, h) => {
      const artH = w;
      const infoH = h - artH;
      return (
        <div
          style={{
            width: w, height: h,
            borderRadius: 16,
            border: "2px solid #4ade80",
            background: "linear-gradient(160deg, #0a2016 0%, #0a0a0f 70%)",
            boxShadow: "0 0 20px -4px #4ade8066, 0 0 0 1px #4ade8022",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Art square */}
          <div style={{ width: w, height: artH, flexShrink: 0, position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#4ade8022 0%,#0d0d0d 100%)" }}>
            <svg width={w} height={artH} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <defs>
                <radialGradient id="cg-art" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="100" height="100" fill="url(#cg-art)" />
              {/* Disc icon */}
              <circle cx="50" cy="50" r="28" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeOpacity="0.15" />
              <circle cx="50" cy="50" r="16" fill="none" stroke="#4ade80" strokeWidth="1" strokeOpacity="0.1" />
              <circle cx="50" cy="50" r="6" fill="#4ade80" fillOpacity="0.12" />
            </svg>
          </div>
          {/* Info strip */}
          <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: infoH, justifyContent: "center" }}>
            <div style={{ fontSize: Math.max(10, w * 0.065), fontWeight: 700, color: "#fff", textAlign: "center", fontFamily: "system-ui" }}>Blinding Lights</div>
            <div style={{ fontSize: Math.max(9, w * 0.05), color: "rgba(255,255,255,0.5)", fontFamily: "system-ui" }}>The Weeknd</div>
            <Badge label="Common" color="#4ade80" bgColor="#04120a" borderColor="#4ade80aa" />
          </div>
        </div>
      );
    },
  },

  // ── Rare ──────────────────────────────────────────────────────────────────
  {
    id: "rare",
    tabLabel: "Rare",
    accentColor: "#f97316",
    bgBleed: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(249,115,22,0.22) 0%, transparent 70%)",
    renderCard: (w, h) => {
      const artH = w;
      const infoH = h - artH;
      return (
        <div
          style={{
            width: w, height: h,
            borderRadius: 16,
            border: "2px solid #f97316",
            background: "linear-gradient(160deg, #1c0800 0%, #0a0a0f 70%)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Rare glow aura */}
          <div style={{
            position: "absolute", inset: -1, borderRadius: 16,
            boxShadow: "0 0 0 2px #f9731644, 0 0 24px 4px #f9731622",
            pointerEvents: "none", zIndex: 0,
          }} />
          <div style={{ width: w, height: artH, flexShrink: 0, position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#f9731622 0%,#0d0d0d 100%)" }}>
            <svg width={w} height={artH} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <defs>
                <radialGradient id="rg-art" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="100" height="100" fill="url(#rg-art)" />
              {/* Pixel gem */}
              <rect x="42" y="26" width="16" height="8" fill="#f97316" fillOpacity="0.4" />
              <rect x="36" y="34" width="28" height="8" fill="#f97316" fillOpacity="0.4" />
              <rect x="32" y="42" width="36" height="8" fill="#f97316" fillOpacity="0.4" />
              <rect x="36" y="50" width="28" height="8" fill="#f97316" fillOpacity="0.4" />
              <rect x="42" y="58" width="16" height="8" fill="#f97316" fillOpacity="0.4" />
            </svg>
          </div>
          <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: infoH, justifyContent: "center", position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: Math.max(10, w * 0.065), fontWeight: 700, color: "#fff", textAlign: "center", fontFamily: "system-ui" }}>Anti-Hero</div>
            <div style={{ fontSize: Math.max(9, w * 0.05), color: "rgba(255,255,255,0.5)", fontFamily: "system-ui" }}>Taylor Swift</div>
            <Badge label="RARE" color="#f97316" bgColor="#160800" borderColor="#f97316aa" />
          </div>
        </div>
      );
    },
  },

  // ── Epic ──────────────────────────────────────────────────────────────────
  {
    id: "epic",
    tabLabel: "Epic",
    accentColor: "#eac54f",
    bgBleed: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(234,197,79,0.2) 0%, transparent 70%)",
    renderCard: (w, h) => {
      const artH = w;
      const infoH = h - artH;
      const borderGrad = "linear-gradient(140deg,#f5d67b 0%,#e9a13b 30%,#f8e3a1 50%,#c97b23 75%,#f5d67b 100%)";
      return (
        <div style={{ width: w, height: h, position: "relative", borderRadius: 16, overflow: "visible" }}>
          {/* Epic gradient border via pseudo-element trick with wrapper */}
          <div style={{
            position: "absolute", inset: -2, borderRadius: 18,
            background: borderGrad,
            zIndex: 0,
          }} />
          <div style={{
            position: "absolute", inset: 0, borderRadius: 16,
            background: "linear-gradient(160deg,#2a1800 0%,#0a0a0f 70%)",
            overflow: "hidden",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{ width: w, height: artH, flexShrink: 0, position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#eac54f22 0%,#0d0d0d 100%)" }}>
              <svg width={w} height={artH} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                <defs>
                  <radialGradient id="eg-art" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#eac54f" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <rect width="100" height="100" fill="url(#eg-art)" />
                {/* Diamond */}
                <polygon points="50,22 74,50 50,78 26,50" fill="none" stroke="#eac54f" strokeWidth="2" strokeOpacity="0.5" />
                <polygon points="50,30 66,50 50,70 34,50" fill="none" stroke="#eac54f" strokeWidth="1" strokeOpacity="0.3" />
                <polygon points="50,22 74,50 50,46" fill="white" fillOpacity="0.06" />
              </svg>
              {/* Epic pins row */}
              <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 3 }}>
                {["#f5d67b","#e9a13b","#f8e3a1"].map((c, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: `0 0 4px ${c}` }} />
                ))}
              </div>
            </div>
            <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: infoH, justifyContent: "center" }}>
              <div style={{ fontSize: Math.max(10, w * 0.065), fontWeight: 700, color: "#fff", textAlign: "center", fontFamily: "system-ui" }}>As It Was</div>
              <div style={{ fontSize: Math.max(9, w * 0.05), color: "rgba(255,255,255,0.5)", fontFamily: "system-ui" }}>Harry Styles</div>
              <Badge label="Epic" color="#eac54f" bgColor="linear-gradient(90deg,#6b5800,#4a2a00)" borderColor="#b4840055" />
            </div>
          </div>
        </div>
      );
    },
  },

  // ── Shiny ─────────────────────────────────────────────────────────────────
  {
    id: "shiny",
    tabLabel: "Shiny",
    accentColor: "#a855f7",
    bgBleed: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(168,85,247,0.25) 0%, transparent 70%)",
    renderCard: (w, h) => {
      const artH = w;
      const infoH = h - artH;
      return (
        <div
          style={{
            width: w, height: h,
            borderRadius: 16,
            border: "2.5px solid #d946ef",
            background: "linear-gradient(160deg, #1a0520 0%, #0a0a0f 70%)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            animation: "rainbow-border 2s linear infinite",
          }}
        >
          {/* Foil shimmer sweep */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)",
            animation: "shimmer-sweep 3s ease-in-out infinite",
            zIndex: 5,
            pointerEvents: "none",
          }} />
          <div style={{ width: w, height: artH, flexShrink: 0, position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#d946ef22 0%,#0d0d0d 100%)" }}>
            <svg width={w} height={artH} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id="sg-art" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff0080" stopOpacity="0.2" />
                  <stop offset="33%" stopColor="#8000ff" stopOpacity="0.2" />
                  <stop offset="66%" stopColor="#0080ff" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ff0080" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" fill="url(#sg-art)" />
              {/* Crystal gem */}
              <polygon points="50,20 72,36 72,62 50,78 28,62 28,36" fill="none" stroke="#d946ef" strokeWidth="1.5" strokeOpacity="0.5" />
              <polygon points="50,20 72,36 50,44 28,36" fill="white" fillOpacity="0.08" />
            </svg>
          </div>
          <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: infoH, justifyContent: "center", position: "relative", zIndex: 6 }}>
            <div style={{ fontSize: Math.max(10, w * 0.065), fontWeight: 700, color: "#fff", textAlign: "center", fontFamily: "system-ui" }}>Levitating</div>
            <div style={{ fontSize: Math.max(9, w * 0.05), color: "rgba(255,255,255,0.5)", fontFamily: "system-ui" }}>Dua Lipa</div>
            <Badge label="Uncommon" color="#d946ef" bgColor="#0e0520" borderColor="#d946ef" shiny />
          </div>
        </div>
      );
    },
  },

  // ── Radiant ───────────────────────────────────────────────────────────────
  {
    id: "radiant",
    tabLabel: "Radiant",
    accentColor: "#a78bfa",
    bgBleed: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(167,139,250,0.25) 0%, transparent 70%)",
    renderCard: (w, h) => {
      const artH = w;
      const infoH = h - artH;
      // Inline SVG prism pattern as data URI
      const c = "#a78bfa";
      const patternSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><path d='M24 4 44 24 24 44 4 24Z' fill='none' stroke='${c}' stroke-width='1.5' opacity='0.8'/><path d='M24 14 34 24 24 34 14 24Z' fill='none' stroke='${c}' stroke-width='1' opacity='0.5'/></svg>`;
      const patternUrl = `url("data:image/svg+xml,${encodeURIComponent(patternSvg)}")`;
      return (
        <div
          style={{
            width: w, height: h,
            borderRadius: 16,
            border: "2px solid #a78bfa",
            background: "linear-gradient(160deg, #0e0520 0%, #0a0a0f 70%)",
            boxShadow: "0 0 20px -4px #a78bfa66, 0 0 0 1px #a78bfa22",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Radiant shimmer sweep */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(105deg, transparent 25%, rgba(167,139,250,0.12) 50%, transparent 75%)",
            animation: "shimmer-sweep 2.5s ease-in-out infinite",
            zIndex: 5,
            pointerEvents: "none",
          }} />
          {/* SVG prism pattern overlay */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: patternUrl,
            backgroundSize: "48px 48px",
            opacity: 0.35,
            zIndex: 4,
            pointerEvents: "none",
          }} />
          <div style={{ width: w, height: artH, flexShrink: 0, position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#a78bfa22 0%,#0d0d0d 100%)" }}>
            <svg width={w} height={artH} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <defs>
                <radialGradient id="radg-art" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="100" height="100" fill="url(#radg-art)" />
              {/* Sparkle */}
              <polygon points="50,22 53.2,40.8 72,44 53.2,47.2 50,66 46.8,47.2 28,44 46.8,40.8" fill="#a78bfa" fillOpacity="0.5" />
              <circle cx="72" cy="26" r="2.5" fill="#a78bfa" fillOpacity="0.6" />
              <circle cx="28" cy="64" r="1.8" fill="#a78bfa" fillOpacity="0.4" />
            </svg>
          </div>
          <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: infoH, justifyContent: "center", position: "relative", zIndex: 6 }}>
            <div style={{ fontSize: Math.max(10, w * 0.065), fontWeight: 700, color: "#fff", textAlign: "center", fontFamily: "system-ui" }}>Flowers</div>
            <div style={{ fontSize: Math.max(9, w * 0.05), color: "rgba(255,255,255,0.5)", fontFamily: "system-ui" }}>Miley Cyrus</div>
            <Badge label="Radiant" color="#a78bfa" bgColor="#0a0614" borderColor="#a78bfa88" />
          </div>
        </div>
      );
    },
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function CardViewFitDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const preset = PRESETS[activeIdx];

  const slotW = Math.round(DEFAULT_SLOT_W_RATIO * VIEWPORT_W);
  const { w: cardW, h: cardH } = slotDimensions(slotW);

  // Center card inside card background zone
  const cardX = (VIEWPORT_W - cardW) / 2;
  const cardY_inBg = (CARD_BG_H - cardH) / 2;

  return (
    <>
      <style>{STYLE_TAG}</style>
      <div
        style={{
          minHeight: "100vh",
          background: "#080c14",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "32px 24px 40px",
          gap: 24,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "#f0f4ff", fontSize: 20, fontWeight: 700, margin: 0 }}>
            Card View — Fit Demo
          </h1>
          <p style={{ color: "#6b7a99", fontSize: 13, margin: "4px 0 0" }}>
            Five rarity presets seated in the card slot · inline CSS/SVG only
          </p>
        </div>

        {/* Phone frame */}
        <PhoneFrame scale={0.85}>
          {/* Top bar chrome */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: TOP_CHROME,
              background: "linear-gradient(180deg, #1a2030 0%, #141c28 100%)",
              borderBottom: "1px solid #ffffff12",
              zIndex: 10,
              display: "flex",
              alignItems: "flex-end",
              paddingBottom: 8,
              paddingLeft: 16,
              paddingRight: 16,
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#a0b0d0", fontFamily: "system-ui" }}>
              Maplog
            </span>
            <span style={{ fontSize: 10, color: "#4a6080", fontFamily: "'SF Mono', monospace" }}>
              Card View
            </span>
          </div>

          {/* Card background zone */}
          <div
            style={{
              position: "absolute",
              top: TOP_CHROME,
              left: 0,
              right: 0,
              height: CARD_BG_H,
              overflow: "hidden",
              zIndex: 5,
            }}
          >
            {/* Blurred album-colour bleed */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `#0d1828`,
                transition: "background 0.4s ease",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: preset.bgBleed,
                transition: "background 0.5s ease",
              }}
            />

            {/* Card seated in slot */}
            <div
              style={{
                position: "absolute",
                left: cardX,
                top: cardY_inBg,
                width: cardW,
                height: cardH,
              }}
            >
              {preset.renderCard(cardW, cardH)}
            </div>
          </div>

          {/* Bottom chrome */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: BOTTOM_CHROME,
              background: "linear-gradient(0deg, #0d111c 0%, #141c28 100%)",
              borderTop: "1px solid #ffffff12",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* MiniPlayer mock */}
            <div
              style={{
                height: MINI_PLAYER,
                borderBottom: "1px solid #ffffff08",
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: preset.accentColor + "33",
                  border: `1px solid ${preset.accentColor}44`,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#c0d0f0", fontFamily: "system-ui", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {["Blinding Lights","Anti-Hero","As It Was","Levitating","Flowers"][activeIdx]}
                </div>
                <div style={{ fontSize: 10, color: "#4a6080", fontFamily: "system-ui" }}>
                  {["The Weeknd","Taylor Swift","Harry Styles","Dua Lipa","Miley Cyrus"][activeIdx]}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {["⏮","▶","⏭"].map(icon => (
                  <span key={icon} style={{ fontSize: 14, color: "#607090" }}>{icon}</span>
                ))}
              </div>
            </div>
            {/* MobileNav mock */}
            <div
              style={{
                height: MOBILE_NAV,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-around",
                padding: "0 8px",
              }}
            >
              {[
                { icon: "🗺", label: "Map" },
                { icon: "🎵", label: "Songs" },
                { icon: "💎", label: "Cards" },
                { icon: "👤", label: "Profile" },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ fontSize: 9, color: "#3a5070", fontFamily: "system-ui" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </PhoneFrame>

        {/* Tab strip for preset selection */}
        <div
          style={{
            display: "flex",
            gap: 6,
            background: "#0d1220",
            border: "1px solid #1e2a40",
            borderRadius: 12,
            padding: 6,
          }}
        >
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActiveIdx(i)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.15s ease",
                background: i === activeIdx
                  ? p.accentColor + "22"
                  : "transparent",
                color: i === activeIdx ? p.accentColor : "#4a6080",
                outline: i === activeIdx ? `1.5px solid ${p.accentColor}44` : "none",
              }}
            >
              {p.tabLabel}
            </button>
          ))}
        </div>

        {/* Slot info */}
        <div style={{ fontSize: 12, color: "#3a5070", fontFamily: "'SF Mono', monospace", textAlign: "center" }}>
          Card slot: {cardW}px × {Math.round(cardH)}px · 3:4.5 ratio · r=16px
        </div>
      </div>
    </>
  );
}
