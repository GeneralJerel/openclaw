/**
 * CopilotKit server-side action definitions.
 *
 * Each action maps to an existing gateway RPC method so the CopilotKit runtime
 * can read the same data the control UI already uses.
 */

import { listChannelPlugins } from "../channels/plugins/index.js";
import { buildChannelAccountSnapshot } from "../channels/plugins/status.js";
import { resolveChannelDefaultAccountId } from "../channels/plugins/helpers.js";
import { loadConfig } from "../config/config.js";
import { applyPluginAutoEnable } from "../config/plugin-auto-enable.js";
import { getChannelActivity } from "../infra/channel-activity.js";
import { DEFAULT_ACCOUNT_ID } from "../routing/session-key.js";
import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import { resolveAgentWorkspaceDir } from "../agents/agent-scope.js";
import { buildWorkspaceSkillStatus } from "../agents/skills-status.js";
import { canExecRequestNode } from "../agents/exec-defaults.js";
import { getRemoteSkillEligibility } from "../infra/skills-remote.js";
import { searchSkillsFromClawHub } from "../agents/skills-clawhub.js";
import {
  loadCombinedSessionStoreForGateway,
  listSessionsFromStore,
} from "./session-utils.js";
import { loadCostUsageSummary } from "../infra/session-cost-usage.js";

export type CopilotKitAction = {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

/** Resolves the date range for usage queries. */
function resolveUsageDateRange(startDate?: string, endDate?: string): { startMs: number; endMs: number } {
  const now = Date.now();
  const endMs = endDate ? new Date(endDate).getTime() : now;
  const startMs = startDate ? new Date(startDate).getTime() : endMs - 7 * 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

export function buildCopilotKitActions(): CopilotKitAction[] {
  return [
    {
      name: "channelHealth",
      description:
        "Show the health and connection status of all messaging channels (Discord, Telegram, Slack, etc.). " +
        "Returns each channel's name, type, connection status, last activity timestamps, and account details.",
      parameters: [
        {
          name: "probe",
          type: "boolean",
          description: "Whether to actively probe channels for live status (slower but more accurate). Defaults to false.",
          required: false,
        },
      ],
      handler: async (args) => {
        const probe = args.probe === true;
        const cfg = applyPluginAutoEnable({ config: loadConfig(), env: process.env }).config;
        const plugins = listChannelPlugins();
        const channels: Array<Record<string, unknown>> = [];

        for (const plugin of plugins) {
          const accountIds = plugin.config.listAccountIds(cfg);
          const defaultAccountId = resolveChannelDefaultAccountId({ plugin, cfg, accountIds });

          for (const accountId of accountIds) {
            const account = plugin.config.resolveAccount(cfg, accountId);
            const isEnabled = plugin.config.isEnabled
              ? plugin.config.isEnabled(account, cfg)
              : !account || typeof account !== "object" || (account as { enabled?: boolean }).enabled !== false;

            let probeResult: unknown;
            if (probe && isEnabled && plugin.status?.probeAccount) {
              let configured = true;
              if (plugin.config.isConfigured) {
                configured = await plugin.config.isConfigured(account, cfg);
              }
              if (configured) {
                probeResult = await plugin.status.probeAccount({ account, timeoutMs: 10_000, cfg });
              }
            }

            const snapshot = await buildChannelAccountSnapshot({
              plugin,
              cfg,
              accountId,
              runtime: undefined,
              probe: probeResult,
            });

            const activity = getChannelActivity({ channel: plugin.id as never, accountId });
            if (snapshot.lastInboundAt == null) {
              snapshot.lastInboundAt = activity.inboundAt;
            }
            if (snapshot.lastOutboundAt == null) {
              snapshot.lastOutboundAt = activity.outboundAt;
            }

            channels.push({
              channelId: plugin.id,
              channelName: plugin.meta?.label ?? plugin.id,
              accountId,
              enabled: isEnabled,
              connected: snapshot.connected ?? false,
              status: snapshot.status ?? "unknown",
              lastInboundAt: snapshot.lastInboundAt ?? null,
              lastOutboundAt: snapshot.lastOutboundAt ?? null,
              isDefault: accountId === defaultAccountId,
            });
          }
        }

        return { channels };
      },
    },
    {
      name: "skillsCatalog",
      description:
        "Browse available skills (tools/capabilities) for the AI agent. " +
        "When a query is provided, searches the ClawHub marketplace for installable skills. " +
        "Without a query, returns the status of currently configured skills.",
      parameters: [
        {
          name: "query",
          type: "string",
          description: "Optional search query to find skills on ClawHub marketplace.",
          required: false,
        },
      ],
      handler: async (args) => {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        const cfg = loadConfig();
        const agentId = resolveDefaultAgentId(cfg);
        const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);

        // Local skill status
        const report = buildWorkspaceSkillStatus(workspaceDir, {
          config: cfg,
          eligibility: {
            remote: getRemoteSkillEligibility({
              advertiseExecNode: canExecRequestNode(cfg),
            }),
          },
        });

        const localSkills = report.skills.map((skill) => ({
          name: skill.name,
          description: skill.description ?? "",
          status: skill.status,
          eligibility: skill.eligibilityReasons ?? [],
        }));

        // ClawHub search if query provided
        let marketplaceResults: Array<Record<string, unknown>> = [];
        if (query) {
          const results = await searchSkillsFromClawHub({ query, limit: 10 });
          marketplaceResults = (results ?? []).map((item: Record<string, unknown>) => ({
            slug: item.slug ?? item.name ?? "",
            name: item.name ?? item.slug ?? "",
            summary: item.summary ?? item.description ?? "",
            version: item.version ?? "",
            author: item.author ?? "",
          }));
        }

        return { localSkills, marketplaceResults };
      },
    },
    {
      name: "usageStats",
      description:
        "Show token usage, costs, and message statistics over a date range. " +
        "Defaults to the last 7 days if no dates are specified.",
      parameters: [
        {
          name: "startDate",
          type: "string",
          description: "Start date in ISO format (e.g. '2026-04-01'). Defaults to 7 days ago.",
          required: false,
        },
        {
          name: "endDate",
          type: "string",
          description: "End date in ISO format (e.g. '2026-04-08'). Defaults to now.",
          required: false,
        },
      ],
      handler: async (args) => {
        const startDate = typeof args.startDate === "string" ? args.startDate : undefined;
        const endDate = typeof args.endDate === "string" ? args.endDate : undefined;
        const config = loadConfig();
        const { startMs, endMs } = resolveUsageDateRange(startDate, endDate);
        const summary = await loadCostUsageSummary({ startMs, endMs, config });
        return summary;
      },
    },
    {
      name: "sessionsList",
      description:
        "List recent chat sessions with their metadata (model used, token counts, timestamps). " +
        "Useful for inspecting which sessions are active and their resource usage.",
      parameters: [
        {
          name: "limit",
          type: "number",
          description: "Maximum number of sessions to return. Defaults to 20.",
          required: false,
        },
      ],
      handler: async (args) => {
        const limit = typeof args.limit === "number" ? args.limit : 20;
        const cfg = loadConfig();
        const { storePath, store } = loadCombinedSessionStoreForGateway(cfg);
        const result = listSessionsFromStore({
          cfg,
          storePath,
          store,
          opts: { limit },
        });
        return result;
      },
    },
  ];
}
