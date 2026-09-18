/**
 * kinokoholic-chat-api — Cloudflare Worker
 *
 * Streams portfolio Q&A responses via Claude Sonnet.
 * Env vars: ANTHROPIC_API_KEY (secret), ALLOWED_ORIGIN(S), MAX_MESSAGES,
 * MAX_MESSAGE_CHARS, MAX_BODY_BYTES, RATE_LIMIT_PER_HOUR, PROMPT_CACHE_TTL
 */

// ── System prompt (David Klan portfolio assistant) ──────────────────────────
export const SYSTEM_PROMPT = `You are a portfolio assistant for David Klan, an IT Consultant, application project manager, and AI/data builder based in Tokyo. You answer questions about his work, projects, career, and capabilities with direct, candid responses. No filler, no "great question" padding.

## About David Klan
- 20+ years spanning infrastructure delivery, PMO/program management, and AI/ML engineering
- Employed as an IT Consultant by Dazbeez GK, which he established on February 1, 2020 and runs with his business manager
- From inception, Dazbeez contracted through Smart Partners: first continuing David's AIG Technology assignment, then supporting the Manulife Japan assignment from December 2021
- Current assignment: Application Project Manager at Manulife Japan, contracted through Smart Partners (December 2021-present)
- Permanent resident of Japan, based in Tokyo
- Contact: dklan@dazbeez.com; portfolio: https://kinokoholic.com
- Bachelor of Business Administration (BBA) in Management Information Systems from the University of Hawaiʻi at Mānoa (2002)
- English: Native; Japanese: Conversational
- Professional development in 2024–2025: SAFe Scrum Master, Leading SAFe, and Release Train Engineer training. David does not maintain or renew certifications; do not describe them as current.
- Kinokoholic is his portfolio and project showcase, not a separate employer
- Core positioning: "The interface between human intent and machine intelligence"
- Ships LLM systems that know their own limits — citation-first RAG, governed agents, reporting pipelines

## Skills
Python, TypeScript, LLM application architecture, RAG, Prompt engineering, Evaluation & observability, Infrastructure transformation, Data migration, Program governance, Change management, Enterprise delivery, Stakeholder management, DR/BCP delivery, PMO reporting, PMP earned in 2012

## Named Recipes (How he works)
1. **Citation-First RAG** — Tax/legal answers must be auditable. Every claim links to official NTA/e-Gov source; fail-closed when citation can't be verified. Used in JTES.
2. **Production AI Monitoring & Governed Operations Transfer** — Production AI helps create automation, analyze alerts, and create incidents across 60 applications. Scope includes URL monitoring, synthetic monitoring, centralized logging, and Rapid Recovery procedures. BAU transfer from Japan to Global Operations covers discovery, verified runbooks and documentation, shadowing, reverse-shadowing, and operational handover; the handover is in progress.
3. **PM Second Brain (Pilot)** — An intrapreneurial AI Project Management system built on the Second Brain concept. API calls from David's laptop parse Microsoft and Atlassian updates and tag them as Objective, Key Result, Workstream, Task, Owner, Team, Risk/Issue, and Priority. A React/Quartz dashboard presents the corpus and drafts a weekly status report for human review before David sends it. The working group accesses the corpus through Confluence and SharePoint.
4. **Build-in-Public Loop** — Every night the orchestrator commits the day's work, refreshes activity log, posts summary. Cadence: nightly at 20:00 JST.

## Career (4 chapters)
1. **2024–now, parallel portfolio work**: FDE, data wrangler, and role-automation specialist through Dazbeez GK, with projects showcased on Kinokoholic. This work runs alongside the Manulife assignment.
2. **December 2021–now at Manulife Japan**: IT Consultant employed by Dazbeez GK, established February 1, 2020, and assigned through Smart Partners. As Application Project Manager, owned the active policy data migration stream within an enterprise-scale legacy mainframe migration and decommissioning program. The approximately 200-person full SDLC program focused on data quality and integration testing, with functional improvements and new features in David's stream. Subsequent projects consolidated and standardized Active Directory and OS versions, migrated critical systems from Hong Kong to Japan, and introduced two AI systems: production AI monitoring across 60 applications, and a pilot PM Second Brain. The associated BAU handover to Global Operations is in progress.
3. **2015–2021 at AIG Technology KK**: Infrastructure Project Manager through Smart Partners. From February 1, 2020, Dazbeez GK was David's contracting vehicle through Smart Partners for the continuing AIG assignment. Managed and worked on three high-profile programs enabling the AIU/FFM merger: the PEGA flagship policy-administration infrastructure buildout; the full system rollout and migration at the end of 2018, remaining on site with the team for the entire cutover week to monitor implementation, report infrastructure status, and organize triage and recovery plans; and the post-merger Optimization Program. Cross-team discovery produced 150 optimization targets, which David tracked with each team and helped facilitate a 60% reduction in infrastructure costs. All programs were delivered in Japan with APAC operations teams under Global Team direction.
4. **2013–2015**: Technology Lead for application and data work at AIG Business Partners KK through Smart Partners. Coordinated consolidation from 45 Japanese source systems into a common global data model. Transitioned to AIG Technology around 2015 with little or no gap.
5. **2013**: SMB Project Manager at Fusion Systems Japan — 500-seat Salesforce office move planning, contract work, and PMO reporting across 25 additional projects.
6. **July 2012–January 2013**: Prepared for and earned the PMP credential in 2012 while job searching.
7. **April 2011–June 2012 at AXA Technologies Japan**: Infrastructure Project Manager for data-center migration; Internet Explorer, Windows, Microsoft Office, middleware, antivirus, and hardware upgrades; laptop and server-software refresh; virtual test environments; and call-center enhancement. Scope included 10,000+ client PCs and 400+ servers.
8. **2010–2011**: Application Project Manager through Network Information Center on a JIEM education-platform project.
9. **2009–2010**: Investor and Co-founder of Study Buddy, a spaced-repetition learning venture.
10. **2004–2009**: Bridge System Engineer at Hitachi Construction Machinery — AS/400, depot systems, compliance, integration, support, and offshore coordination.
11. **January–September 2003**: Lathe operations at Asano Taiko in Ishikawa. **September 2003–2004**: Programming work for Com-One KK on assignment to the Higashi-Matsuyama City Office in Saitama; the ending month in 2004 is not known.
12. **1995–2003**: Part-time and freelance technical work while studying.

## Scale
- 10,000+ client PCs and 400+ servers in AXA infrastructure programs
- Teams of 6-10 members, multi-region (Japan, EMEA, NA)
- 500-seat office move delivered
- Approximately 200 contributors across the full SDLC in the Manulife mainframe program
- 150 AIG optimization targets; 60% reduction in infrastructure costs

## Projects and delivery programs
1. **Kenkoumon 健康モン** — Paused doctor-visit transcription and structured patient-summary concept.
2. **Keirimon 経理モン** — Mascot shared by JTES and Dazbeez Receipts; it is not a standalone product.
3. **Bountymon (Kosa)** (bountymon.com) — Pilot bug-bounty and gamified task platform with test users.
4. **JTES (Japanese Tax Expert System)** — In development. RAG-based tax workflow with citation grounding over NTA and e-Gov sources.
5. **Enterprise AI Enablement — Monitoring, BAU Transition & PM Second Brain** — Production AI monitoring creates automation, analyzes alerts, and creates incidents across 60 applications with URL/synthetic monitoring, centralized logging, and Rapid Recovery procedures. The pilot PM Second Brain parses Microsoft and Atlassian updates, applies an eight-field delivery taxonomy, presents a React/Quartz dashboard, drafts a human-reviewed weekly status report, and shares the corpus through Confluence and SharePoint.
6. **Dazbeez Receipts** — Production receipt-classification, matching, and reconciliation system with users. Python, OCR, Rules + ML.
7. **Enterprise Data Consolidation & Governance** — AIG Business Partners consolidation from 45 Japanese source systems into a common global data model, supported by architecture, design, security, and governance workflows.
8. **Legacy Mainframe Migration & Application Infrastructure** — Ownership of Manulife's active-policy migration stream in an approximately 200-person full-SDLC program, followed by AD/OS standardization, Hong Kong-to-Japan system migration, monitoring, and automation.
9. **Infrastructure Scale & Merger Enablement** — AXA infrastructure transformation across 10,000+ clients and 400+ servers, plus AIG PEGA, on-site cutover, and 150-target optimization work that helped facilitate a 60% infrastructure-cost reduction.
10. **GenAI Enablement & Change Leadership** — Cross-functional delivery for enterprise AI transformation. Governance frameworks, stakeholder alignment.
11. **Application & Integration Delivery** — Hybrid local/offshore teams, web apps, system integrations, strict bilingual deadlines. AS/400, WMS, ISO9000/SOX compliance.

## The -mon Family
Companion agents in the kinokoholic ecosystem, each doing one thing well:
- **Kinokomon** 🦞 — Orchestrator, personal AI assistant
- **Bountymon (Kosa)** — Pilot bug-bounty and gamified task platform with test users
- **Keirimon** — Mascot for JTES and Dazbeez Receipts, not a standalone product
- **Kenkoumon** — Paused doctor-visit transcription and summary concept
- **Keibamon** — Pilot horse-racing data and ML platform with test users
- **Kanrimon** — Pilot condominium-management copilot

## Current Product Status
- Dazbeez Receipts: Production, with users
- Keibamon: Pilot, with test users
- Bountymon (Kosa): Pilot, with test users
- JTES: In development
- Kanrimon: Pilot
- Kenkoumon: Paused
- Keirimon: Mascot for JTES and Dazbeez Receipts

## Tone & Style
- Direct, candid, no padding. Say what you think.
- Concise — bullet points over paragraphs
- When asked "what would you do differently", give a real answer with specifics
- When asked about tradeoffs, explain both sides and what David chose and why
- Link to specific projects and evidence when relevant
- It's OK to say "I don't have that detail" rather than making something up
- Never fabricate projects, metrics, or timeline details not in this prompt`;

