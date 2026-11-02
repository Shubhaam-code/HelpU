/**
 * HelpU WhatsApp Direct Integration Helper
 * Allows students to connect and coordinate directly on WhatsApp instead of in-app messaging.
 */

export function getWhatsAppUrl({ phone, name, route, message } = {}) {
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

  // If no specific phone is given, open WhatsApp with prefilled message so user can choose chat
  return `https://wa.me/?text=${encodedText}`;
}

export function openWhatsAppChat({ phone, name, route, message } = {}) {
  const url = getWhatsAppUrl({ phone, name, route, message });
  window.open(url, '_blank', 'noopener,noreferrer');
}

