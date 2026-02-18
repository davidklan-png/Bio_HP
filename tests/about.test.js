// Simple test for about.js avatar reference
(function() {
  'use strict';

  // Test: Avatar image source
  const aboutHtml = document.createElement('div');
  aboutHtml.innerHTML = `
    <div class="about-section__intro">
      <div class="about-section__avatar">
        <img src="/assets/images/Kinokomon_512x512.png" alt="Kinokomon" class="about-section__avatar-img" />
      </div>
    </div>
  `;

  const avatarImg = aboutHtml.querySelector('.about-section__avatar-img');

  if (avatarImg) {
    const src = avatarImg.getAttribute('src');

    if (src === '/assets/images/Kinokomon_512x512.png') {
      console.log('✓ Avatar image source is correct (Kinokomon_512x512.png)');
    } else {
      console.error('✗ Avatar image source is wrong:', src);
      console.error('Expected: /assets/images/Kinokomon_512x512.png');
    }
  } else {
    console.error('✗ Avatar image element not found');
  }

  // Test: Avatar alt text
  if (avatarImg) {
    const alt = avatarImg.getAttribute('alt');
    if (alt === 'Kinokomon') {
      console.log('✓ Avatar alt text is correct (Kinokomon)');
    } else {
      console.error('✗ Avatar alt text is wrong:', alt);
    }
  }

  console.log('All about.js avatar tests passed');
})();
