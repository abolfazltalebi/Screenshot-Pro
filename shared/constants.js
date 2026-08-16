/**
 * Full Page Screenshot Pro - Shared Constants
 */

export const EXTENSION_NAME = 'Full Page Screenshot Pro';
export const EXTENSION_VERSION = '1.0.0';

export const MESSAGE_ACTIONS = {
  CAPTURE_SCREENSHOT: 'CAPTURE_SCREENSHOT',
  CAPTURE_PROGRESS: 'CAPTURE_PROGRESS',
  GET_CURRENT_TAB_INFO: 'GET_CURRENT_TAB_INFO',
};

export const CAPTURE_MODES = {
  FULL_PAGE: 'full',
  VISIBLE_AREA: 'visible',
};

export const IMAGE_FORMATS = {
  PNG: 'png',
  JPEG: 'jpeg',
};

export const VIEWPORT_PRESETS = {
  CURRENT: 'current',
  MOBILE: 'mobile',     // 390px
  TABLET: 'tablet',     // 768px
  DESKTOP: 'desktop',   // 1366px
  CUSTOM: 'custom',
};

export const PRESET_WIDTHS = {
  mobile: 390,
  tablet: 768,
  desktop: 1366,
};

export const PROGRESS_STEPS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  ATTACHING: 'attaching',
  PRELOADING: 'preloading',
  MEASURING: 'measuring',
  EMULATING: 'emulating',
  CAPTURING: 'capturing',
  DOWNLOADING: 'downloading',
  DONE: 'done',
  ERROR: 'error',
};

export const PROGRESS_TEXT_FA = {
  idle: 'آماده برای عکسبرداری',
  checking: 'بررسی وضعیت تب فعال...',
  attaching: 'اتصال به Chrome DevTools Protocol...',
  preloading: 'بارگذاری تصاویر تنبل (Lazy Load)...',
  measuring: 'محاسبه ابعاد کامل صفحه...',
  emulating: 'تنظیم رزولوشن و Viewport...',
  capturing: 'گرفتن اسکرین‌شات با بالاترین کیفیت...',
  downloading: 'ذخیره و دانلود فایل تصویر...',
  done: 'اسکرین‌شات با موفقیت ذخیره شد!',
  error: 'خطا در فرآیند عکسبرداری',
};

export const DEFAULT_SETTINGS = {
  mode: CAPTURE_MODES.FULL_PAGE,
  format: IMAGE_FORMATS.PNG,
  quality: 90,
  viewport: VIEWPORT_PRESETS.CURRENT,
  customWidth: 1200,
  preloadLazy: false,
};
