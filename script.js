/*
  Clima Agora - JavaScript
  - Busca clima via OpenWeatherMap
  - Salva última cidade (localStorage)
  - Modo escuro/claro com alternância automática
  - Atualiza fundo conforme o clima
  - Tratamento de erros e estado offline
*/

// Proxy Serverless para ocultar a API key (backend expõe /api/*)
const USE_PROXY = true;
const API_BASE = "/api/weather";
const FORECAST_BASE = "/api/forecast";
const POP_HIGHLIGHT = 60; // limiar (%) para destaque
const RAIN_MM_HIGHLIGHT = 5; // limiar (mm) para destaque de chuva

// Seletores
const el = {
  body: document.body,
  main: document.getElementById("main"),
  cityInput: document.getElementById("cityInput"),
  searchBtn: document.getElementById("searchBtn"),
  geoBtn: document.getElementById("geoBtn"),
  unitToggle: document.getElementById("unitToggle"),
  installBtn: document.getElementById("installBtn"),
  statusMsg: document.getElementById("statusMsg"),
  weatherCard: document.getElementById("weatherCard"),
  cityName: document.getElementById("cityName"),
  country: document.getElementById("country"),
  weatherIcon: document.getElementById("weatherIcon"),
  description: document.getElementById("description"),
  temp: document.getElementById("temp"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  toast: document.getElementById("toast"),
  themeToggle: document.getElementById("themeToggle"),
  // elementos criados dinamicamente
  forecastSection: null,
  forecastRow: null,
  historyList: null,
  moodLine: null,
  // previsão de hoje (3h)
  todaySection: null,
  todayRow: null,
  todayEmpty: null,
  todayNoRain: null,
  // Resumo no cartão principal
  popSummaryVal: null,
  rainSummaryVal: null,
  popSummaryBox: null,
  rainSummaryBox: null,
};

// Utils
const kmh = (ms) => (ms * 3.6);
const mph = (mphVal) => mphVal; // já em mph quando units=imperial
const capitalize = (s) => s ? (s[0].toUpperCase() + s.slice(1)) : s;
// agenda execução em idle (com fallback)
function getIdleTimeout() {
  try {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) {
      if (c.saveData) return 1500;
      const t = String(c.effectiveType || '').toLowerCase();
      if (t.includes('2g') || t.includes('slow')) return 1500;
      if (t.includes('3g')) return 900;
    }
  } catch {}
  return 300;
}
function inIdle(fn, timeout = getIdleTimeout()) {
  if ('requestIdleCallback' in window) return requestIdleCallback(fn, { timeout });
  return setTimeout(fn, Math.min(timeout, 300));
}

// Tema: auto / light / dark
function setTheme(mode = "auto") {
  // Remove classes anteriores
  el.body.classList.remove("theme-light");
  el.body.classList.remove("theme-auto");

  if (mode === "auto") {
    el.body.classList.add("theme-auto");
    // Dia 06:00 - 18:00 (horário local do usuário)
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 18;
    if (isDay) el.body.classList.add("theme-light");
  } else if (mode === "light") {
    el.body.classList.add("theme-light");
  } else {
    // dark -> sem class 'theme-light' (tema base é escuro)
  }

  localStorage.setItem("themePref", mode);
  updateThemeToggleIcon(mode);
}

function updateThemeToggleIcon(mode) {
  // Mostra ícone correspondente ao modo atual
  let icon = "moon"; // se claro, exibir lua
  if (mode === "auto") {
    icon = "moon"; // mantém lua como padrão para auto
  } else if (mode === "dark") {
    icon = "sun"; // no escuro, oferecer sol (trocar p/ claro)
  } else if (mode === "light") {
    icon = "moon"; // no claro, oferecer lua (trocar p/ escuro)
  }
  el.themeToggle.innerHTML = svgIcon(icon);
}

function cycleTheme() {
  const current = localStorage.getItem("themePref") || "auto";
  const next = current === "auto" ? "light" : current === "light" ? "dark" : "auto";
  setTheme(next);
}

