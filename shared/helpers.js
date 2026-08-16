/**
 * Full Page Screenshot Pro - Helper Utilities
 */

/**
 * Format a Date object into YYYY-MM-DD-HH-mm-ss string
 * @param {Date} date 
 * @returns {string}
 */
export function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

/**
 * Sanitize domain name or host from URL for safe filename
 * @param {string} urlString 
 * @returns {string}
 */
export function sanitizeDomain(urlString) {
  try {
    const url = new URL(urlString);
    let host = url.hostname || 'webpage';
    host = host.replace(/^www\./i, '');
    return host.replace(/[^a-zA-Z0-9.-]/g, '_');
  } catch {
    return 'webpage';
  }
}

/**
 * Generate standard screenshot filename
 * Format: full-page-screenshot-example-com-2026-01-01-12-30-00.png
 * @param {string} url 
 * @param {string} format 'png' | 'jpeg'
 * @param {string} mode 'full' | 'visible'
 * @param {number|string} [part]
 * @returns {string}
 */
export function generateFilename(url, format = 'png', mode = 'full', part = null) {
  const domain = sanitizeDomain(url);
  const timestamp = formatTimestamp();
  const ext = format.toLowerCase() === 'jpeg' ? 'jpg' : 'png';
  const modeTag = mode === 'visible' ? 'visible' : 'full-page';
  const partTag = part ? `-part-${part}` : '';
  
  return `${modeTag}-screenshot-${domain}-${timestamp}${partTag}.${ext}`;
}

/**
 * Check if the URL is allowed for chrome.debugger attach
 * @param {string} url 
 * @returns {{ allowed: boolean, reasonFa: string }}
 */
export function isUrlAllowed(url) {
  if (!url) {
    return {
      allowed: false,
      reasonFa: 'آدرس تب فعال نامعتبر یا خالی است.',
    };
  }

  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'view-source:', 'devtools:'];
  for (const protocol of restrictedProtocols) {
    if (url.startsWith(protocol)) {
      return {
        allowed: false,
        reasonFa: `امکان دسترسی به صفحات سیستمی (${protocol}) توسط مرورگر مسدود شده است.`,
      };
    }
  }

  if (url.includes('chrome.google.com/webstore') || url.includes('chromewebstore.google.com')) {
    return {
      allowed: false,
      reasonFa: 'مرورگر گوگل کروم اجازه اجرای Debugger روی صفحه Chrome Web Store را نمی‌دهد.',
    };
  }

  if (url.startsWith('file://')) {
    return {
      allowed: true,
      reasonFa: '',
    };
  }

  return {
    allowed: true,
    reasonFa: '',
  };
}

/**
 * Map error objects or messages to user-friendly Persian explanations
 * @param {Error|string} error 
 * @returns {string}
 */
export function mapErrorToPersian(error) {
  const msg = (error && (error.message || error.toString())) || '';
  
  if (msg.includes('Cannot access a chrome:// URL') || msg.includes('Cannot attach to this target')) {
    return 'صفحات داخلی مرورگر (مانند chrome:// یا Web Store) به دلایل امنیتی قابل عکسبرداری نیستند.';
  }
  if (msg.includes('Another debugger is already attached')) {
    return 'یک دیباگر یا ابزار DevTools دیگر در حال حاضر به این تب متصل است. لطفاً آن را ببندید و دوباره تلاش کنید.';
  }
  if (msg.includes('Detached while handling protocol message') || msg.includes('Target closed')) {
    return 'تب یا صفحه وب در حین فرآیند عکسبرداری بسته شد یا تغییر کرد.';
  }
  if (msg.includes('User cancelled') || msg.includes('cancelled')) {
    return 'عملیات توسط کاربر لغو شد.';
  }
  if (msg.includes('Invalid parameters') || msg.includes('Page size too large') || msg.includes('Maximum texture size exceeded')) {
    return 'ارتفاع یا حجم این صفحه بسیار بزرگتر از محدودیت پردازشگر گرافیکی مرورگر است. لطفاً از حالت چندبخشی یا کیفیت پایین‌تر استفاده کنید.';
  }
  if (msg.includes('Download failed') || msg.includes('SERVER_BAD_CONTENT')) {
    return 'خطا در ذخیره‌سازی فایل خروجی. لطفاً مجوز دسترسی به دانلودها را بررسی کنید.';
  }
  if (msg.includes('No active tab') || msg.includes('tab not found')) {
    return 'هیچ تب فعال و معتبری برای گرفتن اسکرین‌شات یافت نشد.';
  }

  return `خطا: ${msg || 'خطای ناشناخته رخ داده است.'}`;
}

/**
 * Promisified wrapper for chrome.debugger.sendCommand
 * @param {chrome.debugger.Debuggee} target 
 * @param {string} method 
 * @param {object} [commandParams] 
 * @returns {Promise<any>}
 */
export function sendCdpCommand(target, method, commandParams = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, commandParams, (result) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message || `CDP command ${method} failed`));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Promisified wrapper for chrome.debugger.attach
 * @param {chrome.debugger.Debuggee} target 
 * @param {string} [requiredVersion='1.3'] 
 * @returns {Promise<void>}
 */
export function attachDebugger(target, requiredVersion = '1.3') {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, requiredVersion, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message || 'Debugger attach failed'));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Promisified wrapper for chrome.debugger.detach
 * @param {chrome.debugger.Debuggee} target 
 * @returns {Promise<void>}
 */
export function detachDebugger(target) {
  return new Promise((resolve) => {
    chrome.debugger.detach(target, () => {
      if (chrome.runtime.lastError) {
        // silent cleanup
      }
      resolve();
    });
  });
}

/**
 * Sleep helper
 * @param {number} ms 
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
