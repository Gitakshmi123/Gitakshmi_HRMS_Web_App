import { HRMS_API_ROOT } from './api';

const scriptCache = new Map();
const styleCache = new Map();

export function resolveApiOrigin() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return new URL(HRMS_API_ROOT || window.location.origin, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function loadExternalScript(src, globalName = '') {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Scripts can only be loaded in the browser.'));
  }

  if (globalName && window[globalName]) {
    return Promise.resolve(window[globalName]);
  }

  if (scriptCache.has(src)) {
    return scriptCache.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-runtime-src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(globalName ? window[globalName] : true), {
        once: true
      });
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), {
        once: true
      });
      if ((globalName && window[globalName]) || existing.dataset.loaded === 'true') {
        resolve(globalName ? window[globalName] : true);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.runtimeSrc = src;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve(globalName ? window[globalName] : true);
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

  scriptCache.set(src, promise);
  return promise;
}

export function loadExternalStylesheet(href) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Stylesheets can only be loaded in the browser.'));
  }

  if (styleCache.has(href)) {
    return styleCache.get(href);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`link[data-runtime-href="${href}"]`);
    if (existing) {
      resolve(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.runtimeHref = href;
    link.onload = () => resolve(true);
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
    document.head.appendChild(link);
  });

  styleCache.set(href, promise);
  return promise;
}
