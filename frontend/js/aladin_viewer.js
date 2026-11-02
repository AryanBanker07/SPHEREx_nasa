/**
 * CDS Aladin Lite v3 Multi-Mission Sky Survey Controller.
 * Overlays real archival sky surveys (AllWISE, 2MASS, DSS2) and Gaia DR3 astrometry.
 */

class AladinViewer {
  constructor(containerId) {
    this.containerId = containerId;
    this.aladin = null;
    this.isInitialized = false;
    this.currentSurvey = 'P/allWISE/color';
    this.gaiaCatalog = null;
  }

  async init(ra, dec, fovDeg = 0.14) {
    if (!window.A) return;
    try {
      if (window.A.init) {
        await window.A.init;
      }
      this.aladin = window.A.aladin(`#${this.containerId}`, {
        survey: this.currentSurvey,
        fov: fovDeg,
        target: `${ra} ${dec}`,
        showReticle: true,
        showLayersControl: true,
        showGotoControl: false,
        showFullscreenControl: false,
        cooFrame: 'ICRSd'
      });

      this.gaiaCatalog = window.A.catalogHiPS('https://axel.u-strasbg.fr/HiPSCatService/I/355/gaiadr3', {
        onClick: 'showTable',
        name: 'Gaia DR3 Astrometry',
        color: '#00e1ee'
      });
      this.aladin.addCatalog(this.gaiaCatalog);
      this.isInitialized = true;
    } catch (err) {
      console.warn('Aladin Lite initialization warning:', err);
    }
  }

  async goto(ra, dec, fovDeg = 0.14) {
    if (!this.isInitialized) {
      await this.init(ra, dec, fovDeg);
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
