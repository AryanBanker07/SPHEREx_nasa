/**
 * Export and Citizen Science Candidate Logging Suite.
 * Handles animated GIF export, discovery candidate reporting (CSV/JSON),
 * and shareable deep-link URL generation.
 */

class ExportTools {
  static exportBlinkGif(blinker, filename = 'spherex_blink.gif') {
    if (!blinker || !blinker.loadedImages.normal.length) {
      alert('No survey frames loaded to export.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = blinker.canvas.width;
    canvas.height = blinker.canvas.height;
    const ctx = canvas.getContext('2d');

    const encoder = new window.SimpleGifEncoder(canvas.width, canvas.height, Math.round(1000 / blinker.fps));

    // Render each epoch frame onto temporary canvas and add to GIF
    const imagesToUse = blinker.displayMode === 'inverted' 
      ? blinker.loadedImages.inverted 
      : blinker.loadedImages.normal;

    imagesToUse.forEach((img, i) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw Reticle & Epoch Label
      ctx.strokeStyle = blinker.displayMode === 'inverted' ? '#dc2626' : '#38bdf8';
      ctx.lineWidth = 1.5;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, 2 * Math.PI);
      ctx.stroke();

      // Timestamp overlay
      ctx.fillStyle = blinker.displayMode === 'inverted' ? '#000' : '#fff';
      ctx.font = '12px monospace';
      const label = blinker.epochs[i]?.label || `Survey ${i+1}`;
      ctx.fillText(label, 10, canvas.height - 12);

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
  }

  static generateShareLink(state) {
    const params = new URLSearchParams();
    if (state.ra) params.set('ra', state.ra.toFixed(6));
    if (state.dec) params.set('dec', state.dec.toFixed(6));
    if (state.fov) params.set('fov', state.fov);
    if (state.target) params.set('target', state.target);
    if (state.mode) params.set('mode', state.mode);

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    return shareUrl;
  }

  static exportCandidateCSV(candidates, targetName, ra, dec) {
    let csv = 'Candidate_ID,Target_Context,RA_deg,Dec_deg,Category,Proper_Motion_Arcsec_Yr,Displacement_Arcsec,Description\n';
    candidates.forEach(c => {
      const pm = c.proper_motion_rate || 'N/A';
      const disp = c.displacement_arcsec || 'N/A';
      const desc = (c.description || '').replace(/,/g, ';');
      csv += `"${c.id}","${targetName}",${ra},${dec},"${c.category}",${pm},${disp},"${desc}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spherex_candidates_${targetName.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

window.ExportTools = ExportTools;

