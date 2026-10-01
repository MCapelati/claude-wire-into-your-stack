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

### Ativação e permissões (`.claude/settings.local.json`)

O servidor é habilitado por `"enabledMcpjsonServers": ["filesystem"]`.

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
- Ressalva: esse teste foi feito na mesma sessão em que a skill foi escrita. Para uma prova
  isolada, repetir o pedido numa sessão nova (`/clear`).
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
