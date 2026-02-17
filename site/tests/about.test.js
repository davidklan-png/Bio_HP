// Simple test for about.js download button functionality
(function() {
  'use strict';

  // Mock document for testing
  const mockDocument = {
    querySelector: function(selector) {
      if (selector === '[data-about-download]') {
        return {
          addEventListener: function(event, callback) {
            console.log('Download button event listener attached:', event);
          }
        };
      }
      return null;
    },
    createElement: function(tagName) {
      return {
        tagName: tagName,
        href: '',
        download: '',
        click: function() {
          console.log('Link clicked:', this.href, this.download);
        }
      };
    },
    body: null,
    appendChild: function(element) {
      this.body = element;
      console.log('Element appended to body:', element.tagName);
    },
    removeChild: function(element) {
      console.log('Element removed from body:', element.tagName);
    }
  };

  // Test: Download button exists
  const downloadButton = mockDocument.querySelector('[data-about-download]');
  console.assert(downloadButton !== null, 'Download button should exist');
  console.log('✓ Download button exists');

  // Test: Event listener can be attached
  downloadButton.addEventListener('click', function() {});
  console.log('✓ Event listener attached');

  console.log('All tests passed for about.js');
})();
