# MCP Servers configurados

Servidores MCP disponíveis nas sessões do Claude Code deste projeto:

| Servidor | Tipo | Onde está configurado | Para que serve |
|---|---|---|---|
| `filesystem` | stdio | `.mcp.json` (projeto, vai para o git) | Ler e gravar arquivos do projeto |
| `github` | HTTP | `~/.claude.json` (escopo local, só nesta máquina) | Acessar repositórios, issues e PRs no GitHub |
| `docs-estudos` | stdio | Configuração do usuário | Leitura da pasta `Documentos\ESTUDOS` |
| `memoriapessoal` | stdio | Configuração do usuário | Grafo de memória persistente (`server-memory`) |

Para conferir o estado de todos: `claude mcp list`.

## filesystem

### Definição (`.mcp.json`)

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-filesystem", "./docs"],
      "env": {}
    }
  }
}
```

- Usa o pacote oficial `@modelcontextprotocol/server-filesystem`, executado via `npx`.
- No Windows, o `npx` precisa ser chamado através de `cmd /c`.
- A pasta declarada é `./docs`. Na prática, o Claude Code informa ao servidor as pastas de
  trabalho da sessão (a raiz do projeto e as pastas adicionais), e essa lista substitui a
  `./docs`. Use a ferramenta `list_allowed_directories` para ver o que está liberado.

### Ativação e permissões

O servidor é habilitado por `"enabledMcpjsonServers": ["filesystem"]` no `.claude/settings.local.json`
(aprovar um servidor do `.mcp.json` é decisão de cada pessoa). As regras de permissão abaixo
ficam no `.claude/settings.json`, que é commitado, para valerem para todos que clonarem o projeto.

**Permitido sem confirmação (ler e gravar):**

- Leitura: `read_file`, `read_text_file`, `read_media_file`, `read_multiple_files`
- Navegação: `list_directory`, `list_directory_with_sizes`, `directory_tree`, `search_files`,
  `get_file_info`, `list_allowed_directories`
- Escrita: `write_file`, `edit_file`, `create_directory`

**Bloqueado (impedir exclusão):**

- `mcp__filesystem__move_file`: o servidor não tem ferramenta de deletar, e `move_file` é a
  única que consegue tirar um arquivo do lugar.
- Bash: `rm`, `rmdir`, `find ... -delete`, `git clean`
- PowerShell: `Remove-Item` e seus apelidos (`rm`, `del`, `erase`, `rd`, `ri`, `rmdir`),
  `git clean`

Limitações:

- `write_file` pode sobrescrever um arquivo existente, inclusive com conteúdo vazio.
- As regras comparam o início do comando. Um script (ex.: `node -e "fs.unlinkSync(...)"`)
  ainda consegue apagar arquivos.

Teste feito: `docs/texto.txt` foi criado via `write_file`. A tentativa de apagá-lo com `rm` foi
recusada.

## github

### Definição

```json
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "Authorization": "${GITHUB_TOKEN}"
  }
}
```

> O header está sem o prefixo `Bearer ` e o servidor do GitHub aceita assim (teste com a
> ferramenta `get_me` retornou o usuário). Se houver erro de autenticação, use
> `Bearer ${GITHUB_TOKEN}`, que é o formato padrão.

- Servidor remoto oficial do GitHub, acessado por HTTP.
- A autenticação usa um Personal Access Token (PAT) do GitHub, que dá acesso ao repositório.
- O token fica em uma variável de ambiente do sistema e não é gravado no arquivo de
  configuração. O Claude Code substitui `${GITHUB_TOKEN}` pelo valor da variável
  quando conecta ao servidor. Assim o token não fica exposto em arquivos nem vai para o git.
- Configurado no escopo local (`~/.claude.json`), só para este projeto nesta máquina.

### Como configurar com variável de ambiente

1. Criar a variável no Windows (PowerShell) e reabrir o terminal:

   ```powershell
   [Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "<seu token>", "User")
   ```

2. Recriar o servidor apontando para a variável. Use **aspas simples**: com aspas duplas
   (ou `$env:GITHUB_TOKEN`), o shell troca a variável pelo token antes de o `claude` receber o
   comando, e o token acaba gravado literalmente no `~/.claude.json`.

   ```powershell
   claude mcp remove github -s local
   claude mcp add --transport http github https://api.githubcopilot.com/mcp/ -H 'Authorization: Bearer ${GITHUB_TOKEN}'
   ```

3. Conferir com `claude mcp list`.

### Como conferir a variável no terminal

No PowerShell, `echo $GITHUB_TOKEN` **não mostra nada**. Nele, `$GITHUB_TOKEN` é uma variável
do próprio PowerShell, que não existe e por isso vem vazia (sem erro). Para ler a variável de
ambiente, é preciso usar o prefixo `$env:`:

```powershell
echo $env:GITHUB_TOKEN
```

| Shell | Sintaxe |
|---|---|
| PowerShell | `$env:GITHUB_TOKEN` |
| Bash / Git Bash | `$GITHUB_TOKEN` |
| cmd | `%GITHUB_TOKEN%` |

Se `$env:GITHUB_TOKEN` também vier vazio, o terminal foi aberto antes de a variável ser criada.
Cada processo recebe uma cópia das variáveis de ambiente quando inicia, então basta abrir um
terminal novo. Pelo mesmo motivo, o Claude Code precisa ser reiniciado para enxergar uma
variável nova ou alterada. Para conferir direto na configuração do Windows, sem depender do
terminal:

```powershell
[Environment]::GetEnvironmentVariable("GITHUB_TOKEN", "User")
```

### Tentativa de usar o arquivo `.env` (não funcionou)

A primeira ideia foi guardar o token em um arquivo `.env` na raiz do projeto e fazer o MCP
lê-lo de lá. Não funcionou, pelos motivos abaixo.

**Motivos:**

1. **O Claude Code não lê arquivos `.env`.** Ao substituir `${GITHUB_TOKEN}` na configuração
   do MCP, ele usa só as variáveis de ambiente do processo (as do Windows ou as definidas no
   terminal). Um `.env` na pasta do projeto é ignorado.
2. **O `.env` não estava no formato `NOME=valor`.** O arquivo continha só o token, sem
   `GITHUB_TOKEN=` na frente. Mesmo uma ferramenta que lesse `.env` (como o pacote `dotenv`)
   não saberia a que variável o valor pertence.
3. **O projeto também não carrega o `.env`.** Não há `dotenv` no código nem `--env-file` nos
   scripts do `package.json`.
4. **Na primeira configuração, o token acabou gravado literalmente no `~/.claude.json`.** O
   comando `claude mcp add` foi executado com o header entre aspas duplas. O PowerShell trocou
   a variável pelo token antes de o `claude` receber o comando, então foi gravado o valor, e não
   a referência `${GITHUB_TOKEN}`.

**O que foi feito para corrigir:**

1. Criada a variável de ambiente `GITHUB_TOKEN` no escopo de usuário do Windows, que é de onde
   o Claude Code realmente lê o valor.
2. O servidor `github` foi removido e recriado com o header entre **aspas simples**, para que o
   texto `${GITHUB_TOKEN}` fosse gravado sem ser substituído pelo shell.
3. Verificação:
   - `~/.claude.json` contém `${GITHUB_TOKEN}` no header, sem o token literal;
   - a variável existe nos escopos User e Process (não no Machine);
   - `claude mcp list` mostra `github ... Connected`;
   - a ferramenta `get_me` do MCP retornou o usuário do GitHub, confirmando a autenticação.

Com isso, o `.env` deixou de ser necessário para o MCP. Ele está no `.gitignore` e pode ser
apagado.

> Alternativa não adotada: o Claude Code aceita um `headersHelper`, um comando que roda a
> cada conexão e devolve os headers em JSON. Com ele, um script poderia ler o token do `.env`.
> Optou-se pela variável de ambiente por ser mais simples.

# Skill do projeto: `add-api-endpoint`

Arquivo: `.claude/skills/add-api-endpoint/SKILL.md`

## Qual forma de trabalho repetida a skill captura?

Adicionar ou alterar um endpoint da API. É o fluxo que o projeto mais repete, e ele junta todas
as convenções do `CLAUDE.md` em uma tarefa só. Todo endpoint toca os mesmos cinco lugares, nesta
ordem:

1. **`db/store.js`:** um helper de acesso a dados. As rotas nunca guardam estado. Buscas e
   alterações devolvem `undefined` quando o registro não existe, em vez de lançar erro. Dados de
   exemplo ficam em `seed()`, para que `reset()` os restaure nos testes.
2. **`routes/<recurso>.js`:** um router por recurso, com um comentário `// METHOD /path — ...`
   acima de cada rota, `Number(req.params.id)`, `400` para entrada inválida, `404` para registro
   inexistente, erros sempre no formato `{ error: 'message' }`, `201` na criação e `204` na
   exclusão.
