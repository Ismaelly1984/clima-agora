# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

## v2.3.0 — CSS crítico, WebP, minificação e PWA aprimorado
- Injeta CSS crítico mais completo (inclui a primeira dobra do cartão de clima) para reduzir LCP.
- Adia a folha principal (`style.min.css`) via preload + onload sem bloquear render.
- Converte fundos para WebP ≤ 300KB e prioriza WebP no loader.
- Minifica CSS/JS (`style.min.css`, `script.min.js`) e atualiza referências no HTML/SW.
- Carrega previsões (5d e hoje 3h) em idle com atraso adaptativo por rede (Network Information API).
- Ativa navigation preload no Service Worker e melhora fallback de navegação offline.
- Adiciona CTA “Instalar” (PWA) e mantém banner de atualização.
- Acessibilidade: skip link, `aria-busy` no main, `prefers-reduced-motion`, `content-visibility`.
- Responsividade: tipografia e espaçamentos com `clamp`, `scroll-snap` em carrosséis, targets de toque em mobile.
- Contraste alto opcional: `prefers-contrast: more` com bordas/fundos/overlay mais fortes.

## v2.2.0 — Ícones
- Remove runtime de ícones (Lucide) e substitui por sprite SVG inline.
- Ajusta script/CSS para usar `<use href="#...">` e mantêm o visual.

## v2.1.0 — SEO/PWA/Perf/A11y
- OG/Twitter, canonical, JSON-LD com autor/offer/SearchAction.
- Banner de atualização (skipWaiting/controllerchange) e metas Apple display‑mode.
- Preload/swap de fontes e lazy das imagens secundárias.
- Alt dinâmico do ícone do clima.

## v2.0.0 — Funcionalidades
- Clima atual, previsão de hoje (3h em 3h) e 5 dias.
- Probabilidade de chuva (pop) e mm/3h por card; destaques rainy/likely.
- Histórico de cidades, tema auto e alternância °C/°F.
- Fundos dinâmicos e PWA básico.
