# NOTES

Respostas curtas do exercício. Todos os detalhes (configurações completas, testes, problemas
encontrados e como foram resolvidos) estão em [`NOTES (long version).md`](<NOTES (long version).md>).

## 1. Servidor MCP

Conectei o servidor **filesystem** (`@modelcontextprotocol/server-filesystem`) no escopo do
projeto, pelo `.mcp.json` commitado. Ele é útil aqui porque dá ao Claude acesso estruturado aos
arquivos do projeto e da documentação (`docs/`), com ferramentas separadas para ler, gravar e
mover, o que permite liberar cada operação individualmente. A regra de permissão, no
`.claude/settings.json`, libera sem confirmação a leitura, a navegação e a gravação
(`read_*`, `list_*`, `search_files`, `write_file`, `edit_file`, `create_directory`) e **nega**
`move_file`, a única ferramenta que tira um arquivo do lugar, já que o servidor não tem
ferramenta de deletar. Usei o servidor para criar `docs/texto.txt` com `write_file`.

Também configurei o servidor **github** (escopo local), autenticado pela variável de ambiente
`GITHUB_TOKEN`, e não com o token gravado no arquivo de configuração.

## 2. Skill do projeto

A skill `add-api-endpoint` captura o fluxo que o projeto mais repete: adicionar ou alterar um
endpoint, que sempre toca os mesmos cinco lugares (helper em `db/store.js`, rota com validação
`400`/`404` e erros `{ error }`, montagem no `server.js`, testes com `supertest` e
`store.reset()`, e a entrada em `docs/api.md`). A `description` dispara pela **ação** ("Use when
adding or changing an HTTP endpoint"), dá exemplos concretos (`DELETE /users/:id`, `/products`),
inclui frases em português ("adicione um endpoint", "crie a rota") e diz explicitamente quando
**não** usar (perguntas sobre código existente, lint/CI, configuração). Numa sessão headless
limpa, "adicione um endpoint para listar os produtos" disparou a skill como primeira ação, e uma
pergunta sobre o `GET /users/:id` não disparou.

## 3. Comando personalizado

O comando `/check-conventions [intervalo git]` revisa as alterações (ou um intervalo de commits,
via `$ARGUMENTS`) contra um checklist de 10 itens com as convenções do projeto, e devolve uma
tabela ✅/❌ com `arquivo:linha` e o veredito "pronto para commit" ou "precisa de ajustes". Vale
um atalho porque é a revisão que se repete antes de todo commit ou merge, e o prompt é longo
demais para digitar sempre. Ele é somente leitura (`allowed-tools` libera só git de leitura,
testes e lint), então pode rodar a qualquer momento sem risco.

## 4. Hook

O hook **reage**: é um `PostToolUse` com matcher `Edit|Write`, configurado no
`.claude/settings.json`. Depois de cada edição, ele roda `eslint --fix --max-warnings 0` no
arquivo `.js` editado. Se sobrar problema, termina com exit 2, e o Claude recebe a saída do
ESLint para corrigir na hora. Testei adicionando uma variável não usada em `routes/health.js`: o
hook disparou e devolveu o aviso `no-unused-vars`. Para *prevenir* ações arriscadas, o projeto já
usa as regras `deny` (`rm`, `Remove-Item`, `git clean`, `move_file`).

## 5. Tarefa headless

Rodei com `claude -p` a escrita dos testes que faltavam para os ramos `400` de `POST /users` e
`PUT /users/:id`. Liberei só `Read` (para ler as rotas e o estilo dos testes),
`Edit(tests/users.test.js)` (um único arquivo editável) e `Bash(npm test)` (um único comando
exato), com `--permission-mode dontAsk` (tudo fora da lista é recusado na hora, sem pergunta) e
`--max-turns 10`. O resultado foi conferido depois: só `tests/users.test.js` mudou, e os 9
testes e o lint passaram.
