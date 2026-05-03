chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Video Speed Controller installed');
  }
});
