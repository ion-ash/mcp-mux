/**
 * Stub MCP Server Control Helper
 *
 * Provides functions to trigger list_changed notifications and manage
 * dynamic tools on the stub MCP HTTP server via its control endpoints.
 */

const DEFAULT_STUB_PORT = 3457;

function controlUrl(path: string, port?: number): string {
  return `http://localhost:${port ?? DEFAULT_STUB_PORT}${path}`;
}

/** Trigger tools/list_changed notification on all connected sessions */
export async function triggerToolsChanged(port?: number): Promise<{ ok: boolean; sessions_notified: number }> {
  const res = await fetch(controlUrl('/control/notify-tools-changed', port), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json() as Promise<{ ok: boolean; sessions_notified: number }>;
}

/** Trigger prompts/list_changed notification on all connected sessions */
export async function triggerPromptsChanged(port?: number): Promise<{ ok: boolean; sessions_notified: number }> {
  const res = await fetch(controlUrl('/control/notify-prompts-changed', port), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json() as Promise<{ ok: boolean; sessions_notified: number }>;
}

/** Trigger resources/list_changed notification on all connected sessions */
export async function triggerResourcesChanged(port?: number): Promise<{ ok: boolean; sessions_notified: number }> {
  const res = await fetch(controlUrl('/control/notify-resources-changed', port), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json() as Promise<{ ok: boolean; sessions_notified: number }>;
}

/** Dynamically add a tool to the stub server and notify connected sessions */
export async function addDynamicTool(
  name: string,
  description?: string,
  port?: number,
): Promise<{ ok: boolean; tool: string; sessions_updated: number }> {
  const res = await fetch(controlUrl('/control/add-tool', port), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  return res.json() as Promise<{ ok: boolean; tool: string; sessions_updated: number }>;
}

/** Dynamically remove a tool from the stub server and notify connected sessions */
export async function removeDynamicTool(
  name: string,
  port?: number,
): Promise<{ ok: boolean; tool: string; sessions_notified: number }> {
  const res = await fetch(controlUrl('/control/remove-tool', port), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json() as Promise<{ ok: boolean; tool: string; sessions_notified: number }>;
}
