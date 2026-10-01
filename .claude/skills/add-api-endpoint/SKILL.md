---
name: add-api-endpoint
description: Use when adding or changing an HTTP endpoint in this Express Course API — a new route or verb on an existing resource (e.g. DELETE /users/:id, PATCH /users/:id) or a whole new resource (e.g. /products, /orders). Covers the store helper, route validation and error responses, mounting in server.js, supertest tests, and docs/api.md. Also fires on Portuguese requests such as "crie a rota", "adicione um endpoint", "novo recurso na API". Do NOT use for questions about existing code, lint/CI fixes, MCP or Claude Code configuration, or tests that don't come with an endpoint change.
---

# Adding an endpoint to the Course API

Every endpoint touches the same five places, in this order. Do all of them; an endpoint without a store helper, a test, or a docs entry is incomplete.

## 1. Data access — `db/store.js`

Routes never hold state. Add or reuse a helper here and export it.

- One module-level array per resource (`let products = [];`) and its own id counter (`let nextProductId = 1;`).
- Add seed records for a new resource inside `seed()`, so `reset()` restores them for the tests.
- Lookups return `undefined` when the record is missing; never throw. Mutating helpers (`updateX`, `deleteX`) also return `undefined` for a missing id, so the route can turn that into a 404.
- Add every new helper to `module.exports`.

```js
function deleteUser(id) {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return undefined;
  const [removed] = users.splice(index, 1);
  return removed;
}
```

## 2. Route — `routes/<resource>.js`

One file per resource, exporting an `express.Router()`. Match `routes/users.js`:

- A one-line comment above each handler: `// METHOD /path — what it does.`
- Convert ids with `Number(req.params.id)`.
- Validate input first and return `400` on bad input; return `404` when the store says the record is missing.
- Every error is JSON in the shape `{ error: 'message' }`. Messages are short sentences: `'User not found'`, `'name and email are required'`.
- Status codes: `200` via `res.json(...)`, `201` for creation, `204` with `res.status(204).end()` for a delete with no body.
- Use `return res...` for every response after the first branch, so a handler never sends twice.

```js
// DELETE /users/:id — remove a user, or 404 if it doesn't exist.
router.delete('/:id', (req, res) => {
  const user = store.deleteUser(Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.status(204).end();
});
```

## 3. Mount — `server.js` (new resources only)

Require the router at the top with the others and mount it under its plural base path:

```js
const productsRouter = require('./routes/products');
app.use('/products', productsRouter);
```

## 4. Tests — `tests/<resource>.test.js`

Node's built-in runner plus `supertest`, one file per resource. Match `tests/users.test.js`:

- `const test = require('node:test');`, `const assert = require('node:assert');`, `request(app)` against `require('../server')`.
- `test.beforeEach(() => store.reset());` so each test starts from the seed data.
- Test names read as `'METHOD /path does X'`.
- Cover the happy path and each error branch the route has: `400` for bad input, `404` for a missing id (use id `999`).
- Assert the status with `assert.equal`, and assert the body fields that matter.

## 5. Docs — `docs/api.md`

Add a `### METHOD /path` entry under the resource's `##` section (create the section, with an example JSON object, for a new resource). Describe the body it takes and every status it returns: success, `400` and `404`.

## Finish

Run `npm test` and `npm run lint`, and report the result of both.
