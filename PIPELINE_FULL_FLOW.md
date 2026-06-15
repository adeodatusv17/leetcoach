# LeetCode AI Analyzer - Full Pipeline

## End-to-end flow

1. The user opens a LeetCode problem page.
2. The extension content script loads on `https://leetcode.com/problems/*`.
3. The content script injects a page-context bridge script (`injected.js`).
4. The bridge script monkey-patches `fetch` and `XMLHttpRequest`.
5. When LeetCode sends a matching `interpret_solution` or `submit` POST request containing `typed_code`, the bridge extracts:
   - `question_id`
   - `lang`
   - `typed_code`
   - current page URL
6. The bridge sends that payload to the content script with `window.postMessage(...)`.
7. The content script updates the side panel to `Analyzing...` and forwards the request to the background service worker.
8. The background service worker sends the payload to `POST /analyze` on the local FastAPI backend.
9. The backend calls Gemini, requesting separate `user_pattern` and `optimal_pattern` analysis.
10. The backend enriches the AI result with local recommendations and analytics from `data/`.
11. The backend updates `data/analysis_history.json` without storing source code.
12. The backend returns normalized JSON to the background worker.
13. The background worker sends the result back to the content script.
14. The content script renders the result in the injected side panel.

## Message boundaries

- Page context -> Content script:
  `window.postMessage`
- Content script -> Background:
  `chrome.runtime.sendMessage` or `browser.runtime.sendMessage`
- Background -> Backend:
  `fetch`
- Background -> Content script:
  `tabs.sendMessage`

## Data sent off-page

Only the following fields are forwarded to the backend:

- `question_id`
- `lang`
- `code`
- `leetcode_url`

No cookies, account credentials, or session tokens are stored or forwarded.

## Data written locally

The backend writes only these local JSON artifacts:

- `data/analysis_history.json`
- `data/patterns.json`
- `data/problems.json`

The stored history excludes source code, test cases, cookies, tokens, and account data.
