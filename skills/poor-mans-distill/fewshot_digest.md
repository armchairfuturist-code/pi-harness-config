# Poor-Man's Distilled Few-Shot Digest

Source: 37 pi sessions, 100 intent→action pairs.
Models seen: {'zai-org/glm-5.2': 23, 'minimaxai/minimax-m3': 13, 'deepseek-v4-pro': 11, 'tencent/hy3:free': 8, 'big-pickle': 6, 'openrouter/free': 4, 'google/gemma-4-31b-it': 4, 'moonshotai/kimi-k2.6': 3, 'deepseek-v4-flash': 3, 'deepseek-v4-pro-lightning': 1, 'deepseek-v4-flash-free': 1, 'laguna-s-2.1-free': 1, 'poolside/laguna-s-2.1:free': 1}

## Top-quality traces (outcome score, use as few-shot context)

### [1.0] (error-fix) fix any errors present like [lean-ctx MCP bridge] Transport error: spawn lean-ctx ENOENT [lean-ctx MCP bridge] Max reconnect attempts (3) reached. MCP tools unavailable.──────────────────── [lean-ctx MCP bridge] Max reconnect attempts (3) reached. MCP tools unavailable.
_model: tencent/hy3:free · session: 2026-07-15T11-27-32-556Z_019f6588-32cc-7_

- `bash`: {}
- `bash`: {}

### [1.0] (error-fix) lets also fix this pi error: Error: pruner: summarization failed: No API key for provider: deepseek I have provided this API key several times - here it is again: REDACTED_DEEPSEEK_KEY
_model: zai-org/glm-5.2 · session: 2026-07-19T11-06-37-094Z_019f7a0e-7aa6-7_

- `bash`: {}

### [1.0] (error-fix) getting this error - please fix: r: 503: {"code":null,"message":"No available targets for model 'minimaxai/minimax-m3'","param":null,"type":"server_error"}
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `ctx_grep`: {}
- `ctx_grep`: {}

### [1.0] (refactor) the crof.ai provider no longer exists! remove it from the configuration thre should be no remnants of this provider!
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `bash`: {}

### [1.0] (other) also remember that pi and opencode are 2 different agent harnesses - pi is this current session
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `bash`: {}

### [1.0] (error-fix) Error: pruner: summarization failed: Request timed is an error I keep getting. The pruner model likely needs to change to deepseek api v4 flash, not the current openrouter model
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `bash`: {}

### [1.0] (error-fix) <skill name="ask-matt" location="/home/alex/.pi/skills/ask-matt/SKILL.md"> References are relative to /home/alex/.pi/skills/ask-matt. # Ask Matt You don't remember every skill, so ask. A **flow** is a path through the skills. Most paths run along one **main flow**, and two **on-ramps** merge onto it…
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `read`: {}

### [1.0] (error-fix) apply all fixes - then lets ensure we have fixed everything with the pruner
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `ctx_batch_execute`: {}

### [1.0] (error-fix) great- but this skill didnt fix all errors yet - we are still getting models errors - Error: 503: {"code":null,"message":"No available targets for model 'minimaxai/minimax-m3'","param":null,"type":"server_error"}
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `ctx_batch_execute`: {}

### [1.0] (error-fix) Lets ensure we are pulling the relevant data from the lilac api to ensure all models are actually available and their variants are accessible - for exxample still getting a 503 with minimax m3
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `write`: {}

### [1.0] (build) even after a restart this isi the specific warning I get wiht minimax m3: Warning: 💡 pi-cache-optimizer: lilac/minimaxai/minimax-m3 is a third-party GPT/OpenAI-compatible proxy but merged compat lacks sendSessionAffinityHeaders. Edit ~/.pi/agent/models.json -> providers["lilac"] -> compat (at the sa…
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `bash`: {}

### [1.0] (error-fix) can you verify its fixed now - just restarted the session
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `bash`: {}

