(function() {
  'use strict';

  const downloadButton = document.querySelector('[data-about-download]');

  if (!downloadButton) {
    console.warn('About download button not found');
    return;
  }

  downloadButton.addEventListener('click', function() {
    const resumeUrl = '/assets/david-klan-resume.md';
    const link = document.createElement('a');
    link.href = resumeUrl;
    link.download = 'david-klan-resume.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
})();
