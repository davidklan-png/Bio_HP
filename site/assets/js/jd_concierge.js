(function () {
  "use strict";

  var MAX_LEN = 15000;
  var roots = document.querySelectorAll("[data-jd-concierge]");

  roots.forEach(function (root) {
    var input = root.querySelector("[data-jd-input]");
    var button = root.querySelector("[data-jd-submit]");
    var loading = root.querySelector("[data-jd-loading]");
    var errorBox = root.querySelector("[data-jd-error]");
    var results = root.querySelector("[data-jd-results]");

    if (!input || !button || !loading || !errorBox || !results) {
      return;
    }

    button.addEventListener("click", function () {
      submitAnalysis(root, input, button, loading, errorBox, results);
    });
  });

  function submitAnalysis(root, input, button, loading, errorBox, results) {
    var jdText = input.value.trim();
    var apiBase = (root.getAttribute("data-api-base") || "").trim();

    clearError(errorBox);
    results.hidden = true;

    if (!apiBase) {
      showError(errorBox, "Worker API base URL is not configured. Set site.worker_api_base in Jekyll config.");
      return;
    }

    if (!jdText) {
      showError(errorBox, "Please paste a job description before analyzing.");
      return;
    }

    if (jdText.length > MAX_LEN) {
      showError(errorBox, "Job description is too long. Maximum is 15,000 characters.");
      return;
    }

    setLoadingState(button, loading, true);

    var endpoint = apiBase.replace(/\/$/, "") + "/analyze";

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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
              var message = data && data.error ? data.error : "Analysis failed.";
              throw new Error(message);
            }
            return data;
          });
      })
      .then(function (payload) {
        renderResults(results, payload);
        results.hidden = false;
      })
      .catch(function (err) {
        showError(errorBox, err.message || "Unexpected error while analyzing fit.");
      })
      .finally(function () {
        setLoadingState(button, loading, false);
      });
  }

  function renderResults(container, data) {
    var strengthsHtml = asList((data.strengths || []).map(function (item) {
      var title = escapeHtml(item.area || "Strength");
      var evidenceTitle = escapeHtml(item.evidence_title || "Evidence");
      var evidenceUrl = escapeHtml(item.evidence_url || "#");
      var rationale = escapeHtml(item.rationale || "");
      return "<strong>" + title + "</strong>: <a href=\"" + evidenceUrl + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + evidenceTitle + "</a><br><span>" + rationale + "</span>";
    }));

    var gapsHtml = asList((data.gaps || []).map(function (item) {
      var area = escapeHtml(item.area || "Gap");
      var why = escapeHtml(item.why_it_matters || "No details");
      var mitigation = escapeHtml(item.mitigation || "");
      return "<strong>" + area + "</strong>: " + why + "<br><span>Mitigation: " + mitigation + "</span>";
    }));

    var risks = data.risk_flags || [];
    var riskHtml = risks.length ? asList(risks.map(escapeHtml)) : "<p>None detected.</p>";

    var rubricRows = (data.rubric_breakdown || [])
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

    container.innerHTML = "" +
      "<div class=\"jd-concierge__summary\">" +
      "<p class=\"jd-concierge__score\">Score: <strong>" + escapeHtml(String(data.score || 0)) + "/100</strong>" +
      " <span class=\"jd-concierge__confidence\">(" + escapeHtml(data.confidence || "Low") + " confidence)</span></p>" +
      "<p>" + escapeHtml(data.fit_summary || "No summary") + "</p>" +
      "</div>" +
      "<div class=\"jd-concierge__grid\">" +
      "<section><h3>Strengths</h3>" + strengthsHtml + "</section>" +
      "<section><h3>Gaps / Unknowns</h3>" + gapsHtml + "</section>" +
      "</div>" +
      "<section><h3>Risk flags</h3>" + riskHtml + "</section>" +
      "<section><h3>Rubric breakdown</h3><div class=\"jd-concierge__table-wrap\"><table class=\"jd-concierge__table\"><thead><tr><th>Category</th><th>Score</th><th>Notes</th></tr></thead><tbody>" + rubricRows + "</tbody></table></div></section>";
  }

  function asList(items) {
    if (!items.length) {
      return "<p>No evidence found.</p>";
    }
    return "<ul>" + items.map(function (item) { return "<li>" + item + "</li>"; }).join("") + "</ul>";
  }

  function setLoadingState(button, loading, isLoading) {
    button.disabled = isLoading;
    loading.hidden = !isLoading;
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