// Retorna SVG inline usando o sprite (icons definidos em index.html)
function svgIcon(name, size = 20, extraClass = "") {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><use href="#i-${name}"/></svg>`;
}

// Unidades: metric (°C, m/s) → exibimos km/h; imperial (°F, mph)
function getUnits() {
  const u = (localStorage.getItem('unitsPref') || 'metric').toLowerCase();
  return u === 'imperial' ? 'imperial' : 'metric';
}
function setUnits(un) {
  localStorage.setItem('unitsPref', un);
  updateUnitToggleUI();
}
function toggleUnits() {
  const next = getUnits() === 'metric' ? 'imperial' : 'metric';
  setUnits(next);
  // Recarrega dados da última cidade
  const last = localStorage.getItem('lastCity');
  if (last) fetchWeatherByCity(last);
}
function updateUnitToggleUI() {
  const u = getUnits();
  if (el.unitToggle) el.unitToggle.textContent = u === 'metric' ? '°C / °F' : '°F / °C';
}

// Toast simples
let toastTimer;
function showToast(msg, type = "info", timeout = 2400) {
  el.toast.textContent = msg;
  el.toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.remove("show");
  }, timeout);
}

// Banner de atualização do PWA (mostra e permite aplicar nova versão)
window.showUpdateBanner = window.showUpdateBanner || function showUpdateBanner() {
  const banner = document.getElementById('updateBanner');
  if (!banner) return;
  banner.classList.remove('hidden');
  const btn = document.getElementById('reloadBtn');
  if (!btn || !('serviceWorker' in navigator)) return;
  btn.onclick = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage('SKIP_WAITING');
      } else if (reg?.active) {
        reg.active.postMessage('SKIP_WAITING');
      }
    } catch {}
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  };
};

function setLoading(loading) {
  if (loading) {
    el.searchBtn.disabled = true;
    el.searchBtn.style.opacity = 0.75;
    el.statusMsg.textContent = "Carregando...";
    if (el.main) el.main.setAttribute('aria-busy', 'true');
  } else {
    el.searchBtn.disabled = false;
    el.searchBtn.style.opacity = 1;
    if (el.main) el.main.removeAttribute('aria-busy');
  }
}

// Skeleton: aplica/remover placeholders enquanto carrega
function startSkeleton() {
  el.weatherCard.classList.remove('hidden');
  el.weatherCard.classList.add('visible');
  [el.cityName, el.country, el.description, el.temp, el.humidity, el.wind].forEach(n => n && n.classList.add('skel', 'skel-line-md'));
  if (el.weatherIcon) el.weatherIcon.classList.add('skel', 'skel-square');
}
function stopSkeleton() {
  [el.cityName, el.country, el.description, el.temp, el.humidity, el.wind].forEach(n => n && n.classList.remove('skel', 'skel-line-md'));
  if (el.weatherIcon) el.weatherIcon.classList.remove('skel', 'skel-square');
}

// Cria seções dinamicas: frase (mood), previsao 5 dias e historico
function setupDynamicSections() {
  // Frase abaixo do nome da cidade
  if (!el.moodLine) {
    const place = document.querySelector('#weatherCard .place');
    if (place) {
      const p = document.createElement('p');
      p.id = 'moodLine';
      p.className = 'mood muted';
      place.appendChild(p);
      el.moodLine = p;
    }
  }
  // Secao de previsao (5 dias)
  if (!el.forecastSection) {
    const section = document.createElement('section');
    section.id = 'forecastSection';
    section.className = 'forecast-section glass hidden';
    section.innerHTML = `
      <div class="forecast-header">
        <h3 class="forecast-title">Próximos dias</h3>
      </div>
      <div id="forecastRow" class="forecast-row" aria-live="polite"></div>
    `;
    const weatherCard = el.weatherCard;
    if (weatherCard && weatherCard.parentElement) {
      weatherCard.insertAdjacentElement('afterend', section);
      el.forecastSection = section;
      el.forecastRow = section.querySelector('#forecastRow');
    }
  }
  // Seção de Previsão de Hoje (3h em 3h)
  if (!el.todaySection) {
    const section = document.createElement('section');
    section.id = 'todaySection';
    section.className = 'today-section glass hidden';
    section.innerHTML = `
      <div class="forecast-header">
        <h3 class="forecast-title">Previsão de Hoje (3h em 3h)</h3>
      </div>
      <div id="todayRow" class="today-row" aria-live="polite"></div>
      <p id="todayEmpty" class="muted hidden">Sem dados para hoje</p>
      <p id="todayNoRain" class="muted hidden">Sem dados de chuva</p>
    `;
    const container = document.querySelector('.container');
    const anchor = el.forecastSection || el.weatherCard;
    if (container && anchor) {
      anchor.insertAdjacentElement('afterend', section);
      el.todaySection = section;
      el.todayRow = section.querySelector('#todayRow');
      el.todayEmpty = section.querySelector('#todayEmpty');
      el.todayNoRain = section.querySelector('#todayNoRain');
    }
  }
  // Historico de cidades
  if (!el.historyList) {
    const sc = document.querySelector('.search-card');
    if (sc) {
      const history = document.createElement('div');
      history.id = 'historyList';
      history.className = 'history hidden';
      sc.appendChild(history);
      el.historyList = history;
      el.historyList.addEventListener('click', (e) => {
        const target = e.target.closest('.chip');
        if (target) {
          const city = target.getAttribute('data-city');
          if (city) fetchWeatherByCity(city);
        }
      });
    }
  }

  // Métricas de chuva no cartão principal (chance e mm do dia)
  ensureRainSummaryMetrics();
}

// Cria/garante métricas de chuva no cartão principal
function ensureRainSummaryMetrics() {
  const extra = document.querySelector('.weather-extra');
  if (!extra) return;
  // Chance de chuva (hoje)
  if (!el.popSummaryVal) {
    const metr = document.createElement('div');
    metr.className = 'metric';
    metr.innerHTML = `
      ${svgIcon('umbrella', 22)}
      <div>
        <span class="label">Chance de chuva</span>
        <span id="popSummaryVal" class="value">—</span>
      </div>
    `;
    extra.appendChild(metr);
    el.popSummaryVal = metr.querySelector('#popSummaryVal');
    el.popSummaryBox = metr;
  }
  // Chuva (mm hoje)
  if (!el.rainSummaryVal) {
    const metr = document.createElement('div');
    metr.className = 'metric';
    metr.innerHTML = `
      ${svgIcon('cloud-rain', 22)}
      <div>
        <span class="label">Chuva (mm hoje)</span>
        <span id="rainSummaryVal" class="value">—</span>
      </div>
    `;
    extra.appendChild(metr);
    el.rainSummaryVal = metr.querySelector('#rainSummaryVal');
    el.rainSummaryBox = metr;
  }
  if (window.lucide) lucide.createIcons();
}

function clearWeatherCard() {
  if (el.cityName) el.cityName.textContent = "";
  if (el.country) el.country.textContent = "";
  if (el.description) el.description.textContent = "";
  if (el.temp) el.temp.textContent = "";
  if (el.humidity) el.humidity.textContent = "";
  if (el.wind) el.wind.textContent = "";
  if (el.weatherIcon) { el.weatherIcon.src = ""; el.weatherIcon.alt = ""; }
  if (el.weatherCard) { el.weatherCard.classList.add("hidden"); el.weatherCard.classList.remove("visible"); }
  if (el.popSummaryVal) el.popSummaryVal.textContent = '—';
  if (el.rainSummaryVal) el.rainSummaryVal.textContent = '—';
  if (el.popSummaryBox) el.popSummaryBox.classList.remove('rainy','likely');
  if (el.rainSummaryBox) el.rainSummaryBox.classList.remove('rainy','likely');
}

function showWeatherCard() {
  el.weatherCard.classList.remove("hidden");
  requestAnimationFrame(() => {
    el.weatherCard.classList.add("visible");
  });
}

function removeAllBgClasses() {
  const bgClasses = ["bg-clear", "bg-clouds", "bg-rain", "bg-snow", "bg-thunder", "bg-mist"];
  bgClasses.forEach((c) => el.body.classList.remove(c));
}

function setBackgroundByWeather(main, iconCode) {
  removeAllBgClasses();
  const m = (main || "").toLowerCase();
  if (m.includes("thunder")) return el.body.classList.add("bg-thunder");
  if (m.includes("drizzle") || m.includes("rain")) return el.body.classList.add("bg-rain");
  if (m.includes("snow")) return el.body.classList.add("bg-snow");
  if (m.includes("mist") || m.includes("fog") || m.includes("haze") || m.includes("smoke")) return el.body.classList.add("bg-mist");
  if (m.includes("cloud")) return el.body.classList.add("bg-clouds");
  // Clear
  el.body.classList.add("bg-clear");
}

// Fundo dinâmico por imagem (assets/bg/<condicao>.jpg)
function getBgKey(main) {
  const m = (main || "").toLowerCase();
  if (m.includes("drizzle") || m.includes("rain")) return "rain";
  if (m.includes("thunder")) return "thunderstorm";
  if (m.includes("snow")) return "snow";
  if (m.includes("mist") || m.includes("fog") || m.includes("haze") || m.includes("smoke")) return "mist";
  if (m.includes("cloud")) return "clouds";
  return "clear";
}

async function setDynamicBackgroundImage(main) {
  const key = getBgKey(main);
  const candidates = [
    `assets/bg/${key}.webp`,
    `assets/bg/${key}.png`,
    `assets/bg/${key}.jpg`,
    `assets/bg/${key}.jpeg`,
  ];

  function load(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  let chosen = null;
  for (const src of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await load(src);
    if (ok) { chosen = ok; break; }
  }

  if (chosen) {
    // Gradiente no topo para contraste + imagem de fundo
    document.body.style.backgroundImage = `linear-gradient(0deg, var(--image-overlay), var(--image-overlay)), url('${chosen}')`;
    document.body.style.backgroundAttachment = 'fixed, fixed';
    document.body.style.backgroundSize = 'cover, cover';
    document.body.style.backgroundPosition = 'center, center';
  } else {
    document.body.style.backgroundImage = '';
  }
}

// Frases dinamicas de clima
function getMoodPhrase(main, temp, units) {
  const m = (main || '').toLowerCase();
  const t = typeof temp === 'number' ? temp : null;
  const hot = units === 'imperial' ? (t !== null && t >= 86) : (t !== null && t >= 30);
  const cold = units === 'imperial' ? (t !== null && t <= 50) : (t !== null && t <= 10);
  if (m.includes('thunder')) return 'Tempestade chegando — fique em local seguro ⚡';
  if (m.includes('drizzle') || m.includes('rain')) return 'Vai chover! Pegue o guarda-chuva ☔';
  if (m.includes('snow')) return 'Neve à vista — agasalhe-se bem ❄️';
  if (m.includes('mist') || m.includes('fog') || m.includes('haze')) return 'Neblina à vista — dirija com cuidado 🌫️';
  if (m.includes('cloud')) return 'Nuvens pelo céu — clima ameno ⛅';
  if (m.includes('clear')) {
    if (hot) return 'Sol forte — beba água e use protetor ☀️';
    if (cold) return 'Céu limpo e frio — cachecol cai bem 🧣';
    return 'Céu limpo — um ótimo dia para sair! ☀️';
  }
  return 'Tempo variado — aproveite com moderação 🌤️';
}

function renderMood(main, temp) {
  if (!el.moodLine) return;
  const phrase = getMoodPhrase(main, temp, getUnits());
  el.moodLine.textContent = phrase;
  el.moodLine.classList.remove('fade-in');
  void el.moodLine.offsetWidth; // reflow
  el.moodLine.classList.add('fade-in');
}

function updateUI(data) {
  const city = data.name;
  const country = data.sys?.country || "";
  const { temp, humidity } = data.main || {};
  const windMs = data.wind?.speed ?? 0;
  const w = data.weather?.[0] || {};

  el.cityName.textContent = city || "—";
  el.country.textContent = country || "—";
  el.description.textContent = capitalize(w.description || "—");
  const units = getUnits();
  const tempUnit = units === 'imperial' ? '°F' : '°C';
  el.temp.textContent = typeof temp === "number" ? `${temp.toFixed(1)}${tempUnit}` : "—";
  el.humidity.textContent = typeof humidity === "number" ? `${humidity}%` : "—";
  if (units === 'imperial') {
    // OpenWeather retorna mph em imperial
    el.wind.textContent = `${mph(data.wind?.speed ?? 0).toFixed(0)} mph`;
  } else {
    el.wind.textContent = `${kmh(windMs).toFixed(0)} km/h`;
  }

  // Ícone do OpenWeather
  if (w.icon) {
    const url = `https://openweathermap.org/img/wn/${w.icon}@4x.png`;
    el.weatherIcon.src = url;
    const descText = capitalize(w.description || "");
    el.weatherIcon.alt = descText ? `Condição do tempo: ${descText}` : "Condição do tempo";
  } else {
    el.weatherIcon.src = "";
    el.weatherIcon.alt = "";
  }

  // Fundo
  setBackgroundByWeather(w.main || "", w.icon || "");
  // Fundo por imagem (se existir em assets/bg). Ex.: clear.jpg, rain.jpg, clouds.jpg
  setDynamicBackgroundImage(w.main || "");

  // Exibir cartao e frase simpatica
  showWeatherCard();
  stopSkeleton();
  renderMood(w.main || '', temp);
}

