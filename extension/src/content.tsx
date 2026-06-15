import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { extensionRuntime } from './runtime'
import type {
  AnalysisState,
  AnalyzerRequest,
  CoachingState,
  ExecutionFailure,
  GiveUpResponse,
  HintResponse,
  PatternCount,
  RecommendationProblem,
  RuntimeMessage,
} from './types'

const ROOT_ID = 'lc-ai-analyzer-root'
const PANEL_WIDTH = 400

const styles = `
  :host {
    all: initial;
  }

  * {
    box-sizing: border-box;
  }

  .lcai-panel {
    position: fixed;
    top: 56px;
    right: 16px;
    z-index: 2147483646;
    width: ${PANEL_WIDTH}px;
    max-height: calc(100vh - 72px);
    overflow: auto;
    background: #0f172a;
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 18px;
    box-shadow: 0 24px 56px rgba(2, 6, 23, 0.45);
    font: 14px/1.5 Inter, system-ui, sans-serif;
    transition: opacity 160ms ease, transform 160ms ease;
  }

  .lcai-launcher,
  .lcai-minimized {
    position: fixed;
    right: 16px;
    z-index: 2147483646;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.96);
    color: #f8fafc;
    box-shadow: 0 16px 40px rgba(2, 6, 23, 0.38);
    transition: opacity 160ms ease, transform 160ms ease;
  }

  .lcai-launcher {
    top: 96px;
    padding: 10px 14px;
    cursor: pointer;
  }

  .lcai-minimized {
    top: 56px;
    padding: 8px 10px 8px 14px;
  }

  .lcai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 12px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    position: sticky;
    top: 0;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.94));
    backdrop-filter: blur(8px);
  }

  .lcai-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .lcai-subtitle {
    margin: 4px 0 0;
    color: #93a4b8;
    font-size: 12px;
  }

  .lcai-body {
    padding: 14px 18px 18px;
  }

  .lcai-card {
    margin-bottom: 14px;
    padding: 14px;
    border-radius: 14px;
    background: rgba(17, 24, 39, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.12);
    transition: border-color 160ms ease, transform 160ms ease;
  }

  .lcai-section-title {
    margin: 0 0 10px;
    color: #f8fafc;
    font-size: 14px;
    font-weight: 700;
  }

  .lcai-grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .lcai-grid-item {
    min-width: 0;
  }

  .lcai-label {
    display: block;
    margin-bottom: 4px;
    color: #8aa5c8;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .lcai-value {
    margin: 0;
    color: #f8fafc;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .lcai-chip {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(71, 85, 105, 0.24);
    color: #dbe4f0;
    font-size: 12px;
    font-weight: 600;
  }

  .lcai-chip.ok {
    background: rgba(34, 197, 94, 0.15);
    color: #bbf7d0;
  }

  .lcai-chip.warn {
    background: rgba(245, 158, 11, 0.15);
    color: #fde68a;
  }

  .lcai-list {
    margin: 0;
    padding-left: 18px;
    color: #e2e8f0;
  }

  .lcai-list li + li {
    margin-top: 8px;
  }

  .lcai-problem-link {
    color: #dbeafe;
    text-decoration: none;
    font-weight: 600;
  }

  .lcai-problem-link:hover {
    text-decoration: underline;
  }

  .lcai-problem-meta {
    display: block;
    color: #94a3b8;
    font-size: 12px;
  }

  .lcai-kv {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  }

  .lcai-kv:last-child {
    border-bottom: none;
  }

  .lcai-muted {
    color: #cbd5e1;
  }

  .lcai-empty {
    padding: 8px 0 2px;
    color: #cbd5e1;
  }

  .lcai-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 18px;
    border-radius: 999px;
    cursor: pointer;
  }

  .lcai-icon-button:hover {
    background: rgba(30, 41, 59, 0.72);
    color: #f8fafc;
  }

  .lcai-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .lcai-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  .lcai-button {
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(30, 41, 59, 0.72);
    color: #e2e8f0;
    border-radius: 10px;
    padding: 8px 12px;
    font: 600 12px/1.2 Inter, system-ui, sans-serif;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease;
  }

  .lcai-button:hover:not(:disabled) {
    border-color: rgba(148, 163, 184, 0.38);
    background: rgba(51, 65, 85, 0.84);
  }

  .lcai-button.secondary {
    background: rgba(120, 53, 15, 0.22);
    color: #fde68a;
  }

  .lcai-button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .lcai-code {
    margin: 0;
    padding: 12px;
    border-radius: 12px;
    background: #020617;
    color: #dbeafe;
    overflow: auto;
    font: 12px/1.5 Consolas, monospace;
  }

  .lcai-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 6px 0;
  }

  .lcai-row + .lcai-row {
    border-top: 1px solid rgba(148, 163, 184, 0.08);
  }

  .lcai-inline-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .lcai-action-grid {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .lcai-action-tile {
    width: 100%;
    text-align: left;
    border: 1px solid rgba(148, 163, 184, 0.12);
    background: rgba(15, 23, 42, 0.4);
    color: #e2e8f0;
    border-radius: 12px;
    padding: 10px 12px;
    font: 600 13px/1.3 Inter, system-ui, sans-serif;
    cursor: pointer;
  }

  .lcai-action-tile:hover:not(:disabled) {
    border-color: rgba(148, 163, 184, 0.26);
    background: rgba(30, 41, 59, 0.56);
  }

  .lcai-action-tile:disabled {
    opacity: 0.58;
    cursor: default;
  }

  .lcai-progress-group {
    display: grid;
    gap: 12px;
    margin-top: 10px;
  }

  .lcai-progress-row {
    display: grid;
    gap: 6px;
  }

  .lcai-progress-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: #dbe4f0;
    font-size: 13px;
  }

  .lcai-progress-track {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: rgba(51, 65, 85, 0.84);
    overflow: hidden;
  }

  .lcai-progress-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #22c55e, #38bdf8);
  }
`