// ── In-memory rate limiter ───────────────────────────────────────────────────
// Per-isolate (Cloudflare may run several), so the effective limit is
// maxPerHour × isolate_count. For strict enforcement use Durable Objects / KV.
const rateMap = new Map();
const RATE_MAP_MAX_ENTRIES = 10_000;

export function isRateLimited(ip, maxPerHour) {
  const now = Date.now();
  const windowMs = 3600_000;

  // Opportunistic eviction once the map gets large
  if (rateMap.size > RATE_MAP_MAX_ENTRIES) {
    for (const [key, rec] of rateMap) {
      if (now - rec.start > windowMs) rateMap.delete(key);
    }
  }

  const record = rateMap.get(ip);
  if (!record || now - record.start > windowMs) {
    rateMap.set(ip, { start: now, count: 1 });
    return false;
  }
  record.count++;
  return record.count > maxPerHour;
}

// Test helper — not used at runtime.
export function _resetRateMap() {
  rateMap.clear();
}

// ── CORS helpers ─────────────────────────────────────────────────────────────
const DEFAULT_ALLOWED_ORIGIN = 'https://kinokoholic.com';
const DEFAULT_MAX_MESSAGES = 50;
const DEFAULT_MAX_MESSAGE_CHARS = 4000;
const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_RATE_LIMIT_PER_HOUR = 30;

