import { extensionRuntime } from './runtime'
import type {
  AnalyzerRequest,
  AnalyzerResponse,
  ExecutionFailure,
  GiveUpResponse,
  HintResponse,
  RuntimeMessage,
} from './types'

const API_BASE_URL = 'http://127.0.0.1:8000'

async function postJson<TResponse>(path: string, body: Record<string, unknown>): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Backend error (${response.status})`)
  }

  return (await response.json()) as TResponse
}

async function analyzeSolution(payload: AnalyzerRequest): Promise<AnalyzerResponse> {
  return postJson<AnalyzerResponse>('/analyze', {
    question_id: payload.question_id,
    lang: payload.lang,
    code: payload.code,
    leetcode_url: payload.leetcode_url,
    correctness: payload.correctness,
  })
}

async function requestHint(
  payload: AnalyzerRequest,
  failure: ExecutionFailure,
  hintLevel: number,
): Promise<HintResponse> {
  return postJson<HintResponse>('/hint', {
    question_id: payload.question_id,
    lang: payload.lang,
    code: payload.code,
    leetcode_url: payload.leetcode_url,
    failure_reason: failure.reason,
    failure_details: failure.details ?? failure.summary,
    hint_level: hintLevel,
  })
}

async function requestGiveUp(
  payload: AnalyzerRequest,
  failure: ExecutionFailure,
): Promise<GiveUpResponse> {
  return postJson<GiveUpResponse>('/give-up', {
    question_id: payload.question_id,
    lang: payload.lang,
    code: payload.code,
    leetcode_url: payload.leetcode_url,
    failure_reason: failure.reason,
    failure_details: failure.details ?? failure.summary,
    hint_level: 3,
  })
}

async function sendToTab(tabId: number, message: RuntimeMessage): Promise<void> {
  await extensionRuntime.tabs.sendMessage(tabId, message)
}

extensionRuntime.runtime.onMessage.addListener((
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
) => {
  if (sender.tab?.id === undefined) {
    return false
  }

  const tabId = sender.tab.id

  if (message.type === 'analyze_solution') {
    console.debug('[lc-ai] background received analyze request', message.payload)

    void (async () => {
      await sendToTab(tabId, { type: 'analysis_started', payload: message.payload })

      try {
        const result = await analyzeSolution(message.payload)
        console.debug('[lc-ai] background received backend result', result)
        await sendToTab(tabId, {
          type: 'analysis_result',
          payload: message.payload,
          result,
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Analysis unavailable.'
        console.error('[lc-ai] background failed to analyze', detail)
        await sendToTab(tabId, {
          type: 'analysis_error',
          payload: message.payload,
          error: detail,
        })
      }
    })()

    return false
  }

  if (message.type === 'request_hint') {
    void (async () => {
      await sendToTab(tabId, {
        type: 'hint_started',
        payload: message.payload,
        hintLevel: message.hintLevel,
      })

      try {
        const result = await requestHint(message.payload, message.failure, message.hintLevel)
        await sendToTab(tabId, {
          type: 'hint_result',
          payload: message.payload,
          result,
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Hint unavailable.'
        await sendToTab(tabId, {
          type: 'analysis_error',
          payload: message.payload,
          error: detail,
        })
      }
    })()

    return false
  }

  if (message.type === 'request_give_up') {
    void (async () => {
      await sendToTab(tabId, {
        type: 'give_up_started',
        payload: message.payload,
      })

      try {
        const result = await requestGiveUp(message.payload, message.failure)
        await sendToTab(tabId, {
          type: 'give_up_result',
          payload: message.payload,
          result,
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Solution unavailable.'
        await sendToTab(tabId, {
          type: 'analysis_error',
          payload: message.payload,
          error: detail,
        })
      }
    })()

    return false
  }

  return false
})