3. **`server.js`:** montar o router no caminho base no plural (só para recurso novo).
4. **`tests/<recurso>.test.js`:** `node:test` + `supertest`, com `store.reset()` antes de cada
   teste. Um teste para o caminho feliz e um para cada erro (`400` e `404` com o id `999`).
5. **`docs/api.md`:** uma entrada `### METHOD /path` com todos os status de retorno.

A skill termina pedindo para rodar `npm test` e `npm run lint`.

## Como a `description` foi escrita para disparar?

```
Use when adding or changing an HTTP endpoint in this Express Course API — a new route or verb
on an existing resource (e.g. DELETE /users/:id, PATCH /users/:id) or a whole new resource
(e.g. /products, /orders). Covers the store helper, route validation and error responses,
mounting in server.js, supertest tests, and docs/api.md. Also fires on Portuguese requests
such as "crie a rota", "adicione um endpoint", "novo recurso na API". Do NOT use for questions
about existing code, lint/CI fixes, MCP or Claude Code configuration, or tests that don't come
with an endpoint change.
```

- **Gatilho pela ação, não pelo assunto:** começa com "Use when adding or changing an HTTP
  endpoint". A skill dispara quando o pedido é para *criar ou mudar* um endpoint, e não quando o
  pedido só fala de rotas.