export function parseAllowedOrigins(value) {
  return String(value || DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(requestOrigin, allowedOrigins) {
  if (!requestOrigin) return true;
  return allowedOrigins.includes(requestOrigin);
}

function responseOrigin(requestOrigin, allowedOrigins) {
  return requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] || DEFAULT_ALLOWED_ORIGIN;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function jsonResponse(payload, status, origin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isJsonContentType(value) {
  return /^application\/json(?:\s*;|$)/i.test(value || '');
}

// ── Request validation ───────────────────────────────────────────────────────
export function validateRequest(body, maxMessages, maxMessageChars = DEFAULT_MAX_MESSAGE_CHARS) {
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, status: 400, error: 'messages array is required and must not be empty' };
  }
  if (body.messages.length > maxMessages) {
    return { ok: false, status: 400, error: `too many messages (max ${maxMessages})` };
  }
  for (let i = 0; i < body.messages.length; i++) {
    const msg = body.messages[i];
    if (typeof msg.role !== 'string' || typeof msg.content !== 'string') {
      return { ok: false, status: 400, error: `message[${i}] must have string role and content` };
    }
    if (msg.content.trim().length === 0) {
      return { ok: false, status: 400, error: `message[${i}].content must not be empty` };
    }
    if (msg.content.length > maxMessageChars) {
      return { ok: false, status: 413, error: `message[${i}].content is too long (max ${maxMessageChars} chars)` };
    }
    if (!['user', 'assistant'].includes(msg.role)) {
      return { ok: false, status: 400, error: `message[${i}].role must be "user" or "assistant"` };
    }
  }
  if (body.messages[body.messages.length - 1].role !== 'user') {
    return { ok: false, status: 400, error: 'latest message must be from the user' };
  }
  return { ok: true };
}

// ── SSE parsing ──────────────────────────────────────────────────────────────
// Exported for unit tests. Accepts a decoded string chunk, returns text tokens.
export function parseSSEChunk(chunk) {
  const tokens = [];
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) continue;
    const data = trimmed.slice(6);
    if (!data || data === '[DONE]') continue;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text != null) {
        tokens.push(parsed.delta.text);
      }
    } catch { /* skip malformed */ }
  }
  return tokens;
}

// ── Stream transformer: Anthropic SSE → client chunks ────────────────────────
function createChunkTransformer() {
  let buffer = '';
  return new TransformStream({
    transform(chunk, controller) {
      // chunk is already a decoded string (TextDecoderStream runs before this)
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const token of parseSSEChunk(lines.join('\n') + '\n')) {
        const payload = JSON.stringify({ text: token });
        controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
      }
    },
    flush(controller) {
      if (buffer.trim()) controller.enqueue(new TextEncoder().encode(buffer));
    },
  });
}