async function fetchWeatherByCity(city) {
  // Nenhuma API key no cliente: uso obrigatório do proxy
  const q = city?.trim();
  if (!q) {
    showToast("Digite o nome de uma cidade.", "info");
    return;
  }
  if (!navigator.onLine) {
    showToast("Sem conexão. Verifique sua internet.", "error");
    return;
  }

  try {
    setLoading(true);
    startSkeleton();
    startTodaySkeleton();
    const url = `${API_BASE}?q=${encodeURIComponent(q)}&units=${getUnits()}&lang=pt_br`;
    const res = await fetch(url);
    if (!res.ok) {
      let msg = "Erro ao buscar dados.";
      try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
      if (res.status === 401) msg = "API key inválida ou não ativada. Verifique sua conta no OpenWeather.";
      if (res.status === 404) msg = "Cidade não encontrada.";
      throw new Error(msg);
    }
    const data = await res.json();
    updateUI(data);
    el.statusMsg.textContent = `${data.name}, ${data.sys?.country || ""}`;
    localStorage.setItem("lastCity", data.name);
    addCityToHistory(data.name);
    // previsões em idle para reduzir LCP/TBT
    inIdle(() => fetchForecastByCity(data.name));
  } catch (err) {
    clearWeatherCard();
    el.statusMsg.textContent = err.message || "Erro ao buscar dados.";
    showToast(el.statusMsg.textContent, "error", 3200);
  } finally {
    setLoading(false);
    stopSkeleton();
  }
}

