'use strict';

function schoolAvatarMarkup(school, className = 'school-widget-avatar') {
  return `<span class="${esc(className)}" style="${schoolAvatarStyle(school)}">${esc(schoolAvatarInitials(school?.name || ''))}</span>`;
}
