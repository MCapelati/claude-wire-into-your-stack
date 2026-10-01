---
description: Review changes against this API's conventions checklist (read-only)
argument-hint: "[git range, e.g. main..HEAD or HEAD~2 — empty = uncommitted changes]"
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(npm test), Bash(npm run lint), Read, Grep, Glob
---

Review code changes in this repo against the project's conventions checklist. This is a review only: do not edit any file.

## 1. What to review

Range given: `$ARGUMENTS`

- If the range above is empty, review the uncommitted changes: `git diff HEAD` plus untracked files from `git status --short`.
- Otherwise, review `git diff $ARGUMENTS` and list its commits with `git log --oneline $ARGUMENTS`. A single ref such as `HEAD~2` means "from that ref to the working tree".

Read each changed file in full, not only the diff hunks, so you can check how new code fits the code around it. If nothing changed, say so and stop.

## 2. Checklist

Check every item that the changes touch. Mark an item N/A when the changes don't touch it.

1. **One router per resource.** Each resource has its own `routes/<resource>.js` exporting an `express.Router()`, and every new router is mounted in `server.js` under its plural base path.
2. **State only in the store.** Routes read and write through `db/store.js` helpers; no arrays, counters or caches in route files. New helpers are exported; a new resource's seed data lives in `seed()` so `reset()` restores it.
3. **Missing records.** Store helpers return `undefined` for a missing id instead of throwing, and the route turns that into a `404`.
4. **Validation.** Input is validated in the route before calling the store, returning `400` on bad or missing fields. Ids are converted with `Number(req.params.id)`.
5. **Error shape.** Every error response is JSON `{ "error": "message" }`, with a short sentence as the message. No plain-text errors, no other keys.
6. **Status codes.** `201` for create, `204` with no body for delete, `200` otherwise. Every response after the first branch uses `return res...`.
7. **Handler comments.** Each handler has a one-line comment above it: `// METHOD /path — what it does.`
8. **Tests.** Every new or changed endpoint has tests in `tests/<resource>.test.js` using `node:test` + `supertest`, with `test.beforeEach(() => store.reset())`, covering the success path and each `400`/`404` branch.
9. **Docs.** Every new or changed endpoint has a matching `### METHOD /path` entry in `docs/api.md` listing its body and every status it returns.
10. **Checks pass.** Run `npm test` and `npm run lint`.

## 3. Report

Write the report in the language the user writes in. Use this format:

**Revisado:** the range (or "alterações não commitadas"), the commits, and the files.

| # | Item | Resultado | Onde |
|---|------|-----------|------|

Use ✅ (ok), ❌ (violation) or N/A in "Resultado". For each ❌, put `file:line` in "Onde".

Then, for each ❌, one short paragraph: what is wrong and what the fix would be, with a code snippet when it helps.

End with the `npm test` and `npm run lint` results and a one-line verdict: **pronto para commit** or **precisa de ajustes (N itens)**.
