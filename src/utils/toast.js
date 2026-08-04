const DEFAULT_ICONS = {
  success: 'check_circle',
  error: 'cancel',
  warn: 'warning',
  info: 'info',
};

export function showToast(message, options = {}) {
  const { duration = 3200, type = 'info', icon = null, subtitle = null, highlightSelector = null } = options;
  if (typeof window === 'undefined') return null;

  const containerId = 'app-toast-container';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '10px',
      alignItems: 'flex-end',
      pointerEvents: 'none',
    });
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = 'app-toast ' + type;
  const resolvedIcon = icon || DEFAULT_ICONS[type] || DEFAULT_ICONS.info;
  const subtitleHtml = subtitle ? `<div class="toast-subtitle">${String(subtitle)}</div>` : '';
  el.innerHTML =
    `<span class="toast-icon-badge"><span class="material-icons-outlined toast-icon" aria-hidden>${resolvedIcon}</span></span>` +
    `<div class="toast-body"><div class="toast-message">${String(message || '')}</div>${subtitleHtml}</div>` +
    `<button type="button" class="toast-close" aria-label="Dismiss">✕</button>` +
    `<div class="toast-progress"><div class="toast-progress-bar"></div></div>`;
  Object.assign(el.style, {
    pointerEvents: 'auto',
    opacity: '0',
    transform: 'translateY(12px) scale(0.96)',
    transition: 'opacity 220ms ease, transform 220ms ease',
  });

  container.appendChild(el);

  let removed = false;
  let timeoutId = null;
  let remaining = duration;
  let startedAt = Date.now();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    });
  });

  let highlightedEl = null;
  if (highlightSelector) {
    try {
      highlightedEl = document.querySelector(highlightSelector);
      if (highlightedEl) highlightedEl.classList.add('toast-validation-highlight');
    } catch (e) {}
  }

  const hide = () => {
    if (removed) return;
    removed = true;
    clearTimeout(timeoutId);
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px) scale(0.96)';
    setTimeout(() => {
      try { el.remove(); } catch (e) {}
      try { if (highlightedEl) highlightedEl.classList.remove('toast-validation-highlight'); } catch (e) {}
    }, 240);
  };

  const progressBar = el.querySelector('.toast-progress-bar');
  if (progressBar) {
    progressBar.style.transition = `width ${duration}ms linear`;
    requestAnimationFrame(() => {
      progressBar.style.width = '0%';
    });
  }

  const start = (time) => {
    startedAt = Date.now();
    timeoutId = setTimeout(hide, time);
  };

  const pause = () => {
    clearTimeout(timeoutId);
    remaining -= Date.now() - startedAt;
    if (progressBar) {
      const computedWidth = getComputedStyle(progressBar).width;
      progressBar.style.transition = 'none';
      progressBar.style.width = computedWidth;
    }
  };

  const resume = () => {
    if (removed) return;
    if (remaining <= 0) return hide();
    start(remaining);
    if (progressBar) {
      requestAnimationFrame(() => {
        progressBar.style.transition = `width ${remaining}ms linear`;
        progressBar.style.width = '0%';
      });
    }
  };

  el.addEventListener('mouseenter', pause);
  el.addEventListener('mouseleave', resume);
  el.querySelector('.toast-close')?.addEventListener('click', hide);

  start(remaining);

  return { hide };
}

export default showToast;