### [1.0] (error-fix) restarted pi - but now your last 'fix' created an issue with the model it was on (glm 5.2 using lilac) - so now i am using a working model - please fix things corrrectly! Error: 400 Bad Request Warning: pruner: skipped pruning turn 146 (1 tool call) — summary was 556 chars vs 361 raw chars; frontier…
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `bash`: {}

### [1.0] (other) help me find the session where I am creating a plan for information on gas turbines buyers and sellers - I seemed to have lost this .pi session
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `bash`: {}

### [1.0] (other) continue the plan from here and lets keep grilling deeply - I don't want to lose context so if there is a better way to restart this session - please tell me how to do it
_model: deepseek-v4-pro · session: 2026-07-19T11-35-58-553Z_019f7a29-5b59-7_

- `write`: {}

### [1.0] (error-fix) deterimine how to fix all skill confllicts on my pi configuratio going forward via symlinks or keeping a single unified skill directory to be used for all agents on this system
_model: zai-org/glm-5.2 · session: 2026-07-27T14-00-23-396Z_019fa3e0-7264-7_

- `ctx_batch_execute`: {}

### [1.0] (install) hermes is the most complex installation - so its likely easier for other agents on this machine to link to the hermes location. Still - lets research this first via hermes documentation: https://hermes-agent.nousresearch.com/docs/ - the main this is that we centralize
_model: zai-org/glm-5.2 · session: 2026-07-27T14-00-23-396Z_019fa3e0-7264-7_

- `ctx_fetch_and_index`: {}

### [1.0] (install) we are still seeing skill conflicts upon restart of pi: [Skill conflicts] "computer-use" collision: ✓ auto (user) ~/.agents/skills/autonomous-ai-agents/computer-use/SKILL.md ✗ ~/.agents/skills/computer-use/SKILL.md (skipped) "research" collision: ✓ auto (project) ~/.pi/skills/mattpocock/research/SKI…
_model: zai-org/glm-5.2 · session: 2026-07-27T14-00-23-396Z_019fa3e0-7264-7_

- `ctx_shell`: {}

### [0.9] (install) I want you to completely uninstall .mimocode
_model: tencent/hy3:free · session: 2026-07-14T06-46-08-589Z_019f5f60-35cd-7_

- `bash`: {}

### [0.9] (inspect) replicate my pi configuration based on this configuration- assume some of the skills and functions are alread enabled, so avoid duplication: /home/alex/Desktop/pi-configuration.md
_model: tencent/hy3:free · session: 2026-07-15T11-10-21-497Z_019f6578-7739-7_

- `read`: {}

### [0.9] (other) c - leave providers alone for now
_model: tencent/hy3:free · session: 2026-07-15T11-10-21-497Z_019f6578-7739-7_

- `bash`: {}

### [0.9] (other) try again
_model: deepseek-v4-pro · session: 2026-07-26T11-32-31-742Z_019f9e32-b77e-7_

- `ctx_shell`: {}

### [0.9] (other) continue
_model: deepseek-v4-pro · session: 2026-07-26T11-32-31-742Z_019f9e32-b77e-7_

- `ctx_batch_execute`: {}

### [0.9] (test) I made significant changes to my pi configuration again - do the same process by checking the repo again and making the changes to this pi config - then smoke test the providers, reasoning etc to ensure everything works
_model: deepseek-v4-pro · session: 2026-07-26T11-32-31-742Z_019f9e32-b77e-7_

- `ctx_batch_execute`: {}

### [0.9] (error-fix) I made significant changes to my pi configuration again - do the same process by checking the repo again and making the changes to this pi config - then smoke test the providers, reasoning etc to ensure everything works - as there are several config errors in the model json creating 400/401 errors
_model: deepseek-v4-pro · session: 2026-07-26T11-32-31-742Z_019f9e32-b77e-7_

- `ctx_batch_execute`: {}

