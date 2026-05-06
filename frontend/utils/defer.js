'use strict';

function scheduleIdleRender(work, options = {}) {
  const timeout = options.timeout || 1000;
  const delay = options.delay || 60;
  if ('requestIdleCallback' in window) {
    return { type: 'idle', id: requestIdleCallback(work, { timeout }) };
  }
  return { type: 'timeout', id: setTimeout(work, delay) };
}

function cancelIdleRender(ticket) {
  if (!ticket) return;
  if (ticket.type === 'idle' && 'cancelIdleCallback' in window) {
    cancelIdleCallback(ticket.id);
    return;
  }
  if (ticket.type === 'timeout') clearTimeout(ticket.id);
}

function renderDeferredPlaceholders(selectors, label = 'Carregando dados...') {
  selectors.forEach((selector) => {
    const node = document.querySelector(selector);
    if (node) node.innerHTML = `<div class="sync-empty">${esc(label)}</div>`;
  });
}