function injectPageBridge(): void {
  if (document.getElementById('lc-ai-analyzer-bridge')) {
    return
  }

  const script = document.createElement('script')
  script.id = 'lc-ai-analyzer-bridge'
  script.src = extensionRuntime.runtime.getURL('injected.js')
  script.async = false
  script.onload = () => {
    console.debug('[lc-ai] injected page bridge loaded')
  }
  script.onerror = () => {
    console.error('[lc-ai] failed to load injected page bridge')
  }
  ;(document.head ?? document.documentElement).appendChild(script)
}

function createHost(): ShadowRoot {
  const host = document.createElement('div')
  host.id = ROOT_ID
  document.documentElement.appendChild(host)
  const shadowRoot = host.attachShadow({ mode: 'open' })
  const styleTag = document.createElement('style')
  styleTag.textContent = styles
  shadowRoot.appendChild(styleTag)
  return shadowRoot
}

function renderRecommendations(items: RecommendationProblem[]): React.JSX.Element {
  if (items.length === 0) {
    return <p className="lcai-empty">No local recommendations yet for this pattern.</p>
  }

  return (
    <ol className="lcai-list">
      {items.map((problem) => (
        <li key={problem.question_id}>
          <a className="lcai-problem-link" href={problem.url} target="_blank" rel="noreferrer">
            {problem.title}
          </a>
          <span className="lcai-problem-meta">
            #{problem.question_id} - {problem.difficulty}
          </span>
        </li>
      ))}
    </ol>
  )
}

function renderPatternCountList(items: PatternCount[]): React.JSX.Element {
  if (items.length === 0) {
    return <p className="lcai-empty">No missed optimal patterns recorded yet.</p>
  }

  return (
    <ol className="lcai-list">
      {items.map((item) => (
        <li key={item.pattern}>
          {item.pattern} ({item.count})
        </li>
      ))}
    </ol>
  )
}

function createInitialCoachingState(failure: ExecutionFailure): CoachingState {
  return {
    failure,
    hints: [],
    hintLevel: 0,
    maxHintLevel: 3,
  }
}

type PanelMode = 'open' | 'minimized' | 'closed'

type DetailPanelsState = {
  showHint: boolean
  showExplanation: boolean
  showOptimalSolution: boolean
  showPatternBreakdown: boolean
  hint?: HintResponse
  optimalSolution?: GiveUpResponse
  loading?: 'hint' | 'optimal_solution'
}

const defaultDetailPanelsState = (): DetailPanelsState => ({
  showHint: false,
  showExplanation: false,
  showOptimalSolution: false,
  showPatternBreakdown: false,
})

