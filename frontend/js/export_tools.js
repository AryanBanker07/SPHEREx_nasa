/**
 * Citizen Science Export, Deep-Linking & Embed Tools.
 * Supports GIF89a animated flipbook export, CSV/JSON candidate export,
 * and URL query synchronization (?ra=...&dec=...&fov=...&array=...&mode=...).
 */

class ExportTools {
  static exportBlinkGif(blinker, filename = 'spherex_subject_blink.gif') {
    const frames = blinker.displayMode === 'inverted'
      ? blinker.loadedImages.inverted
      : (blinker.displayMode === 'rgb' ? blinker.loadedImages.rgb : blinker.loadedImages.normal);

    if (!frames || !frames.length) {
      return false;
    }

    const size = 320;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const ctx = tempCanvas.getContext('2d');

    const encoder = new window.SimpleGifEncoder(size, size, Math.round(1000 / blinker.fps));

    frames.forEach((img, idx) => {
      if (!img || !img.complete) return;
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);

      // Center target reticle
      ctx.strokeStyle = blinker.displayMode === 'inverted' ? '#c81e1e' : '#00b4bf';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Label bar
      ctx.fillStyle = 'rgba(12, 15, 20, 0.82)';
      ctx.fillRect(0, size - 24, size, 24);
      ctx.fillStyle = '#f2f5f7';
      ctx.font = '11px monospace';
      const label = blinker.epochs[idx]?.label || `Epoch ${idx + 1}`;
      ctx.fillText(label, 8, size - 8);

      encoder.addFrame(ctx);
    });

    const blob = encoder.renderBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return true;
  }

  static syncBrowserUrl(state) {
    const params = new URLSearchParams();
    params.set('ra', Number(state.ra).toFixed(5));
    params.set('dec', Number(state.dec).toFixed(5));
    params.set('fov', state.fov);
    params.set('array', state.arraySelection);
    params.set('mode', state.mode);
    if (state.target) params.set('target', state.target);

    const newRelative = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newRelative);
    return `${window.location.origin}${newRelative}`;
  }

  static exportDiscoveriesCSV(classifications, autoCandidates, currentState) {
    let csv = 'Record_Type,Target_Field,RA_deg,Dec_deg,Classification,Proper_Motion_Arcsec_Yr,Markers_Count,Timestamp_ISO,Notes\n';

    classifications.forEach(item => {
      const notes = (item.notes || '').replace(/"/g, '""');
      csv += `"VOLUNTEER_CLASSIFICATION","${item.target}",${item.ra},${item.dec},"${item.choice}","${item.pmRate || 'Measured'}",${item.markers.length},"${item.timestamp}","${notes}"\n`;
    });

    (autoCandidates || []).forEach(c => {
      const desc = (c.description || '').replace(/"/g, '""');
      csv += `"AUTO_DIPOLE_PIPELINE","${currentState.target}",${currentState.ra},${currentState.dec},"${c.category}","${c.proper_motion_rate || 0}",0,"${new Date().toISOString()}","${desc}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPHEREx_CitizenScience_${currentState.target.replace(/[^a-z0-9]/gi, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
}

window.ExportTools = ExportTools;
