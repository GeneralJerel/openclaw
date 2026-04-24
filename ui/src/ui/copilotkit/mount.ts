/**
 * React island mounting utility for CopilotKit.
 *
 * Creates a React root inside an arbitrary DOM element, renders the
 * CopilotIsland component, and returns a cleanup function that
 * unmounts the root when the Lit host disconnects or toggles mode.
 */

export type CopilotIslandCallbacks = {
  /** Navigate to a session in normal chat mode. */
  onNavigateToSession: (sessionKey: string) => void;
  /** Install a skill from ClawHub marketplace. */
  onInstallSkill: (slug: string) => void;
};

export type CopilotIslandProps = {
  /** Full gateway base URL (e.g. "http://localhost:18789"). */
  gatewayUrl: string;
  /** Auth token for the gateway (bearer). */
  authToken?: string;
  /** Cross-framework callbacks from React → Lit. */
  callbacks: CopilotIslandCallbacks;
};

// Singleton: only one React island at a time.
let activeRoot: { root: ReturnType<typeof import("react-dom/client").createRoot>; container: HTMLElement } | null = null;

/** Unmount the current React island if one is active. */
export function unmountCopilotIsland() {
  if (activeRoot) {
    try {
      activeRoot.root.unmount();
    } catch {
      // Already unmounted or container removed from DOM.
    }
    activeRoot = null;
  }
}

/**
 * Mount the CopilotKit React island into the given container.
 * Unmounts any previously active island first.
 */
export async function mountCopilotIsland(
  container: HTMLElement,
  props: CopilotIslandProps,
): Promise<void> {
  unmountCopilotIsland();

  // Dynamic imports keep React out of the main Lit bundle unless CopilotKit mode is active.
  const [React, { createRoot }, { CopilotIsland }] = await Promise.all([
    import("react"),
    import("react-dom/client"),
    import("./CopilotIsland.js"),
  ]);

  const root = createRoot(container);
  root.render(React.createElement(CopilotIsland, props));
  activeRoot = { root, container };
}
