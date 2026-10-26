---
layout: default
title: 記事
lang: ja
description: David KlanによるAIエージェント、デリバリー、働き方についてのエッセイ。LinkedInで公開した記事の全文アーカイブ(本文は英語)。
permalink: /ja/articles/
---
{% assign articles = site.articles | sort: 'date' | reverse %}
<section class="writing-index">
  <header class="writing-index__head">
    <span class="modlabel modlabel--amber">// 記事 · {{ articles.size }}本</span>
    <h1>構築の現場からのノート。</h1>
    <p class="writing-index__lead">このサイトのシステムを作りながら書いた、エージェント、デリバリー、働き方の変化についてのエッセイです。いずれも<a href="{{ site.data.site.contacts.linkedin }}" target="_blank" rel="noopener">LinkedIn</a>で最初に公開し、ここに全文を保存しています。<strong>本文は英語のみです。</strong></p>
  </header>

  <ol class="writing-list">
    {% for a in articles %}
    <li class="writing-list__item">
      <a class="writing-list__link" href="{{ a.url | relative_url }}" hreflang="en">
        <span class="writing-list__meta"><time datetime="{{ a.date | date_to_xmlschema }}">{{ a.date | date: "%Y.%m" }}</time> · {{ a.reading_minutes }}分 · EN</span>
        <span class="writing-list__title" lang="en">{{ a.title }}</span>
        <span class="writing-list__desc" lang="en">{{ a.description | default: a.summary }}</span>
      </a>
    </li>
    {% endfor %}
  </ol>

  {% if site.data.articles_external.size > 0 %}
  <h2 class="writing-index__sub">その他の掲載先</h2>
  <ol class="writing-list">
    {% for a in site.data.articles_external %}
    <li class="writing-list__item">
      <a class="writing-list__link" href="{{ a.url }}" target="_blank" rel="noopener" hreflang="en">
        <span class="writing-list__meta">{{ a.date_label }} · {{ a.venue }} ↗</span>
        <span class="writing-list__title" lang="en">{{ a.title }}</span>
        <span class="writing-list__desc" lang="en">{{ a.description }}</span>
      </a>
    </li>
    {% endfor %}
  </ol>
  {% endif %}
</section>
