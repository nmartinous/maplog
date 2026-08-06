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

// ── Color palette ─────────────────────────────────────────────────────────────
const CLR_TOP    = "#1e2a3a";
const CLR_BG     = "#0f1620";
const CLR_BOTTOM = "#1a2030";
const CLR_SLOT   = "rgba(239,68,68,0.15)";
const CLR_SLOT_BORDER = "#ef4444";

// ── Ruler tick helpers ────────────────────────────────────────────────────────

function HRuler({
  x, y, width, label, color = "#facc15",
}: { x: number; y: number; width: number; label: string; color?: string }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x + width} y2={y} stroke={color} strokeWidth={1} />
      <line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke={color} strokeWidth={1} />
      <line x1={x + width} y1={y - 4} x2={x + width} y2={y + 4} stroke={color} strokeWidth={1} />
      <text
        x={x + width / 2}
        y={y - 7}
        textAnchor="middle"
        fill={color}
        fontSize={9}
        fontFamily="'SF Mono', 'Fira Code', monospace"
      >
        {label}
      </text>
    </g>
  );
}

function VRuler({
  x, y, height, label, color = "#facc15", side = "right",
}: { x: number; y: number; height: number; label: string; color?: string; side?: "left" | "right" }) {
  const tickLen = 4;
  const textX = side === "right" ? x + 8 : x - 8;
  const anchor = side === "right" ? "start" : "end";
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + height} stroke={color} strokeWidth={1} />
      <line x1={x - tickLen} y1={y} x2={x + tickLen} y2={y} stroke={color} strokeWidth={1} />
      <line x1={x - tickLen} y1={y + height} x2={x + tickLen} y2={y + height} stroke={color} strokeWidth={1} />
      <text
        x={textX}
        y={y + height / 2}
        textAnchor={anchor}
        dominantBaseline="middle"
        fill={color}
        fontSize={9}
        fontFamily="'SF Mono', 'Fira Code', monospace"
      >
        {label}
      </text>
    </g>
  );
}

