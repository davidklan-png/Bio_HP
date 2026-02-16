import { analyzeJobDescription, parseAndValidateProfile } from './src/analysis.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profile = parseAndValidateProfile(JSON.parse(fs.readFileSync(path.join(__dirname, '../shared/profile.json'), 'utf-8')));

const jd = `Position: Senior Software Engineer
Company: E-commerce Platform
Location: Remote

Responsibilities:
- Build and maintain web applications
- Implement REST APIs and microservices
- Optimize database performance
- Code reviews and technical leadership

Requirements:
- 5+ years Java or Go experience
- Strong SQL and database skills
- Microservices architecture experience
- CI/CD pipeline knowledge

Nice to have:
- Kubernetes and Docker experience
- Cloud platform experience (AWS, GCP)`;

console.log('Testing TC011: Pure Software Engineering');
const result = analyzeJobDescription(jd, profile, 'TC011_DEBUG');
console.log('Score:', result.score, '(Expected: 20-40)');
console.log('Confidence:', result.confidence, '(Expected: Low)');
console.log('Risk flags:', result.risk_flags);
console.log('\nRubric breakdown:');
result.rubric_breakdown.forEach(r => console.log(`  ${r.category}: ${r.score}`));
console.log('\nStrengths:', result.strengths.map(s => s.area));
console.log('\nGaps:', result.gaps.map(g => `${g.area}: ${g.why_it_matters}`));
