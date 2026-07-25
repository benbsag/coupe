"use client";

import { useEffect, useState } from "react";
import { ladderThresholds } from "@/lib/notification-ladder";

interface PressureGaugeProps {
  lockedAt: Date;
  targetDate: Date;
  now?: Date;
  size?: "sm" | "lg";
}

/**
 * The signature element (§10): a bar from lock date to resolution date,
 * filling as time passes, with notification thresholds marked as ticks —
 * passed ticks drawn in --capsule. Works at 4px in a list row and 40px on
 * the detail page. Fills once on mount; nothing else animates.
 */
export function PressureGauge({
  lockedAt,
  targetDate,
  now = new Date(),
  size = "sm",
}: PressureGaugeProps) {
  const totalMs = targetDate.getTime() - lockedAt.getTime();
  const elapsedMs = now.getTime() - lockedAt.getTime();
  const targetPercent =
    totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 100;

  const [percent, setPercent] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPercent(targetPercent));
    return () => cancelAnimationFrame(raf);
  }, [targetPercent]);

  const durationDays = totalMs / 86_400_000;
  const thresholds = ladderThresholds(durationDays);

  const isLarge = size === "lg";
  const height = isLarge ? "h-10" : "h-1";

  return (
    <div
      className={`relative w-full ${height} bg-rack rounded-sm overflow-hidden`}
      role="progressbar"
      aria-valuenow={Math.round(targetPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-y-0 left-0 bg-verre transition-[width] duration-700 ease-out"
        style={{ width: `${percent}%` }}
      />
      {thresholds.map((days) => {
        const tickDate = new Date(targetDate.getTime() - days * 86_400_000);
        const tickPercent =
          totalMs > 0
            ? Math.min(100, Math.max(0, ((tickDate.getTime() - lockedAt.getTime()) / totalMs) * 100))
            : 100;
        const passed = now.getTime() >= tickDate.getTime();
        return (
          <div
            key={days}
            className={`absolute top-0 bottom-0 w-px ${passed ? "bg-capsule" : "bg-lees/50"}`}
            style={{ left: `${tickPercent}%` }}
          />
        );
      })}
    </div>
  );
}
