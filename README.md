# PainelURE

Base operacional inspirada no `finanza`, adaptada para concentrar rotina tecnica da URE, agenda, chamados, escolas, ativos, relatorios e automacao de redes.

## Estrutura atual

- `frontend/`: interface principal do app
- `server/`: servidor local que entrega o frontend e expõe uma API simples de estado
- `tools/processar_redes.ps1`: automacao de redes
- `setec_daily_app.html`: prototipo original preservado

## Como esta funcionando

- `index.html` carrega o app direto na raiz do site, mantendo a URL publica limpa
- o app usa armazenamento local do navegador
- ha exportacao e importacao de backup JSON
- ha migracao direta do estado legado salvo pelo `setec_daily_app.html`
- ha suporte a salvar e carregar o estado por servidor local via `/api/state`
- cada salvamento no servidor local gera um snapshot versionado
- a configuracao de redes monta o comando para o script PowerShell

## Rodando com servidor local

```powershell
npm start
```

Depois abra:

```text
http://localhost:4173
```

Nesse modo, a tela de conta passa a permitir:

- salvar o estado atual no servidor local
- carregar o ultimo estado salvo no servidor local
- listar snapshots versionados
- restaurar snapshots do servidor local
- verificar a saude da API local

Se nao existir estado local no navegador, o frontend tenta aproveitar automaticamente o estado salvo no servidor local ao abrir por `http://localhost:4173`.

## Verificacao rapida

```powershell
npm run check
```
