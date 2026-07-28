export function showToast(message, options = {}) {
  const { duration = 2600, type = 'info', icon = null, highlightSelector = null } = options;
  if (typeof window === 'undefined') return null;

  const containerId = 'app-toast-container';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    Object.assign(container.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      alignItems: 'flex-end',
      pointerEvents: 'none',
    });
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = 'app-toast ' + type;
  const iconHtml = icon ? `<span class="toast-icon material-icons-outlined" aria-hidden>${icon}</span>` : `<span class="toast-icon" aria-hidden></span>`;
  el.innerHTML = `${iconHtml}<div class="toast-message">${String(message || '')}</div>`;
  Object.assign(el.style, {
    pointerEvents: 'auto',
    opacity: '1',
    transform: 'translateY(0)',
    transition: 'opacity 220ms ease, transform 220ms ease',
  });

  container.appendChild(el);

  let highlightedEl = null;
  if (highlightSelector) {
    try {
      highlightedEl = document.querySelector(highlightSelector);
      if (highlightedEl) highlightedEl.classList.add('toast-validation-highlight');
    } catch (e) {}
  }

  const hide = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => {
      try { el.remove(); } catch (e) {}
      try { if (highlightedEl) highlightedEl.classList.remove('toast-validation-highlight'); } catch (e) {}
    }, 240);
  };

  setTimeout(hide, duration);
  return {
    hide,
  };
}

export default showToast;