async function fetchWeatherByCoords(lat, lon) {
  // Nenhuma API key no cliente: uso obrigatório do proxy
  if (!navigator.onLine) {
    showToast("Sem conexão. Verifique sua internet.", "error");
    return;
  }
  try {
    setLoading(true);
    startSkeleton();
    startTodaySkeleton();
    const url = `${API_BASE}?lat=${lat}&lon=${lon}&units=${getUnits()}&lang=pt_br`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erro ao buscar localização atual.");
    const data = await res.json();
    updateUI(data);
    el.statusMsg.textContent = `${data.name}, ${data.sys?.country || ""}`;
    localStorage.setItem("lastCity", data.name);
    addCityToHistory(data.name);
    // previsões em idle para reduzir LCP/TBT
    inIdle(() => fetchForecastByCoords(lat, lon));
  } catch (err) {
    clearWeatherCard();
    el.statusMsg.textContent = err.message || "Erro na geolocalização.";
    showToast(el.statusMsg.textContent, "error", 3200);
  } finally {
    setLoading(false);
    stopSkeleton();
  }
}

// ---- Previsao de 5 dias ----
function toLocalDate(dtSec, tzOffsetSec) {
  return new Date((dtSec + (tzOffsetSec || 0)) * 1000);
}
function pad(n) { return n.toString().padStart(2, '0'); }
function dateKeyISO(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function weekdayPT(d) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days[d.getUTCDay()];
}
function pickIconForDay(items) {
  const noon = items.find(i => (i.dt_txt || '').includes('12:00:00'));
  return (noon || items[Math.floor(items.length / 2)] || items[0]).weather?.[0]?.icon || '01d';
}
function groupForecast(data) {
  const tz = data.city?.timezone || 0;
  const map = new Map();
  for (const item of data.list || []) {
    const d = toLocalDate(item.dt, tz);
    const key = dateKeyISO(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  const days = [];
  for (const [key, items] of map) {
    let min = Infinity, max = -Infinity;
    items.forEach(it => {
      if (typeof it.main?.temp_min === 'number') min = Math.min(min, it.main.temp_min);
      if (typeof it.main?.temp_max === 'number') max = Math.max(max, it.main.temp_max);
    });
    const icon = pickIconForDay(items);
    const d = toLocalDate(items[0].dt, tz);
    days.push({ key, date: d, min, max, icon });
  }
  days.sort((a, b) => a.date - b.date);
  return days.slice(0, 5);
}
function startForecastSkeleton() {
  if (!el.forecastSection || !el.forecastRow) return;
  el.forecastSection.classList.remove('hidden');
  el.forecastRow.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const c = document.createElement('div');
    c.className = 'forecast-card';
    c.innerHTML = `
      <div class="skel skel-square" style="width:56px;height:56px;margin:0 auto;border-radius:12px"></div>
      <div class="skel skel-line-sm" style="width:60%;height:14px;margin:10px auto 6px"></div>
      <div class="skel skel-line-sm" style="width:70%;height:14px;margin:0 auto"></div>
    `;
    el.forecastRow.appendChild(c);
  }
}
function renderForecast(data) {
  if (!el.forecastSection || !el.forecastRow) return;
  const units = getUnits();
  const tUnit = units === 'imperial' ? '°F' : '°C';
  try {
    const days = groupForecast(data);
    el.forecastRow.innerHTML = '';
    days.forEach(d => {
      const card = document.createElement('div');
      card.className = 'forecast-card';
      const iconUrl = `https://openweathermap.org/img/wn/${d.icon}@2x.png`;
      const label = weekdayPT(d.date);
      // imagem
      const img = new Image();
      img.src = iconUrl;
      img.className = 'f-icon';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 56; img.height = 56;
      // dia
      const dayDiv = document.createElement('div');
      dayDiv.className = 'f-day';
      dayDiv.textContent = label;
      // temperaturas
      const temps = document.createElement('div');
      temps.className = 'f-temps';
      const minSpan = document.createElement('span');
      minSpan.className = 'min';
      minSpan.textContent = `${Math.round(d.min)}${tUnit}`;
      const sep = document.createTextNode(' · ');
      const maxSpan = document.createElement('span');
      maxSpan.className = 'max';
      maxSpan.textContent = `${Math.round(d.max)}${tUnit}`;
      temps.append(minSpan, sep, maxSpan);
      card.replaceChildren(img, dayDiv, temps);
      el.forecastRow.appendChild(card);
    });
    el.forecastSection.classList.remove('hidden');
  } catch (e) {
    el.forecastSection.classList.add('hidden');
  }
}
async function fetchForecastByCity(city) {
  // Proxy obrigatório no cliente
  if (!city) return;
  try {
    startForecastSkeleton();
    const url = `${FORECAST_BASE}?q=${encodeURIComponent(city)}&units=${getUnits()}&lang=pt_br`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao buscar previsao');
    const data = await res.json();
    renderForecast(data);
    renderTodayForecast(data);
    renderTodayRainSummary(data);
  } catch (e) {
    el.forecastSection?.classList.add('hidden');
    try { showToast('Nao foi possivel obter a previsao estendida.', 'info', 2200); } catch {}
  }
}
async function fetchForecastByCoords(lat, lon) {
  // Proxy obrigatório no cliente
  try {
    startForecastSkeleton();
    const url = `${FORECAST_BASE}?lat=${lat}&lon=${lon}&units=${getUnits()}&lang=pt_br`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao buscar previsao');
    const data = await res.json();
    renderForecast(data);
    renderTodayForecast(data);
    renderTodayRainSummary(data);
  } catch (e) {
    el.forecastSection?.classList.add('hidden');
    try { showToast('Nao foi possivel obter a previsao estendida.', 'info', 2200); } catch {}
  }
}

// Resumo diário no cartão principal: maior probabilidade e soma de chuva do dia
function renderTodayRainSummary(data) {
  ensureRainSummaryMetrics();
  const tz = data.city?.timezone || 0;
  const nowCity = new Date(Date.now() + tz * 1000);
  const todayKey = dateKeyISO(nowCity);
  const list = data.list || [];
  const todayItems = list.filter(it => dateKeyISO(toLocalDate(it.dt, tz)) === todayKey);

  if (!todayItems.length) {
    if (el.popSummaryVal) el.popSummaryVal.textContent = '—';
    if (el.rainSummaryVal) el.rainSummaryVal.textContent = '—';
    return;
  }

  let popMax = 0;
  let rainSum = 0;
  for (const it of todayItems) {
    if (typeof it.pop === 'number') popMax = Math.max(popMax, it.pop);
    const mm = (it.rain && typeof it.rain['3h'] === 'number') ? it.rain['3h'] : 0;
    rainSum += mm;
  }
  const popPct = Math.round(popMax * 100);
  if (el.popSummaryVal) el.popSummaryVal.textContent = `${popPct}%`;
  if (el.rainSummaryVal) el.rainSummaryVal.textContent = `${rainSum.toFixed(1)} mm`;

  // Destaques visuais no cartão principal
  if (el.popSummaryBox) {
    el.popSummaryBox.classList.remove('rainy','likely');
    if (popPct >= POP_HIGHLIGHT) el.popSummaryBox.classList.add('likely');
  }
  if (el.rainSummaryBox) {
    el.rainSummaryBox.classList.remove('rainy','likely');
    if (rainSum >= RAIN_MM_HIGHLIGHT) el.rainSummaryBox.classList.add('rainy');
  }
}

// --------- Previsão de Hoje (3h em 3h) ---------
function startTodaySkeleton() {
  if (!el.todaySection || !el.todayRow) return;
  el.todaySection.classList.remove('hidden');
  el.todayEmpty?.classList.add('hidden');
  el.todayRow.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('div');
    c.className = 'forecast-card';
    c.innerHTML = `
      <div class="skel skel-line-sm" style="width:60%;height:14px;margin:0 auto 10px"></div>
      <div class="skel skel-square" style="width:48px;height:48px;margin:0 auto;border-radius:12px"></div>
      <div class="skel skel-line-sm" style="width:70%;height:14px;margin:10px auto 6px"></div>
      <div class="skel skel-line-sm" style="width:80%;height:14px;margin:0 auto"></div>
    `;
    el.todayRow.appendChild(c);
  }
}