function isEmptyOrTemplateCode(code: string): boolean {
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/#.*$/gm, '')
    .trim()

  if (!stripped) {
    return true
  }

  const compact = stripped.replace(/\s+/g, '')
  if (
    compact === 'classSolution{}' ||
    compact === 'classSolution{public:}' ||
    compact === 'classSolution{public:};' ||
    compact === 'classSolution{public:private:};' ||
    compact === 'pass'
  ) {
    return true
  }

  const normalized = stripped.replace(/\s+/g, ' ')
  const placeholderReturn =
    /return\s*(\{\s*\}|\[\s*\]|0|false|true|null|nullptr|None)?\s*;?\s*$/i.test(normalized) ||
    /pass\s*$/i.test(normalized)
  const meaningfulLogic =
    /\b(for|while|if|switch|dfs|bfs|sort|unordered_map|map|set|stack|queue|priority_queue|recurs|memo|dp)\b/i.test(
      normalized,
    )

  return placeholderReturn && !meaningfulLogic
}

function renderComplexityValue(value: string): React.JSX.Element {
  if (value === 'N/A') {
    return <p className="lcai-value">N/A</p>
  }

  if (value.includes('Average:') || value.includes('Worst:')) {
    return (
      <div className="lcai-value">
        {value.split(',').map((part) => (
          <div key={part.trim()}>{part.trim()}</div>
        ))}
      </div>
    )
  }

  return <p className="lcai-value">{value}</p>
}

function renderOptimality(optimal: boolean | null): React.JSX.Element {
  if (optimal === null) {
    return <span className="lcai-chip">N/A</span>
  }

  return <span className={`lcai-chip ${optimal ? 'ok' : 'warn'}`}>{optimal ? 'Optimal' : 'Suboptimal'}</span>
}

