/**
 * Interactive Element Picker - Inspired by uBlock Origin
 * Allows point-and-click element blocking on any webpage.
 */

(function() {
  'use strict';

  let isPicking = false;
  let hoveredElement = null;
  let selectedElement = null;
  let highlightBox = null;
  let dialogBox = null;
  let previewActive = false;

  const ElementPicker = {
    start() {
      if (isPicking) return;
      isPicking = true;
      previewActive = false;

      this.createHighlightBox();
      this.bindEvents();
      document.body.style.cursor = 'crosshair';
    },

    stop() {
      isPicking = false;
      document.body.style.cursor = '';
      this.unbindEvents();
      this.removeHighlightBox();
      this.removeDialog();
      this.clearPreview();
    },

    createHighlightBox() {
      if (highlightBox) return;
      highlightBox = document.createElement('div');
      highlightBox.id = 'ublock-picker-highlight';
      document.documentElement.appendChild(highlightBox);
    },

    removeHighlightBox() {
      if (highlightBox) {
        highlightBox.remove();
        highlightBox = null;
      }
    },

    bindEvents() {
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);

      window.addEventListener('mousemove', this.onMouseMove, true);
      window.addEventListener('click', this.onClick, true);
      window.addEventListener('keydown', this.onKeyDown, true);
    },

    unbindEvents() {
      window.removeEventListener('mousemove', this.onMouseMove, true);
      window.removeEventListener('click', this.onClick, true);
      window.removeEventListener('keydown', this.onKeyDown, true);
    },

    onMouseMove(e) {
      if (!isPicking || dialogBox) return;

      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target === highlightBox || (dialogBox && dialogBox.contains(target))) {
        return;
      }

      hoveredElement = target;
      this.updateHighlight(target);
    },

    updateHighlight(el) {
      if (!highlightBox || !el) return;
      const rect = el.getBoundingClientRect();
      highlightBox.style.top = `${rect.top}px`;
      highlightBox.style.left = `${rect.left}px`;
      highlightBox.style.width = `${rect.width}px`;
      highlightBox.style.height = `${rect.height}px`;
      highlightBox.style.display = 'block';
    },

    onClick(e) {
      if (!isPicking) return;

      if (dialogBox && dialogBox.contains(e.target)) {
        return; // Allow interacting with dialog
      }

      e.preventDefault();
      e.stopPropagation();

      if (!dialogBox && hoveredElement) {
        selectedElement = hoveredElement;
        this.openDialog(selectedElement);
      }
    },

    onKeyDown(e) {
      if (e.key === 'Escape') {
        this.stop();
      }
    },

    generateCandidateSelectors(el) {
      const candidates = [];
      const tag = el.tagName.toLowerCase();

      // 1. By ID
      if (el.id && !el.id.match(/\d{5,}/)) {
        candidates.push(`#${CSS.escape(el.id)}`);
      }

      // 2. By Classes
      if (el.classList && el.classList.length > 0) {
        const validClasses = Array.from(el.classList).filter(c => !c.match(/\d{5,}/) && c.length < 35);
        if (validClasses.length > 0) {
          candidates.push(validClasses.map(c => `.${CSS.escape(c)}`).join(''));
          candidates.push(`${tag}.${CSS.escape(validClasses[0])}`);
        }
      }

      // 3. By Data Attributes or ARIA
      const attrs = ['data-ad-unit', 'data-ad-client', 'aria-label', 'role'];
      for (const attr of attrs) {
        const val = el.getAttribute(attr);
        if (val) {
          candidates.push(`${tag}[${attr}="${val}"]`);
        }
      }

      // 4. By Tag name
      candidates.push(tag);

      // Filter unique
      return Array.from(new Set(candidates));
    },

    openDialog(el) {
      this.removeDialog();
      const domain = window.location.hostname;
      const candidates = this.generateCandidateSelectors(el);
      const initialSelector = candidates[0] || el.tagName.toLowerCase();

      dialogBox = document.createElement('div');
      dialogBox.id = 'ublock-picker-dialog';

      dialogBox.innerHTML = `
        <div class="ublock-picker-header">
          <div><span class="ublock-picker-badge">uBlock</span> Element Picker</div>
          <button class="ublock-picker-close-btn" id="ublock-picker-btn-close">&times;</button>
        </div>
        <div class="ublock-picker-body">
          <div class="ublock-picker-field-group">
            <span class="ublock-picker-label">Candidate Selectors:</span>
            <div class="ublock-picker-candidates" id="ublock-picker-candidates-list">
              ${candidates.map((c, i) => `
                <div class="ublock-picker-candidate-item ${i === 0 ? 'active' : ''}" data-sel="${c}">
                  ${c}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="ublock-picker-depth-controls">
            <button class="ublock-picker-depth-btn" id="ublock-depth-parent">▲ Parent Element</button>
            <button class="ublock-picker-depth-btn" id="ublock-depth-child">▼ Child Element</button>
          </div>

          <div class="ublock-picker-field-group">
            <span class="ublock-picker-label">Filter Rule:</span>
            <input type="text" class="ublock-picker-input" id="ublock-picker-rule-input" value="${domain}##${initialSelector}">
          </div>

          <div class="ublock-picker-actions">
            <button class="ublock-picker-btn ublock-picker-btn-preview" id="ublock-btn-preview">Preview</button>
            <button class="ublock-picker-btn ublock-picker-btn-create" id="ublock-btn-create">Create Filter</button>
          </div>
        </div>
      `;

      document.documentElement.appendChild(dialogBox);

      const input = dialogBox.querySelector('#ublock-picker-rule-input');
      const candidateItems = dialogBox.querySelectorAll('.ublock-picker-candidate-item');

      candidateItems.forEach(item => {
        item.addEventListener('click', () => {
          candidateItems.forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          const sel = item.getAttribute('data-sel');
          input.value = `${domain}##${sel}`;
          if (previewActive) this.applyPreview(sel);
        });
      });

      // Depth buttons
      dialogBox.querySelector('#ublock-depth-parent').addEventListener('click', () => {
        if (selectedElement.parentElement && selectedElement.parentElement !== document.body) {
          selectedElement = selectedElement.parentElement;
          this.updateHighlight(selectedElement);
          this.openDialog(selectedElement);
        }
      });

      dialogBox.querySelector('#ublock-depth-child').addEventListener('click', () => {
        if (selectedElement.firstElementChild) {
          selectedElement = selectedElement.firstElementChild;
          this.updateHighlight(selectedElement);
          this.openDialog(selectedElement);
        }
      });

      // Preview button
      const previewBtn = dialogBox.querySelector('#ublock-btn-preview');
      previewBtn.addEventListener('click', () => {
        previewActive = !previewActive;
        if (previewActive) {
          previewBtn.classList.add('active');
          previewBtn.textContent = 'Reset Preview';
          const rule = input.value;
          const selector = rule.includes('##') ? rule.split('##')[1] : rule;
          this.applyPreview(selector);
        } else {
          previewBtn.classList.remove('active');
          previewBtn.textContent = 'Preview';
          this.clearPreview();
        }
      });

      // Create Filter button
      dialogBox.querySelector('#ublock-btn-create').addEventListener('click', async () => {
        const rule = input.value.trim();
        if (rule) {
          await chrome.runtime.sendMessage({
            type: 'ADD_CUSTOM_FILTER',
            filter: rule
          });

          // Permanently hide the element on this page
          const selector = rule.includes('##') ? rule.split('##')[1] : rule;
          try {
            const matches = document.querySelectorAll(selector);
            matches.forEach(m => m.style.setProperty('display', 'none', 'important'));
          } catch (e) {}
        }
        this.stop();
      });

      // Close button
      dialogBox.querySelector('#ublock-picker-btn-close').addEventListener('click', () => {
        this.stop();
      });
    },

    removeDialog() {
      if (dialogBox) {
        dialogBox.remove();
        dialogBox = null;
      }
    },

    applyPreview(selector) {
      this.clearPreview();
      const style = document.createElement('style');
      style.id = 'ublock-element-picker-preview';
      style.textContent = `${selector} { display: none !important; }`;
      document.documentElement.appendChild(style);
    },

    clearPreview() {
      const existing = document.getElementById('ublock-element-picker-preview');
      if (existing) existing.remove();
    }
  };

  window.UBlockElementPicker = ElementPicker;
})();
