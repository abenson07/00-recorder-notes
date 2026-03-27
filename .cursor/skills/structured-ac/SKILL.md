---
name: structured-ac
description: Formats acceptance criteria and human QA guides as structured step-by-step checklists with lettered sections, confirm lines, and exit criteria. Use when the user asks for "ac", acceptance criteria, a structured test guide, manual QA steps, or verification checklist for a feature or task (e.g. budget-###).
---

# Structured acceptance criteria ("ac")

When the user asks for **ac** (acceptance criteria), a **human guide**, **manual QA**, or a **verification checklist**, produce output in this structure. Match the tone: imperative steps, explicit **Confirm** lines, and clear **Done when** exit criteria.

## Output structure (required)

1. **Title line**  
   `Human guide: <short goal> (<task-id if given>)`

2. **One-line purpose**  
   What this checklist verifies and in what environment (e.g. running app with mock data or after Supabase sync).

3. **Before you start** (if setup is needed)  
   Bullets: run app, open URL, seed/login assumptions, **note any baseline numbers** to compare later (balances, counts, etc.).

4. **Lettered sections (A, B, C, …)**  
   Each section = one theme (one screen, one flow, one integration). Use short titles, e.g. `A. Bucket detail page`.

   Within each section:
   - **Navigation**: where to click / which URL pattern (e.g. `/buckets/<uuid>`).
   - **Assertions**: bullet list of what must be visible or true.
   - **Confirm** lines: explicit pass/fail checks the human performs (`Confirm you see…`, `Confirm you land on…`, `Confirm balances…`).
   - **Edge cases**: empty states, invalid input, error messages, “balances do not change incorrectly.”

5. **Optional** subsection when relevant  
   Label clearly (e.g. `E. Optional: Supabase`). Repeat critical flows after persistence; include refresh/reload.

6. **Done when**  
   Bullet list of high-level outcomes (not every micro-step). This is the merge/sign-off bar.

## Style rules

- Use **second person** (“Open…”, “Confirm…”) for the runner.
- Prefer **concrete UI labels** and **routes** when known; use placeholders (`<uuid>`, `<id>`) when generic.
- Group related checks; avoid one giant paragraph.
- Call out **math or invariants** explicitly (e.g. account total unchanged while bucket balances move).
- If the user only gave a feature name, infer reasonable sections; if the codebase has a task id (e.g. `budget-004`), include it in the title.

## Template (copy shape)

```markdown
Human guide: <goal> (<task-id>)

<One sentence: what this verifies and where (mock / Supabase / env).>

Before you start
- …
- Note: …

A. <Section title>
- …
- Confirm …

B. <Section title>
- …
- Confirm …

…

Done when
- …
- …
```

## Additional resources

For a full example of depth and phrasing for this repo, see [reference-example.md](reference-example.md).
