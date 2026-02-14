---
layout: default
title: ホーム | LLMプロジェクトポートフォリオ
lang: ja
---
<section class="hero fade-up">
  <div class="hero-header">
    <div class="hero-text">
      <p class="eyebrow">{{ site.data.site.owner_role_ja }}</p>
      <h1>{{ site.data.site.hero_tagline_ja }}</h1>
      <p class="hero-summary">{{ site.data.site.summary_ja }}</p>
    </div>
    <img src="{{ "/assets/images/DK_Avatar.jpeg" | relative_url }}" alt="{{ site.data.site.owner_name }}" class="hero-avatar">
  </div>
  <div class="audience-grid">
    <article class="audience-card">
      <h2>ビジネス関係者向け</h2>
      <p>2分以内で価値、影響、意思決定の関連性をスキャン。</p>
    </article>
    <article class="audience-card">
      <h2>技術志向の方向け</h2>
      <p>アーキテクチャ、制約、トレードオフ、実装パターンを深く掘り下げる。</p>
    </article>
  </div>
</section>

<section class="skills-strip fade-up delay-1" aria-label="実証スキル">
  <h2>実証スキル</h2>
  <div class="skills-grid">
    {% for skill in site.data.site.skills %}
    <div class="skill-pill">
      <span class="icon-badge">{% include icon.html name=skill.icon %}</span>
      <span>{{ skill.name_ja }}</span>
    </div>
    {% endfor %}
  </div>
</section>

<section class="section-block fade-up delay-2">
  <div class="section-heading">
    <h2>プロジェクト一覧</h2>
    <p>過去1年間の4つのプロジェクト。それぞれに経営と技術の深みがあります。</p>
  </div>

  <div class="card-grid">
    <!-- 日本語ユーザー向けにJTESを先頭表示 -->
    {% assign p = site.data.projects.jtes_specialized_rag %}
    <article class="project-card fade-up delay-1">
      <div class="card-top">
        <span class="icon-badge">{% include icon.html name=p.icon %}</span>
        {% assign detail_ja = p.detail_page | replace_first: '/projects/', '/ja/projects/' %}
        <h3><a href="{{ detail_ja | relative_url }}">{{ p.name_ja }}</a></h3>
      </div>
      <p class="value-line">{{ p.one_line_value_ja }}</p>
      <ul class="tag-list">
        {% for tag in p.tags_ja %}
        <li>{{ tag }}</li>
        {% endfor %}
      </ul>
      <ul class="bullet-list compact">
        {% for bullet in p.impact_bullets_ja %}
        <li>{{ bullet }}</li>
        {% endfor %}
      </ul>
      <a class="inline-link" href="{{ detail_ja | relative_url }}">詳細を見る</a>
    </article>

    {% for project_id in site.data.site.project_order %}
    {% if project_id != 'jtes_specialized_rag' %}
    {% assign p = site.data.projects[project_id] %}
    <article class="project-card fade-up delay-{{ forloop.index }}">
      <div class="card-top">
        <span class="icon-badge">{% include icon.html name=p.icon %}</span>
        {% assign detail_ja = p.detail_page | replace_first: '/projects/', '/ja/projects/' %}
        <h3><a href="{{ detail_ja | relative_url }}">{{ p.name_ja }}</a></h3>
      </div>
      <p class="value-line">{{ p.one_line_value_ja }}</p>
      <ul class="tag-list">
        {% for tag in p.tags_ja %}
        <li>{{ tag }}</li>
        {% endfor %}
      </ul>
      <ul class="bullet-list compact">
        {% for bullet in p.impact_bullets_ja %}
        <li>{{ bullet }}</li>
        {% endfor %}
      </ul>
      <a class="inline-link" href="{{ detail_ja | relative_url }}">詳細を見る</a>
    </article>
    {% endif %}
    {% endfor %}
  </div>
</section>

<section class="now-next fade-up delay-3">
  <h2>現在 / 次の取り組み</h2>
  <div class="now-next-grid">
    <article class="panel">
      <h3>現在</h3>
      <ul class="bullet-list">
        {% for item in site.data.site.now_next.now_ja %}
        <li>{{ item }}</li>
        {% endfor %}
      </ul>
    </article>
    <article class="panel">
      <h3>次</h3>
      <ul class="bullet-list">
        {% for item in site.data.site.now_next.next_ja %}
        <li>{{ item }}</li>
        {% endfor %}
      </ul>
    </article>
  </div>
</section>

<section class="section-block fade-up delay-4">
  <h2>概要 / 連絡先</h2>
  <p>{{ site.data.site.about_short_ja }}</p>
  <div class="contact-links">
    <a href="{{ site.data.site.contacts.github }}" target="_blank" rel="noreferrer">GitHub</a>
    <a href="{{ site.data.site.contacts.linkedin }}" target="_blank" rel="noreferrer">LinkedIn</a>
    <a href="{{ site.data.site.contacts.website }}" target="_blank" rel="noreferrer">Webサイト</a>
    <a href="mailto:{{ site.data.site.contacts.email }}">メール</a>
  </div>
</section>
