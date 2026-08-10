/**
 * gather-judge-split — parallel gather then judge (no tools on workers).
 * Workers already sandboxed via tools: [] (full schema strip = max tool-attention win).
 */
export const meta = {
  name: "gather-judge-split",
  description: "Fan-out gather workers (no tools), then a judge synthesizes",
};

const topic = String(args?.topic ?? args?.prompt ?? "summarize the task risks").slice(0, 2000);
const gatherN = Math.min(4, Math.max(1, Number(args?.gatherers ?? 2)));

const gatherPrompt = (i) =>
  [
    `You are gatherer #${i + 1}. No tools. Use only the prompt and your knowledge.`,
    `Topic: ${topic}`,
    `Return STRICT JSON only, max ~1500 chars total:`,
    `{"findings":["..."],"risks":["..."],"open_questions":["..."]}`,
    `Each array ≤5 items; each string ≤200 chars. No markdown fences.`,
  ].join("\n");

const gathers = await parallel(
  Array.from({ length: gatherN }, (_, i) => () =>
    agent({
      prompt: gatherPrompt(i),
      tools: [], // no tools — pure text; strips full lean-ctx schema from worker prefill
    }),
  ),
  { concurrency: gatherN },
);

const judge = await agent({
  prompt: [
    "You are the judge. No tools. Synthesize gatherer JSON into a final brief.",
    "Hard cap: ≤1200 characters. Structure:",
    "## Summary",
    "## Risks",
    "## Next",
    "",
    "Gatherer outputs:",
    ...gathers.map((g, i) => `--- gatherer ${i + 1} ---\n${String(g).slice(0, 2000)}`),
  ].join("\n"),
  tools: [],
});

return {
  topic,
  gatherers: gatherN,
  gathers,
  judge: String(judge).slice(0, 2000),
};
