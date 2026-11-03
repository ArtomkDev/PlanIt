const { WEB_APP_URL } = require('./website.cjs');

function getShareLinkHost(configuredHost, platform) {
  const value = platform === 'web'
    ? WEB_APP_URL
    : String(configuredHost || '').trim() || 'planit-demo.web.app';
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (
    url.protocol !== 'https:' || url.username || url.password || url.port ||
    url.pathname !== '/' || url.search || url.hash
  ) {
    throw new Error('EXPO_PUBLIC_SHARE_LINK_DOMAIN must be an HTTPS host without a path.');
  }
  return url.hostname;
}

module.exports = { getShareLinkHost };
