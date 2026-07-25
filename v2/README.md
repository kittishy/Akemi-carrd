# 🚧 v2 — Carrd novo (em desenvolvimento)

Esta é a versão **nova**, sendo construída do zero visualmente. É aqui que o novo design deve ser feito.

Nasceu como uma cópia exata de [`../v1`](../v1): mesma bio, redes sociais e integrações de API (Lanyard/Spotify/Discord). O que muda é o **design** (HTML/CSS/layout) — o conteúdo e as integrações continuam funcionando como estão, só a apresentação visual será refeita.

## Rodar localmente

```bash
cd v2
npm install
npm run qa:smoke
```

Estrutura: `site/` (HTML/CSS/JS estático — aqui é onde o redesign acontece), `api/` (funções serverless — Lanyard/Spotify/Discord, manter funcionando), `tests/` (Playwright), `vercel.json` (config de deploy).
