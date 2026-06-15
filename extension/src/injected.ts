import type { AnalyzerRequest, ExecutionFailure, ExecutionFailureReason } from './types'

const INTERPRET_PATTERN = /\/problems\/[^/]+\/interpret_solution\/?$/
const SUBMIT_PATTERN = /\/problems\/[^/]+\/submit\/?$/
const RUNCODE_CHECK_PATTERN = /\/submissions\/detail\/runcode\/[^/]+\/check\/?$/
const SUBMISSION_CHECK_PATTERN = /\/submissions\/detail\/[^/]+\/check\/?$/
const RECENT_WINDOW_MS = 1500

let lastFingerprint = ''
let lastSeenAt = 0
let pendingRequest: AnalyzerRequest | null = null

console.debug('[lc-ai] injected request bridge booted')

function isInterestingUrl(url: string): 'run' | 'submit' | null {
  if (INTERPRET_PATTERN.test(url)) {
    return 'run'
  }

  if (SUBMIT_PATTERN.test(url)) {
    return 'submit'
  }

  return null
}

function isCheckUrl(url: string): boolean {
  return RUNCODE_CHECK_PATTERN.test(url) || SUBMISSION_CHECK_PATTERN.test(url)
}

function parseBody(body: BodyInit | XMLHttpRequestBodyInit | null | undefined): Record<string, unknown> | null {
  if (body === null || body === undefined) {
    return null
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return null
    }
  }

  if (body instanceof URLSearchParams) {
    const typedCode = body.get('typed_code')
    if (typedCode === null) {
      return null
    }

    return {
      typed_code: typedCode,
      lang: body.get('lang') ?? '',
      question_id: body.get('question_id') ?? '',
    }
  }

  if (body instanceof Document || body instanceof FormData) {
    return null
  }

  return null
}

function queueCapturedRequest(rawUrl: string, body: BodyInit | XMLHttpRequestBodyInit | null | undefined): void {
  const source = isInterestingUrl(rawUrl)
  if (!source) {
    return
  }

  const parsed = parseBody(body)
  if (!parsed || typeof parsed.typed_code !== 'string') {
    pendingRequest = null
    return
  }

  const lang = typeof parsed.lang === 'string' ? parsed.lang : ''
  const questionId = typeof parsed.question_id === 'string' ? parsed.question_id : ''
  const fingerprint = `${source}:${questionId}:${lang}:${parsed.typed_code}`
  const now = Date.now()

  if (fingerprint === lastFingerprint && now - lastSeenAt < RECENT_WINDOW_MS) {
    return
  }

  lastFingerprint = fingerprint
  lastSeenAt = now

  pendingRequest = {
    requestId: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    question_id: questionId,
    lang,
    code: parsed.typed_code,
    leetcode_url: window.location.href,
    source,
  }

  console.debug('[lc-ai] queued outbound LeetCode request', pendingRequest)
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  return typeof value === 'string' ? value : ''
}

function isTerminalSuccess(payload: Record<string, unknown>, requestSource: 'run' | 'submit'): boolean {
  const state = readStringField(payload, 'state').toUpperCase()
  const runSuccess = state === 'SUCCESS'
  const submitSuccess =
    state === 'SUCCESS' ||
    readStringField(payload, 'status_msg').toUpperCase() === 'ACCEPTED' ||
    readStringField(payload, 'status_runtime').length > 0

  return requestSource === 'submit' ? submitSuccess : runSuccess
}

function getCorrectnessLabel(payload: Record<string, unknown>, requestSource: 'run' | 'submit'): string {
  const statusMsg = readStringField(payload, 'status_msg')
  if (requestSource === 'submit' && statusMsg) {
    return statusMsg
  }

  return 'Passed latest run'
}

function buildFailure(payload: Record<string, unknown>): ExecutionFailure | null {
  const compileError = readStringField(payload, 'compile_error') || readStringField(payload, 'full_compile_error')
  if (compileError) {
    return {
      reason: 'compile_error',
      summary: 'Compile error. Try fixing syntax, types, or missing declarations first.',
      details: compileError,
    }
  }

  const runtimeError = readStringField(payload, 'runtime_error')
  if (runtimeError) {
    return {
      reason: 'runtime_error',
      summary: 'Runtime error. Your logic is close enough to execute, but it breaks on some path.',
      details: runtimeError,
    }
  }

  const statusMsg = readStringField(payload, 'status_msg').toUpperCase()
  const expectedOutput = readStringField(payload, 'expected_code_output')
  const codeOutput = readStringField(payload, 'code_output')

  const statusMap: Array<[ExecutionFailureReason, string]> = [
    ['time_limit', 'TIME LIMIT EXCEEDED'],
    ['memory_limit', 'MEMORY LIMIT EXCEEDED'],
    ['output_limit', 'OUTPUT LIMIT EXCEEDED'],
    ['internal_error', 'INTERNAL ERROR'],
    ['wrong_answer', 'WRONG ANSWER'],
  ]

  for (const [reason, token] of statusMap) {
    if (statusMsg.includes(token)) {
      return {
        reason,
        summary:
          reason === 'wrong_answer'
            ? 'Wrong answer. The code runs, but the logic or edge-case handling is still off.'
            : statusMsg,
        details: expectedOutput
          ? `Expected: ${expectedOutput}\nReceived: ${codeOutput || 'N/A'}`
          : statusMsg,
      }
    }
  }

  if (expectedOutput) {
    return {
      reason: 'wrong_answer',
      summary: 'Wrong answer. The code runs, but the output does not match the expected result.',
      details: `Expected: ${expectedOutput}\nReceived: ${codeOutput || 'N/A'}`,
    }
  }

  const genericError = readStringField(payload, 'error')
  if (genericError) {
    return {
      reason: 'failed',
      summary: 'This attempt did not pass. Try again or ask for a hint.',
      details: genericError,
    }
  }

  return null
}