- **Exemplos concretos:** `DELETE /users/:id`, `PATCH /users/:id`, `/products`, `/orders`. Assim
  pedidos que não usam a palavra "endpoint" ("deletar um usuário") também casam com a skill.
- **O que a skill entrega:** listar store, validação, `server.js`, testes e docs ajuda o Claude a
  reconhecer que a tarefa é desse tipo.
- **Frases em português:** os pedidos são feitos em português, então a descrição inclui
  "crie a rota", "adicione um endpoint" e "novo recurso na API".
- **Exclusões explícitas ("Do NOT use for"):** perguntas sobre código existente, correções de
  lint/CI, configuração de MCP/Claude Code e testes sem mudança de endpoint. Isso evita que a
  skill dispare em pedidos parecidos, mas que não são de criar endpoint.

## Teste de disparo

- Pedido feito sem citar a skill: *"adicione um endpoint para deletar um usuário"*.
- A skill `add-api-endpoint` foi carregada e o resultado seguiu os cinco passos: `deleteUser` no
  store, rota `DELETE /users/:id` (`204` / `404`), dois testes novos e entrada no `docs/api.md`.
  `npm test` passou com 7 de 7 testes, e `npm run lint` passou sem avisos.
- Ressalva: esse primeiro teste foi feito na mesma sessão em que a skill foi escrita. Por isso
  foi repetido numa sessão limpa (abaixo).
- Teste negativo sugerido, que **não** deve disparar a skill: *"o que o GET /users/:id retorna
  quando o usuário não existe?"*.

# Comando reutilizável: `/check-conventions`

Arquivo: `.claude/commands/check-conventions.md`

## Para que serve

Revisa as alterações do repositório contra o checklist de convenções do projeto, ou seja, as
regras do `CLAUDE.md` mais as convenções registradas na skill `add-api-endpoint`. É uma revisão
somente leitura: o prompt proíbe editar arquivos. É um prompt que se roda sempre antes de um
commit ou de um merge.

## Entrada (`$ARGUMENTS`)

Um único valor livre: o intervalo do git a revisar. Por isso foi usado `$ARGUMENTS`, e não
`$1`/`$2`.

| Uso | O que revisa |
|---|---|
| `/check-conventions` | Alterações ainda não commitadas, incluindo arquivos novos |
| `/check-conventions main..HEAD` | Os commits do branch atual em relação à `main` |
| `/check-conventions HEAD~2` | Da referência indicada até a working tree |

O frontmatter define `description`, `argument-hint` (dica exibida ao digitar o comando) e
`allowed-tools`, que libera sem confirmação só comandos de leitura do git, `npm test`,
`npm run lint` e as ferramentas de leitura de arquivos.

## Checklist (10 itens)