// ── Zone label ────────────────────────────────────────────────────────────────
function ZoneLabel({
  x, y, lines, color,
}: { x: number; y: number; lines: string[]; color: string }) {
  return (
    <g>
      {lines.map((l, i) => (
        <text
          key={i}
          x={x}
          y={y + i * 13}
          textAnchor="middle"
          fill={color}
          fontSize={10}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
        >
          {l}
        </text>
      ))}
    </g>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: CLR_TOP,       label: "Top bar chrome" },
    { color: "#1c3050",     label: "Card background" },
    { color: CLR_SLOT_BORDER, label: "Card slot (dashed)" },
    { color: CLR_BOTTOM,    label: "Bottom chrome" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        background: "rgba(10,12,20,0.92)",
        border: "1px solid #ffffff18",
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: color,
              border: color === CLR_SLOT_BORDER ? `2px dashed ${CLR_SLOT_BORDER}` : "1px solid #ffffff30",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 10, color: "#ffffffaa", fontFamily: "system-ui" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CardViewRegionsGuide() {
  const [slotWidthPct, setSlotWidthPct] = useState(DEFAULT_SLOT_W_RATIO * 100);
  const slotWidthPx = Math.round((slotWidthPct / 100) * VIEWPORT_W);
  const { w: slotW, h: slotH } = slotDimensions(slotWidthPx);

  // Slot position within the card background zone
  const slotX = (VIEWPORT_W - slotW) / 2;
  const slotY = TOP_CHROME + (CARD_BG_H - slotH) / 2;

  // SVG overlay dimensions match the screen (390 × 844)
  const SVG_W = VIEWPORT_W;
  const SVG_H = VIEWPORT_H;

  // Ruler anchors
  const LEFT_RULER_X  = 6;
  const RIGHT_RULER_X = SVG_W - 6;

  const pct = (px: number) => `${((px / VIEWPORT_H) * 100).toFixed(1)}%`;

  return (
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
          Card View — Region Guide
        </h1>
        <p style={{ color: "#6b7a99", fontSize: 13, margin: "4px 0 0" }}>
          Canonical 390 × 844 px · all measurements in px and % of viewport height
        </p>
      </div>

      {/* Slot width control */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#c0c8e0" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Card slot width:
        </label>
        <input
          type="range"
          min={50}
          max={95}
          value={slotWidthPct}
          onChange={(e) => setSlotWidthPct(Number(e.target.value))}
          style={{ width: 160, accentColor: "#ef4444" }}
        />
        <span style={{ fontSize: 13, fontFamily: "'SF Mono', monospace", minWidth: 80 }}>
          {slotWidthPx}px ({slotWidthPct}%)
        </span>
      </div>

      {/* Phone frame + annotation layer */}
      <div style={{ position: "relative" }}>
        <PhoneFrame scale={0.85}>
          {/* Zone strips */}
          {/* Top chrome */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: TOP_CHROME,
              background: CLR_TOP,
              borderBottom: "1px solid #ffffff18",
              zIndex: 10,
            }}
          />
          {/* Card background */}
          <div
            style={{
              position: "absolute",
              top: TOP_CHROME,
              left: 0,
              right: 0,
              height: CARD_BG_H,
              background: "#0d1828",
              border: "1px dashed #2a4060",
              boxSizing: "border-box",
              zIndex: 10,
            }}
          />
          {/* Card slot */}
          <div
            style={{
              position: "absolute",
              top: slotY,
              left: slotX,
              width: slotW,
              height: slotH,
              border: `2px dashed ${CLR_SLOT_BORDER}`,
              borderRadius: 16,
              background: CLR_SLOT,
              boxSizing: "border-box",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#ef4444cc",
                fontFamily: "'SF Mono', monospace",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              Card Slot
              <br />
              {slotW}×{Math.round(slotH)}px
              <br />
              r=16 · 3:4.5
            </span>
          </div>
          {/* Bottom chrome */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: BOTTOM_CHROME,
              background: CLR_BOTTOM,
              borderTop: "1px solid #ffffff18",
              zIndex: 10,
            }}
          />

          {/* SVG annotation overlay */}
          <svg
            style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}
            width={SVG_W}
            height={SVG_H}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          >
            {/* ── Zone labels ── */}
            <ZoneLabel
              x={SVG_W / 2} y={TOP_CHROME / 2 - 8}
              lines={["Top Bar Chrome", `${TOP_CHROME}px · ${pct(TOP_CHROME)}`]}
              color="#7eb8ff"
            />
            <ZoneLabel
              x={SVG_W / 2} y={TOP_CHROME + 14}
              lines={["Card Background (image / gif / default)", `${CARD_BG_H}px · ${pct(CARD_BG_H)}`]}
              color="#4a8ccc"
            />
            <ZoneLabel
              x={SVG_W / 2} y={SVG_H - BOTTOM_CHROME + 18}
              lines={[`Bottom Chrome — MiniPlayer ${MINI_PLAYER}px + Nav ${MOBILE_NAV}px`, `${BOTTOM_CHROME}px · ${pct(BOTTOM_CHROME)}`]}
              color="#7eb8ff"
            />

            {/* ── Left ruler: full viewport ── */}
            <VRuler
              x={LEFT_RULER_X} y={0} height={SVG_H}
              label={`${SVG_H}px`}
              color="#60a5fa"
              side="right"
            />

            {/* ── Right ruler: card background zone ── */}
            <VRuler
              x={RIGHT_RULER_X} y={TOP_CHROME} height={CARD_BG_H}
              label={`${CARD_BG_H}px`}
              color="#4ade80"
              side="left"
            />

            {/* ── Top chrome height ruler ── */}
            <VRuler
              x={LEFT_RULER_X + 14} y={0} height={TOP_CHROME}
              label={`${TOP_CHROME}px`}
              color="#93c5fd"
              side="right"
            />

            {/* ── Bottom chrome ruler ── */}
            <VRuler
              x={LEFT_RULER_X + 14} y={SVG_H - BOTTOM_CHROME} height={BOTTOM_CHROME}
              label={`${BOTTOM_CHROME}px`}
              color="#93c5fd"
              side="right"
            />

            {/* ── Slot width ruler ── */}
            <HRuler
              x={slotX} y={slotY - 10}
              width={slotW}
              label={`${slotW}px`}
              color="#ef4444"
            />

            {/* ── Slot height ruler ── */}
            <VRuler
              x={slotX + slotW + 4} y={slotY} height={slotH}
              label={`${Math.round(slotH)}px`}
              color="#ef4444"
              side="right"
            />

            {/* ── Corner radius callout ── */}
            <text
              x={slotX + slotW - 4}
              y={slotY + 20}
              textAnchor="end"
              fill="#ef4444cc"
              fontSize={8}
              fontFamily="'SF Mono', monospace"
            >
              r=16px
            </text>
          </svg>
        </PhoneFrame>

        {/* Legend overlay */}
        <Legend />
      </div>

      {/* Measurement table */}
      <div
        style={{
          background: "#0d1220",
          border: "1px solid #1e2a40",
          borderRadius: 12,
          padding: "16px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "12px 32px",
          maxWidth: 500,
          width: "100%",
        }}
      >
        {[
          { label: "Viewport",        px: `${VIEWPORT_W}×${VIEWPORT_H}`, pct: "—" },
          { label: "Top bar",         px: `${TOP_CHROME}px`,             pct: pct(TOP_CHROME) },
          { label: "Card background", px: `${CARD_BG_H}px`,             pct: pct(CARD_BG_H) },
          { label: "MiniPlayer",      px: `${MINI_PLAYER}px`,           pct: pct(MINI_PLAYER) },
          { label: "MobileNav",       px: `${MOBILE_NAV}px`,            pct: pct(MOBILE_NAV) },
          { label: "Bottom chrome",   px: `${BOTTOM_CHROME}px`,         pct: pct(BOTTOM_CHROME) },
          { label: "Slot width",      px: `${slotW}px`,                 pct: `${slotWidthPct}% vw` },
          { label: "Slot height",     px: `${Math.round(slotH)}px`,     pct: pct(slotH) },
          { label: "Slot aspect",     px: "3 : 4.5",                    pct: "—" },
        ].map(({ label, px, pct: p }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: "#5a7090", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 13, color: "#c0d0f0", fontFamily: "'SF Mono', monospace", marginTop: 2 }}>{px}</div>
            <div style={{ fontSize: 11, color: "#4a6080" }}>{p}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