function renderTodayForecast(data) {
  if (!el.todaySection || !el.todayRow) return;
  const tz = data.city?.timezone || 0;
  const nowCity = new Date(Date.now() + tz * 1000);
  const todayKey = dateKeyISO(nowCity);
  const list = data.list || [];
  const todayItems = list.filter(it => dateKeyISO(toLocalDate(it.dt, tz)) === todayKey);

  el.todayRow.innerHTML = '';
  if (!todayItems.length) {
    el.todayEmpty?.classList.remove('hidden');
    el.todaySection.classList.remove('hidden');
    return;
  }
  el.todayEmpty?.classList.add('hidden');

  const units = getUnits();
  const tUnit = units === 'imperial' ? '°F' : '°C';
  let hasRainData = false;
  todayItems.forEach(it => {
    const d = toLocalDate(it.dt, tz);
    const hh = pad(d.getUTCHours());
    const icon = it.weather?.[0]?.icon || '01d';
    const desc = it.weather?.[0]?.description || '';
    const t = typeof it.main?.temp === 'number' ? `${Math.round(it.main.temp)}${tUnit}` : '—';
    const popPct = typeof it.pop === 'number' ? Math.round(it.pop * 100) : 0;
    const rainMm = (it.rain && typeof it.rain['3h'] === 'number') ? it.rain['3h'] : 0;
    if (popPct > 0 || rainMm > 0) hasRainData = true;
    const card = document.createElement('div');
    const highPop = popPct >= POP_HIGHLIGHT; // destaque quando probabilidade for alta
    let cClass = 'forecast-card today-card';
    if (rainMm > 0) cClass += ' rainy';
    else if (highPop) cClass += ' likely';
    card.className = cClass;
    // hora
    const timeDiv = document.createElement('div');
    timeDiv.className = 'forecast-time';
    timeDiv.textContent = `${hh}:00`;
    // imagem
    const img = new Image();
    img.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
    img.className = 'f-icon';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 48; img.height = 48;
    // temp/desc/pop/rain
    const tempDiv = document.createElement('div'); tempDiv.className = 'forecast-temp'; tempDiv.textContent = t;
    const descDiv = document.createElement('div'); descDiv.className = 'forecast-desc'; descDiv.textContent = capitalize(desc);
    const popDiv = document.createElement('div'); popDiv.className = 'forecast-pop'; popDiv.textContent = `🌧️ ${popPct}% de chance`;
    const parts = [timeDiv, img, tempDiv, descDiv, popDiv];
    if (rainMm > 0) { const rainDiv = document.createElement('div'); rainDiv.className = 'forecast-rain'; rainDiv.textContent = `💧 ${rainMm.toFixed(1)} mm`; parts.push(rainDiv); }
    card.replaceChildren(...parts);
    el.todayRow.appendChild(card);
  });
  el.todaySection.classList.remove('hidden');
  // Se nenhum card tiver pop>0 nem rain>0, exibe aviso
  if (el.todayNoRain) {
    if (!hasRainData) el.todayNoRain.classList.remove('hidden');
    else el.todayNoRain.classList.add('hidden');
  }
}