1. Um router por recurso, montado no `server.js` no caminho base no plural.
2. Estado só no `db/store.js`; helpers novos exportados; dados de exemplo em `seed()`.
3. Helpers devolvem `undefined` para registro inexistente, e a rota responde `404`.
4. Validação na rota com `400`; ids convertidos com `Number(req.params.id)`.
5. Erros sempre no formato `{ "error": "message" }`.
6. Status codes: `201` na criação, `204` sem corpo na exclusão, `200` nos demais; `return res...`.
7. Comentário `// METHOD /path — ...` acima de cada rota.
8. Testes com `node:test` + `supertest` e `store.reset()`, cobrindo sucesso e cada `400`/`404`.
9. Entrada `### METHOD /path` no `docs/api.md` com todos os status.
10. `npm test` e `npm run lint` passando.

O relatório sai como tabela (✅ / ❌ / N/A com `arquivo:linha`), com uma sugestão de correção para
cada ❌ e o veredito **pronto para commit** ou **precisa de ajustes (N itens)**.

## Teste

Executado como `/check-conventions 8c2eb9a..HEAD`, sobre os commits da tarefa anterior (skill,
`DELETE /users/:id` e `NOTES.md`):

- Itens 2 a 10 com ✅, e o item 1 como N/A (nenhum router novo). `npm test` passou com 7 de 7
  testes e o lint passou sem avisos. Veredito: **pronto para commit**.
- O comando separou corretamente os arquivos de documentação e configuração
  (`SKILL.md`, `NOTES.md`) dos arquivos de código.
- Também apontou dois pontos em código anterior ao intervalo, sem bloquear o commit: os ramos de
  `400` de `POST /users` e `PUT /users/:id` não têm teste, e um id que não é número
  (`/users/abc`) devolve `404`, e não `400`.
- O resultado foi o esperado, e o prompt não precisou de ajuste.

# Hook do projeto: lint a cada edição

Arquivos: `.claude/settings.json` (escopo do projeto, vai para o git) e
`.claude/hooks/lint-on-edit.cjs`.

## As três escolhas

| Escolha | Valor | Por quê |
|---|---|---|
| Evento | `PostToolUse` | Reagir depois que o arquivo é gravado: verificar e devolver os problemas ao Claude. Para *impedir* ações arriscadas (`PreToolUse`) já existem as regras `deny` do `settings.local.json`. |
| Matcher | `Edit\|Write` | São as ferramentas que gravam arquivos. |
| Comando | `node "$CLAUDE_PROJECT_DIR/.claude/hooks/lint-on-edit.cjs"` | Roda o ESLint local do projeto no arquivo editado. |

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/lint-on-edit.cjs\"",
            "timeout": 30,
            "statusMessage": "ESLint no arquivo editado..."
          }
        ]
      }
    ]
  }
}
```

## O que o script faz

1. Lê o JSON que o Claude Code envia pela entrada padrão e pega `tool_input.file_path`.
2. Ignora arquivos que não são `.js`, que estão fora do projeto ou dentro de `node_modules`.
3. Roda `eslint --fix --max-warnings 0` só nesse arquivo, usando o ESLint de
   `node_modules` (sem `npx` e sem `jq`, para funcionar igual no Windows e no Linux). Se o
   ESLint não estiver instalado, avisa e não bloqueia.
4. Se sobrar erro ou aviso, termina com **exit 2**: o Claude Code devolve a saída do ESLint ao
   Claude, que corrige na hora. Com exit 0, nada aparece.

O `--max-warnings 0` faz avisos (como variável não usada) também serem cobrados.

## Teste

- **Pela linha de comando**, simulando a entrada do hook: arquivo limpo → exit 0; arquivo com
  variável não usada → exit 2 com a saída do ESLint; `NOTES.md` → ignorado (exit 0).
- **Provocando a situação de propósito:** foi adicionada `const hookTest = 'unused';` em
  `routes/health.js` com a ferramenta Edit. O hook disparou logo após a edição e devolveu
  `'hookTest' is assigned a value but never used (no-unused-vars)`. A linha foi removida, o
  hook rodou de novo sem reclamar, e o arquivo voltou a ficar idêntico ao original.

## Limitação

O `--fix` corrige pouco neste projeto: as regras do `eslint:recommended` (ESLint 9) quase não
têm correção automática (um `;;` ficou intacto no teste). O valor do hook está em cobrar o
padrão de lint a cada edição, em vez de esperar o `npm run lint` ou o CI. Para formatação de
verdade, o caminho seria adicionar o Prettier ao projeto e chamá-lo no mesmo hook.

# Tarefa sem supervisão: `claude -p` (headless)

## A tarefa

Adicionar os testes que faltavam para os ramos `400` de `POST /users` e `PUT /users/:id`, um
ponto que o `/check-conventions` apontou na tarefa anterior. É uma tarefa pequena e bem
delimitada: ler o código, editar um único arquivo de teste e rodar os testes.

## O comando

```bash
claude -p "In tests/users.test.js, add the missing tests for the 400 branches of the users routes: POST /users without email, and PUT /users/:id with an empty body. Follow the existing style in that file (node:test, supertest, assert.equal on status, and also assert res.body.error). Read routes/users.js to get the exact error messages. Only edit tests/users.test.js. Then run exactly: npm test — and report how many tests passed." \
  --allowedTools "Read" "Edit(tests/users.test.js)" "Bash(npm test)" \
  --permission-mode dontAsk \
  --max-turns 10 \
  --output-format text
