/**
 * CopilotKit React island root component.
 *
 * Wraps CopilotKitProvider + CopilotChat and registers all
 * useCopilotAction hooks for the 4 rendered tool components.
 */

import React from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

import type { CopilotIslandProps } from "./mount.js";
import { ChannelHealthTool } from "./tools/ChannelHealthCards.js";
import { SkillInstallerTool } from "./tools/SkillInstaller.js";
import { UsageSparklinesTool } from "./tools/UsageSparklines.js";
import { SessionInspectorTool } from "./tools/SessionInspector.js";

function CopilotToolRegistrations(props: {
  onNavigateToSession: (key: string) => void;
  onInstallSkill: (slug: string) => void;
}) {
  return (
    <>
      <ChannelHealthTool />
      <SkillInstallerTool onInstallSkill={props.onInstallSkill} />
      <UsageSparklinesTool />
      <SessionInspectorTool onNavigateToSession={props.onNavigateToSession} />
    </>
  );
}

export function CopilotIsland(props: CopilotIslandProps) {
  const runtimeUrl = `${props.gatewayUrl}/copilotkit`;
  const headers: Record<string, string> = {};
  if (props.authToken) {
    headers["Authorization"] = `Bearer ${props.authToken}`;
  }

  return (
    <CopilotKit runtimeUrl={runtimeUrl} headers={headers}>
      <CopilotToolRegistrations
        onNavigateToSession={props.callbacks.onNavigateToSession}
        onInstallSkill={props.callbacks.onInstallSkill}
      />
      <CopilotChat
        className="copilotkit-chat-island"
        instructions={
          "You are an AI assistant for the OpenClaw gateway dashboard. " +
          "You can show channel health status, browse and install skills, " +
          "display usage statistics, and inspect recent sessions. " +
          "Use the available tools to render rich interactive UI when the user asks about these topics."
        }
        labels={{
          title: "OpenClaw Copilot",
          initial: "Ask me about your channels, skills, usage, or sessions.",
          placeholder: "e.g. Show me channel health...",
        }}
      />
    </CopilotKit>
  );
}
