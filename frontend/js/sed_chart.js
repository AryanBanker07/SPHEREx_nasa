/**
 * Interactive 102-Band Spectrophotometric SED Chart Module.
 * Visualizes continuous near-infrared spectra across all 6 SPHEREx detector arrays,
 * annotating critical molecular ice and gas absorption bands.
 */

class SEDChart {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.chart = null;
    this.currentData = null;
  }

  renderSpectrum(spectrumData) {
    this.currentData = spectrumData;
    const points = spectrumData.spectral_points || [];

    const labels = points.map(p => p.wavelength_um.toFixed(2));
    const fluxes = points.map(p => p.flux_mjy_sr);

    if (this.chart) {
      this.chart.destroy();
    }

    // If Chart.js is loaded
    if (window.Chart) {
      this.chart = new Chart(this.ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Flux Density (MJy/sr)',
              data: fluxes,
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              borderWidth: 2,
              pointRadius: 1.5,
              pointHoverRadius: 5,
              tension: 0.2,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0e121a',
              titleColor: '#f1f5f9',
              bodyColor: '#38bdf8',
              borderColor: '#232c3d',
              borderWidth: 1,
              callbacks: {
                title: (items) => `Wavelength: ${items[0].label} µm`,
                label: (item) => {
                  const pt = points[item.dataIndex];
                  return [
                    `Flux: ${item.raw} MJy/sr`,
                    `Detector Array: ${pt.detector_array}`,
                    `Band Channel: #${pt.band_index} of 102`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Wavelength λ (µm)',
                color: '#94a3b8',
                font: { size: 10 }
              },
              ticks: {
                color: '#64748b',
                font: { size: 9 },
                maxTicksLimit: 8
              },
              grid: { color: 'rgba(35, 44, 61, 0.5)' }
            },
            y: {
              title: {
                display: true,
                text: 'Flux (MJy/sr)',
                color: '#94a3b8',
                font: { size: 10 }
              },
              ticks: {
                color: '#64748b',
                font: { size: 9 }
              },
              grid: { color: 'rgba(35, 44, 61, 0.5)' }
            }
          }
        }
      });
    } else {
      // High-performance Canvas fallback
      this._drawCanvasFallback(points);
    }

    this._updateMolecularPills(spectrumData);
  }

  _drawCanvasFallback(points) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    if (points.length === 0) return;

    const maxFlux = Math.max(...points.map(p => p.flux_mjy_sr), 1.0);
    const minW = points[0].wavelength_um;
    const maxW = points[points.length - 1].wavelength_um;

    this.ctx.beginPath();
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2;

    points.forEach((p, i) => {
      const x = ((p.wavelength_um - minW) / (maxW - minW)) * (width - 40) + 30;
      const y = height - 25 - (p.flux_mjy_sr / maxFlux) * (height - 45);
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    });

    this.ctx.stroke();

    // Axes
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(`${minW.toFixed(1)} µm`, 30, height - 8);
    this.ctx.fillText(`${maxW.toFixed(1)} µm`, width - 45, height - 8);
  }

  _updateMolecularPills(spectrumData) {
    const pillsContainer = document.getElementById('molecular-pills-container');
    if (!pillsContainer) return;

    pillsContainer.innerHTML = '';
    const markers = spectrumData.molecular_markers || [];

    markers.forEach(m => {
      const pill = document.createElement('div');
      const isIce = m.name.includes('Ice');
      pill.className = `mol-pill ${isIce ? 'ice' : 'gas'}`;
      pill.innerHTML = `<span>●</span> <strong>${m.name}</strong> (${m.center_um}µm)`;
      pill.title = m.species;
      pillsContainer.appendChild(pill);
    });
  }
}

window.SEDChart = SEDChart;