```

## O que foi liberado e por quê

| Ferramenta | Por quê |
|---|---|
| `Read` | Ler `routes/users.js` para pegar as mensagens de erro exatas e ler o arquivo de teste para seguir o estilo. Ler não altera nada. |
| `Edit(tests/users.test.js)` | Editar **só esse arquivo**. Qualquer tentativa de mexer em rota, store ou configuração é negada. |
| `Bash(npm test)` | **Só esse comando exato**, para validar o resultado. `npm install`, `git` ou qualquer outro comando continua bloqueado. |

Ficou de fora de propósito: `Write` (não há arquivo novo a criar), `Edit` em outros arquivos,
qualquer outro comando de terminal, `WebFetch` e as ferramentas de MCP.

Outros parâmetros:

- **`--permission-mode dontAsk`:** tudo que não está na lista é recusado na hora, sem pergunta.
  Sem ninguém olhando, uma pergunta ficaria sem resposta.
- **`--max-turns 10`:** limita quantas rodadas a sessão pode fazer, para ela não ficar em loop.
- O prompt repete os limites ("Only edit tests/users.test.js", "run exactly: npm test"). Assim
  o modelo não tenta algo que a lista de ferramentas negaria, como `npm test 2>&1`.

As regras `deny` do `.claude/settings.local.json` e o hook de lint do `.claude/settings.json`
também valem no modo headless.

## Resultado

Saída da sessão headless (exit 0):

```
All 9 tests passed, including the two new 400 tests:
- ✔ POST /users without email returns 400
- ✔ PUT /users/:id with empty body returns 400
```

Conferido depois, sem confiar só no relatório da sessão:

- `git diff` mostra só `tests/users.test.js` alterado, com dois testes novos no estilo do
  arquivo. Eles conferem o status `400` e as mensagens `'name and email are required'` e
  `'name or email is required'`.
- `npm test`: 9 de 9 testes passaram. `npm run lint` passou sem avisos.

# Confirmação do disparo da skill em sessão limpa

Para uma prova isolada, a skill foi testada em sessões headless novas, que não conheciam a
conversa em que ela foi escrita. Só a ferramenta `Skill` foi liberada (mais `Read` no teste
negativo), então nada podia ser alterado. Modelo: Haiku 4.5 (o padrão do usuário).

- **Positivo:** `claude -p "adicione um endpoint para listar os produtos" --allowedTools "Skill"
  --permission-mode dontAsk --max-turns 3 --output-format stream-json --verbose`.
  A primeira ação da sessão foi `Skill → add-api-endpoint` (args `GET /products - list all
  products`). Em seguida ela leu os arquivos que a skill indica (`db/store.js`,
  `routes/users.js`, `server.js`, `tests/users.test.js`, `docs/api.md`) e parou no limite de
  rodadas, sem editar nada.
- **Negativo:** `claude -p "o que o GET /users/:id retorna quando o usuário não existe?"
  --allowedTools "Skill" "Read" ...`. A sessão leu `routes/users.js` e respondeu (`404` com
  `{ "error": "User not found" }`), **sem chamar a skill**.

# Ajustes finais

- O `.mcp.json` passou a ser commitado (antes ficava fora do git).
- As regras de permissão (`allow`/`deny`) saíram do `.claude/settings.local.json` e foram para o
  `.claude/settings.json`. Depois da mudança, um `rm` continuou sendo negado.
