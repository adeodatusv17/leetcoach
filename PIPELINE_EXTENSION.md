# LeetCode AI Analyzer - Extension Pipeline

## Extension responsibilities

The extension has three runtime pieces:

1. `content.js`
2. `background.js`
3. `injected.js`

## `injected.js` pipeline

This script runs in the page context because browser content scripts cannot directly intercept the page's native `fetch` or `XMLHttpRequest` behavior with full access to the original request body.

### Steps

1. Patch `window.fetch`.
2. Patch `XMLHttpRequest.prototype.open` and `send`.
3. Match outgoing LeetCode requests against:
   - `/problems/*/interpret_solution/`
   - `/problems/*/submit/`
4. Parse request bodies that contain `typed_code`.
5. Deduplicate repeated captures in a short time window.
6. Emit a normalized request payload back to the page via `window.postMessage`.

## `content.js` pipeline

### Steps

1. Inject `injected.js` into the page.
2. Create a shadow-root-mounted React side panel.
3. Listen for `LC_ANALYZER_CAPTURED` page messages.
4. Set the UI state to `loading`.
5. Forward the payload to the background worker.
6. Listen for background result messages.
7. Render success or error states.

## `background.js` pipeline

### Steps

1. Receive `analyze_solution` messages from the content script.
2. Call the local backend `POST /analyze`.
3. On success, send `analysis_result` back to the originating tab.
4. On failure, send `analysis_error` back to the originating tab.

## UI states

- `idle`: waiting for a LeetCode run or submit request
- `loading`: analysis in progress
- `success`: structured analysis received
- `error`: backend or model failure

## Rendered coaching sections

When analysis succeeds, the panel shows:

- Pattern Analysis
- Key Insight
- Alternative Approach
- Practice Next (Your Style)
- Practice Next (Optimal Style)
- Pattern Progress
- Most Missed Optimal Patterns
- Learning Insights
