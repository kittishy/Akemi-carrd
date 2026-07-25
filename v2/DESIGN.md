---
version: "alpha"
name: Akemi Sticker Notebook
description: Um perfil pessoal estilo Carrd com identidade de caderno de adesivos — papel quadriculado rosa, cards recortados tipo sticker e brilhos kawaii sutis.
colors:
  paper: "#FFFBFC"
  paperTint: "#FDF2F6"
  grid: "#F7DCE6"
  primary: "#B9859E"
  primaryDeep: "#8E5F76"
  lavender: "#D1CFF3"
  lavenderDeep: "#6C68B8"
  ink: "#4A3B42"
  inkSoft: "#7A6670"
  strawberry: "#F291A4"
  leaf: "#A8CBB0"
  cream: "#F8DCA0"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: M PLUS Rounded 1c
    fontSize: 1.5rem
    fontWeight: 800
    lineHeight: 1.15
  handle:
    fontFamily: M PLUS Rounded 1c
    fontSize: 0.85rem
    fontWeight: 700
  body:
    fontFamily: M PLUS Rounded 1c
    fontSize: 0.88rem
    fontWeight: 400
    lineHeight: 1.6
  label-caps:
    fontFamily: M PLUS Rounded 1c
    fontSize: 0.68rem
    fontWeight: 800
  button:
    fontFamily: M PLUS Rounded 1c
    fontSize: 0.8rem
    fontWeight: 700
rounded:
  xs: 0.4rem
  sm: 0.7rem
  md: 1.1rem
  lg: 1.6rem
  pill: 999px
spacing:
  xs: 0.3rem
  sm: 0.55rem
  md: 0.85rem
  lg: 1.3rem
  xl: 2rem
components:
  sticker-card:
    backgroundColor: "{colors.paperTint}"
    border: 4px solid {colors.white}
    rounded: "{rounded.lg}"
    shadow: 0 10px 22px rgba(142, 95, 118, 0.18)
  sticker-badge:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.pill}"
    shadow: 0 4px 10px rgba(142, 95, 118, 0.16)
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: 0.55rem 1.1rem
  button-ghost:
    backgroundColor: "{colors.white}"
    textColor: "{colors.primaryDeep}"
    rounded: "{rounded.pill}"
    padding: 0.55rem 1.1rem
---

## Overview

O ponto de partida é o próprio perfil de Discord da Akemi: papel quadriculado rosa, adesivos fofos (gatinho, morango, florzinha) espalhados, gradiente rosa → lavanda e brilhinhos flutuando. A ideia aqui não é decorar uma UI de app — é fazer a página inteira parecer uma folha de caderno colecionável, com cada bloco de conteúdo virando um sticker recortado colado no papel. Compacto, tátil e um pouco artesanal; nada de vidro, blur ou qualquer resquício visual de app de chat.

## Colors

- **Paper (#FFFBFC) / Paper Tint (#FDF2F6):** fundo do "caderno" e camadas de descanso dos cards. Base clara, quase branca, com um leve tom rosado.
- **Grid (#F7DCE6):** a linha do quadriculado — sutil, nunca compete com o conteúdo.
- **Primary (#B9859E — mauve):** cor de assinatura da Akemi. Usada em molduras, ícones, texto grande/display e nos acentos principais.
- **Primary Deep (#8E5F76):** versão escurecida do primary, usada em texto de corpo, links e qualquer lugar que precise de contraste AA sobre papel claro.
- **Lavender (#D1CFF3):** segunda cor de assinatura. Reservada para brilhos, detalhes secundários e washi tape.
- **Lavender Deep (#6C68B8):** versão escurecida para texto/link sobre lavanda.
- **Ink (#4A3B42) / Ink Soft (#7A6670):** texto principal e texto secundário/metadados — nunca preto puro, para manter o calor da paleta.
- **Strawberry / Leaf / Cream:** cores exclusivas dos adesivos (morango e florzinha) — não usar fora da decoração.
- **White:** a borda "die-cut" que faz cada card parecer um adesivo recortado.

**Regra de contraste:** `primary` e `lavender` puros rendem ~3:1 sobre `paper` — ok para decoração, molduras e título grande, mas **nunca** para corpo de texto. Corpo de texto usa `ink`/`inkSoft`; links usam `primaryDeep`/`lavenderDeep`.

## Typography

Família única: **M PLUS Rounded 1c** (400/700/800), que cobre latino e japonês com o mesmo arquivo de fonte — importante porque a bio mistura os dois. `display` é só para o nome; `body` é o texto corrido (bio, about); `label-caps` é para rótulos pequenos em caixa alta (ex.: "SOCIALS", "OUVINDO"); `button` para toda ação clicável.

## Layout

Um único card compacto, sem scroll — tudo precisa caber na tela de um celular sem rolar. Densidade alta mas respirável: espaçamento generoso entre blocos (`spacing.lg`), compacto dentro deles (`spacing.sm`/`xs`). O quadriculado ocupa a página inteira por trás do card; os adesivos ficam espalhados nas bordas, nunca sobre texto legível.

## Elevation & Depth

Profundidade é de papel, não de vidro: sombras difusas e macias (nunca duras ou nítidas), sem blur de fundo, sem transparência translúcida. Cada card "flutua" ligeiramente sobre o quadriculado como se estivesse colado com um pontinho de fita.

## Shapes

Cantos generosamente arredondados (`rounded.md`/`lg`) em todos os cards e botões — o oposto do quadrado duro. Botões e badges pequenos usam `rounded.pill`. A moldura do avatar é circular.

## Components

- **Sticker card:** o bloco base de todo conteúdo (bio, socials, now-playing, lanyard). Borda branca grossa de 4px simulando o contorno de um adesivo recortado, sombra macia, leve rotação alternada entre cards vizinhos (`rotate(-1.2deg)` / `rotate(1deg)`) para parecer colado à mão, não impresso.
- **Sticker badge:** pílulas brancas pequenas (ex. pronomes, "she/her", status "ouvindo agora") com sombra leve, como um adesivo de reforço sobre o card.
- **Botões:** `button-primary` (mauve sólido, texto branco) para a ação principal; `button-ghost` (branco, texto mauve) para ações secundárias — ambos em pílula.
- **Decoração (quadriculado + adesivos):** inteiramente CSS/SVG, sem arquivo de imagem — o quadriculado via gradientes lineares repetidos, os adesivos (gatinho, morango, florzinha) como SVG inline com `aria-hidden="true"` e `pointer-events: none`, para nunca atrapalhar leitura ou navegação.

## Do's and Don'ts

Do manter tudo em uma tela só, sem scroll, pensando primeiro no celular.

Do usar sombras macias e rotação sutil para o efeito "colado à mão".

Do reservar `primary`/`lavender` puros para decoração e texto grande — corpo de texto sempre em `ink`/`inkSoft`.

Don't usar glassmorphism, blur de fundo ou qualquer superfície translúcida.

Don't deixar a página parecer um cliente de chat (Discord, etc.) — isso é um caderno de adesivos, não um app.

Don't sobrecarregar de animação: brilhos e transições são sutis e sempre respeitam `prefers-reduced-motion`.
