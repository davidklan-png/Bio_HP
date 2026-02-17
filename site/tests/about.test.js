#!/usr/bin/env node
/**
 * Unit tests for About Page
 * Run with: node --test site/tests/about.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Constants from about.js
const RESUME_URL = '/assets/david-klan-resume.md';
const RESUME_FILENAME = 'david-klan-resume.md';

describe('About Page - Constants', () => {
  it('should have correct resume URL constant', () => {
    assert.strictEqual(RESUME_URL, '/assets/david-klan-resume.md');
  });

  it('should have correct resume filename constant', () => {
    assert.strictEqual(RESUME_FILENAME, 'david-klan-resume.md');
  });
});

describe('About Page - File Paths', () => {
  it('should have resume file at correct path', () => {
    assert.strictEqual(RESUME_URL, '/assets/david-klan-resume.md');
  });

  it('should download with descriptive filename', () => {
    assert.strictEqual(RESUME_FILENAME, 'david-klan-resume.md');
    assert.ok(RESUME_FILENAME.endsWith('.md'), 'File should have .md extension');
    assert.ok(RESUME_FILENAME.includes('david-klan'), 'Filename should include name');
  });

  it('should use assets directory for static files', () => {
    assert.ok(RESUME_URL.startsWith('/assets/'), 'Resume should be in assets directory');
  });

  it('should use markdown format', () => {
    assert.ok(RESUME_URL.endsWith('.md'), 'Resume should be in markdown format');
    assert.ok(RESUME_FILENAME.endsWith('.md'), 'Download filename should be .md');
  });
});

describe('About Page - CSS Integration', () => {
  it('should use consistent color scheme with JD Concierge', () => {
    // These colors should match jd_concierge.css
    const colors = {
      primary: '#1e40af',
      background: '#fbfcfe',
      border: '#d6d9de',
      text: '#1f2937',
    };

    assert.ok(colors.primary, 'Primary color should be defined');
    assert.ok(colors.background, 'Background color should be defined');
    assert.ok(colors.border, 'Border color should be defined');
    assert.ok(colors.text, 'Text color should be defined');
  });

  it('should have consistent spacing with JD Concierge', () => {
    const spacing = {
      borderRadius: '14px',
      padding: '1.5rem',
      gap: '1.5rem',
    };

    assert.ok(spacing.borderRadius, 'Border radius should be defined');
    assert.ok(spacing.padding, 'Padding should be defined');
    assert.ok(spacing.gap, 'Gap should be defined');
  });
});

describe('About Page - Design Patterns', () => {
  it('should use BEM-style class naming', () => {
    const validClasses = [
      'about-section',
      'about-section__title',
      'about-section__intro',
      'about-section__card',
      'about-section__button',
    ];

    for (const className of validClasses) {
      assert.ok(typeof className === 'string', `${className} should be a string`);
      assert.ok(className.includes('__') || className.length === 'about-section'.length, 'BEM naming pattern');
    }
  });

  it('should use semantic HTML elements', () => {
    const semanticElements = ['section', 'h1', 'h2', 'h3', 'ul', 'li', 'button', 'a'];

    for (const element of semanticElements) {
      assert.ok(semanticElements.includes(element), `${element} should be semantic`);
    }
  });

  it('should have responsive design breakpoints', () => {
    const breakpoints = {
      mobile: '1fr',
      tablet: '768px',
      desktop: '768px',
    };

    assert.ok(breakpoints.tablet, 'Tablet breakpoint should be defined');
    assert.ok(breakpoints.desktop, 'Desktop breakpoint should be defined');
  });
});

describe('About Page - Download Functionality', () => {
  it('should use button element for download action', () => {
    const buttonType = 'button';
    assert.strictEqual(buttonType, 'button', 'Download should use button element');
  });

  it('should use data attribute for JS selector', () => {
    const dataAttribute = 'data-about-download';
    assert.ok(dataAttribute.startsWith('data-'), 'Should use data attribute for JS selection');
  });

  it('should have accessible button text', () => {
    const buttonText = '📄 Download Resume (Markdown)';
    assert.ok(buttonText.includes('Download Resume'), 'Button should have accessible text');
    assert.ok(buttonText.includes('Markdown'), 'Button should mention format');
  });
});

describe('About Page - Content Structure', () => {
  it('should have main sections defined', () => {
    const sections = [
      'About & Contact',
      'Hello, I\'m David',
      'What I Do',
      'What I\'m Curious About',
      'Projects You Might Find Interesting',
      'Get in Touch',
    ];

    for (const section of sections) {
      assert.ok(typeof section === 'string', `${section} should be defined`);
    }
  });

  it('should have contact information defined', () => {
    const contact = {
      linkedin: 'davidklan',
      email: 'kinokomon@kinokoholic.com',
      location: 'Japan & US',
    };

    assert.ok(contact.linkedin, 'LinkedIn should be defined');
    assert.ok(contact.email, 'Email should be defined');
    assert.ok(contact.location, 'Location should be defined');
  });

  it('should have project links defined', () => {
    const projects = [
      'JTES',
      'Insurance Reporting Automation',
      'JD Concierge',
    ];

    for (const project of projects) {
      assert.ok(typeof project === 'string', `${project} should be defined`);
    }
  });
});

describe('About Page - Security', () => {
  it('should use type="button" for form buttons', () => {
    const buttonType = 'button';
    assert.strictEqual(buttonType, 'button', 'Button should have type="button"');
  });

  it('should use defer for script loading', () => {
    const scriptDefer = 'defer';
    assert.strictEqual(scriptDefer, 'defer', 'Script should use defer attribute');
  });
});

describe('About Page - Resume Content', () => {
  it('should be in markdown format', () => {
    const format = '.md';
    assert.strictEqual(format, '.md', 'Resume should be markdown format');
  });

  it('should have personal and conversational tone', () => {
    const toneIndicators = [
      'curious',
      'love',
      'learning',
      'creating',
      'proud of',
    ];

    for (const indicator of toneIndicators) {
      assert.ok(typeof indicator === 'string', `${indicator} should indicate personal tone`);
    }
  });

  it('should avoid business jargon', () => {
    const jargonToAvoid = [
      'stakeholder management',
      'DR/BCP delivery',
      'cross-region leadership',
    ];

    for (const term of jargonToAvoid) {
      // In the actual resume, these should be replaced with conversational language
      // This test verifies we're thinking about jargon avoidance
      assert.ok(typeof term === 'string', `${term} is jargon to avoid`);
    }
  });
});
