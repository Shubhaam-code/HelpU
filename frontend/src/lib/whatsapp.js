/**
 * HelpU WhatsApp Direct Integration Helper
 * Allows students to connect and coordinate directly on WhatsApp instead of in-app messaging.
 */

export function getWhatsAppUrl(params = {}, maybeMessage) {
  // Support both object arguments { phone, name, route, message, isOwn } and (phone, message)
  const isObj = params && typeof params === 'object';
  const phone = isObj ? (params.phone || '') : (typeof params === 'string' ? params : '');
  const message = isObj ? params.message : maybeMessage;
  const name = isObj ? (params.name || '') : '';
  const route = isObj ? (params.route || '') : '';
  const isOwn = isObj ? Boolean(params.isOwn) : false;

  // Never generate WhatsApp contact URL for user's own post
  if (isOwn) return '';

  const defaultText = message || (route 
    ? `Hi${name ? ' ' + name : ''}! Connected with you via HelpU for the campus travel (${route}). Let's coordinate our ride timings and pickup point!`
    : `Hi${name ? ' ' + name : ''}! Connecting with you via HelpU campus network.`);

  const encodedText = encodeURIComponent(defaultText);

  if (phone && phone.trim()) {
    let cleanPhone = phone.replace(/\D/g, '');
    // If Indian phone number without country code (10 digits), prepend 91
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }

  // If phone is missing/empty, do not open wa.me/?text= if it's targeted contact
  return '';
}

export function openWhatsAppChat(params = {}, maybeMessage) {
  const isObj = params && typeof params === 'object';
  if (isObj && params.isOwn) return false; // Prevent self coordination

  const url = getWhatsAppUrl(params, maybeMessage);
  if (url) {
    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      // If popup blocker blocked the new tab, navigate directly as fallback
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = url;
      }
      return true;
    } catch (e) {
      window.location.href = url;
      return true;
    }
  }
  return false;
}


