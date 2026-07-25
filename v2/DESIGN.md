---
version: "alpha"
name: Akemi Konbini Manga Profile
description: A compact Carrd-style personal profile with manga ink, konbini packaging, and vending-machine tactility.
colors:
  paper: "#F7F1E8"
  paperWarm: "#EFE4D7"
  surface: "#FFFDF8"
  ink: "#181615"
  inkSoft: "#3D3935"
  line: "#211F1D"
  muted: "#756B61"
  konbiniRed: "#C63D2D"
  drinkBlue: "#245DA8"
  ticketYellow: "#E7BC3D"
  melonMint: "#7FA28B"
  steel: "#D9E1EA"
typography:
  display:
    fontFamily: Archivo
    fontSize: 1.24rem
    fontWeight: 900
  jp-plaque:
    fontFamily: Noto Serif JP
    fontSize: 0.72rem
    fontWeight: 700
  body-sm:
    fontFamily: Archivo
    fontSize: 0.82rem
    lineHeight: 1.62
  label-caps:
    fontFamily: Archivo
    fontSize: 0.7rem
    fontWeight: 900
  button:
    fontFamily: Archivo
    fontSize: 0.78rem
    fontWeight: 800
rounded:
  xs: 0.08rem
  sm: 0.28rem
  md: 0.38rem
  lg: 0.58rem
  pill: 999px
spacing:
  xs: 0.24rem
  sm: 0.42rem
  md: 0.6rem
  lg: 0.82rem
components:
  shell:
    border: 2px solid {colors.line}
    shadow: 5px 5px 0 rgba(24, 22, 21, 0.9)
  hero:
    plaque: "明美"
    label: "KONBINI"
  controls:
    style: vending-machine buttons with hard ink shadows and small status lights
  panels:
    style: manga receipt panels on warm paper
---

## Overview

Akemi is a personal profile first, not a product page. The interface should feel like a tiny Japanese convenience-store card pulled from a manga page: compact, tactile, playful, and a little handmade. Its soul is the contrast between a simple Carrd profile and the physical language of konbini packaging, vending buttons, paper receipts, and inked panel borders.

## Colors

Use warm paper as the foundation, deep ink as the structure, and only a few saturated accents. Red, blue, yellow, and mint should feel like package labels and vending-machine lights, not a full rainbow theme. Pure white is reserved for paper highlights and small surfaces.

## Typography

Archivo stays as the Latin workhorse because it keeps the profile crisp and compact. Noto Sans JP and Noto Serif JP support Japanese labels and the `明美` plaque. Heavy uppercase labels are allowed when they feel like printed packaging or machine labels. Avoid oversized editorial typography; this is a profile card, not a hero campaign.

## Layout

Keep the original Carrd-like silhouette: one centered compact card, short panels, and quick actions. Use tight spacing, visible boundaries, and small offset shadows. The layout should invite scanning rather than scrolling through sections.

## Elevation & Depth

Depth is graphic, not glassy: hard black shadows, ink outlines, stamped labels, and subtle paper texture. Avoid blurred glow-heavy effects except tiny status lights.

## Shapes

Corners stay small. Manga panels, receipt cards, and vending controls use squared or lightly rounded rectangles. Circular shapes are reserved for avatar frames, status LEDs, and compact icon badges.

## Components

Buttons should feel pressable, like vending-machine controls. Menus should feel like a small machine drawer. Panels should read as receipt/product-slot surfaces. Music and activity cards should stay information-dense and never become large decorative cards.

## Do's and Don'ts

Do preserve the compact profile identity, manga ink border, konbini accent palette, and vending-machine affordances.

Do use Japanese labels sparingly and intentionally.

Don't turn the page into a generic anime landing page, neon cyberpunk UI, or soft pastel kawaii layout.

Don't add large explanatory text blocks, oversized hero sections, or decorative elements that compete with Akemi's profile content.
