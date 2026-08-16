/**
 * Full Page Screenshot Pro - Popup Controller
 */

import {
  MESSAGE_ACTIONS,
  CAPTURE_MODES,
  IMAGE_FORMATS,
  VIEWPORT_PRESETS,
  PROGRESS_STEPS,
  PROGRESS_TEXT_FA,
  DEFAULT_SETTINGS,
} from '../shared/constants.js';

// DOM Element References
const alertBox = document.getElementById('alertBox');
const alertText = document.getElementById('alertText');
const tabDomain = document.getElementById('tabDomain');

const modeFullBtn = document.getElementById('modeFullBtn');
const modeVisibleBtn = document.getElementById('modeVisibleBtn');

const formatPngBtn = document.getElementById('formatPngBtn');
const formatJpegBtn = document.getElementById('formatJpegBtn');
const qualityWrapper = document.getElementById('qualityWrapper');
const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');

const viewportChips = document.querySelectorAll('.chip');
const customWidthRow = document.getElementById('customWidthRow');
const customWidthInput = document.getElementById('customWidthInput');

const preloadLazyToggle = document.getElementById('preloadLazyToggle');

const btnCapture = document.getElementById('btnCapture');
const btnCaptureText = document.getElementById('btnCaptureText');

const statusBox = document.getElementById('statusBox');
const statusSpinner = document.getElementById('statusSpinner');
const statusLabel = document.getElementById('statusLabel');
const progressBarFill = document.getElementById('progressBarFill');
const statusDetail = document.getElementById('statusDetail');

// Current App State
let state = {
  ...DEFAULT_SETTINGS,
  isCapturing: false,
  tabAllowed: true,
};

// Progress percentage map
const PROGRESS_PERCENT = {
  [PROGRESS_STEPS.IDLE]: 0,
  [PROGRESS_STEPS.CHECKING]: 10,
  [PROGRESS_STEPS.ATTACHING]: 25,
  [PROGRESS_STEPS.PRELOADING]: 45,
  [PROGRESS_STEPS.MEASURING]: 60,
  [PROGRESS_STEPS.EMULATING]: 75,
  [PROGRESS_STEPS.CAPTURING]: 88,
  [PROGRESS_STEPS.DOWNLOADING]: 95,
  [PROGRESS_STEPS.DONE]: 100,
  [PROGRESS_STEPS.ERROR]: 100,
};

/**
 * Initialize popup
 */
async function init() {
  await loadSavedSettings();
  await checkActiveTab();
  setupEventListeners();
  updateUI();
}

/**
 * Load user settings from chrome.storage.local
 */
async function loadSavedSettings() {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get('userSettings');
      if (data && data.userSettings) {
        state = { ...state, ...data.userSettings };
      }
    }
  } catch (e) {
    console.warn('Could not load storage settings:', e);
  }
}

/**
 * Save user settings to chrome.storage.local
 */
function saveSettings() {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      const { mode, format, quality, viewport, customWidth, preloadLazy } = state;
      chrome.storage.local.set({
        userSettings: { mode, format, quality, viewport, customWidth, preloadLazy }
      });
    }
  } catch (e) {
    console.warn('Could not save settings:', e);
  }
}

/**
 * Query current tab info and validate restrictions
 */
async function checkActiveTab() {
  try {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: MESSAGE_ACTIONS.GET_CURRENT_TAB_INFO }, (response) => {
        if (!response) return;

        if (response.url) {
          try {
            const urlObj = new URL(response.url);
            tabDomain.textContent = urlObj.hostname || response.url;
          } catch {
            tabDomain.textContent = response.url;
          }
        }

        if (!response.allowed) {
          state.tabAllowed = false;
          showAlert(response.reason || 'امکان گرفتن اسکرین‌شات از این صفحه وجود ندارد.');
          btnCapture.disabled = true;
        } else {
          state.tabAllowed = true;
          hideAlert();
          btnCapture.disabled = false;
        }
      });
    }
  } catch (err) {
    console.warn('Tab info check error:', err);
  }
}

/**
 * Show warning or error alert
 */
function showAlert(message) {
  alertText.textContent = message;
  alertBox.classList.remove('hidden');
}

/**
 * Hide alert box
 */
function hideAlert() {
  alertBox.classList.add('hidden');
}

/**
 * Setup DOM event listeners
 */
function setupEventListeners() {
  // Mode selection
  modeFullBtn.addEventListener('click', () => {
    state.mode = CAPTURE_MODES.FULL_PAGE;
    saveSettings();
    updateUI();
  });

  modeVisibleBtn.addEventListener('click', () => {
    state.mode = CAPTURE_MODES.VISIBLE_AREA;
    saveSettings();
    updateUI();
  });

  // Format selection
  formatPngBtn.addEventListener('click', () => {
    state.format = IMAGE_FORMATS.PNG;
    saveSettings();
    updateUI();
  });

  formatJpegBtn.addEventListener('click', () => {
    state.format = IMAGE_FORMATS.JPEG;
    saveSettings();
    updateUI();
  });

  // Quality slider
  qualitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.quality = val;
    qualityValue.textContent = `${val}%`;
  });

  qualitySlider.addEventListener('change', () => {
    saveSettings();
  });

  // Viewport chips
  viewportChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.viewport = chip.getAttribute('data-vp');
      saveSettings();
      updateUI();
    });
  });

  // Custom width input
  customWidthInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 320) {
      state.customWidth = val;
      saveSettings();
    }
  });

  // Lazy load switch
  preloadLazyToggle.addEventListener('change', (e) => {
    state.preloadLazy = e.target.checked;
    saveSettings();
  });

  // Main capture action
  btnCapture.addEventListener('click', handleStartCapture);

  // Background runtime progress listener
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === MESSAGE_ACTIONS.CAPTURE_PROGRESS) {
        updateProgress(message.step, message.details);
      }
    });
  }
}