// ---- Historico de cidades ----
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('cityHistory') || '[]'); } catch { return []; }
}
function saveHistory(arr) { localStorage.setItem('cityHistory', JSON.stringify(arr)); }
function addCityToHistory(city) {
  if (!city) return;
  const cur = loadHistory();
  const next = [city, ...cur.filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, 5);
  saveHistory(next);
  renderHistory();
}
function renderHistory() {
  if (!el.historyList) return;
  const list = loadHistory();
  if (!list.length) { el.historyList.classList.add('hidden'); el.historyList.innerHTML = ''; return; }
  el.historyList.classList.remove('hidden');
  // Renderização segura (sem innerHTML) para evitar XSS
  const frag = document.createDocumentFragment();
  list.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('data-city', c);
    b.title = c;
    b.textContent = c;
    frag.appendChild(b);
  });
  el.historyList.innerHTML = '';
  el.historyList.appendChild(frag);
}
// Eventos
function wireEvents() {
  if (el.searchBtn && el.cityInput) {
    el.searchBtn.addEventListener("click", () => fetchWeatherByCity(el.cityInput.value));
    el.cityInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fetchWeatherByCity(el.cityInput.value);
    });
  }

  if (el.geoBtn) el.geoBtn.addEventListener("click", async () => {
    if (!navigator.geolocation) {
      showToast("Geolocalização não suportada.", "error");
      return;
    }

    // Verifica permissão (quando suportado)
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          showToast("Permissão de localização negada no navegador.", "error");
          return;
        }
      }
    } catch (_) { /* ignora indisponibilidade da API */ }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fetchWeatherByCoords(latitude, longitude);
      },
      (err) => {
        if (err && err.code === 1) { // PERMISSION_DENIED
          showToast("Permissão de localização negada.", "error");
        } else if (err && err.code === 2) { // POSITION_UNAVAILABLE
          showToast("Localização indisponível.", "error");
        } else if (err && err.code === 3) { // TIMEOUT
          showToast("Tempo esgotado ao obter localização.", "error");
        } else {
          showToast("Não foi possível acessar a localização.", "error");
        }
        // Evita logar erro no console para reduzir ruído
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });

  // Tema
  if (el.themeToggle) el.themeToggle.addEventListener("click", cycleTheme);
  if (el.unitToggle) {
    el.unitToggle.addEventListener('click', toggleUnits);
  }

  // PWA install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (el.installBtn) el.installBtn.classList.remove('hidden');
  });
  if (el.installBtn) {
    el.installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch {}
      deferredPrompt = null;
      el.installBtn.classList.add('hidden');
    });
  }
  window.addEventListener('appinstalled', () => {
    if (el.installBtn) el.installBtn.classList.add('hidden');
  });

  // Online/Offline
  window.addEventListener("offline", () => showToast("Você está offline.", "error", 2500));
  window.addEventListener("online", () => showToast("Conexão restabelecida.", "info", 1800));
}

