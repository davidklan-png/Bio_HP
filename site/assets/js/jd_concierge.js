(function () {
  "use strict";

  const MAX_LEN = 15000;
  const EXAMPLE_JD = [
    "Role: GenAI Enablement Consultant",
    "",
    "Responsibilities:",
    "- Lead prompt engineering workshops and create reusable prompt patterns",
    "- Design agentic workflows and AI orchestration playbooks for business teams",
    "- Drive change management, adoption, and training for GenAI programs",
    "- Partner with delivery teams to modernize reporting and operational workflows",
    "",
    "Requirements:",
    "- 5+ years in digital transformation or AI consulting",
    "- Hands-on LLM prompting / prompt design",
    "- Experience with enterprise stakeholders and enablement programs",
    "",
    "Nice-to-have:",
    "- Japanese language proficiency",
    "- Familiarity with RAG systems"
  ].join("\n");

  const roots = document.querySelectorAll("[data-jd-concierge]");

  roots.forEach(function (root) {
    const input = root.querySelector("[data-jd-input]");
    const counter = root.querySelector("[data-jd-counter]");
    const analyzeButton = root.querySelector("[data-jd-submit]");
    const exampleButton = root.querySelector("[data-jd-example]");
    const loading = root.querySelector("[data-jd-loading]");
    const errorBox = root.querySelector("[data-jd-error]");
    const results = root.querySelector("[data-jd-results]");

    if (!input || !counter || !analyzeButton || !exampleButton || !loading || !errorBox || !results) {
      return;
    }

    analyzeButton.dataset.loading = "false";
    syncCounterAndButton(input, counter, analyzeButton);

    analyzeButton.addEventListener("click", function () {
      submitAnalysis(root, input, counter, analyzeButton, exampleButton, loading, errorBox, results, true);
    });

    exampleButton.addEventListener("click", function () {
      input.value = EXAMPLE_JD;
      syncCounterAndButton(input, counter, analyzeButton);
      clearError(errorBox);
      submitAnalysis(root, input, counter, analyzeButton, exampleButton, loading, errorBox, results, true);
    });

    input.addEventListener("input", function () {
      syncCounterAndButton(input, counter, analyzeButton);
    });
  });

  function submitAnalysis(root, input, counter, analyzeButton, exampleButton, loading, errorBox, results, scrollToResults) {
    const jdText = input.value.trim();
    const apiBase = (root.getAttribute("data-api-base") || "").trim();
    const apiKey = (root.getAttribute("data-api-key") || "").trim();
    const rawLength = input.value.length;

    clearError(errorBox);
    results.hidden = true;

    if (!apiBase) {
      showError(errorBox, "Worker API base URL is not configured. Set site.worker_api_base in /site/_config.yml.");
      return;
    }

    if (rawLength === 0 || !jdText) {
      showError(errorBox, "Please paste a job description before analyzing.");
      return;
    }

    if (jdText.length > MAX_LEN) {
      showError(errorBox, "Job description is too long. Maximum is 15,000 characters.");
      return;
    }

    setLoadingState(analyzeButton, exampleButton, loading, true);

    const endpoint = apiBase.replace(/\/$/, "") + "/analyze";

    const headers = {
      "Content-Type": "application/json"
    };

    // Add Authorization header if API key is configured
    if (apiKey) {
      headers["Authorization"] = "Bearer " + apiKey;
    }

    fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ jd_text: jdText })
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return { error: "Invalid JSON response from server." };
          })
          .then(function (data) {
            if (!response.ok) {
              throw new Error(formatApiError(response.status, data));
            }
            return data;
          });
      })
      .then(function (payload) {
        renderResults(results, payload);
        results.hidden = false;
        if (scrollToResults) {
          results.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      })
      .catch(function (err) {
        showError(errorBox, err.message || "Network error while analyzing fit. Please try again.");
      })
      .finally(function () {
        setLoadingState(analyzeButton, exampleButton, loading, false);
        syncCounterAndButton(input, counter, analyzeButton);
      });
  }

  function renderResults(container, data) {
    const score = typeof data.score === "number" ? data.score : 0;
    const confidence = data.confidence || "Low";
    const scoreBand = score >= 80 ? "strong" : score >= 60 ? "moderate" : "limited";

    const strengthsHtml = asList((data.strengths || []).map(function (item) {
      const title = escapeHtml(item.area || "Strength");
      const evidenceTitle = escapeHtml(item.evidence_title || "Evidence");
      const rationale = escapeHtml(item.rationale || "");

      if (!item.evidence_url) {
        return "<strong>" + title + "</strong>: " + evidenceTitle +
          "<br><span class=\"jd-concierge__evidence-missing\">No evidence found on site</span>" +
          "<br><span>" + rationale + "</span>";
      }

      const evidenceUrl = escapeHtml(item.evidence_url);
      return "<strong>" + title + "</strong>: <a href=\"" + evidenceUrl +
        "\" target=\"_blank\" rel=\"noopener noreferrer\">" + evidenceTitle +
        "</a><br><span>" + rationale + "</span>";
    }), "No evidence found on site.");

    const gapsHtml = asList((data.gaps || []).map(function (item) {
      const area = escapeHtml(item.area || "Gap");
      const why = escapeHtml(item.why_it_matters || "No details");
      const mitigation = escapeHtml(item.mitigation || "");
      return "<strong>" + area + "</strong>: " + why + "<br><span>Mitigation: " + mitigation + "</span>";
    }), "No major gaps detected.");

    const risks = data.risk_flags || [];
    const riskHtml = risks.length ? asList(risks.map(escapeHtml), "") : "<p>None detected.</p>";

    const rubricRows = (data.rubric_breakdown || [])
      .map(function (item) {
        return "<tr><td>" +
          escapeHtml(item.category || "") +
          "</td><td>" +
          escapeHtml(String(item.score || 0)) +
          " / " +
          escapeHtml(String(item.weight || 0)) +
          "</td><td>" +
          escapeHtml(item.notes || "") +
          "</td></tr>";
      })
      .join("");

    const requestId = data.request_id ? "<p class=\"jd-concierge__request-id\">Request ID: " + escapeHtml(data.request_id) + "</p>" : "";

    container.innerHTML = "" +
      "<div class=\"jd-concierge__summary\">" +
      "<div class=\"jd-concierge__score-card jd-concierge__score-card--" + scoreBand + "\">" +
      "<p class=\"jd-concierge__score-value\">" + escapeHtml(String(score)) + " <span>/ 100</span></p>" +
      "<p class=\"jd-concierge__score-label\">Compatibility Score</p>" +
      "</div>" +
      "<p class=\"jd-concierge__confidence\">Confidence: <strong>" + escapeHtml(confidence) + "</strong></p>" +
      "<p>" + escapeHtml(data.fit_summary || "No summary provided.") + "</p>" +
      requestId +
      "</div>" +
      "<div class=\"jd-concierge__grid\">" +
      "<section><h3>Strengths</h3>" + strengthsHtml + "</section>" +
      "<section><h3>Gaps</h3>" + gapsHtml + "</section>" +
      "</div>" +
      "<section><h3>Risk flags</h3>" + riskHtml + "</section>" +
      "<details class=\"jd-concierge__rubric\"><summary>Rubric breakdown</summary>" +
      "<div class=\"jd-concierge__table-wrap\"><table class=\"jd-concierge__table\"><thead><tr><th>Category</th><th>Score</th><th>Notes</th></tr></thead><tbody>" +
      rubricRows +
      "</tbody></table></div></details>";
  }

  function asList(items, emptyMessage) {
    if (!items.length) {
      return "<p>" + escapeHtml(emptyMessage || "No evidence found.") + "</p>";
    }
    return "<ul>" + items.map(function (item) { return "<li>" + item + "</li>"; }).join("") + "</ul>";
  }

  function setLoadingState(analyzeButton, exampleButton, loading, isLoading) {
    analyzeButton.dataset.loading = isLoading ? "true" : "false";
    analyzeButton.disabled = isLoading;
    exampleButton.disabled = isLoading;
    loading.hidden = !isLoading;
  }

  function syncCounterAndButton(input, counter, analyzeButton) {
    const length = input.value.length;
    const remaining = MAX_LEN - length;
    const isValid = length > 0 && length <= MAX_LEN;

    counter.innerHTML =
      "<span>" + escapeHtml(String(length)) + " / " + escapeHtml(String(MAX_LEN)) + "</span>" +
      "<span>Remaining: " + escapeHtml(String(remaining)) + "</span>";

    if (analyzeButton.dataset.loading !== "true") {
      analyzeButton.disabled = !isValid;
    }
  }

  function formatApiError(status, data) {
    if (status === 401) {
      return data && data.error ? data.error : "Unauthorized. Please check your API credentials.";
    }
    if (status === 429 && data && typeof data.retry_after_seconds === "number") {
      const minutes = Math.floor(data.retry_after_seconds / 60);
      const seconds = data.retry_after_seconds % 60;
      let timeStr;
      if (minutes > 0 && seconds > 0) {
        timeStr = minutes + " minute" + (minutes !== 1 ? "s" : "") + " and " + seconds + " second" + (seconds !== 1 ? "s" : "");
      } else if (minutes > 0) {
        timeStr = minutes + " minute" + (minutes !== 1 ? "s" : "");
      } else {
        timeStr = seconds + " second" + (seconds !== 1 ? "s" : "");
      }
      return "Rate limit exceeded: 5 requests per hour allowed. Please try again in " + timeStr + ".";
    }
    if (status === 400) {
      return data && data.error ? data.error : "Invalid input. Please review your JD text.";
    }
    if (status === 415) {
      return "Request rejected due to invalid content type.";
    }
    if (status >= 500) {
      return "Server error while analyzing fit. Please retry shortly.";
    }
    return data && data.error ? data.error : "Analysis failed.";
  }

  function showError(errorBox, message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError(errorBox) {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
