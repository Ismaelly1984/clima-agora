# Clima Agora

Aplicativo web leve, moderno e responsivo para visualizar o clima atual e previsões usando a API do OpenWeatherMap. Construído 100% com HTML, CSS e JavaScript puro, com suporte PWA (offline básico, instalação em dispositivos) e temas claro/escuro automáticos.

## Sumário
- Visão Geral
- Recursos Principais
- Estrutura do Projeto
- Como Executar Localmente
- Configuração da API
- Funcionamento (Fluxo de Dados)
- UI/UX e Interações
- PWA (Manifest + Service Worker)
- Fundos Dinâmicos
- Histórico e Preferências (localStorage)
- Acessibilidade e Performance
- Tratamento de Erros e Solução de Problemas
- Testes Manuais
- Deploy (GitHub Pages / Vercel)
- Roadmap (Ideias Futuras)

## Visão Geral
O Clima Agora consulta a API do OpenWeatherMap para exibir:
- Clima atual (cidade/país, temperatura, descrição, ícone, umidade, vento).
- Previsão de Hoje (intervalos de 3 horas) com hora, ícone, temperatura, descrição, probabilidade de chuva (pop) e chuva acumulada (mm) por janela.
- Previsão estendida de 5 dias (ícone, dia da semana, mín/máx por dia).

Tudo em uma interface única (SPA), responsiva e com animações suaves. Os últimos acessos e preferências ficam salvos em localStorage.

## Recursos Principais
- Busca por cidade e por geolocalização (quando permitido pelo navegador).
- Tema automático por horário local + alternância manual (Auto ↔ Claro ↔ Escuro).
- Fundos dinâmicos por condição climática (clear, clouds, rain, snow, mist, thunderstorm) com overlay para contraste.
- Histórico das 5 últimas cidades (chips clicáveis).
- Alternância de unidades °C/°F (persistência em localStorage).
- PWA: manifest, service worker com pré‑cache do app shell e aviso simples de nova versão.
- Skeletons de carregamento para clima atual, previsão de hoje e 5 dias.

## Estrutura do Projeto
```
clima-agora/
├─ index.html
├─ style.css
├─ script.js
├─ service-worker.js
├─ manifest.webmanifest
└─ assets/
   ├─ bg/                # fundos dinâmicos (clear, clouds, rain, snow, mist, thunderstorm)
   ├─ icons/             # favicons, PWA icons
   └─ og-image.png       # imagem para social (Open Graph)
```

## Como Executar Localmente
1) Troque a chave da API no arquivo `script.js:12`.
2) Rode um servidor estático para liberar geolocalização e PWA:
   - `python3 -m http.server 5500`
   - Acesse `http://localhost:5500`
3) Faça uma busca (ex.: “São Paulo”). Use “Minha localização” se quiser geolocalização.

Observações
- Para ver mudanças do PWA rapidamente, faça Hard Reload (Ctrl/Cmd+Shift+R).
- Geolocalização exige HTTPS ou localhost.

## Configuração da API
- Defina sua API key no arquivo `script.js:12` (OpenWeatherMap). Exemplo:
  - `const API_KEY = "SUA_CHAVE_AQUI";`
- Endpoints usados:
  - Clima atual: `/data/2.5/weather`
  - Previsão 5 dias + Hoje (3h): `/data/2.5/forecast`
- Parâmetros padrão: `units=metric|imperial` e `lang=pt_br`.

## Funcionamento (Fluxo de Dados)
- Ao iniciar: carrega tema, preferências, histórico e última cidade (se houver).
- Ao buscar cidade ou usar geolocalização:
  1) Busca clima atual (weather)
  2) Renderiza cartão principal + frase simpática
  3) Busca previsão (forecast)
  4) Renderiza “Previsão de Hoje (3h)” e “5 dias”
  5) Atualiza resumo diário de chuva no cartão principal (maior probabilidade e soma de mm)
- Preferências (unidades, tema) e histórico são persistidos em localStorage.

