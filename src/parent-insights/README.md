# Parent insights query semantics

## Dados disponÃ­veis para o futuro relatÃ³rio

Esta fase disponibiliza, a partir do inÃ­cio do tracking, os fatos de Biblioteca Sensorial que
podem alimentar um relatÃ³rio futuro: quantidade de conteÃºdos acessados, histÃ³rias e mÃºsicas
iniciadas, conclusÃµes naturais, conteÃºdos mais acessados por `accessCount`, tipo catalogrÃ¡fico,
datas de inÃ­cio e conclusÃ£o e dias ativos. `favorito` nÃ£o Ã© derivado de frequÃªncia; essa
informaÃ§Ã£o sÃ³ existirÃ¡ com uma feature explÃ­cita.

O primeiro cliente nÃ£o envia heartbeat nem tempo consumido. `lastPositionMs` e
`consumedDurationMs` permanecem nulos nesta rodada para nÃ£o confundir a duraÃ§Ã£o do arquivo com
tempo realmente consumido. Se uma mÃ­dia tocar enquanto o start falha, o ViewModel tenta novamente
durante a mesma sessÃ£o; nÃ£o hÃ¡ fila offline nem atividade local confirmada sem persistÃªncia no
backend.

All stored timestamps are UTC instants. Product-calendar boundaries are resolved explicitly in
`MISSION_TIME_ZONE` (default `America/Sao_Paulo`) and every interval uses `[from, to)`.

- `WEEK`: from Sunday at 00:00 local time through the request instant. Its comparison is the same
  elapsed Sunday-to-current-time slice in the preceding calendar week. For example, Wednesday at
  15:00 is compared with the preceding Sunday through Wednesday at 15:00.
- `THIRTY_DAYS`: from local midnight 29 calendar dates before today through the request instant,
  so the current local date is the thirtieth date. Its comparison is the immediately preceding
  interval with the same elapsed duration.
- `THREE_MONTHS`: from local midnight on the same calendar day three months before the request
  through the request instant (clamped to the last valid day of the target month). Its comparison
  is the immediately preceding interval with the same elapsed duration.

Mission trend buckets are `DAY` for `WEEK` and Sunday-based `WEEK` buckets for `THREE_MONTHS`.
A zero bucket is valid because missions and real library starts are instrumented; unsupported
domains are represented only through `availability`, never through invented zero-valued metrics.
The aggregation treats database timestamps as UTC instants and converts them explicitly to the
configured product timezone before deriving local days or Sunday-based buckets.

`MissionCompletion` remains canonical for mission identity, rewards awarded, completion time and
optional child feedback. `ChildActivityEvent` is a narrow projection used by history, active-day
and trend queries. Free-text feedback is never copied into the event stream and
`MissionFeedbackRating` is never treated as an emotion taxonomy.

### Fonte de cada métrica

| Métrica | Fonte nesta fase |
| --- | --- |
| `missionsCompleted` e comparação | `MissionCompletion.completedAt` |
| `missionTrend` | `ChildActivityEvent` do tipo `MISSION_COMPLETED` |
| `activeDaysFromTrackedActivities` | dias locais distintos de `MISSION_COMPLETED` ou `LIBRARY_STARTED` |
| `starsEarnedFromMissions` / `crystalsEarnedFromMissions` | `RewardTransaction` com `reason = MISSION_COMPLETED` |
| `activity-history` | `ChildActivityEvent` → `MissionCompletion` → `Mission` e feedback canônico |
| `library.contentsStarted` / `contentsCompleted` | `LibraryPlayback.startedAt` / `completedAt` |
| `library.mostAccessed` | contagem de `LibraryPlayback` iniciados, com desempate por `contentId` |

`LibraryPlayback` e a fonte canonica da participacao infantil em Biblioteca. Um clique no catalogo
nao cria registro; o Android so chama `POST .../playbacks/start` depois que o Media3 confirma
reproducao real. `POST .../playbacks/:playbackId/complete` so e chamado para `STATE_ENDED` natural.
Cada participacao recebe um `clientSessionId` UUID unico, e as projecoes `LIBRARY_STARTED` e
`LIBRARY_COMPLETED` sao protegidas por unique constraints. `trackedActivities` conta a participacao
uma vez via `LIBRARY_STARTED`; o completion tecnico nao cria uma segunda atividade.

O historico parental projeta uma participacao de Biblioteca como um unico item `type = LIBRARY`,
com `library.contentId`, `title`, `contentType`, `startedAt` e `completedAt` opcional. Missoes
continuam trazendo recompensas e feedback canonico separadamente; `FamilyNote` continua fora da
linha do tempo de fatos do PupiMundo.

Sem o backfill, somente a primeira linha continua completa para conclusões históricas; tendência,
dias ativos, recompensas por período e histórico ficam incompletos para essas conclusões.

## Deploy e projeção histórica

As migrations `20260902000000_add_family_notes`,
`20260902010000_add_child_activity_and_reward_ledger` e
`20260904000000_add_library_playback_tracking` criam o schema, mas nao executam
backfill. Isso é intencional: a criação das tabelas pode ser auditada e revertida
separadamente, e uma migration não deve recreditar saldos históricos.

Uso de Biblioteca anterior a instrumentacao nao e reconstruido. Nao ha inferencia por `updatedAt`,
URL, cache, arquivos ou duracao. A disponibilidade `libraryUsage = true` significa apenas que o
fluxo atual persiste participacoes confiaveis a partir desta release; ela nao transforma o catalogo
historico em uso medido.

O catalogo atual reconhece `STORIES`, `MUSIC` e `VIDEOS`, mas a auditoria desta rodada encontrou
somente `STORIES` e `MUSIC`. Nao existe taxonomy `PUPI_ENSINA` no backend atual; essa categoria
permanece uma lacuna para o futuro relatorio, sem ser inventada agora.

Depois de publicar o código e aplicar as migrations no ambiente alvo:

1. valide que a API está saudável e execute `npm run missions:audit:projections`;
2. execute `npm run missions:backfill:projections` (dry-run) e revise apenas as contagens;
3. execute `npm run missions:backfill:projections -- --apply` uma única vez de forma controlada;
4. repita a auditoria e confirme que a segunda execução em dry-run encontra zero projeções
   pendentes e que os saldos de `Child` não mudaram;
5. faça o smoke test das APIs parentais no Android.

O backfill usa paginação por cursor, as constraints únicas como proteção adicional e cria
somente `ChildActivityEvent` e `RewardTransaction` para cada `MissionCompletion` sem projeção.
`feedbackRating`, `feedbackComment` e seus timestamps permanecem exclusivamente na conclusão e
continuam disponíveis no histórico por meio do join canônico.