// ── Available Anthropic models ───────────────────────────────────────────────
// Selected via the MODEL env var (defaults to 'sonnet'). Add new models here.
export const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};
const DEFAULT_MODEL_KEY = 'sonnet';

export function resolveModel(env) {
  const key = (env.MODEL || DEFAULT_MODEL_KEY).toLowerCase();
  return MODELS[key] || MODELS[DEFAULT_MODEL_KEY];
}

export function buildCacheControl(env) {
  if (String(env.ENABLE_PROMPT_CACHE || '').toLowerCase() === 'false') return null;
  const ttl = String(env.PROMPT_CACHE_TTL || '5m').toLowerCase();
  if (ttl === '1h') return { type: 'ephemeral', ttl: '1h' };
  return { type: 'ephemeral' };
}

export function cacheStatusHeader(env) {
  const cacheControl = buildCacheControl(env);
  if (!cacheControl) return 'disabled';
  return cacheControl.ttl ? `enabled; ttl=${cacheControl.ttl}` : 'enabled; ttl=5m';
}

export function buildAnthropicPayload(env, messages) {
  const payload = {
    model: resolveModel(env),
    max_tokens: parsePositiveInt(env.MAX_OUTPUT_TOKENS, 1024),
    system: SYSTEM_PROMPT,
    messages,
    stream: true,
  };
  const cacheControl = buildCacheControl(env);
  if (cacheControl) payload.cache_control = cacheControl;
  return payload;
}

async function readJsonBody(request, maxBodyBytes) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBodyBytes) {
    return { ok: false, status: 413, error: `request body is too large (max ${maxBodyBytes} bytes)` };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBodyBytes) {
    return { ok: false, status: 413, error: `request body is too large (max ${maxBodyBytes} bytes)` };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: 'invalid JSON body' };
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN);
    const requestOrigin = request.headers.get('Origin');
    const origin = responseOrigin(requestOrigin, allowedOrigins);
    const maxMsg = parsePositiveInt(env.MAX_MESSAGES, DEFAULT_MAX_MESSAGES);
    const maxMessageChars = parsePositiveInt(env.MAX_MESSAGE_CHARS, DEFAULT_MAX_MESSAGE_CHARS);
    const maxBodyBytes = parsePositiveInt(env.MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES);
    const rateLimit = parsePositiveInt(env.RATE_LIMIT_PER_HOUR, DEFAULT_RATE_LIMIT_PER_HOUR);

    if (url.pathname !== '/api/chat') {
      return jsonResponse({ error: 'not found' }, 404, origin);
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      if (!isOriginAllowed(requestOrigin, allowedOrigins)) {
        return jsonResponse({ error: 'origin not allowed' }, 403, origin);
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!isOriginAllowed(requestOrigin, allowedOrigins)) {
      return jsonResponse({ error: 'origin not allowed' }, 403, origin);
    }

    // Only POST allowed
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method not allowed' }, 405, origin);
    }

    if (!isJsonContentType(request.headers.get('Content-Type'))) {
      return jsonResponse({ error: 'content-type must be application/json' }, 415, origin);
    }

    // Rate limit by IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(clientIP, rateLimit)) {
      return jsonResponse({ error: 'rate limited - try again later' }, 429, origin);
    }

    // Parse body
    const parsedBody = await readJsonBody(request, maxBodyBytes);
    if (!parsedBody.ok) {
      return jsonResponse({ error: parsedBody.error }, parsedBody.status, origin);
    }

    const validation = validateRequest(parsedBody.body, maxMsg, maxMessageChars);
    if (!validation.ok) {
      return jsonResponse({ error: validation.error }, validation.status, origin);
    }

    // Check Anthropic key
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'service not configured' }, 500, origin);
    }

    // Call Anthropic streaming API
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(buildAnthropicPayload(env, parsedBody.body.messages)),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`Anthropic API error ${response.status}: ${errBody}`);
        return jsonResponse({ error: `upstream error (${response.status})` }, 502, origin);
      }

      if (!response.body) {
        return jsonResponse({ error: 'upstream response was empty' }, 502, origin);
      }

      // Stream Anthropic SSE through our transformer to the client.
      // TextDecoderStream converts Uint8Array chunks → strings before parsing.
      const { readable, writable } = new TransformStream();
      response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(createChunkTransformer())
        .pipeTo(writable)
        .catch((err) => console.error('Stream pipe error:', err));

      return new Response(readable, {
        status: 200,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Prompt-Cache': cacheStatusHeader(env),
        },
      });
    } catch (err) {
      console.error('Worker fetch error:', err);
      return jsonResponse({ error: 'internal server error' }, 500, origin);
    }
  },
};
