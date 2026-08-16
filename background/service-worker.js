/**
 * Full Page Screenshot Pro - Background Service Worker (Manifest V3)
 * Utilizes Chrome DevTools Protocol (CDP) for pixel-perfect full page captures.
 */

import {
  MESSAGE_ACTIONS,
  PROGRESS_STEPS,
  CAPTURE_MODES,
  IMAGE_FORMATS,
  PRESET_WIDTHS,
  VIEWPORT_PRESETS,
} from '../shared/constants.js';

import {
  generateFilename,
  isUrlAllowed,
  mapErrorToPersian,
  sendCdpCommand,
  attachDebugger,
  detachDebugger,
  sleep,
} from '../shared/helpers.js';

// Track attached debuggers to avoid collision and clean up orphaned sessions
const activeSessions = new Map();

// Listen for debugger detach events
chrome.debugger.onDetach.addListener((source, reason) => {
  const tabId = source.tabId;
  if (tabId && activeSessions.has(tabId)) {
    activeSessions.delete(tabId);
    console.log(`[CDP] Debugger detached from tab ${tabId} by ${reason}`);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeSessions.has(tabId)) {
    const target = { tabId };
    detachDebugger(target).catch(() => {});
    activeSessions.delete(tabId);
  }
});

/**
 * Broadcast progress update to popup if open
 */
function sendProgress(step, details = '') {
  try {
    chrome.runtime.sendMessage({
      action: MESSAGE_ACTIONS.CAPTURE_PROGRESS,
      step,
      details,
    }).catch(() => {});
  } catch {
    // Ignore runtime messaging when inactive
  }
}

/**
 * Core Full Page / Visible Area Screenshot Engine via CDP
 */
