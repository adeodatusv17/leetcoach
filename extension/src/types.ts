export type AnalyzerRequest = {
  requestId: string
  question_id: string
  lang: string
  code: string
  leetcode_url: string
  source: 'run' | 'submit'
  correctness?: string
}

export type ExecutionFailureReason =
  | 'compile_error'
  | 'runtime_error'
  | 'wrong_answer'
  | 'time_limit'
  | 'memory_limit'
  | 'output_limit'
  | 'internal_error'
  | 'failed'

export type ExecutionFailure = {
  reason: ExecutionFailureReason
  summary: string
  details?: string
}

export type RecommendationProblem = {
  question_id: number
  title: string
  difficulty: string
  url: string
}

export type PatternCount = {
  pattern: string
  count: number
}

export type LearningAnalytics = {
  total_solved: number
  pattern_usage: Record<string, number>
  optimal_pattern_distribution: Record<string, number>
  most_missed_optimal_patterns: PatternCount[]
  learning_insights: string[]
}

export type AnalyzerResponse = {
  title: string
  difficulty: string
  user_pattern: string
  optimal_pattern: string
  time_complexity: string
  space_complexity: string
  correctness: string
  optimal: boolean | null
  is_placeholder_analysis: boolean
  confidence: number
  alternative_approach: string
  key_insight: string
  explanation: string
  recommended_problems_user_pattern: RecommendationProblem[]
  recommended_problems_optimal_pattern: RecommendationProblem[]
  analytics: LearningAnalytics
}

export type HintResponse = {
  title: string
  difficulty: string
  failure_reason: string
  encouragement: string
  hint_level: number
  max_hint_level: number
  hint: string
}

export type GiveUpResponse = {
  title: string
  difficulty: string
  user_pattern: string
  optimal_pattern: string
  time_complexity: string
  space_complexity: string
  solution_code: string
  solution_explanation: string
  key_steps: string[]
}

export type CoachingState = {
  failure: ExecutionFailure
  hints: string[]
  encouragement?: string
  hintLevel: number
  maxHintLevel: number
  giveUp?: GiveUpResponse
  actionLoading?: 'hint' | 'give_up'
}

export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error' | 'failed'

export type AnalysisState = {
  status: AnalysisStatus
  request?: AnalyzerRequest
  result?: AnalyzerResponse
  coaching?: CoachingState
  error?: string
}

export type RuntimeMessage =
  | { type: 'analyze_solution'; payload: AnalyzerRequest }
  | { type: 'analysis_started'; payload: AnalyzerRequest }
  | { type: 'analysis_result'; payload: AnalyzerRequest; result: AnalyzerResponse }
  | { type: 'analysis_error'; payload: AnalyzerRequest; error: string }
  | { type: 'execution_failed'; payload: AnalyzerRequest; failure: ExecutionFailure }
  | { type: 'request_hint'; payload: AnalyzerRequest; failure: ExecutionFailure; hintLevel: number }
  | { type: 'hint_started'; payload: AnalyzerRequest; hintLevel: number }
  | { type: 'hint_result'; payload: AnalyzerRequest; result: HintResponse }
  | { type: 'request_give_up'; payload: AnalyzerRequest; failure: ExecutionFailure }
  | { type: 'give_up_started'; payload: AnalyzerRequest }
  | { type: 'give_up_result'; payload: AnalyzerRequest; result: GiveUpResponse }

declare global {
  interface Window {
    browser?: typeof chrome
  }
}