## UI/UX e Interações
- Glassmorphism nos cartões, toasts para feedback e estados online/offline.
- Botões: Buscar, Minha localização, Alternar tema, Alternar °C/°F.
- “Previsão de Hoje (3h)”
  - Cards com hora, ícone, temperatura, descrição.
  - Probabilidade (pop) e chuva (mm/3h). Destaques visuais para alta pop (≥60%) ou chuva > 0.
- “5 dias”
  - Cards com ícone, label do dia (Seg, Ter…), mín/máx.
- Resumo no card principal
  - Chance de chuva (máxima do dia, %) e Chuva (mm hoje, soma). Destaques visuais quando altos.

## PWA (Manifest + Service Worker)
- `manifest.webmanifest`: nome, cores, ícones (PNG/SVG) e display standalone.
- `service-worker.js:9`: controla versão do app cacheado (APP_VERSION) e estratégias de cache.
- Atualizações: mensagem de nova versão disponível via toast.

## Fundos Dinâmicos
- Combina classes CSS por condição e imagens em `assets/bg/`.
- Nomes esperados: `clear.*`, `clouds.*`, `rain.*`, `snow.*`, `mist.*`, `thunderstorm.*`.
- O script tenta extensões na ordem: `.png → .webp → .jpg → .jpeg`.
- Uma camada de overlay ajusta contraste do texto conforme o tema.

## Histórico e Preferências (localStorage)
- `lastCity`: última cidade buscada.
- `cityHistory`: até 5 últimas cidades (chips clicáveis).
- `unitsPref`: `metric` ou `imperial`.
- `themePref`: `auto`, `light` ou `dark`.

## Acessibilidade e Performance
- Labels ocultos para inputs, `aria-live` em áreas dinâmicas.
- Ícones Lucide carregados via CDN.
- Otimize fundos em `assets/bg/` (1600–2000px, ≤300KB). Prefira `.webp` quando possível.
- Skeletons reduzem flicker enquanto dados carregam.

## Tratamento de Erros e Solução de Problemas
- 401 (Unauthorized): verifique ativação da chave, propagação (até 2h) e se a chave está correta.
- 404 (cidade): nome incorreto. Ajuste e tente novamente.
- Offline: toasts de aviso e fallback de cache (quando possível) pelo SW.
- Geolocalização negada: permita na UI do navegador, use HTTPS/localhost.
- Cache travado (PWA): Hard Reload (Ctrl/Cmd+Shift+R) ou limpe o site em DevTools > Application.
- Fundos 404: garanta o arquivo com o nome esperado. O código tenta várias extensões.

## Testes Manuais
- Cidades: São Paulo, Rio de Janeiro, Lisboa, New York.
- Responsividade: 360px (mobile) e 1440px (desktop).
- Hoje (3h): ver probabilidade e chuva (mm/3h) por card; destaque visual quando pop≥60% ou mm>0.
- 5 dias: conferir mín/máx e ícones.
- Alternância °C/°F: verifica exibição e recálculo de vento (km/h vs mph).
- PWA: instalar app, uso offline básico (shell) e atualização de versão (toast).

## Deploy
### GitHub Pages
- Suba os arquivos para o repositório e habilite Pages (branch `main`/root).
- Atualize a URL no JSON-LD do `index.html` se desejar.

### Vercel
- Novo projeto → importe o repositório → Framework Preset: `Other`.
- Build/Output: estático (sem build). Deploy direto dos arquivos.

## Roadmap (Ideias Futuras)
- Destaque do “próximo horário” na previsão de hoje e scroll automático até ele.
- Internacionalização de UI.
- Modo “economia de dados” (sem fundos fotográficos).

## Pontos de Entrada do Código
- API Key: `script.js:12`
- Versão do SW e precache: `service-worker.js:9`
- Seções dinâmicas (criação e render): `script.js` (setupDynamicSections, renderTodayForecast, renderForecast)

---
Observação: chaves de API em apps puramente front‑end ficam expostas. Para produção, considere um proxy ou backend simples para proteger a key.