function initTheme() {
  const pref = localStorage.getItem("themePref") || "auto";
  setTheme(pref);
}

function initApp() {
  initTheme();
  setupDynamicSections();
  renderHistory();
  updateUnitToggleUI();
  wireEvents();
  // Registro do Service Worker (sem inline script, compatível com CSP)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((reg) => {
          if (reg.waiting) {
            try { if (window.showToast) showToast('Nova versão disponível. Recarregue a página.', 'info', 4000); } catch {}
            try { if (window.showUpdateBanner) showUpdateBanner(); } catch {}
          }
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                try { if (window.showToast) showToast('Nova versão instalada. Recarregue.', 'info', 4000); } catch {}
                try { if (window.showUpdateBanner) showUpdateBanner(); } catch {}
              }
            });
          });
        })
        .catch(err => console.warn('SW falhou ao registrar:', err));
    });
  }
  const hasSearchUI = !!el.cityInput && !!el.weatherCard && !!el.searchBtn;
  // Permite deep-link via hash: index.html#q=São%20Paulo
  const hash = (typeof location !== 'undefined' && location.hash) ? new URLSearchParams(location.hash.slice(1)) : null;
  const hashCity = hash && (hash.get('q') || hash.get('city'));
  const last = hasSearchUI ? localStorage.getItem("lastCity") : null;
  if (hasSearchUI && hashCity) {
    try { el.cityInput.value = decodeURIComponent(hashCity); } catch { el.cityInput.value = hashCity; }
    fetchWeatherByCity(el.cityInput.value);
  } else if (hasSearchUI && last) {
    try { el.cityInput.value = last; } catch {}
    fetchWeatherByCity(last);
  } else if (hasSearchUI) {
    if (el.statusMsg) el.statusMsg.textContent = "Pesquise uma cidade";
    clearWeatherCard();
  }
}

document.addEventListener("DOMContentLoaded", initApp);
