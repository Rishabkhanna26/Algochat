(function () {
  var script = document.currentScript;
  if (!script) return;

  var adminId = String(script.getAttribute('data-admin-id') || '').trim();
  if (!adminId) return;

  var widgetId = 'aa-chatbot-widget-' + adminId;
  if (document.getElementById(widgetId)) return;

  var origin = new URL(script.src, window.location.href).origin;
  var widgetUrl = new URL('/chatbot-widget', origin);
  widgetUrl.searchParams.set('adminId', adminId);
  widgetUrl.searchParams.set('page', window.location.href);

  var position = script.getAttribute('data-position') === 'bottom-left' ? 'left' : 'right';
  var buttonText = script.getAttribute('data-button-text') || 'Chat with us';
  var accent = script.getAttribute('data-accent') || '#ff7a45';
  var startOpen = script.getAttribute('data-open') === 'true';

  var mount = function () {
    var host = document.createElement('div');
    host.id = widgetId;
    host.style.position = 'fixed';
    host.style.bottom = '24px';
    host.style[position] = '24px';
    host.style.zIndex = '2147483000';
    host.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    var panel = document.createElement('div');
    panel.style.width = '380px';
    panel.style.maxWidth = 'calc(100vw - 24px)';
    panel.style.height = '680px';
    panel.style.maxHeight = 'calc(100vh - 110px)';
    panel.style.borderRadius = '28px';
    panel.style.overflow = 'hidden';
    panel.style.background = '#0f172a';
    panel.style.boxShadow = '0 32px 80px rgba(2, 6, 23, 0.38)';
    panel.style.border = '1px solid rgba(255,255,255,0.14)';
    panel.style.display = startOpen ? 'block' : 'none';

    var frame = document.createElement('iframe');
    frame.src = widgetUrl.toString();
    frame.title = 'Website chatbot';
    frame.loading = 'lazy';
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.border = '0';
    frame.style.display = 'block';
    frame.allow = 'clipboard-write';
    panel.appendChild(frame);

    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Toggle website chatbot');
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.gap = '10px';
    button.style.marginTop = '14px';
    button.style.padding = '14px 18px';
    button.style.border = '0';
    button.style.borderRadius = '999px';
    button.style.background = accent;
    button.style.color = '#fff';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.style.fontWeight = '700';
    button.style.boxShadow = '0 16px 36px rgba(15, 23, 42, 0.3)';
    button.textContent = startOpen ? 'Close chat' : buttonText;

    var toggle = function () {
      var isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'block';
      button.textContent = isOpen ? buttonText : 'Close chat';
    };

    button.addEventListener('click', toggle);
    host.appendChild(panel);
    host.appendChild(button);
    document.body.appendChild(host);

    var style = document.createElement('style');
    style.textContent =
      '@media (max-width: 640px) {' +
      '#' + widgetId + ' { left: 12px !important; right: 12px !important; bottom: 12px !important; }' +
      '#' + widgetId + ' > div { width: 100% !important; height: min(76vh, 620px) !important; max-width: none !important; }' +
      '#' + widgetId + ' > button { width: 100%; margin-top: 10px; }' +
      '}';
    document.head.appendChild(style);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
