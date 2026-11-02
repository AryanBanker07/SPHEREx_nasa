/**
 * Universal Instructional Hover Tooltip HUD.
 * Provides instant, smart-clamped guidance when hovering over any icon,
 * toolbar control, badge, wavelength marker, or classification option.
 */

class ZooTooltipEngine {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'zoo-tooltip';
    this.el.setAttribute('role', 'tooltip');
    document.body.appendChild(this.el);

    this.activeTarget = null;
    this._bindDelegation();
  }

  _bindDelegation() {
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-tip-title], [data-tip-body]');
      if (!target) {
        this.hide();
        return;
      }
      if (target === this.activeTarget) return;
      this.activeTarget = target;
      this.show(target, e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.activeTarget) return;
      this._position(e.clientX, e.clientY, this.activeTarget);
    });

    document.addEventListener('mouseout', (e) => {
      if (!this.activeTarget) return;
      if (!this.activeTarget.contains(e.relatedTarget)) {
        this.hide();
      }
    });

    document.addEventListener('focusin', (e) => {
      const target = e.target.closest('[data-tip-title], [data-tip-body]');
      if (target) {
        const rect = target.getBoundingClientRect();
        this.activeTarget = target;
        this.show(target, rect.left + rect.width / 2, rect.bottom);
      }
    });

    document.addEventListener('focusout', () => this.hide());
    document.addEventListener('scroll', () => this.hide(), true);
  }

  show(target, clientX, clientY) {
    const title = target.getAttribute('data-tip-title') || '';
    const body = target.getAttribute('data-tip-body') || '';
    const key = target.getAttribute('data-tip-key') || '';

    let html = '';
    if (title || key) {
      html += `<div class="tip-head"><span>${title}</span>${key ? `<kbd class="tip-kbd">${key}</kbd>` : ''}</div>`;
    }
    if (body) {
      html += `<div class="tip-desc">${body}</div>`;
    }

    this.el.innerHTML = html;
    this.el.classList.add('visible');
    this._position(clientX, clientY, target);
  }

  _position(mouseX, mouseY, target) {
    const pad = 12;
    const rect = this.el.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();

    // Anchor cleanly beside vertical toolbar icons, or below/above regular controls
    let left = mouseX + 14;
    let top = mouseY + 16;

    if (target.classList.contains('tool-icon-btn')) {
      left = tRect.left - rect.width - 10;
      top = tRect.top + (tRect.height - rect.height) / 2;
    }

    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (left < pad) left = pad;

    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, tRect.top - rect.height - 10);
    }
    if (top < pad) top = pad;

    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
  }

  hide() {
    this.activeTarget = null;
    this.el.classList.remove('visible');
  }
}

window.ZooTooltipEngine = ZooTooltipEngine;
