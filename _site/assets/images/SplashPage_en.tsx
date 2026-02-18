/**
 * JTES Splash Page (Landing / Marketing) - ENGLISH VERSION
 *
 * Public-facing landing page — no authentication required.
 * English version with Japanese tax/accounting terms preserved.
 *
 * NOTE: Japanese tax and accounting terms are kept in original form
 * because English translations could be subjective or lose precision.
 * This system is based on Japanese official data.
 */

import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Stack,
  Chip,
} from '@mui/material';
import {
  QuestionAnswer as AdvisorIcon,
  Radar as MonitorIcon,
  CompareArrows as CompareIcon,
  Hub as PlatformIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircleOutline as CheckIcon,
  Search as SearchIcon,
  Psychology as AiIcon,
  FormatQuote as CiteIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { PublicPageHeader } from '../components/common/PublicPageHeader';
import { useScrollAnimationStyles } from '../hooks/useScrollAnimation';
import { getCTAHandler, CTALocations } from '../lib/analytics';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const products = [
  {
    icon: <AdvisorIcon sx={{ fontSize: 40 }} />,
    title: 'Tax AI Advisor',
    subtitle: '税務AIアドバイザー',
    desc: 'Simply ask tax questions in Japanese or English. AI provides immediate, accurate answers with citations from official NTA and e-Gov data.',
    features: [
      'Automatic classification across 10 tax domains',
      'Cited answers (Fail-closed design)',
      'Temporal queries (search past laws and regulations)',
    ],
    audience: 'For all users',
  },
  {
    icon: <MonitorIcon sx={{ fontSize: 40 }} />,
    title: 'Regulatory Monitoring',
    subtitle: '法令モニタリング',
    desc: '24/7 automated monitoring of NTA websites. Detects tax law amendments and circular changes, providing importance-ranked alerts with complete change history.',
    features: [
      'Automated NTA site crawling (12-24 hour intervals)',
      'Visualized change differentials',
      'Importance-classified alerts',
    ],
    audience: 'For tax accountants and CPAs',
  },
  {
    icon: <CompareIcon sx={{ fontSize: 40 }} />,
    title: 'Legal Research & Comparison',
    subtitle: '法令比較リサーチ',
    desc: 'Generate side-by-side comparison tables of old and new tax laws with one click. Timeline view of amendment history and hybrid search respecting article structure.',
    features: [
      'Side-by-side comparison tables (新旧対照表)',
      'Amendment history timeline',
      'Hybrid search (semantic + keyword)',
    ],
    audience: 'For tax accountants and legal departments',
  },
  {
    icon: <PlatformIcon sx={{ fontSize: 40 }} />,
    title: 'Multi-Tenant Platform',
    subtitle: 'マルチテナントプラットフォーム',
    desc: 'Complete data separation per client. Safe team-wide usage with standard analytics and role-based access control.',
    features: [
      'Complete tenant data isolation',
      'Admin dashboard (17 screens)',
      'Role-based access control',
    ],
    audience: 'For accounting firms and SMBs',
  },
];

const audienceTabs = [
  {
    label: 'Sole Proprietors',
    labelJp: '個人事業主',
    headline: 'From tax returns to invoicing — you\'re not alone.',
    headlineJp: '確定申告も、インボイスも。一人で悩まない。',
    points: [
      'Instant explanations of 青色申告 vs 白色申告',
      'Cited answers on invoice system (インボイス制度) compliance',
      'Support for expense deduction decisions',
      '24/7 availability during tax season',
    ],
  },
  {
    label: 'Tax Professionals',
    labelJp: '税理士・会計士',
    headline: 'Automate regulatory tracking. Cut research time.',
    headlineJp: '法改正の追跡を自動化。リサーチ時間を削減。',
    points: [
      'Automated monitoring and alerts for NTA website changes',
      'One-click generation of law comparison tables (新旧対照表)',
      'Secure separated management of multiple client data',
      'Query analysis to understand client interests',
    ],
  },
  {
    label: 'SMBs',
    labelJp: '中小企業',
    headline: 'A tax AI platform built for your whole team.',
    headlineJp: 'チーム全体で使える税務AIプラットフォーム。',
    points: [
      'Comprehensive coverage: 法人税, 消費税, 源泉徴収',
      'Shared usage across entire accounting team',
      'Role-based access permissions for secure operations',
      'Usage analytics to visualize internal tax issues',
    ],
  },
];

const faqItems = [
  {
    q: 'What is JTES?',
    qJp: 'JTESとは何ですか？',
    a: 'JTES is an AI-powered search and analysis system specialized for Japanese tax law. It provides accurate answers with citations based on official data from the National Tax Agency (NTA/国税庁) and e-Gov.',
  },
  {
    q: 'How is answer accuracy ensured?',
    qJp: '回答の正確性はどのように担保されていますか？',
    a: 'Every answer includes citations from official documents. If citation verification fails, the system withholds the response (Fail-closed design). We only provide grounded answers, not speculation.',
  },
  {
    q: 'What tax domains are covered?',
    qJp: 'どの税務分野に対応していますか？',
    a: 'Covers 10 domains: 消費税, 所得税, 法人税, 源泉徴収, 地方税, 相続税, 贈与税, 印紙税, 登録免許税, and 関税.',
  },
  {
    q: 'Can I ask questions in English?',
    qJp: '英語でも質問できますか？',
    a: 'Yes, you can ask questions in both Japanese and English. However, since original tax laws are in Japanese, Japanese queries may yield higher precision.',
  },
  {
    q: 'How is data security handled?',
    qJp: 'データのセキュリティは？',
    a: 'Enterprise-grade security through OAuth/OIDC authentication, role-based access control, rate limiting, input validation, and tenant data separation.',
  },
  {
    q: 'What can I do on the free plan?',
    qJp: '無料プランで何ができますか？',
    a: '5 AI queries per day (3 tax domains) with cited answers. Consider paid plans for more features.',
  },
];

const pricingTiers = [
  {
    name: 'Free',
    nameJp: '無料',
    price: '¥0',
    period: '',
    features: [
      '5 AI queries/day',
      '3 tax domains',
      'Cited answers',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Starter',
    nameJp: 'スターター',
    price: '¥3,980',
    period: '/month',
    features: [
      '50 AI queries/day',
      'All 10 tax domains',
      'Temporal queries',
      'Up to 3 users',
    ],
    cta: 'Choose Starter',
    highlighted: false,
  },
  {
    name: 'Professional',
    nameJp: 'プロフェッショナル',
    price: '¥14,800',
    period: '/month',
    features: [
      'Unlimited AI queries',
      '法令モニタリング',
      '法令比較リサーチ',
      'Up to 10 users',
      'API access',
    ],
    cta: 'Choose Professional',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    nameJp: 'エンタープライズ',
    price: 'Contact Us',
    period: '',
    features: [
      'All features',
      'Multi-tenant separation',
      'Admin dashboard (17 screens)',
      'Unlimited users',
      'Dedicated support',
    ],
    cta: 'Contact Us',
    highlighted: false,
  },
];

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function HeroSection() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        pt: { xs: 10, md: 16 },
        pb: { xs: 8, md: 14 },
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle gradient background effect */}
      <Box
        sx={{
          position: 'absolute',
          top: '-30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, rgba(244,114,182,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Container maxWidth="md" sx={{ position: 'relative' }}>
        <Typography
          variant="h1"
          sx={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700,
            fontSize: { xs: '2rem', md: '3rem' },
            lineHeight: 1.4,
            mb: 1,
          }}
        >
          Trusted Answers for Japanese Tax Law
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: { xs: '1rem', md: '1.25rem' },
            mb: 4,
            fontFamily: '"Noto Sans JP", sans-serif',
          }}
        >
          日本の税法に、確かな答えを。
        </Typography>

        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: { xs: '0.9rem', md: '1.05rem' },
            maxWidth: 600,
            mx: 'auto',
            mb: 1,
            lineHeight: 1.8,
          }}
        >
          AI-powered analysis of official NTA and e-Gov sources.
          <br />
          Every answer backed by verifiable citations.
        </Typography>
        <Typography
          sx={{
            color: 'text.disabled',
            fontSize: '0.875rem',
            maxWidth: 600,
            mx: 'auto',
            mb: 5,
            fontFamily: '"Noto Sans JP", sans-serif',
          }}
        >
          国税庁・e-Gov の公式データをAIが分析。
          <br />
          出典付きで、正確な税務情報をお届けします。
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            size="large"
            endIcon={<ArrowForwardIcon />}
            onClick={() => {
              // M67-6: Track CTA click
              getCTAHandler('hero_signup_en', 'Get Started Free', CTALocations.HERO, '/login')();
              navigate('/login');
            }}
            sx={{ px: 4, py: 1.5, fontSize: '1rem' }}
          >
            Get Started Free
          </Button>
          <Button
            variant="outlined"
            size="large"
            href="#products"
            onClick={() => {
              // M67-6: Track CTA click
              getCTAHandler('hero_learn_more_en', 'Learn More', CTALocations.HERO, '#products')();
            }}
            sx={{ px: 4, py: 1.5, fontSize: '1rem' }}
          >
            Learn More
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

