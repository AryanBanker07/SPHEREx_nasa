/**
 * Interactive 102-Band SPHEREx Spectrophotometer (0.75 - 5.0 µm).
 * Renders the 6 LVF Detector Array zones (Arrays 1-6) and toggleable
 * molecular absorption lines (H2O Ice 3.05µm, CO2 4.27µm, CO 4.67µm, CH4).
 */

class SEDChart {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.chart = null;
    this.currentData = null;
    this.activeMarkers = new Set(['H2O Ice', 'CO2', 'CO', 'CH4']);
  }

  renderSpectrum(spectrumData) {
    this.currentData = spectrumData;
    const points = spectrumData.spectral_points || [];
    if (!points.length) return;

    const labels = points.map(p => p.wavelength_um.toFixed(2));
    const fluxes = points.map(p => p.flux_mjy_sr);
    const pointColors = points.map(p => this._arrayColor(p.detector_array));

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const self = this;
    const arrayZonePlugin = {
      id: 'spherexZonesAndLines',
      beforeDatasetsDraw(chart) {
        const { ctx, chartArea, scales: { x } } = chart;
        if (!chartArea) return;

        // Draw subtle 6 Detector Array background bands (17 channels each)
        const zoneColors = [
          'rgba(99, 102, 241, 0.07)',
          'rgba(56, 189, 248, 0.07)',
          'rgba(0, 151, 157, 0.09)',
          'rgba(16, 185, 129, 0.08)',
          'rgba(240, 178, 0, 0.08)',
          'rgba(255, 90, 95, 0.08)'
        ];

        for (let a = 0; a < 6; a++) {
          const startIdx = a * 17;
          const endIdx = Math.min((a + 1) * 17 - 1, points.length - 1);
          const x1 = x.getPixelForValue(startIdx);
          const x2 = x.getPixelForValue(endIdx);
          ctx.save();
          ctx.fillStyle = zoneColors[a];
          ctx.fillRect(x1, chartArea.top, x2 - x1, chartArea.bottom - chartArea.top);

          ctx.fillStyle = 'rgba(192, 200, 210, 0.45)';
          ctx.font = '600 9px "IBM Plex Mono", monospace';
          ctx.fillText(`A${a + 1}`, x1 + 3, chartArea.top + 10);
          ctx.restore();
        }
      },
      afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales: { x } } = chart;
        if (!chartArea) return;
        const markers = spectrumData.molecular_markers || [];
        markers.forEach(m => {
          const isShown = Array.from(self.activeMarkers).some(key => m.name.includes(key));
          if (!isShown) return;

          // Find closest wavelength index
          let bestIdx = 0;
          let bestDiff = 999;
          points.forEach((p, idx) => {
            const d = Math.abs(p.wavelength_um - m.center_um);
            if (d < bestDiff) { bestDiff = d; bestIdx = idx; }
          });

          const px = x.getPixelForValue(bestIdx);
          const isIce = m.name.includes('Ice');
          ctx.save();
          ctx.strokeStyle = isIce ? 'rgba(56, 189, 248, 0.72)' : 'rgba(240, 178, 0, 0.65)';
          ctx.lineWidth = 1.1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(px, chartArea.top + 14);
          ctx.lineTo(px, chartArea.bottom);
          ctx.stroke();
          ctx.restore();
        });
      }
    };

    if (window.Chart) {
      this.chart = new Chart(this.ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'SPHEREx Flux (MJy/sr)',
            data: fluxes,
            borderColor: '#00b4bf',
            backgroundColor: 'rgba(0, 151, 157, 0.16)',
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            borderWidth: 1.9,
            pointRadius: 2.1,
            pointHoverRadius: 5,
            tension: 0.22,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 260 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#101419',
              titleColor: '#ffffff',
              bodyColor: '#7ef3fa',
              borderColor: '#00b4bf',
              borderWidth: 1,
              titleFont: { family: 'IBM Plex Mono', size: 11 },
              bodyFont: { family: 'IBM Plex Mono', size: 11 },
              callbacks: {
                title: (items) => {
                  const pt = points[items[0].dataIndex];
                  return `λ = ${pt.wavelength_um.toFixed(3)} µm (Channel #${pt.band_index}/102)`;
                },
                label: (item) => {
                  const pt = points[item.dataIndex];
                  return [
                    `Flux: ${pt.flux_mjy_sr.toFixed(2)} ± ${pt.uncertainty.toFixed(2)} MJy/sr`,
                    `Detector: SPHEREx Array ${pt.detector_array} (${pt.detector_array === 5 ? 'R~135 High-Res' : 'R~41 LVF'})`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#8a94a2',
                font: { family: 'IBM Plex Mono', size: 9 },
                maxTicksLimit: 9,
                callback: function(val) {
                  return this.getLabelForValue(val) + 'µm';
                }
              },
              grid: { color: 'rgba(120, 135, 155, 0.12)' }
            },
            y: {
              title: {
                display: true,
                text: 'MJy/sr',
                color: '#8a94a2',
                font: { family: 'IBM Plex Mono', size: 9 }
              },
              ticks: {
                color: '#8a94a2',
                font: { family: 'IBM Plex Mono', size: 9 },
                maxTicksLimit: 5
              },
              grid: { color: 'rgba(120, 135, 155, 0.12)' }
            }
          }
        },
        plugins: [arrayZonePlugin]
      });
    } else {
      this._drawCanvasFallback(points);
    }

    this._renderMolecularChips(spectrumData);
  }

  _arrayColor(arr) {
    const map = {
      1: '#818cf8',
      2: '#38bdf8',
      3: '#00b4bf',
      4: '#34d399',
      5: '#f0b200',
      6: '#ff5a5f'
    };
    return map[arr] || '#00b4bf';
  }

  _drawCanvasFallback(points) {
    const w = this.canvas.width = this.canvas.parentElement.clientWidth || 360;
    const h = this.canvas.height = this.canvas.parentElement.clientHeight || 195;
    this.ctx.clearRect(0, 0, w, h);

    const maxF = Math.max(...points.map(p => p.flux_mjy_sr), 1);
    const minW = points[0].wavelength_um;
    const maxW = points[points.length - 1].wavelength_um;

    this.ctx.strokeStyle = '#00b4bf';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    points.forEach((p, idx) => {
      const x = 32 + ((p.wavelength_um - minW) / (maxW - minW)) * (w - 44);
      const y = h - 22 - (p.flux_mjy_sr / maxF) * (h - 36);
      if (idx === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    });
    this.ctx.stroke();
  }

  _renderMolecularChips(spectrumData) {
    const container = document.getElementById('molecular-pills-container');
    if (!container) return;
    container.innerHTML = '';

    const groups = [
      { key: 'CH4', label: 'CH₄ 1.67/3.3µm', isIce: false, desc: 'Methane absorption bands — signature of cool T & Y Brown Dwarfs like Epsilon Indi B & WISE 0855.' },
      { key: 'H2O Ice', label: 'H₂O Ice 3.05µm', isIce: true, desc: 'Solid water-ice absorption feature in Array 4 — reveals icy comets, Kuiper Belt objects & sub-freezing Y-dwarf clouds.' },
      { key: 'CO2', label: 'CO₂ 4.27µm (R~135)', isIce: true, desc: 'Carbon dioxide band resolved at high spectral resolution (R~135) by SPHEREx Array 5.' },
      { key: 'CO', label: 'CO 2.32/4.67µm', isIce: false, desc: 'Carbon monoxide overtone & fundamental bands — strong in M-dwarfs (Barnard\'s Star) and AGB Mira giants (R Draconis).' }
    ];

    groups.forEach(g => {
      const btn = document.createElement('button');
      const isOn = this.activeMarkers.has(g.key);
      btn.type = 'button';
      btn.className = `mol-chip ${g.isIce ? 'ice' : 'gas'} ${isOn ? 'active' : ''}`;
      btn.setAttribute('data-tip-title', `${g.label} Spectral Marker`);
      btn.setAttribute('data-tip-body', `Click to toggle vertical wavelength line on the 102-band plot. ${g.desc}`);
      btn.innerHTML = `<span>●</span> ${g.label}`;
      btn.addEventListener('click', () => {
        if (this.activeMarkers.has(g.key)) this.activeMarkers.delete(g.key);
        else this.activeMarkers.add(g.key);
        this.renderSpectrum(this.currentData);
      });
      container.appendChild(btn);
    });
  }
}

window.SEDChart = SEDChart;
