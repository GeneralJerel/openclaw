/**
 * CopilotKit rendered tool: Channel Health Cards.
 *
 * Registers a useCopilotAction that renders a grid of channel status
 * cards when the AI calls the "channelHealth" action.
 */

import React from "react";
import { useCopilotAction } from "@copilotkit/react-core";

type ChannelEntry = {
  channelId: string;
  channelName: string;
  accountId: string;
  enabled: boolean;
  connected: boolean;
  status: string;
  lastInboundAt: number | null;
  lastOutboundAt: number | null;
  isDefault: boolean;
};

function StatusDot({ connected, enabled }: { connected: boolean; enabled: boolean }) {
  if (!enabled) {
    return <span className="ck-status-dot ck-status-dot--disabled" title="Disabled" />;
  }
  return connected ? (
    <span className="ck-status-dot ck-status-dot--online" title="Connected" />
  ) : (
    <span className="ck-status-dot ck-status-dot--offline" title="Disconnected" />
  );
}

function formatRelativeTime(ms: number | null): string {
  if (!ms) {return "never";}
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) {return `${seconds}s ago`;}
  if (seconds < 3600) {return `${Math.floor(seconds / 60)}m ago`;}
  if (seconds < 86400) {return `${Math.floor(seconds / 3600)}h ago`;}
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ChannelCard({ channel }: { channel: ChannelEntry }) {
  return (
    <div className="ck-channel-card">
      <div className="ck-channel-card__header">
        <StatusDot connected={channel.connected} enabled={channel.enabled} />
        <span className="ck-channel-card__name">{channel.channelName}</span>
      </div>
      <div className="ck-channel-card__details">
        <div className="ck-channel-card__row">
          <span className="ck-channel-card__label">Status</span>
          <span className="ck-channel-card__value">{channel.status}</span>
        </div>
        <div className="ck-channel-card__row">
          <span className="ck-channel-card__label">Last in</span>
          <span className="ck-channel-card__value">{formatRelativeTime(channel.lastInboundAt)}</span>
        </div>
        <div className="ck-channel-card__row">
          <span className="ck-channel-card__label">Last out</span>
          <span className="ck-channel-card__value">
            {formatRelativeTime(channel.lastOutboundAt)}
          </span>
        </div>
        {channel.isDefault && (
          <span className="ck-channel-card__badge">default</span>
        )}
      </div>
    </div>
  );
}

function ChannelHealthLoading() {
  return (
    <div className="ck-channel-grid">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="ck-channel-card ck-channel-card--skeleton">
          <div className="ck-skeleton-line ck-skeleton-line--short" />
          <div className="ck-skeleton-line" />
          <div className="ck-skeleton-line" />
        </div>
      ))}
    </div>
  );
}

export function ChannelHealthTool() {
  useCopilotAction({
    name: "channelHealth",
    description:
      "Show the health and connection status of all messaging channels.",
    parameters: [
      {
        name: "probe",
        type: "boolean",
        description: "Whether to actively probe channels.",
        required: false,
      },
    ],
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <ChannelHealthLoading />;
      }

      const data = typeof result === "string" ? JSON.parse(result) : result;
      const channels: ChannelEntry[] = data?.channels ?? [];

      if (channels.length === 0) {
        return (
          <div className="ck-empty-state">No channels configured.</div>
        );
      }

      return (
        <div className="ck-channel-grid">
          {channels.map((ch) => (
            <ChannelCard key={`${ch.channelId}-${ch.accountId}`} channel={ch} />
          ))}
        </div>
      );
    },
  });

  return null;
}
