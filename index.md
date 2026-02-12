---
layout: default
title: Home
---
<section class="hero fade-up">
  <p class="eyebrow">{{ site.data.site.owner_role }}</p>
  <h1>{{ site.data.site.hero_tagline }}</h1>
  <p class="hero-summary">{{ site.data.site.summary }}</p>
  <div class="audience-grid">
    <article class="audience-card">
      <h2>For Business Stakeholders</h2>
      <p>Scan value, impact, and decision relevance in under two minutes.</p>
    </article>
    <article class="audience-card">
      <h2>For Technophiles</h2>
      <p>Dive into architecture, constraints, tradeoffs, and implementation patterns.</p>
    </article>
  </div>
</section>

<section class="skills-strip fade-up delay-1" aria-label="Skills demonstrated">
  <h2>Skills Demonstrated</h2>
  <div class="skills-grid">
    {% for skill in site.data.site.skills %}
    <div class="skill-pill">
      <span class="icon-badge">{% include icon.html name=skill.icon %}</span>
      <span>{{ skill.name }}</span>
    </div>
    {% endfor %}
  </div>
</section>

<section class="section-block fade-up delay-2">
  <div class="section-heading">
    <h2>Portfolio at a Glance</h2>
    <p>Four projects from the last year, each with executive and technical depth.</p>
  </div>

  <div class="card-grid">
    {% for project_id in site.data.site.project_order %}
    {% assign p = site.data.projects[project_id] %}
    <article class="project-card fade-up delay-{{ forloop.index }}">
      <div class="card-top">
        <span class="icon-badge">{% include icon.html name=p.icon %}</span>
        <h3><a href="{{ p.detail_page | relative_url }}">{{ p.name }}</a></h3>
      </div>
      <p class="value-line">{{ p.one_line_value }}</p>
      <ul class="tag-list">
        {% for tag in p.tags %}
        <li>{{ tag }}</li>
        {% endfor %}
      </ul>
      <ul class="bullet-list compact">
        {% for bullet in p.impact_bullets %}
        <li>{{ bullet }}</li>
        {% endfor %}
      </ul>
      <a class="inline-link" href="{{ p.detail_page | relative_url }}">Open full case study</a>
    </article>
    {% endfor %}
  </div>
</section>

<section class="now-next fade-up delay-3">
  <h2>Now / Next</h2>
  <div class="now-next-grid">
    <article class="panel">
      <h3>Now</h3>
      <ul class="bullet-list">
        {% for item in site.data.site.now_next.now %}
        <li>{{ item }}</li>
        {% endfor %}
      </ul>
    </article>
    <article class="panel">
      <h3>Next</h3>
      <ul class="bullet-list">
        {% for item in site.data.site.now_next.next %}
        <li>{{ item }}</li>
        {% endfor %}
      </ul>
    </article>
  </div>
</section>

<section class="section-block fade-up delay-4">
  <h2>About / Contact</h2>
  <p>{{ site.data.site.about_short }}</p>
  <div class="contact-links">
    <a href="{{ site.data.site.contacts.github }}" target="_blank" rel="noreferrer">GitHub</a>
    <a href="{{ site.data.site.contacts.linkedin }}" target="_blank" rel="noreferrer">LinkedIn</a>
    <a href="{{ site.data.site.contacts.website }}" target="_blank" rel="noreferrer">Website</a>
    <a href="mailto:{{ site.data.site.contacts.email }}">Email</a>
  </div>
</section>
