# Revier Business Intelligence Skill

## Description
Este skill fornece contexto de negócio, tabelas de preços e diretrizes de produtos da Revier Brokers, extraídos da pasta local `F:\Solara\Revier`. Ele deve ser usado por todos os agentes para garantir que o desenvolvimento do portal Revier Academy esteja alinhado com a realidade dos produtos (Amil, MedSenior, Porto, Petlove).

## Contexto de Negócio
- **Broker**: Revier Brokers (Especialista em Seguros e Planos Dentais).
- **Portal**: Revier Academy ("Treino que Vende").
- **Produtos**: DF (Indiv/Fam), PME (Empresarial), Premium (Exclusivo).

## Diretrizes de Uso
- Siga as regras detalhadas em `f:\Solara\coding\revier-products\REVIER_CONTEXT.md`.
- Para tabelas de preços vigentes, consulte arquivos em `F:\Solara\Revier\tuto`.
- **FALLBACK INTERNET**: Em caso de dados ausentes ou de 2024/2025 (e o ano atual for 2026), busque ativamente na web por atualizações oficiais das operadoras.
- Mantenha a identidade visual (Cores: Laranja #E8510A, Azul #1A3EC8, Dark #0A0C12).

## Fonte de Verdade (Single Source of Truth)
O diretório `F:\Solara\Revier` é dinâmico e contém materiais atualizados por humanos. Sempre valide se há novos arquivos lá antes de sugerir mudanças no conteúdo do site.
