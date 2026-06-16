import { extensionRuntime } from './runtime'
import type {
  AnalyzerRequest,
  AnalyzerResponse,
  ExecutionFailure,
  GiveUpResponse,
  HintResponse,
  RuntimeMessage,
} from './types'

const LOCAL_API = 'http://127.0.0.1:8000'
const PROD_API = 'https://leetcoach-z7z6.onrender.com' 

async function fetchWithFallback(
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {

const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 1000)

try {
  const localResponse = await fetch(`${LOCAL_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })

  if (!localResponse.ok) {
    const text = await localResponse.text()
    throw new Error(text || `Backend error (${localResponse.status})`)
  }

  return localResponse
} catch (err) {
  if (
    err instanceof TypeError ||
    (err instanceof DOMException && err.name === 'AbortError')
  ) {
    const prodResponse = await fetch(`${PROD_API}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!prodResponse.ok) {
      const text = await prodResponse.text()
      throw new Error(text || `Backend error (${prodResponse.status})`)
    }

    return prodResponse
  }

  throw err
} finally {
  clearTimeout(timeout)
}
}
//   const prodResponse = await fetch(`${PROD_API}${path}`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(body),
//   })

//   if (!prodResponse.ok) {
//     const text = await prodResponse.text()
//     throw new Error(text || `Backend error (${prodResponse.status})`)
//   }

//   console.debug(`[lc-ai] using hosted backend: ${PROD_API}`)
//   return prodResponse
// }

async function postJson<TResponse>(
  path: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const response = await fetchWithFallback(path, body)
  return (await response.json()) as TResponse
}

async function analyzeSolution(
  payload: AnalyzerRequest,
): Promise<AnalyzerResponse> {
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

async function sendToTab(
  tabId: number,
  message: RuntimeMessage,
): Promise<void> {
  await extensionRuntime.tabs.sendMessage(tabId, message)
}

extensionRuntime.runtime.onMessage.addListener(
  (
    message: RuntimeMessage,
    sender: chrome.runtime.MessageSender,
  ) => {
    if (sender.tab?.id === undefined) {
      return false
    }

    const tabId = sender.tab.id

    if (message.type === 'analyze_solution') {
      console.debug(
        '[lc-ai] background received analyze request',
        message.payload,
      )

      void (async () => {
        await sendToTab(tabId, {
          type: 'analysis_started',
          payload: message.payload,
        })

        try {
          const result = await analyzeSolution(message.payload)

          await sendToTab(tabId, {
            type: 'analysis_result',
            payload: message.payload,
            result,
          })
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : 'Analysis unavailable.'

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
          const result = await requestHint(
            message.payload,
            message.failure,
            message.hintLevel,
          )

          await sendToTab(tabId, {
            type: 'hint_result',
            payload: message.payload,
            result,
          })
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : 'Hint unavailable.'

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
          const result = await requestGiveUp(
            message.payload,
            message.failure,
          )

          await sendToTab(tabId, {
            type: 'give_up_result',
            payload: message.payload,
            result,
          })
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : 'Solution unavailable.'

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
  },
)