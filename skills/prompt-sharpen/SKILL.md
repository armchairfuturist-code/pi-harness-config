---
name: prompt-sharpen
disable-model-invocation: true
description: Turn a vague request into a sharp, editable task brief before Pi runs it.
---

# prompt-sharpen

Sharpen a vague request into a **brief** — a tight task spec the user edits,
then re-submits to run the task.

## Steps

1. **Read the request.** If it already names the files, states the behavior, and
   the edges are known, say "already sharp — run it" and stop.
   *Done:* you have declined to sharpen and emitted no brief.

2. **Write the brief** in this list form, one item per line, no prose:
   - **Scope:** files / functions to touch
   - **Behavior:** every behavior the request implies
   - **Edges:** invalid, empty, missing, and boundary inputs
   - **Done:** how we know it's finished — concrete and checkable
   - **Open:** anything genuinely ambiguous that needs the user's call
   *Done:* every behavior and edge you can infer from the request is listed —
   completeness over brevity on the Behavior and Edges lines.

3. **Hand the brief back.** The user edits and confirms; the task starts from
   their re-submission.
   *Done:* the brief is emitted and the conversation is back with the user.
