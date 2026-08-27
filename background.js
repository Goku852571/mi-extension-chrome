// Background Script para manejar el Side Panel y Notificaciones
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Escuchar cambios de URL para habilitar/deshabilitar el Side Panel
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  let isYouTubeStudio = false;
  try {
    isYouTubeStudio = new URL(tab.url).origin === 'https://studio.youtube.com';
  } catch (error) {
    console.debug('URL no compatible con el panel lateral:', tab.url, error);
  }
  await chrome.sidePanel.setOptions({ tabId, path: 'popup.html', enabled: isYouTubeStudio });
});

// Centralizar notificaciones del sistema desde el popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showNotification') {
    chrome.notifications.create(`yt-automator-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: message.title || 'YouTube Studio Automator',
      message: message.body || '',
      priority: 2
    });
    sendResponse({ sent: true });
  }
  return false;
});
