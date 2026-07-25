# 🔒 v1 — Carrd antigo (produção)

Esta é a versão **original** do carrd, hoje no ar em produção. **Não edite aqui** a menos que seja intencional — o design novo está sendo feito em [`../v2`](../v2).

Use esta pasta só para:
- consultar/copiar conteúdo (bio, redes sociais, textos) que ainda vai ser usado no `v2/`;
- corrigir um bug urgente do site que já está no ar.

## Rodar localmente

```bash
cd v1
npm install
npm run qa:smoke
```

Estrutura: `site/` (HTML/CSS/JS estático), `api/` (funções serverless — Lanyard/Spotify/Discord), `tests/` (Playwright), `vercel.json` (config de deploy).