/**
 * Update UI according to state
 */
function updateUI() {
  // 1. Mode Cards
  if (state.mode === CAPTURE_MODES.FULL_PAGE) {
    modeFullBtn.classList.add('active');
    modeVisibleBtn.classList.remove('active');
    btnCaptureText.textContent = 'گرفتن اسکرین‌شات کامل';
  } else {
    modeFullBtn.classList.remove('active');
    modeVisibleBtn.classList.add('active');
    btnCaptureText.textContent = 'گرفتن اسکرین‌شات بخش قابل مشاهده';
  }

  // 2. Format Pills & Quality
  if (state.format === IMAGE_FORMATS.PNG) {
    formatPngBtn.classList.add('active');
    formatJpegBtn.classList.remove('active');
    qualityWrapper.classList.add('hidden');
  } else {
    formatPngBtn.classList.remove('active');
    formatJpegBtn.classList.add('active');
    qualityWrapper.classList.remove('hidden');
    qualitySlider.value = state.quality;
    qualityValue.textContent = `${state.quality}%`;
  }

  // 3. Viewport Chips
  viewportChips.forEach((chip) => {
    if (chip.getAttribute('data-vp') === state.viewport) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  if (state.viewport === VIEWPORT_PRESETS.CUSTOM) {
    customWidthRow.classList.remove('hidden');
    customWidthInput.value = state.customWidth;
  } else {
    customWidthRow.classList.add('hidden');
  }

  // 4. Lazy Load
  preloadLazyToggle.checked = state.preloadLazy;
}

/**
 * Update progress bar and status messages
 */
function updateProgress(step, details = '') {
  statusBox.classList.remove('hidden');
  
  const label = PROGRESS_TEXT_FA[step] || step;
  statusLabel.textContent = label;
  
  const percent = PROGRESS_PERCENT[step] || 50;
  progressBarFill.style.width = `${percent}%`;

  if (details) {
    statusDetail.textContent = details;
  } else {
    statusDetail.textContent = '';
  }

  if (step === PROGRESS_STEPS.DONE) {
    statusSpinner.style.display = 'none';
    progressBarFill.style.background = '#10b981';
    statusLabel.style.color = '#10b981';
    btnCapture.disabled = false;
    btnCapture.style.opacity = '1';
  } else if (step === PROGRESS_STEPS.ERROR) {
    statusSpinner.style.display = 'none';
    progressBarFill.style.background = '#ef4444';
    statusLabel.style.color = '#ef4444';
    btnCapture.disabled = false;
    btnCapture.style.opacity = '1';
  } else {
    statusSpinner.style.display = 'block';
    progressBarFill.style.background = 'linear-gradient(90deg, #38bdf8, #0284c7)';
    statusLabel.style.color = 'var(--accent)';
  }
}

/**
 * Trigger screenshot capture via background service worker
 */
async function handleStartCapture() {
  if (state.isCapturing || !state.tabAllowed) return;

  state.isCapturing = true;
  btnCapture.disabled = true;
  btnCapture.style.opacity = '0.6';
  hideAlert();
  updateProgress(PROGRESS_STEPS.CHECKING);

  try {
    const options = {
      mode: state.mode,
      format: state.format,
      quality: state.quality,
      viewport: state.viewport,
      customWidth: state.customWidth,
      preloadLazy: state.preloadLazy,
    };

    chrome.runtime.sendMessage(
      {
        action: MESSAGE_ACTIONS.CAPTURE_SCREENSHOT,
        options,
      },
      (response) => {
        state.isCapturing = false;
        btnCapture.disabled = false;
        btnCapture.style.opacity = '1';

        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message || 'ارتباط با Service Worker برقرار نشد.';
          showAlert(err);
          updateProgress(PROGRESS_STEPS.ERROR, err);
          return;
        }

        if (!response || !response.success) {
          const errMsg = (response && response.error) || 'خطا در فرآیند عکسبرداری';
          showAlert(errMsg);
          updateProgress(PROGRESS_STEPS.ERROR, errMsg);
        } else {
          updateProgress(PROGRESS_STEPS.DONE, response.filename || 'فایل ذخیره شد.');
        }
      }
    );
  } catch (err) {
    state.isCapturing = false;
    btnCapture.disabled = false;
    btnCapture.style.opacity = '1';
    const errText = err.message || 'خطای غیرمنتظره';
    showAlert(errText);
    updateProgress(PROGRESS_STEPS.ERROR, errText);
  }
}

// Start popup
document.addEventListener('DOMContentLoaded', init);
