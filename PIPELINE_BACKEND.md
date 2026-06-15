# LeetCode AI Analyzer - Backend Pipeline

## Backend stack

- FastAPI
- Google GenAI Python SDK (`google-genai`)
- Gemini API
- Local JSON storage in `data/`

## `/analyze` request pipeline

### Input

The backend accepts:

```json
{
  "question_id": "448",
  "lang": "cpp",
  "code": "class Solution { ... }",
  "leetcode_url": "https://leetcode.com/problems/..."
}
```

### Steps

1. FastAPI validates the input payload with Pydantic.
2. The backend builds a prompt containing language, question id, page URL, and source code.
3. The Gemini client calls `models.generate_content(...)`.
4. The request includes:
   - a system instruction for separate `user_pattern` and `optimal_pattern`
   - low temperature for consistency
   - `response_mime_type="application/json"`
   - `response_schema=LLMAnalysis`
5. Gemini returns a JSON text payload.
6. FastAPI validates that JSON against the LLM response model.
7. The backend resolves problem metadata from `data/problems.json`.
8. The backend updates `data/analysis_history.json` with pattern-level results only.
9. The backend looks up related problems from `data/patterns.json`.
10. The backend computes analytics and learning insights from local history.
11. The backend returns normalized analysis JSON to the extension.

## Environment

The backend reads:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)

## Local files

- `data/analysis_history.json`: latest stored analysis per problem
- `data/patterns.json`: pattern to related-question catalog
- `data/problems.json`: question metadata catalog

## Error handling

The backend returns HTTP errors when:

- the API key is missing
- Gemini fails upstream
- Gemini returns empty or invalid JSON
