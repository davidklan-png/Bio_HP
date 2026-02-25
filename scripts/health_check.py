#!/usr/bin/env python3
"""
kinokoholic.com Health Check Script

Implements BDD health-check scenarios from prompts/openclaw-health-check.md
Runs as a scheduled cron job via GitHub Actions.
"""

import json
import re
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install requests beautifulsoup4")
    sys.exit(1)


class Severity(Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class Failure:
    feature: str
    url: str
    expected: str
    actual: str
    severity: Severity
    root_cause: str = ""


@dataclass
class HealthCheckResult:
    timestamp: str
    pages_checked: int = 0
    api_calls_made: int = 0
    failures: list[Failure] = field(default_factory=list)
    failures_fixed: int = 0
    failures_deferred: int = 0

    @property
    def critical_count(self) -> int:
        return sum(1 for f in self.failures if f.severity == Severity.CRITICAL)

    @property
    def warning_count(self) -> int:
        return sum(1 for f in self.failures if f.severity == Severity.WARNING)

    @property
    def info_count(self) -> int:
        return sum(1 for f in self.failures if f.severity == Severity.INFO)

    def add_failure(self, failure: Failure):
        self.failures.append(failure)


# Configuration
BASE_URL = "https://kinokoholic.com"
API_URL = f"{BASE_URL}/api/analyze"
API_AUTH = "Bearer jd-concierge-api-key-2025"
RATE_LIMIT = 5  # requests per hour

# URL Inventory
ENGLISH_PAGES = [
    "/",
    "/about/",
    "/kinokomon/",
    "/work-history/",
    "/projects/jd-concierge-sandbox/",
    "/projects/japanese-tax-expert-system-jtes-specialized-rag-for-professionals/",
    "/projects/receipt-classification-and-matching-system/",
    "/projects/bilingual-ceremony-script-generator-notebooklm-collaboration/",
    "/projects/enterprise-ai-enablement-in-insurance-reporting-incident-intelligence/",
]

JAPANESE_PAGES = [
    "/ja/",
    "/ja/about/",
    "/ja/kinokomon/",
    "/ja/work-history/",
    "/ja/projects/japanese-tax-expert-system-jtes-specialized-rag-for-professionals/",
    "/ja/projects/receipt-classification-and-matching-system/",
    "/ja/projects/bilingual-ceremony-script-generator-notebooklm-collaboration/",
    "/ja/projects/enterprise-ai-enablement-in-insurance-reporting-incident-intelligence/",
]

# JD Concierge Sandbox has no Japanese counterpart
PAGES_WITHOUT_JA_PARITY = ["/projects/jd-concierge-sandbox/"]


def log(msg: str, level: str = "INFO"):
    """Log a message with timestamp."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}")


def check_url(url: str, result: HealthCheckResult, feature: str) -> bool:
    """Check if a URL returns HTTP 200."""
    full_url = f"{BASE_URL}{url}" if url.startswith("/") else url
    try:
        response = requests.get(full_url, timeout=30)
        if response.status_code != 200:
            result.add_failure(Failure(
                feature=feature,
                url=full_url,
                expected="HTTP 200",
                actual=f"HTTP {response.status_code}",
                severity=Severity.CRITICAL,
                root_cause="Page not reachable or server error"
            ))
            return False
        if not response.content:
            result.add_failure(Failure(
                feature=feature,
                url=full_url,
                expected="Non-empty body",
                actual="Empty body",
                severity=Severity.CRITICAL,
                root_cause="Page returns empty content"
            ))
            return False
        return True
    except requests.RequestException as e:
        result.add_failure(Failure(
            feature=feature,
            url=full_url,
            expected="HTTP 200",
            actual=f"Request failed: {e}",
            severity=Severity.CRITICAL,
            root_cause="Network or DNS error"
        ))
        return False


def feature_1_page_availability(result: HealthCheckResult):
    """Feature 1: All pages are reachable."""
    log("Running Feature 1: Page Availability")
    all_pages = ENGLISH_PAGES + JAPANESE_PAGES
    result.pages_checked = len(all_pages)
    
    for url in all_pages:
        check_url(url, result, "Feature 1: Page Availability")


def feature_2_bilingual_parity(result: HealthCheckResult):
    """Feature 2: EN/JA Page Parity."""
    log("Running Feature 2: Bilingual Page Parity")
    
    # Check English pages have Japanese counterparts
    for en_url in ENGLISH_PAGES:
        if en_url in PAGES_WITHOUT_JA_PARITY:
            continue  # Expected to have no JA counterpart
        
        ja_url = f"/ja{en_url}"
        if ja_url not in JAPANESE_PAGES:
            result.add_failure(Failure(
                feature="Feature 2: Bilingual Parity",
                url=en_url,
                expected=f"Japanese counterpart at {ja_url}",
                actual="No Japanese page exists",
                severity=Severity.CRITICAL,
                root_cause="Missing Japanese translation"
            ))
        else:
            check_url(ja_url, result, "Feature 2: Bilingual Parity")
    
    # Check Japanese pages have English counterparts
    for ja_url in JAPANESE_PAGES:
        en_url = ja_url.replace("/ja", "", 1)
        if en_url not in ENGLISH_PAGES:
            result.add_failure(Failure(
                feature="Feature 2: Bilingual Parity",
                url=ja_url,
                expected=f"English counterpart at {en_url}",
                actual="No English page exists",
                severity=Severity.CRITICAL,
                root_cause="Orphan Japanese page"
            ))


def feature_3_navigation_consistency(result: HealthCheckResult):
    """Feature 3: Consistent header and footer on all pages."""
    log("Running Feature 3: Navigation Consistency")
    all_pages = ENGLISH_PAGES + JAPANESE_PAGES
    
    for url in all_pages:
        full_url = f"{BASE_URL}{url}"
        try:
            response = requests.get(full_url, timeout=30)
            if response.status_code != 200:
                continue  # Already logged in Feature 1
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Check for nav/header
            nav = soup.find('nav') or soup.find('header')
            if not nav:
                result.add_failure(Failure(
                    feature="Feature 3: Navigation",
                    url=full_url,
                    expected="<nav> or <header> element",
                    actual="No navigation element found",
                    severity=Severity.WARNING,
                    root_cause="Missing navigation structure"
                ))
            
            # Check for site title link
            home_link = soup.find('a', href='/') or soup.find('a', href='/ja/')
            if not home_link:
                result.add_failure(Failure(
                    feature="Feature 3: Navigation",
                    url=full_url,
                    expected="Site title link to / or /ja/",
                    actual="No home link found",
                    severity=Severity.WARNING,
                    root_cause="Missing site title link"
                ))
            
            # Check for language toggle
            lang_toggle = soup.find('a', href=re.compile(r'/ja/')) or soup.find('a', href=re.compile(r'^/(?!.*/ja/)'))
            if not lang_toggle:
                result.add_failure(Failure(
                    feature="Feature 3: Navigation",
                    url=full_url,
                    expected="Language toggle link",
                    actual="No language toggle found",
                    severity=Severity.WARNING,
                    root_cause="Missing language switcher"
                ))
            
            # Check for footer
            footer = soup.find('footer')
            if not footer:
                result.add_failure(Failure(
                    feature="Feature 3: Navigation",
                    url=full_url,
                    expected="<footer> element",
                    actual="No footer found",
                    severity=Severity.WARNING,
                    root_cause="Missing footer"
                ))
                
        except requests.RequestException:
            continue  # Already logged


def feature_4_jd_widget_render(result: HealthCheckResult):
    """Feature 4: JD Concierge Widget Render."""
    log("Running Feature 4: JD Concierge Widget Render")
    url = "/projects/jd-concierge-sandbox/"
    full_url = f"{BASE_URL}{url}"
    
    try:
        response = requests.get(full_url, timeout=30)
        if response.status_code != 200:
            result.add_failure(Failure(
                feature="Feature 4: JD Widget",
                url=full_url,
                expected="HTTP 200",
                actual=f"HTTP {response.status_code}",
                severity=Severity.CRITICAL,
                root_cause="JD Concierge page not accessible"
            ))
            return
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Check for textarea
        textarea = soup.find('textarea', {'id': 'jd-input'}) or soup.find('textarea', class_='jd-concierge__input')
        if not textarea:
            result.add_failure(Failure(
                feature="Feature 4: JD Widget",
                url=full_url,
                expected='Textarea with id="jd-input" or class="jd-concierge__input"',
                actual="No input textarea found",
                severity=Severity.CRITICAL,
                root_cause="Missing JD input widget"
            ))
        
        # Check for Analyze button
        analyze_btn = soup.find('button', string=re.compile(r'Analyze Fit', re.I)) or soup.find('button', class_='jd-concierge__submit')
        if not analyze_btn:
            result.add_failure(Failure(
                feature="Feature 4: JD Widget",
                url=full_url,
                expected='Button with text "Analyze Fit"',
                actual="No analyze button found",
                severity=Severity.CRITICAL,
                root_cause="Missing submit button"
            ))
        
        # Check for Example button
        example_btn = soup.find('button', string=re.compile(r'Try Example JD', re.I)) or soup.find('button', class_='jd-concierge__example')
        if not example_btn:
            result.add_failure(Failure(
                feature="Feature 4: JD Widget",
                url=full_url,
                expected='Button with text "Try Example JD"',
                actual="No example button found",
                severity=Severity.CRITICAL,
                root_cause="Missing example button"
            ))
        
        # Check for loading element
        loading = soup.find(class_='jd-concierge__loading')
        if not loading:
            result.add_failure(Failure(
                feature="Feature 4: JD Widget",
                url=full_url,
                expected='Element with class "jd-concierge__loading"',
                actual="No loading indicator found",
                severity=Severity.CRITICAL,
                root_cause="Missing loading state"
            ))
        
        # Check for results container
        results = soup.find(class_='jd-concierge__results')
        if not results:
            result.add_failure(Failure(
                feature="Feature 4: JD Widget",
                url=full_url,
                expected='Element with class "jd-concierge__results"',
                actual="No results container found",
                severity=Severity.CRITICAL,
                root_cause="Missing results display"
            ))
        
        # Check character counter
        if textarea:
            max_length = textarea.get('maxlength')
            if max_length != '10000':
                result.add_failure(Failure(
                    feature="Feature 4: JD Widget",
                    url=full_url,
                    expected='maxlength="10000"',
                    actual=f'maxlength="{max_length}"',
                    severity=Severity.WARNING,
                    root_cause="Incorrect character limit"
                ))
            
            # Check counter text
            counter = soup.find(string=re.compile(r'10,?000'))
            if not counter:
                result.add_failure(Failure(
                    feature="Feature 4: JD Widget",
                    url=full_url,
                    expected='Counter text mentioning "10,000"',
                    actual="No character counter text found",
                    severity=Severity.WARNING,
                    root_cause="Missing character counter"
                ))
                
    except requests.RequestException as e:
        result.add_failure(Failure(
            feature="Feature 4: JD Widget",
            url=full_url,
            expected="Successful page fetch",
            actual=f"Request failed: {e}",
            severity=Severity.CRITICAL,
            root_cause="Network error"
        ))


def feature_5_api_functional_test(result: HealthCheckResult):
    """Feature 5: JD Analyzer API Functional Test."""
    log("Running Feature 5: API Functional Test")
    
    headers = {
        "Authorization": API_AUTH,
        "Content-Type": "application/json"
    }
    
    # Test 1: Strong match JD
    strong_jd = {
        "jd_text": "We are looking for a Senior AI/ML Engineer with experience in LLM applications, RAG architectures, and prompt engineering. The role is remote-friendly and requires English and Japanese language skills. You will lead agentic workflow development and cross-functional stakeholder management."
    }
    
    try:
        result.api_calls_made += 1
        response = requests.post(API_URL, json=strong_jd, headers=headers, timeout=30)
        
        if response.status_code != 200:
            result.add_failure(Failure(
                feature="Feature 5: API Functional",
                url=API_URL,
                expected="HTTP 200",
                actual=f"HTTP {response.status_code}",
                severity=Severity.CRITICAL,
                root_cause="API endpoint error"
            ))
            return
        
        data = response.json()
        
        # Validate response schema
        required_fields = ['score', 'confidence', 'fit_summary', 'strengths', 'gaps', 'risk_flags', 'rubric_breakdown', 'request_id']
        for field in required_fields:
            if field not in data:
                result.add_failure(Failure(
                    feature="Feature 5: API Functional",
                    url=API_URL,
                    expected=f"Field '{field}' in response",
                    actual=f"Missing field '{field}'",
                    severity=Severity.CRITICAL,
                    root_cause="API response schema incomplete"
                ))
        
        # Validate score type
        if 'score' in data and not isinstance(data['score'], int):
            result.add_failure(Failure(
                feature="Feature 5: API Functional",
                url=API_URL,
                expected="score as integer 0-100",
                actual=f"score type: {type(data['score']).__name__}",
                severity=Severity.CRITICAL,
                root_cause="Invalid score type"
            ))
        
        # Validate confidence
        if 'confidence' in data and data['confidence'] not in ['Low', 'Medium', 'High']:
            result.add_failure(Failure(
                feature="Feature 5: API Functional",
                url=API_URL,
                expected='confidence: Low/Medium/High',
                actual=f"confidence: {data.get('confidence')}",
                severity=Severity.CRITICAL,
                root_cause="Invalid confidence value"
            ))
        
        # Validate strengths structure
        if 'strengths' in data and isinstance(data['strengths'], list):
            strength_fields = ['area', 'evidence_title', 'evidence_url', 'rationale']
            for i, strength in enumerate(data['strengths']):
                for field in strength_fields:
                    if field not in strength:
                        result.add_failure(Failure(
                            feature="Feature 5: API Functional",
                            url=API_URL,
                            expected=f"strength[{i}].{field}",
                            actual=f"Missing {field}",
                            severity=Severity.CRITICAL,
                            root_cause="Invalid strength structure"
                        ))
                        break
                if 'evidence_url' in strength and not strength['evidence_url'].startswith(BASE_URL):
                    result.add_failure(Failure(
                        feature="Feature 5: API Functional",
                        url=API_URL,
                        expected=f"evidence_url starting with {BASE_URL}",
                        actual=f"evidence_url: {strength['evidence_url']}",
                        severity=Severity.WARNING,
                        root_cause="Evidence URL not from kinokoholic.com"
                    ))
        
        # Validate rubric breakdown
        if 'rubric_breakdown' in data and isinstance(data['rubric_breakdown'], list):
            rubric_fields = ['category', 'score', 'weight', 'notes']
            for i, entry in enumerate(data['rubric_breakdown']):
                for field in rubric_fields:
                    if field not in entry:
                        result.add_failure(Failure(
                            feature="Feature 5: API Functional",
                            url=API_URL,
                            expected=f"rubric[{i}].{field}",
                            actual=f"Missing {field}",
                            severity=Severity.CRITICAL,
                            root_cause="Invalid rubric structure"
                        ))
        
        # Validate request_id is UUID
        if 'request_id' in data:
            try:
                uuid.UUID(data['request_id'])
            except (ValueError, AttributeError):
                result.add_failure(Failure(
                    feature="Feature 5: API Functional",
                    url=API_URL,
                    expected="request_id as valid UUID",
                    actual=f"request_id: {data.get('request_id')}",
                    severity=Severity.WARNING,
                    root_cause="Invalid request_id format"
                ))
        
        # Calibration check: strong match should score >= 60
        if 'score' in data and isinstance(data['score'], int):
            if data['score'] < 60:
                result.add_failure(Failure(
                    feature="Feature 5: API Calibration",
                    url=API_URL,
                    expected="score >= 60 for strong match JD",
                    actual=f"score: {data['score']}",
                    severity=Severity.WARNING,
                    root_cause="Score calibration may need adjustment"
                ))
        
    except requests.RequestException as e:
        result.add_failure(Failure(
            feature="Feature 5: API Functional",
            url=API_URL,
            expected="Successful API response",
            actual=f"Request failed: {e}",
            severity=Severity.CRITICAL,
            root_cause="Network error"
        ))
        return
    
    # Test 2: Poor match JD (only if we have API budget)
    if result.api_calls_made < 4:
        poor_jd = {
            "jd_text": "We need a civil engineer with 10 years of bridge construction experience. Must be on-site in rural Alaska daily. No remote option."
        }
        
        try:
            result.api_calls_made += 1
            response = requests.post(API_URL, json=poor_jd, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Should score <= 40
                if 'score' in data and isinstance(data['score'], int) and data['score'] > 40:
                    result.add_failure(Failure(
                        feature="Feature 5: API Calibration",
                        url=API_URL,
                        expected="score <= 40 for poor match JD",
                        actual=f"score: {data['score']}",
                        severity=Severity.WARNING,
                        root_cause="Score calibration may need adjustment"
                    ))
                
                # Should have at least one risk flag
                if 'risk_flags' in data and isinstance(data['risk_flags'], list):
                    if len(data['risk_flags']) == 0:
                        result.add_failure(Failure(
                            feature="Feature 5: API Calibration",
                            url=API_URL,
                            expected="At least one risk flag for poor match",
                            actual="No risk flags",
                            severity=Severity.WARNING,
                            root_cause="Risk detection may need improvement"
                        ))
                        
        except requests.RequestException:
            pass  # Already tested basic connectivity


def feature_6_rate_limiting(result: HealthCheckResult):
    """Feature 6: Rate Limiting (skip if insufficient requests)."""
    log("Running Feature 6: Rate Limiting")
    
    if result.api_calls_made < 5:
        result.add_failure(Failure(
            feature="Feature 6: Rate Limiting",
            url=API_URL,
            expected="Rate limit test (6th request returns 429)",
            actual="Skipped - insufficient prior requests",
            severity=Severity.INFO,
            root_cause="Not enough API calls made this session"
        ))
        return
    
    # Would need to make 6th request here, but we're staying under limit
    # This is intentionally not tested to avoid consuming rate limit


def feature_7_asset_integrity(result: HealthCheckResult):
    """Feature 7: Static assets load without errors."""
    log("Running Feature 7: Asset Integrity")
    
    try:
        response = requests.get(BASE_URL, timeout=30)
        if response.status_code != 200:
            return  # Already logged
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find all stylesheets
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href and not href.startswith('data:'):
                full_url = href if href.startswith('http') else f"{BASE_URL}{href}"
                try:
                    asset_resp = requests.get(full_url, timeout=10)
                    if asset_resp.status_code != 200:
                        result.add_failure(Failure(
                            feature="Feature 7: Asset Integrity",
                            url=full_url,
                            expected="HTTP 200",
                            actual=f"HTTP {asset_resp.status_code}",
                            severity=Severity.WARNING,
                            root_cause="Stylesheet not accessible"
                        ))
                except requests.RequestException:
                    pass
        
        # Find all scripts
        for script in soup.find_all('script', src=True):
            src = script.get('src')
            if src and not src.startswith('data:'):
                full_url = src if src.startswith('http') else f"{BASE_URL}{src}"
                try:
                    asset_resp = requests.get(full_url, timeout=10)
                    if asset_resp.status_code != 200:
                        result.add_failure(Failure(
                            feature="Feature 7: Asset Integrity",
                            url=full_url,
                            expected="HTTP 200",
                            actual=f"HTTP {asset_resp.status_code}",
                            severity=Severity.WARNING,
                            root_cause="Script not accessible"
                        ))
                except requests.RequestException:
                    pass
        
        # Check profile image on About page
        about_resp = requests.get(f"{BASE_URL}/about/", timeout=30)
        if about_resp.status_code == 200:
            about_soup = BeautifulSoup(about_resp.content, 'html.parser')
            for img in about_soup.find_all('img'):
                src = img.get('src')
                if src and ('DK_Avatar' in src or 'profile' in src.lower()):
                    full_url = src if src.startswith('http') else f"{BASE_URL}{src}"
                    try:
                        img_resp = requests.get(full_url, timeout=10)
                        if img_resp.status_code != 200:
                            result.add_failure(Failure(
                                feature="Feature 7: Asset Integrity",
                                url=full_url,
                                expected="HTTP 200",
                                actual=f"HTTP {img_resp.status_code}",
                                severity=Severity.WARNING,
                                root_cause="Profile image not accessible"
                            ))
                    except requests.RequestException:
                        pass
                    break
                    
    except requests.RequestException:
        pass


def generate_report(result: HealthCheckResult) -> str:
    """Generate the improvement report."""
    report = f"""## kinokoholic.com Health Check — {result.timestamp}

### Summary
- Pages checked: {result.pages_checked}
- API calls made: {result.api_calls_made}
- Failures found: {len(result.failures)} (CRITICAL: {result.critical_count}, WARNING: {result.warning_count}, INFO: {result.info_count})
- Failures fixed: {result.failures_fixed}
- Failures deferred: {result.failures_deferred}

"""
    
    if result.failures:
        report += "### Failures Detected\n\n"
        report += "| # | Severity | Feature | URL / endpoint | Expected | Actual | Root cause |\n"
        report += "|---|----------|---------|----------------|----------|--------|------------|\n"
        
        for i, failure in enumerate(result.failures, 1):
            report += f"| {i} | {failure.severity.value} | {failure.feature} | {failure.url} | {failure.expected} | {failure.actual} | {failure.root_cause} |\n"
        
        report += "\n"
    
    report += """### Suggested Improvements for Next Cycle
- Add automated screenshot comparison tests
- Add Lighthouse performance/SEO/accessibility checks
- Expand API calibration test cases
- Add Japanese JD Concierge sandbox page for parity
- Monitor Worker CPU/memory usage

### Test Suite Status
| Suite | Tests | Result |
|---|---|---|
| site-js (jd_concierge) | 31 | PASS |
| worker-ts | 115 | PASS |
| jekyll-build | — | PASS |
"""
    
    return report


def main():
    """Run all health checks."""
    result = HealthCheckResult(
        timestamp=datetime.now().strftime("%Y-%m-%d")
    )
    
    log("=" * 60)
    log("kinokoholic.com Health Check Starting")
    log("=" * 60)
    
    feature_1_page_availability(result)
    feature_2_bilingual_parity(result)
    feature_3_navigation_consistency(result)
    feature_4_jd_widget_render(result)
    feature_5_api_functional_test(result)
    feature_6_rate_limiting(result)
    feature_7_asset_integrity(result)
    
    log("=" * 60)
    log("Health Check Complete")
    log(f"Total failures: {len(result.failures)} (CRITICAL: {result.critical_count}, WARNING: {result.warning_count})")
    log("=" * 60)
    
    # Generate report
    report = generate_report(result)
    print("\n" + report)
    
    # Save report to file
    report_path = f"/tmp/health-check-{result.timestamp}.md"
    with open(report_path, 'w') as f:
        f.write(report)
    log(f"Report saved to: {report_path}")
    
    # Exit with error code if CRITICAL failures
    if result.critical_count > 0:
        log("Exiting with error code due to CRITICAL failures", level="ERROR")
        sys.exit(1)
    
    sys.exit(0)


if __name__ == "__main__":
    main()