function TrustBar() {
  // M67-3: Scroll animation for trust bar
  // M67-7: Accessibility - added semantic landmarks
  const { ref, style } = useScrollAnimationStyles({ preset: 'fadeUp', duration: 500, delay: 100 });

  return (
    <Box
      ref={ref}
      component="section"
      aria-label="Trusted sources / 信頼できる情報源"
      sx={{ py: 4, bgcolor: 'rgba(17, 24, 39, 0.5)' }}
      style={style}
    >
      <Container maxWidth="md">
        <Typography
          variant="overline"
          sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mb: 2, letterSpacing: '0.15em' }}
        >
          Built on official government sources / 公式データに基づく信頼性
        </Typography>
        <Stack
          direction="row"
          spacing={4}
          justifyContent="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Chip label="国税庁 NTA" variant="outlined" sx={{ borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }} />
          <Chip label="e-Gov 法令検索" variant="outlined" sx={{ borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }} />
          <Chip label="税務知識DB" variant="outlined" sx={{ borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }} />
        </Stack>
      </Container>
    </Box>
  );
}

function ProductsSection() {
  // M67-3: Scroll animation for products section
  // M67-7: Accessibility - added semantic landmarks and ARIA
  const { ref, style } = useScrollAnimationStyles({ preset: 'fadeUp', duration: 600 });

  return (
    <Box ref={ref} component="section" id="products" aria-labelledby="products-heading" sx={{ py: { xs: 8, md: 12 } }} style={style}>
      <Container maxWidth="lg">
        <Typography id="products-heading" variant="h2" sx={{ textAlign: 'center', mb: 1 }}>
          Four Solutions to Transform Your Tax Workflow
        </Typography>
        <Typography
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            fontFamily: '"Noto Sans JP", sans-serif',
            mb: 6,
          }}
        >
          4つのソリューション
        </Typography>

        <Grid container spacing={3} role="list">
          {products.map((p, index) => (
            <Grid key={p.title} role="listitem" size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card
                aria-labelledby={`product-en-${index}-title`}
                aria-describedby={`product-en-${index}-desc`}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: 'rgba(244,114,182,0.3)',
                    boxShadow: '0 0 30px rgba(244,114,182,0.1)',
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Box sx={{ color: 'primary.main', mb: 2 }} aria-hidden="true">{p.icon}</Box>
                  <Typography id={`product-en-${index}-title`} variant="h5" sx={{ mb: 0.5 }}>
                    {p.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.disabled', fontFamily: '"Noto Sans JP", sans-serif', display: 'block', mb: 2 }}
                  >
                    {p.subtitle}
                  </Typography>
                  <Typography id={`product-en-${index}-desc`} variant="body2" sx={{ color: 'text.secondary', mb: 2, lineHeight: 1.8 }}>
                    {p.desc}
                  </Typography>
                  <Stack spacing={1}>
                    {p.features.map((f) => (
                      <Stack key={f} direction="row" spacing={1} alignItems="flex-start">
                        <CheckIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.3 }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          {f}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Chip
                    label={p.audience}
                    size="small"
                    sx={{ mt: 2, fontSize: '0.7rem', bgcolor: 'rgba(244,114,182,0.1)', color: '#f472b6' }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

function HowItWorks() {
  // M67-3: Scroll animation for how it works section
  const { ref, style } = useScrollAnimationStyles({ preset: 'fadeUp', duration: 600 });

  const steps = [
    { icon: <SearchIcon sx={{ fontSize: 36 }} />, en: 'Ask your question', jp: '質問する', desc: 'Enter your tax question in Japanese or English' },
    { icon: <AiIcon sx={{ fontSize: 36 }} />, en: 'AI analyzes', jp: 'AI分析', desc: 'Searches relevant laws across 10 tax domains' },
    { icon: <CiteIcon sx={{ fontSize: 36 }} />, en: 'Cited answer', jp: '出典付き回答', desc: 'Provides answers with official document citations' },
  ];

  return (
    <Box ref={ref} sx={{ py: { xs: 8, md: 12 }, bgcolor: 'rgba(17, 24, 39, 0.5)' }} style={style}>
      <Container maxWidth="md">
        <Typography variant="h2" sx={{ textAlign: 'center', mb: 1 }}>
          Simple to Use
        </Typography>
        <Typography
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            fontFamily: '"Noto Sans JP", sans-serif',
            mb: 6,
          }}
        >
          使い方はシンプル
        </Typography>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={4}
          alignItems="center"
          justifyContent="center"
        >
          {steps.map((s, i) => (
            <Box key={s.en} sx={{ textAlign: 'center', flex: 1 }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'rgba(244,114,182,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  color: 'primary.main',
                }}
              >
                {s.icon}
              </Box>
              <Typography variant="overline" sx={{ color: 'text.disabled' }}>
                Step {i + 1}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.5 }}>
                {s.en}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: '"Noto Sans JP", sans-serif', display: 'block' }}>
                {s.jp}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                {s.desc}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}

function AudienceSection() {
  const [tab, setTab] = useState(0);
  const current = audienceTabs[tab];
  // M67-3: Scroll animation for audience section
  const { ref, style } = useScrollAnimationStyles({ preset: 'fadeUp', duration: 600 });

  return (
    <Box ref={ref} sx={{ py: { xs: 8, md: 12 } }} style={style}>
      <Container maxWidth="md">
        <Typography variant="h2" sx={{ textAlign: 'center', mb: 1 }}>
          Tailored for Your Role
        </Typography>
        <Typography
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            fontFamily: '"Noto Sans JP", sans-serif',
            mb: 4,
          }}
        >
          あなたに合った使い方
        </Typography>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          centered
          sx={{ mb: 4 }}
        >
          {audienceTabs.map((t) => (
            <Tab key={t.label} label={t.label} />
          ))}
        </Tabs>

        <Card sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h4" sx={{ mb: 0.5 }}>
            {current.headline}
          </Typography>
          <Typography
            sx={{
              color: 'text.disabled',
              fontSize: '0.9rem',
              mb: 3,
              fontFamily: '"Noto Sans JP", sans-serif',
            }}
          >
            {current.headlineJp}
          </Typography>
          <Stack spacing={1.5}>
            {current.points.map((p) => (
              <Stack key={p} direction="row" spacing={1.5} alignItems="flex-start">
                <CheckIcon sx={{ fontSize: 18, color: 'success.main', mt: 0.2 }} />
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  {p}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

function PricingSection() {
  // M67-3: Scroll animation for pricing section
  // M67-7: Accessibility - added semantic landmarks and ARIA
  const { ref, style } = useScrollAnimationStyles({ preset: 'fadeUp', duration: 600 });

  return (
    <Box ref={ref} component="section" id="pricing" aria-labelledby="pricing-heading" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'rgba(17, 24, 39, 0.5)' }} style={style}>
      <Container maxWidth="lg">
        <Typography id="pricing-heading" variant="h2" sx={{ textAlign: 'center', mb: 1 }}>
          Pricing Plans
        </Typography>
        <Typography
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            fontFamily: '"Noto Sans JP", sans-serif',
            mb: 6,
          }}
        >
          料金プラン
        </Typography>

        <Grid container spacing={3} justifyContent="center" role="list" aria-label="Pricing plans">
          {pricingTiers.map((tier) => (
            <Grid key={tier.name} role="listitem" size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                aria-labelledby={`${tier.name}-plan-title`}
                aria-describedby={`${tier.name}-plan-price`}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: tier.highlighted
                    ? '1px solid rgba(244,114,182,0.4)'
                    : undefined,
                  boxShadow: tier.highlighted
                    ? '0 0 30px rgba(244,114,182,0.15)'
                    : undefined,
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  {tier.highlighted && (
                    <Chip
                      label="Recommended"
                      size="small"
                      color="primary"
                      sx={{ mb: 2, fontSize: '0.7rem' }}
                    />
                  )}
                  <Typography id={`${tier.name}-plan-title`} variant="overline" sx={{ color: 'text.disabled', fontFamily: '"Noto Sans JP", sans-serif' }}>
                    {tier.nameJp}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {tier.name}
                  </Typography>
                  <Box id={`${tier.name}-plan-price`} sx={{ my: 2 }} role="text" aria-label={`${tier.name} plan: ${tier.price}${tier.period}`}>
                    <Typography
                      variant="h3"
                      component="span"
                    >
                      {tier.price}
                    </Typography>
                    {tier.period && (
                      <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                        {tier.period}
                      </Typography>
                    )}
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    {tier.features.map((f) => (
                      <Stack key={f} direction="row" spacing={1} alignItems="flex-start">
                        <CheckIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.3 }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          {f}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
                <Box sx={{ p: 2, pt: 0 }}>
                  <Button
                    fullWidth
                    variant={tier.highlighted ? 'contained' : 'outlined'}
                    color={tier.highlighted ? 'primary' : undefined}
                    onClick={() => {
                      // M67-6: Track pricing CTA click
                      getCTAHandler(`pricing_${tier.name}`, tier.cta, CTALocations.PRICING, '/login')();
                    }}
                  >
                    {tier.cta}
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

function FAQSection() {
  // M67-3: Scroll animation for FAQ section
  // M67-7: Accessibility - added semantic landmarks
  const { ref, style } = useScrollAnimationStyles({ preset: 'fadeUp', duration: 600 });

  return (
    <Box ref={ref} component="section" id="faq" aria-labelledby="faq-heading" sx={{ py: { xs: 8, md: 12 } }} style={style}>
      <Container maxWidth="md">
        <Typography id="faq-heading" variant="h2" sx={{ textAlign: 'center', mb: 1 }}>
          Frequently Asked Questions
        </Typography>
        <Typography
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            fontFamily: '"Noto Sans JP", sans-serif',
            mb: 4,
          }}
        >
          よくある質問
        </Typography>

        {faqItems.map((item) => (
          <Accordion key={item.q} sx={{ mb: 1 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`faq-en-${item.q.replace(/\s+/g, '-')}-content`}
              id={`faq-en-${item.q.replace(/\s+/g, '-')}-header`}
            >
              <Box>
                <Typography sx={{ fontWeight: 500 }}>
                  {item.q}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: '"Noto Sans JP", sans-serif' }}>
                  {item.qJp}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails id={`faq-en-${item.q.replace(/\s+/g, '-')}-content`} role="region" aria-labelledby={`faq-en-${item.q.replace(/\s+/g, '-')}-header`}>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
                {item.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Container>
    </Box>
  );
}

function FinalCTA() {
  const navigate = useNavigate();
  // M67-3: Scroll animation for final CTA
  const { ref, style } = useScrollAnimationStyles({ preset: 'scaleIn', duration: 600 });

  return (
    <Box
      ref={ref}
      sx={{
        py: { xs: 8, md: 12 },
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
      style={style}
    >
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: '100%',
          background: 'radial-gradient(ellipse at center bottom, rgba(251,191,36,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Container maxWidth="sm" sx={{ position: 'relative' }}>
        <Typography variant="h3" sx={{ mb: 1 }}>
          Making Japanese Tax Simpler
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            fontFamily: '"Noto Sans JP", sans-serif',
            mb: 1,
          }}
        >
          日本の税務をもっとシンプルに
        </Typography>
        <Typography sx={{ color: 'text.disabled', fontSize: '0.85rem', mb: 4 }}>
          Generic AI guesses. JTES cites.
          <br />
          <Box component="span" sx={{ fontFamily: '"Noto Sans JP", sans-serif' }}>
            一般的なAIは推測します。JTESは引用します。
          </Box>
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            size="large"
            endIcon={<ArrowForwardIcon />}
            onClick={() => {
              // M67-6: Track final CTA click
              getCTAHandler('final_signup_en', 'Sign Up Free', CTALocations.FINAL_CTA, '/login')();
              navigate('/login');
            }}
            sx={{ px: 5, py: 1.5, fontSize: '1rem' }}
          >
            Sign Up Free
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

function SplashFooter() {
  return (
    <Box
      component="footer"
      sx={{
        py: 4,
        borderTop: '1px solid rgba(148, 163, 184, 0.1)',
        bgcolor: 'rgba(17, 24, 39, 0.5)',
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              background: 'linear-gradient(135deg, #f472b6, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            JTES
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Japanese Tax Expert System
          </Typography>
          <Stack direction="row" spacing={3} alignItems="center">
            <Typography
              component="a"
              href="#products"
              sx={{ color: 'text.disabled', textDecoration: 'none', fontSize: '0.75rem', '&:hover': { color: 'text.secondary' } }}
            >
              Products
            </Typography>
            <Typography
              component="a"
              href="#pricing"
              sx={{ color: 'text.disabled', textDecoration: 'none', fontSize: '0.75rem', '&:hover': { color: 'text.secondary' } }}
            >
              Pricing
            </Typography>
            <Typography
              component="a"
              href="#faq"
              sx={{ color: 'text.disabled', textDecoration: 'none', fontSize: '0.75rem', '&:hover': { color: 'text.secondary' } }}
            >
              FAQ
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main SplashPage (English)
// ---------------------------------------------------------------------------

export function SplashPageEn() {
  return (
    <Box sx={{ bgcolor: 'background.default', color: 'text.primary', minHeight: '100vh' }}>
      <PublicPageHeader titleJp="JTES" titleEn="Japanese Tax Expert System" />
      <HeroSection />
      <TrustBar />
      <ProductsSection />
      <HowItWorks />
      <AudienceSection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <SplashFooter />
    </Box>
  );
}
