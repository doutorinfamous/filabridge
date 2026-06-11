# FilaBridge Web (Next.js)

Front-end do FilaBridge construído com **Next.js 16**, **Tailwind CSS v4** e
**shadcn/ui**. Serve a UI na porta **5000** e faz proxy de toda a API para o
backend Go (porta interna 5001), mantendo os paths originais:

- `/api/*` → proxy via route handler ([app/api/[...path]/route.ts](app/api/%5B...path%5D/route.ts))
- `/ws/*` → proxy de WebSocket via rewrite ([next.config.ts](next.config.ts))

## Desenvolvimento

```bash
# 1. Backend Go (em outra aba)
cd ../backend && go run . --port 5001

# 2. Front-end
npm install
npm run dev -- -p 5000
```

Acesse http://localhost:5000. A URL do backend pode ser alterada com a
variável `BACKEND_URL` (padrão: `http://127.0.0.1:5001`).

## Estrutura

- `app/` — páginas: Dashboard (`/`), NFC (`/nfc`), Configurações (`/settings`)
- `components/` — cards de impressora (Moonraker/Bambu), combobox de spools, etc.
- `components/ui/` — componentes shadcn/ui
- `lib/` — cliente tipado da API, tipos e hook do WebSocket de status

## Build de produção

```bash
npm run build   # gera saída standalone (usada pelo Dockerfile da raiz)
```
