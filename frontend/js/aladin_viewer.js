/**
 * CDS Aladin Lite v3 Sky Integration Module.
 * Provides multi-mission Virtual Observatory (VO) sky views (AllWISE, 2MASS, Gaia DR3).
 */

class AladinViewer {
  constructor(containerId) {
    this.containerId = containerId;
    this.aladin = null;
    this.isInitialized = false;
    this.currentSurvey = 'P/allWISE/color';
  }

  init(ra, dec, fovDeg = 0.15) {
    if (!window.A) {
      console.warn('Aladin Lite v3 script not loaded or offline.');
      return;
    }

    try {
      this.aladin = window.A.aladin(`#${this.containerId}`, {
        survey: this.currentSurvey,
        fov: fovDeg,
        target: `${ra} ${dec}`,
        showReticle: true,
        showLayersControl: true,
        showGotoControl: false,
        showFullscreenControl: false
      });

      // Overlay Gaia DR3 Catalog
      this.gaiaLayer = window.A.catalogHiPS('https://axel.u-strasbg.fr/HiPSCatService/I/355/gaiadr3', {
        onClick: 'showPopup',
        name: 'Gaia DR3 (Astrometry & Proper Motion)'
      });
      this.aladin.addCatalog(this.gaiaLayer);

      this.isInitialized = true;
    } catch (e) {
      console.error('Failed to initialize Aladin Lite v3:', e);
    }
  }

  goto(ra, dec, fovDeg = 0.15) {
    if (!this.isInitialized) {
      this.init(ra, dec, fovDeg);
      return;
    }
    if (this.aladin) {
      this.aladin.gotoRaDec(ra, dec);
      this.aladin.setFov(fovDeg);
    }
  }

  setSurvey(surveyId) {
    this.currentSurvey = surveyId;
    if (this.aladin) {
      this.aladin.setImageSurvey(surveyId);
    }
  }
}

window.AladinViewer = AladinViewer;

