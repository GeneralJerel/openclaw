/**
 * CopilotKit rendered tool: Usage Sparklines.
 *
 * Registers a useCopilotAction that renders inline SVG sparkline charts
 * for token usage, costs, and message volume.
 */

import React from "react";
import { useCopilotAction } from "@copilotkit/react-core";

type UsageSummary = {
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCost?: number;
  totalMessages?: number;
  sessions?: Array<{
    key?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    messages?: number;
  }>;
  [key: string]: unknown;
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}K`;}
  return String(Math.round(n));
}

function formatCost(n: number): string {
  if (n < 0.01) {return `$${n.toFixed(4)}`;}
  return `$${n.toFixed(2)}`;
}

/** Inline SVG sparkline for a data series. */
function Sparkline({
  values,
  width = 200,
  height = 40,
  color = "var(--accent, #6366f1)",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) {
    return <span className="ck-sparkline-empty">--</span>;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  // Area fill
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      className="ck-sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={areaPoints}
        fill={color}
        fillOpacity={0.15}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  sparkValues,
  color,
}: {
  label: string;
  value: string;
  sparkValues?: number[];
  color?: string;
}) {
  return (
    <div className="ck-stat-card">
      <div className="ck-stat-card__label">{label}</div>
      <div className="ck-stat-card__value">{value}</div>
      {sparkValues && sparkValues.length > 1 && (
        <Sparkline values={sparkValues} color={color} />
      )}
    </div>
  );
}

function UsageLoading() {
  return (
    <div className="ck-usage-grid">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="ck-stat-card ck-stat-card--skeleton">
          <div className="ck-skeleton-line ck-skeleton-line--short" />
          <div className="ck-skeleton-line" />
        </div>
      ))}
    </div>
  );
}

export function UsageSparklinesTool() {
  useCopilotAction({
    name: "usageStats",
    description: "Show token usage, costs, and message statistics.",
    parameters: [
      {
        name: "startDate",
        type: "string",
        description: "Start date (ISO format). Defaults to 7 days ago.",
        required: false,
      },
      {
        name: "endDate",
        type: "string",
        description: "End date (ISO format). Defaults to now.",
        required: false,
      },
    ],
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <UsageLoading />;
      }

      const data: UsageSummary =
        typeof result === "string" ? JSON.parse(result) : (result ?? {});

      const totalIn = data.totalInputTokens ?? 0;
      const totalOut = data.totalOutputTokens ?? 0;
      const totalCost = data.totalCost ?? 0;
      const totalMessages = data.totalMessages ?? 0;
      const sessions = data.sessions ?? [];

      // Build per-session sparkline data
      const costValues = sessions.map((s) => s.cost ?? 0);
      const inputValues = sessions.map((s) => s.inputTokens ?? 0);
      const outputValues = sessions.map((s) => s.outputTokens ?? 0);
      const messageValues = sessions.map((s) => s.messages ?? 0);

      return (
        <div className="ck-usage-grid">
          <StatCard
            label="Input Tokens"
            value={formatNumber(totalIn)}
            sparkValues={inputValues}
            color="var(--accent, #6366f1)"
          />
          <StatCard
            label="Output Tokens"
            value={formatNumber(totalOut)}
            sparkValues={outputValues}
            color="var(--info, #3b82f6)"
          />
          <StatCard
            label="Total Cost"
            value={formatCost(totalCost)}
            sparkValues={costValues}
            color="var(--warn, #f59e0b)"
          />
          <StatCard
            label="Messages"
            value={formatNumber(totalMessages)}
            sparkValues={messageValues}
            color="var(--ok, #22c55e)"
          />
        </div>
      );
    },
  });

  return null;
}
