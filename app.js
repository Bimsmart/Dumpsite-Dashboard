// ============================================================
// LAGOS ENVIRONMENTAL RISK DASHBOARD
// Spatial Analysis Application
// ============================================================

const app = {
  // State
  state: {
    currentYear: '2025',
    availableYears: ['2018','2019','2020','2021','2022','2023','2024','2025'],
    currentMetric: 'ch4',
    currentBasemap: 'carto',
    currentLGA: '',
    opacity: 0.8,
    data: {
      lgas: null,
      emissionPoints: null,
      landfills: null,
      lgasBoundary: null,
      places: null,
    },
    selectedFeature: null,
    selectedLayer: null,
    rasterData: {},
    clickedPoint: null,
    rasterClipLGA: null,  // LGA name when raster is clipped to an LGA, null = full state
    geeMode: false,
    GEE_SERVER: 'http://localhost:5001',
    // ── Auth / backend ──────────────────────────────────────
    backendMode: false,          // true when backend.py is reachable
    BACKEND_URL: 'http://localhost:5002',
    authToken: null,
    authUsername: null,
    authRole: null,
    geeRasterSource: 'asset',
    geeTileEndpointTemplate: null,
    theme: 'dark',
    drawnItems: null,
    activeDraw: null,
    currentDrawContext: null,
  },

  // Map and Chart instances
  map: null,
  charts: {
    trend: null,
    lgaComparison: null,
    composition: null,
    miniTrend: null,
    gasTemporal: null,
    gasCorrelation: null,
    transect: null,
  },
  layers: {
    basemap: null,
    lgas: null,
    points: null,
    hotspots: null,
    landfills: null,
    buffers: null,
    buildings: null,
    raster: null,
    clipMask: null,
    geeBoundary: null,
    geeLGA: null,
    geeLGALabels: null,
    geeLagos: null,
    lagosStateBoundary: null,
    lgaHighlight: null,
    geeHotspots: null,
    places: null,
  },

  // Cache of pre-rendered imageOverlay objects keyed by "year_metric[_clipLGA]".
  // Each combination is rendered only once; subsequent calls reuse the cached overlay.
  _overlayCache: {},

  // Color scales for different metrics
  colorScales: {
    ch4: ['#16a34a', '#d9f99d', '#facc15', '#f97316', '#dc2626', '#7c2d12'],
    no2: ['#16a34a', '#d9f99d', '#facc15', '#f97316', '#dc2626', '#7c2d12'],
    co: ['#16a34a', '#fef08a', '#facc15', '#f97316', '#dc2626', '#7c2d12'],
    isi: ['#16a34a', '#fef08a', '#f97316', '#dc2626', '#7c2d12'],
    hotspots: ['#16a34a', '#facc15', '#f97316', '#ef4444', '#7c2d12'],
  },

  legendConfig: {
    ch4: {
      title: 'Methane (CH₄)',
      units: 'mol/m²',
      buckets: [
        { label: 'GOOD / SAFE', range: '< 0.02 mol/m²', description: 'Clean background conditions', min: 0, max: 0.02, color: '#16a34a' },
        { label: 'MODERATE', range: '0.02 – 0.04 mol/m²', description: 'Typical urban background', min: 0.02, max: 0.04, color: '#facc15' },
        { label: 'MARGINAL', range: '0.04 – 0.06 mol/m²', description: 'Rising health concern', min: 0.04, max: 0.06, color: '#f97316' },
        { label: 'HIGH RISK', range: '0.06 – 0.08 mol/m²', description: 'Unhealthy conditions for sensitive groups', min: 0.06, max: 0.08, color: '#ef4444' },
        { label: 'CRITICAL', range: '> 0.08 mol/m²', description: 'Severe pollution hotspots', min: 0.08, max: Infinity, color: '#7c2d12' },
      ],
    },
    no2: {
      title: 'Nitrogen Dioxide (NO₂)',
      units: 'mol/m²',
      buckets: [
        { label: 'GOOD / SAFE', range: '< 0.00005 mol/m²', description: 'Low urban background', min: 0, max: 0.00005, color: '#16a34a' },
        { label: 'MODERATE', range: '0.00005 – 0.00010 mol/m²', description: 'Urban background levels', min: 0.00005, max: 0.0001, color: '#facc15' },
        { label: 'MARGINAL', range: '0.00010 – 0.00015 mol/m²', description: 'Increasing atmospheric stress', min: 0.0001, max: 0.00015, color: '#f97316' },
        { label: 'HIGH RISK', range: '0.00015 – 0.00020 mol/m²', description: 'Unhealthy air quality', min: 0.00015, max: 0.0002, color: '#ef4444' },
        { label: 'CRITICAL', range: '> 0.00020 mol/m²', description: 'Severe pollution hotspots', min: 0.0002, max: Infinity, color: '#7c2d12' },
      ],
    },
    co: {
      title: 'Carbon Monoxide (CO)',
      units: 'mol/m²',
      buckets: [
        { label: 'GOOD / SAFE', range: '< 0.02 mol/m²', description: 'Clean background conditions', min: 0, max: 0.02, color: '#16a34a' },
        { label: 'MODERATE', range: '0.02 – 0.04 mol/m²', description: 'Typical urban background', min: 0.02, max: 0.04, color: '#facc15' },
        { label: 'MARGINAL', range: '0.04 – 0.06 mol/m²', description: 'Rising health concern', min: 0.04, max: 0.06, color: '#f97316' },
        { label: 'HIGH RISK', range: '0.06 – 0.08 mol/m²', description: 'Unhealthy conditions for sensitive groups', min: 0.06, max: 0.08, color: '#ef4444' },
        { label: 'CRITICAL', range: '> 0.08 mol/m²', description: 'Severe pollution hotspots', min: 0.08, max: Infinity, color: '#7c2d12' },
      ],
    },
    isi: {
      title: 'Environmental Risk Index (ERI)',
      units: 'normalized',
      buckets: [
        { label: 'LOW', range: '0.0 – 0.2', description: 'Low environmental risk', min: 0.0, max: 0.2, color: '#16a34a' },
        { label: 'MODERATE', range: '0.2 – 0.4', description: 'Moderate concern', min: 0.2, max: 0.4, color: '#facc15' },
        { label: 'MARGINAL', range: '0.4 – 0.6', description: 'Increasing environmental stress', min: 0.4, max: 0.6, color: '#f97316' },
        { label: 'HIGH RISK', range: '0.6 – 0.8', description: 'Unhealthy conditions', min: 0.6, max: 0.8, color: '#ef4444' },
        { label: 'CRITICAL', range: '0.8 – 1.0', description: 'Severe pollution hotspots', min: 0.8, max: 1.0, color: '#7c2d12' },
      ],
    },
    hotspots: {
      title: 'Hotspots',
      units: 'index',
      buckets: [
        { label: 'LOW', range: '0', description: 'No active hotspot detected', min: 0, max: 0.5, color: '#16a34a' },
        { label: 'MODERATE', range: '0.5 – 1.0', description: 'Potential hotspot area', min: 0.5, max: 1.0, color: '#facc15' },
        { label: 'MARGINAL', range: '1.0 – 2.0', description: 'Consistent hotspot signal', min: 1.0, max: 2.0, color: '#f97316' },
        { label: 'HIGH RISK', range: '2.0 – 3.0', description: 'High intensity hotspot detected', min: 2.0, max: 3.0, color: '#ef4444' },
        { label: 'CRITICAL', range: '> 3.0', description: 'Extreme hotspot severity', min: 3.0, max: Infinity, color: '#7c2d12' },
      ],
    },
  },


  initChartDefaults() {
    Chart.defaults.color       = '#7a8fa8';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size   = 10;
  },

  setTheme(theme) {
    this.state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('erm-theme', theme);

    // Update theme button active state
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Update Chart.js defaults per theme
    const chartColors = {
      dark:    { color: '#7a8fa8', border: 'rgba(255,255,255,0.05)' },
      light:   { color: '#475569', border: 'rgba(0,0,0,0.08)' },
      modern:  { color: '#9d8fc4', border: 'rgba(255,255,255,0.06)' },
    };
    const c = chartColors[theme] || chartColors.dark;
    Chart.defaults.color       = c.color;
    Chart.defaults.borderColor = c.border;

    // Re-render existing charts so they pick up new colors
    Object.values(this.charts).forEach(chart => {
      if (chart) {
        if (chart.options.scales) {
          Object.values(chart.options.scales).forEach(scale => {
            if (scale.grid)  scale.grid.color  = c.border;
            if (scale.ticks) scale.ticks.color = c.color;
          });
        }
        chart.update('none');
      }
    });

    // Switch basemap: light → OpenStreetMap, dark/modern → Carto Dark
    if (this.map) {
      const targetBasemap = theme === 'light' ? 'osm' : 'carto';
      if (this.state.currentBasemap !== targetBasemap) {
        this.addBasemap(targetBasemap);
        const sel = document.getElementById('basemapSelect');
        if (sel) sel.value = targetBasemap;
      }
      // Keep raster visibility stable while switching themes.
      if (this.layers.raster && this.layers.raster.bringToFront) {
        this.layers.raster.bringToFront();
      }
    }

    // No stroke on donut chart in light theme
    if (this.charts.composition) {
      const bw = theme === 'light' ? 0 : 2;
      const bc = theme === 'light' ? 'transparent' : '#0d1627';
      this.charts.composition.data.datasets[0].borderWidth = bw;
      this.charts.composition.data.datasets[0].borderColor = bc;
      this.charts.composition.update('none');
    }

    // No stroke on trend chart point circles in light theme
    if (this.charts.trend) {
      const ptBw = theme === 'light' ? 0 : 2;
      const ptBc = theme === 'light' ? 'transparent' : '#070c14';
      this.charts.trend.data.datasets[0].pointBorderWidth = ptBw;
      this.charts.trend.data.datasets[0].pointBorderColor = ptBc;
      this.charts.trend.update('none');
    }
  },

  getYears() {
    return this.state.availableYears || ['2018','2019','2020','2021','2022','2023','2024','2025'];
  },

  getLatestYear() {
    const years = this.getYears();
    return years[years.length - 1] || String(new Date().getFullYear());
  },

  setAvailableYears(years) {
    const cleanYears = [...new Set((years || []).map(String))]
      .filter(y => /^\d{4}$/.test(y) && parseInt(y) <= 2025)  // 2026+ not yet available
      .sort();
    if (!cleanYears.length) return;

    this.state.availableYears = cleanYears;
    if (!cleanYears.includes(String(this.state.currentYear))) {
      this.state.currentYear = this.getLatestYear();
    }

    const yearSelect = document.getElementById('yearSelect');
    if (yearSelect) {
      yearSelect.innerHTML = '';
      cleanYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        option.selected = year === String(this.state.currentYear);
        yearSelect.appendChild(option);
      });
    }

    const first = cleanYears[0];
    const last = this.getLatestYear();
    const fromSlider = document.getElementById('sa-trend-from');
    const toSlider = document.getElementById('sa-trend-to');
    if (fromSlider) {
      fromSlider.min = first;
      fromSlider.max = last;
      if (!cleanYears.includes(String(fromSlider.value))) fromSlider.value = first;
    }
    if (toSlider) {
      toSlider.min = first;
      toSlider.max = last;
      if (!cleanYears.includes(String(toSlider.value)) || Number(toSlider.value) < Number(first)) toSlider.value = last;
    }
    const fromLabel = document.getElementById('trendFromLabel');
    const toLabel = document.getElementById('trendToLabel');
    if (fromLabel && fromSlider) fromLabel.textContent = fromSlider.value;
    if (toLabel && toSlider) toLabel.textContent = toSlider.value;
  },

  // Initialize application
  async init() {
    console.log('Initializing...');
    this.initChartDefaults();
    this.setTheme(localStorage.getItem('erm-theme') || 'dark');
    this.setAvailableYears(this.getYears());
    // Check if backend is available; if so require login before loading data
    const backendUp = await this.checkBackend();
    if (backendUp) {
      const authed = await this.restoreSession();
      if (!authed) { this.showLoginModal(); return; }
    }
    await this.loadData();
    this.initializeMap();
    this.attachEventListeners();
    this.initDrawTools();
    this.updateDashboard();
    await this.initGEEMode();
    // Lagos State Boundary is always active
    await this.toggleGEELagosLayer(true);
    // Default to raster view — remove LGA layer and load raster
    if (this.map.hasLayer(this.layers.lgas)) this.map.removeLayer(this.layers.lgas);
    await this.addRasterLayer();
    const legendSub = document.getElementById('legendSub');
    if (legendSub) legendSub.textContent = 'Pixel-level · Sentinel-5P';
  },

  // Load GeoJSON data — uses backend API when available, static files otherwise
  async loadData() {
    try {
      const authHeaders = this.state.authToken
        ? { 'Authorization': `Bearer ${this.state.authToken}` } : {};

      // Boundary and places are always loaded from static files (no sensitive data)
      const [lgasBoundaryResponse, placesResponse] = await Promise.all([
        fetch('data/lga_boundary.geojson'),
        fetch('data/places.geojson'),
      ]);
      this.state.data.lgasBoundary = await lgasBoundaryResponse.json();
      this.state.data.places       = await placesResponse.json();

      // Emissions + landfills: use API if backend is active, else static files
      if (this.state.backendMode) {
        const [emResp, lfResp] = await Promise.all([
          fetch(`${this.state.BACKEND_URL}/api/emissions`,  { headers: authHeaders }),
          fetch(`${this.state.BACKEND_URL}/api/landfills`,  { headers: authHeaders }),
        ]);
        if (emResp.status === 401 || lfResp.status === 401) {
          this.showLoginModal(); return;
        }
        this.state.data.lgas = await emResp.json();
        const lf = await lfResp.json();
        this.state.data.emissionPoints = lf;
        this.state.data.landfills      = lf;
      } else {
        const [emResp, lfResp] = await Promise.all([
          fetch('data/lga_emissions.geojson'),
          fetch('data/landfills.geojson'),
        ]);
        this.state.data.lgas = await emResp.json();
        const lf = await lfResp.json();
        this.state.data.emissionPoints = lf;
        this.state.data.landfills      = lf;
      }

      this.populateLGASelector();
      console.log('Data loaded successfully');
    } catch (error) {
      console.error('Error loading data:', error);
      this.showNotification('Error loading data');
    }
  },

  // Populate LGA dropdown
  populateLGASelector() {
    const lgaSelect = document.getElementById('lgaSelect');
    const lgas = new Set();

    this.state.data.lgas.features.forEach((feature) => {
      lgas.add(feature.properties.lganame);
    });

    const sortedLGAs = Array.from(lgas).sort();
    sortedLGAs.forEach((lga) => {
      const option = document.createElement('option');
      option.value = lga;
      option.textContent = lga;
      lgaSelect.appendChild(option);
    });
  },

  // Initialize Leaflet map
  initializeMap() {
    const mapContainer = document.getElementById('map');
    this.map = L.map(mapContainer, {
      maxBounds: [[6.2, 2.6],[6.9, 4.1]],
      maxBoundsViscosity: 0.8
    }).setView([6.52, 3.38], 11);

    // Add basemap: light theme defaults to OpenStreetMap, dark/modern to Carto Dark
    const initialBasemap = this.state.theme === 'light' ? 'osm' : 'carto';
    this.addBasemap(initialBasemap);
    const basemapSel = document.getElementById('basemapSelect');
    if (basemapSel) basemapSel.value = initialBasemap;

    // Add data layers
    this.addLGALayer();
    this.addEmissionPointsLayer();
    this.addLandfillsLayer();
    this.addPlacesLayer();

    // Add layer control
    this.map.on('click', () => {
      if (this.state.selectedLayer) {
        const prev = this.state.selectedLayer;
        const prevName = prev.feature?.properties?.lganame;
        const prevEmissions = this.state.data.lgas.features.find(f => f.properties.lganame === prevName);
        const prevVal = prevEmissions ? this.getMetricValue(prevEmissions, this.state.currentMetric, this.state.currentYear) : null;
        prev.setStyle({ weight:2, color:'white', fillOpacity:1, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
        this.state.selectedLayer = null;
      }
      this.state.selectedFeature = null;
      this._clearLGAHighlight();
      this.updateAnalyticsPanel();
    });

    console.log('Map initialized');
  },

  // Add basemap tiles
  addBasemap(type) {
    // Remove existing basemap if present
    if (this.layers.basemap) {
      this.map.removeLayer(this.layers.basemap);
    }

    let tileUrl, attribution;

    switch (type) {
      case 'osm':
        tileUrl =
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        attribution =
          '© OpenStreetMap contributors';
        break;
      case 'carto':
        tileUrl =
          'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        attribution =
          '© CartoDB';
        break;
      case 'satellite':
        tileUrl =
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        attribution =
          '© ESRI';
        break;
      default:
        tileUrl =
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        attribution =
          '© OpenStreetMap';
    }

    this.layers.basemap = L.tileLayer(tileUrl, {
      attribution: attribution,
      maxZoom: 19,
      zIndex: 1,
    }).addTo(this.map);

    this.state.currentBasemap = type;

    // Ensure the raster layer stays above the basemap after the swap.
    // imageOverlay uses bringToFront(); tileLayer (GEE mode) uses setZIndex().
    if (this.layers.raster) {
      if (typeof this.layers.raster.setZIndex === 'function') {
        this.layers.raster.setZIndex(2);
      } else if (typeof this.layers.raster.bringToFront === 'function') {
        this.layers.raster.bringToFront();
      }
    }
  },

  // Add LGA boundaries layer
  addLGALayer() {
    if (this.layers.lgas) {
      this.map.removeLayer(this.layers.lgas);
    }

    this.layers.lgas = L.geoJSON(this.state.data.lgasBoundary, {
      style: (feature) => {
        const lgaName = feature.properties.lganame;
        const emissionsFeature = this.state.data.lgas.features.find(f => f.properties.lganame === lgaName);
        const metric = this.state.currentMetric;
        const year = this.state.currentYear;
        const value = emissionsFeature ? this.getMetricValue(emissionsFeature, metric, year) : null;
        const fillColor = this.getColorForValue(metric, value);
        const isSelected = feature.properties?.lganame === this.state.selectedFeature?.properties?.lganame;

        return {
          fillColor: fillColor,
          weight: isSelected ? 2.5 : 1,
          opacity: 1,
          color: isSelected ? '#00d4ff' : 'white',
          dashArray: isSelected ? '' : '0',
          fillOpacity: 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const lgaName = feature.properties.lganame;
        const emissionsFeature = this.state.data.lgas.features.find(f => f.properties.lganame === lgaName);
        const metric = this.state.currentMetric;
        const year = this.state.currentYear;
        const value = emissionsFeature ? this.getMetricValue(emissionsFeature, metric, year) : null;
        const baseColor = this.getColorForValue(metric, value);

        // Create popup
        const popup = L.popup().setContent(`
          <div class="popup-content">
            <strong>${lgaName}</strong><br/>
            ${metric.toUpperCase()}: ${value !== null ? value.toFixed(2) : 'N/A'}
          </div>
        `);

        // Highlight style - brighten the existing color
        const highlightStyle = {
          weight: 3,
          color: 'white',
          fillOpacity: 1,
          fillColor: baseColor
        };

        const defaultStyle = {
          weight: 2,
          color: 'white',
          fillOpacity: 1,
          fillColor: baseColor
        };

        // Permanent LGA name label
        layer.bindTooltip(lgaName, {
          permanent: true,
          direction: 'center',
          className: 'lga-label',
        });

        layer.on('mouseover', (e) => {
          layer.setStyle(highlightStyle);
          popup.setLatLng(e.latlng).openOn(this.map);
        });

        layer.on('mouseout', (e) => {
          const isSelected = feature.properties?.lganame === this.state.selectedFeature?.properties?.lganame;
          layer.setStyle(isSelected ? highlightStyle : defaultStyle);
          this.map.closePopup(popup);
        });

        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (this.state.selectedLayer) {
            const prev = this.state.selectedLayer;
            const prevName = prev.feature?.properties?.lganame;
            const prevEmissions = this.state.data.lgas.features.find(f => f.properties.lganame === prevName);
            const prevVal = prevEmissions ? this.getMetricValue(prevEmissions, this.state.currentMetric, this.state.currentYear) : null;
            prev.setStyle({ weight:2, color:'white', fillOpacity:1, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
          }
          layer.setStyle({ weight:3, color:'#00d4ff', fillOpacity:1,
            fillColor: this.getColorForValue(this.state.currentMetric,
              emissionsFeature ? this.getMetricValue(emissionsFeature, this.state.currentMetric, this.state.currentYear) : null),
            dashArray:'' });
          layer.bringToFront();
          this.state.selectedLayer  = layer;
          this.state.selectedFeature = emissionsFeature || feature;
          this.updateAnalyticsPanel();
          this.updateCharts();
          this._highlightLGA(feature.properties.lganame);
          // Refresh SA panel if open
          const saPanel = document.getElementById('saPanel');
          if (saPanel?.classList.contains('open')) {
            const activeTab = document.querySelector('.sa-tab.active')?.dataset?.tab;
            if (activeTab) this.renderSATab(activeTab);
          }
        });
      },
    });
    
    if (document.getElementById('lgaBoundaries').checked) {
      this.layers.lgas.addTo(this.map);
    }

    this.updateLegend();
  },

  // Location-pin divIcon for landfill markers
  _lfPinIcon(highlighted) {
    const fill   = highlighted ? '#ffffff' : '#00d4ff';
    const stroke = highlighted ? '#00d4ff' : '#0891b2';
    const w = highlighted ? 32 : 26;
    const h = highlighted ? 45 : 37;
    return L.divIcon({
      className: '',
      html: `<svg width="${w}" height="${h}" viewBox="0 0 26 37" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">
        <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 24 13 24S26 22.75 26 13C26 5.82 20.18 0 13 0z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <circle cx="13" cy="13" r="5" fill="white" opacity="0.9"/>
      </svg>`,
      iconSize:    [w, h],
      iconAnchor:  [w / 2, h],
      popupAnchor: [0, -h],
    });
  },

  // Add emission points layer (Landfills)
  addEmissionPointsLayer() {
    if (this.layers.points) {
      this.map.removeLayer(this.layers.points);
    }
    this._lfMarkers = {};

    this.layers.points = L.geoJSON(this.state.data.emissionPoints, {
      pointToLayer: (feature, latlng) => {
        return L.marker(latlng, { icon: this._lfPinIcon(false) });
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.Name || 'Unknown Landfill';
        this._lfMarkers[name] = layer;

        const popup = L.popup().setContent(`
          <div class="popup-content">
            <strong>${name}</strong><br/>
            <em>Landfill Site</em>
          </div>
        `);

        layer.bindPopup(popup);
        layer.on('mouseover', () => { popup.openOn(this.map); });
        layer.on('mouseout',  () => { this.map.closePopup(popup); });
        layer.on('click',     () => { this.highlightLandfill(name); });
      },
    });

    if (document.getElementById('landfillsPoints').checked) {
      this.layers.points.addTo(this.map);
    }
  },

  highlightLandfill(name) {
    // Reset all markers to default pin
    Object.values(this._lfMarkers || {}).forEach(m => {
      m._lfSelected = false;
      m.setIcon(this._lfPinIcon(false));
    });
    // Highlight selected marker with cyan pin
    const marker = (this._lfMarkers || {})[name];
    if (marker) {
      marker._lfSelected = true;
      marker.setIcon(this._lfPinIcon(true));
      const ll = marker.getLatLng();
      this.map.flyTo(ll, Math.max(this.map.getZoom(), 14), { duration: 0.8 });
    }
    // Sync active state in the landfills panel cards
    document.querySelectorAll('.lf-card').forEach(card => {
      card.classList.toggle('lf-card--active', card.dataset.lfname === name);
    });
  },

  // Add Hotspot layer
  addHotspotLayer() {
    if (this.layers.hotspots) {
      this.map.removeLayer(this.layers.hotspots);
    }

    const year = this.state.currentYear;
    
    this.layers.hotspots = L.geoJSON(this.state.data.emissionPoints, {
      filter: (feature) => {
        return String(feature.properties.year) === String(year) && feature.properties.hotspots > 0;
      },
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 12,
          fillColor: '#ef4444',
          color: '#b91c1c',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.6,
          className: 'pulse-marker'
        });
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<strong>HOTSPOT ALERT</strong><br/>${feature.properties.lganame} (${year})`);
      }
    });

    this.layers.hotspots.addTo(this.map);
  },

  // Add Places layer (settlements/towns from OSM)
  addPlacesLayer() {
    if (this.layers.places) {
      this.map.removeLayer(this.layers.places);
    }
    if (!this.state.data.places) return;

    this.layers.places = L.geoJSON(this.state.data.places, {
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 2,
          fillColor: '#f0abfc',
          color: '#a21caf',
          weight: 1,
          opacity: 0.9,
          fillOpacity: 0.8,
        });
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.name || '';
        const fclass = feature.properties.fclass || '';
        if (name) {
          layer.bindTooltip(name, {
            permanent: true,
            direction: 'right',
            offset: [4, 0],
            className: 'places-label',
          });
        }
        layer.bindPopup(`<strong>${name || 'Unnamed'}</strong><br/><em>${fclass}</em>`);
      },
    });

    if (document.getElementById('placesLayer')?.checked) {
      this.layers.places.addTo(this.map);
    }
  },

  // Add Heatmap layer

  // Add Landfills layer (currently disabled, using emission points instead)

  addBufferLayer() {
    if (this.layers.buffers) { this.map.removeLayer(this.layers.buffers); this.layers.buffers = null; }
    if (!this.state.data.landfills || !this.state.data.landfills.features.length) return;
    const bufferGroup = L.layerGroup();
    const rings = [{ radius:1000,color:'#ff4d6a' },{ radius:500,color:'#ffb547' },{ radius:100,color:'#00e5a0' }];
    this.state.data.landfills.features.forEach(feature => {
      if (!feature.geometry) return;
      const [lon,lat] = feature.geometry.coordinates;
      const name = feature.properties.Name || feature.properties.lganame || 'Landfill';
      rings.forEach(ring => {
        L.circle([lat,lon],{ radius:ring.radius,color:ring.color,weight:1.5,opacity:0.7,
          fillColor:ring.color,fillOpacity:0.07,
          dashArray:ring.radius===1000?'6,4':ring.radius===500?'4,3':null,interactive:false
        }).addTo(bufferGroup);
      });
      L.circleMarker([lat,lon],{ radius:5,color:'#ffffff',weight:1.5,fillColor:'#ff4d6a',fillOpacity:1 })
        .bindPopup(`<div style="font-family:Inter,sans-serif;font-size:12px"><strong style="color:#ff4d6a">${name}</strong><br/><span style="color:#7a8fa8;font-size:10px">Buffer Zones</span><br/><span style="font-size:11px">🟢 100m · 🟡 500m · 🔴 1km</span></div>`)
        .addTo(bufferGroup);
    });
    this.layers.buffers = bufferGroup;
    if (document.getElementById('bufferLayer')?.checked) this.layers.buffers.addTo(this.map);
  },

  addLandfillsLayer() {
    // This function is kept for compatibility but landfills are now displayed via addEmissionPointsLayer()
  },

  // Get metric value from feature
  getMetricValue(feature, metric, year) {
    const key = `${metric}_${year}`;
    return feature.properties[key] || 0;
  },

  // Get color for value based on metric
  getColorForValue(metric, value) {
    const config = this.legendConfig[metric] || this.legendConfig.ch4;
    if (value === null || value === undefined || isNaN(value)) {
      return '#d1d5db';
    }

    const bucket = config.buckets.find((bucket) => value >= bucket.min && value < bucket.max);
    if (bucket) {
      return bucket.color;
    }

    return config.buckets[config.buckets.length - 1].color;
  },

  // Update legend
  updateLegend() {
    const config = this.legendConfig[this.state.currentMetric] || this.legendConfig.ch4;
    const legendTitle = document.getElementById('legendTitle');
    legendTitle.textContent = config.title;

    const legendContent = document.getElementById('legendContent');
    legendContent.innerHTML = '';

    const rasterActive = document.getElementById('rasterLayer')?.checked || !!this.layers.raster;
    const rasterScales = {
      ch4: { min: 1750, max: 2100, colors: ['#16a34a', '#84cc16', '#facc15', '#f97316', '#dc2626'] },
      no2: { min: 0, max: 0.00020, colors: ['#16a34a', '#84cc16', '#facc15', '#f97316', '#dc2626'] },
      co:  { min: 0.02, max: 0.08, colors: ['#16a34a', '#84cc16', '#facc15', '#f97316', '#dc2626'] },
      isi: { min: 0.2, max: 0.7, colors: ['#16a34a', '#84cc16', '#facc15', '#f97316', '#dc2626'] },
    };

    const formatLegendValue = (value) => {
      if (value === null || value === undefined || isNaN(value)) return '-';
      if (Math.abs(value) < 0.0001) return value.toExponential(2);
      return value < 1 ? value.toFixed(5) : value.toFixed(2);
    };

    if (rasterActive && rasterScales[this.state.currentMetric]) {
      const scale = rasterScales[this.state.currentMetric];
      const gradientStops = scale.colors.map((color, index) => {
        const percent = Math.round((index / (scale.colors.length - 1)) * 100);
        return `${color} ${percent}%`;
      }).join(', ');

      const contSection = document.createElement('div');
      contSection.className = 'legend-section';
      contSection.innerHTML = `
        <div class="legend-section-title">Continuous emission surface</div>
        <div class="legend-gradient" style="background: linear-gradient(90deg, ${gradientStops});"></div>
        <div class="legend-gradient-labels">
          <span>${formatLegendValue(scale.min)} ${config.units}</span>
          <span>${formatLegendValue(scale.max)} ${config.units}</span>
        </div>
        <div class="legend-desc">Continuous raster symbology for the active emission surface.</div>
      `;
      legendContent.appendChild(contSection);
    }

    const catSection = document.createElement('div');
    catSection.className = 'legend-section';
    const catTitle = document.createElement('div');
    catTitle.className = 'legend-section-title';
    catTitle.textContent = rasterActive ? 'LGA categorical symbology' : 'Emission category symbology';
    catSection.appendChild(catTitle);

    config.buckets.forEach((bucket) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <div class="legend-color" style="background-color: ${bucket.color};"></div>
        <div class="legend-body">
          <div class="legend-label">${bucket.label}</div>
          <div class="legend-range">${bucket.range}</div>
          <div class="legend-desc">${bucket.description}</div>
        </div>
      `;
      catSection.appendChild(item);
    });

    legendContent.appendChild(catSection);

  },

  // Update analytics panel
  updateAnalyticsPanel() {
    // Clear any prior draw selection when switching to a selected LGA summary
    this.state.currentDrawContext = null;
    const drawSection = document.getElementById('drawResultsSection');
    if (drawSection) drawSection.style.display = 'none';

    if (this.state.selectedFeature) {
      const feature = this.state.selectedFeature;
      const lgaName = feature.properties.lganame;
      const metric  = this.state.currentMetric;
      const year    = this.state.currentYear;
      const currentValue  = this.getMetricValue(feature, metric, year);
      const previousValue = this.getMetricValue(feature, metric, String(parseInt(year) - 1));
      const trend = previousValue !== 0 ? ((currentValue - previousValue) / previousValue * 100).toFixed(1) : 0;
      document.getElementById('stat-lga-name').textContent = lgaName;
      document.getElementById('stat-current-value').textContent = currentValue !== null ? currentValue.toFixed(6) : '-';
      const trendEl = document.getElementById('stat-trend');
      trendEl.textContent = `${trend > 0 ? '+' : ''}${trend}%`;
      trendEl.classList.toggle('negative', trend < 0);
      const isi = feature.properties[`isi_${year}`] || 0;
      const riskResult = this.getEriClassification(isi);
      const badgeEl = document.getElementById('stat-risk-class');
      badgeEl.textContent = riskResult.label;
      badgeEl.className = `stat-badge ${riskResult.css}`;
      const ch4 = this.getMetricValue(feature, 'ch4', year);
      const no2 = this.getMetricValue(feature, 'no2', year);
      const co  = this.getMetricValue(feature, 'co',  year);
      document.getElementById('stat-ch4').textContent = ch4 ? ch4.toFixed(6) + ' mol/m²' : '-';
      document.getElementById('stat-no2').textContent = no2 ? no2.toFixed(6) + ' mol/m²' : '-';
      document.getElementById('stat-co').textContent  = co  ? co.toFixed(6)  + ' mol/m²' : '-';
      let nearestDist = null, nearestName = null;
      // Resolve reference point: raster click → boundary polygon centroid → point geometry
      let refPoint = null;
      if (this.state.clickedPoint) {
        refPoint = L.latLng(this.state.clickedPoint.lat, this.state.clickedPoint.lng);
      } else {
        const lgaName = feature.properties.lganame;
        const boundary = this.state.data.lgasBoundary?.features?.find(b => b.properties.lganame === lgaName);
        const geom = boundary?.geometry || feature.geometry;
        if (geom) {
          if (geom.type === 'Point') {
            refPoint = L.latLng(geom.coordinates[1], geom.coordinates[0]);
          } else {
            const ring = geom.type === 'Polygon'
              ? geom.coordinates[0]
              : geom.type === 'MultiPolygon'
              ? geom.coordinates[0]?.[0]
              : null;
            if (ring?.length) {
              const avgLon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
              const avgLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
              refPoint = L.latLng(avgLat, avgLon);
            }
          }
        }
      }
      if (refPoint && this.state.data.landfills) {
        this.state.data.landfills.features.forEach(lf => {
          if (!lf.geometry) return;
          const d = refPoint.distanceTo(L.latLng(lf.geometry.coordinates[1], lf.geometry.coordinates[0]));
          if (nearestDist === null || d < nearestDist) {
            nearestDist = d;
            nearestName = lf.properties.Name || lf.properties.lganame || 'Unnamed Landfill';
          }
        });
      }
      const lfEl = document.getElementById('stat-nearest-landfill');
      if (lfEl) lfEl.textContent = nearestDist !== null ? `${nearestName} (${Math.round(nearestDist).toLocaleString()} m)` : '-';
      document.getElementById('stat-isi').textContent = isi ? isi.toFixed(4) : '-';
    } else {
      document.getElementById('stat-lga-name').textContent = '— None Selected —';
      ['stat-current-value','stat-trend','stat-ch4','stat-no2','stat-co','stat-nearest-landfill','stat-isi'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = '-';
      });
      const b = document.getElementById('stat-risk-class');
      if (b) { b.textContent = '—'; b.className = 'stat-badge'; }
    }
  },

  // Get risk classification
  getEriClassification(value) {
    const score = Number(value);
    if (isNaN(score)) {
      return { label: 'LOW', css: 'low' };
    }

    if (score >= 0.8) {
      return { label: 'CRITICAL', css: 'critical' };
    }
    if (score >= 0.6) {
      return { label: 'HIGH RISK', css: 'high' };
    }
    if (score >= 0.4) {
      return { label: 'MARGINAL', css: 'elevated' };
    }
    if (score >= 0.2) {
      return { label: 'MODERATE', css: 'moderate' };
    }
    return { label: 'LOW', css: 'low' };
  },



  // Returns LGA features whose centroid falls within the current map viewport
  getVisibleLGAFeatures() {
    if (!this.map || !this.state.data.lgas) return this.state.data.lgas?.features || [];
    const bounds = this.map.getBounds();
    return this.state.data.lgas.features.filter(f => {
      if (!f.geometry) return false;
      let lon, lat;
      if (f.geometry.type === 'Point') {
        [lon, lat] = f.geometry.coordinates;
      } else {
        const boundary = this.state.data.lgasBoundary?.features?.find(
          b => b.properties.lganame === f.properties.lganame
        );
        const geom = boundary?.geometry || f.geometry;
        const ring = geom.type === 'Polygon'
          ? geom.coordinates[0]
          : geom.type === 'MultiPolygon'
          ? geom.coordinates[0]?.[0]
          : null;
        if (!ring) return true;
        lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      }
      return bounds.contains(L.latLng(lat, lon));
    });
  },

  // Update all charts
  updateCharts() {
    this.updateTrendChart();
    this.updateLGAComparisonChart();
    this.updateCompositionChart();
  },

  // Update trend line chart
  updateTrendChart() {
    const metric = this.state.currentMetric;
    const metricLabelTrend = { ch4: 'CH₄', no2: 'NO₂', co: 'CO' }[metric] || metric.toUpperCase();
    const ptBorderWidth = this.state.theme === 'light' ? 0 : 2;
    const ptBorderColor = this.state.theme === 'light' ? 'transparent' : '#070c14';

    // Only show years from the currently selected year to the latest
    const allYears = this.getYears();
    let years = allYears.filter(y => parseInt(y) >= parseInt(this.state.currentYear));
    if (!years.length) years = allYears;

    let values = [];
    let chartLabel = `Average ${metricLabelTrend}`;
    let yTitle = metricLabelTrend;

    const pointTrend = this.state.clickedPoint?.pointTrend;
    if (pointTrend && Array.isArray(pointTrend[metric])) {
      const allPtYears = pointTrend.years || allYears;
      const allPtVals  = pointTrend[metric];
      const startIdx   = allPtYears.findIndex(y => parseInt(y) >= parseInt(this.state.currentYear));
      years  = startIdx >= 0 ? allPtYears.slice(startIdx) : allPtYears;
      const filteredVals = startIdx >= 0 ? allPtVals.slice(startIdx) : allPtVals;
      values = filteredVals.map((v) => (v !== null && v !== undefined ? parseFloat(v).toFixed(2) : null));
      chartLabel = `${metricLabelTrend} at selected point`;
      yTitle = 'mol/m²';
    } else {
      const avgValues = [];
      const visibleFeats = this.getVisibleLGAFeatures();
      const featCount = visibleFeats.length || 1;
      years.forEach((year) => {
        const total = visibleFeats.reduce((sum, feature) => {
          const value = this.getMetricValue(feature, metric, year);
          return sum + (value || 0);
        }, 0);
        const avg = total / featCount;
        avgValues.push(avg.toFixed(2));
      });
      values = avgValues;
    }

    // Update chart header label to reflect active year range
    const trendTitleEl = document.getElementById('trend-chart-title');
    if (trendTitleEl) {
      const latestYear = this.getLatestYear();
      const startYear = years[0] || this.state.currentYear;
      trendTitleEl.textContent = startYear === latestYear
        ? `Emission Trend (${startYear})`
        : `Emission Trend (${startYear}–present)`;
    }

    const ctx = document.getElementById('trendChart');
    if (this.charts.trend) {
      this.charts.trend.data.labels = years;
      this.charts.trend.data.datasets[0].data = values;
      this.charts.trend.data.datasets[0].label = chartLabel;
      this.charts.trend.data.datasets[0].pointBorderWidth = ptBorderWidth;
      this.charts.trend.data.datasets[0].pointBorderColor = ptBorderColor;
      this.charts.trend.options.scales.y.title.text = yTitle;
      this.charts.trend.update();
    } else {
      this.charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: years,
          datasets: [
            {
              label: chartLabel,
              data: values,
              borderColor: '#00d4ff',
              backgroundColor: 'rgba(0, 212, 255, 0.07)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointRadius: 6,
              pointBackgroundColor: '#00d4ff',
              pointBorderColor: ptBorderColor,
              pointBorderWidth: ptBorderWidth,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: { font: { size: 12 }, usePointStyle: true },
            },
          },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: metric.toUpperCase() } },
          },
        },
      });
    }
  },

  // Update LGA comparison bar chart
  updateLGAComparisonChart() {
    const year = this.state.currentYear;
    const metric = this.state.currentMetric;
    const data = [];
    const labels = [];

    this.state.data.lgas.features.forEach((feature) => {
      labels.push(feature.properties.lganame);
      const value = this.getMetricValue(feature, metric, year);
      data.push(value);
    });

    // Sort and take top 10 LGAs
    const sorted = labels.map((label, idx) => ({ label, value: data[idx] })).sort((a, b) => b.value - a.value);
    const topLabels = sorted.slice(0, 10).map((x) => x.label);
    const topData = sorted.slice(0, 10).map((x) => x.value);

    const barMetricLabel = { ch4: 'CH₄', no2: 'NO₂', co: 'CO' }[metric] || metric.toUpperCase();
    const barTitle = document.getElementById('bar-chart-title');
    if (barTitle) barTitle.textContent = `Top 10 LGAs — ${barMetricLabel}`;
    const ctx = document.getElementById('lgaComparisonChart');
    if (this.charts.lgaComparison) {
      this.charts.lgaComparison.data.labels = topLabels;
      this.charts.lgaComparison.data.datasets[0].data = topData;
      this.charts.lgaComparison.data.datasets[0].label = `Top 10 LGAs - ${barMetricLabel}`;
      this.charts.lgaComparison.update();
    } else {
      this.charts.lgaComparison = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topLabels,
          datasets: [
            {
              label: `Top 10 LGAs - ${barMetricLabel}`,
              data: topData,
              backgroundColor: 'rgba(0, 212, 255, 0.75)',
              borderRadius: 6,
              borderSkipped: false,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, labels: { font: { size: 12 } } },
          },
          scales: {
            x: { beginAtZero: true },
          },
        },
      });
    }
  },

  // Update composition doughnut chart
  updateCompositionChart() {
    const year = this.state.currentYear;
    const metrics = ['ch4', 'no2', 'co'];
    let totals = { ch4: 0, no2: 0, co: 0 };
    const visibleFeats = this.getVisibleLGAFeatures();

    metrics.forEach((metric) => {
      const total = visibleFeats.reduce((sum, feature) => {
        const value = this.getMetricValue(feature, metric, year);
        return sum + (value || 0);
      }, 0);
      totals[metric] = total;
    });

    const isLight = this.state.theme === 'light';
    const borderWidth = isLight ? 0 : 2;
    const borderColor = isLight ? 'transparent' : '#0d1627';

    const ctx = document.getElementById('compositionChart');
    const compTitle = document.getElementById('comp-chart-title');
    const pointTrend = this.state.clickedPoint?.pointTrend;
    if (pointTrend) {
      const idx = pointTrend.years.indexOf(String(year));
      if (idx >= 0) {
        totals = {
          ch4: pointTrend.ch4[idx] || 0,
          no2: pointTrend.no2[idx] || 0,
          co:  pointTrend.co[idx]  || 0,
        };
      }
      if (compTitle) compTitle.textContent = `Gas Composition at selected point (${year})`;
    } else if (compTitle) {
      compTitle.textContent = `Gas Composition (${year})`;
    }
    if (this.charts.composition) {
      this.charts.composition.data.datasets[0].data = [
        totals.ch4,
        totals.no2,
        totals.co,
      ];
      this.charts.composition.data.datasets[0].borderWidth = borderWidth;
      this.charts.composition.data.datasets[0].borderColor = borderColor;
      this.charts.composition.update();
    } else {
      this.charts.composition = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['CH₄ (Methane)', 'NO₂ (Nitrogen Dioxide)', 'CO (Carbon Monoxide)'],
          datasets: [
            {
              data: [totals.ch4, totals.no2, totals.co],
              backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
              borderColor: borderColor,
              borderWidth: borderWidth,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 12 }, padding: 15 },
            },
          },
        },
      });
    }
  },

  // Update KPIs
  updateKPIs() {
    const year = this.state.currentYear;

    // Total dumpsites (count unique locations)
    const uniqueLocations = new Set();
    this.state.data.emissionPoints.features.forEach((feature) => {
      const coords = feature.geometry.coordinates.join(',');
      uniqueLocations.add(coords);
    });
    document.getElementById('kpi-dumpsites').textContent = uniqueLocations.size;

    // Highest and lowest risk LGAs
    let maxValue = -Infinity;
    let minValue = Infinity;
    let highestLGA = '-';
    let lowestLGA = '-';

    this.state.data.lgas.features.forEach((feature) => {
      const value = this.getMetricValue(feature, 'isi', year);
      if (value > maxValue) {
        maxValue = value;
        highestLGA = feature.properties.lganame;
      }
      if (value < minValue) {
        minValue = value;
        lowestLGA = feature.properties.lganame;
      }
    });

    document.getElementById('kpi-highest-lga').textContent = highestLGA;
    document.getElementById('kpi-lowest-lga').textContent = lowestLGA;

    // Year-on-year change
    const currentYear = year;
    const previousYear = String(parseInt(year) - 1);
    let totalCurrent = 0,
      totalPrevious = 0;

    this.state.data.lgas.features.forEach((feature) => {
      totalCurrent += this.getMetricValue(feature, 'isi', currentYear) || 0;
      totalPrevious += this.getMetricValue(feature, 'isi', previousYear) || 0;
    });

    const yoyChange = totalPrevious !== 0 ? ((totalCurrent - totalPrevious) / totalPrevious * 100).toFixed(1) : 0;
    document.getElementById('kpi-yoy-change').textContent = `${yoyChange > 0 ? '+' : ''}${yoyChange}%`;
    const yoyIconEl = document.getElementById('yoy-icon');
    if (yoyIconEl) {
      if (Number(yoyChange) > 0)      yoyIconEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23,18 13.5,8.5 8.5,13.5 1,6"/><polyline points="17,6 23,6 23,12"/></svg>';
      else if (Number(yoyChange) < 0) yoyIconEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4d6a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,18 23,18 23,12"/></svg>';
      else                            yoyIconEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><polyline points="15,6 22,12 15,18"/></svg>';
    }

    // Average ERI
    const avgERI = (totalCurrent / this.state.data.lgas.features.length).toFixed(1);
    document.getElementById('kpi-avg-eri').textContent = avgERI;
  },

  // Update entire dashboard
  updateDashboard() {
    if (!this.state.data.lgas || !this.state.data.landfills) return;
    // Layer order: heatmap → IDW → buffer → LGA polygons → points → hotspots (top)
    this.addBufferLayer();
    this.addLGALayer();
    this.addLandfillsLayer();
    this.addEmissionPointsLayer();
    this.addHotspotLayer();
    this.updateCharts();
    this.updateKPIs();
    this.updateAnalyticsPanel();
    this.updateLegend();
    // Refresh SA panel if open
    if (document.getElementById('saPanel')?.classList.contains('open')) {
      const activeTab = document.querySelector('.sa-tab.active')?.dataset?.tab;
      if (activeTab) this.renderSATab(activeTab);
    }
  },

  // Attach event listeners
  attachEventListeners() {
    document.getElementById('yearSelect').addEventListener('change', async (e) => {
      if (e.target.value === '2026') {
        e.target.value = this.state.currentYear;           // revert the dropdown
        this.showNotification(
          '2026 data is not yet available — collection is in progress. Dashboard is showing the latest available year (2025).',
          'info'
        );
        return;
      }
      this.state.currentYear = e.target.value;
      this.updateDashboard();
      if (document.getElementById('rasterLayer')?.checked)   await this.addRasterLayer();
      if (document.getElementById('gasPanel')?.classList.contains('open')) {
        const activeGasTab = document.querySelector('[data-gas-tab].active')?.dataset?.gasTab;
        if (activeGasTab === 'correlation') this.renderGasCorrelation();
      }
    });

    document.getElementById('metricSelect').addEventListener('change', async (e) => {
      this.state.currentMetric = e.target.value;
      this.updateDashboard();
      if (document.getElementById('rasterLayer')?.checked)   await this.addRasterLayer();
    });

    document.getElementById('basemapSelect').addEventListener('change', (e) => {
      this.addBasemap(e.target.value);
    });

    document.getElementById('viewFormat')?.addEventListener('change', async (e) => {
      const lgaChk    = document.getElementById('lgaBoundaries');
      const rasterChk = document.getElementById('rasterLayer');
      // Swap description text
      document.getElementById('formatDesc-vector')?.classList.toggle('active', e.target.value === 'vector');
      document.getElementById('formatDesc-raster')?.classList.toggle('active', e.target.value === 'raster');
      // Reset raster clip when switching to vector
      if (e.target.value === 'vector') {
        this.state.rasterClipLGA = null;
        this._updateClipButton();
        this._removeClipMask();
      }
      if (e.target.value === 'raster') {
        if (lgaChk?.checked) {
          lgaChk.checked = false;
          lgaChk.dispatchEvent(new Event('change'));
        }
        if (rasterChk && !rasterChk.checked) {
          rasterChk.checked = true;
          rasterChk.dispatchEvent(new Event('change'));
        }
      } else {
        if (rasterChk?.checked) {
          rasterChk.checked = false;
          rasterChk.dispatchEvent(new Event('change'));
        }
        if (lgaChk && !lgaChk.checked) {
          lgaChk.checked = true;
          lgaChk.dispatchEvent(new Event('change'));
        }
      }
    });

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
    });

    document.getElementById('lgaBoundaries').addEventListener('change', (e) => {
      if (e.target.checked) {
        // Turn off Emission Surface when LGA Emissions is switched on
        const rasterChk = document.getElementById('rasterLayer');
        if (rasterChk?.checked) {
          rasterChk.checked = false;
          if (this.layers.raster) { this.map.removeLayer(this.layers.raster); this.layers.raster = null; }
          if (this._rasterClickHandler) this.map.off('click', this._rasterClickHandler);
          if (this._geeClickHandler)    this.map.off('click', this._geeClickHandler);
          const legendSub = document.getElementById('legendSub');
          if (legendSub) legendSub.textContent = 'LGA-level · Sentinel-5P';
          this.updateLegend();
        }
        if (!this.map.hasLayer(this.layers.lgas)) this.map.addLayer(this.layers.lgas);
      } else {
        if (this.map.hasLayer(this.layers.lgas)) this.map.removeLayer(this.layers.lgas);
      }
    });

    document.getElementById('landfillsPoints').addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!this.map.hasLayer(this.layers.points)) {
          this.map.addLayer(this.layers.points);
        }
      } else {
        if (this.map.hasLayer(this.layers.points)) {
          this.map.removeLayer(this.layers.points);
        }
      }
    });

    document.getElementById('placesLayer')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (this.layers.places && !this.map.hasLayer(this.layers.places)) {
          this.map.addLayer(this.layers.places);
        }
      } else {
        if (this.layers.places && this.map.hasLayer(this.layers.places)) {
          this.map.removeLayer(this.layers.places);
        }
      }
    });

    document.getElementById('rasterLayer')?.addEventListener('change', async (e) => {
      if (e.target.checked) {
        // Turn off LGA Emissions when Emission Surface is switched on
        const lgaChk = document.getElementById('lgaBoundaries');
        if (lgaChk?.checked) {
          lgaChk.checked = false;
          if (this.map.hasLayer(this.layers.lgas)) this.map.removeLayer(this.layers.lgas);
        }
        await this.addRasterLayer();
        const legendSub = document.getElementById('legendSub');
        if (legendSub) legendSub.textContent = 'Pixel-level · Sentinel-5P';
        // Auto-enable LGA Boundary overlay when switching to raster
        const geeLGAChk = document.getElementById('geeLGALayer');
        if (geeLGAChk && !geeLGAChk.checked) {
          geeLGAChk.checked = true;
          await this.toggleGEELGALayer(true);
        }
      } else if (this.layers.raster) {
        this.map.removeLayer(this.layers.raster);
        this.layers.raster = null;
        this._removeClipMask();
        if (this._rasterClickHandler) this.map.off('click', this._rasterClickHandler);
        if (this._geeClickHandler)    this.map.off('click', this._geeClickHandler);
        // Restore LGA Emissions layer when Emission Surface is turned off
        const lgaChk = document.getElementById('lgaBoundaries');
        if (lgaChk && !lgaChk.checked) {
          lgaChk.checked = true;
          if (!this.map.hasLayer(this.layers.lgas)) this.map.addLayer(this.layers.lgas);
        }
        const legendSub = document.getElementById('legendSub');
        if (legendSub) legendSub.textContent = 'LGA-level · Sentinel-5P';
      }
      this.updateLegend();
    });

    document.getElementById('geeLGALayer')?.addEventListener('change', async (e) => {
      await this.toggleGEELGALayer(e.target.checked);
    });
    document.getElementById('geeLagosLayer')?.addEventListener('change', async (e) => {
      await this.toggleGEELagosLayer(e.target.checked);
    });

    document.getElementById('bufferLayer').addEventListener('change', (e) => {
      const legend = document.getElementById('bufferLegend');
      if (e.target.checked) {
        if (!this.layers.buffers) this.addBufferLayer();
        this.layers.buffers.addTo(this.map);
        if (legend) legend.style.display='block';
      } else if (this.layers.buffers) {
        this.map.removeLayer(this.layers.buffers);
        if (legend) legend.style.display='none';
      }
    });

    document.getElementById('lgaSelect').addEventListener('change', async (e) => {
      if (e.target.value) {
        const feature = this.state.data.lgas.features.find(f => f.properties.lganame === e.target.value);
        if (feature) {
          if (this.state.selectedLayer) {
            const prev = this.state.selectedLayer;
            const prevName = prev.feature?.properties?.lganame;
            const prevEmissions = this.state.data.lgas.features.find(f => f.properties.lganame === prevName);
            const prevVal = prevEmissions ? this.getMetricValue(prevEmissions, this.state.currentMetric, this.state.currentYear) : null;
            prev.setStyle({ weight:2, color:'white', fillOpacity:1, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
          }
          if (this.layers.lgas) {
            this.layers.lgas.eachLayer(l => {
              if (l.feature?.properties?.lganame === e.target.value) {
                const val = this.getMetricValue(feature, this.state.currentMetric, this.state.currentYear);
                l.setStyle({ weight:3, color:'#00d4ff', fillOpacity:1, fillColor: this.getColorForValue(this.state.currentMetric, val), dashArray:'' });
                l.bringToFront();
                this.state.selectedLayer = l;
                const boundary = this.state.data.lgasBoundary?.features?.find(f => f.properties.lganame === e.target.value);
                if (boundary) this.map.fitBounds(L.geoJSON(boundary).getBounds(), { padding:[40,40] });
              }
            });
          }
          // In raster mode: clip mask only — no raster re-render
          if (document.getElementById('rasterLayer')?.checked) {
            this._applyVisualClip(e.target.value);
          }
          this.state.selectedFeature = feature;
          this.updateAnalyticsPanel();
          this._highlightLGA(e.target.value);
          // Refresh SA panel if open
          const saPanel = document.getElementById('saPanel');
          if (saPanel?.classList.contains('open')) {
            const activeTab = document.querySelector('.sa-tab.active')?.dataset?.tab;
            if (activeTab) this.renderSATab(activeTab);
          }
        }
      } else {
        // "All LGAs" selected — remove clip mask, no re-render
        if (document.getElementById('rasterLayer')?.checked) {
          this._applyVisualClip(null);
        }
      }
    });

    document.querySelectorAll('.chart-download, .dl-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.generateReport());
    });
    document.getElementById('generateReportButton')?.addEventListener('click', () => this.generateReport());

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        if      (item.dataset.section === 'reports')  { this.generateReport(); }
        else if (item.dataset.section === 'analysis') { this.closeLandfills(); this.closeSpatialAnalysis(); this.openSpatialAnalysis(); }
        else if (item.dataset.section === 'about')      { this.closeSpatialAnalysis(); this.closeLandfills(); this.openAbout(); }
        else if (item.dataset.section === 'dumpsites')  { this.closeSpatialAnalysis(); this.closeGas(); this.openLandfills(); }
        else if (item.dataset.section === 'gas')        { this.closeSpatialAnalysis(); this.closeLandfills(); this.openGas(); }
        else if (item.dataset.section === 'admin')      { this.openAdminPanel(); }
        else                                            { this.closeSpatialAnalysis(); this.closeLandfills(); this.closeGas(); }
      });
    });
    document.getElementById('saClose')?.addEventListener('click',    () => this.closeSpatialAnalysis());
    document.getElementById('aboutClose')?.addEventListener('click',     () => this.closeAbout());
    document.getElementById('landfillsClose')?.addEventListener('click', () => this.closeLandfills());
    document.getElementById('gasClose')?.addEventListener('click', () => this.closeGas());

    // Gas panel sub-tab switching
    document.querySelectorAll('[data-gas-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-gas-tab]').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.gas-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const el = document.getElementById('gas-' + tab.dataset.gasTab);
        if (el) el.classList.add('active');
        if (tab.dataset.gasTab === 'correlation') this.renderGasCorrelation();
      });
    });

    // Gas correlation axis selectors
    ['gas-corr-x', 'gas-corr-y'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        if (document.getElementById('gas-correlation')?.classList.contains('active')) {
          this.renderGasCorrelation();
        }
      });
    });

    document.getElementById('aboutOverlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeAbout();
    });
    document.querySelectorAll('.sa-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sa-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sa-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const el = document.getElementById('sa-' + tab.dataset.tab);
        if (el) el.classList.add('active');
        this.renderSATab(tab.dataset.tab);
      });
    });
    ['sa-rank-metric','sa-rank-order','sa-anomaly-metric','sa-anomaly-threshold','sa-trend-metric',
     'sa-trend-from','sa-trend-to'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        const activeTab = document.querySelector('.sa-tab.active')?.dataset?.tab;
        if (activeTab) this.renderSATab(activeTab);
      });
    });

    // Live label update for year range sliders
    ['sa-trend-from','sa-trend-to'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        const fromEl = document.getElementById('sa-trend-from');
        const toEl   = document.getElementById('sa-trend-to');
        if (!fromEl || !toEl) return;
        // Clamp: from can't exceed to, to can't be less than from
        if (id === 'sa-trend-from' && parseInt(fromEl.value) > parseInt(toEl.value)) fromEl.value = toEl.value;
        if (id === 'sa-trend-to'   && parseInt(toEl.value) < parseInt(fromEl.value)) toEl.value = fromEl.value;
        const lbl1 = document.getElementById('trendFromLabel');
        const lbl2 = document.getElementById('trendToLabel');
        if (lbl1) lbl1.textContent = fromEl.value;
        if (lbl2) lbl2.textContent = toEl.value;
        this.renderYoYTrend();
      });
    });

    // Search functionality
    document.getElementById('searchButton').addEventListener('click', () => {
      this.searchLocation();
    });

    document.getElementById('locationSearch').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchLocation();
      }
    });

    // Refresh trend + composition charts whenever the map is panned or zoomed
    this.map.on('moveend', () => {
      if (!this.state.data.lgas) return;
      this.updateTrendChart();
      this.updateCompositionChart();
    });
  },

  // Download chart as image
  // ── Spatial Analysis ────────────────────────────────────
  // Load building footprints for analysis only — not shown on map
  async loadBuildingsForAnalysis() {
    if (this.state.buildingsLoaded || this.state.buildingsLoading) return;
    if (!this.state.data.landfills?.features?.length) return;
    this.state.buildingsLoading = true;

    // Bounding box covering all landfills + 1.5km
    let minLat=90, maxLat=-90, minLon=180, maxLon=-180;
    this.state.data.landfills.features.forEach(f => {
      if (!f.geometry) return;
      const [lon, lat] = f.geometry.coordinates;
      minLat = Math.min(minLat, lat - 0.014);
      maxLat = Math.max(maxLat, lat + 0.014);
      minLon = Math.min(minLon, lon - 0.014);
      maxLon = Math.max(maxLon, lon + 0.014);
    });

    const bbox  = `${minLat},${minLon},${maxLat},${maxLon}`;
    const query = `[out:json][timeout:25];(way["building"](${bbox}););out body;>;out skel qt;`;
    const url   = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
      const res  = await fetch(url);
      const data = await res.json();

      const nodes = {};
      data.elements.filter(e => e.type === 'node').forEach(n => { nodes[n.id] = [n.lon, n.lat]; });

      const features = data.elements.filter(e => e.type === 'way' && e.nodes).map(way => {
        const coords = way.nodes.map(id => nodes[id]).filter(Boolean);
        if (coords.length < 3) return null;
        if (coords[0][0] !== coords[coords.length-1][0]) coords.push(coords[0]);
        return { type:'Feature', geometry:{ type:'Polygon', coordinates:[coords] }, properties: way.tags || {} };
      }).filter(Boolean);

      // Store as invisible Leaflet layer for analysis (not added to map)
      this.layers.buildings = L.geoJSON({ type:'FeatureCollection', features }, {
        style: () => ({ fillColor:'#f59e0b', fillOpacity:0.25, color:'#f59e0b', weight:0.8 }),
      });

      this.state.buildingsLoaded = true;
      this.state.buildingsLoading = false;
      console.log(`Buildings loaded for analysis: ${features.length} footprints`);

      // Re-render buffer tab if it's active
      const activeTab = document.querySelector('.sa-tab.active')?.dataset?.tab;
      if (activeTab === 'buffer') this.renderBufferExposure();

    } catch(err) {
      console.warn('Buildings load failed:', err);
      this.state.buildingsLoading = false;
    }
  },

  openSpatialAnalysis() {
    const panel = document.getElementById('saPanel');
    if (panel) {
      panel.classList.add('open');
      const mapTip = document.querySelector('.map-tip'); if (mapTip) mapTip.style.display = 'none';
      this.closeGas();
      this.renderSATab('rankings');
      // Auto-enable buffer layer on map
      const bufferChk = document.getElementById('bufferLayer');
      if (bufferChk && !bufferChk.checked) {
        bufferChk.checked = true;
        if (!this.layers.buffers) this.addBufferLayer();
        else this.layers.buffers.addTo(this.map);
        const legend = document.getElementById('bufferLegend');
        if (legend) legend.style.display = 'block';
      }
      // Silently load building footprints for analysis (not added to map)
      this.loadBuildingsForAnalysis();
    }
  },
  closeSpatialAnalysis() {
    document.getElementById('saPanel')?.classList.remove('open');
    if (!document.getElementById('gasPanel')?.classList.contains('open') &&
        !document.getElementById('landfillsPanel')?.classList.contains('open')) {
      const mapTip = document.querySelector('.map-tip'); if (mapTip) mapTip.style.display = 'block';
    }
    this.closeLandfills?.();
    // Turn buffer layer back off when panel closes
    const bufferChk = document.getElementById('bufferLayer');
    if (bufferChk && bufferChk.checked) {
      bufferChk.checked = false;
      if (this.layers.buffers) this.map.removeLayer(this.layers.buffers);
      const legend = document.getElementById('bufferLegend');
      if (legend) legend.style.display = 'none';
    }
  },
  renderSATab(tab) {
    if (!this.state.data.lgas) return;
    if      (tab === 'rankings') this.renderRankings();
    else if (tab === 'anomaly')  this.renderAnomalies();
    else if (tab === 'buffer')   this.renderBufferExposure();
    else if (tab === 'trend')    this.renderYoYTrend();
  },
  renderRankings() {
    const metric = document.getElementById('sa-rank-metric')?.value || 'ch4';
    const order  = document.getElementById('sa-rank-order')?.value || 'desc';
    const year   = this.state.currentYear;
    const rows = this.state.data.lgas.features.map(f => ({
      name: f.properties.lganame,
      value: this.getMetricValue(f, metric, year) || 0,
      isi:  f.properties[`isi_${year}`] || 0,
    }));
    const sorted = [...rows].sort((a,b) => order === 'desc' ? b.value - a.value : a.value - b.value);
    const avg = rows.reduce((s,r) => s + r.value, 0) / rows.length;
    const tbody = document.getElementById('rankingsBody');
    if (!tbody) return;
    tbody.innerHTML = sorted.map((row, i) => {
      const risk    = this.getEriClassification(row.isi);
      const diff    = avg > 0 ? ((row.value - avg) / avg * 100).toFixed(1) : 0;
      const diffCls = diff > 0 ? 'vs-avg-pos' : 'vs-avg-neg';
      const rankCls = i < 3 ? 'top3' : '';
      const isSelected = row.name === (this.state.selectedFeature?.properties?.lganame || '');
      return `<tr onclick="app.selectLGAByName('${row.name}')" style="${isSelected ? 'background:rgba(0,212,255,0.08);border-left:2px solid #00d4ff' : ''}">
        <td><span class="rank-num ${rankCls}">${i+1}</span></td>
        <td class="lga-name-cell" style="${isSelected ? 'color:#00d4ff' : ''}">${row.name}</td>
        <td class="val-cell">${row.value.toFixed(5)}</td>
        <td><span class="sa-badge ${risk.css}">${risk.label}</span></td>
        <td class="${diffCls}">${diff > 0 ? '+' : ''}${diff}%</td>
      </tr>`;
    }).join('');
  },
  renderAnomalies() {
    const metric    = document.getElementById('sa-anomaly-metric')?.value || 'ch4';
    const threshold = parseFloat(document.getElementById('sa-anomaly-threshold')?.value || 1.5);
    const year      = this.state.currentYear;
    const vals = this.state.data.lgas.features.map(f => ({
      name:  f.properties.lganame,
      value: this.getMetricValue(f, metric, year) || 0,
      isi:   f.properties[`isi_${year}`] || 0,
    }));
    const mean   = vals.reduce((s,v) => s + v.value, 0) / vals.length;
    const stdDev = Math.sqrt(vals.reduce((s,v) => s + Math.pow(v.value - mean, 2), 0) / vals.length);
    const anomalies = vals.map(v => ({ ...v, zScore: stdDev > 0 ? (v.value - mean) / stdDev : 0 }))
      .filter(v => v.zScore > threshold).sort((a,b) => b.zScore - a.zScore);
    const countEl = document.getElementById('anomalyCount');
    if (countEl) countEl.innerHTML = `<span class="count-num">${anomalies.length}</span>
      <span>LGA${anomalies.length !== 1 ? 's' : ''} flagged as anomalous<br/>
      <small style="font-size:10px;color:var(--t2);font-weight:400">Z-score > ${threshold} &nbsp;&middot;&nbsp; Mean: ${mean.toFixed(5)} &nbsp;&middot;&nbsp; StdDev: ${stdDev.toFixed(5)}</small></span>`;
    const tbody = document.getElementById('anomalyBody');
    if (!tbody) return;
    tbody.innerHTML = anomalies.length ? anomalies.map(row => {
      const risk = this.getEriClassification(row.isi);
      const zCls = row.zScore > 2.5 ? 'z-score-high' : 'z-score-med';
      return `<tr onclick="app.selectLGAByName('${row.name}')">
        <td class="lga-name-cell">${row.name}</td>
        <td class="val-cell">${row.value.toFixed(5)}</td>
        <td class="${zCls}">${row.zScore.toFixed(2)}σ</td>
        <td><span class="sa-badge ${risk.css}">${risk.label}</span></td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--t3)">No anomalies at this threshold</td></tr>';
  },
  renderBufferExposure() {
    const year = this.state.currentYear;
    if (!this.state.data.landfills || !this.state.data.lgas) return;
    const list = document.getElementById('bufferExposureList');
    if (!list) return;

    // Count buildings per landfill per buffer zone (if buildings layer loaded)
    const getBuildingCounts = (lfLat, lfLon) => {
      const counts = { b100: 0, b500: 0, b1000: 0 };
      if (!this.layers.buildings) return counts;
      this.layers.buildings.eachLayer(bldg => {
        try {
          const center = bldg.getBounds ? bldg.getBounds().getCenter() : null;
          if (!center) return;
          const d = L.latLng(lfLat, lfLon).distanceTo(center);
          if      (d <= 100)  counts.b100++;
          else if (d <= 500)  counts.b500++;
          else if (d <= 1000) counts.b1000++;
        } catch(e) {}
      });
      return counts;
    };

    // Build per-landfill summary
    const landfillSummaries = this.state.data.landfills.features
      .filter(lf => lf.geometry)
      .map(lf => {
        const [lon, lat] = lf.geometry.coordinates;
        const name = lf.properties.Name || lf.properties.lganame || 'Landfill';
        const counts = getBuildingCounts(lat, lon);
        const total  = counts.b100 + counts.b500 + counts.b1000;
        return { name, lat, lon, counts, total };
      });

    // Show landfill-centric view at top
    const isLoading = this.state.buildingsLoading;
    const hasBldgs  = landfillSummaries.some(s => s.total > 0);
    const bldgSection = isLoading ? `
      <div style="background:var(--accent-d);border:1px solid rgba(0,212,255,0.15);border-radius:var(--r-md);
           padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--t2)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:5px"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg> Loading building footprints… switch back in a moment.
      </div>` : hasBldgs ? `
      <div style="margin-bottom:12px">
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;
             letter-spacing:.8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          Buildings Within Buffer Zones
        </div>
        ${landfillSummaries.map(s => `
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);
               padding:10px 12px;margin-bottom:6px">
            <div style="font-size:12px;font-weight:600;color:var(--t1);margin-bottom:8px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:5px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${s.name}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
              <div style="background:rgba(0,229,160,0.1);border:1px solid rgba(0,229,160,0.25);
                   border-radius:6px;padding:6px;text-align:center">
                <div style="font-size:16px;font-weight:800;color:#00e5a0">${s.counts.b100}</div>
                <div style="font-size:9px;color:var(--t2)">≤ 100 m</div>
              </div>
              <div style="background:rgba(255,181,71,0.1);border:1px solid rgba(255,181,71,0.25);
                   border-radius:6px;padding:6px;text-align:center">
                <div style="font-size:16px;font-weight:800;color:#ffb547">${s.counts.b500}</div>
                <div style="font-size:9px;color:var(--t2)">≤ 500 m</div>
              </div>
              <div style="background:rgba(255,77,106,0.1);border:1px solid rgba(255,77,106,0.25);
                   border-radius:6px;padding:6px;text-align:center">
                <div style="font-size:16px;font-weight:800;color:#ff4d6a">${s.counts.b1000}</div>
                <div style="font-size:9px;color:var(--t2)">≤ 1 km</div>
              </div>
            </div>
            <div style="font-size:10px;color:var(--t2);margin-top:6px;text-align:right">
              ${s.total} total buildings affected
            </div>
          </div>`).join('')}
      </div>` : `
      <div style="background:var(--accent-d);border:1px solid rgba(0,212,255,0.15);border-radius:var(--r-md);
           padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--t2)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:5px"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg> Loading building footprints… switch back to this tab in a moment.
      </div>`;

    // Per-LGA proximity list
    const results = [];
    this.state.data.lgas.features.forEach(f => {
      const lgaName  = f.properties.lganame;
      const centroid = f.geometry ? L.latLng(f.geometry.coordinates[1], f.geometry.coordinates[0]) : null;
      if (!centroid) return;
      let nearestDist = Infinity, nearestName = '';
      this.state.data.landfills.features.forEach(lf => {
        if (!lf.geometry) return;
        const d = centroid.distanceTo(L.latLng(lf.geometry.coordinates[1], lf.geometry.coordinates[0]));
        if (d < nearestDist) { nearestDist = d; nearestName = lf.properties.Name || 'Landfill'; }
      });
      // IN = this LGA contains at least one landfill inside its boundary
      let landfillInLGA = false;
      const lgaBoundary = this.state.data.lgasBoundary?.features?.find(b => b.properties.lganame === lgaName);
      if (lgaBoundary && window.turf) {
        landfillInLGA = this.state.data.landfills.features.some(lf => {
          if (!lf.geometry) return false;
          try {
            return window.turf.booleanPointInPolygon(
              window.turf.point(lf.geometry.coordinates),
              lgaBoundary
            );
          } catch(e) { return false; }
        });
      }
      const isi  = f.properties[`isi_${year}`] || 0;
      const risk = this.getEriClassification(isi);
      let zone, zoneCls;
      if      (nearestDist <= 100)  { zone = '≤ 100 m'; zoneCls = 'zone-100'; }
      else if (nearestDist <= 500)  { zone = '≤ 500 m'; zoneCls = 'zone-500'; }
      else if (nearestDist <= 1000) { zone = '≤ 1 km';  zoneCls = 'zone-1000'; }
      else                          { zone = '> 1 km';   zoneCls = 'zone-out'; }
      results.push({ lgaName, nearestDist, nearestName, zone, zoneCls, risk, landfillInLGA });
    });
    results.sort((a,b) => a.nearestDist - b.nearestDist);

    const lgaSection = `
      <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;
           letter-spacing:.8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">
        LGA Proximity to Landfills
      </div>
      ${results.map(r => `
        <div class="exposure-item" onclick="app.selectLGAByName('${r.lgaName}')">
          <div>
            <div style="display:flex;align-items:center;gap:6px">
            <div class="exposure-lga">${r.lgaName}</div>
            <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px;${r.landfillInLGA ? 'background:rgba(0,212,255,0.15);color:#00d4ff;border:1px solid rgba(0,212,255,0.3)' : 'background:var(--surface-3);color:var(--t3);border:1px solid var(--border)'}">${r.landfillInLGA ? 'IN LGA' : 'OUTSIDE'}</span>
          </div>
          <div class="exposure-detail">${r.nearestName} · ${Math.round(r.nearestDist).toLocaleString()} m</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="exposure-zone ${r.zoneCls}">${r.zone}</span>
            <span class="sa-badge ${r.risk.css}" style="font-size:8px">${r.risk.label}</span>
          </div>
        </div>`).join('')}`;

    list.innerHTML = bldgSection + lgaSection;
  },
  renderYoYTrend() {
    const metric   = document.getElementById('sa-trend-metric')?.value || 'ch4';
    const fromYear = parseInt(document.getElementById('sa-trend-from')?.value || '2018');
    const toYear   = parseInt(document.getElementById('sa-trend-to')?.value   || '2025');
    const dispYears = [];
    for (let y = fromYear; y <= toYear; y++) dispYears.push(String(y));

    // Update table header dynamically
    const thead = document.getElementById('trendHead');
    if (thead) {
      thead.innerHTML = '<tr><th>LGA</th>' +
        dispYears.map(y => `<th>${y}</th>`).join('') +
        '<th>Change</th></tr>';
    }

    const tbody = document.getElementById('trendBody');
    if (!tbody) return;

    const rows = this.state.data.lgas.features.map(f => {
      const vals  = dispYears.map(y => this.getMetricValue(f, metric, y) || 0);
      const first = vals[0], last = vals[vals.length - 1];
      const change = first !== 0 ? ((last - first) / first * 100).toFixed(1) : 0;
      return { name: f.properties.lganame, vals, change: Number(change) };
    }).sort((a,b) => Math.abs(b.change) - Math.abs(a.change));

    // Compute min/max for cell colour scaling
    const allVals  = rows.flatMap(r => r.vals);
    const minVal   = Math.min(...allVals);
    const maxVal   = Math.max(...allVals);
    const range    = maxVal - minVal || 1;

    // Map value → colour: low=green (#16a34a), mid=amber (#ca8a04), high=red (#dc2626)
    const valToColor = (v) => {
      const t = (v - minVal) / range; // 0→1
      if (t < 0.33)      return `rgba(22,163,74,${0.15 + t*0.5})`;   // green
      else if (t < 0.66) return `rgba(202,138,4,${0.15 + t*0.5})`;   // amber
      else               return `rgba(220,38,38,${0.15 + t*0.5})`;    // red
    };

    const valToTextColor = (v) => {
      const t = (v - minVal) / range;
      if (t < 0.33) return '#16a34a';
      else if (t < 0.66) return '#ca8a04';
      else return '#dc2626';
    };

    const isSelected = (name) => name === (this.state.selectedFeature?.properties?.lganame || '');

    tbody.innerHTML = rows.map(row => {
      // Change column: positive = bad (red), negative = good (green)
      const chgColor = row.change > 0 ? '#dc2626' : row.change < 0 ? '#16a34a' : '#7a8fa8';
      const arrow    = row.change > 0 ? '↑' : row.change < 0 ? '↓' : '→';
      const chgBg    = row.change > 0 ? 'rgba(220,38,38,0.1)' : row.change < 0 ? 'rgba(22,163,74,0.1)' : 'transparent';
      const cells    = row.vals.map(v =>
        `<td style="color:${valToTextColor(v)};font-weight:600;font-size:10px">${v.toFixed(4)}</td>`
      ).join('');
      const selStyle = isSelected(row.name) ? 'border-left:2px solid #00d4ff;' : '';
      return `<tr onclick="app.selectLGAByName('${row.name}')" style="${selStyle}">
        <td class="lga-name-cell" style="${isSelected(row.name)?'color:#00d4ff':''}">${row.name}</td>
        ${cells}
        <td style="background:${chgBg};color:${chgColor};font-weight:700;font-size:11px;text-align:center">
          ${arrow} ${Math.abs(row.change)}%
        </td>
      </tr>`;
    }).join('');
  },
  // Always-on LGA highlight overlay — works regardless of which layers are active
  _highlightLGA(lgaName) {
    this._clearLGAHighlight();
    const boundary = this.state.data.lgasBoundary?.features?.find(b => b.properties.lganame === lgaName);
    if (!boundary) return;
    this.layers.lgaHighlight = L.geoJSON(boundary, {
      style: {
        color: '#00d4ff',
        weight: 3,
        opacity: 1,
        fillColor: '#00d4ff',
        fillOpacity: 0.10,
        dashArray: '',
        lineJoin: 'round',
      },
      interactive: false,
    }).addTo(this.map);
    this.layers.lgaHighlight.bringToFront();
  },

  _clearLGAHighlight() {
    if (this.layers.lgaHighlight) {
      this.map.removeLayer(this.layers.lgaHighlight);
      this.layers.lgaHighlight = null;
    }
  },

  selectLGAByName(lgaName, fitBounds = true) {
    const feature = this.state.data.lgas.features.find(f => f.properties.lganame === lgaName);
    if (!feature) return;
    if (this.state.selectedLayer) {
      const prev = this.state.selectedLayer;
      const prevName = prev.feature?.properties?.lganame;
      const prevEmissions = this.state.data.lgas.features.find(f => f.properties.lganame === prevName);
      const prevVal = prevEmissions ? this.getMetricValue(prevEmissions, this.state.currentMetric, this.state.currentYear) : null;
      prev.setStyle({ weight:2, color:'white', fillOpacity:1, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
    }
    if (this.layers.lgas) {
      this.layers.lgas.eachLayer(l => {
        if (l.feature?.properties?.lganame === lgaName) {
          const val = this.getMetricValue(feature, this.state.currentMetric, this.state.currentYear);
          l.setStyle({ weight:3, color:'#00d4ff', fillOpacity:1, fillColor: this.getColorForValue(this.state.currentMetric, val), dashArray:'' });
          l.bringToFront();
          this.state.selectedLayer = l;
          const boundary = this.state.data.lgasBoundary?.features?.find(f => f.properties.lganame === lgaName);
          if (boundary && fitBounds) this.map.fitBounds(L.geoJSON(boundary).getBounds(), { padding:[40,40] });
        }
      });
    }
    this.state.selectedFeature = feature;
    this.updateAnalyticsPanel();
    this._highlightLGA(lgaName);
    if (document.getElementById('rasterLayer')?.checked) this._applyVisualClip(lgaName);
  },


  openGas() {
    const panel = document.getElementById('gasPanel');
    if (panel) {
      panel.classList.add('open');
      const mapTip = document.querySelector('.map-tip'); if (mapTip) mapTip.style.display = 'none';
      this.renderGasTemporal();
    }
  },
  closeGas() {
    document.getElementById('gasPanel')?.classList.remove('open');
    if (!document.getElementById('saPanel')?.classList.contains('open') &&
        !document.getElementById('landfillsPanel')?.classList.contains('open')) {
      const mapTip = document.querySelector('.map-tip'); if (mapTip) mapTip.style.display = 'block';
    }
  },

  renderGasTemporal() {
    if (!this.state.data.lgas) return;
    const years   = this.getYears();
    const metrics = [
      { key:'ch4', label:'CH₄', color:'#3b82f6', bg:'rgba(59,130,246,0.08)' },
      { key:'no2', label:'NO₂', color:'#10b981', bg:'rgba(16,185,129,0.08)' },
      { key:'co',  label:'CO',       color:'#f59e0b', bg:'rgba(245,158,11,0.08)' },
    ];
    const feats = this.state.data.lgas.features;

    // Compute statewide average per gas per year
    const datasets = metrics.map(m => ({
      label: m.label,
      data: years.map(y => {
        const vals = feats.map(f => this.getMetricValue(f, m.key, y) || 0).filter(v => v > 0);
        return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
      }),
      borderColor: m.color,
      backgroundColor: m.bg,
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 4,
      fill: true,
    }));

    const ctx = document.getElementById('gasTemporalChart');
    if (!ctx) return;
    if (this.charts.gasTemporal) { this.charts.gasTemporal.destroy(); }
    this.charts.gasTemporal = new Chart(ctx, {
      type: 'line',
      data: { labels: years, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position:'top', labels:{ font:{size:10}, usePointStyle:true, padding:12, color:'#7a8fa8' } },
          tooltip: { mode:'index', intersect:false }
        },
        scales: {
          y: { beginAtZero: true, ticks:{ font:{size:9}, color:'#7a8fa8' }, grid:{ color:'rgba(255,255,255,0.04)' },
               title:{ display:true, text:'mol/m²', font:{size:9}, color:'#7a8fa8' } },
          x: { ticks:{ font:{size:9}, color:'#7a8fa8' }, grid:{ display:false } }
        }
      }
    });

    // Summary cards — latest year trend per gas
    const grid = document.getElementById('gasSummaryGrid');
    if (!grid) return;
    grid.innerHTML = metrics.map(m => {
      const series = datasets.find(d => d.label === m.label).data;
      const v2025 = series[series.length - 1] || 0;
      const v2018 = series[0] || 0;
      const pct   = v2018 > 0 ? ((v2025 - v2018) / v2018 * 100).toFixed(1) : 0;
      const up    = pct > 0;
      return `<div class="gas-sum-card">
        <div class="gas-sum-sym" style="color:${m.color}">${m.label}</div>
        <div class="gas-sum-val">${v2025.toFixed(5)}</div>
        <div class="gas-sum-unit">mol/m² avg (2025)</div>
        <div class="gas-sum-chg" style="color:${up?'#ff4d6a':'#00e5a0'}">
          ${up?'↑':'↓'} ${Math.abs(pct)}% since 2018
        </div>
      </div>`;
    }).join('');
  },

  renderGasCorrelation() {
    if (!this.state.data.lgas) return;
    const year  = this.state.currentYear;
    const feats = this.state.data.lgas.features;

    const xKey = document.getElementById('gas-corr-x')?.value || 'ch4';
    const yKey = document.getElementById('gas-corr-y')?.value || 'co';
    const gasLabels  = { ch4: 'CH₄', no2: 'NO₂', co: 'CO' };
    const gasColors  = { ch4: '#3b82f6', no2: '#10b981', co: '#f59e0b' };
    const xLabel = gasLabels[xKey] || xKey.toUpperCase();
    const yLabel = gasLabels[yKey] || yKey.toUpperCase();
    const allKeys = ['ch4', 'no2', 'co'];
    const thirdKey = allKeys.find(g => g !== xKey && g !== yKey) || null;
    const thirdLabel = thirdKey ? gasLabels[thirdKey] : null;

    // Build scatter points using the selected X / Y gases
    const points = feats.map(f => ({
      x:    this.getMetricValue(f, xKey, year) || 0,
      y:    this.getMetricValue(f, yKey, year) || 0,
      isi:  f.properties[`isi_${year}`] || 0,
      name: f.properties.lganame,
    })).filter(p => p.x > 0 && p.y > 0);

    // Compute mean + stddev for outlier detection
    const meanX = points.reduce((s,p) => s+p.x, 0) / points.length;
    const meanY = points.reduce((s,p) => s+p.y, 0) / points.length;
    const stdX  = Math.sqrt(points.reduce((s,p) => s+Math.pow(p.x-meanX,2),0)/points.length);
    const stdY  = Math.sqrt(points.reduce((s,p) => s+Math.pow(p.y-meanY,2),0)/points.length);

    const selectedName = this.state.selectedFeature?.properties?.lganame || '';
    const ptColor = (p) => {
      if (p.name === selectedName) return '#00d4ff';
      const zx = Math.abs((p.x - meanX) / (stdX || 1));
      const zy = Math.abs((p.y - meanY) / (stdY || 1));
      return (zx > 1.5 || zy > 1.5) ? '#ff4d6a' : 'rgba(0,212,255,0.5)';
    };

    const ctx = document.getElementById('gasCorrelationChart');
    if (!ctx) return;
    if (this.charts.gasCorrelation) { this.charts.gasCorrelation.destroy(); }

    this.charts.gasCorrelation = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: `${xLabel} vs ${yLabel} (${year})`,
          data: points,
          backgroundColor: points.map(ptColor),
          pointRadius: 6,
          pointHoverRadius: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => {
                const p = c.raw;
                return [`${p.name}`, `${xLabel}: ${p.x.toFixed(5)}`, `${yLabel}: ${p.y.toFixed(5)}`];
              }
            }
          }
        },
        scales: {
          x: { title:{ display:true, text:`${xLabel} (mol/m²)`, color:'#7a8fa8', font:{size:10} },
               ticks:{ color:'#7a8fa8', font:{size:9} }, grid:{ color:'rgba(255,255,255,0.04)' } },
          y: { title:{ display:true, text:`${yLabel} (mol/m²)`, color:'#7a8fa8', font:{size:10} },
               ticks:{ color:'#7a8fa8', font:{size:9} }, grid:{ color:'rgba(255,255,255,0.04)' } }
        },
        onClick: (e, els) => {
          if (els.length) this.selectLGAByName(points[els[0].index].name);
        }
      }
    });

    // Update table header to match selected gases
    const tHead = document.getElementById('correlationHead');
    if (tHead) {
      tHead.innerHTML = `<tr><th>LGA</th><th>${xLabel}</th><th>${yLabel}</th>${thirdLabel ? `<th>${thirdLabel}</th>` : ''}<th>ISI</th></tr>`;
    }

    // Table: sorted by distance from cluster mean (outliers first)
    const sorted = [...points].sort((a,b) => {
      const da = Math.sqrt(Math.pow((a.x-meanX)/(stdX||1),2)+Math.pow((a.y-meanY)/(stdY||1),2));
      const db = Math.sqrt(Math.pow((b.x-meanX)/(stdX||1),2)+Math.pow((b.y-meanY)/(stdY||1),2));
      return db - da;
    });

    const tbody = document.getElementById('correlationBody');
    if (tbody) {
      tbody.innerHTML = sorted.map(p => {
        const isOut = Math.abs((p.x-meanX)/(stdX||1))>1.5 || Math.abs((p.y-meanY)/(stdY||1))>1.5;
        const isSel = p.name === selectedName;
        const risk  = this.getEriClassification(p.isi);
        const feat  = feats.find(f => f.properties.lganame === p.name);
        const thirdVal = thirdKey && feat ? this.getMetricValue(feat, thirdKey, year) : null;
        const thirdCell = thirdLabel
          ? `<td style="color:${gasColors[thirdKey]};font-size:10px;font-weight:600">${thirdVal ? thirdVal.toFixed(5) : '-'}</td>`
          : '';
        return `<tr onclick="app.selectLGAByName('${p.name}')" style="${isSel?'border-left:2px solid #00d4ff':''}">
          <td class="lga-name-cell" style="${isSel?'color:#00d4ff':isOut?'color:#ff4d6a':''}">${p.name}${isOut?' <span style="font-size:9px;color:#ff4d6a">anomaly</span>':''}</td>
          <td style="color:${gasColors[xKey]};font-size:10px;font-weight:600">${p.x.toFixed(5)}</td>
          <td style="color:${gasColors[yKey]};font-size:10px;font-weight:600">${p.y.toFixed(5)}</td>
          ${thirdCell}
          <td><span class="sa-badge ${risk.css}" style="font-size:8px">${risk.label}</span></td>
        </tr>`;
      }).join('');
    }

    // ── Contextual interpretation cards for outliers ──
    const interpEl = document.getElementById('correlationInterpretation');
    if (interpEl) {
      const outliers = points.filter(p => {
        const zx = (p.x - meanX) / (stdX || 1);
        const zy = (p.y - meanY) / (stdY || 1);
        return Math.abs(zx) > 1.5 || Math.abs(zy) > 1.5;
      });

      if (!outliers.length) {
        interpEl.innerHTML = '';
      } else {
        const noteText = 'Note: Anomalous readings may also result from agricultural burning, vehicular congestion, wind direction, or other environmental factors. Field verification is recommended before attributing anomalies to a single source.';
        const cards = outliers.map(p => {
          const zx   = (p.x - meanX) / (stdX || 1);
          const zy   = (p.y - meanY) / (stdY || 1);
          const highX = zx > 1.5, lowX  = zx < -1.5;
          const highY = zy > 1.5, lowY  = zy < -1.5;

          let bodyText;
          if ((highX || lowX) && (highY || lowY)) {
            if (highX && highY) {
              bodyText = `Elevated ${xLabel} and ${yLabel} levels may indicate landfill emissions, vehicular congestion, industrial activity, or waste burning in this area.`;
            } else if (lowX && lowY) {
              bodyText = `Unusually low emissions relative to the Lagos average may reflect atypical atmospheric dispersion, low urban density, or limited combustion activity.`;
            } else {
              bodyText = `Elevated ${highX ? xLabel : yLabel} relative to ${highX ? yLabel : xLabel} suggests an atypical gas profile — possible source differentiation between combustion and decomposition processes.`;
            }
          } else if (highX || highY) {
            const hiGas = highX ? xLabel : yLabel;
            const loGas = highX ? yLabel : xLabel;
            bodyText = `Elevated ${hiGas} relative to ${loGas} suggests an atypical gas profile — possible source differentiation between combustion and decomposition processes.`;
          } else {
            bodyText = `Unusually low emissions relative to the Lagos average may reflect atypical atmospheric dispersion, low urban density, or limited combustion activity.`;
          }

          const statusParts = [];
          if (highX) statusParts.push(`HIGH ${xLabel}`);
          else if (lowX) statusParts.push(`LOW ${xLabel}`);
          if (highY) statusParts.push(`HIGH ${yLabel}`);
          else if (lowY) statusParts.push(`LOW ${yLabel}`);

          return `<div class="corr-card">
            <div class="corr-card-lga">${p.name} <span style="font-size:9px;font-weight:400;color:var(--t2)">(${statusParts.join(', ')})</span></div>
            <div>${bodyText}</div>
            <div class="corr-card-note">${noteText}</div>
          </div>`;
        }).join('');

        interpEl.innerHTML = `<div style="font-size:10px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin:10px 0 6px">Outlier Interpretations</div>${cards}`;
      }
    }
  },



  // ── Raster layer ─────────────────────────────────────────
  // Band index: 1=CH4(ppb), 2=NO2(mol/m²), 3=CO(mol/m²), 4=ISI, 5=Hotspots
  BAND_INDEX: { ch4: 0, no2: 1, co: 2, isi: 3, hotspots: 4 },

  CH4_PPB_TO_MOL: 2.1e-5, // conversion factor ppb → mol/m²


  // ── GEE Server integration ────────────────────────────
  async initGEEMode() {
    try {
      const resp = await fetch('http://localhost:5001/health', { signal: AbortSignal.timeout(2000) });
      if (resp.ok) {
        const health = await resp.json();
        if (Array.isArray(health.years)) {
          const wasOnLatestYear = String(this.state.currentYear) === this.getLatestYear();
          this.setAvailableYears(health.years);
          if (wasOnLatestYear) {
            this.state.currentYear = this.getLatestYear();
            this.setAvailableYears(this.getYears());
          }
        }
        this.state.geeMode = true;
        console.log('✅ GEE server detected — using live tiles');
        const indicator = document.getElementById('gee-indicator');
        if (indicator) indicator.style.display = 'flex';
        const badge = document.getElementById('gee-layer-badge');
        if (badge) badge.style.display = 'inline';
        // Load GEE stats in the background; local GeoJSON keeps startup fast.
        this.loadDataFromGEE().then((loaded) => {
          if (loaded) this.updateDashboard();
        });
      }
    } catch(e) {
      this.state.geeMode = false;
      console.log('ℹ️ GEE server not running — using local rasters');
    }
  },

  async getGEETileURL(metric, year) {
    const endpointTemplate = this.state.geeTileEndpointTemplate;
    const endpoints = endpointTemplate
      ? [endpointTemplate.replace('{metric}', metric).replace('{year}', year)]
      : this.state.geeRasterSource === 'computed'
      ? [`tiles/${metric}/${year}`]
      : [`asset-tiles/${metric}/${year}?asset=stack`, `asset-tiles/${metric}/${year}`, `tiles/${metric}/${year}`];

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const resp = await fetch(`${this.state.GEE_SERVER}/${endpoint}`, {
          signal: AbortSignal.timeout(12000),
        });
        const data = await resp.json();
        if (resp.ok && !data.error && data.url) {
          if (!this.state.geeTileEndpointTemplate) {
            this.state.geeTileEndpointTemplate = endpoint
              .replace(metric, '{metric}')
              .replace(String(year), '{year}');
          }
          return data.url;
        }
        lastError = data.error || `GEE tile request failed: ${endpoint}`;
      } catch (e) {
        lastError = e.message;
      }
    }
    throw new Error(lastError || 'GEE tile request failed');
  },

  async getGEEPixelValues(lat, lng, year) {
    const resp = await fetch(`${this.state.GEE_SERVER}/pixel?lat=${lat}&lng=${lng}&year=${year}`);
    return await resp.json();
  },

  async getGEETrend(lat, lng) {
    const resp = await fetch(`${this.state.GEE_SERVER}/trend?lat=${lat}&lng=${lng}`);
    return await resp.json();
  },


  async loadDataFromGEE() {
    // Load all 8 years of LGA stats from GEE in parallel
    const years = this.getYears();
    const statusEl = document.getElementById('gee-indicator');

    try {
      // Fetch current year first for fast initial render
      const curYear = parseInt(this.state.currentYear);
      const resp = await fetch(`${this.state.GEE_SERVER}/lga-stats/${curYear}`);
      if (!resp.ok) throw new Error('GEE stats failed');
      const stats = await resp.json();
      if (!Array.isArray(stats)) throw new Error('Invalid GEE response');

      // Build lga features from GEE stats
      this.buildLGAFeaturesFromGEE(stats, curYear);

      // Load remaining years in background
      for (const yr of years) {
        if (parseInt(yr) === curYear) continue;
        fetch(`${this.state.GEE_SERVER}/lga-stats/${yr}`)
          .then(r => r.json())
          .then(data => {
            if (Array.isArray(data)) {
              this.mergeGEEYearData(data, parseInt(yr));
            }
          }).catch(e => console.warn(`GEE stats ${yr}:`, e));
      }

      console.log('✅ LGA data loaded from GEE');
      return true;
    } catch(e) {
      console.warn('GEE data load failed, using local files:', e);
      return false;
    }
  },

  buildLGAFeaturesFromGEE(stats, year) {
    // Build/update lga features using GEE data
    if (!this.state.data.lgas) {
      this.state.data.lgas = { type: 'FeatureCollection', features: [] };
    }
    stats.forEach(s => {
      let feat = this.state.data.lgas.features.find(
        f => f.properties.lganame?.toLowerCase() === s.lga_name?.toLowerCase()
      );
      if (!feat) {
        feat = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
          properties: { lganame: s.lga_name }
        };
        this.state.data.lgas.features.push(feat);
      }
      const yr = String(year);
      feat.properties[`ch4_${yr}`] = s.ch4;
      feat.properties[`no2_${yr}`] = s.no2;
      feat.properties[`co_${yr}`]  = s.co;
      feat.properties[`isi_${yr}`] = s.isi;
      feat.properties[`hotspots_${yr}`] = s.hotspots;
    });
  },

  mergeGEEYearData(stats, year) {
    stats.forEach(s => {
      const feat = this.state.data.lgas?.features?.find(
        f => f.properties.lganame?.toLowerCase() === s.lga_name?.toLowerCase()
      );
      if (!feat) return;
      const yr = String(year);
      feat.properties[`ch4_${yr}`] = s.ch4;
      feat.properties[`no2_${yr}`] = s.no2;
      feat.properties[`co_${yr}`]  = s.co;
      feat.properties[`isi_${yr}`] = s.isi;
      feat.properties[`hotspots_${yr}`] = s.hotspots;
    });
    // Refresh charts if this year is currently selected
    if (String(year) === this.state.currentYear) {
      this.updateCharts();
      this.updateKPIs();
    }
  },

  getAOIMask() {
    const boundary = this.state.data.lgasBoundary;
    if (!boundary?.features?.length) return null;
    if (this.state.rasterClipLGA) {
      const f = boundary.features.find(f => f.properties.lganame === this.state.rasterClipLGA);
      if (f) return f;
    }
    return boundary.features.length === 1 ? boundary.features[0] : boundary;
  },

  async applyRasterClip(lgaName) {
    // Evict cached overlays rendered under the old clip so they are re-rendered
    // with the new AOI on next load.  Cache keys: "year_metric" (no clip) or
    // "year_metric_LGAName" (clipped).  Since metric names never contain '_',
    // unclipped keys have exactly one '_'; clipped keys end with '_<LGA>'.
    const oldClip = this.state.rasterClipLGA;
    if (oldClip !== (lgaName || null)) {
      if (oldClip) {
        Object.keys(this._overlayCache).forEach(k => {
          if (k.endsWith('_' + oldClip)) delete this._overlayCache[k];
        });
      } else {
        // Switching from unclipped to clipped — evict unclipped entries
        Object.keys(this._overlayCache).forEach(k => {
          if (!k.slice(k.indexOf('_') + 1).includes('_')) delete this._overlayCache[k];
        });
      }
    }
    this.state.rasterClipLGA = lgaName || null;
    this._updateClipButton();
    if (document.getElementById('rasterLayer')?.checked) {
      await this.addRasterLayer();
    }
    if (lgaName) {
      const boundary = this.state.data.lgasBoundary?.features?.find(f => f.properties.lganame === lgaName);
      if (boundary) this.map.fitBounds(L.geoJSON(boundary).getBounds(), { padding: [40, 40] });
    }
  },

  // Apply clip mask visually without re-rendering the raster overlay.
  // Used when LGA is selected/searched so the raster image is preserved and
  // only the mask layer swaps.  Full re-render (applyRasterClip) is reserved
  // for the explicit clip button and metric/year changes.
  _applyVisualClip(lgaName) {
    const oldClip = this.state.rasterClipLGA;
    if (oldClip !== (lgaName || null)) {
      if (oldClip) {
        Object.keys(this._overlayCache).forEach(k => {
          if (k.endsWith('_' + oldClip)) delete this._overlayCache[k];
        });
      } else {
        Object.keys(this._overlayCache).forEach(k => {
          if (!k.slice(k.indexOf('_') + 1).includes('_')) delete this._overlayCache[k];
        });
      }
    }
    this.state.rasterClipLGA = lgaName || null;
    this._updateClipButton();
    this._removeClipMask();
    if (lgaName) this._addClipMask(lgaName);
  },

  _updateClipButton() {
    const btn = document.getElementById('draw-clip-btn');
    if (!btn) return;
    const isClipped = !!this.state.rasterClipLGA;
    btn.classList.toggle('active', isClipped);
    btn.title = isClipped
      ? `Clipped to ${this.state.rasterClipLGA} — click to reset`
      : 'Clip raster to selected LGA';
  },

  _addClipMask(lgaName) {
    this._removeClipMask();
    if (!lgaName || !window.turf) return;
    const lgaFeat = this.state.data.lgasBoundary?.features?.find(f => f.properties.lganame === lgaName);
    if (!lgaFeat) return;
    try {
      const world   = turf.bboxPolygon([-180, -90, 180, 90]);
      const inverse = turf.difference(world, lgaFeat);
      if (!inverse) return;
      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#070c14';
      this.layers.clipMask = L.geoJSON(inverse, {
        style: { fillColor: bgColor, fillOpacity: 1, stroke: false, weight: 0, interactive: false },
      }).addTo(this.map);
      // Keep overlay layers on top
      if (this.layers.geeLGALabels) this.layers.geeLGALabels.bringToFront();
      if (this.layers.lagosStateBoundary) this.layers.lagosStateBoundary.bringToFront();
      if (this.layers.points) this.layers.points.bringToFront();
    } catch(e) { console.warn('Clip mask error:', e); }
  },

  _removeClipMask() {
    if (this.layers.clipMask) {
      this.map.removeLayer(this.layers.clipMask);
      this.layers.clipMask = null;
    }
  },

  isPointInsideAOI(lat, lng) {
    if (!this.state.data.lgasBoundary || !window.turf) return true;
    const pt = window.turf.point([lng, lat]);
    return this.state.data.lgasBoundary.features.some(f => {
      try { return window.turf.booleanPointInPolygon(pt, f); } catch(e) { return false; }
    });
  },

  async loadRaster(year) {
    if (this.state.rasterData[year]) return this.state.rasterData[year];
    const path = `data/rasters/Lagos_Gases_${year}.tif`;
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Not found');
      const arrayBuffer = await response.arrayBuffer();
      const georaster = await parseGeoraster(arrayBuffer);
      this.state.rasterData[year] = georaster;
      return georaster;
    } catch(e) {
      console.warn(`Raster not found for ${year}:`, e);
      return null;
    }
  },


  async fetchGEETileLayer(endpoint, cacheKey) {
    try {
      const resp = await fetch(`${this.state.GEE_SERVER}/${endpoint}`);
      const data = await resp.json();
      if (data.error || !data.url) return null;
      return L.tileLayer(data.url, { opacity: 0.85, pane: 'overlayPane' });
    } catch(e) {
      console.warn(`GEE layer ${endpoint} failed:`, e);
      return null;
    }
  },

  async toggleGEELGALayer(on) {
    if (!on) {
      if (this.layers.geeLGA) { this.map.removeLayer(this.layers.geeLGA); this.layers.geeLGA = null; }
      this._removeGEELGALabels();
      return;
    }
    // GEE tile overlay (only when GEE server is live)
    if (this.state.geeMode) {
      if (this.layers.geeLGA) {
        this.layers.geeLGA.addTo(this.map);
      } else {
        const layer = await this.fetchGEETileLayer('lga-boundary-tiles');
        if (layer) {
          this.layers.geeLGA = layer;
          this.layers.geeLGA.addTo(this.map);
        }
      }
    }
    // Label overlay — always added from local GeoJSON, works in both modes
    this._addGEELGALabels();
    if (this.layers.lgas)         this.layers.lgas.bringToFront();
    if (this.layers.geeLGALabels) this.layers.geeLGALabels.bringToFront();
    if (this.layers.points)       this.layers.points.bringToFront();
  },

  _addGEELGALabels() {
    if (this.layers.geeLGALabels) return;
    if (!this.state.data.lgasBoundary) return;
    this.layers.geeLGALabels = L.geoJSON(this.state.data.lgasBoundary, {
      style: () => ({ fillOpacity: 0, color: 'transparent', weight: 0, interactive: false }),
      onEachFeature: (feature, layer) => {
        const name = feature.properties.lganame || '';
        layer.bindTooltip(name, {
          permanent: true,
          direction: 'center',
          className: 'lga-label gee-lga-label',
        });
      },
    }).addTo(this.map);
  },

  _removeGEELGALabels() {
    if (this.layers.geeLGALabels) {
      this.map.removeLayer(this.layers.geeLGALabels);
      this.layers.geeLGALabels = null;
    }
  },

  async toggleGEELagosLayer(on) {
    if (!on) {
      if (this.layers.geeLagos) { this.map.removeLayer(this.layers.geeLagos); this.layers.geeLagos = null; }
      if (this.layers.lagosStateBoundary) { this.map.removeLayer(this.layers.lagosStateBoundary); this.layers.lagosStateBoundary = null; }
      return;
    }
    // GEE tile overlay (only when GEE server is live)
    if (this.state.geeMode) {
      if (!this.layers.geeLagos) {
        const layer = await this.fetchGEETileLayer('lagos-boundary-tiles');
        if (layer) { this.layers.geeLagos = layer; this.layers.geeLagos.addTo(this.map); }
      } else {
        this.layers.geeLagos.addTo(this.map);
      }
    }
    // Local vector boundary — modern styling, always works (no GEE dependency)
    if (!this.layers.lagosStateBoundary && this.state.data.lgasBoundary?.features?.length && window.turf) {
      let union = null;
      for (const f of this.state.data.lgasBoundary.features) {
        if (!f.geometry) continue;
        try {
          const feat = { type: 'Feature', geometry: f.geometry, properties: {} };
          union = union ? turf.union(union, feat) : feat;
        } catch(e) {}
      }
      if (union) {
        this.layers.lagosStateBoundary = L.geoJSON(union, {
          style: {
            color: '#fbbf24',    // amber gold — modern, warm, high-contrast on dark maps
            weight: 2.5,
            opacity: 0.95,
            fillOpacity: 0,
            dashArray: '10 5',
            lineJoin: 'round',
          },
          interactive: false,
        }).addTo(this.map);
      }
    } else if (this.layers.lagosStateBoundary) {
      this.layers.lagosStateBoundary.addTo(this.map);
    }
    if (this.layers.lgas)             this.layers.lgas.bringToFront();
    if (this.layers.geeLGALabels)     this.layers.geeLGALabels.bringToFront();
    if (this.layers.lgaHighlight)     this.layers.lgaHighlight.bringToFront();
    if (this.layers.points)           this.layers.points.bringToFront();
  },

  async toggleGEEHotspotsLayer(on) {
    if (!this.state.geeMode) return;
    if (!on) {
      if (this.layers.geeHotspots) { this.map.removeLayer(this.layers.geeHotspots); this.layers.geeHotspots = null; }
      return;
    }
    const year = this.state.currentYear;
    const endpoint = `tiles/hotspots/${year}`;
    const layer = await this.fetchGEETileLayer(endpoint);
    if (layer) {
      if (this.layers.geeHotspots) this.map.removeLayer(this.layers.geeHotspots);
      this.layers.geeHotspots = layer;
      this.layers.geeHotspots.setOpacity(0.7);
      this.layers.geeHotspots.addTo(this.map);
      if (this.layers.lgas)   this.layers.lgas.bringToFront();
      if (this.layers.points) this.layers.points.bringToFront();
    }
  },

  async addRasterLayer() {
    if (this.layers.raster) {
      this.map.removeLayer(this.layers.raster);
      this.layers.raster = null;
    }
    this._removeClipMask();
    const year   = this.state.currentYear;
    const metric = this.state.currentMetric;
    const metricName = { ch4:'CH₄', no2:'NO₂', co:'CO', isi:'ISI', hotspots:'Hotspots' }[metric] || metric.toUpperCase();

    // Show "Rendering…" pill immediately so the user knows work is happening
    document.getElementById('raster-loading-toast')?.remove();
    const loadingToast = document.createElement('div');
    loadingToast.id = 'raster-loading-toast';
    loadingToast.style.cssText = [
      'position:fixed', 'bottom:28px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(7,12,20,0.92)', 'border:1px solid rgba(0,212,255,0.35)',
      'color:#00d4ff', 'padding:9px 18px', 'border-radius:99px',
      'font-size:12px', 'font-weight:600', 'z-index:9999',
      'display:flex', 'align-items:center', 'gap:8px',
      'pointer-events:none', 'white-space:nowrap',
    ].join(';');
    loadingToast.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#00d4ff;animation:pulse 1.5s infinite;flex-shrink:0"></span>Rendering ${metricName} · ${year}…`;
    document.body.appendChild(loadingToast);

    // Safety: remove the toast after 60 s even if the load event never fires
    const toastTimer = setTimeout(() => document.getElementById('raster-loading-toast')?.remove(), 60000);

    const onRasterLoad = () => {
      clearTimeout(toastTimer);
      document.getElementById('raster-loading-toast')?.remove();
      this.showNotification(`Raster loaded — ${metricName} · ${year}`, 'success');
    };

    const georaster = await this.loadRaster(year);
    if (!georaster) {
      clearTimeout(toastTimer);
      document.getElementById('raster-loading-toast')?.remove();
      return;
    }

    const bandIdx = this.BAND_INDEX[metric] ?? 0;
    const aoiMask = this.getAOIMask();

    // Colour scales per metric — pre-convert hex stops to [r,g,b] arrays once
    const hexToRgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const scales = {
      ch4: { min: 1750, max: 2100, colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
      no2: { min: 0,     max: 0.00020, colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
      co:  { min: 0.02,  max: 0.08,   colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
      isi: { min: 0.2,   max: 0.7,    colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
    };
    const scale = scales[metric] || scales.ch4;
    const rgbStops = scale.colors.map(hexToRgb);
    const nStops   = rgbStops.length - 1;
    const { min: sMin, max: sMax } = scale;

    // Interpolate colour — hot path, runs per pixel
    const getColor = (val) => {
      if (val === null || isNaN(val) || val <= 0) return null;
      const t   = Math.max(0, Math.min(1, (val - sMin) / (sMax - sMin)));
      const idx = t * nStops;
      const lo  = idx | 0;
      const hi  = lo < nStops ? lo + 1 : lo;
      const f   = idx - lo;
      const c1  = rgbStops[lo], c2 = rgbStops[hi];
      return `rgba(${(c1[0]+(c2[0]-c1[0])*f+.5)|0},${(c1[1]+(c2[1]-c1[1])*f+.5)|0},${(c1[2]+(c2[2]-c1[2])*f+.5)|0},0.7)`;
    };

    if (this.state.geeMode) {
      // ── GEE live tiles ──────────────────────────────────
      const tileURL = await this.getGEETileURL(metric, year);
      this.layers.raster = L.tileLayer(tileURL, {
        opacity: 0.75,
        attribution: 'Google Earth Engine · Sentinel-5P',
        zIndex: 2,
      });
      if (document.getElementById('rasterLayer')?.checked) {
        this.layers.raster.once('load', onRasterLoad);
        this.layers.raster.addTo(this.map);
        if (this.state.rasterClipLGA) this._addClipMask(this.state.rasterClipLGA);
        if (this.layers.lgas)   this.layers.lgas.bringToFront();
        if (this.layers.points) this.layers.points.bringToFront();
      } else {
        clearTimeout(toastTimer);
        document.getElementById('raster-loading-toast')?.remove();
      }
      this.setupGEEClickHandler();
    } else {
      // ── Local GeoTIFF — render once to a static image overlay ──
      // Image overlays scale with the map without re-rendering on zoom,
      // pan, or basemap/theme changes. Results are cached by year+metric+clip
      // so repeated calls (metric switch, year change) skip re-rendering.
      const cacheKey = `${year}_${metric}${this.state.rasterClipLGA ? '_' + this.state.rasterClipLGA : ''}`;
      if (!this._overlayCache[cacheKey]) {
        this._overlayCache[cacheKey] = this.renderRasterToImageOverlay(georaster, metric, aoiMask);
      }
      this.layers.raster = this._overlayCache[cacheKey];
      if (document.getElementById('rasterLayer')?.checked) {
        this.layers.raster.addTo(this.map);
        if (this.state.rasterClipLGA) this._addClipMask(this.state.rasterClipLGA);
        if (this.layers.lgas)   this.layers.lgas.bringToFront();
        if (this.layers.points) this.layers.points.bringToFront();
        onRasterLoad();
      } else {
        clearTimeout(toastTimer);
        document.getElementById('raster-loading-toast')?.remove();
      }
      this.setupRasterClickHandler(georaster);
      this._prefetchAllRasters();
    }
  },

  _prefetchAllRasters() {
    const years = this.state.availableYears;
    years.forEach((y, i) => {
      if (!this.state.rasterData[y]) {
        // Stagger by 600 ms each to avoid hammering the network and blocking parsing
        setTimeout(() => {
          if (!this.state.rasterData[y]) {
            this.loadRaster(y).then(() => this._prewarmOverlayCache(y));
          }
        }, i * 600);
      } else {
        // Already loaded — pre-warm cache in the background with low priority
        const delay = (i + 1) * 400;
        setTimeout(() => this._prewarmOverlayCache(y), delay);
      }
    });
  },

  // Pre-render all metrics for a given year into the overlay cache so that
  // the user experiences instant switching between metrics and years.
  _prewarmOverlayCache(year) {
    const metrics = Object.keys(this.BAND_INDEX).filter(m => m !== 'hotspots');
    const georaster = this.state.rasterData[year];
    if (!georaster) return;
    const clip = this.state.rasterClipLGA || null;
    const aoiMask = this.getAOIMask();
    const schedule = typeof requestIdleCallback === 'function'
      ? (fn) => requestIdleCallback(fn, { timeout: 5000 })
      : (fn) => setTimeout(fn, 0);
    metrics.forEach(metric => {
      const cacheKey = `${year}_${metric}${clip ? '_' + clip : ''}`;
      if (!this._overlayCache[cacheKey]) {
        schedule(() => {
          if (!this._overlayCache[cacheKey]) {
            this._overlayCache[cacheKey] = this.renderRasterToImageOverlay(georaster, metric, aoiMask);
          }
        });
      }
    });
  },

  // Render georaster pixels to a static L.imageOverlay so the raster is
  // unaffected by zoom, pan, basemap swaps, or theme changes.
  renderRasterToImageOverlay(georaster, metric, aoiMask) {
    const bandIdx  = this.BAND_INDEX[metric] ?? 0;
    const { width, height, xmin, xmax, ymin, ymax, values, noDataValue } = georaster;

    const hexToRgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const scales = {
      ch4: { min: 1750,  max: 2100,    colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
      no2: { min: 0,     max: 0.00020, colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
      co:  { min: 0.02,  max: 0.08,    colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
      isi: { min: 0.2,   max: 0.7,     colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
    };
    const scale    = scales[metric] || scales.ch4;
    const rgbStops = scale.colors.map(hexToRgb);
    const nStops   = rgbStops.length - 1;
    const { min: sMin, max: sMax } = scale;
    const nodata   = noDataValue;
    const bandData = values[bandIdx];

    // Paint every pixel onto an offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width  = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    const imgD   = offCtx.createImageData(width, height);
    const px     = imgD.data;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const i   = (row * width + col) * 4;
        const raw = bandData?.[row]?.[col];
        if (raw == null || isNaN(raw) || raw === nodata || raw < -9000 || raw <= 0) {
          px[i + 3] = 0;
          continue;
        }
        const t  = Math.max(0, Math.min(1, (raw - sMin) / (sMax - sMin)));
        const si = t * nStops;
        const lo = si | 0;
        const hi = lo < nStops ? lo + 1 : lo;
        const f  = si - lo;
        const c1 = rgbStops[lo], c2 = rgbStops[hi];
        px[i]     = (c1[0] + (c2[0] - c1[0]) * f + 0.5) | 0;
        px[i + 1] = (c1[1] + (c2[1] - c1[1]) * f + 0.5) | 0;
        px[i + 2] = (c1[2] + (c2[2] - c1[2]) * f + 0.5) | 0;
        px[i + 3] = 191; // 75 % opacity baked in
      }
    }
    offCtx.putImageData(imgD, 0, 0);

    // Clip to AOI polygon using the canvas 2D path API — O(vertices), not O(pixels)
    const final = document.createElement('canvas');
    final.width  = width;
    final.height = height;
    const fCtx   = final.getContext('2d');

    if (aoiMask) {
      const geoToPixel = (lng, lat) => [
        (lng - xmin) / (xmax - xmin) * width,
        (ymax - lat) / (ymax - ymin) * height,
      ];
      const addRing = ring => {
        ring.forEach(([lng, lat], i) => {
          const [x, y] = geoToPixel(lng, lat);
          if (i === 0) fCtx.moveTo(x, y); else fCtx.lineTo(x, y);
        });
        fCtx.closePath();
      };
      const addGeom = geom => {
        if (!geom) return;
        if (geom.type === 'Polygon')      geom.coordinates.forEach(addRing);
        else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(addRing));
      };
      fCtx.beginPath();
      if (aoiMask.type === 'Feature')           addGeom(aoiMask.geometry);
      else if (aoiMask.type === 'FeatureCollection') aoiMask.features.forEach(f => addGeom(f.geometry));
      fCtx.clip('evenodd');
    }

    fCtx.drawImage(offscreen, 0, 0);
    const dataUrl = final.toDataURL('image/png');
    const bounds  = L.latLngBounds([[ymin, xmin], [ymax, xmax]]);
    return L.imageOverlay(dataUrl, bounds, { opacity: 1, interactive: false, pane: 'overlayPane' });
  },

  setupGEEClickHandler() {
    if (this._geeClickHandler) this.map.off('click', this._geeClickHandler);
    this._geeClickHandler = async (e) => {
      if (!document.getElementById('rasterLayer')?.checked) return;
      if (this.state.activeDraw) return; // suppress during active digitizing
      const { lat, lng } = e.latlng;
      if (!this.isPointInsideAOI(lat, lng)) return;
      const year = parseInt(this.state.currentYear);

      const mapTip = document.querySelector('.map-tip');
      if (mapTip) { mapTip.textContent = 'Loading pixel values…'; mapTip.style.display = 'block'; }

      try {
        const vals = await this.getGEEPixelValues(lat, lng, year);
        if (vals.error) throw new Error(vals.error);

        let lgaName = 'Unknown';
        if (this.state.data.lgasBoundary && window.turf) {
          const pt = window.turf.point([lng, lat]);
          const found = this.state.data.lgasBoundary.features.find(f => {
            try { return window.turf.booleanPointInPolygon(pt, f); } catch(e) { return false; }
          });
          if (found) lgaName = found.properties.lganame;
        }

        this.state.clickedPoint = { lat, lng, ...vals, lgaName };
        // Set selectedFeature so the full LGA report is available
        const lgaEmFeat = this.state.data.lgas?.features?.find(f => f.properties.lganame === lgaName);
        if (lgaEmFeat) this.state.selectedFeature = lgaEmFeat;
        this.updateRasterInspector({ lat, lng, ...vals, lgaName });

        // Fetch trend data async
        if (mapTip) mapTip.textContent = 'Loading trend data…';
        const trend = await this.getGEETrend(lat, lng);
        this.updateChartsFromGEETrend(trend);

      } catch(err) {
        console.error('GEE pixel error:', err);
      } finally {
        if (mapTip) { mapTip.textContent = 'Click an LGA to inspect emissions'; }
      }
    };
    this.map.on('click', this._geeClickHandler);
  },

  updateChartsFromGEETrend(trend) {
    const years  = Object.keys(trend).sort();
    const metric = this.state.currentMetric;
    const vals   = years.map(y => trend[y]?.[metric] || 0);
    const label  = { ch4:'CH₄', no2:'NO₂', co:'CO' }[metric] || metric;

    this.state.clickedPoint = this.state.clickedPoint || {};
    this.state.clickedPoint.pointTrend = {
      years,
      ch4: years.map(y => trend[y]?.ch4 || 0),
      no2: years.map(y => trend[y]?.no2 || 0),
      co:  years.map(y => trend[y]?.co  || 0),
    };

    const yr = String(this.state.currentYear);
    if (trend[yr]) {
      this.state.clickedPoint.pointComposition = {
        ch4: trend[yr].ch4 || 0,
        no2: trend[yr].no2 || 0,
        co:  trend[yr].co  || 0,
      };
    }

    if (this.charts.trend) {
      this.charts.trend.data.labels = years;
      this.charts.trend.data.datasets[0].data  = vals;
      this.charts.trend.data.datasets[0].label = `${label} at clicked point`;
      this.charts.trend.update();
    }

    if (this.charts.composition && this.state.clickedPoint.pointComposition) {
      const t = this.state.clickedPoint.pointComposition;
      this.charts.composition.data.datasets[0].data = [t.ch4, t.no2, t.co];
      this.charts.composition.update();
    }
  },

  setupRasterClickHandler(georaster) {
    // Remove previous raster click handler
    if (this._rasterClickHandler) {
      this.map.off('click', this._rasterClickHandler);
    }

    this._rasterClickHandler = async (e) => {
      if (!document.getElementById('rasterLayer')?.checked) return;
      if (this.state.activeDraw) return; // suppress during active digitizing
      const { lat, lng } = e.latlng;
      if (!this.isPointInsideAOI(lat, lng)) return;

      // Check if click is within raster bounds
      const { xmin, xmax, ymin, ymax } = georaster;
      if (lng < xmin || lng > xmax || lat < ymin || lat > ymax) return;

      // Calculate pixel indices
      const col = Math.floor((lng - xmin) / georaster.pixelWidth);
      const row = Math.floor((ymax - lat) / georaster.pixelHeight);

      if (row < 0 || row >= georaster.height || col < 0 || col >= georaster.width) return;

      // Read all band values at this pixel
      const ch4Raw = georaster.values[0][row][col];
      const no2    = georaster.values[1][row][col];
      const co     = georaster.values[2][row][col];
      const isi    = georaster.values[3][row][col];
      const hot    = georaster.values[4][row][col];

      if (isNaN(ch4Raw)) return;

      const ch4 = ch4Raw * this.CH4_PPB_TO_MOL; // convert to mol/m²
      const no2c = Math.max(0, no2);             // clamp negatives

      // Find which LGA this point falls in
      let lgaName = 'Unknown';
      if (this.state.data.lgasBoundary && window.turf) {
        const pt = window.turf.point([lng, lat]);
        const found = this.state.data.lgasBoundary.features.find(f => {
          try { return window.turf.booleanPointInPolygon(pt, f); } catch(e) { return false; }
        });
        if (found) lgaName = found.properties.lganame;
      }

      this.state.clickedPoint = { lat, lng, ch4, no2: no2c, co, isi, hot, lgaName };
      // Set selectedFeature so the full LGA report is available
      const lgaEmFeat = this.state.data.lgas?.features?.find(f => f.properties.lganame === lgaName);
      if (lgaEmFeat) this.state.selectedFeature = lgaEmFeat;
      this.updateRasterInspector({ lat, lng, ch4, no2: no2c, co, isi, hot, lgaName });
      this.updateChartsForPoint(lat, lng, georaster);
    };

    this.map.on('click', this._rasterClickHandler);
  },

  updateRasterInspector(pt) {
    const risk = this.getEriClassification(pt.isi);

    const nameEl = document.getElementById('stat-lga-name');
    if (nameEl) nameEl.textContent = pt.lgaName;

    const metric = this.state.currentMetric;
    const val = metric === 'ch4' ? pt.ch4 : metric === 'no2' ? pt.no2 : pt.co;
    const cvEl = document.getElementById('stat-current-value');
    if (cvEl) cvEl.textContent = val.toFixed(6);

    document.getElementById('stat-ch4').textContent = pt.ch4.toFixed(6) + ' mol/m²';
    document.getElementById('stat-no2').textContent = pt.no2.toFixed(6) + ' mol/m²';
    document.getElementById('stat-co').textContent  = pt.co.toFixed(6)  + ' mol/m²';
    document.getElementById('stat-isi').textContent  = pt.isi.toFixed(4);

    const badge = document.getElementById('stat-risk-class');
    if (badge) { badge.textContent = risk.label; badge.className = `stat-badge ${risk.css}`; }

    const trendEl = document.getElementById('stat-trend');
    if (trendEl) {
      if (pt.hot > 0.5) {
        trendEl.textContent = '🔴 Hotspot';
        trendEl.classList.remove('negative');
      } else {
        const lgaFeat = this.state.data.lgas?.features?.find(f => f.properties.lganame === pt.lgaName);
        if (lgaFeat) {
          const year    = String(this.state.currentYear);
          const prevYear = String(parseInt(year) - 1);
          const metric  = this.state.currentMetric;
          const curVal  = this.getMetricValue(lgaFeat, metric, year)  || 0;
          const prevVal = this.getMetricValue(lgaFeat, metric, prevYear) || 0;
          const yoy = prevVal !== 0 ? ((curVal - prevVal) / prevVal * 100).toFixed(1) : '0.0';
          trendEl.textContent = `${Number(yoy) > 0 ? '+' : ''}${yoy}%`;
          trendEl.classList.toggle('negative', Number(yoy) < 0);
        } else {
          trendEl.textContent = '-';
          trendEl.classList.remove('negative');
        }
      }
    }

    // Update nearest landfill using the clicked pixel coordinates
    const lfEl = document.getElementById('stat-nearest-landfill');
    if (lfEl) {
      if (pt.lat !== undefined && pt.lng !== undefined && this.state.data.landfills) {
        const refPoint = L.latLng(pt.lat, pt.lng);
        let nearestDist = null, nearestName = null;
        this.state.data.landfills.features.forEach(lf => {
          if (!lf.geometry) return;
          const d = refPoint.distanceTo(L.latLng(lf.geometry.coordinates[1], lf.geometry.coordinates[0]));
          if (nearestDist === null || d < nearestDist) {
            nearestDist = d;
            nearestName = lf.properties.Name || lf.properties.lganame || 'Unnamed Landfill';
          }
        });
        lfEl.textContent = nearestDist !== null ? `${nearestName} (${Math.round(nearestDist).toLocaleString()} m)` : '-';
      } else {
        lfEl.textContent = '-';
      }
    }
  },

  async updateChartsForPoint(lat, lng, currentGeoraster) {
    const years  = this.getYears();
    const metric = this.state.currentMetric;
    const bandIdx = this.BAND_INDEX[metric] ?? 0;
    const ch4Band = 0;
    const no2Band = 1;
    const coBand  = 2;

    const pointVals = { ch4: [], no2: [], co: [] };

    const yearResults = await Promise.all(years.map(y => this.loadRaster(y)));
    for (const gr of yearResults) {
      if (!gr) { pointVals.ch4.push(null); pointVals.no2.push(null); pointVals.co.push(null); continue; }

      const col = Math.floor((lng - gr.xmin) / gr.pixelWidth);
      const row = Math.floor((gr.ymax - lat) / gr.pixelHeight);

      if (row < 0 || row >= gr.height || col < 0 || col >= gr.width) {
        pointVals.ch4.push(null); pointVals.no2.push(null); pointVals.co.push(null); continue;
      }

      const ch4Raw = gr.values[0][row][col];
      pointVals.ch4.push(isNaN(ch4Raw) ? null : ch4Raw * this.CH4_PPB_TO_MOL);
      const no2v = gr.values[1][row][col];
      pointVals.no2.push(isNaN(no2v) ? null : Math.max(0, no2v));
      const cov = gr.values[2][row][col];
      pointVals.co.push(isNaN(cov) ? null : cov);
    }

    // Update trend chart with pixel values
    const metricVals = pointVals[metric] || pointVals.ch4;
    const metricLabel = { ch4:'CH₄', no2:'NO₂', co:'CO' }[metric] || metric;
    this.state.clickedPoint.pointTrend = {
      years,
      ch4: pointVals.ch4,
      no2: pointVals.no2,
      co: pointVals.co,
    };

    const yr = years.indexOf(String(this.state.currentYear));
    const c4 = pointVals.ch4[yr] || 0;
    const n2 = pointVals.no2[yr] || 0;
    const cc = pointVals.co[yr]  || 0;
    this.state.clickedPoint.pointComposition = { ch4: c4, no2: n2, co: cc };

    if (this.charts.trend) {
      this.charts.trend.data.labels = years;
      this.charts.trend.data.datasets[0].data   = metricVals;
      this.charts.trend.data.datasets[0].label  = `${metricLabel} at selected point`;
      this.charts.trend.options.scales.y.title.text = 'mol/m²';
      this.charts.trend.update();
    }

    if (this.charts.composition) {
      this.charts.composition.data.datasets[0].data = [c4, n2, cc];
      this.charts.composition.update();
    }
  },

  openAbout() {
    document.getElementById('aboutOverlay')?.classList.add('open');
    const mapTip = document.querySelector('.map-tip');
    if (mapTip) mapTip.style.display = 'none';
  },
  closeAbout() {
    document.getElementById('aboutOverlay')?.classList.remove('open');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector('.nav-item[data-section="dashboard"]')?.classList.add('active');
    // Restore tip only if no other panel is open
    if (!document.getElementById('saPanel')?.classList.contains('open') &&
        !document.getElementById('gasPanel')?.classList.contains('open') &&
        !document.getElementById('landfillsPanel')?.classList.contains('open')) {
      const mapTip = document.querySelector('.map-tip');
      if (mapTip) mapTip.style.display = 'block';
    }
  },
  openLandfills() {
    const p = document.getElementById('landfillsPanel');
    if (p) {
      p.classList.add('open'); this.renderLandfillsPanel();
      const mapTip = document.querySelector('.map-tip'); if (mapTip) mapTip.style.display = 'none';
    }
  },
  closeLandfills() {
    document.getElementById('landfillsPanel')?.classList.remove('open');
    if (!document.getElementById('saPanel')?.classList.contains('open') &&
        !document.getElementById('gasPanel')?.classList.contains('open')) {
      const mapTip = document.querySelector('.map-tip'); if (mapTip) mapTip.style.display = 'block';
    }
  },
  renderLandfillsPanel() {
    const c = document.getElementById('landfillsList');
    if (!c || !this.state.data.landfills) return;
    const yr = '2025';

    const statusConfig = (raw, name) => {
      const s = (raw || '').toString().trim().toLowerCase();
      const n = (name || '').toString().trim().toLowerCase();
      // Name-based override takes priority — these four are all scheduled for decommissioning
      const scheduledNames = ['soluos i', 'soluos ii', 'soluos iii', 'olusosun'];
      if (scheduledNames.some(nm => n.includes(nm)))
        return { label: 'Scheduled for Decommissioning', cls: 'lf-status-scheduled' };
      if (!s || s === '0' || s === 'null')
        return { label: 'Active', cls: 'lf-status-active' };
      if (s.includes('scheduled'))
        return { label: 'Scheduled for Decommissioning', cls: 'lf-status-scheduled' };
      if (s.includes('being decommission'))
        return { label: 'Being Decommissioned', cls: 'lf-status-decommission' };
      if (s.includes('rehabilitation') || s.includes('environmental stud'))
        return { label: 'Under Rehabilitation Study', cls: 'lf-status-review' };
      if (n.includes('abule egba'))
        return { label: 'Decommissioned', cls: 'lf-status-decommission' };
      if (s.includes('closed') || s.includes('dormant'))
        return { label: 'Closed / Dormant', cls: 'lf-status-closed' };
      if (s.includes('decommission'))
        return { label: 'Decommissioning', cls: 'lf-status-decommission' };
      return { label: raw.trim(), cls: 'lf-status-active' };
    };

    c.innerHTML = this.state.data.landfills.features.map(lf => {
      const props  = lf.properties;
      const name   = props.Name || props.name || props.lganame || 'Unknown Landfill';
      const status = statusConfig(props.Status || props.status || '', props.Name || props.name || '');

      const [lon, lat] = lf.geometry?.coordinates || [0, 0];
      let nearLGA = '-', nearDist = Infinity;
      this.state.data.lgas?.features?.forEach(f => {
        if (!f.geometry) return;
        const d = L.latLng(lat,lon).distanceTo(L.latLng(f.geometry.coordinates[1],f.geometry.coordinates[0]));
        if (d < nearDist) { nearDist = d; nearLGA = f.properties.lganame; }
      });
      const lgaF = this.state.data.lgas?.features?.find(f => f.properties.lganame === nearLGA);
      const isi  = lgaF ? (lgaF.properties['isi_'+yr] || 0) : 0;
      const ch4  = lgaF ? this.getMetricValue(lgaF,'ch4',yr) : 0;
      const no2  = lgaF ? this.getMetricValue(lgaF,'no2',yr) : 0;
      const co   = lgaF ? this.getMetricValue(lgaF,'co', yr) : 0;
      const risk = this.getEriClassification(isi);
      let b1=0,b5=0,bk=0;
      if (this.layers.buildings) {
        this.layers.buildings.eachLayer(bldg => {
          try { const ctr=bldg.getBounds?.().getCenter();if(!ctr)return;const d=L.latLng(lat,lon).distanceTo(ctr);if(d<=100)b1++;else if(d<=500)b5++;else if(d<=1000)bk++; }catch(e){}
        });
      }
      const tot = b1+b5+bk;
      return '<div class="lf-card" data-lfname="'+name+'" style="cursor:pointer">' +
        '<div class="lf-card-header">' +
          '<div style="flex:1">' +
            '<div class="lf-name">'+name+'</div>' +
            '<div class="lf-meta">'+nearLGA+' LGA</div>' +
            '<div class="lf-coords">'+lat.toFixed(5)+'&deg;N, '+lon.toFixed(5)+'&deg;E</div>' +
            '<span class="lf-status '+status.cls+'">'+status.label+'</span>' +
          '</div>' +
          '<span class="sa-badge '+risk.css+'" style="flex-shrink:0;margin-top:2px">'+risk.label+'</span>' +
        '</div>' +
        '<div class="lf-gas-row">' +
          '<div class="lf-gas ch4"><div class="lf-gas-sym">CH₄</div><div class="lf-gas-val">'+(ch4?ch4.toFixed(5):'-')+'</div><div class="lf-gas-unit">mol/m²</div></div>' +
          '<div class="lf-gas no2"><div class="lf-gas-sym">NO₂</div><div class="lf-gas-val">'+(no2?no2.toFixed(5):'-')+'</div><div class="lf-gas-unit">mol/m²</div></div>' +
          '<div class="lf-gas co"><div class="lf-gas-sym">CO</div><div class="lf-gas-val">'+(co?co.toFixed(5):'-')+'</div><div class="lf-gas-unit">mol/m²</div></div>' +
          '<div class="lf-gas isi"><div class="lf-gas-sym">ISI</div><div class="lf-gas-val">'+(isi?isi.toFixed(4):'-')+'</div><div class="lf-gas-unit">score</div></div>' +
        '</div>' +
      '</div>';
    }).join('');

    c.querySelectorAll('.lf-card').forEach(card => {
      card.addEventListener('click', () => {
        this.highlightLandfill(card.dataset.lfname);
      });
    });
  },

  // ── Basemap selector dialog for report generation ─────────────
  selectReportBasemap() {
    return new Promise(resolve => {
      const options = [
        { id:'carto',     label:'Carto Dark',       sub:'Recommended · best CORS support',  icon:'🌑' },
        { id:'osm',       label:'OpenStreetMap',     sub:'Light street map',                 icon:'🗺️' },
        { id:'satellite', label:'Satellite Imagery', sub:'ESRI World Imagery',               icon:'🛰️' },
      ];
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(7,12,20,0.88);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;';
      overlay.innerHTML = `
        <div style="background:#0d1627;border:1px solid rgba(0,212,255,0.25);border-radius:14px;padding:24px 28px;min-width:340px;max-width:440px;box-shadow:0 12px 48px rgba(0,0,0,0.75)">
          <div style="font-size:14px;font-weight:700;color:#eef2f8;margin-bottom:4px">Select Map Background</div>
          <div style="font-size:11px;color:#7a8fa8;margin-bottom:18px">Choose the basemap style for the report map image</div>
          <div style="display:flex;flex-direction:column;gap:8px" id="_bm_opts">
            ${options.map(b => `
              <button data-bm="${b.id}" style="display:flex;align-items:center;gap:12px;background:#111e33;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:11px 14px;cursor:pointer;text-align:left;width:100%">
                <span style="font-size:20px;flex-shrink:0">${b.icon}</span>
                <div>
                  <div style="font-size:12px;font-weight:600;color:#eef2f8">${b.label}</div>
                  <div style="font-size:10px;color:#7a8fa8;margin-top:1px">${b.sub}</div>
                </div>
                ${b.id === 'carto' ? '<span style="margin-left:auto;font-size:9px;font-weight:700;background:rgba(0,212,255,0.15);color:#00d4ff;border:1px solid rgba(0,212,255,0.3);border-radius:99px;padding:2px 8px;flex-shrink:0">DEFAULT</span>' : ''}
              </button>`).join('')}
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:16px">
            <button id="_bm_cancel" style="background:transparent;border:1px solid rgba(255,255,255,0.1);color:#7a8fa8;padding:7px 20px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelectorAll('[data-bm]').forEach(btn => {
        btn.onmouseenter = () => btn.style.borderColor = 'rgba(0,212,255,0.45)';
        btn.onmouseleave = () => btn.style.borderColor = 'rgba(255,255,255,0.07)';
        btn.onclick = () => { overlay.remove(); resolve(btn.dataset.bm); };
      });
      overlay.querySelector('#_bm_cancel').onclick = () => { overlay.remove(); resolve(null); };
    });
  },

  async generateStateReport() {
    const year     = this.state.currentYear;
    const prevYear = String(parseInt(year) - 1);
    const date     = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    const feats    = this.state.data.lgas.features;
    const years    = this.getYears();
    const riskColors = { low:'#16a34a', moderate:'#ca8a04', elevated:'#f97316', high:'#dc2626', critical:'#7c2d12' };

    const stateAvg = (m, y) => {
      const vals = feats.map(f => this.getMetricValue(f, m, y) || 0).filter(v => v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const stateAvgISI = (y) => {
      const vals = feats.map(f => f.properties[`isi_${y}`] || 0).filter(v => v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const centroidOf = (f) => {
      const boundary = this.state.data.lgasBoundary?.features?.find(b => b.properties.lganame === f.properties.lganame);
      const geom = boundary?.geometry || f.geometry;
      if (!geom) return null;
      if (geom.type === 'Point') return { lat: geom.coordinates[1], lon: geom.coordinates[0] };
      const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.type === 'MultiPolygon' ? geom.coordinates[0]?.[0] : null;
      if (!ring) return null;
      return { lon: ring.reduce((s, c) => s + c[0], 0) / ring.length, lat: ring.reduce((s, c) => s + c[1], 0) / ring.length };
    };

    // ── Statewide summary rows ──
    const mLabels = { ch4:'CH₄ Methane', no2:'NO₂ Nitrogen Dioxide', co:'CO Carbon Monoxide', isi:'ISI Risk Score' };
    const mUnits  = { ch4:'mol/m²', no2:'mol/m²', co:'mol/m²', isi:'index' };
    const summaryRows = ['ch4','no2','co','isi'].map(m => {
      const avg  = m === 'isi' ? stateAvgISI(year)     : stateAvg(m, year);
      const prev = m === 'isi' ? stateAvgISI(prevYear) : stateAvg(m, prevYear);
      const pct  = prev > 0 ? ((avg - prev) / prev * 100).toFixed(1) : 'N/A';
      const pc   = Number(pct) > 0 ? '#dc2626' : Number(pct) < 0 ? '#16a34a' : '#64748b';
      const dp   = m === 'isi' ? 4 : 6;
      return `<tr><td style="font-weight:600">${mLabels[m]}</td>`
        + `<td style="font-weight:700;color:#0284c7">${avg.toFixed(dp)}</td>`
        + `<td style="color:#64748b">${prev.toFixed(dp)}</td>`
        + `<td style="font-weight:700;color:${pc}">${pct !== 'N/A' ? (Number(pct) > 0 ? '+' : '') + pct + '%' : 'N/A'}</td>`
        + `<td style="font-size:9px;color:#94a3b8">${mUnits[m]}</td></tr>`;
    }).join('');

    // ── Top 5 / bottom 5 by ISI ──
    const sortedByISI = [...feats].map(f => ({ name: f.properties.lganame, isi: f.properties[`isi_${year}`] || 0 }))
      .sort((a, b) => b.isi - a.isi);
    const lgaTableRows = (list) => list.map(item => {
      const r = this.getEriClassification(item.isi);
      const rc = riskColors[r.css] || '#888';
      return `<tr><td style="font-weight:600">${item.name}</td>`
        + `<td style="font-weight:700;color:#0284c7">${item.isi.toFixed(4)}</td>`
        + `<td><span style="background:${rc}18;color:${rc};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;border:1px solid ${rc}44">${r.label}</span></td></tr>`;
    }).join('');

    // ── Anomaly detection — 1.5σ on all 4 metrics ──
    const anomalyRows = ['ch4','no2','co','isi'].flatMap(m => {
      const vals = feats.map(f => m === 'isi' ? (f.properties[`isi_${year}`] || 0) : (this.getMetricValue(f, m, year) || 0));
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std  = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length);
      return feats.map((f, i) => ({ name: f.properties.lganame, m, val: vals[i], z: std > 0 ? (vals[i] - mean) / std : 0 }))
        .filter(v => v.z > 1.5).sort((a, b) => b.z - a.z)
        .map(v => {
          const feat = feats.find(f2 => f2.properties.lganame === v.name);
          const isi  = feat?.properties[`isi_${year}`] || 0;
          const risk = this.getEriClassification(isi);
          const rc   = riskColors[risk.css] || '#888';
          const dp   = m === 'isi' ? 4 : 6;
          return `<tr><td style="font-weight:600">${v.name}</td>`
            + `<td style="font-size:10px;color:#64748b">${mLabels[m]}</td>`
            + `<td style="font-weight:700;color:#dc2626">${v.val.toFixed(dp)}</td>`
            + `<td style="font-weight:700;color:#dc2626">${v.z.toFixed(2)}σ</td>`
            + `<td><span style="background:${rc}18;color:${rc};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;border:1px solid ${rc}44">${risk.label}</span></td></tr>`;
        });
    }).join('');

    // ── Landfill status + nearest LGA ──
    const lfRows = (this.state.data.landfills?.features || []).filter(lf => lf.geometry).map(lf => {
      const nm  = lf.properties.Name || lf.properties.name || 'Landfill';
      const raw = lf.properties.Status || lf.properties.status || '';
      const s   = raw.toString().trim().toLowerCase();
      let stLabel, stColor;
      if (!s || s === '0')                                   { stLabel = 'Active';                          stColor = '#16a34a'; }
      else if (s.includes('scheduled'))                      { stLabel = 'Scheduled for Decommissioning';   stColor = '#f97316'; }
      else if (s.includes('being'))                          { stLabel = 'Being Decommissioned';            stColor = '#ca8a04'; }
      else if (s.includes('rehabilitation') || s.includes('environmental stud')) { stLabel = 'Under Rehabilitation Study'; stColor = '#3b82f6'; }
      else if (s.includes('closed') || s.includes('dormant')) { stLabel = 'Closed / Dormant';              stColor = '#64748b'; }
      else                                                   { stLabel = raw.trim() || 'Active';            stColor = '#16a34a'; }
      const [lon, lat] = lf.geometry.coordinates;
      let nearLGA = '-', minD = Infinity;
      feats.forEach(f => {
        const c = centroidOf(f);
        if (!c) return;
        const d = L.latLng(lat, lon).distanceTo(L.latLng(c.lat, c.lon));
        if (d < minD) { minD = d; nearLGA = f.properties.lganame; }
      });
      return `<tr><td style="font-weight:600">${nm}</td>`
        + `<td><span style="background:${stColor}18;color:${stColor};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;border:1px solid ${stColor}44">${stLabel}</span></td>`
        + `<td>${nearLGA}</td></tr>`;
    }).join('');

    // ── Buffer exposure count (centroids within 1 km) ──
    const lgasWithin1km = feats.filter(f => {
      const c = centroidOf(f);
      if (!c) return false;
      return (this.state.data.landfills?.features || []).some(lf => {
        if (!lf.geometry) return false;
        const [lo, la] = lf.geometry.coordinates;
        return L.latLng(c.lat, c.lon).distanceTo(L.latLng(la, lo)) <= 1000;
      });
    }).length;

    // ── 8-year statewide average trend table ──
    const trendRows = years.map(y => {
      const avgCH4 = stateAvg('ch4', y);
      const avgNO2 = stateAvg('no2', y);
      const avgCO  = stateAvg('co',  y);
      const avgISI = stateAvgISI(y);
      const r  = this.getEriClassification(avgISI);
      const rc = riskColors[r.css] || '#888';
      return `<tr style="${y === year ? 'background:#eff6ff;font-weight:600' : ''}">`
        + `<td>${y}</td><td>${avgCH4.toFixed(6)}</td><td>${avgNO2.toFixed(6)}</td>`
        + `<td>${avgCO.toFixed(6)}</td><td>${avgISI.toFixed(4)}</td>`
        + `<td><span style="background:${rc}18;color:${rc};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;border:1px solid ${rc}44">${r.label}</span></td></tr>`;
    }).join('');

    // ── Chart images ──
    const trendImg = this.charts.trend           ? this.charts.trend.canvas.toDataURL('image/png')           : '';
    const barImg   = this.charts.lgaComparison   ? this.charts.lgaComparison.canvas.toDataURL('image/png')   : '';

    // ── Logo ──
    let logoBase64 = '';
    try {
      const r = await fetch('logo.png');
      if (r.ok) {
        const blob = await r.blob();
        logoBase64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      }
    } catch(e) {}

    const totalLGAs    = feats.length;
    const avgISI       = stateAvgISI(year);
    const prevAvgISI   = stateAvgISI(prevYear);
    const overallRisk  = this.getEriClassification(avgISI);
    const orc          = riskColors[overallRisk.css] || '#888';
    const isiYoY       = prevAvgISI > 0 ? ((avgISI - prevAvgISI) / prevAvgISI * 100).toFixed(1) : 'N/A';
    const lfCount      = this.state.data.landfills?.features?.length || 0;

    const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:24px}.page{max-width:900px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}.ab{height:3px;background:linear-gradient(90deg,#00d4ff,#00e5a0,#a78bfa)}.rh{background:linear-gradient(135deg,#0a1120,#0d1f3c);padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-start}.rh h1{font-size:20px;font-weight:800;color:#00d4ff}.rh p{font-size:11px;color:#7a8fa8;margin-top:3px}.rhr{text-align:right}.ln{font-size:19px;font-weight:700;color:#fff}.mt{font-size:10px;color:#7a8fa8;margin-top:4px}.bd{padding:24px 28px;display:flex;flex-direction:column;gap:20px}.st{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;display:flex;align-items:center;gap:8px}.st::after{content:'';flex:1;height:1px;background:#e2e8f0}.kg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kb{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}.kl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}.kv{font-size:14px;font-weight:700;color:#1e293b;line-height:1.3}.ku{font-size:9px;color:#94a3b8;margin-top:2px}.tg{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cg{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#f1f5f9}th{padding:7px 10px;text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0}td{padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:middle}tr:last-child td{border-bottom:none}.ft{background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 28px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}.ac{text-align:center;padding:20px;display:flex;justify-content:center;gap:10px}@media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}.ac{display:none!important}}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Lagos State Emission Report</title><script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"><\/script><style>${css}</style></head><body><div class="page"><div class="ab"></div>
<div class="rh"><div style="display:flex;align-items:center;gap:12px">${logoBase64 ? `<img src="${logoBase64}" style="width:64px;height:64px;object-fit:contain;border-radius:8px">` : ''}<div><h1>Lagos State Emission Report</h1><p>Statewide Gas Emissions Overview &nbsp;·&nbsp; Sentinel-5P &nbsp;·&nbsp; All ${totalLGAs} LGAs</p></div></div><div class="rhr"><div class="ln">Lagos State</div><div class="mt">Year: ${year} &nbsp;·&nbsp; Generated: ${date}</div></div></div>
<div class="bd">
<div><div class="st">State Overview</div><div class="kg"><div class="kb"><div class="kl">LGAs Surveyed</div><div class="kv">${totalLGAs}</div></div><div class="kb"><div class="kl">Avg ISI Score</div><div class="kv" style="color:${orc}">${avgISI.toFixed(4)}</div><div class="ku">${overallRisk.label}</div></div><div class="kb"><div class="kl">ISI YoY Change</div><div class="kv" style="color:${Number(isiYoY)>0?'#dc2626':'#16a34a'}">${isiYoY !== 'N/A' ? (Number(isiYoY)>0?'+':'') + isiYoY + '%' : 'N/A'}</div><div class="ku">vs ${prevYear}</div></div><div class="kb"><div class="kl">Landfill Sites</div><div class="kv">${lfCount}</div></div></div></div>
<div><div class="st">Statewide Gas Summary (${year} vs ${prevYear})</div><table><thead><tr><th>Gas</th><th>Avg (${year})</th><th>Avg (${prevYear})</th><th>YoY Change</th><th>Unit</th></tr></thead><tbody>${summaryRows}</tbody></table></div>
<div class="tg"><div><div class="st">Top 5 Highest Risk LGAs</div><table><thead><tr><th>LGA</th><th>ISI</th><th>Risk</th></tr></thead><tbody>${lgaTableRows(sortedByISI.slice(0,5))}</tbody></table></div><div><div class="st">Bottom 5 Lowest Risk LGAs</div><table><thead><tr><th>LGA</th><th>ISI</th><th>Risk</th></tr></thead><tbody>${lgaTableRows([...sortedByISI].reverse().slice(0,5))}</tbody></table></div></div>
<div><div class="st">Anomaly Summary — LGAs flagged at 1.5σ (${year})</div>${anomalyRows ? `<table><thead><tr><th>LGA</th><th>Gas</th><th>Value</th><th>Z-Score</th><th>Risk</th></tr></thead><tbody>${anomalyRows}</tbody></table>` : '<div style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:11px;color:#16a34a;font-weight:600">✅ No LGAs flagged anomalous at 1.5σ threshold.</div>'}</div>
<div><div class="st">Landfill Status</div><table><thead><tr><th>Site Name</th><th>Status</th><th>Nearest LGA</th></tr></thead><tbody>${lfRows}</tbody></table></div>
<div><div class="st">Buffer Exposure Summary</div><div style="background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #3b82f6;border-radius:8px;padding:12px 16px"><div style="font-size:14px;font-weight:700;color:#1e40af">${lgasWithin1km} of ${totalLGAs} LGAs</div><div style="font-size:11px;color:#475569;margin-top:3px">have centroids within 1 km of at least one monitored landfill site.</div></div></div>
<div><div class="st">8-Year Statewide Average Trend</div><table><thead><tr><th>Year</th><th>Avg CH₄</th><th>Avg NO₂</th><th>Avg CO</th><th>Avg ISI</th><th>Risk Level</th></tr></thead><tbody>${trendRows}</tbody></table></div>
<div class="cg">${trendImg ? `<div><div class="cl">Emission Trend Chart</div><img src="${trendImg}" style="width:100%;border-radius:6px;border:1px solid #e2e8f0"/></div>` : '<div></div>'}${barImg ? `<div><div class="cl">Top 10 LGAs — Bar Chart</div><img src="${barImg}" style="width:100%;border-radius:6px;border:1px solid #e2e8f0"/></div>` : '<div></div>'}</div>
</div><div class="ft"><span>Lagos ERM &nbsp;·&nbsp; Geoinfotech Resources Limited</span><span>Lagos State Report &nbsp;·&nbsp; ${date}</span></div></div>
<div class="ac"><button onclick="window.print()" style="background:#0284c7;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">⬇ Download PDF</button><button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Close</button></div>
</body></html>`;

    const win = window.open('', '_blank', 'width=970,height=800,scrollbars=yes');
    if (!win) { this.showNotification('Pop-up blocked. Allow pop-ups for this page.', 'info'); return; }
    win.document.write(html);
    win.document.close();
  },

  async generateReport() {
    const year    = this.state.currentYear;
    const date    = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    const drawCtx = this.state.currentDrawContext;
    const feature = this.state.selectedFeature;

    // No selection → generate statewide report
    if (!drawCtx && !feature && !this.state.clickedPoint) {
      return this.generateStateReport();
    }

    // Ask user which basemap to embed in the report map image
    const reportBasemap = await this.selectReportBasemap();
    if (reportBasemap === null) return; // user cancelled

    if (drawCtx) {
      if (drawCtx.type === 'point')     return this.generateDrawPointReport(drawCtx, date, reportBasemap);
      if (drawCtx.type === 'transect')  return this.generateTransectReport(drawCtx, date, reportBasemap);
      if (drawCtx.type === 'zone')      return this.generateZoneReport(drawCtx, date, reportBasemap);
    }
    // Raster click with resolved LGA → full report with pixel section prepended
    if (feature && this.state.clickedPoint && document.getElementById('rasterLayer')?.checked) {
      return this.generateRasterLGAReport(feature, this.state.clickedPoint, date, reportBasemap);
    }
    if (!feature && this.state.clickedPoint) {
      return this.generateDrawPointReport({
        type: 'point', title: 'Point Analysis', year: Number(year),
        lat: this.state.clickedPoint.lat, lng: this.state.clickedPoint.lng,
        vals: {
          ch4: this.state.clickedPoint.ch4 || 0,
          no2: this.state.clickedPoint.no2 || 0,
          co: this.state.clickedPoint.co || 0,
          isi: this.state.clickedPoint.isi || 0,
        },
        risk: this.getEriClassification(this.state.clickedPoint.isi || 0),
        label: `${this.state.clickedPoint.lat.toFixed(5)}°N, ${this.state.clickedPoint.lng.toFixed(5)}°E`,
      }, date, reportBasemap);
    }
    if (!feature) return; // already guarded above
    const lgaName = feature.properties.lganame;
    const ch4 = this.getMetricValue(feature,'ch4',year)||0;
    const no2 = this.getMetricValue(feature,'no2',year)||0;
    const co  = this.getMetricValue(feature,'co', year)||0;
    const isi = feature.properties[`isi_${year}`] || 0;
    const risk = this.getEriClassification(isi);
    const prevYear = String(parseInt(year)-1);
    const prevCH4  = this.getMetricValue(feature,'ch4',prevYear)||0;
    const yoy = prevCH4 !== 0 ? ((ch4-prevCH4)/prevCH4*100).toFixed(1) : 'N/A';
    const riskColors = { low:'#16a34a', moderate:'#ca8a04', elevated:'#f97316', high:'#dc2626', critical:'#7c2d12' };
    const riskColor  = riskColors[risk.css] || '#888';
    const years = this.getYears();
    const tCH4 = years.map(y=>this.getMetricValue(feature,'ch4',y)||0);
    const tNO2 = years.map(y=>this.getMetricValue(feature,'no2',y)||0);
    const tCO  = years.map(y=>this.getMetricValue(feature,'co', y)||0);
    const tISI = years.map(y=>feature.properties[`isi_${y}`]||0);
    const trendRows = years.map((y,i)=>{
      const r=this.getEriClassification(tISI[i]), rc=riskColors[r.css]||'#888';
      const isCur = y===year ? 'style="background:#eff6ff;font-weight:600"' : '';
      return `<tr ${isCur}><td>${y}</td><td>${tCH4[i]?tCH4[i].toFixed(6):'-'}</td><td>${tNO2[i]?tNO2[i].toFixed(6):'-'}</td><td>${tCO[i]?tCO[i].toFixed(6):'-'}</td><td>${tISI[i]?tISI[i].toFixed(4):'-'}</td><td><span style="background:${rc};color:#fff;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">${r.label}</span></td></tr>`;
    }).join('');
    let nearestDist=null, nearestName=null;
    const lgaCentroid = feature.geometry ? L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]) : null;
    const lgaBoundaryFeat = this.state.data.lgasBoundary?.features?.find(b => b.properties.lganame === lgaName);
    // Buffer analysis rows for report
    const bufferRows = this.state.data.landfills.features.filter(lf=>lf.geometry).map(lf => {
      const [lo,la] = lf.geometry.coordinates;
      const nm = lf.properties.Name || 'Landfill';
      const d  = lgaCentroid ? lgaCentroid.distanceTo(L.latLng(la,lo)) : Infinity;
      let zone,zc;
      if(d<=100){zone='≤ 100 m';zc='#00e5a0'}else if(d<=500){zone='≤ 500 m';zc='#ffb547'}else if(d<=1000){zone='≤ 1 km';zc='#ff4d6a'}else{zone='> 1 km';zc='#3d5168'}
      const T = window.turf;
      const inLGA = T && lgaBoundaryFeat ? T.booleanPointInPolygon(T.point([lo,la]), lgaBoundaryFeat) : false;
      return { nm, d, zone, zc, inLGA };
    }).sort((a,b)=>a.d-b.d);
    const bufferTableRows = bufferRows.map(r=>`<tr><td style='font-weight:600'>${r.nm}</td><td>${Math.round(r.d).toLocaleString()} m</td><td><span style='background:${r.zc}22;color:${r.zc};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;border:1px solid ${r.zc}44'>${r.zone}</span></td><td><span style='background:${r.inLGA?'rgba(0,212,255,0.15)':'#f1f5f9'};color:${r.inLGA?'#0284c7':'#94a3b8'};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700'>${r.inLGA?'IN LGA':'OUTSIDE'}</span></td></tr>`).join('');
    if (lgaCentroid && this.state.data.landfills) {
      this.state.data.landfills.features.forEach(lf => {
        if (!lf.geometry) return;
        const d = lgaCentroid.distanceTo(L.latLng(lf.geometry.coordinates[1], lf.geometry.coordinates[0]));
        if (nearestDist===null || d<nearestDist) { nearestDist=d; nearestName=lf.properties.Name||lf.properties.lganame||'Unnamed'; }
      });
    }
    const lfDisplay = nearestDist!==null ? `${nearestName}<br/><small style="color:#94a3b8">${Math.round(nearestDist).toLocaleString()} m away</small>` : '-';
    // Load logo as base64 for embedding in report
    let logoBase64 = '';
    try {
      const logoResp = await fetch('logo.png');
      if (logoResp.ok) {
        const blob = await logoResp.blob();
        logoBase64 = await new Promise(res => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(blob);
        });
      }
    } catch(e) { logoBase64 = ''; }

    // Capture map + draw selected LGA boundary on canvas
    let mapImg = '';
    try {
      const lgaBoundaryFeat2 = this.state.data.lgasBoundary?.features?.find(b => b.properties.lganame === lgaName);
      if (lgaBoundaryFeat2 && this.map) {
        this.map.fitBounds(L.geoJSON(lgaBoundaryFeat2).getBounds(), { padding:[50,50], animate:false });
      }
      // Brief tick for Leaflet to update container-point math
      await new Promise(r => setTimeout(r, 80));

      const mapEl = this.map.getContainer();
      const W = mapEl.offsetWidth, H = mapEl.offsetHeight;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      // 1 — fetch chosen basemap tiles directly by URL
      await this._drawBasemapTiles(ctx, reportBasemap || this.state.currentBasemap);

      // 2 — draw the LGA boundary highlight on top
      if (lgaBoundaryFeat2?.geometry) {
        ctx.save();
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth   = 3;
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur  = 10;
        ctx.fillStyle   = 'rgba(0,212,255,0.10)';
        const geom  = lgaBoundaryFeat2.geometry;
        const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
        polys.forEach(poly => {
          poly.forEach(ring => {
            ctx.beginPath();
            ring.forEach(([lng, lat], i) => {
              const pt = this.map.latLngToContainerPoint(L.latLng(lat, lng));
              i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          });
        });
        ctx.restore();
      }
      mapImg = canvas.toDataURL('image/png');
    } catch(e) { mapImg = ''; }

    const barImg = this.charts.lgaComparison ? this.charts.lgaComparison.canvas.toDataURL('image/png') : '';
    // ── Statewide context rows ──────────────────────────
    const metrics3 = ['ch4','no2','co','isi'];
    const mLabels  = { ch4:'CH₄', no2:'NO₂', co:'CO', isi:'ISI Score' };
    const feats    = this.state.data.lgas.features;
    const contextRows = metrics3.map(m => {
      const allVals = feats.map(f => (m==='isi'?(f.properties['isi_'+year]||0):this.getMetricValue(f,m,year)||0)).filter(v=>v>0);
      const avg     = allVals.reduce((a,b)=>a+b,0)/allVals.length;
      const lgaVal  = m==='isi'?(isi):(m==='ch4'?ch4:m==='no2'?no2:co)||0;
      const sorted  = [...allVals].sort((a,b)=>b-a);
      const rank    = sorted.indexOf(lgaVal)+1 || sorted.findIndex(v=>v<=lgaVal)+1;
      const pct     = Math.round((1-(rank/allVals.length))*100);
      const vColor  = lgaVal>avg?'#dc2626':'#16a34a';
      return '<tr><td style="font-weight:600">'+mLabels[m]+'</td>'+      '<td style="color:'+vColor+';font-weight:700">'+lgaVal.toFixed(m==='isi'?4:6)+'</td>'+      '<td>'+avg.toFixed(m==='isi'?4:6)+'</td>'+      '<td style="font-weight:600">#'+rank+' / '+allVals.length+'</td>'+      '<td style="color:'+vColor+';font-weight:700">'+pct+'th</td></tr>';
    }).join('');

    // ── Anomaly detection — all 3 gases + ISI ──────────
    const anomalyGases = [
      { key:'ch4', label:'CH₄', val:ch4 },
      { key:'no2', label:'NO₂', val:no2 },
      { key:'co',  label:'CO',       val:co  },
      { key:'isi', label:'ISI Score', val:isi },
    ];
    const anomalyRows = anomalyGases.map(g => {
      const vals = feats.map(f => g.key==='isi'
        ? (f.properties['isi_'+year]||0)
        : (this.getMetricValue(f,g.key,year)||0)).filter(v=>v>0);
      const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
      const std  = Math.sqrt(vals.reduce((s,v)=>s+Math.pow(v-mean,2),0)/vals.length);
      const z    = std>0?((g.val-mean)/std):0;
      const flag = Math.abs(z)>1.5;
      const zCol = z>1.5?'#dc2626':z<-1.5?'#16a34a':'#64748b';
      return { ...g, mean, std, z, flag, zCol };
    });
    const anyAnomal = anomalyRows.some(r=>r.flag);
    const anomalyTableRows = anomalyRows.map(r =>
      '<tr>'
      +'<td style="font-weight:600">'+r.label+'</td>'
      +'<td style="font-weight:700;color:'+(r.val>r.mean?'#dc2626':'#16a34a')+'">'+r.val.toFixed(r.key==='isi'?4:6)+'</td>'
      +'<td>'+r.mean.toFixed(r.key==='isi'?4:6)+'</td>'
      +'<td>'+r.std.toFixed(r.key==='isi'?4:6)+'</td>'
      +'<td style="font-weight:700;color:'+r.zCol+'">'+r.z.toFixed(2)+'σ</td>'
      +'<td>'+(r.flag?'<span style="background:'+(r.z>0?'#dc262618':'#16a34a18')+';color:'+(r.z>0?'#dc2626':'#16a34a')+';padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;border:1px solid '+(r.z>0?'#dc262644':'#16a34a44')+'">'+(r.z>0?'⚠ HIGH':'↓ LOW')+'</span>':'<span style="color:#64748b;font-size:9px">—</span>')+'</td>'
      +'</tr>'
    ).join('');
    const anomalySection = '<div><div class="st">Anomaly Detection (All Gases)</div>'
      +'<div style="background:'+(anyAnomal?riskColor+'18':'rgba(22,163,74,0.08)')+';border:1px solid '+(anyAnomal?riskColor+'44':'rgba(22,163,74,0.3)')+';border-left:4px solid '+(anyAnomal?riskColor:'#16a34a')+';border-radius:8px;padding:10px 14px;margin-bottom:10px">'
      +'<div style="font-size:13px;font-weight:700;color:'+(anyAnomal?riskColor:'#16a34a')+'">'+(anyAnomal?'⚠️ Anomalous Emissions Detected':'✅ All Gases Within Normal Range')+'</div>'
      +'<div style="font-size:10px;color:#64748b;margin-top:3px">Z-score threshold: ±1.5σ &nbsp;·&nbsp; Based on Lagos State LGA distribution ('+year+')'+(anyAnomal?' &nbsp;·&nbsp; May indicate unauthorized dumping activity':'')+'</div>'
      +'</div>'
      +'<table><thead><tr><th>Gas</th><th>LGA Value</th><th>Mean</th><th>Std Dev</th><th>Z-Score</th><th>Flag</th></tr></thead>'
      +'<tbody>'+anomalyTableRows+'</tbody></table></div>';

    // ── Nearest landfill status ─────────────────────────
    let lfStatusHtml = '';
    if (this.state.data.landfills) {
      const lfRows = this.state.data.landfills.features.filter(lf=>lf.geometry).map(lf=>{
        const nm  = lf.properties.Name||lf.properties.name||'Landfill';
        const raw = lf.properties.Status||lf.properties.status||'';
        const s   = raw.toString().trim().toLowerCase();
        let stLabel,stColor;
        if(!s||s==='0'){stLabel='Active';stColor='#16a34a';}
        else if(s.includes('scheduled')){stLabel='Scheduled for Decommissioning';stColor='#f97316';}
        else if(s.includes('being')){stLabel='Being Decommissioned';stColor='#ca8a04';}
        else if(s.includes('rehabilitation')||s.includes('environmental stud')){stLabel='Under Rehabilitation Study';stColor='#3b82f6';}
        else if(s.includes('closed')||s.includes('dormant')){stLabel='Closed / Dormant';stColor='#64748b';}
        else{stLabel=raw.trim()||'Active';stColor='#16a34a';}
        const d=lgaCentroid?lgaCentroid.distanceTo(L.latLng(lf.geometry.coordinates[1],lf.geometry.coordinates[0])):Infinity;
        return '<tr><td style="font-weight:600">'+nm+'</td>'
          +'<td><span style="background:'+stColor+'18;color:'+stColor+';padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;border:1px solid '+stColor+'44">'+stLabel+'</span></td>'
          +'<td>'+Math.round(d).toLocaleString()+' m</td></tr>';
      }).join('');
      lfStatusHtml = '<div><div class="st">Landfill Status</div>'
        +'<table><thead><tr><th>Landfill</th><th>Status</th><th>Distance</th></tr></thead>'
        +'<tbody>'+lfRows+'</tbody></table></div>';
    }
    const landfillStatusSection = lfStatusHtml;

    const mgs = `const c1=document.getElementById('rC').getContext('2d');new Chart(c1,{type:'line',data:{labels:${JSON.stringify(years)},datasets:[{label:'CH\u2084',data:${JSON.stringify(tCH4)},borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.07)',borderWidth:2,tension:0.4,pointRadius:4,fill:true},{label:'NO\u2082',data:${JSON.stringify(tNO2)},borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.07)',borderWidth:2,tension:0.4,pointRadius:4,fill:true},{label:'CO',data:${JSON.stringify(tCO)},borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.07)',borderWidth:2,tension:0.4,pointRadius:4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},usePointStyle:true,padding:14}},tooltip:{mode:'index',intersect:false}},scales:{y:{beginAtZero:true,title:{display:true,text:'mol/m\u00B2',font:{size:10}},grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{size:10}}},x:{grid:{display:false},ticks:{font:{size:10}}}}}});const c2=document.getElementById('rD').getContext('2d');new Chart(c2,{type:'doughnut',data:{labels:['CH\u2084','NO\u2082','CO'],datasets:[{data:${JSON.stringify([ch4,no2,co])},backgroundColor:['#3b82f6','#10b981','#f59e0b'],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'bottom',labels:{font:{size:11},usePointStyle:true,padding:12}}}}});`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LGA Report \u2014 ${lgaName}</title><script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"><\/script><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:24px}.page{max-width:820px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}.ab{height:3px;background:linear-gradient(90deg,#00d4ff,#00e5a0,#a78bfa)}.rh{background:linear-gradient(135deg,#0a1120,#0d1f3c);padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-start}.rh h1{font-size:20px;font-weight:800;color:#00d4ff}.rh p{font-size:11px;color:#7a8fa8;margin-top:3px}.rhr{text-align:right}.ln{font-size:19px;font-weight:700;color:#fff}.mt{font-size:10px;color:#7a8fa8;margin-top:4px}.bd{padding:24px 28px;display:flex;flex-direction:column;gap:20px}.st{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;display:flex;align-items:center;gap:8px}.st::after{content:'';flex:1;height:1px;background:#e2e8f0}.rb{background:${riskColor}18;border:1px solid ${riskColor}44;border-left:4px solid ${riskColor};border-radius:8px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between}.rbig{font-size:20px;font-weight:800;color:${riskColor}}.rsub{font-size:11px;color:#64748b;margin-top:3px}.rbdg{background:${riskColor};color:#fff;padding:4px 14px;border-radius:99px;font-size:11px;font-weight:700;text-transform:uppercase}.kg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kb{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}.kl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}.kv{font-size:14px;font-weight:700;color:#1e293b;line-height:1.3}.ku{font-size:9px;color:#94a3b8;margin-top:2px}.gg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.gc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;border-top:3px solid #e2e8f0}.gc.c4{border-top-color:#3b82f6}.gc.n2{border-top-color:#10b981}.gc.co{border-top-color:#f59e0b}.gs{font-size:13px;font-weight:800;margin-bottom:3px}.gn{font-size:9px;color:#94a3b8;text-transform:uppercase;margin-bottom:7px}.gv{font-size:14px;font-weight:700;color:#0284c7}.gu{font-size:9px;color:#94a3b8}.cw{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;height:260px;position:relative}.cg{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cw2{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;height:260px;position:relative}.cl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#f1f5f9}th{padding:7px 10px;text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0}td{padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#334155}tr:last-child td{border-bottom:none}.ft{background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 28px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}.ac{text-align:center;padding:20px;display:flex;justify-content:center;gap:10px}@media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}.ac{display:none!important}}</style></head><body><div class="page"><div class="ab"></div><div class="rh"><div style="display:flex;align-items:center;gap:12px">${logoBase64 ? `<img src="${logoBase64}" style="width:64px;height:64px;object-fit:contain;border-radius:8px">` : ''}<div><h1>Lagos ERM</h1><p>Environmental Risk Monitor · Spatial Analysis of Dumpsite Gas Emissions</p></div></div><div class="rhr"><div class="ln">${lgaName}</div><div class="mt">LGA Summary Report · Year ${year} · ${date}</div></div></div>${mapImg ? `<div style="position:relative;overflow:hidden;height:300px;border-bottom:1px solid #e2e8f0;background:#070c14"><img src="${mapImg}" style="width:100%;height:100%;object-fit:contain"><div style="position:absolute;bottom:0;left:0;right:0;padding:10px 16px;background:linear-gradient(transparent,rgba(7,12,20,0.9));display:flex;justify-content:space-between;align-items:flex-end"><span style="color:#fff;font-weight:700;font-size:14px">${lgaName}</span><span style="color:#00d4ff;font-size:11px">${year} · ${risk.label}</span></div></div>` : ''}<div class="bd"><div><div class="st">Risk Classification</div><div class="rb"><div><div class="rbig">${risk.label}</div><div class="rsub">ISI: ${isi.toFixed(4)} · Impact Severity Index (0–1)</div></div><span class="rbdg">${risk.label}</span></div></div><div><div class="st">Key Indicators</div><div class="kg"><div class="kb"><div class="kl">ISI Score</div><div class="kv">${isi.toFixed(4)}</div><div class="ku">0–1 normalized</div></div><div class="kb"><div class="kl">YoY CH₄</div><div class="kv">${yoy!=='N/A'?(yoy>0?'+':'')+yoy+'%':'N/A'}</div><div class="ku">vs ${prevYear}</div></div><div class="kb"><div class="kl">Nearest Landfill</div><div class="kv">${lfDisplay}</div></div><div class="kb"><div class="kl">Risk Level</div><div class="kv" style="color:${riskColor}">${risk.label}</div><div class="ku">ERI</div></div></div></div><div><div class="st">Emissions (${year})</div><div class="gg"><div class="gc c4"><div class="gs">CH₄</div><div class="gn">Methane</div><div class="gv">${ch4?ch4.toFixed(6):'-'}</div><div class="gu">mol/m²</div></div><div class="gc n2"><div class="gs">NO₂</div><div class="gn">Nitrogen Dioxide</div><div class="gv">${no2?no2.toFixed(6):'-'}</div><div class="gu">mol/m²</div></div><div class="gc co"><div class="gs">CO</div><div class="gn">Carbon Monoxide</div><div class="gv">${co?co.toFixed(6):'-'}</div><div class="gu">mol/m²</div></div></div></div><div><div class="st">Buffer Analysis</div><table><thead><tr><th>Landfill</th><th>Distance</th><th>Zone</th><th>Status</th></tr></thead><tbody>${bufferTableRows}</tbody></table></div><div><div class="st">Gas Trend — All 3 Gases (2018–2025)</div><div class="cw"><canvas id="rC"></canvas></div></div><div><div class="cg">${barImg?'<div><div class="cl">Top 10 LGAs</div><img src="'+barImg+'" style="width:100%;border-radius:6px;border:1px solid #e2e8f0"/></div>':'<div></div>'}<div><div class="cl">Gas Composition</div><div class="cw2"><canvas id="rD"></canvas></div></div></div></div><div><div class="st">8-Year Data Table</div><table><thead><tr><th>Year</th><th>CH₄</th><th>NO₂</th><th>CO</th><th>ISI</th><th>Risk</th></tr></thead><tbody>${trendRows}</tbody></table></div></div><div class="ft"><span>Lagos ERM · Geoinfotech Resources Limited</span><span>${date} · Sentinel-5P</span></div></div><div class="ac"><button onclick="window.print()" style="background:#0284c7;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">⬇️ Download PDF</button><button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Close</button></div><script>${mgs}<\/script></body></html>`;
    const win = window.open('','_blank','width=970,height=800');
    win.document.write(html);
    win.document.close();
  },

  async _loadLogoBase64() {
    try {
      const r = await fetch('logo.png');
      if (!r.ok) return '';
      const blob = await r.blob();
      return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    } catch(e) { return ''; }
  },

  buildReportPage(title, subtitle, bodyHtml, scripts = '', logoBase64 = '') {
    const safeFile = JSON.stringify((title||'report').replace(/\s+/g,'_').replace(/[^a-z0-9_]/gi,'')+'_report.html');
    const logoHtml = logoBase64 ? `<img src="${logoBase64}" style="width:56px;height:56px;object-fit:contain;border-radius:8px;flex-shrink:0">` : '';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:24px}.page{max-width:820px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}.ab{height:3px;background:linear-gradient(90deg,#00d4ff,#00e5a0,#a78bfa)}.rh{background:linear-gradient(135deg,#0a1120,#0d1f3c);padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-start}.rh h1{font-size:20px;font-weight:800;color:#00d4ff}.rh p{font-size:11px;color:#7a8fa8;margin-top:3px;max-width:540px}.rhr{text-align:right}.ln{font-size:19px;font-weight:700;color:#fff}.mt{font-size:10px;color:#7a8fa8;margin-top:4px}.bd{padding:24px 28px;display:flex;flex-direction:column;gap:20px}.rb{background:rgba(22,163,74,0.12);border:1px solid rgba(22,163,74,0.3);border-left:4px solid #16a34a;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}.rbdg{background:#16a34a;color:#fff;padding:4px 14px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase}.kg{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.kb{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px}.kl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}.kv{font-size:18px;font-weight:700;color:#0f172a}.ku{font-size:11px;color:#64748b;margin-top:6px}.chart-wrap{margin-top:18px;padding:18px;background:#fff;border:1px solid #e2e8f0;border-radius:12px}.report-map{margin-top:18px}.report-map img{width:100%;border-radius:12px;border:1px solid #e2e8f0}.note{margin-top:16px;font-size:13px;color:#475569;line-height:1.6}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{padding:12px;border:1px solid #e2e8f0;font-size:13px}th{background:#eff6ff;text-align:left;color:#0f172a}.ac{text-align:center;padding:20px;display:flex;justify-content:center;gap:10px}@media print{.ac{display:none!important}}</style></head><body><div class="page"><div class="ab"></div><div class="rh"><div style="display:flex;align-items:center;gap:12px">${logoHtml}<div><h1>${title}</h1><p>${subtitle}</p></div></div><div class="rhr"><div class="ln">Report</div></div></div><div class="bd">${bodyHtml}</div></div><div class="ac"><button onclick="_dlHTML()" style="background:#0f766e;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">&#8659; Download HTML</button><button onclick="window.print()" style="background:#0284c7;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">&#8659; Save as PDF</button><button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Close</button></div>${scripts}<script>function _dlHTML(){var b=new Blob([document.documentElement.outerHTML],{type:'text/html;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=${safeFile};document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}<\/script></body></html>`;
  },

  // ── Tile math helpers ────────────────────────────────────────
  _latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latR = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
    return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
  },

  _tileTopLeftLatLng(tx, ty, zoom) {
    const n = Math.pow(2, zoom);
    const lng = tx / n * 360 - 180;
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))) * 180 / Math.PI;
    return L.latLng(lat, lng);
  },

  // Fetch tiles directly by URL for the chosen basemap and paint them onto ctx.
  // Bypasses the Leaflet DOM entirely → no timing races, guaranteed correct basemap.
  async _drawBasemapTiles(ctx, basemap) {
    const subdomains = { carto: ['a','b','c','d'], osm: ['a','b','c'], satellite: [''] };
    const urlFns = {
      carto:     (s,z,x,y) => `https://${s}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
      osm:       (s,z,x,y) => `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
      satellite: (s,z,x,y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    };
    const bm     = urlFns[basemap] ? basemap : 'carto';
    const urlFn  = urlFns[bm];
    const subs   = subdomains[bm];
    const tSz    = 256;
    const zoom   = Math.round(this.map.getZoom());
    const bounds = this.map.getBounds();

    const sw = this._latLngToTile(bounds.getSouth(), bounds.getWest(), zoom);
    const ne = this._latLngToTile(bounds.getNorth(), bounds.getEast(), zoom);
    const minX = Math.min(sw.x, ne.x), maxX = Math.max(sw.x, ne.x);
    const minY = Math.min(sw.y, ne.y), maxY = Math.max(sw.y, ne.y);

    const jobs = [];
    let si = 0;
    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        const sub = subs[si++ % subs.length] || '';
        const url = urlFn(sub, zoom, tx, ty);
        const pt  = this.map.latLngToContainerPoint(this._tileTopLeftLatLng(tx, ty, zoom));
        jobs.push({ url, px: Math.round(pt.x), py: Math.round(pt.y) });
      }
    }

    const tilePromise = j => new Promise(resolve => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const guard = setTimeout(() => resolve(), 5000); // per-tile safety timeout
      img.onload  = () => { clearTimeout(guard); ctx.drawImage(img, j.px, j.py, tSz, tSz); resolve(); };
      img.onerror = () => { clearTimeout(guard); resolve(); };
      img.src = j.url;
    });
    // Overall cap: don't wait more than 10 s for all tiles
    await Promise.race([
      Promise.all(jobs.map(tilePromise)),
      new Promise(r => setTimeout(r, 10000)),
    ]);
  },

  // Universal map snapshot — fetches basemap tiles directly then draws the feature overlay.
  // reportBasemap: 'carto' | 'osm' | 'satellite'  (required; no DOM dependency)
  async captureMapWithDrawnFeature(type, geometry, reportBasemap = 'carto') {
    if (!this.map) return '';

    let boundsLatLngs = [];
    if (type === 'point') {
      boundsLatLngs = [L.latLng(geometry.lat, geometry.lng)];
    } else if (type === 'polyline') {
      boundsLatLngs = geometry.map(ll =>
        (ll && typeof ll.lat === 'number') ? ll : L.latLng(ll[0], ll[1]));
    } else if (type === 'polygon') {
      boundsLatLngs = geometry.map(([lng, lat]) => L.latLng(lat, lng));
    }

    const prevCenter = this.map.getCenter();
    const prevZoom   = this.map.getZoom();
    let mapImg = '';

    try {
      // Pan/zoom so latLngToContainerPoint gives correct screen positions
      if (boundsLatLngs.length > 1) {
        const bounds = L.latLngBounds(boundsLatLngs);
        if (bounds.isValid()) this.map.fitBounds(bounds, { padding:[55,55], animate:false });
      } else if (boundsLatLngs.length === 1) {
        this.map.setView(boundsLatLngs[0], Math.max(this.map.getZoom(), 14), { animate:false });
      }
      // Brief tick so Leaflet updates container-point math
      await new Promise(r => setTimeout(r, 80));

      const W = this.map.getContainer().offsetWidth;
      const H = this.map.getContainer().offsetHeight;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const c = canvas.getContext('2d');

      // 1 — draw basemap tiles fetched directly from provider URL
      await this._drawBasemapTiles(c, reportBasemap);

      // 2 — draw the digitized feature on top
      c.save();
      if (type === 'point') {
        const pt = this.map.latLngToContainerPoint(L.latLng(geometry.lat, geometry.lng));
        c.beginPath(); c.arc(pt.x, pt.y, 16, 0, Math.PI*2);
        c.fillStyle = 'rgba(0,212,255,0.18)'; c.fill();
        c.strokeStyle = '#00d4ff'; c.lineWidth = 1.5; c.stroke();
        c.beginPath(); c.arc(pt.x, pt.y, 5, 0, Math.PI*2);
        c.fillStyle = '#00d4ff'; c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
        c.strokeStyle = '#00d4ff'; c.lineWidth = 1.5;
        [[pt.x-20,pt.y,pt.x-9,pt.y],[pt.x+9,pt.y,pt.x+20,pt.y],
         [pt.x,pt.y-20,pt.x,pt.y-9],[pt.x,pt.y+9,pt.x,pt.y+20]].forEach(([x1,y1,x2,y2]) => {
          c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
        });
      } else if (type === 'polyline') {
        c.shadowColor = '#00d4ff'; c.shadowBlur = 8;
        c.beginPath(); c.strokeStyle = '#00d4ff'; c.lineWidth = 3;
        boundsLatLngs.forEach((ll, i) => {
          const pt = this.map.latLngToContainerPoint(ll);
          i === 0 ? c.moveTo(pt.x, pt.y) : c.lineTo(pt.x, pt.y);
        });
        c.stroke(); c.shadowBlur = 0;
        [[boundsLatLngs[0],'#00e5a0'],[boundsLatLngs[boundsLatLngs.length-1],'#ff4d6a']].forEach(([ll,col]) => {
          const pt = this.map.latLngToContainerPoint(ll);
          c.beginPath(); c.arc(pt.x,pt.y,6,0,Math.PI*2);
          c.fillStyle=col; c.fill(); c.strokeStyle='#fff'; c.lineWidth=1.5; c.stroke();
        });
      } else if (type === 'polygon') {
        const pts = geometry.map(([lng,lat]) => this.map.latLngToContainerPoint(L.latLng(lat,lng)));
        c.beginPath();
        pts.forEach((pt,i) => i===0 ? c.moveTo(pt.x,pt.y) : c.lineTo(pt.x,pt.y));
        c.closePath();
        c.fillStyle='rgba(168,85,247,0.16)'; c.fill();
        c.shadowColor='#a855f7'; c.shadowBlur=6;
        c.strokeStyle='#a855f7'; c.lineWidth=3; c.setLineDash([8,5]); c.stroke();
      }
      c.restore();
      mapImg = canvas.toDataURL('image/png');
    } catch(e) {
      mapImg = '';
    } finally {
      try { this.map.setView(prevCenter, prevZoom, { animate:false }); } catch(e) {}
    }
    return mapImg;
  },

  async captureReportPolygonImage(coords) {
    if (!this.map || !coords || coords.length < 3) return '';
    const latLngs = coords.map(([lng, lat]) => L.latLng(lat, lng));
    const bounds = L.latLngBounds(latLngs);
    const prevCenter = this.map.getCenter();
    const prevZoom = this.map.getZoom();
    let mapImg = '';
    try {
      if (bounds.isValid()) this.map.fitBounds(bounds, { padding:[40,40], animate:false });
      await new Promise(r => setTimeout(r, 700));
      const mapEl = this.map.getContainer();
      const mapRect = mapEl.getBoundingClientRect();
      const W = mapEl.offsetWidth, H = mapEl.offsetHeight;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      const drawPolygon = () => {
        try {
          ctx.save();
          ctx.fillStyle = 'rgba(168,85,247,0.16)';
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 6]);
          ctx.beginPath();
          latLngs.forEach((ll, idx) => {
            const pt = this.map.latLngToContainerPoint(ll);
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } catch (e) {}
        mapImg = canvas.toDataURL('image/png');
      };

      const tiles = mapEl.querySelectorAll('img.leaflet-tile');
      let loaded = 0, total = tiles.length;
      if (total === 0) {
        drawPolygon();
      } else {
        tiles.forEach(tile => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const r = tile.getBoundingClientRect();
            ctx.drawImage(img, r.left - mapRect.left, r.top - mapRect.top, r.width, r.height);
            if (++loaded === total) drawPolygon();
          };
          img.onerror = () => { if (++loaded === total) drawPolygon(); };
          img.src = tile.src;
        });
        setTimeout(() => { if (loaded < total) drawPolygon(); }, 4000);
      }
    } catch (e) {
      mapImg = '';
    } finally {
      try { this.map.setView(prevCenter, prevZoom, { animate:false }); } catch (e) {}
    }
    return mapImg;
  },

  async generateRasterLGAReport(feature, pt, date, reportBasemap) {
    const year  = this.state.currentYear;
    const lgaName = feature.properties.lganame;
    const ch4 = this.getMetricValue(feature,'ch4',year)||0;
    const no2 = this.getMetricValue(feature,'no2',year)||0;
    const co  = this.getMetricValue(feature,'co', year)||0;
    const isi = feature.properties[`isi_${year}`] || 0;
    const risk = this.getEriClassification(isi);
    const prevYear = String(parseInt(year)-1);
    const prevCH4  = this.getMetricValue(feature,'ch4',prevYear)||0;
    const yoy = prevCH4 !== 0 ? ((ch4-prevCH4)/prevCH4*100).toFixed(1) : 'N/A';
    const riskColors = { low:'#16a34a', moderate:'#ca8a04', elevated:'#f97316', high:'#dc2626', critical:'#7c2d12' };
    const riskColor  = riskColors[risk.css] || '#888';
    const years  = this.getYears();
    const feats  = this.state.data.lgas.features;

    // Trend rows
    const tCH4 = years.map(y=>this.getMetricValue(feature,'ch4',y)||0);
    const tNO2 = years.map(y=>this.getMetricValue(feature,'no2',y)||0);
    const tCO  = years.map(y=>this.getMetricValue(feature,'co', y)||0);
    const tISI = years.map(y=>feature.properties[`isi_${y}`]||0);
    const trendRows = years.map((y,i)=>{
      const r=this.getEriClassification(tISI[i]), rc=riskColors[r.css]||'#888';
      const isCur = y===year ? 'style="background:#eff6ff;font-weight:600"' : '';
      return `<tr ${isCur}><td>${y}</td><td>${tCH4[i]?tCH4[i].toFixed(6):'-'}</td><td>${tNO2[i]?tNO2[i].toFixed(6):'-'}</td><td>${tCO[i]?tCO[i].toFixed(6):'-'}</td><td>${tISI[i]?tISI[i].toFixed(4):'-'}</td><td><span style="background:${rc};color:#fff;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">${r.label}</span></td></tr>`;
    }).join('');

    // Buffer analysis
    const lgaCentroid = feature.geometry ? L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]) : null;
    const lgaBoundaryFeat = this.state.data.lgasBoundary?.features?.find(b => b.properties.lganame === lgaName);
    const bufferRows = this.state.data.landfills.features.filter(lf=>lf.geometry).map(lf=>{
      const [lo,la]=lf.geometry.coordinates, nm=lf.properties.Name||'Landfill';
      const d=lgaCentroid?lgaCentroid.distanceTo(L.latLng(la,lo)):Infinity;
      let zone,zc;
      if(d<=100){zone='≤ 100 m';zc='#00e5a0'}else if(d<=500){zone='≤ 500 m';zc='#ffb547'}else if(d<=1000){zone='≤ 1 km';zc='#ff4d6a'}else{zone='> 1 km';zc='#3d5168'}
      const T=window.turf, inLGA=T&&lgaBoundaryFeat?T.booleanPointInPolygon(T.point([lo,la]),lgaBoundaryFeat):false;
      return {nm,d,zone,zc,inLGA};
    }).sort((a,b)=>a.d-b.d);
    const bufferTableRows = bufferRows.map(r=>`<tr><td style='font-weight:600'>${r.nm}</td><td>${Math.round(r.d).toLocaleString()} m</td><td><span style='background:${r.zc}22;color:${r.zc};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;border:1px solid ${r.zc}44'>${r.zone}</span></td><td><span style='background:${r.inLGA?'rgba(0,212,255,0.15)':'#f1f5f9'};color:${r.inLGA?'#0284c7':'#94a3b8'};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700'>${r.inLGA?'IN LGA':'OUTSIDE'}</span></td></tr>`).join('');

    // Nearest landfill
    let nearestDist=null, nearestName=null;
    if (lgaCentroid && this.state.data.landfills) {
      this.state.data.landfills.features.forEach(lf=>{
        if(!lf.geometry)return;
        const d=lgaCentroid.distanceTo(L.latLng(lf.geometry.coordinates[1],lf.geometry.coordinates[0]));
        if(nearestDist===null||d<nearestDist){nearestDist=d;nearestName=lf.properties.Name||'Unnamed';}
      });
    }
    const lfDisplay = nearestDist!==null?`${nearestName}<br/><small style="color:#94a3b8">${Math.round(nearestDist).toLocaleString()} m away</small>`:'-';

    // Statewide context
    const metrics3=['ch4','no2','co','isi'];
    const mLabels={ch4:'CH₄',no2:'NO₂',co:'CO',isi:'ISI Score'};
    const contextRows = metrics3.map(m=>{
      const allVals=feats.map(f=>(m==='isi'?(f.properties['isi_'+year]||0):this.getMetricValue(f,m,year)||0)).filter(v=>v>0);
      const avg=allVals.reduce((a,b)=>a+b,0)/allVals.length;
      const lgaVal=m==='isi'?isi:(m==='ch4'?ch4:m==='no2'?no2:co)||0;
      const sorted=[...allVals].sort((a,b)=>b-a);
      const rank=sorted.indexOf(lgaVal)+1||sorted.findIndex(v=>v<=lgaVal)+1;
      const pct=Math.round((1-(rank/allVals.length))*100);
      const vColor=lgaVal>avg?'#dc2626':'#16a34a';
      return `<tr><td style="font-weight:600">${mLabels[m]}</td><td style="color:${vColor};font-weight:700">${lgaVal.toFixed(m==='isi'?4:6)}</td><td>${avg.toFixed(m==='isi'?4:6)}</td><td style="font-weight:600">#${rank} / ${allVals.length}</td><td style="color:${vColor};font-weight:700">${pct}th</td></tr>`;
    }).join('');

    // Anomaly detection
    const anomalyGases=[{key:'ch4',label:'CH₄',val:ch4},{key:'no2',label:'NO₂',val:no2},{key:'co',label:'CO',val:co},{key:'isi',label:'ISI Score',val:isi}];
    const anomalyRows=anomalyGases.map(g=>{
      const vals=feats.map(f=>g.key==='isi'?(f.properties['isi_'+year]||0):(this.getMetricValue(f,g.key,year)||0)).filter(v=>v>0);
      const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      const std=Math.sqrt(vals.reduce((s,v)=>s+Math.pow(v-mean,2),0)/vals.length);
      const z=std>0?((g.val-mean)/std):0;
      const flag=Math.abs(z)>1.5;
      const zCol=z>1.5?'#dc2626':z<-1.5?'#16a34a':'#64748b';
      return {label:g.label,val:g.val,mean,std,z,flag,zCol,key:g.key};
    });
    const anyAnomal=anomalyRows.some(r=>r.flag);
    const anomalyTableRows=anomalyRows.map(r=>`<tr><td style="font-weight:600">${r.label}</td><td style="font-weight:700;color:${r.val>r.mean?'#dc2626':'#16a34a'}">${r.val.toFixed(r.key==='isi'?4:6)}</td><td>${r.mean.toFixed(r.key==='isi'?4:6)}</td><td>${r.std.toFixed(r.key==='isi'?4:6)}</td><td style="font-weight:700;color:${r.zCol}">${r.z.toFixed(2)}σ</td><td>${r.flag?`<span style="background:${r.z>0?'#dc262618':'#16a34a18'};color:${r.z>0?'#dc2626':'#16a34a'};padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;border:1px solid ${r.z>0?'#dc262644':'#16a34a44'}">${r.z>0?'⚠ HIGH':'↓ LOW'}</span>`:'<span style="color:#64748b;font-size:9px">—</span>'}</td></tr>`).join('');

    // Bar chart image from live canvas
    const barImg = this.charts.lgaComparison ? this.charts.lgaComparison.canvas.toDataURL('image/png') : '';

    // Inline Chart.js script: trend line + composition doughnut
    const chartScript = `const c1=document.getElementById('rC').getContext('2d');new Chart(c1,{type:'line',data:{labels:${JSON.stringify(years)},datasets:[{label:'CH₄',data:${JSON.stringify(tCH4)},borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.07)',borderWidth:2,tension:0.4,pointRadius:4,fill:true},{label:'NO₂',data:${JSON.stringify(tNO2)},borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.07)',borderWidth:2,tension:0.4,pointRadius:4,fill:true},{label:'CO',data:${JSON.stringify(tCO)},borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.07)',borderWidth:2,tension:0.4,pointRadius:4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},usePointStyle:true,padding:14}},tooltip:{mode:'index',intersect:false}},scales:{y:{beginAtZero:true,title:{display:true,text:'mol/m²',font:{size:10}},grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{size:10}}},x:{grid:{display:false},ticks:{font:{size:10}}}}}});const c2=document.getElementById('rD').getContext('2d');new Chart(c2,{type:'doughnut',data:{labels:['CH₄','NO₂','CO'],datasets:[{data:${JSON.stringify([ch4,no2,co])},backgroundColor:['#3b82f6','#10b981','#f59e0b'],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'bottom',labels:{font:{size:11},usePointStyle:true,padding:12}}}}});`;

    // Logo + map image
    let logoBase64='';
    try{const r=await fetch('logo.png');if(r.ok){const b=await r.blob();logoBase64=await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(b);});}}catch(e){}
    let mapImg='';
    try{
      const bf=this.state.data.lgasBoundary?.features?.find(b=>b.properties.lganame===lgaName);
      if(bf&&this.map)this.map.fitBounds(L.geoJSON(bf).getBounds(),{padding:[50,50],animate:false});
      await new Promise(r=>setTimeout(r,80));
      const mapEl=this.map.getContainer(),W=mapEl.offsetWidth,H=mapEl.offsetHeight;
      const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
      const ctx2=canvas.getContext('2d');
      await this._drawBasemapTiles(ctx2,reportBasemap||this.state.currentBasemap);
      if(bf?.geometry){
        ctx2.save();ctx2.strokeStyle='#00d4ff';ctx2.lineWidth=3;ctx2.shadowColor='#00d4ff';ctx2.shadowBlur=10;ctx2.fillStyle='rgba(0,212,255,0.10)';
        const geom=bf.geometry,polys=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;
        polys.forEach(poly=>poly.forEach(ring=>{ctx2.beginPath();ring.forEach(([lng2,lat2],i)=>{const p=this.map.latLngToContainerPoint(L.latLng(lat2,lng2));i===0?ctx2.moveTo(p.x,p.y):ctx2.lineTo(p.x,p.y);});ctx2.closePath();ctx2.fill();ctx2.stroke();}));
        ctx2.restore();
      }
      // Draw raster click point
      if(pt.lat&&pt.lng){
        const p=this.map.latLngToContainerPoint(L.latLng(pt.lat,pt.lng));
        ctx2.save();ctx2.beginPath();ctx2.arc(p.x,p.y,7,0,Math.PI*2);ctx2.fillStyle='rgba(0,212,255,0.9)';ctx2.fill();ctx2.strokeStyle='#fff';ctx2.lineWidth=2;ctx2.stroke();ctx2.restore();
      }
      mapImg=canvas.toDataURL('image/png');
    }catch(e){}

    const clipNote = this.state.rasterClipLGA ? `<span style="background:rgba(0,212,255,0.12);color:#00d4ff;border:1px solid rgba(0,212,255,0.3);border-radius:99px;padding:2px 10px;font-size:10px;font-weight:700;margin-left:8px">CLIPPED TO LGA</span>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Raster Report — ${lgaName} · ${year}</title><script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"><\/script><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:24px}.page{max-width:860px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}.ab{height:3px;background:linear-gradient(90deg,#00d4ff,#00e5a0,#a78bfa)}.rh{background:linear-gradient(135deg,#0a1120,#0d1f3c);padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-start}.rh h1{font-size:20px;font-weight:800;color:#00d4ff}.rh p{font-size:11px;color:#7a8fa8;margin-top:3px}.rhr{text-align:right}.ln{font-size:19px;font-weight:700;color:#fff}.mt{font-size:10px;color:#7a8fa8;margin-top:4px}.bd{padding:24px 28px;display:flex;flex-direction:column;gap:20px}.st{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;display:flex;align-items:center;gap:8px}.st::after{content:'';flex:1;height:1px;background:#e2e8f0}.rb{background:${riskColor}18;border:1px solid ${riskColor}44;border-left:4px solid ${riskColor};border-radius:8px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between}.rbig{font-size:20px;font-weight:800;color:${riskColor}}.rsub{font-size:11px;color:#64748b;margin-top:3px}.rbdg{background:${riskColor};color:#fff;padding:4px 14px;border-radius:99px;font-size:11px;font-weight:700}.pg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.pb{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;border-left:3px solid}.pb.c4{border-left-color:#3b82f6}.pb.n2{border-left-color:#10b981}.pb.co{border-left-color:#f59e0b}.pb.is{border-left-color:#a855f7}.pl{font-size:10px;font-weight:700;color:#475569;margin-bottom:3px}.pv{font-size:15px;font-weight:700;color:#0f172a}.pu{font-size:9px;color:#94a3b8}.kg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kb{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}.kl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}.kv{font-size:14px;font-weight:700;color:#1e293b}.ku{font-size:9px;color:#94a3b8;margin-top:2px}.gg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.gc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;border-top:3px solid #e2e8f0}.gc.c4{border-top-color:#3b82f6}.gc.n2{border-top-color:#10b981}.gc.co{border-top-color:#f59e0b}.gs{font-size:13px;font-weight:800;margin-bottom:3px}.gn{font-size:9px;color:#94a3b8;text-transform:uppercase;margin-bottom:7px}.gv{font-size:14px;font-weight:700;color:#0284c7}.gu{font-size:9px;color:#94a3b8}.cw{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;height:260px;position:relative}.cg{display:grid;grid-template-columns:5fr 2fr;gap:14px;align-items:start}.bi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;height:230px;display:flex;flex-direction:column}.bi img{flex:1;width:100%;object-fit:contain;border-radius:4px;min-height:0}.cw2{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;height:155px;position:relative}.cl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#f1f5f9}th{padding:7px 10px;text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e8f0}td{padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:middle}tr:last-child td{border-bottom:none}.ft{background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 28px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}.ac{text-align:center;padding:20px;display:flex;justify-content:center;gap:10px}@media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}.ac{display:none!important}}</style></head><body><div class="page"><div class="ab"></div>
<div class="rh"><div style="display:flex;align-items:center;gap:12px">${logoBase64?`<img src="${logoBase64}" style="width:64px;height:64px;object-fit:contain;border-radius:8px">`:''}
<div><h1>Lagos ERM — Raster Report</h1><p>Pixel-level Emission Analysis · Sentinel-5P · Raster View${clipNote?` · Clipped to ${lgaName}`:''}</p></div></div>
<div class="rhr"><div class="ln">${lgaName}</div><div class="mt">Year ${year} · ${date}</div></div></div>
${mapImg?`<div style="position:relative;overflow:hidden;height:300px;border-bottom:1px solid #e2e8f0;background:#070c14"><img src="${mapImg}" style="width:100%;height:100%;object-fit:contain"><div style="position:absolute;bottom:0;left:0;right:0;padding:10px 16px;background:linear-gradient(transparent,rgba(7,12,20,0.9));display:flex;justify-content:space-between;align-items:flex-end"><span style="color:#fff;font-weight:700;font-size:14px">${lgaName}</span><span style="color:#00d4ff;font-size:11px">Raster View · ${year} · ${risk.label}</span></div></div>`:''}
<div class="bd">
<div><div class="st">Risk Classification</div><div class="rb"><div><div class="rbig">${risk.label}</div><div class="rsub">ISI: ${isi.toFixed(4)} · Impact Severity Index (0–1)</div></div><span class="rbdg">${risk.label}</span></div></div>

<div><div class="st">Pixel Values at Click Point &nbsp;<span style="font-size:9px;color:#94a3b8;font-weight:400;text-transform:none;letter-spacing:0">${pt.lat.toFixed(5)}°N, ${pt.lng.toFixed(5)}°E</span></div>
<div class="pg">
  <div class="pb c4"><div class="pl">CH₄ Methane</div><div class="pv">${(pt.ch4||0).toFixed(6)}</div><div class="pu">mol/m²</div></div>
  <div class="pb n2"><div class="pl">NO₂ Nitrogen Dioxide</div><div class="pv">${(pt.no2||0).toFixed(6)}</div><div class="pu">mol/m²</div></div>
  <div class="pb co"><div class="pl">CO Carbon Monoxide</div><div class="pv">${(pt.co||0).toFixed(6)}</div><div class="pu">mol/m²</div></div>
  <div class="pb is"><div class="pl">ISI Risk Score</div><div class="pv">${(pt.isi||0).toFixed(4)}</div><div class="pu">index</div></div>
</div>
${pt.hot>0.5?`<div style="margin-top:8px;background:#dc262618;border:1px solid #dc262644;border-left:4px solid #dc2626;border-radius:8px;padding:8px 14px;font-size:11px;color:#dc2626;font-weight:600">🔴 Hotspot signal detected at this pixel (index: ${(pt.hot||0).toFixed(2)})</div>`:''}</div>

<div><div class="st">LGA Summary — ${lgaName}</div>
<div class="kg">
  <div class="kb"><div class="kl">CH₄ Methane</div><div class="kv">${ch4.toFixed(5)}</div><div class="ku">mol/m²</div></div>
  <div class="kb"><div class="kl">NO₂ Nitrogen Dioxide</div><div class="kv">${no2.toFixed(5)}</div><div class="ku">mol/m²</div></div>
  <div class="kb"><div class="kl">CO Carbon Monoxide</div><div class="kv">${co.toFixed(5)}</div><div class="ku">mol/m²</div></div>
  <div class="kb"><div class="kl">YoY CH₄ Change</div><div class="kv" style="color:${Number(yoy)>0?'#dc2626':'#16a34a'}">${yoy!=='N/A'?(Number(yoy)>0?'+':'')+yoy+'%':'N/A'}</div><div class="ku">vs ${prevYear}</div></div>
</div></div>

<div><div class="st">Gas Trend — All 3 Gases (${years[0]}–${year})</div><div class="cw"><canvas id="rC"></canvas></div></div>

<div><div class="cg">
  ${barImg?`<div class="bi"><div class="cl">Top 10 LGAs Comparison</div><img src="${barImg}"/></div>`:'<div></div>'}
  <div><div class="cl">Gas Composition (LGA)</div><div class="cw2"><canvas id="rD"></canvas></div></div>
</div></div>

<div><div class="st">Statewide Context &amp; Ranking</div><table><thead><tr><th>Metric</th><th>LGA Value</th><th>State Avg</th><th>Rank</th><th>Percentile</th></tr></thead><tbody>${contextRows}</tbody></table></div>

<div><div class="st">Anomaly Detection</div>
<div style="background:${anyAnomal?riskColor+'18':'rgba(22,163,74,0.08)'};border:1px solid ${anyAnomal?riskColor+'44':'rgba(22,163,74,0.3)'};border-left:4px solid ${anyAnomal?riskColor:'#16a34a'};border-radius:8px;padding:10px 14px;margin-bottom:10px">
  <div style="font-size:13px;font-weight:700;color:${anyAnomal?riskColor:'#16a34a'}">${anyAnomal?'⚠️ Anomalous Emissions Detected':'✅ All Gases Within Normal Range'}</div>
  <div style="font-size:10px;color:#64748b;margin-top:3px">Z-score threshold: ±1.5σ · Lagos State LGA distribution (${year})${anyAnomal?' · May indicate unauthorized dumping activity':''}</div>
</div>
<table><thead><tr><th>Gas</th><th>LGA Value</th><th>Mean</th><th>Std Dev</th><th>Z-Score</th><th>Flag</th></tr></thead><tbody>${anomalyTableRows}</tbody></table></div>

<div><div class="st">Historical Emission Trend</div><table><thead><tr><th>Year</th><th>CH₄</th><th>NO₂</th><th>CO</th><th>ISI</th><th>Risk</th></tr></thead><tbody>${trendRows}</tbody></table></div>

<div><div class="st">Buffer Analysis — Proximity to Landfills</div><table><thead><tr><th>Landfill</th><th>Distance</th><th>Buffer Zone</th><th>In LGA</th></tr></thead><tbody>${bufferTableRows}</tbody></table></div>

</div><div class="ft"><span>Lagos ERM · Geoinfotech Resources Limited · Raster View</span><span>${date} · Sentinel-5P · ${year}</span></div></div>
<div class="ac"><button onclick="window.print()" style="background:#0284c7;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">⬇ Download PDF</button><button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Close</button></div>
<script>${chartScript}<\/script></body></html>`;

    const w = window.open('','_blank','width=970,height=800,scrollbars=yes');
    if (!w) { this.showNotification('Pop-up blocked. Allow pop-ups for this page.','info'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch(e){} }, 600);
  },

  async generateDrawPointReport(ctx, date, reportBasemap = null) {
    const riskColors = { low:'#16a34a', moderate:'#ca8a04', elevated:'#f97316', high:'#dc2626', critical:'#7c2d12' };
    const riskColor  = riskColors[ctx.risk.css] || '#888';

    const [logoBase64, mapImg] = await Promise.all([
      this._loadLogoBase64(),
      (ctx.lat != null && ctx.lng != null)
        ? this.captureMapWithDrawnFeature('point', { lat: ctx.lat, lng: ctx.lng }, reportBasemap)
        : Promise.resolve(''),
    ]);

    const body = `
      <div class="rb" style="background:${riskColor}18;border-color:${riskColor}44;border-left-color:${riskColor}">
        <div>
          <div class="rbdg" style="background:${riskColor}">${ctx.risk.label}</div>
          <div class="mt">Point analysis</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;color:#475569">${ctx.label}</div>
          <div class="mt">Year: ${ctx.year}</div>
        </div>
      </div>
      ${mapImg ? `<div class="report-map"><img src="${mapImg}" alt="Analyzed point location"/></div>` : ''}
      <div class="kg">
        <div class="kb"><div class="kl">CH₄</div><div class="kv">${ctx.vals.ch4.toFixed(6)}</div><div class="ku">mol/m²</div></div>
        <div class="kb"><div class="kl">NO₂</div><div class="kv">${ctx.vals.no2.toFixed(6)}</div><div class="ku">mol/m²</div></div>
        <div class="kb"><div class="kl">CO</div><div class="kv">${ctx.vals.co.toFixed(6)}</div><div class="ku">mol/m²</div></div>
        <div class="kb"><div class="kl">ISI</div><div class="kv">${ctx.vals.isi.toFixed(4)}</div><div class="ku">Index</div></div>
      </div>
    `;
    const html = this.buildReportPage(ctx.title, `Study area: ${ctx.label} · Year: ${ctx.year} · ${date}`, body, '', logoBase64);
    const win = window.open('','_blank','width=860,height=820');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  },

  async generateTransectReport(ctx, date, reportBasemap = null) {
    const values      = ctx.results.map(r => r.value).filter(v => v != null);
    const sampleCount = ctx.sampleCount || values.length;
    const mean        = values.length ? (values.reduce((a,b)=>a+b,0)/values.length).toFixed(6) : 'N/A';
    const min         = values.length ? Math.min(...values).toFixed(6) : 'N/A';
    const max         = values.length ? Math.max(...values).toFixed(6) : 'N/A';
    const totalDist   = ctx.totalDist ? (ctx.totalDist / 1000).toFixed(2) : '0.00';

    // Capture map with the transect path drawn on it
    const pathLatLngs = ctx.sampleLatLngs?.length ? ctx.sampleLatLngs
                      : ctx.latlngs?.length       ? ctx.latlngs
                      : [];
    const [logoBase64, mapImg] = await Promise.all([
      this._loadLogoBase64(),
      pathLatLngs.length >= 2
        ? this.captureMapWithDrawnFeature('polyline', pathLatLngs, reportBasemap)
        : Promise.resolve(''),
    ]);

    // Build per-sample table rows (every 5th sample to keep it readable)
    const tableRows = ctx.results
      .filter((_, i) => i % Math.max(1, Math.floor(ctx.results.length / 15)) === 0)
      .map(r => `<tr><td>${(r.distance/1000).toFixed(2)} km</td><td>${r.value != null ? r.value.toFixed(6) : '—'}</td></tr>`)
      .join('');

    const body = `
      <div class="kg">
        <div class="kb"><div class="kl">Metric</div><div class="kv">${ctx.mLabel}</div><div class="ku">Gas measured</div></div>
        <div class="kb"><div class="kl">Distance</div><div class="kv">${totalDist} km</div><div class="ku">Total transect length</div></div>
        <div class="kb"><div class="kl">Samples</div><div class="kv">${sampleCount}</div><div class="ku">Points along path</div></div>
        <div class="kb"><div class="kl">Mean</div><div class="kv">${mean}</div><div class="ku">mol/m²</div></div>
      </div>
      ${mapImg ? `<div class="report-map"><img src="${mapImg}" alt="Transect path on map"/><p style="font-size:10px;color:#94a3b8;margin-top:6px;text-align:center">● Start &nbsp;&nbsp; ● End &nbsp;—&nbsp; Transect path</p></div>` : ''}
      <div style="margin-top:12px;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Emission Profile Along Transect</div>
      <div class="chart-wrap" style="height:280px"><canvas id="transectChart"></canvas></div>
      <div style="margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        <div class="kb"><div class="kl">Mean</div><div class="kv" style="font-size:13px">${mean}</div><div class="ku">mol/m²</div></div>
        <div class="kb"><div class="kl">Min</div><div class="kv" style="font-size:13px;color:#16a34a">${min}</div><div class="ku">mol/m²</div></div>
        <div class="kb"><div class="kl">Max</div><div class="kv" style="font-size:13px;color:#dc2626">${max}</div><div class="ku">mol/m²</div></div>
      </div>
      ${tableRows ? `<div style="margin-top:14px"><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">Sample Values (selected)</div><table><thead><tr><th>Distance</th><th>${ctx.mLabel} (mol/m²)</th></tr></thead><tbody>${tableRows}</tbody></table></div>` : ''}
    `;
    const scripts = `<script>const ctxc=document.getElementById('transectChart').getContext('2d');new Chart(ctxc,{type:'line',data:{labels:${JSON.stringify(ctx.results.map(r=>(r.distance/1000).toFixed(2)))},datasets:[{label:'${ctx.mLabel} (mol/m²)',data:${JSON.stringify(ctx.results.map(r=>r.value))},borderColor:'${ctx.mColor}',backgroundColor:'${ctx.mColor}22',fill:true,pointRadius:2,borderWidth:2.5,tension:0.35,spanGaps:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:c=>\`\${c[0].label} km\`,label:c=>\`${ctx.mLabel}: \${c.raw!=null?c.raw.toFixed(6):'N/A'}\`}}},scales:{x:{title:{display:true,text:'Distance (km)',font:{size:11}},ticks:{maxTicksLimit:10}},y:{title:{display:true,text:'${ctx.mLabel} (mol/m²)',font:{size:11}},beginAtZero:false}}}});<\/script>`;
    const html = this.buildReportPage(ctx.title, `Emission transect profile · ${ctx.mLabel} · Year: ${ctx.year} · ${date}`, body, scripts, logoBase64);
    const win = window.open('','_blank','width=980,height=920');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  },

  async generateZoneReport(ctx, date, reportBasemap = null) {
    const rows = ['ch4','no2','co','isi'].map(key => {
      const label = key === 'ch4' ? 'CH₄' : key === 'no2' ? 'NO₂' : key === 'co' ? 'CO' : 'ISI';
      const values = ctx.stats[key] || {};
      const precision = key === 'isi' ? 4 : 6;
      const fmt = v => (v != null && !isNaN(v) ? Number(v).toFixed(precision) : 'N/A');
      return `<tr><td>${label}</td><td>${fmt(values.mean)}</td><td>${fmt(values.min)}</td><td>${fmt(values.max)}</td><td>${fmt(values.std)}</td></tr>`;
    }).join('');
    const details = ctx.lgaDetails || [];
    const lgas = details.length ? details.map(d => d.lgaName).join(', ') : (ctx.lgaNames.length ? ctx.lgaNames.join(', ') : 'None');
    const lgaCount = details.length || ctx.lgaNames.length || 0;
    const areaKm2 = ctx.areaKm2 != null ? ctx.areaKm2 : 'N/A';
    const source = ctx.source || 'Drawn area';
    const polyCoords = ctx.polygonCoords || ctx.drawnCoords || [];
    const [logoBase64, mapImg] = await Promise.all([
      this._loadLogoBase64(),
      polyCoords.length >= 3
        ? this.captureMapWithDrawnFeature('polygon', polyCoords, reportBasemap)
        : Promise.resolve(''),
    ]);
    const detailRows = details.map(d => {
      const fmt = (v, key) => {
        if (v == null || isNaN(v)) return 'N/A';
        return key === 'isi' ? Number(v).toFixed(4) : Number(v).toFixed(6);
      };
      return `<tr><td>${d.lgaName}</td><td>${fmt(d.ch4,'ch4')}</td><td>${fmt(d.no2,'no2')}</td><td>${fmt(d.co,'co')}</td><td>${fmt(d.isi,'isi')}</td></tr>`;
    }).join('');

    const body = `
      <div class="kg">
        <div class="kb"><div class="kl">Area</div><div class="kv">${areaKm2}</div><div class="ku">km²</div></div>
        <div class="kb"><div class="kl">Source</div><div class="kv">${source}</div><div class="ku">Selection type</div></div>
        <div class="kb"><div class="kl">LGAs included</div><div class="kv">${lgaCount}</div><div class="ku">Overlapping LGAs</div></div>
      </div>
      ${mapImg ? `<div class="report-map"><img src="${mapImg}" alt="Digitized area"/></div>` : ''}
      <table><thead><tr><th>Metric</th><th>Mean</th><th>Min</th><th>Max</th><th>Std Dev</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="note"><strong>LGAs included:</strong> ${lgas}</div>
      ${detailRows ? `<div class="note"><strong>LGA detail values:</strong></div><table><thead><tr><th>LGA</th><th>CH₄</th><th>NO₂</th><th>CO</th><th>ISI</th></tr></thead><tbody>${detailRows}</tbody></table>` : ''}
    `;
    const html = this.buildReportPage(ctx.title, `Zone statistics · Year: ${ctx.year} · ${date}`, body, '', logoBase64);
    const win = window.open('','_blank','width=980,height=900');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  },

  // ── Drawing Tools ────────────────────────────────────────────

  initDrawTools() {
    this.state.drawnItems = L.featureGroup().addTo(this.map);

    const markerIcon = L.divIcon({
      className: '',
      html: '<div style="width:12px;height:12px;border-radius:50%;background:#00d4ff;border:2px solid #070c14;box-shadow:0 0 8px rgba(0,212,255,0.7)"></div>',
      iconSize: [12, 12], iconAnchor: [6, 6], popupAnchor: [0, -10],
    });

    this._drawHandlers = {
      marker:   new L.Draw.Marker(this.map, { icon: markerIcon, repeatMode: false }),
      polyline: new L.Draw.Polyline(this.map, {
        shapeOptions: { color: '#00d4ff', weight: 2.5, dashArray: '5 4', opacity: 0.9 },
        showLength: true, metric: true, repeatMode: false,
      }),
      polygon:  new L.Draw.Polygon(this.map, {
        shapeOptions: { color: '#a855f7', weight: 2, fillColor: '#a855f7', fillOpacity: 0.12 },
        showArea: true, metric: true, repeatMode: false,
      }),
    };

    const appRef = this;
    const DrawCtrl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function() {
        const div = L.DomUtil.create('div', 'draw-toolbar');
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        div.innerHTML = `
          <button class="draw-btn" id="draw-point-btn" title="Point — inspect pixel gas values">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
            </svg>
          </button>
          <button class="draw-btn" id="draw-line-btn" title="Transect — emission profile along a line">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
            </svg>
          </button>
          <button class="draw-btn" id="draw-poly-btn" title="Zone — zonal statistics for a drawn area">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
            </svg>
          </button>
          <div class="draw-sep"></div>
          <button class="draw-btn" id="draw-clip-btn" title="Clip raster to selected LGA">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6,2 6,18 22,18"/><polyline points="2,6 18,6 18,22"/>
            </svg>
          </button>
          <div class="draw-sep"></div>
          <button class="draw-btn" id="draw-clear-btn" title="Clear all drawings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6m3,0V4h8v2"/>
            </svg>
          </button>
        `;
        div.querySelector('#draw-point-btn').onclick = () => appRef.activateDrawTool('marker');
        div.querySelector('#draw-line-btn').onclick  = () => appRef.activateDrawTool('polyline');
        div.querySelector('#draw-poly-btn').onclick  = () => appRef.activateDrawTool('polygon');
        div.querySelector('#draw-clip-btn').onclick  = () => {
          if (appRef.state.rasterClipLGA) {
            appRef.applyRasterClip(null);
            return;
          }
          const rasterActive = document.getElementById('rasterLayer')?.checked;
          if (!rasterActive) {
            appRef.showNotification('Switch to Raster View to use LGA clipping.', 'info');
            return;
          }
          const lgaName = appRef.state.selectedFeature?.properties?.lganame;
          if (!lgaName) {
            appRef.showNotification('Select an LGA first using the dropdown or search bar.', 'info');
            return;
          }
          appRef.applyRasterClip(lgaName);
        };
        div.querySelector('#draw-clear-btn').onclick = () => appRef.clearDrawings();
        return div;
      },
    });
    new DrawCtrl().addTo(this.map);

    this.map.on(L.Draw.Event.CREATED, (e) => this.handleDrawCreated(e));
  },

  activateDrawTool(type) {
    if (this.state.activeDraw) {
      this._drawHandlers[this.state.activeDraw]?.disable();
    }
    if (this.state.activeDraw === type) {
      this.state.activeDraw = null;
      document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
      return;
    }
    this.state.activeDraw = type;
    document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
    const btnMap = { marker:'draw-point-btn', polyline:'draw-line-btn', polygon:'draw-poly-btn' };
    document.getElementById(btnMap[type])?.classList.add('active');
    this._drawHandlers[type]?.enable();
  },

  handleDrawCreated(e) {
    this.state.activeDraw = null;
    document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
    const { layer, layerType } = e;
    this.state.drawnItems.addLayer(layer);
    const flattenLatLngs = (items) => {
      if (!Array.isArray(items)) return [items];
      return items.flatMap(item => Array.isArray(item) ? flattenLatLngs(item) : item);
    };

    if (layerType === 'marker') {
      this.analyzeDrawnPoint(layer.getLatLng(), layer);
    } else if (layerType === 'polyline') {
      const latlngs = flattenLatLngs(layer.getLatLngs());
      this.analyzeDrawnTransect(latlngs, layer);
    } else if (layerType === 'polygon') {
      const latlngs = flattenLatLngs(layer.getLatLngs());
      this.analyzeDrawnZone(latlngs, layer);
    }
  },

  // ── Point ────────────────────────────────────────────────────
  async analyzeDrawnPoint(latlng, layer) {
    const { lat, lng } = latlng;
    const year = parseInt(this.state.currentYear);

    this.showDrawResults('Point Analysis',
      `<div class="draw-loading"><span class="draw-pulse"></span>Fetching pixel values…</div>`);

    try {
      let vals;
      let geeOk = false;
      if (this.state.geeMode) {
        try {
          const resp = await fetch(
            `${this.state.GEE_SERVER}/pixel?lat=${lat}&lng=${lng}&year=${year}`,
            { signal: AbortSignal.timeout(8000) }
          );
          const data = await resp.json();
          if (!data.error) { vals = data; geeOk = true; }
        } catch(geeErr) {
          // GEE unavailable or timed out — fall through to local raster
        }
      }
      if (!geeOk) {
        const gr = await this.loadRaster(String(year));
        if (!gr) throw new Error('No local raster available');
        const col = Math.floor((lng - gr.xmin) / gr.pixelWidth);
        const row = Math.floor((gr.ymax - lat) / gr.pixelHeight);
        if (row < 0 || row >= gr.height || col < 0 || col >= gr.width)
          throw new Error('Point outside raster extent');
        vals = {
          ch4: (gr.values[0][row][col] || 0) * this.CH4_PPB_TO_MOL,
          no2: Math.max(0, gr.values[1][row][col] || 0),
          co:  gr.values[2][row][col] || 0,
          isi: gr.values[3][row][col] || 0,
          hot: gr.values[4]?.[row]?.[col] || 0,
        };
      }
      const risk = this.getEriClassification(vals.isi);
      layer.bindPopup(`
        <div style="font-family:Inter,sans-serif;font-size:11px;min-width:145px">
          <div style="font-weight:700;color:#00d4ff;margin-bottom:5px">Pixel · ${year}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px"><span>CH₄</span><b style="color:#3b82f6">${(vals.ch4||0).toFixed(5)}</b></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px"><span>NO₂</span><b style="color:#10b981">${(vals.no2||0).toFixed(5)}</b></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px"><span>CO</span><b style="color:#f59e0b">${(vals.co||0).toFixed(5)}</b></div>
          <div style="display:flex;justify-content:space-between"><span>ISI</span><b style="color:#a855f7">${(vals.isi||0).toFixed(4)}</b></div>
        </div>
      `).openPopup();

      this.state.currentDrawContext = {
        type: 'point', title: 'Point Analysis', year, lat, lng,
        vals: { ch4: vals.ch4 || 0, no2: vals.no2 || 0, co: vals.co || 0, isi: vals.isi || 0 },
        risk, label: `${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`,
      };
      this.showDrawResults('Point Analysis', `
        <div class="draw-point-grid">
          <div class="draw-stat-box ch4"><div class="draw-gas-sym">CH₄</div><div class="draw-gas-val">${(vals.ch4||0).toFixed(5)}</div><div class="draw-gas-unit">mol/m²</div></div>
          <div class="draw-stat-box no2"><div class="draw-gas-sym">NO₂</div><div class="draw-gas-val">${(vals.no2||0).toFixed(5)}</div><div class="draw-gas-unit">mol/m²</div></div>
          <div class="draw-stat-box co"><div class="draw-gas-sym">CO</div><div class="draw-gas-val">${(vals.co||0).toFixed(5)}</div><div class="draw-gas-unit">mol/m²</div></div>
          <div class="draw-stat-box isi"><div class="draw-gas-sym">ISI</div><div class="draw-gas-val">${(vals.isi||0).toFixed(4)}</div><div class="draw-gas-unit">score</div></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="font-size:9px;color:var(--t3)">${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E</span>
          <span class="sa-badge ${risk.css}" style="font-size:8px">${risk.label}</span>
        </div>
      `);
    } catch(err) {
      this.showDrawResults('Point Analysis',
        `<div style="color:var(--red);font-size:11px;padding:6px 0">${err.message}</div>`);
    }
  },

  // ── Transect ─────────────────────────────────────────────────
  async analyzeDrawnTransect(latlngs, layer) {
    const year    = parseInt(this.state.currentYear);
    const metric  = this.state.currentMetric;
    const mLabel  = { ch4:'CH₄', no2:'NO₂', co:'CO' }[metric] || metric.toUpperCase();
    const mColor  = { ch4:'#3b82f6', no2:'#10b981', co:'#f59e0b' }[metric] || '#00d4ff';
    const samples = this.samplePolyline(latlngs, 30);

    this.showDrawResults('Emission Transect',
      `<div class="draw-loading"><span class="draw-pulse"></span>Sampling ${samples.length} points along transect…</div>`,
      true);

    let results;
    if (this.state.geeMode) {
      // Parallel fetches — all sample requests in flight simultaneously
      results = await Promise.all(samples.map(async s => {
        try {
          const resp = await fetch(
            `${this.state.GEE_SERVER}/pixel?lat=${s.latlng.lat}&lng=${s.latlng.lng}&year=${year}`,
            { signal: AbortSignal.timeout(12000) }
          );
          const data = await resp.json();
          return { distance: s.distance, value: data.error ? null : (data[metric] ?? null), latlng: s.latlng };
        } catch(e) {
          return { distance: s.distance, value: null, latlng: s.latlng };
        }
      }));
    } else {
      // Load raster once, then read all sample pixels synchronously
      const gr = await this.loadRaster(String(year));
      const bi = this.BAND_INDEX[metric] ?? 0;
      const nodata = gr?.noDataValue;
      results = samples.map(s => {
        let val = null;
        if (gr) {
          const col = Math.floor((s.latlng.lng - gr.xmin) / gr.pixelWidth);
          const row = Math.floor((gr.ymax - s.latlng.lat) / gr.pixelHeight);
          if (row >= 0 && row < gr.height && col >= 0 && col < gr.width) {
            const raw = gr.values[bi]?.[row]?.[col];
            // Reject only true nodata (null, NaN, the georaster noDataValue, or large sentinel like -9999)
            const isNodata = raw == null || isNaN(raw)
              || (nodata != null && raw === nodata)
              || raw < -9000;
            if (!isNodata)
              val = metric === 'ch4' ? Math.max(0, raw * this.CH4_PPB_TO_MOL) : Math.max(0, raw);
          }
        }
        return { distance: s.distance, value: val, latlng: s.latlng };
      });
    }

    const totalDist    = results[results.length - 1]?.distance || 0;
    const sampleLatLngs = samples.map(s => s.latlng);

    this.state.currentDrawContext = {
      type: 'transect', title: 'Emission Transect', year, metric, mLabel, mColor,
      results, totalDist, sampleCount: samples.length,
      sampleLatLngs, latlngs,
    };

    this.showDrawResults('Emission Transect', `
      <div style="font-size:10px;color:var(--t2);margin-bottom:2px">
        ${mLabel} · ${year} · ${(totalDist/1000).toFixed(2)} km · ${samples.length} samples
      </div>
      <div style="font-size:9px;color:var(--t3)">Hover the chart to trace the position on the map</div>
    `, true);

    const wrap = document.getElementById('drawTransectWrap');
    if (wrap) wrap.style.display = 'block';
    const canvas = document.getElementById('drawTransectChart');
    if (!canvas) return;

    // Defer chart creation by one frame so the browser has time to compute
    // layout for the newly-visible wrap element (avoids 0×0 canvas dimensions).
    const renderTransectChart = () => {
      if (!canvas) return;
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
        return setTimeout(renderTransectChart, 50);
      }
      try {
        if (this.charts.transect) { this.charts.transect.destroy(); this.charts.transect = null; }
        this.charts.transect = new Chart(canvas, {
          type: 'line',
          data: {
            labels: results.map(r => (r.distance / 1000).toFixed(2)),
            datasets: [{
              label: `${mLabel} (mol/m²)`,
              data:  results.map(r => r.value),
              borderColor: mColor, backgroundColor: mColor + '18',
              borderWidth: 2, pointRadius: 3, fill: true, tension: 0.3, spanGaps: true,
            }],
          },
          options: {
            animation: false,
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: {
                title: c => `${c[0].label} km`,
                label: c => `${mLabel}: ${c.raw != null ? c.raw.toFixed(5) : 'N/A'}`,
              }},
            },
            scales: {
              x: { title:{ display:true, text:'Distance (km)', color:'#7a8fa8', font:{size:9} },
                   ticks:{ color:'#7a8fa8', font:{size:8}, maxTicksLimit:6 }, grid:{ color:'rgba(255,255,255,0.04)' } },
              y: { title:{ display:true, text:`${mLabel} (mol/m²)`, color:'#7a8fa8', font:{size:9} },
                   ticks:{ color:'#7a8fa8', font:{size:8} }, grid:{ color:'rgba(255,255,255,0.04)' } },
            },
          },
        });
      } catch (chartErr) {
        console.error('Transect chart failed to render:', chartErr);
        const resultContent = document.getElementById('drawResultsContent');
        if (resultContent) {
          resultContent.innerHTML += `<div style="color:var(--red);font-size:11px;padding:6px 0">Transect chart failed to render: ${chartErr.message}</div>`;
        }
        return;
      }

      // ── Profile cursor: pulsing marker on the map that tracks chart hover ──
      if (this._profileCursor) { this.map.removeLayer(this._profileCursor); this._profileCursor = null; }
      const cursorIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${mColor};border:2px solid #fff;box-shadow:0 0 10px ${mColor}cc;transform:translate(-50%,-50%)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      const firstLL = sampleLatLngs[0] || latlngs[0];
      this._profileCursor = L.marker([firstLL.lat, firstLL.lng], { icon: cursorIcon, interactive: false, zIndexOffset: 1000 }).addTo(this.map);
      this._profileCursor.setOpacity(0);
      this._profileCursorSamples = sampleLatLngs;

      canvas.style.cursor = 'crosshair';
      canvas.onmousemove = (evt) => {
        if (!this.charts.transect || !this._profileCursorSamples) return;
        const els = this.charts.transect.getElementsAtEventForMode(evt, 'index', { intersect: false }, false);
        if (els.length) {
          const idx = Math.min(els[0].index, this._profileCursorSamples.length - 1);
          const ll  = this._profileCursorSamples[idx];
          if (ll) { this._profileCursor.setLatLng(ll); this._profileCursor.setOpacity(1); }
        }
      };
      canvas.onmouseleave = () => { if (this._profileCursor) this._profileCursor.setOpacity(0); };
    };
    // Use setTimeout instead of rAF: rAF fires before the browser reflows the
    // newly-shown drawTransectWrap, causing clientHeight to read as 0 and the
    // dimension-check loop inside renderTransectChart to spin forever.
    setTimeout(renderTransectChart, 0);
  },

  // ── Zone ─────────────────────────────────────────────────────
  async analyzeDrawnZone(latlngs, layer) {
    const year = parseInt(this.state.currentYear);

    this.showDrawResults('Zone Analysis',
      `<div class="draw-loading"><span class="draw-pulse" style="background:#a855f7"></span>Running zonal statistics…</div>`);

    try {
      const coords = latlngs.map(ll => [ll.lng, ll.lat]);
      if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1])
        coords.push(coords[0]);

      let stats, source = 'LGA data';

      // Try GEE /zone-stats; fall back silently on any failure
      if (this.state.geeMode) {
        try {
          const resp = await fetch(`${this.state.GEE_SERVER}/zone-stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ geometry: { type:'Polygon', coordinates:[coords] }, year }),
            signal: AbortSignal.timeout(30000),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (data.error) throw new Error(data.error);
          stats = data;
          source = 'GEE';
        } catch(geeErr) {
          console.warn('GEE zone-stats unavailable, using LGA data:', geeErr.message);
        }
      }

      // Always-available fallback: compute from loaded LGA GeoJSON attributes
      if (!stats) stats = this.computeLGAZoneStats(coords, year);

      const gases = [
        { key:'ch4', label:'CH₄', color:'#3b82f6' },
        { key:'no2', label:'NO₂', color:'#10b981' },
        { key:'co',  label:'CO',  color:'#f59e0b' },
        { key:'isi', label:'ISI', color:'#a855f7' },
      ];
      const areaKm2 = window.turf ? (turf.area(turf.polygon([coords])) / 1e6).toFixed(2) : '—';

      const rows = gases.map(g => {
        const s  = stats[g.key] || {};
        const dp = g.key === 'isi' ? 4 : 5;
        const f  = v => (v != null && !isNaN(v)) ? Number(v).toFixed(dp) : '—';
        return `<tr>
          <td><span style="color:${g.color};font-weight:700">${g.label}</span></td>
          <td style="text-align:right;color:var(--t1);font-weight:600">${f(s.mean)}</td>
          <td style="text-align:right;color:var(--t1)">${f(s.min)}</td>
          <td style="text-align:right;color:var(--t1)">${f(s.max)}</td>
          <td style="text-align:right;color:var(--t1)">${f(s.std)}</td>
        </tr>`;
      }).join('');

      const lgaNames = Array.isArray(stats._lgas)
        ? stats._lgas.map(item => item.lgaName)
        : [];
      const lgaNote = lgaNames.length
        ? `<div style="font-size:9px;color:var(--t3);margin-top:6px">
             ${lgaNames.length} LGA${lgaNames.length > 1 ? 's' : ''}: ${lgaNames.slice(0,4).join(', ')}${lgaNames.length > 4 ? '…' : ''}
           </div>` : '';
      this.state.currentDrawContext = {
        type: 'zone', title: 'Zone Analysis', year, areaKm2, source, stats, lgaNames,
        lgaDetails: Array.isArray(stats._lgas) ? stats._lgas : [],
        polygonCoords: coords,
      };
      this.showDrawResults('Zone Analysis', `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:10px;color:var(--t2)">~${areaKm2} km² · ${year}</span>
          <span style="font-size:9px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.5px">${source}</span>
        </div>
        <table class="draw-results-table">
          <thead><tr>
            <th style="text-align:left">Gas</th>
            <th style="text-align:right">Mean</th>
            <th style="text-align:right">Min</th>
            <th style="text-align:right">Max</th>
            <th style="text-align:right">Std</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${lgaNote}
      `);
    } catch(err) {
      this.showDrawResults('Zone Analysis',
        `<div style="color:var(--red);font-size:11px;padding:6px 0">${err.message}</div>`);
    }
  },

  // Compute zone stats from LGA GeoJSON attributes — no raster required
  computeLGAZoneStats(closedCoords, year) {
    if (!this.state.data.lgas) throw new Error('LGA data not loaded');
    if (!window.turf) throw new Error('Turf.js not available');

    const poly    = turf.polygon([closedCoords]);
    const yr      = String(year);
    const collect = { ch4:[], no2:[], co:[], isi:[] };
    const inside  = [];

    this.state.data.lgas.features.forEach(f => {
      const lgaName = f.properties?.lganame;
      if (!lgaName) return;

      const boundary = this.state.data.lgasBoundary?.features?.find(b => b.properties.lganame === lgaName);
      const geom     = boundary?.geometry || f.geometry;
      if (!geom) return;

      const feature = { type:'Feature', geometry:geom, properties:f.properties || {} };
      let intersects = false;
      try {
        intersects = turf.booleanIntersects(poly, feature);
      } catch(e) { intersects = false; }
      if (!intersects) return;

      const ch4 = this.getMetricValue(f, 'ch4', yr) || 0;
      const no2 = this.getMetricValue(f, 'no2', yr) || 0;
      const co  = this.getMetricValue(f, 'co',  yr) || 0;
      const isi = f.properties[`isi_${yr}`] || 0;
      inside.push({ lgaName, ch4, no2, co, isi });
      collect.ch4.push(ch4);
      collect.no2.push(no2);
      collect.co.push(co);
      collect.isi.push(isi);
    });

    // If the polygon does not intersect any LGA, use the nearest LGA centroid
    if (!inside.length) {
      const center = turf.centroid(poly);
      let best = null, bestDist = Infinity;
      this.state.data.lgas.features.forEach(f => {
        const lgaName = f.properties?.lganame;
        if (!lgaName) return;
        const boundary = this.state.data.lgasBoundary?.features?.find(b => b.properties.lganame === lgaName);
        const geom = boundary?.geometry || f.geometry;
        if (!geom) return;
        try {
          const c = geom.type === 'Point'
            ? turf.point(geom.coordinates)
            : turf.centroid({ type:'Feature', geometry:geom });
          const d = turf.distance(center, c);
          if (d < bestDist) { bestDist = d; best = f; }
        } catch(e) {}
      });
      if (best) {
        const ch4 = this.getMetricValue(best, 'ch4', yr) || 0;
        const no2 = this.getMetricValue(best, 'no2', yr) || 0;
        const co  = this.getMetricValue(best, 'co',  yr) || 0;
        const isi = best.properties[`isi_${yr}`] || 0;
        inside.push({ lgaName: best.properties.lganame + ' (nearest)', ch4, no2, co, isi });
        collect.ch4.push(ch4);
        collect.no2.push(no2);
        collect.co.push(co);
        collect.isi.push(isi);
      }
    }

    const calcStats = arr => {
      const vals = arr.filter(v => v > 0);
      if (!vals.length) return { mean:null, min:null, max:null, std:null };
      const mean = vals.reduce((a,b) => a+b, 0) / vals.length;
      return { mean, min:Math.min(...vals), max:Math.max(...vals),
               std: Math.sqrt(vals.reduce((s,v) => s+(v-mean)**2, 0) / vals.length) };
    };
    return {
      ch4: calcStats(collect.ch4), no2: calcStats(collect.no2),
      co:  calcStats(collect.co),  isi: calcStats(collect.isi),
      _lgas: inside,
    };
  },

  async computeLocalZoneStats(latlngs, year) {
    const gr = await this.loadRaster(year);
    if (!gr) throw new Error('No local raster for this year');
    if (!window.turf) throw new Error('Turf.js required for local zone stats');
    const coords = latlngs.map(ll => [ll.lng, ll.lat]);
    if (coords[0][0] !== coords[coords.length-1][0]) coords.push(coords[0]);
    const poly = turf.polygon([coords]);
    const bbox = turf.bbox(poly);
    const step = 0.008;
    const collect = { ch4:[], no2:[], co:[], isi:[] };
    const bands   = { ch4:0, no2:1, co:2, isi:3 };
    for (let lat = bbox[1]; lat <= bbox[3]; lat += step) {
      for (let lng = bbox[0]; lng <= bbox[2]; lng += step) {
        try { if (!turf.booleanPointInPolygon(turf.point([lng, lat]), poly)) continue; }
        catch(e) { continue; }
        const col = Math.floor((lng - gr.xmin) / gr.pixelWidth);
        const row = Math.floor((gr.ymax - lat) / gr.pixelHeight);
        if (row < 0 || row >= gr.height || col < 0 || col >= gr.width) continue;
        for (const [key, band] of Object.entries(bands)) {
          const raw = gr.values[band]?.[row]?.[col];
          if (raw == null || isNaN(raw) || raw <= 0) continue;
          collect[key].push(key === 'ch4' ? raw * this.CH4_PPB_TO_MOL : Math.max(0, raw));
        }
      }
    }
    const calcStats = arr => {
      if (!arr.length) return { mean:null, min:null, max:null, std:null };
      const mean = arr.reduce((a,b) => a+b, 0) / arr.length;
      return { mean, min:Math.min(...arr), max:Math.max(...arr),
               std: Math.sqrt(arr.reduce((s,v) => s+(v-mean)**2, 0) / arr.length) };
    };
    return { ch4:calcStats(collect.ch4), no2:calcStats(collect.no2), co:calcStats(collect.co), isi:calcStats(collect.isi) };
  },

  samplePolyline(latlngs, numSamples = 20) {
    // Normalize the geometry: allow a single LatLng, flat arrays, or nested arrays.
    const flattenLatLngs = (items) => {
      if (!Array.isArray(items)) return [items];
      return items.flatMap(item => Array.isArray(item) ? flattenLatLngs(item) : item);
    };

    const points = flattenLatLngs(latlngs);
    if (points.length === 0) return [];
    if (points.length === 1) return [{ latlng: points[0], distance: 0 }];

    if (window.turf) {
      const line    = turf.lineString(points.map(ll => [ll.lng, ll.lat]));
      const totalKm = turf.length(line, { units: 'kilometers' });
      return Array.from({ length: numSamples }, (_, i) => {
        const d  = (i / (numSamples - 1)) * totalKm;
        const pt = turf.along(line, d, { units: 'kilometers' });
        return { latlng: L.latLng(pt.geometry.coordinates[1], pt.geometry.coordinates[0]), distance: d * 1000 };
      });
    }

    // Fallback: manual linear interpolation
    const segs = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const d = points[i].distanceTo(points[i+1]);
      segs.push({ len:d, from:points[i], to:points[i+1] });
      total += d;
    }
    return Array.from({ length: numSamples }, (_, i) => {
      const target = (i / (numSamples - 1)) * total;
      let acc = 0, si = 0;
      while (si < segs.length - 1 && acc + segs[si].len < target) acc += segs[si++].len;
      const t = segs[si].len > 0 ? (target - acc) / segs[si].len : 0;
      const { from, to } = segs[si];
      return { latlng: L.latLng(from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t), distance: target };
    });
  },

  showDrawResults(title, html, keepChart = false) {
    const section      = document.getElementById('drawResultsSection');
    const titleEl      = document.getElementById('drawResultsTitle');
    const contentEl    = document.getElementById('drawResultsContent');
    const transectWrap = document.getElementById('drawTransectWrap');
    if (!section) return;
    if (titleEl)   titleEl.textContent = title;
    if (contentEl) contentEl.innerHTML = html;
    if (!keepChart && transectWrap) {
      transectWrap.style.display = 'none';
      if (this.charts.transect) { this.charts.transect.destroy(); this.charts.transect = null; }
    }
    section.style.display = 'block';
  },

  clearDrawings() {
    this.state.drawnItems?.clearLayers();
    this.state.currentDrawContext = null;
    if (this.state.activeDraw) {
      this._drawHandlers?.[this.state.activeDraw]?.disable();
      this.state.activeDraw = null;
    }
    document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
    const section = document.getElementById('drawResultsSection');
    if (section) section.style.display = 'none';
    if (this.charts.transect) { this.charts.transect.destroy(); this.charts.transect = null; }
    if (this._profileCursor) { this.map.removeLayer(this._profileCursor); this._profileCursor = null; }
    this._profileCursorSamples = null;
  },

  // Search for location
  async searchLocation() {
    const searchInput = document.getElementById('locationSearch');
    const query = searchInput.value.trim().toLowerCase();

    if (!query) return;

    // Find LGA by name
    const lgaFeature = this.state.data.lgasBoundary.features.find(f =>
      f.properties.lganame.toLowerCase().includes(query)
    );

    if (lgaFeature) {
      // Zoom to the LGA
      const bounds = L.geoJSON(lgaFeature).getBounds();
      this.map.fitBounds(bounds, { padding: [20, 20] });

      // Select the LGA
      const emissionsFeature = this.state.data.lgas.features.find(f =>
        f.properties.lganame === lgaFeature.properties.lganame
      );
      this.state.selectedFeature = emissionsFeature || lgaFeature;
      this.updateAnalyticsPanel();

      // Persistent cyan highlight (same as map click)
      if (this.state.selectedLayer) {
        const prev = this.state.selectedLayer;
        const prevName = prev.feature?.properties?.lganame;
        const prevF = this.state.data.lgas.features.find(f => f.properties.lganame === prevName);
        const prevVal = prevF ? this.getMetricValue(prevF, this.state.currentMetric, this.state.currentYear) : null;
        prev.setStyle({ weight:2, color:'white', fillOpacity:1, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
      }
      if (this.layers.lgas) {
        this.layers.lgas.eachLayer(l => {
          if (l.feature?.properties?.lganame === lgaFeature.properties.lganame) {
            const val = emissionsFeature ? this.getMetricValue(emissionsFeature, this.state.currentMetric, this.state.currentYear) : null;
            l.setStyle({ weight:3, color:'#00d4ff', fillOpacity:1, fillColor: this.getColorForValue(this.state.currentMetric, val), dashArray:'' });
            l.bringToFront();
            this.state.selectedLayer = l;
          }
        });
      }
      this._highlightLGA(lgaFeature.properties.lganame);
      // In raster mode: clip mask only — no raster re-render
      if (document.getElementById('rasterLayer')?.checked) {
        this._applyVisualClip(lgaFeature.properties.lganame);
      }
      // Sync SA panel if open
      const saPanel = document.getElementById('saPanel');
      if (saPanel?.classList.contains('open')) {
        const activeTab = document.querySelector('.sa-tab.active')?.dataset?.tab;
        if (activeTab) this.renderSATab(activeTab);
      }
    } else {
      this.showNotification('LGA not found. Please try a different search term.');
    }
  },

  // ── Auth & Backend ──────────────────────────────────────────────────────────

  async checkBackend() {
    try {
      const r = await fetch(`${this.state.BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
      this.state.backendMode = r.ok;
    } catch {
      this.state.backendMode = false;
    }
    return this.state.backendMode;
  },

  async restoreSession() {
    const token = sessionStorage.getItem('erm_token');
    if (!token) return false;
    try {
      const r = await fetch(`${this.state.BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) { sessionStorage.removeItem('erm_token'); return false; }
      const u = await r.json();
      this._applySession(token, u.username, u.role);
      return true;
    } catch { return false; }
  },

  _applySession(token, username, role) {
    this.state.authToken   = token;
    this.state.authUsername = username;
    this.state.authRole    = role;
    sessionStorage.setItem('erm_token', token);
    // Show user pill in sidebar
    const pill = document.getElementById('sidebarUser');
    if (pill) pill.style.display = 'block';
    const unEl = document.getElementById('sidebarUsername');
    if (unEl) unEl.textContent = username;
    const rlEl = document.getElementById('sidebarRole');
    if (rlEl) rlEl.textContent = role === 'admin' ? 'Administrator' : 'Viewer';
    // Show admin nav item only for admins
    const adminNav = document.getElementById('adminNavItem');
    if (adminNav) adminNav.style.display = role === 'admin' ? 'flex' : 'none';
  },

  showLoginModal() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) { overlay.style.display = 'flex'; }
    setTimeout(() => document.getElementById('loginUsername')?.focus(), 100);
  },

  hideLoginModal() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
  },

  async handleLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const errEl    = document.getElementById('loginError');
    const btn      = document.getElementById('loginBtn');
    if (!username || !password) {
      errEl.textContent = 'Please enter username and password.';
      errEl.style.display = 'block'; return;
    }
    btn.textContent = 'Signing in…'; btn.disabled = true;
    try {
      const r = await fetch(`${this.state.BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) {
        errEl.textContent = data.error || 'Login failed.';
        errEl.style.display = 'block';
        btn.textContent = 'Sign In'; btn.disabled = false; return;
      }
      this._applySession(data.token, data.username, data.role);
      this.hideLoginModal();
      // Continue app init from where we left off
      await this.loadData();
      this.initializeMap();
      this.attachEventListeners();
      this.initDrawTools();
      this.updateDashboard();
      await this.initGEEMode();
      await this.toggleGEELagosLayer(true);
      if (this.map.hasLayer(this.layers.lgas)) this.map.removeLayer(this.layers.lgas);
      await this.addRasterLayer();
      const legendSub = document.getElementById('legendSub');
      if (legendSub) legendSub.textContent = 'Pixel-level · Sentinel-5P';
    } catch (err) {
      errEl.textContent = 'Connection error. Is the backend running?';
      errEl.style.display = 'block';
      btn.textContent = 'Sign In'; btn.disabled = false;
    }
  },

  logout() {
    sessionStorage.removeItem('erm_token');
    this.state.authToken   = null;
    this.state.authUsername = null;
    this.state.authRole    = null;
    const pill = document.getElementById('sidebarUser');
    if (pill) pill.style.display = 'none';
    const adminNav = document.getElementById('adminNavItem');
    if (adminNav) adminNav.style.display = 'none';
    this.closeAdminPanel();
    this.showLoginModal();
  },

  // ── Admin panel ─────────────────────────────────────────────────────────────

  openAdminPanel() {
    document.getElementById('adminPanel')?.classList.add('open');
    this.loadAdminUsers();
  },

  closeAdminPanel() {
    document.getElementById('adminPanel')?.classList.remove('open');
  },

  _adminStatusEl(id, msg, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display   = 'block';
    el.textContent     = msg;
    el.style.background = ok ? 'rgba(0,229,160,0.12)' : 'rgba(239,68,68,0.12)';
    el.style.color      = ok ? '#00e5a0' : '#ef4444';
    el.style.border     = `1px solid ${ok ? 'rgba(0,229,160,0.3)' : 'rgba(239,68,68,0.3)'}`;
  },

  async uploadEmissionsCSV(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    this._adminStatusEl('emissionsUploadStatus', 'Uploading and processing…', true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${this.state.BACKEND_URL}/api/admin/emissions/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.state.authToken}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) { this._adminStatusEl('emissionsUploadStatus', data.error || 'Upload failed', false); return; }
      this._adminStatusEl('emissionsUploadStatus',
        `Done — ${data.records} records updated. Years: ${data.years.join(', ')}. Reloading data…`, true);
      // Reload dashboard data silently
      await this.loadData();
      this.updateDashboard();
      this.showNotification(`Emissions updated — ${data.records} records across ${data.years.length} year(s)`, 'success');
    } catch (err) {
      this._adminStatusEl('emissionsUploadStatus', `Error: ${err.message}`, false);
    }
  },

  async uploadLandfillsGeoJSON(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    this._adminStatusEl('landfillsUploadStatus', 'Uploading…', true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${this.state.BACKEND_URL}/api/admin/landfills/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.state.authToken}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) { this._adminStatusEl('landfillsUploadStatus', data.error || 'Upload failed', false); return; }
      this._adminStatusEl('landfillsUploadStatus', `Done — ${data.count} landfill features loaded. Refreshing…`, true);
      await this.loadData();
      this.updateDashboard();
      this.showNotification(`Landfills updated — ${data.count} features`, 'success');
    } catch (err) {
      this._adminStatusEl('landfillsUploadStatus', `Error: ${err.message}`, false);
    }
  },

  async loadAdminUsers() {
    const el = document.getElementById('adminUsersList');
    if (!el) return;
    el.textContent = 'Loading…';
    try {
      const r = await fetch(`${this.state.BACKEND_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${this.state.authToken}` },
      });
      const users = await r.json();
      if (!r.ok) { el.textContent = users.error || 'Failed to load users'; return; }
      el.innerHTML = users.map(u => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
          <div>
            <span style="font-weight:600;color:var(--t1)">${u.username}</span>
            <span style="font-size:9px;background:${u.role==='admin'?'rgba(249,115,22,0.15)':'rgba(0,212,255,0.1)'};color:${u.role==='admin'?'#f97316':'#00d4ff'};border-radius:99px;padding:1px 7px;margin-left:6px;font-weight:700">${u.role}</span>
          </div>
          ${u.username !== this.state.authUsername ? `<button onclick="app.deleteUser(${u.id},'${u.username}')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:10px">Remove</button>` : ''}
        </div>`).join('') || '<div style="color:var(--t3)">No users found</div>';
    } catch (err) {
      el.textContent = `Error: ${err.message}`;
    }
  },

  async createUser() {
    const username = document.getElementById('newUserName')?.value.trim();
    const password = document.getElementById('newUserPass')?.value;
    const role     = document.getElementById('newUserRole')?.value;
    const statusEl = 'userCreateStatus';
    if (!username || !password) { this._adminStatusEl(statusEl, 'Username and password are required', false); return; }
    try {
      const r = await fetch(`${this.state.BACKEND_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.state.authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await r.json();
      if (!r.ok) { this._adminStatusEl(statusEl, data.error || 'Failed to create user', false); return; }
      this._adminStatusEl(statusEl, `User "${username}" created as ${role}`, true);
      document.getElementById('newUserName').value = '';
      document.getElementById('newUserPass').value = '';
      this.loadAdminUsers();
    } catch (err) { this._adminStatusEl(statusEl, `Error: ${err.message}`, false); }
  },

  async deleteUser(uid, username) {
    if (!confirm(`Remove user "${username}"?`)) return;
    try {
      const r = await fetch(`${this.state.BACKEND_URL}/api/admin/users/${uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.state.authToken}` },
      });
      const data = await r.json();
      if (!r.ok) { this.showNotification(data.error || 'Failed to delete user', 'error'); return; }
      this.loadAdminUsers();
    } catch (err) { this.showNotification(`Error: ${err.message}`, 'error'); }
  },

  // Show notification  (type: 'error' | 'success' | 'info')
  showNotification(message, type = 'error') {
    const styles = {
      error:   { bg: '#ef4444',  color: '#ffffff' },
      success: { bg: '#00e5a0',  color: '#070c14' },
      info:    { bg: '#00d4ff',  color: '#070c14' },
    };
    const s = styles[type] || styles.error;
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${s.bg};
      color: ${s.color};
      padding: 12px 18px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      z-index: 10000;
      font-size: 13px;
      font-weight: 600;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), type === 'error' ? 4000 : 3000);
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