function renderProgressRows(summary: Record<string, number>): React.JSX.Element {
  const entries = Object.entries(summary).slice(0, 5)
  if (entries.length === 0) {
    return <p className="lcai-empty">No history yet.</p>
  }

  const maxCount = Math.max(...entries.map(([, count]) => count), 1)
  return (
    <div className="lcai-progress-group">
      {entries.map(([label, count]) => (
        <div className="lcai-progress-row" key={label}>
          <div className="lcai-progress-label">
            <span>{label}</span>
            <span>{count}</span>
          </div>
          <div className="lcai-progress-track">
            <div
              className="lcai-progress-fill"
              style={{ width: `${Math.max((count / maxCount) * 100, 12)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function App(): React.JSX.Element {
  const [panelMode, setPanelMode] = useState<PanelMode>('open')
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })
  const [detailPanels, setDetailPanels] = useState<DetailPanelsState>(defaultDetailPanelsState)

  useEffect(() => {
    setDetailPanels(defaultDetailPanelsState())
  }, [state.request?.requestId, state.status])

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return
      }

      if (event.data?.type === 'LC_ANALYZER_CAPTURED') {
        const payload = event.data.payload as AnalyzerRequest
        console.debug('[lc-ai] captured LeetCode request in content script', payload)
        setState({ status: 'loading', request: payload })
        void extensionRuntime.runtime.sendMessage({
          type: 'analyze_solution',
          payload,
        } satisfies RuntimeMessage)
      }

      if (event.data?.type === 'LC_ANALYZER_EXECUTION_FAILED') {
        const payload = event.data.payload as AnalyzerRequest
        const failure = event.data.failure as ExecutionFailure
        console.debug('[lc-ai] execution failed in content script', failure)
        if (isEmptyOrTemplateCode(payload.code)) {
          setState({ status: 'loading', request: payload })
          void extensionRuntime.runtime.sendMessage({
            type: 'analyze_solution',
            payload,
          } satisfies RuntimeMessage)
        } else {
          setState({
            status: 'failed',
            request: payload,
            coaching: createInitialCoachingState(failure),
          })
        }
      }
    }

    const onRuntimeMessage = (message: RuntimeMessage) => {
      if (!('payload' in message)) {
        return
      }

      setState((currentState) => {
        if (
          currentState.request?.requestId &&
          currentState.request.requestId !== message.payload.requestId
        ) {
          return currentState
        }

        if (message.type === 'analysis_started') {
          return { status: 'loading', request: message.payload }
        }

        if (message.type === 'analysis_result') {
          return {
            status: 'success',
            request: message.payload,
            result: message.result,
          }
        }

        if (message.type === 'hint_started') {
          if (currentState.status === 'success') {
            setDetailPanels((details) => ({
              ...details,
              showHint: true,
              loading: 'hint',
            }))
            return currentState
          }

          return {
            ...currentState,
            status: 'failed',
            coaching: currentState.coaching
              ? {
                  ...currentState.coaching,
                  actionLoading: 'hint',
                }
              : currentState.coaching,
          }
        }

        if (message.type === 'hint_result') {
          if (currentState.status === 'success') {
            setDetailPanels((details) => ({
              ...details,
              showHint: true,
              hint: message.result,
              loading: undefined,
            }))
            return currentState
          }

          const existingHints = currentState.coaching?.hints ?? []
          return {
            status: 'failed',
            request: message.payload,
            coaching: {
              failure:
                currentState.coaching?.failure ?? {
                  reason: 'failed',
                  summary: 'This attempt did not pass.',
                },
              hints: [...existingHints, message.result.hint],
              encouragement: message.result.encouragement,
              hintLevel: message.result.hint_level,
              maxHintLevel: message.result.max_hint_level,
              actionLoading: undefined,
            },
          }
        }

        if (message.type === 'give_up_started') {
          if (currentState.status === 'success') {
            setDetailPanels((details) => ({
              ...details,
              showOptimalSolution: true,
              loading: 'optimal_solution',
            }))
            return currentState
          }

          return {
            ...currentState,
            status: 'failed',
            coaching: currentState.coaching
              ? {
                  ...currentState.coaching,
                  actionLoading: 'give_up',
                }
              : currentState.coaching,
          }
        }

        if (message.type === 'give_up_result') {
          if (currentState.status === 'success') {
            setDetailPanels((details) => ({
              ...details,
              showOptimalSolution: true,
              optimalSolution: message.result,
              loading: undefined,
            }))
            return currentState
          }

          return {
            status: 'failed',
            request: message.payload,
            coaching: currentState.coaching
              ? {
                  ...currentState.coaching,
                  giveUp: message.result,
                  actionLoading: undefined,
                }
              : {
                  ...createInitialCoachingState({
                    reason: 'failed',
                    summary: 'This attempt did not pass.',
                  }),
                  giveUp: message.result,
                },
          }
        }

        if (message.type === 'analysis_error') {
          return {
            status: 'error',
            request: message.payload,
            error: message.error,
          }
        }

        return currentState
      })
    }

    window.addEventListener('message', onWindowMessage)
    extensionRuntime.runtime.onMessage.addListener(onRuntimeMessage)

    return () => {
      window.removeEventListener('message', onWindowMessage)
      extensionRuntime.runtime.onMessage.removeListener(onRuntimeMessage)
    }
  }, [])

  const subtitle = useMemo(() => {
    if (state.status === 'success' && state.result) {
      return `${state.result.title} - ${state.result.difficulty}`
    }

    if (state.status === 'failed' && state.request) {
      return `${state.request.lang.toUpperCase()} - Question ${state.request.question_id}`
    }

    if (!state.request) {
      return 'Waiting for Run Code or Submit'
    }

    return `${state.request.lang.toUpperCase()} - Question ${state.request.question_id}`
  }, [state.request, state.result, state.status])

  const requestNextHint = () => {
    if (!state.request) {
      return
    }

    if (state.status === 'success' && state.result && !state.result.is_placeholder_analysis) {
      const nextHintLevel = Math.min((detailPanels.hint?.hint_level ?? 0) + 1, 3)
      void extensionRuntime.runtime.sendMessage({
        type: 'request_hint',
        payload: state.request,
        failure: {
          reason: 'failed',
          summary: 'The user requested a progressive hint after reviewing their solution.',
        },
        hintLevel: nextHintLevel,
      } satisfies RuntimeMessage)
      return
    }

    if (state.status !== 'failed' || !state.coaching) {
      return
    }

    void extensionRuntime.runtime.sendMessage({
      type: 'request_hint',
      payload: state.request,
      failure: state.coaching.failure,
      hintLevel: state.coaching.hintLevel + 1,
    } satisfies RuntimeMessage)
  }

  const requestGiveUp = () => {
    if (!state.request) {
      return
    }

    if (state.status === 'success' && state.result && !state.result.is_placeholder_analysis) {
      void extensionRuntime.runtime.sendMessage({
        type: 'request_give_up',
        payload: state.request,
        failure: {
          reason: 'failed',
          summary: 'The user requested the full optimal solution after reviewing their solution.',
        },
      } satisfies RuntimeMessage)
      return
    }

    if (state.status !== 'failed' || !state.coaching) {
      return
    }

    void extensionRuntime.runtime.sendMessage({
      type: 'request_give_up',
      payload: state.request,
      failure: state.coaching.failure,
    } satisfies RuntimeMessage)
  }

  if (panelMode === 'closed') {
    return (
      <button className="lcai-launcher" type="button" onClick={() => setPanelMode('open')}>
        AI Analysis
      </button>
    )
  }

  if (panelMode === 'minimized') {
    return (
      <div className="lcai-minimized">
        <button className="lcai-icon-button" type="button" onClick={() => setPanelMode('open')} aria-label="Open AI Analysis">
          AI
        </button>
        <span className="lcai-muted">{subtitle}</span>
        <button className="lcai-icon-button" type="button" onClick={() => setPanelMode('closed')} aria-label="Close AI Analysis">
          ×
        </button>
      </div>
    )
  }

  return (
    <aside className="lcai-panel">
      <div className="lcai-header">
        <div>
          <h2 className="lcai-title">AI Analysis</h2>
          <p className="lcai-subtitle">{subtitle}</p>
        </div>
        <div className="lcai-header-actions">
          <button className="lcai-icon-button" type="button" onClick={() => setPanelMode('minimized')} aria-label="Minimize AI Analysis">
            −
          </button>
          <button className="lcai-icon-button" type="button" onClick={() => setPanelMode('closed')} aria-label="Close AI Analysis">
            ×
          </button>
        </div>
      </div>
      <div className="lcai-body">
        {state.status === 'idle' ? <p className="lcai-empty">Run your code to start an analysis.</p> : null}

        {state.status === 'loading' ? (
          <div className="lcai-card">
            <span className="lcai-chip">Analyzing...</span>
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div className="lcai-card">
            <span className="lcai-chip warn">{state.error ?? 'Analysis unavailable.'}</span>
          </div>
        ) : null}

        {state.status === 'failed' && state.coaching ? (
          <>
            <section className="lcai-card">
              <h3 className="lcai-section-title">Try Again</h3>
              <span className="lcai-chip warn">{state.coaching.failure.reason.replaceAll('_', ' ')}</span>
              <p className="lcai-value" style={{ marginTop: '10px' }}>
                {state.coaching.failure.summary}
              </p>
              {state.coaching.failure.details ? (
                <p className="lcai-value lcai-muted" style={{ marginTop: '10px' }}>
                  {state.coaching.failure.details}
                </p>
              ) : null}
              <div className="lcai-actions">
                <button
                  className="lcai-button"
                  type="button"
                  disabled={
                    state.coaching.actionLoading === 'hint' ||
                    state.coaching.hintLevel >= state.coaching.maxHintLevel
                  }
                  onClick={requestNextHint}
                >
                  {state.coaching.hintLevel === 0 ? 'Show Hint' : `Show Hint ${state.coaching.hintLevel + 1}`}
                </button>
                <button
                  className="lcai-button secondary"
                  type="button"
                  disabled={state.coaching.actionLoading === 'give_up'}
                  onClick={requestGiveUp}
                >
                  I Give Up
                </button>
              </div>
            </section>

            {state.coaching.encouragement ? (
              <section className="lcai-card">
                <h3 className="lcai-section-title">Coach Note</h3>
                <p className="lcai-value">{state.coaching.encouragement}</p>
              </section>
            ) : null}

            {state.coaching.hints.length > 0 ? (
              <section className="lcai-card">
                <h3 className="lcai-section-title">Progressive Hints</h3>
                <ol className="lcai-list">
                  {state.coaching.hints.map((hint, index) => (
                    <li key={`${index}-${hint}`}>
                      <strong>Hint {index + 1}:</strong> {hint}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {state.coaching.giveUp ? (
              <>
                <section className="lcai-card">
                  <h3 className="lcai-section-title">Reference Solution</h3>
                  <div className="lcai-grid">
                    <div className="lcai-grid-item">
                      <span className="lcai-label">User Pattern</span>
                      <p className="lcai-value">{state.coaching.giveUp.user_pattern}</p>
                    </div>
                    <div className="lcai-grid-item">
                      <span className="lcai-label">Optimal Pattern</span>
                      <p className="lcai-value">{state.coaching.giveUp.optimal_pattern}</p>
                    </div>
                    <div className="lcai-grid-item">
                      <span className="lcai-label">Time Complexity</span>
                      {renderComplexityValue(state.coaching.giveUp.time_complexity)}
                    </div>
                    <div className="lcai-grid-item">
                      <span className="lcai-label">Space Complexity</span>
                      {renderComplexityValue(state.coaching.giveUp.space_complexity)}
                    </div>
                  </div>
                </section>

                <section className="lcai-card">
                  <h3 className="lcai-section-title">Key Steps</h3>
                  <ol className="lcai-list">
                    {state.coaching.giveUp.key_steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </section>

                <section className="lcai-card">
                  <h3 className="lcai-section-title">Solution Explanation</h3>
                  <p className="lcai-value lcai-muted">{state.coaching.giveUp.solution_explanation}</p>
                </section>

                <section className="lcai-card">
                  <h3 className="lcai-section-title">Reference Code</h3>
                  <pre className="lcai-code">{state.coaching.giveUp.solution_code}</pre>
                </section>
              </>
            ) : null}
          </>
        ) : null}

        {state.status === 'success' && state.result ? (
          <>
            <section className="lcai-card">
              <div className="lcai-inline-meta" style={{ justifyContent: 'space-between' }}>
                <h3 className="lcai-section-title" style={{ margin: 0 }}>Your Solution</h3>
                {renderOptimality(state.result.optimal)}
              </div>
              <div className="lcai-grid" style={{ marginTop: '12px' }}>
                <div className="lcai-grid-item">
                  <span className="lcai-label">Pattern Used</span>
                  <p className="lcai-value">{state.result.user_pattern}</p>
                </div>
                <div className="lcai-grid-item">
                  <span className="lcai-label">Correctness</span>
                  <p className="lcai-value">{state.result.correctness}</p>
                </div>
                <div className="lcai-grid-item">
                  <span className="lcai-label">Time Complexity</span>
                  {renderComplexityValue(state.result.time_complexity)}
                </div>
                <div className="lcai-grid-item">
                  <span className="lcai-label">Space Complexity</span>
                  {renderComplexityValue(state.result.space_complexity)}
                </div>
                <div className="lcai-grid-item">
                  <span className="lcai-label">Optimality</span>
                  {renderOptimality(state.result.optimal)}
                </div>
                <div className="lcai-grid-item">
                  <span className="lcai-label">Confidence</span>
                  <p className="lcai-value">
                    {state.result.is_placeholder_analysis ? 'N/A' : `${Math.round(state.result.confidence * 100)}%`}
                  </p>
                </div>
              </div>
            </section>

            {!state.result.is_placeholder_analysis ? (
              <section className="lcai-card">
                <h3 className="lcai-section-title">Actions</h3>
                <div className="lcai-action-grid">
                  <button
                    className="lcai-action-tile"
                    type="button"
                    disabled={detailPanels.loading === 'hint' || detailPanels.hint?.hint_level === 3}
                    onClick={requestNextHint}
                  >
                    {detailPanels.loading === 'hint' ? 'Loading Hint...' : 'Show Hint'}
                  </button>
                  <button
                    className="lcai-action-tile"
                    type="button"
                    onClick={() => setDetailPanels((details) => ({ ...details, showExplanation: !details.showExplanation }))}
                  >
                    Show Explanation
                  </button>
                  <button
                    className="lcai-action-tile"
                    type="button"
                    disabled={detailPanels.loading === 'optimal_solution'}
                    onClick={requestGiveUp}
                  >
                    {detailPanels.loading === 'optimal_solution' ? 'Loading Solution...' : 'Show Optimal Solution'}
                  </button>
                  <button
                    className="lcai-action-tile"
                    type="button"
                    onClick={() =>
                      setDetailPanels((details) => ({
                        ...details,
                        showPatternBreakdown: !details.showPatternBreakdown,
                      }))
                    }
                  >
                    Show Pattern Breakdown
                  </button>
                </div>
              </section>
            ) : null}

            {detailPanels.showHint && detailPanels.hint ? (
              <section className="lcai-card">
                <h3 className="lcai-section-title">Hint {detailPanels.hint.hint_level}</h3>
                <p className="lcai-value">{detailPanels.hint.hint}</p>
                <p className="lcai-value lcai-muted" style={{ marginTop: '10px' }}>
                  {detailPanels.hint.encouragement}
                </p>
              </section>
            ) : null}

            {detailPanels.showExplanation ? (
              <section className="lcai-card">
                <h3 className="lcai-section-title">Explanation</h3>
                <p className="lcai-value lcai-muted">{state.result.explanation}</p>
              </section>
            ) : null}

            {detailPanels.showOptimalSolution && detailPanels.optimalSolution ? (
              <>
                <section className="lcai-card">
                  <h3 className="lcai-section-title">Optimal Solution</h3>
                  <div className="lcai-grid">
                    <div className="lcai-grid-item">
                      <span className="lcai-label">Optimal Pattern</span>
                      <p className="lcai-value">{detailPanels.optimalSolution.optimal_pattern}</p>
                    </div>
                    <div className="lcai-grid-item">
                      <span className="lcai-label">Time Complexity</span>
                      {renderComplexityValue(detailPanels.optimalSolution.time_complexity)}
                    </div>
                    <div className="lcai-grid-item">
                      <span className="lcai-label">Space Complexity</span>
                      {renderComplexityValue(detailPanels.optimalSolution.space_complexity)}
                    </div>
                  </div>
                </section>
                <section className="lcai-card">
                  <h3 className="lcai-section-title">Reference Code</h3>
                  <pre className="lcai-code">{detailPanels.optimalSolution.solution_code}</pre>
                </section>
              </>
            ) : null}

            {detailPanels.showPatternBreakdown ? (
              <>
                <section className="lcai-card">
                  <h3 className="lcai-section-title">Pattern Breakdown</h3>
                  <div className="lcai-row">
                    <span className="lcai-muted">User Pattern</span>
                    <span className="lcai-value">{state.result.user_pattern}</span>
                  </div>
                  <div className="lcai-row">
                    <span className="lcai-muted">Optimal Pattern</span>
                    <span className="lcai-value">{state.result.optimal_pattern}</span>
                  </div>
                  <div className="lcai-row">
                    <span className="lcai-muted">Key Insight</span>
                    <span className="lcai-value">{state.result.key_insight}</span>
                  </div>
                  <div className="lcai-row">
                    <span className="lcai-muted">Alternative</span>
                    <span className="lcai-value">{state.result.alternative_approach}</span>
                  </div>
                </section>

                <section className="lcai-card">
                  <h3 className="lcai-section-title">Practice Next (Your Style)</h3>
                  {renderRecommendations(state.result.recommended_problems_user_pattern)}
                </section>

                <section className="lcai-card">
                  <h3 className="lcai-section-title">Practice Next (Optimal Style)</h3>
                  {renderRecommendations(state.result.recommended_problems_optimal_pattern)}
                </section>
              </>
            ) : null}

            <section className="lcai-card">
              <h3 className="lcai-section-title">Pattern Progress</h3>
              <div className="lcai-kv">
                <span className="lcai-muted">Total Solved</span>
                <span className="lcai-value">{state.result.analytics.total_solved}</span>
              </div>
              <span className="lcai-label">Top Patterns Used</span>
              {renderProgressRows(state.result.analytics.pattern_usage)}
              <span className="lcai-label" style={{ marginTop: '14px' }}>Top Optimal Patterns</span>
              {renderProgressRows(state.result.analytics.optimal_pattern_distribution)}
            </section>

            {!state.result.is_placeholder_analysis ? (
              <>
                <section className="lcai-card">
                  <h3 className="lcai-section-title">Most Missed Optimal Patterns</h3>
                  {renderPatternCountList(state.result.analytics.most_missed_optimal_patterns)}
                </section>

                <section className="lcai-card">
                  <h3 className="lcai-section-title">Learning Insights</h3>
                  {state.result.analytics.learning_insights.length > 0 ? (
                    <ul className="lcai-list">
                      {state.result.analytics.learning_insights.map((insight) => (
                        <li key={insight}>{insight}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="lcai-empty">More runs will unlock pattern insights.</p>
                  )}
                </section>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  )
}

injectPageBridge()

const shadowRoot = createHost()
const appRoot = document.createElement('div')
shadowRoot.appendChild(appRoot)
createRoot(appRoot).render(<App />)
