# Akemi Carrd — repositório

Este repositório contém **duas versões independentes** do carrd, isoladas em subpastas para que dê pra reconstruir o design do zero sem risco de mexer na versão errada por engano.

| Pasta | O que é | Status |
|---|---|---|
| [`v1/`](./v1) | Carrd atual (original) | 🔒 Em produção — não editar sem necessidade |
| [`v2/`](./v2) | Carrd novo, refeito do zero | 🚧 Em desenvolvimento |

## Regra de ouro

**Antes de editar qualquer arquivo, confira em qual pasta (`v1/` ou `v2/`) você está.** Cada pasta é um projeto completo e independente (tem seu próprio `site/`, `api/`, `package.json`, `vercel.json`, etc.) — nada é compartilhado entre elas.

- Quer mexer no design novo? Trabalhe dentro de `v2/`.
- Precisa só consultar/copiar algo do carrd antigo (bio, redes sociais, textos)? Vá em `v1/` só para olhar, e leve a informação para dentro de `v2/`.

## Histórico

O `v2/` nasceu como uma cópia exata do `v1/` (mesma bio, redes sociais e integrações de API — Lanyard/Spotify/Discord). A ideia é manter esse conteúdo e refazer apenas o design (HTML/CSS/layout) dentro de `v2/`.

## Deploy

- `v1/` é a versão publicada no domínio de produção atual (projeto Vercel "site" / `akemi.vercel.app`), ligado ao branch `master`.
- `v2/` está sendo publicado à parte, num projeto Vercel separado, só para acompanhamento visual enquanto o novo design é construído.

⚠️ Importante: quando este branch for mesclado em `master`, o projeto Vercel de produção precisa ter o **Root Directory** ajustado para `v1` (Settings → General → Root Directory), já que os arquivos não estão mais na raiz do repositório.
