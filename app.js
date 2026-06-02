// ============================================================
// LAGOS ENVIRONMENTAL RISK DASHBOARD
// Spatial Analysis Application
// ============================================================

const app = {
  // State
  state: {
    currentYear: '2025',
    currentMetric: 'ch4',
    currentBasemap: 'carto',
    currentLGA: '',
    opacity: 0.8,
    data: {
      lgas: null,
      emissionPoints: null,
      landfills: null,
      lgasBoundary: null,
    },
    selectedFeature: null,
    selectedLayer: null,
    rasterData: {},
    clickedPoint: null,
    geeMode: false,  // true when server.py is running
    GEE_SERVER: 'http://localhost:5001',
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
    geeBoundary: null,
    geeLGA: null,
    geeLagos: null,
    geeHotspots: null,
  },

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

  // Initialize application
  async init() {
    console.log('Initializing...');
    this.initChartDefaults();
    await this.initGEEMode();
    await this.loadData();
    this.initializeMap();
    this.attachEventListeners();
    this.updateDashboard();
  },

  // Load GeoJSON data
  async loadData() {
    try {
      const [lgasBoundaryResponse, lgasEmissionsResponse, landfillsResponse] = await Promise.all([
        fetch('data/lga_boundary.geojson'),
        fetch('data/lga_emissions.geojson'),
        fetch('data/landfills.geojson'),
      ]);

      this.state.data.lgasBoundary = await lgasBoundaryResponse.json();
      this.state.data.lgas = await lgasEmissionsResponse.json();
      const landfillsData = await landfillsResponse.json();
      this.state.data.emissionPoints = landfillsData;
      this.state.data.landfills = landfillsData;

      // Populate LGA selector
      this.populateLGASelector();
      console.log('Data loaded successfully');
    } catch (error) {
      console.error('Error loading data:', error);
      this.showNotification('Error loading GeoJSON data');
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

    // Add basemap
    this.addBasemap('carto');

    // Add data layers
    this.addLGALayer();
    this.addEmissionPointsLayer();
    this.addLandfillsLayer();

    // Add layer control
    this.map.on('click', () => {
      if (this.state.selectedLayer) {
        const prev = this.state.selectedLayer;
        const prevName = prev.feature?.properties?.lganame;
        const prevEmissions = this.state.data.lgas.features.find(f => f.properties.lganame === prevName);
        const prevVal = prevEmissions ? this.getMetricValue(prevEmissions, this.state.currentMetric, this.state.currentYear) : null;
        prev.setStyle({ weight:2, color:'white', fillOpacity:0.7, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
        this.state.selectedLayer = null;
      }
      this.state.selectedFeature = null;
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
    }).addTo(this.map);

    this.state.currentBasemap = type;
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

        return {
          fillColor: fillColor,
          weight: 2,
          opacity: 1,
          color: 'white',
          dashArray: '0',
          fillOpacity: 0.7,
        };
      },
      style: (feature) => {
        const isSelected = feature.properties?.lganame === this.state.selectedFeature?.properties?.lganame;
        return {
          fillOpacity: 0,           // no fill — raster handles visualization
          color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.5)',
          weight: isSelected ? 2.5 : 1,
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
          fillOpacity: 0.9,
          fillColor: baseColor
        };

        const defaultStyle = {
          weight: 2,
          color: 'white',
          fillOpacity: 0.7,
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
          layer.setStyle(defaultStyle);
          this.map.closePopup(popup);
        });

        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (this.state.selectedLayer) {
            const prev = this.state.selectedLayer;
            const prevName = prev.feature?.properties?.lganame;
            const prevEmissions = this.state.data.lgas.features.find(f => f.properties.lganame === prevName);
            const prevVal = prevEmissions ? this.getMetricValue(prevEmissions, this.state.currentMetric, this.state.currentYear) : null;
            prev.setStyle({ weight:2, color:'white', fillOpacity:0.7, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
          }
          layer.setStyle({ weight:3, color:'#00d4ff', fillOpacity:0.85,
            fillColor: this.getColorForValue(this.state.currentMetric,
              emissionsFeature ? this.getMetricValue(emissionsFeature, this.state.currentMetric, this.state.currentYear) : null),
            dashArray:'' });
          layer.bringToFront();
          this.state.selectedLayer  = layer;
          this.state.selectedFeature = emissionsFeature || feature;
          this.updateAnalyticsPanel();
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

  // Add emission points layer (Landfills)
  addEmissionPointsLayer() {
    if (this.layers.points) {
      this.map.removeLayer(this.layers.points);
    }

    this.layers.points = L.geoJSON(this.state.data.emissionPoints, {
      style: {
        fillColor: '#ef4444',
        weight: 2,
        opacity: 1,
        color: '#991b1b',
        fillOpacity: 0.6,
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.Name || 'Unknown Landfill';
        const popup = L.popup().setContent(`
          <div class="popup-content">
            <strong>${name}</strong><br/>
            <em>Landfill Site</em>
          </div>
        `);

        layer.bindPopup(popup);
        layer.on('mouseover', () => {
          layer.setStyle({
            weight: 3,
            fillOpacity: 0.8,
          });
          popup.openOn(this.map);
        });
        layer.on('mouseout', () => {
          layer.setStyle({
            weight: 2,
            fillOpacity: 0.6,
          });
          this.map.closePopup(popup);
        });
      },
    });
    
    if (document.getElementById('landfillsPoints').checked) {
      this.layers.points.addTo(this.map);
    }
  },

  // Add Hotspot layer
  addHotspotLayer() {
    if (this.layers.hotspots) {
      this.map.removeLayer(this.layers.hotspots);
    }

    const year = this.state.currentYear;
    
    this.layers.hotspots = L.geoJSON(this.state.data.emissionPoints, {
      filter: (feature) => {
        return feature.properties.year === year && feature.properties.hotspots > 0;
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

    if (document.getElementById('hotspotLayer')?.checked) {
      this.layers.hotspots.addTo(this.map);
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
      legendContent.appendChild(item);
    });
  },

  // Update analytics panel
  updateAnalyticsPanel() {
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
      // Use clicked pixel point if in raster mode, otherwise LGA centroid
      const refPoint = this.state.clickedPoint
        ? L.latLng(this.state.clickedPoint.lat, this.state.clickedPoint.lng)
        : (feature.geometry ? L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]) : null);
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



  // Update all charts
  updateCharts() {
    this.updateTrendChart();
    this.updateLGAComparisonChart();
    this.updateCompositionChart();
  },

  // Update trend line chart
  updateTrendChart() {
    const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
    const metric = this.state.currentMetric;
    const avgValues = [];

    years.forEach((year) => {
      const total = this.state.data.lgas.features.reduce((sum, feature) => {
        const value = this.getMetricValue(feature, metric, year);
        return sum + (value || 0);
      }, 0);
      const avg = total / this.state.data.lgas.features.length;
      avgValues.push(avg.toFixed(2));
    });

    const ctx = document.getElementById('trendChart');
    const metricLabelTrend = { ch4: 'CH₄', no2: 'NO₂', co: 'CO' }[metric] || metric.toUpperCase();
    if (this.charts.trend) {
      this.charts.trend.data.labels = years;
      this.charts.trend.data.datasets[0].data = avgValues;
      this.charts.trend.data.datasets[0].label = `Average ${metricLabelTrend}`;
      this.charts.trend.options.scales.y.title.text = metricLabelTrend;
      this.charts.trend.update();
    } else {
      this.charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: years,
          datasets: [
            {
              label: `Average ${metricLabelTrend}`,
              data: avgValues,
              borderColor: '#00d4ff',
              backgroundColor: 'rgba(0, 212, 255, 0.07)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointRadius: 6,
              pointBackgroundColor: '#00d4ff',
              pointBorderColor: '#070c14',
              pointBorderWidth: 2,
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
    const totals = {};

    metrics.forEach((metric) => {
      const total = this.state.data.lgas.features.reduce((sum, feature) => {
        const value = this.getMetricValue(feature, metric, year);
        return sum + (value || 0);
      }, 0);
      totals[metric] = total;
    });

    const ctx = document.getElementById('compositionChart');
    const compTitle = document.getElementById('comp-chart-title');
    if (compTitle) compTitle.textContent = `Gas Composition (${year})`;
    if (this.charts.composition) {
      this.charts.composition.data.datasets[0].data = [
        totals.ch4,
        totals.no2,
        totals.co,
      ];
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
              borderColor: '#0d1627',
              borderWidth: 2,
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
    this.updateCharts();
    this.updateKPIs();
    this.updateAnalyticsPanel();
    // Refresh SA panel if open
    if (document.getElementById('saPanel')?.classList.contains('open')) {
      const activeTab = document.querySelector('.sa-tab.active')?.dataset?.tab;
      if (activeTab) this.renderSATab(activeTab);
    }
  },

  // Attach event listeners
  attachEventListeners() {
    document.getElementById('yearSelect').addEventListener('change', async (e) => {
      this.state.currentYear = e.target.value;
      this.updateDashboard();
      if (document.getElementById('rasterLayer')?.checked)   await this.addRasterLayer();
      if (document.getElementById('geeHotspotsLayer')?.checked) await this.toggleGEEHotspotsLayer(true);
      if (document.getElementById('gasPanel')?.classList.contains('open')) {
        const activeGasTab = document.querySelector('[data-gas-tab].active')?.dataset?.gasTab;
        if (activeGasTab === 'correlation') this.renderGasCorrelation();
      }
    });

    document.getElementById('metricSelect').addEventListener('change', async (e) => {
      this.state.currentMetric = e.target.value;
      this.updateDashboard();
      if (document.getElementById('rasterLayer')?.checked)   await this.addRasterLayer();
      if (document.getElementById('geeHotspotsLayer')?.checked) await this.toggleGEEHotspotsLayer(true);
    });

    document.getElementById('basemapSelect').addEventListener('change', (e) => {
      this.addBasemap(e.target.value);
    });

    document.getElementById('lgaBoundaries').addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!this.map.hasLayer(this.layers.lgas)) {
          this.map.addLayer(this.layers.lgas);
        }
      } else {
        if (this.map.hasLayer(this.layers.lgas)) {
          this.map.removeLayer(this.layers.lgas);
        }
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

    document.getElementById('rasterLayer')?.addEventListener('change', async (e) => {
      if (e.target.checked) {
        await this.addRasterLayer();
        // Update legend subtitle to show pixel-level note
        const legendSub = document.getElementById('legendSub');
        if (legendSub) legendSub.textContent = 'Pixel-level · Sentinel-5P';
      } else if (this.layers.raster) {
        this.map.removeLayer(this.layers.raster);
        this.layers.raster = null;
        if (this._rasterClickHandler) this.map.off('click', this._rasterClickHandler);
        const legendSub = document.getElementById('legendSub');
        if (legendSub) legendSub.textContent = 'LGA-level · Sentinel-5P';
      }
    });

    document.getElementById('geeHotspotsLayer')?.addEventListener('change', async (e) => {
      await this.toggleGEEHotspotsLayer(e.target.checked);
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

    document.getElementById('lgaSelect').addEventListener('change', (e) => {
      if (e.target.value) {
        const feature = this.state.data.lgas.features.find(f => f.properties.lganame === e.target.value);
        if (feature) {
          if (this.state.selectedLayer) {
            const prev = this.state.selectedLayer;
            const prevName = prev.feature?.properties?.lganame;
            const prevEmissions = this.state.data.lgas.features.find(f => f.properties.lganame === prevName);
            const prevVal = prevEmissions ? this.getMetricValue(prevEmissions, this.state.currentMetric, this.state.currentYear) : null;
            prev.setStyle({ weight:2, color:'white', fillOpacity:0.7, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
          }
          if (this.layers.lgas) {
            this.layers.lgas.eachLayer(l => {
              if (l.feature?.properties?.lganame === e.target.value) {
                const val = this.getMetricValue(feature, this.state.currentMetric, this.state.currentYear);
                l.setStyle({ weight:3, color:'#00d4ff', fillOpacity:0.85, fillColor: this.getColorForValue(this.state.currentMetric, val), dashArray:'' });
                l.bringToFront();
                this.state.selectedLayer = l;
                const boundary = this.state.data.lgasBoundary?.features?.find(f => f.properties.lganame === e.target.value);
                if (boundary) this.map.fitBounds(L.geoJSON(boundary).getBounds(), { padding:[40,40] });
              }
            });
          }
          this.state.selectedFeature = feature;
          this.updateAnalyticsPanel();
          // Refresh SA panel if open
          const saPanel = document.getElementById('saPanel');
          if (saPanel?.classList.contains('open')) {
            const activeTab = document.querySelector('.sa-tab.active')?.dataset?.tab;
            if (activeTab) this.renderSATab(activeTab);
          }
        }
      }
    });

    document.querySelectorAll('.chart-download, .dl-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.generateReport());
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        if      (item.dataset.section === 'reports')  { this.generateReport(); }
        else if (item.dataset.section === 'analysis') { this.closeLandfills(); this.closeSpatialAnalysis(); this.openSpatialAnalysis(); }
        else if (item.dataset.section === 'about')      { this.closeSpatialAnalysis(); this.closeLandfills(); this.openAbout(); }
        else if (item.dataset.section === 'dumpsites')  { this.closeSpatialAnalysis(); this.closeGas(); this.openLandfills(); }
        else if (item.dataset.section === 'gas')        { this.closeSpatialAnalysis(); this.closeLandfills(); this.openGas(); }
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
  selectLGAByName(lgaName) {
    const feature = this.state.data.lgas.features.find(f => f.properties.lganame === lgaName);
    if (!feature) return;
    if (this.state.selectedLayer) {
      const prev = this.state.selectedLayer;
      const prevName = prev.feature?.properties?.lganame;
      const prevEmissions = this.state.data.lgas.features.find(f => f.properties.lganame === prevName);
      const prevVal = prevEmissions ? this.getMetricValue(prevEmissions, this.state.currentMetric, this.state.currentYear) : null;
      prev.setStyle({ weight:2, color:'white', fillOpacity:0.7, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
    }
    if (this.layers.lgas) {
      this.layers.lgas.eachLayer(l => {
        if (l.feature?.properties?.lganame === lgaName) {
          const val = this.getMetricValue(feature, this.state.currentMetric, this.state.currentYear);
          l.setStyle({ weight:3, color:'#00d4ff', fillOpacity:0.85, fillColor: this.getColorForValue(this.state.currentMetric, val), dashArray:'' });
          l.bringToFront();
          this.state.selectedLayer = l;
          const boundary = this.state.data.lgasBoundary?.features?.find(f => f.properties.lganame === lgaName);
          if (boundary) this.map.fitBounds(L.geoJSON(boundary).getBounds(), { padding:[40,40] });
        }
      });
    }
    this.state.selectedFeature = feature;
    this.updateAnalyticsPanel();
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
    const years   = ['2018','2019','2020','2021','2022','2023','2024','2025'];
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
      const v2025 = datasets.find(d => d.label === m.label).data[7];
      const v2018 = datasets.find(d => d.label === m.label).data[0];
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

    // Build scatter data: x=CH4, y=CO, label=LGA name
    const points = feats.map(f => ({
      x:    this.getMetricValue(f, 'ch4', year) || 0,
      y:    this.getMetricValue(f, 'co',  year) || 0,
      no2:  this.getMetricValue(f, 'no2', year) || 0,
      isi:  f.properties[`isi_${year}`] || 0,
      name: f.properties.lganame,
    })).filter(p => p.x > 0 && p.y > 0);

    // Compute mean + stddev for outlier detection
    const meanX = points.reduce((s,p) => s+p.x, 0) / points.length;
    const meanY = points.reduce((s,p) => s+p.y, 0) / points.length;
    const stdX  = Math.sqrt(points.reduce((s,p) => s+Math.pow(p.x-meanX,2),0)/points.length);
    const stdY  = Math.sqrt(points.reduce((s,p) => s+Math.pow(p.y-meanY,2),0)/points.length);

    // Colour: outliers red, selected cyan, normal accent
    const selectedName = this.state.selectedFeature?.properties?.lganame || '';
    const ptColor = (p) => {
      if (p.name === selectedName) return '#00d4ff';
      const zx = Math.abs((p.x - meanX) / stdX);
      const zy = Math.abs((p.y - meanY) / stdY);
      if (zx > 1.5 || zy > 1.5) return '#ff4d6a';
      return 'rgba(0,212,255,0.5)';
    };

    const ctx = document.getElementById('gasCorrelationChart');
    if (!ctx) return;
    if (this.charts.gasCorrelation) { this.charts.gasCorrelation.destroy(); }

    this.charts.gasCorrelation = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: `CH₄ vs CO (${year})`,
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
              label: ctx => {
                const p = ctx.raw;
                return [`${p.name}`, `CH₄: ${p.x.toFixed(5)}`, `CO: ${p.y.toFixed(5)}`];
              }
            }
          }
        },
        scales: {
          x: { title:{ display:true, text:'CH₄ (mol/m²)', color:'#7a8fa8', font:{size:10} },
               ticks:{ color:'#7a8fa8', font:{size:9} }, grid:{ color:'rgba(255,255,255,0.04)' } },
          y: { title:{ display:true, text:'CO (mol/m²)',  color:'#7a8fa8', font:{size:10} },
               ticks:{ color:'#7a8fa8', font:{size:9} }, grid:{ color:'rgba(255,255,255,0.04)' } }
        },
        onClick: (e, els) => {
          if (els.length) {
            const p = points[els[0].index];
            this.selectLGAByName(p.name);
          }
        }
      }
    });

    // Table: sorted by distance from mean (outliers first)
    const sorted = [...points].sort((a,b) => {
      const da = Math.sqrt(Math.pow((a.x-meanX)/stdX,2)+Math.pow((a.y-meanY)/stdY,2));
      const db = Math.sqrt(Math.pow((b.x-meanX)/stdX,2)+Math.pow((b.y-meanY)/stdY,2));
      return db - da;
    });
    const tbody = document.getElementById('correlationBody');
    if (tbody) {
      tbody.innerHTML = sorted.map(p => {
        const isOut = Math.abs((p.x-meanX)/stdX)>1.5 || Math.abs((p.y-meanY)/stdY)>1.5;
        const isSel = p.name === selectedName;
        const risk  = this.getEriClassification(p.isi);
        return `<tr onclick="app.selectLGAByName('${p.name}')" style="${isSel?'border-left:2px solid #00d4ff':''}">
          <td class="lga-name-cell" style="${isSel?'color:#00d4ff':isOut?'color:#ff4d6a':''}">${p.name}${isOut?' <span style="font-size:9px;color:#ff4d6a">anomaly</span>':''}</td>
          <td style="color:#3b82f6;font-size:10px;font-weight:600">${p.x.toFixed(5)}</td>
          <td style="color:#f59e0b;font-size:10px;font-weight:600">${p.y.toFixed(5)}</td>
          <td style="color:#10b981;font-size:10px;font-weight:600">${p.no2.toFixed(5)}</td>
          <td><span class="sa-badge ${risk.css}" style="font-size:8px">${risk.label}</span></td>
        </tr>`;
      }).join('');
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
        this.state.geeMode = true;
        console.log('✅ GEE server detected — using live tiles');
        const indicator = document.getElementById('gee-indicator');
        if (indicator) indicator.style.display = 'flex';
        const badge = document.getElementById('gee-layer-badge');
        if (badge) badge.style.display = 'inline';
        // Load LGA data from GEE
        await this.loadDataFromGEE();
      }
    } catch(e) {
      this.state.geeMode = false;
      console.log('ℹ️ GEE server not running — using local rasters');
    }
  },

  async getGEETileURL(metric, year) {
    const resp = await fetch(`${this.state.GEE_SERVER}/tiles/${metric}/${year}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data.url;
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
    const years = ['2018','2019','2020','2021','2022','2023','2024','2025'];
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
    if (!this.state.geeMode) return;
    if (!on) {
      if (this.layers.geeLGA) { this.map.removeLayer(this.layers.geeLGA); this.layers.geeLGA = null; }
      return;
    }
    if (this.layers.geeLGA) { this.layers.geeLGA.addTo(this.map); return; }
    const layer = await this.fetchGEETileLayer('lga-boundary-tiles');
    if (layer) {
      this.layers.geeLGA = layer;
      this.layers.geeLGA.addTo(this.map);
      if (this.layers.lgas)   this.layers.lgas.bringToFront();
      if (this.layers.points) this.layers.points.bringToFront();
    }
  },

  async toggleGEELagosLayer(on) {
    if (!this.state.geeMode) return;
    if (!on) {
      if (this.layers.geeLagos) { this.map.removeLayer(this.layers.geeLagos); this.layers.geeLagos = null; }
      return;
    }
    if (this.layers.geeLagos) { this.layers.geeLagos.addTo(this.map); return; }
    const layer = await this.fetchGEETileLayer('lagos-boundary-tiles');
    if (layer) {
      this.layers.geeLagos = layer;
      this.layers.geeLagos.addTo(this.map);
      if (this.layers.lgas)   this.layers.lgas.bringToFront();
      if (this.layers.points) this.layers.points.bringToFront();
    }
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
    const year   = this.state.currentYear;
    const metric = this.state.currentMetric;
    const georaster = await this.loadRaster(year);
    if (!georaster) return;

    const bandIdx = this.BAND_INDEX[metric] ?? 0;

    // Colour scales per metric
    const scales = {
      ch4: { min: 1750, max: 2100, colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
      no2: { min: 0,     max: 0.00020, colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
      co:  { min: 0.02,  max: 0.08,   colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
      isi: { min: 0.2,   max: 0.7,    colors: ['#16a34a','#84cc16','#facc15','#f97316','#dc2626'] },
    };
    const scale = scales[metric] || scales.ch4;

    // Interpolate colour
    const getColor = (val) => {
      if (val === null || isNaN(val)) return null;
      // CH4 convert ppb → mol/m² for display consistency
      const v = metric === 'ch4' ? val * this.CH4_PPB_TO_MOL * 1e6 : val;
      const t = Math.max(0, Math.min(1, (val - scale.min) / (scale.max - scale.min)));
      const stops = scale.colors;
      const idx   = t * (stops.length - 1);
      const lo    = Math.floor(idx), hi = Math.ceil(idx);
      const f     = idx - lo;
      const hexToRgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
      const c1 = hexToRgb(stops[lo]), c2 = hexToRgb(stops[hi] || stops[lo]);
      const r = Math.round(c1[0] + (c2[0]-c1[0])*f);
      const g = Math.round(c1[1] + (c2[1]-c1[1])*f);
      const b = Math.round(c1[2] + (c2[2]-c1[2])*f);
      return `rgba(${r},${g},${b},0.7)`;
    };

    if (this.state.geeMode) {
      // ── GEE live tiles ──────────────────────────────────
      const tileURL = await this.getGEETileURL(metric, year);
      this.layers.raster = L.tileLayer(tileURL, {
        opacity: 0.75,
        attribution: 'Google Earth Engine · Sentinel-5P'
      });
      if (document.getElementById('rasterLayer')?.checked) {
        this.layers.raster.addTo(this.map);
        if (this.layers.lgas)   this.layers.lgas.bringToFront();
        if (this.layers.points) this.layers.points.bringToFront();
      }
      this.setupGEEClickHandler();
    } else {
      // ── Local GeoTIFF fallback ──────────────────────────
      this.layers.raster = new GeoRasterLayer({
        georaster,
        opacity: 0.75,
        band: bandIdx,
        pixelValuesToColorFn: (values) => {
          const val = values[bandIdx];
          if (val === null || isNaN(val) || val <= 0) return null;
          return getColor(val);
        },
        resolution: 256,
      });
      if (document.getElementById('rasterLayer')?.checked) {
        this.layers.raster.addTo(this.map);
        if (this.layers.lgas)   this.layers.lgas.bringToFront();
        if (this.layers.points) this.layers.points.bringToFront();
      }
      this.setupRasterClickHandler(georaster);
    }
  },


  setupGEEClickHandler() {
    if (this._geeClickHandler) this.map.off('click', this._geeClickHandler);
    this._geeClickHandler = async (e) => {
      if (!document.getElementById('rasterLayer')?.checked) return;
      const { lat, lng } = e.latlng;
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

        this.state.clickedPoint = { ...vals, lgaName };
        this.updateRasterInspector({ ...vals, lgaName });

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

    if (this.charts.trend) {
      this.charts.trend.data.labels = years;
      this.charts.trend.data.datasets[0].data  = vals;
      this.charts.trend.data.datasets[0].label = `${label} at clicked point`;
      this.charts.trend.update();
    }

    const yr = this.state.currentYear;
    if (trend[yr] && this.charts.composition) {
      const t = trend[yr];
      this.charts.composition.data.datasets[0].data = [t.ch4||0, t.no2||0, t.co||0];
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
      const { lat, lng } = e.latlng;

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
    if (trendEl) trendEl.textContent = pt.hot > 0.5 ? '🔴 Hotspot' : '✅ Normal';
  },

  async updateChartsForPoint(lat, lng, currentGeoraster) {
    const years  = ['2018','2019','2020','2021','2022','2023','2024','2025'];
    const metric = this.state.currentMetric;
    const bandIdx = this.BAND_INDEX[metric] ?? 0;
    const ch4Band = 0;
    const no2Band = 1;
    const coBand  = 2;

    const pointVals = { ch4: [], no2: [], co: [] };

    for (const year of years) {
      const gr = await this.loadRaster(year);
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
    if (this.charts.trend) {
      this.charts.trend.data.labels = years;
      this.charts.trend.data.datasets[0].data   = metricVals;
      this.charts.trend.data.datasets[0].label  = `${metricLabel} at clicked point`;
      this.charts.trend.options.scales.y.title.text = 'mol/m²';
      this.charts.trend.update();
    }

    // Update composition donut with point values for current year
    const yr = parseInt(this.state.currentYear) - 2018;
    const c4 = pointVals.ch4[yr] || 0;
    const n2 = pointVals.no2[yr] || 0;
    const cc = pointVals.co[yr]  || 0;
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
      return '<div class="lf-card">' +
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
  },

  async generateReport() {
    const feature = this.state.selectedFeature;
    const year    = this.state.currentYear;
    const date    = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    if (!feature) { alert('Please click on an LGA on the map first to generate its report.'); return; }
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
    const years = ['2018','2019','2020','2021','2022','2023','2024','2025'];
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
      // Wait for tiles to settle
      await new Promise(r => setTimeout(r, 700));
      mapImg = await new Promise((resolve) => {
        const mapEl   = this.map.getContainer();
        const mapRect = mapEl.getBoundingClientRect();
        const W = mapEl.offsetWidth, H = mapEl.offsetHeight;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        const drawBoundaryAndExport = () => {
          // Draw LGA boundary polygon explicitly on top in cyan
          try {
            if (lgaBoundaryFeat2 && lgaBoundaryFeat2.geometry) {
              ctx.save();
              ctx.strokeStyle = '#00d4ff';
              ctx.lineWidth   = 3;
              ctx.shadowColor = '#00d4ff';
              ctx.shadowBlur  = 10;
              ctx.fillStyle   = 'rgba(0,212,255,0.10)';
              const geom   = lgaBoundaryFeat2.geometry;
              const polys  = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
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
          } catch(e2) {}
          resolve(canvas.toDataURL('image/png'));
        };

        // Draw all visible tile images
        const tiles = mapEl.querySelectorAll('img.leaflet-tile');
        let loaded = 0, total = tiles.length;
        if (total === 0) { drawBoundaryAndExport(); return; }
        tiles.forEach(tile => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const r = tile.getBoundingClientRect();
            ctx.drawImage(img, r.left - mapRect.left, r.top - mapRect.top, r.width, r.height);
            if (++loaded === total) drawBoundaryAndExport();
          };
          img.onerror = () => { if (++loaded === total) drawBoundaryAndExport(); };
          img.src = tile.src;
        });
        // Safety timeout
        setTimeout(() => { if (loaded < total) drawBoundaryAndExport(); }, 4000);
      });
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

  // Search for location
  searchLocation() {
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
        prev.setStyle({ weight:2, color:'white', fillOpacity:0.7, fillColor: this.getColorForValue(this.state.currentMetric, prevVal) });
      }
      if (this.layers.lgas) {
        this.layers.lgas.eachLayer(l => {
          if (l.feature?.properties?.lganame === lgaFeature.properties.lganame) {
            const val = emissionsFeature ? this.getMetricValue(emissionsFeature, this.state.currentMetric, this.state.currentYear) : null;
            l.setStyle({ weight:3, color:'#00d4ff', fillOpacity:0.85, fillColor: this.getColorForValue(this.state.currentMetric, val), dashArray:'' });
            l.bringToFront();
            this.state.selectedLayer = l;
          }
        });
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

  // Show notification
  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-size: 14px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 4000);
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});