async function captureWithCdp(options) {
  const {
    mode = CAPTURE_MODES.FULL_PAGE,
    format = IMAGE_FORMATS.PNG,
    quality = 90,
    viewport = VIEWPORT_PRESETS.CURRENT,
    customWidth = 1200,
    preloadLazy = false,
  } = options;

  sendProgress(PROGRESS_STEPS.CHECKING);

  // 1. Get active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0 || !tabs[0].id) {
    throw new Error('No active tab found');
  }

  const activeTab = tabs[0];
  const tabId = activeTab.id;
  const target = { tabId };

  // 2. Validate URL restriction
  const urlCheck = isUrlAllowed(activeTab.url);
  if (!urlCheck.allowed) {
    throw new Error(urlCheck.reasonFa);
  }

  // 3. Ensure previous debugger session is cleanly detached
  if (activeSessions.has(tabId)) {
    await detachDebugger(target);
    activeSessions.delete(tabId);
    await sleep(80);
  }

  // 4. Attach Debugger
  sendProgress(PROGRESS_STEPS.ATTACHING);
  await attachDebugger(target, '1.3');
  activeSessions.set(tabId, { startTime: Date.now() });

  try {
    // 5. Enable Page domain
    await sendCdpCommand(target, 'Page.enable');

    // 6. Optional: Preload Lazy Images via Content Script
    if (preloadLazy && mode === CAPTURE_MODES.FULL_PAGE) {
      sendProgress(PROGRESS_STEPS.PRELOADING);
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/preload.js'],
        });
        await sleep(250);
      } catch (scriptErr) {
        console.warn('[CDP] Lazy preload script failed, continuing without it:', scriptErr);
      }
    }

    // 7. Measure Layout Metrics
    sendProgress(PROGRESS_STEPS.MEASURING);
    const layoutMetrics = await sendCdpCommand(target, 'Page.getLayoutMetrics');
    
    const cssContentSize = layoutMetrics.cssContentSize || layoutMetrics.contentSize || {};
    const visualViewport = layoutMetrics.cssVisualViewport || layoutMetrics.visualViewport || {};

    let targetWidth = 0;
    let targetHeight = 0;
    const isMobile = viewport === VIEWPORT_PRESETS.MOBILE;

    // Determine target width
    if (viewport === VIEWPORT_PRESETS.CUSTOM && customWidth > 0) {
      targetWidth = Math.round(customWidth);
    } else if (PRESET_WIDTHS[viewport]) {
      targetWidth = PRESET_WIDTHS[viewport];
    } else {
      targetWidth = Math.round(cssContentSize.width || visualViewport.clientWidth || 1280);
    }

    targetWidth = Math.max(targetWidth, 320);

    // Determine target height
    if (mode === CAPTURE_MODES.VISIBLE_AREA) {
      targetHeight = Math.round(visualViewport.clientHeight || 800);
    } else {
      targetHeight = Math.round(cssContentSize.height || visualViewport.scrollHeight || 1080);
    }

    targetHeight = Math.max(targetHeight, 200);

    // 8. Override Device Metrics
    sendProgress(PROGRESS_STEPS.EMULATING);
    await sendCdpCommand(target, 'Emulation.setDeviceMetricsOverride', {
      width: targetWidth,
      height: targetHeight,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });

    await sleep(180);

    // 9. Capture Screenshot
    sendProgress(PROGRESS_STEPS.CAPTURING);

    const screenshotParams = {
      format: format === IMAGE_FORMATS.JPEG ? 'jpeg' : 'png',
      fromSurface: true,
      captureBeyondViewport: true,
    };

    if (format === IMAGE_FORMATS.JPEG) {
      const q = Math.min(100, Math.max(50, Number(quality) || 90));
      screenshotParams.quality = q;
    }

    let screenshotData = null;
    let fallbackTiling = false;

    try {
      const captureResult = await sendCdpCommand(target, 'Page.captureScreenshot', screenshotParams);
      screenshotData = captureResult.data;
    } catch (captureErr) {
      console.warn('[CDP] Single capture failed, attempting tiled fallback:', captureErr);
      fallbackTiling = true;
    }

    // 10. Process Download or Tiled Fallback
    sendProgress(PROGRESS_STEPS.DOWNLOADING);

    if (screenshotData && !fallbackTiling) {
      const mimeType = format === IMAGE_FORMATS.JPEG ? 'image/jpeg' : 'image/png';
      const dataUrl = `data:${mimeType};base64,${screenshotData}`;
      const filename = generateFilename(activeTab.url, format, mode);

      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: false,
      });

      sendProgress(PROGRESS_STEPS.DONE, filename);
      return {
        success: true,
        downloadId,
        filename,
        message: 'اسکرین‌شات با موفقیت ذخیره شد!',
      };
    } else {
      // Tiled Fallback for mega long pages (>15,000px)
      const maxTileHeight = 6000;
      const totalTiles = Math.ceil(targetHeight / maxTileHeight);
      let downloadedParts = 0;

      for (let i = 0; i < totalTiles; i++) {
        const offset = i * maxTileHeight;
        const currentTileH = Math.min(maxTileHeight, targetHeight - offset);

        const tileParams = {
          format: format === IMAGE_FORMATS.JPEG ? 'jpeg' : 'png',
          fromSurface: true,
          clip: {
            x: 0,
            y: offset,
            width: targetWidth,
            height: currentTileH,
            scale: 1,
          },
        };

        if (format === IMAGE_FORMATS.JPEG) {
          tileParams.quality = Number(quality) || 90;
        }

        const tileResult = await sendCdpCommand(target, 'Page.captureScreenshot', tileParams);
        if (tileResult && tileResult.data) {
          const mimeType = format === IMAGE_FORMATS.JPEG ? 'image/jpeg' : 'image/png';
          const dataUrl = `data:${mimeType};base64,${tileResult.data}`;
          const filename = generateFilename(activeTab.url, format, mode, `${i + 1}-of-${totalTiles}`);

          await chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: false,
          });
          downloadedParts++;
          await sleep(100);
        }
      }

      sendProgress(PROGRESS_STEPS.DONE);
      return {
        success: true,
        filename: `صفحه خیلی بلند بود و در ${downloadedParts} بخش ذخیره شد.`,
        message: `اسکرین‌شات در ${downloadedParts} فایل مجزا با موفقیت دانلود شد.`,
      };
    }
  } finally {
    // 11. CRITICAL CLEANUP in finally block
    try {
      await sendCdpCommand(target, 'Emulation.clearDeviceMetricsOverride').catch(() => {});
      await sendCdpCommand(target, 'Page.disable').catch(() => {});
    } catch {
      // ignore
    }

    await detachDebugger(target);
    activeSessions.delete(tabId);
  }
}

// Runtime Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === MESSAGE_ACTIONS.CAPTURE_SCREENSHOT) {
    captureWithCdp(message.options || {})
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        console.error('[CDP Capture Error]', error);
        const persianError = mapErrorToPersian(error);
        sendProgress(PROGRESS_STEPS.ERROR, persianError);
        sendResponse({
          success: false,
          error: persianError,
        });
      });
    return true;
  }

  if (message.action === MESSAGE_ACTIONS.GET_CURRENT_TAB_INFO) {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        const validation = isUrlAllowed(tab.url);
        sendResponse({
          title: tab.title || '',
          url: tab.url || '',
          allowed: validation.allowed,
          reason: validation.reasonFa,
        });
      } else {
        sendResponse({ allowed: false, reason: 'تب فعال یافت نشد.' });
      }
    });
    return true;
  }
});