function maybeEmitAnalysisFromCheck(rawUrl: string, responseText: string): void {
  if (!pendingRequest || !isCheckUrl(rawUrl)) {
    return
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(responseText) as Record<string, unknown>
  } catch {
    return
  }

  const failure = buildFailure(parsed)
  if (failure) {
    console.debug('[lc-ai] LeetCode execution failed, emitting coaching payload', failure)
    window.postMessage(
      { type: 'LC_ANALYZER_EXECUTION_FAILED', payload: pendingRequest, failure },
      window.location.origin,
    )
    pendingRequest = null
    return
  }

  if (!isTerminalSuccess(parsed, pendingRequest.source)) {
    return
  }

  pendingRequest = {
    ...pendingRequest,
    correctness: getCorrectnessLabel(parsed, pendingRequest.source),
  }

  console.debug('[lc-ai] LeetCode execution succeeded, emitting analysis payload', pendingRequest)
  window.postMessage({ type: 'LC_ANALYZER_CAPTURED', payload: pendingRequest }, window.location.origin)
  pendingRequest = null
}

async function queueCapturedRequestFromFetch(input: RequestInfo | URL, init?: RequestInit): Promise<void> {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

  if (init?.body !== undefined) {
    queueCapturedRequest(url, init.body)
    return
  }

  if (input instanceof Request) {
    try {
      const cloned = input.clone()
      const contentType = cloned.headers.get('content-type') ?? ''
      if (contentType.includes('application/json') || contentType.includes('application/x-www-form-urlencoded')) {
        const text = await cloned.text()
        queueCapturedRequest(url, text)
      }
    } catch (error) {
      console.warn('[lc-ai] failed to inspect fetch Request body', error)
    }
  }
}

async function inspectFetchResponse(input: RequestInfo | URL, response: Response): Promise<void> {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
  if (!isCheckUrl(url) || !response.ok) {
    return
  }

  try {
    const responseText = await response.clone().text()
    maybeEmitAnalysisFromCheck(url, responseText)
  } catch (error) {
    console.warn('[lc-ai] failed to inspect fetch response', error)
  }
}

const originalFetch = window.fetch
window.fetch = async (input, init) => {
  await queueCapturedRequestFromFetch(input, init)
  const response = await originalFetch(input, init)
  await inspectFetchResponse(input, response)
  return response
}

const originalOpen = XMLHttpRequest.prototype.open
const originalSend = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function open(
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null,
) {
  ;(this as XMLHttpRequest & {
    __lcAnalyzerUrl?: string
    __lcAnalyzerMethod?: string
  }).__lcAnalyzerUrl = String(url)
  ;(this as XMLHttpRequest & {
    __lcAnalyzerUrl?: string
    __lcAnalyzerMethod?: string
  }).__lcAnalyzerMethod = method

  return originalOpen.call(this, method, url, async ?? true, username ?? null, password ?? null)
}

XMLHttpRequest.prototype.send = function send(body?: Document | XMLHttpRequestBodyInit | null) {
  const request = this as XMLHttpRequest & {
    __lcAnalyzerUrl?: string
    __lcAnalyzerMethod?: string
  }

  if (request.__lcAnalyzerMethod?.toUpperCase() === 'POST' && request.__lcAnalyzerUrl) {
    queueCapturedRequest(request.__lcAnalyzerUrl, body instanceof Document ? null : body)
  }

  if (request.__lcAnalyzerUrl && isCheckUrl(request.__lcAnalyzerUrl)) {
    this.addEventListener('load', () => {
      if (this.status >= 200 && this.status < 300 && request.__lcAnalyzerUrl) {
        maybeEmitAnalysisFromCheck(request.__lcAnalyzerUrl, this.responseText)
      }
    })
  }

  return originalSend.call(this, body)
}
