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
  weatherIcon: document.querySelector('.weather-icon'), // querySelector é mais seguro aqui
  windSpeed: document.getElementById('wind-speed'),
  humidity: document.getElementById('humidity'),
  loading: document.getElementById('loading'),
  content: document.getElementById('weather-content'),
  error: document.getElementById('error-msg'),
  errorText: document.getElementById('error-text'), // Corrigido ID no HTML se precisar
  retryBtn: document.getElementById('retry-btn') // Corrigido ID no HTML se precisar
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
    const url = `${API_BASE}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("API Error");
    
    const data = await response.json();
    const current = data.current;

    dom.cityName.textContent = name;
    dom.temperature.textContent = Math.round(current.temperature_2m);
    dom.windSpeed.textContent = `${current.wind_speed_10m} km/h`;
    dom.humidity.textContent = `${current.relative_humidity_2m}%`;

    const code = current.weather_code;
    // Fallback seguro se o código não existir
    const weatherInfo = weatherCodes[code] || { desc: "Desconhecido", icon: "fa-question" };
    
    dom.condition.textContent = weatherInfo.desc;
    
    // Remover classes antigas e adicionar novas
    dom.weatherIcon.className = ''; 
    dom.weatherIcon.classList.add('fa-solid', weatherInfo.icon, 'weather-icon');

    showContent();
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
