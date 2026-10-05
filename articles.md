---
layout: default
title: Writing
description: Essays by David Klan on AI agents, delivery, and the future of work. First published on LinkedIn, archived here in full.
permalink: /articles/
---
{% assign articles = site.articles | sort: 'date' | reverse %}
<section class="writing-index">
  <header class="writing-index__head">
    <span class="modlabel modlabel--amber">// WRITING · {{ articles.size }} ARTICLES</span>
    <h1>Notes from the build.</h1>
    <p class="writing-index__lead">Essays on agents, delivery, and how work is changing, written while building the systems on this site. Each one was first published on <a href="{{ site.data.site.contacts.linkedin }}" target="_blank" rel="noopener">LinkedIn</a> and is archived here in full.</p>
  </header>

  <ol class="writing-list">
    {% for a in articles %}
    <li class="writing-list__item">
      <a class="writing-list__link" href="{{ a.url | relative_url }}">
        <span class="writing-list__meta"><time datetime="{{ a.date | date_to_xmlschema }}">{{ a.date | date: "%b %Y" | upcase }}</time> · {{ a.reading_minutes }} min</span>
        <span class="writing-list__title">{{ a.title }}</span>
        <span class="writing-list__desc">{{ a.description | default: a.summary }}</span>
      </a>
    </li>
    {% endfor %}
  </ol>

  {% if site.data.articles_external.size > 0 %}
  <h2 class="writing-index__sub">Elsewhere</h2>
  <ol class="writing-list">
    {% for a in site.data.articles_external %}
    <li class="writing-list__item">
      <a class="writing-list__link" href="{{ a.url }}" target="_blank" rel="noopener">
        <span class="writing-list__meta">{{ a.date_label }} · {{ a.venue }} ↗</span>
        <span class="writing-list__title">{{ a.title }}</span>
        <span class="writing-list__desc">{{ a.description }}</span>
      </a>
    </li>
    {% endfor %}
  </ol>
  {% endif %}
</section>
