/**
 * pi-delegate — Minimal subagent delegation.
 *
 * Registers a single `delegate` tool that spawns a fresh pi agent session
 * with read/bash/grep/find/ls tools, runs a prompt, and returns the result.
 *
 * Cost: ~200 tokens/tool-schema vs 3,808 for pi-subagents.
 *
 * Uses createAgentSession from the Pi SDK — same pattern as
 * pi-goal-list-loop-audit's isolated auditor.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createAgentSession,
  SessionManager,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";

// Minimal resource loader — fresh session with no extensions/skills/prompts
function makeSubagentResourceLoader(systemPrompt: string): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: undefined as any }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getAppendSystemPrompt: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

export default function piDelegate(pi: ExtensionAPI) {
  pi.registerTool({
    name: "delegate",
    description:
      "Spawn a fresh subagent session to handle a task. The subagent has read/bash/grep/find/ls tools but no extensions or skills. Returns the subagent's final text output. Use for exploration, research, or isolated verification.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The task prompt for the subagent.",
        },
        cwd: {
          type: "string",
          description: "Working directory (default: current).",
        },
      },
      required: ["prompt"],
    } as any,

    handler: async (args: { prompt: string; cwd?: string }, ctx: any) => {
      const cwd = args.cwd || process.cwd();

      try {
        const model = ctx?.model;
        if (!model) {
          return { content: [{ type: "text", text: "Error: no model available for subagent" }] };
        }

        const resourceLoader = makeSubagentResourceLoader(
          "You are a focused subagent. Complete the task concisely and return only the result."
        );

        const { session } = await createAgentSession({
          cwd,
          model,
          tools: ["read", "bash", "grep", "find", "ls"],
          sessionManager: SessionManager.inMemory(cwd),
          resourceLoader,
          systemPromptOverride:
            "You are a focused subagent. Complete the task concisely and return only the result.",
        });

        // Send the prompt and wait for completion
        const result = await session.run(args.prompt);

        // Collect the final assistant text
        let output = "";
        for await (const event of result) {
          if (event.type === "message_update" && event.message?.role === "assistant") {
            const text = event.message.content
              ?.filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("");
            if (text) output = text;
          }
        }

        await session.close();

        return {
          content: [
            {
              type: "text",
              text: output || "(subagent produced no output)",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Subagent error: ${err?.message || String(err)}`,
            },
          ],
        };
      }
    },
  });
}
