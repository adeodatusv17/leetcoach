# LeetCode AI Analyzer Extension

Browser extension and FastAPI backend for analyzing LeetCode run and submit requests with Gemini-powered feedback, local pattern tracking, and next-practice recommendations.

## Repo layout

- `extension/` - Chrome/Firefox Manifest V3 extension
- `backend/` - FastAPI API server
- `data/` - local JSON catalogs and analysis history
- `lc/` - local Python virtual environment
- `PIPELINE_FULL_FLOW.md` - end-to-end architecture
- `PIPELINE_EXTENSION.md` - extension internals
- `PIPELINE_BACKEND.md` - backend internals

## Extension setup

```powershell
cd extension
npm install
npm run build
```

Load `extension/dist` as an unpacked extension in Chrome or Firefox.

## Backend setup

Python dependencies were installed into the `lc` virtual environment.

```powershell
Copy-Item backend\.env.example backend\.env
```

Set `GEMINI_API_KEY` in `backend/.env`, then run:

```powershell
.\lc\Scripts\python -m uvicorn backend.app.main:app --reload
```

The backend listens on `http://127.0.0.1:8000`.

## Notes

- The backend currently targets Gemini, not OpenAI.
- The extension sends code, language, question id, and page URL to the backend for analysis, but the backend only persists metadata and pattern-level results.
- Source code, test cases, cookies, session tokens, and account information are never stored in `data/`.
- `data/analysis_history.json` stores one latest analysis record per question id.
- `data/patterns.json` and `data/problems.json` are the local catalogs used for recommendations and analytics.
