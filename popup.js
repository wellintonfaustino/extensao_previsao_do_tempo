// Popup.js - Lógica da interface do popup

const API_BASE = "https://api.open-meteo.com/v1";
const GEO_API_BASE = "https://geocoding-api.open-meteo.com/v1";

const weatherCodes = {
  0: { desc: "Céu Limpo", icon: "fa-sun" },
  1: { desc: "Parcialmente Nublado", icon: "fa-cloud-sun" },
  2: { desc: "Nublado", icon: "fa-cloud" },
  3: { desc: "Encoberto", icon: "fa-cloud" },
  45: { desc: "Nevoeiro", icon: "fa-smog" },
  48: { desc: "Nevoeiro com Geada", icon: "fa-smog" },
  51: { desc: "Garoa Leve", icon: "fa-cloud-rain" },
  53: { desc: "Garoa Moderada", icon: "fa-cloud-rain" },
  55: { desc: "Garoa Intensa", icon: "fa-cloud-showers-heavy" },
  61: { desc: "Chuva Leve", icon: "fa-cloud-rain" },
  63: { desc: "Chuva Moderada", icon: "fa-cloud-showers-heavy" },
  65: { desc: "Chuva Forte", icon: "fa-cloud-showers-water" },
  80: { desc: "Pancadas de Chuva", icon: "fa-cloud-showers-heavy" },
  95: { desc: "Tempestade", icon: "fa-bolt" },
  96: { desc: "Tempestade com Granizo", icon: "fa-bolt" },
  99: { desc: "Tempestade Forte", icon: "fa-bolt" }
};

const dom = {
  cityInput: document.getElementById('city-input'),
  searchBtn: document.getElementById('search-btn'),
  cityName: document.getElementById('city-name'),
  temperature: document.getElementById('temperature'),
  condition: document.getElementById('condition'),
  weatherIcon: document.querySelector('.weather-icon'),
  windSpeed: document.getElementById('wind-speed'),
  humidity: document.getElementById('humidity'),
  precipProb: document.getElementById('precip-prob'), // Novo
  todayDate: document.getElementById('today-date'), // Novo
  loading: document.getElementById('loading'),
  content: document.getElementById('weather-content'),
  error: document.getElementById('error-msg'),
  errorText: document.getElementById('error-text'),
  retryBtn: document.getElementById('retry-btn'),
  hourlyContainer: document.getElementById('hourly-forecast'),
  dailyContainer: document.getElementById('daily-forecast'),
  dailyContainer: document.getElementById('daily-forecast'),
  chartCanvas: document.getElementById('tempChart'),
  rainCanvas: document.getElementById('rainChart'),
  tooltip: document.getElementById('chart-tooltip') // Novo
};

document.addEventListener('DOMContentLoaded', () => {
  loadLastCityOrGeo();

  dom.searchBtn.addEventListener('click', handleSearch);
  dom.cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  
  // Garantir que retry button existe antes de adicionar listener
  const retryBtn = document.getElementById('retry-btn');
  if(retryBtn) retryBtn.addEventListener('click', () => {
      // Limpar erro antes de tentar
      dom.error.classList.add('hidden');
      loadLastCityOrGeo();
  });
});

async function loadLastCityOrGeo() {
  showLoading();
  const lastCity = localStorage.getItem('last_city_coords');
  
  if (lastCity) {
    try {
        const { lat, lon, name } = JSON.parse(lastCity);
        await fetchWeather(lat, lon, name);
    } catch(e) {
        localStorage.removeItem('last_city_coords');
        getGeolocation();
    }
  } else {
    getGeolocation();
  }
}

function getGeolocation() {
  if (!navigator.geolocation) {
    showError("Geolocalização não suportada.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      let cityName = "Sua Localização";

      // Tentar reverse geocoding
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        if (data && data.address) {
            cityName = data.address.city || data.address.town || data.address.village || cityName;
        }
      } catch (err) {
        console.warn("Reverse geocoding falhou", err);
      }

      fetchWeather(latitude, longitude, cityName);
    },
    (err) => {
      console.warn("Geo error", err);
      showError("Localização não permitida. Digite uma cidade.");
      dom.cityInput.focus();
    }
  );
}

