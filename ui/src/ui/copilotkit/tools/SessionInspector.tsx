/**
 * CopilotKit rendered tool: Session Inspector.
 *
 * Registers a useCopilotAction that renders an interactive table of
 * recent sessions with metadata and clickable rows.
 */

import React from "react";
import { useCopilotAction } from "@copilotkit/react-core";

type SessionRow = {
  key?: string;
  label?: string;
  model?: string;
  updatedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  messages?: number;
  [k: string]: unknown;
};

function formatTime(ms: number | undefined): string {
  if (!ms) {return "--";}
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTokens(n: number | undefined): string {
  if (!n) {return "--";}
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}K`;}
  return String(n);
}

function SessionsLoading() {
  return (
    <div className="ck-sessions-table">
      <div className="ck-sessions-table__header">
        <span>Session</span>
        <span>Model</span>
        <span>Tokens</span>
        <span>Last Active</span>
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="ck-sessions-table__row ck-sessions-table__row--skeleton">
          <div className="ck-skeleton-line ck-skeleton-line--short" />
          <div className="ck-skeleton-line ck-skeleton-line--short" />
          <div className="ck-skeleton-line ck-skeleton-line--short" />
          <div className="ck-skeleton-line ck-skeleton-line--short" />
        </div>
      ))}
    </div>
  );
}

function SessionsTable({
  sessions,
  onNavigate,
}: {
  sessions: SessionRow[];
  onNavigate: (key: string) => void;
}) {
  return (
    <div className="ck-sessions-table">
      <div className="ck-sessions-table__header">
        <span>Session</span>
        <span>Model</span>
        <span>Tokens</span>
        <span>Last Active</span>
      </div>
      {sessions.map((session, i) => {
        const key = session.key ?? `session-${i}`;
        const label =
          session.label ||
          (key.length > 24 ? `${key.slice(0, 12)}...${key.slice(-8)}` : key);
        const totalTokens = (session.inputTokens ?? 0) + (session.outputTokens ?? 0);

        return (
          <div
            key={key}
            className="ck-sessions-table__row"
            onClick={() => onNavigate(key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {onNavigate(key);}
            }}
            title={`Open session: ${key}`}
          >
            <span className="ck-sessions-table__cell ck-sessions-table__cell--name">
              {label}
            </span>
            <span className="ck-sessions-table__cell">
              {session.model ?? "--"}
            </span>
            <span className="ck-sessions-table__cell">
              {formatTokens(totalTokens || undefined)}
            </span>
            <span className="ck-sessions-table__cell">
              {formatTime(session.updatedAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SessionInspectorTool({
  onNavigateToSession,
}: {
  onNavigateToSession: (key: string) => void;
}) {
  useCopilotAction({
    name: "sessionsList",
    description: "List recent chat sessions with metadata.",
    parameters: [
      {
        name: "limit",
        type: "number",
        description: "Max number of sessions. Defaults to 20.",
        required: false,
      },
    ],
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <SessionsLoading />;
      }

      const data = typeof result === "string" ? JSON.parse(result) : result;
      const sessions: SessionRow[] = data?.sessions ?? data?.entries ?? [];

      if (sessions.length === 0) {
        return <div className="ck-empty-state">No sessions found.</div>;
      }

      return (
        <SessionsTable
          sessions={sessions}
          onNavigate={onNavigateToSession}
        />
      );
    },
  });

  return null;
}