async function handleSearch() {
  const city = dom.cityInput.value.trim();
  if (!city) return;

  showLoading();
  try {
    const response = await fetch(`${GEO_API_BASE}/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      showError("Cidade não encontrada.");
      return;
    }

    const result = data.results[0];
    const name = `${result.name}, ${result.country_code ? result.country_code.toUpperCase() : ''}`; // Tratamento seguro
    
    // Salvar
    localStorage.setItem('last_city_coords', JSON.stringify({
      lat: result.latitude,
      lon: result.longitude,
      name: name
    }));

    await fetchWeather(result.latitude, result.longitude, name); // Await aqui

  } catch (err) {
    console.error(err);
    showError("Erro na busca.");
  }
}

async function fetchWeather(lat, lon, name) {
  try {
    const url = `${API_BASE}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,weather_code,precipitation_probability,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&wind_speed_unit=kmh&timezone=auto`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("API Error");
    
    const data = await response.json();
    const current = data.current;

    dom.cityName.textContent = name;
    
    // Atualizar data de hoje
    const now = new Date();
    dom.todayDate.textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    dom.temperature.textContent = `${Math.round(current.temperature_2m)}°`; // Removido span unit separado
    dom.windSpeed.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    dom.humidity.textContent = `${current.relative_humidity_2m}%`;

    // Pegar probabilidade de chuva atual (da hora atual)
    const currentHourIndex = data.hourly.time.findIndex(t => t === current.time);
    const rainProb = currentHourIndex !== -1 ? data.hourly.precipitation_probability[currentHourIndex] : 0;
    dom.precipProb.textContent = `${rainProb}%`;

    const code = current.weather_code;
    const weatherInfo = weatherCodes[code] || { desc: "Desconhecido", icon: "fa-question" };
    
    dom.condition.textContent = weatherInfo.desc;
    
    dom.weatherIcon.className = ''; 
    dom.weatherIcon.classList.add('fa-solid', weatherInfo.icon, 'weather-icon');
    
    // Atualizar background
    updateBackground(code, current.is_day);

    // Show content first to ensure canvas has dimensions for getBoundingClientRect
    showContent();

    // Render forecasts
    if (data.hourly) {
        renderHourlyForecast(data.hourly, current.time);
        drawTemperatureChart(data.hourly, current.time);
        drawRainChart(data.hourly, current.time); // Desenhar gráfico de chuva
    }
    if (data.daily) renderDailyForecast(data.daily);
  } catch (err) {
    console.error(err);
    showError("Erro ao carregar clima.");
  }
}

function showLoading() {
  dom.loading.classList.remove('hidden');
  dom.content.classList.add('hidden');
  if(dom.error) dom.error.classList.add('hidden');
}

function showContent() {
  dom.loading.classList.add('hidden');
  dom.content.classList.remove('hidden');
  if(dom.error) dom.error.classList.add('hidden');
}

function showError(msg) {
  dom.loading.classList.add('hidden');
  dom.content.classList.add('hidden');
  if(dom.error) {
    dom.error.classList.remove('hidden');
    const txt = dom.error.querySelector('p') || document.getElementById('error-text'); // Fallback seguro
    if(txt) txt.textContent = msg;
  }
}

function renderHourlyForecast(hourly, currentTime) {
  if (!dom.hourlyContainer) return;
  dom.hourlyContainer.innerHTML = '';
  
  // Find start index based on current time from API
  const startIndex = hourly.time.findIndex(t => t === currentTime);
  const start = startIndex !== -1 ? startIndex : 0;
  
  for (let i = start; i < start + 24 && i < hourly.time.length; i++) {
    const timeStr = hourly.time[i];
    const date = new Date(timeStr);
    
    // Check if valid date
    if (isNaN(date.getTime())) continue;

    const temp = Math.round(hourly.temperature_2m[i]);
    const code = hourly.weather_code[i];
    const precip = hourly.precipitation_probability[i];
    const icon = (weatherCodes[code] || { icon: "fa-question" }).icon;
    
    const hourLabel = date.getHours().toString().padStart(2, '0') + ':00';
    
    const card = document.createElement('div');
    card.className = 'hourly-card';
    card.innerHTML = `
      <span class="hourly-time">${i === start ? 'Agora' : hourLabel}</span>
      <i class="fa-solid ${icon} hourly-icon"></i>
      <span class="hourly-temp">${temp}°</span>
      <div class="hourly-precip">
        <i class="fa-solid fa-droplet" style="font-size: 8px;"></i>
        <span>${precip}%</span>
      </div>
    `;
    
    dom.hourlyContainer.appendChild(card);
  }
}

function renderDailyForecast(daily) {
  if (!dom.dailyContainer) return;
  dom.dailyContainer.innerHTML = '';
  
  for (let i = 0; i < daily.time.length; i++) {
    const timeStr = daily.time[i];
    // Create date relative to local time to avoid timezone shifts
    const [year, month, day] = timeStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    const maxTemp = Math.round(daily.temperature_2m_max[i]);
    const minTemp = Math.round(daily.temperature_2m_min[i]);
    const code = daily.weather_code[i];
    const precip = daily.precipitation_probability_max[i];
    const icon = (weatherCodes[code] || { icon: "fa-question" }).icon;
    
    const dayName = i === 0 ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dateFormatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    const row = document.createElement('div');
    row.className = 'daily-card';
    row.innerHTML = `
      <div class="daily-day-wrapper">
        <span class="daily-day" style="text-transform: capitalize;">${dayName}</span>
        <span class="daily-date-sub">${dateFormatted}</span>
      </div>
      
      <div class="daily-precip">
        <i class="fa-solid fa-droplet" style="font-size: 10px;"></i>
        <span>${precip}%</span> 
      </div>

      <div class="daily-icon-wrapper">
        <i class="fa-solid ${icon} daily-icon"></i>
      </div>
      
      <div class="daily-temps">
        <span class="temp-max">${maxTemp}°</span>
        <span class="temp-min">${minTemp}°</span>
      </div>
    `;
    
    dom.dailyContainer.appendChild(row);
  }
}

/**
 * Desenha um gráfico de temperatura suave usando Canvas API
 */
function drawTemperatureChart(hourly, currentTime) {
    const canvas = dom.chartCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Ajustar resolução para telas retina/high-dpi
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    
    // Configurar dimensões internas
    const width = rect.width;
    const height = rect.height;
    // Aumentar padding para não cortar números
    const padding = { top: 30, bottom: 30, left: 20, right: 20 };
    
    // Limpar
    ctx.clearRect(0, 0, width, height);

    // Preparar dados (próximas 24h)
    const startIndex = hourly.time.findIndex(t => t === currentTime);
    const start = startIndex !== -1 ? startIndex : 0;
    const sliceCount = 24;
    const temps = hourly.temperature_2m.slice(start, start + sliceCount);
    
    if (temps.length < 2) return;

    // Calcular min/max para escala Y
    const minTemp = Math.min(...temps) - 2;
    const maxTemp = Math.max(...temps) + 2;
    const tempRange = maxTemp - minTemp;

    // Função auxiliar para converter X,Y em coordenadas do canvas
    const getX = (index) => padding.left + (index / (temps.length - 1)) * (width - padding.left - padding.right);
    const getY = (temp) => height - padding.bottom - ((temp - minTemp) / tempRange) * (height - padding.top - padding.bottom);

    // Configurar estilo da linha
    ctx.strokeStyle = '#ffd700'; // Dourado
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Criar gradiente de preenchimento
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0.0)');

    // Iniciar caminho
    ctx.beginPath();
    
    ctx.moveTo(getX(0), getY(temps[0]));

    for (let i = 0; i < temps.length - 1; i++) {
        const xCurrent = getX(i);
        const yCurrent = getY(temps[i]);
        const xNext = getX(i + 1);
        const yNext = getY(temps[i + 1]);
        
        // Bezier quadrática para suavização
        const xMid = (xCurrent + xNext) / 2;
        const yMid = (yCurrent + yNext) / 2;
        
        if (i === 0) {
            ctx.lineTo(xMid, yMid);
        } else {
            ctx.quadraticCurveTo(xCurrent, yCurrent, xMid, yMid);
        }
    }
    
    // Conectar ao último ponto
    ctx.lineTo(getX(temps.length - 1), getY(temps[temps.length - 1]));
    
    // Desenhar a linha
    ctx.stroke();
    
    // Preencher a área abaixo (gradiente)
    ctx.save();
    ctx.lineTo(getX(temps.length - 1), height);
    ctx.lineTo(getX(0), height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();

    // Desenhar bolinhas em alguns pontos
    ctx.fillStyle = '#fff';
    const interval = Math.floor(temps.length / 6); // Ajustado intervalo
    for (let i = 0; i < temps.length; i += interval) {
        const x = getX(i);
        const y = getY(temps[i]);
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Texto da temperatura
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = 'bold 12px Outfit, sans-serif';
        ctx.textAlign = 'center';
        // Ajustar posição do texto para não cortar (se estiver muito perto do topo)
        const textY = y - 12 < 10 ? y + 20 : y - 12;
        ctx.fillText(`${temps[i]}°`, x, textY);
        ctx.fillStyle = '#fff';
    }
}

/**
 * Desenha gráfico de barras para chuva
 */
function drawRainChart(hourly, currentTime) {
    const canvas = dom.rainCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Ajustar resolução
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, bottom: 20, left: 20, right: 20 };
    
    ctx.clearRect(0, 0, width, height);

    // Dados (24h)
    const startIndex = hourly.time.findIndex(t => t === currentTime);
    const start = startIndex !== -1 ? startIndex : 0;
    const sliceCount = 24;
    const props = hourly.precipitation_probability.slice(start, start + sliceCount);
    
    if (props.length === 0) return;

    // Config barra
    const barWidth = (width - padding.left - padding.right) / props.length;
    const maxVal = 100; // Porcentagem sempre vai até 100

    // Gradiente das barras
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#4facfe');
    gradient.addColorStop(1, '#00f2fe');

    ctx.fillStyle = gradient;

    for(let i=0; i < props.length; i++) {
        const val = props[i];
        if (val === 0) continue; // Pular barras vazias

        const barHeight = (val / maxVal) * (height - padding.top - padding.bottom);
        const x = padding.left + (i * barWidth);
        const y = height - padding.bottom - barHeight;
        
        // Desenhar barra (com leve arredondamento no topo)
        ctx.beginPath();
        ctx.roundRect(x + 1, y, barWidth - 2, barHeight, [2, 2, 0, 0]);
        ctx.fill();
    }
    
    // Labels (em intervalos)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    
    const interval = 6; // A cada 6 horas
    for(let i=0; i < props.length; i+= interval) {
        const x = padding.left + (i * barWidth) + (barWidth/2);
        
        // Hora
        const date = new Date(hourly.time[start + i]);
        const hour = date.getHours().toString().padStart(2, '0');
        
        ctx.fillText(`${hour}h`, x, height - 5);
        
        // Valor se for relevante (>30%)
    // Interatividade: Tooltip
    // Remover ouvintes antigos para evitar duplicação (embora redefinir onmousemove funcione bem)
    canvas.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        // Calcular índice da barra
        // x = padding.left + (i * barWidth)
        // i = (x - padding.left) / barWidth
        const index = Math.floor((mouseX - padding.left) / barWidth);
        
        if (index >= 0 && index < props.length) {
            const prob = props[index];
            const date = new Date(hourly.time[start + index]);
            const hour = date.getHours().toString().padStart(2, '0') + ':00';
            
            // Mostrar tooltip
            dom.tooltip.innerHTML = `<strong>${hour}</strong><br>Chuva: ${prob}%`;
            dom.tooltip.style.left = `${e.clientX}px`;
            dom.tooltip.style.top = `${e.clientY}px`;
            dom.tooltip.classList.remove('hidden');
            
            // Opcional: Destacar barra (requer redesenhar, pode ser pesado. Vamos focar no tooltip por enquanto)
        } else {
            dom.tooltip.classList.add('hidden');
        }
    };

    canvas.onmouseleave = () => {
        dom.tooltip.classList.add('hidden');
    };
}

function updateBackground(code, isDay) {
  const body = document.body;
  body.className = ''; // Reset
  
  // Códigos WMO
  // 0,1: Limpo/Parcial
  // 2,3: Nublado
  // 45,48: Nevoeiro
  // 51-67, 80-82: Chuva
  // 71-77, 85-86: Neve
  // 95-99: Tempestade

  if (isDay === 0) {
    body.classList.add('bg-night');
    return;
  }

  if (code <= 1) {
    body.classList.add('bg-sunny');
  } else if (code <= 3 || code === 45 || code === 48) {
    body.classList.add('bg-cloudy');
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    body.classList.add('bg-rainy');
  } else if (code >= 95) {
    body.classList.add('bg-storm');
  } else {
    body.classList.add('bg-cloudy'); // Fallback
  }
}
