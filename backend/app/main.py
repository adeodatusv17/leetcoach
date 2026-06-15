import json
import os
import re
from collections import Counter
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
HISTORY_PATH = DATA_DIR / "analysis_history.json"
PATTERNS_PATH = DATA_DIR / "patterns.json"
PROBLEMS_PATH = DATA_DIR / "problems.json"
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

load_dotenv(dotenv_path=ENV_PATH)

DEFAULT_PATTERNS = {
    "Hash Map": {"related_questions": [1, 49, 128, 347]},
    "Two Pointers": {"related_questions": [11, 15, 167, 283]},
    "Index Marking": {"related_questions": [41, 442, 448, 645, 287]},
    "Sliding Window": {"related_questions": [3, 76, 209, 438]},
    "DFS": {"related_questions": [200, 695, 733, 130]},
    "BFS": {"related_questions": [102, 127, 994, 752]},
    "Dynamic Programming": {"related_questions": [53, 62, 198, 322]},
    "Greedy": {"related_questions": [55, 134, 435, 452]},
    "Union Find": {"related_questions": [200, 547, 684, 721]},
}

DEFAULT_PROBLEMS = {
    "1": {"title": "Two Sum", "difficulty": "Easy", "url": "https://leetcode.com/problems/two-sum/"},
    "3": {
        "title": "Longest Substring Without Repeating Characters",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    },
    "11": {
        "title": "Container With Most Water",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/container-with-most-water/",
    },
    "15": {"title": "3Sum", "difficulty": "Medium", "url": "https://leetcode.com/problems/3sum/"},
    "41": {
        "title": "First Missing Positive",
        "difficulty": "Hard",
        "url": "https://leetcode.com/problems/first-missing-positive/",
    },
    "49": {
        "title": "Group Anagrams",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/group-anagrams/",
    },
    "53": {
        "title": "Maximum Subarray",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/maximum-subarray/",
    },
    "55": {"title": "Jump Game", "difficulty": "Medium", "url": "https://leetcode.com/problems/jump-game/"},
    "62": {"title": "Unique Paths", "difficulty": "Medium", "url": "https://leetcode.com/problems/unique-paths/"},
    "76": {
        "title": "Minimum Window Substring",
        "difficulty": "Hard",
        "url": "https://leetcode.com/problems/minimum-window-substring/",
    },
    "102": {
        "title": "Binary Tree Level Order Traversal",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/binary-tree-level-order-traversal/",
    },
    "127": {"title": "Word Ladder", "difficulty": "Hard", "url": "https://leetcode.com/problems/word-ladder/"},
    "128": {
        "title": "Longest Consecutive Sequence",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/longest-consecutive-sequence/",
    },
    "130": {
        "title": "Surrounded Regions",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/surrounded-regions/",
    },
    "134": {"title": "Gas Station", "difficulty": "Medium", "url": "https://leetcode.com/problems/gas-station/"},
    "167": {
        "title": "Two Sum II - Input Array Is Sorted",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/",
    },
    "198": {"title": "House Robber", "difficulty": "Medium", "url": "https://leetcode.com/problems/house-robber/"},
    "200": {
        "title": "Number of Islands",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/number-of-islands/",
    },
    "209": {
        "title": "Minimum Size Subarray Sum",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/minimum-size-subarray-sum/",
    },
    "283": {"title": "Move Zeroes", "difficulty": "Easy", "url": "https://leetcode.com/problems/move-zeroes/"},
    "287": {
        "title": "Find the Duplicate Number",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/find-the-duplicate-number/",
    },
    "322": {"title": "Coin Change", "difficulty": "Medium", "url": "https://leetcode.com/problems/coin-change/"},
    "347": {
        "title": "Top K Frequent Elements",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/top-k-frequent-elements/",
    },
    "435": {
        "title": "Non-overlapping Intervals",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/non-overlapping-intervals/",
    },
    "438": {
        "title": "Find All Anagrams in a String",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/find-all-anagrams-in-a-string/",
    },
    "442": {
        "title": "Find All Duplicates in an Array",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/find-all-duplicates-in-an-array/",
    },
    "448": {
        "title": "Find All Numbers Disappeared in an Array",
        "difficulty": "Easy",
        "url": "https://leetcode.com/problems/find-all-numbers-disappeared-in-an-array/",
    },
    "452": {
        "title": "Minimum Number of Arrows to Burst Balloons",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/minimum-number-of-arrows-to-burst-balloons/",
    },
    "547": {
        "title": "Number of Provinces",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/number-of-provinces/",
    },
    "645": {"title": "Set Mismatch", "difficulty": "Easy", "url": "https://leetcode.com/problems/set-mismatch/"},
    "684": {
        "title": "Redundant Connection",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/redundant-connection/",
    },
    "695": {
        "title": "Max Area of Island",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/max-area-of-island/",
    },
    "721": {
        "title": "Accounts Merge",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/accounts-merge/",
    },
    "733": {"title": "Flood Fill", "difficulty": "Easy", "url": "https://leetcode.com/problems/flood-fill/"},
    "752": {
        "title": "Open the Lock",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/open-the-lock/",
    },
    "994": {
        "title": "Rotting Oranges",
        "difficulty": "Medium",
        "url": "https://leetcode.com/problems/rotting-oranges/",
    },
}


class AnalyzeRequest(BaseModel):
    question_id: str = Field(min_length=1)
    lang: str = Field(min_length=1)
    code: str
    leetcode_url: str = Field(min_length=1)
    correctness: str | None = None


class CoachingRequest(AnalyzeRequest):
    failure_reason: str = Field(min_length=1)
    failure_details: str = ""
    hint_level: int = Field(default=1, ge=1, le=3)


class ProblemMetadata(BaseModel):
    title: str
    difficulty: str
    url: str


class StoredAnalysis(BaseModel):
    question_id: int
    title: str
    difficulty: str
    user_pattern: str
    optimal_pattern: str
    time_complexity: str
    space_complexity: str
    optimal: bool
    timestamp: str


class HistoryData(BaseModel):
    problems: list[StoredAnalysis]


class PatternCatalogEntry(BaseModel):
    related_questions: list[int]


class RecommendationProblem(BaseModel):
    question_id: int
    title: str
    difficulty: str
    url: str


class PatternCount(BaseModel):
    pattern: str
    count: int


class LearningAnalytics(BaseModel):
    total_solved: int
    pattern_usage: dict[str, int]
    optimal_pattern_distribution: dict[str, int]
    most_missed_optimal_patterns: list[PatternCount]
    learning_insights: list[str]


class LLMAnalysis(BaseModel):
    user_pattern: str
    optimal_pattern: str
    time_complexity: str
    space_complexity: str
    optimal: bool | None
    confidence: float = Field(ge=0.0, le=1.0)
    alternative_approach: str
    key_insight: str
    explanation: str


class AnalyzeResponse(LLMAnalysis):
    title: str
    difficulty: str
    correctness: str
    is_placeholder_analysis: bool
    recommended_problems_user_pattern: list[RecommendationProblem]
    recommended_problems_optimal_pattern: list[RecommendationProblem]
    analytics: LearningAnalytics


class HintLLMResponse(BaseModel):
    encouragement: str
    hint: str


class HintResponse(BaseModel):
    title: str
    difficulty: str
    failure_reason: str
    encouragement: str
    hint_level: int
    max_hint_level: int
    hint: str


class GiveUpLLMResponse(BaseModel):
    user_pattern: str
    optimal_pattern: str
    time_complexity: str
    space_complexity: str
    solution_code: str
    solution_explanation: str
    key_steps: list[str]


class GiveUpResponse(BaseModel):
    title: str
    difficulty: str
    user_pattern: str
    optimal_pattern: str
    time_complexity: str
    space_complexity: str
    solution_code: str
    solution_explanation: str
    key_steps: list[str]


SYSTEM_INSTRUCTION = """You are a senior algorithms interviewer.

Analyze a LeetCode solution.

Identify:
1. The pattern actually used in the submitted code.
2. The time complexity of the user's actual code.
3. The auxiliary space complexity of the user's actual code.
4. The asymptotically optimal pattern for the problem.
5. Whether the user's implemented approach is optimal.
6. Key insight.
7. Alternative approach.

Important:
"user_pattern" refers to the approach implemented in the code.
"optimal_pattern" refers to the approach an interviewer would generally consider optimal.
These may differ.

Return JSON only and use standard interview terminology.

Focus on the user's actual code first. Do not center the answer on the optimal solution.
Do not use unexplained symbolic complexity variables like H, K, V, or E.
If a tree-height style complexity appears, prefer user-friendly reporting such as:
"Average: O(log N), Worst: O(N)".

Prefer specific patterns such as:
Sliding Window, Two Pointers, Binary Search, DFS, BFS, Dynamic Programming,
Greedy, Backtracking, Union Find, Monotonic Stack, Monotonic Queue, Prefix Sum,
Difference Array, Heap, Trie, Segment Tree, Fenwick Tree, Topological Sort,
Index Marking, Cyclic Sort, Bit Manipulation, Hash Map.
"""

HINT_SYSTEM_INSTRUCTION = """You are a patient DSA coach.

The user wants a progressive hint for a LeetCode problem.
Provide a progressive hint and do not reveal the full solution.

Rules:
1. Respect the requested hint level.
2. Hint level 1: high-level nudge about the right direction or pattern.
3. Hint level 2: more concrete structural guidance, but still no full algorithm dump.
4. Hint level 3: near-solution guidance, including the key invariant or data structure, but still no full code.
5. Keep the user motivated to try again.
6. Return valid JSON only.
"""

GIVE_UP_SYSTEM_INSTRUCTION = """You are a senior algorithms coach.

The user explicitly gave up and wants a full reference solution.

Return:
1. The pattern used by the user's current code.
2. The optimal pattern for the problem.
3. Time complexity.
4. Space complexity.
5. A correct reference solution in the requested language.
6. A concise explanation.
7. A short list of key steps.

Return valid JSON only.
"""


def build_prompt(payload: AnalyzeRequest) -> str:
    return f"""Language: {payload.lang}
Question ID: {payload.question_id}
LeetCode URL: {payload.leetcode_url}

Code:
{payload.code}
"""


def build_hint_prompt(payload: CoachingRequest, metadata: ProblemMetadata) -> str:
    return f"""Problem Title: {metadata.title}
Difficulty: {metadata.difficulty}
Language: {payload.lang}
Question ID: {payload.question_id}
LeetCode URL: {payload.leetcode_url}
Failure Reason: {payload.failure_reason}
Failure Details: {payload.failure_details or "None provided"}
Requested Hint Level: {payload.hint_level}

Current Code:
{payload.code}
"""


def build_give_up_prompt(payload: CoachingRequest, metadata: ProblemMetadata) -> str:
    return f"""Problem Title: {metadata.title}
Difficulty: {metadata.difficulty}
Language: {payload.lang}
Question ID: {payload.question_id}
LeetCode URL: {payload.leetcode_url}
Failure Reason: {payload.failure_reason}
Failure Details: {payload.failure_details or "None provided"}

Current Code:
{payload.code}
"""


def strip_comments(code: str) -> str:
    without_block_comments = re.sub(r"/\*.*?\*/", "", code, flags=re.DOTALL)
    without_line_comments = re.sub(r"//.*?$", "", without_block_comments, flags=re.MULTILINE)
    without_hash_comments = re.sub(r"#.*?$", "", without_line_comments, flags=re.MULTILINE)
    return without_hash_comments


def is_empty_or_template_code(code: str) -> bool:
    stripped = strip_comments(code).strip()
    if not stripped:
        return True

    normalized = re.sub(r"\s+", " ", stripped).strip()
    compact = re.sub(r"\s+", "", stripped)

    if compact in {
        "classSolution{}",
        "classSolution{public:}",
        "classSolution{public:private:}",
        "classSolution{public:};",
        "classSolution{public:private:};",
        "pass",
    }:
        return True

    placeholder_return_patterns = [
        r"return\s*\{\s*\}\s*;",
        r"return\s*\[\s*\]\s*;",
        r"return\s*0\s*;",
        r"return\s*false\s*;",
        r"return\s*true\s*;",
        r"return\s*null\s*;",
        r"return\s*nullptr\s*;",
        r"return\s*None\s*$",
        r"return\s*;\s*$",
        r"pass\s*$",
    ]

    has_placeholder_return = any(
        re.search(pattern, normalized, flags=re.IGNORECASE) for pattern in placeholder_return_patterns
    )
    has_meaningful_logic = bool(
        re.search(
            r"\b(for|while|if|elif|else|switch|case|dfs|bfs|sort|unordered_map|hash|set|stack|queue|priority_queue|recurs|memo|dp|binary_search)\b",
            normalized,
            flags=re.IGNORECASE,
        )
    )

    return has_placeholder_return and not has_meaningful_logic


def normalize_complexity(raw_complexity: str) -> str:
    value = raw_complexity.strip()
    if not value:
        return "N/A"

    normalized = re.sub(r"\s+", " ", value)
    if re.search(r"O\(\s*[Hh]\s*\)", normalized):
        return "Average: O(log N), Worst: O(N)"

    return normalized


@lru_cache(maxsize=1)
def get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY environment variable.")

    return genai.Client(api_key=api_key)


def get_model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def is_retryable_gemini_error(error: Exception) -> bool:
    message = str(error)
    return "503" in message or "UNAVAILABLE" in message or "429" in message


def ensure_json_file(path: Path, default_content: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(json.dumps(default_content, indent=2), encoding="utf-8")


def ensure_data_files() -> None:
    ensure_json_file(HISTORY_PATH, {"problems": []})
    ensure_json_file(PATTERNS_PATH, DEFAULT_PATTERNS)
    ensure_json_file(PROBLEMS_PATH, DEFAULT_PROBLEMS)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def slug_to_title(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.split("-"))


def get_problem_metadata(question_id: str, leetcode_url: str) -> ProblemMetadata:
    problems = read_json(PROBLEMS_PATH)
    existing = problems.get(question_id)
    if existing:
        return ProblemMetadata.model_validate(existing)

    slug = leetcode_url.rstrip("/").split("/problems/")[-1].split("/")[0]
    metadata = ProblemMetadata(
        title=slug_to_title(slug) if slug else f"Problem {question_id}",
        difficulty="Unknown",
        url=leetcode_url,
    )
    problems[question_id] = metadata.model_dump()
    write_json(PROBLEMS_PATH, problems)
    return metadata


def get_pattern_catalog() -> dict[str, PatternCatalogEntry]:
    raw_catalog = read_json(PATTERNS_PATH)
    return {
        pattern: PatternCatalogEntry.model_validate(payload)
        for pattern, payload in raw_catalog.items()
    }


def get_history() -> HistoryData:
    return HistoryData.model_validate(read_json(HISTORY_PATH))


def save_history(history: HistoryData) -> None:
    write_json(HISTORY_PATH, history.model_dump())


def build_recommendations(
    pattern: str,
    current_question_id: str,
    problems: dict[str, dict],
    pattern_catalog: dict[str, PatternCatalogEntry],
) -> list[RecommendationProblem]:
    entry = pattern_catalog.get(pattern)
    if not entry:
        return []

    recommendations: list[RecommendationProblem] = []
    for related_question in entry.related_questions:
        if str(related_question) == current_question_id:
            continue

        metadata = problems.get(str(related_question))
        if not metadata:
            continue

        recommendations.append(
            RecommendationProblem(
                question_id=related_question,
                title=metadata["title"],
                difficulty=metadata["difficulty"],
                url=metadata["url"],
            )
        )

        if len(recommendations) == 3:
            break

    return recommendations


def upsert_analysis(history: HistoryData, entry: StoredAnalysis) -> HistoryData:
    updated = False
    for index, existing in enumerate(history.problems):
        if existing.question_id == entry.question_id:
            history.problems[index] = entry
            updated = True
            break

    if not updated:
        history.problems.append(entry)

    history.problems.sort(key=lambda item: item.timestamp, reverse=True)
    return history


def top_counts(counter: Counter[str], limit: int | None = None) -> dict[str, int]:
    items = counter.most_common(limit)
    return {pattern: count for pattern, count in items}


def build_learning_insights(
    history: HistoryData,
    user_counter: Counter[str],
    optimal_counter: Counter[str],
    missed_counter: Counter[str],
) -> list[str]:
    insights: list[str] = []

    mismatch_counter = Counter(
        (entry.user_pattern, entry.optimal_pattern)
        for entry in history.problems
        if entry.user_pattern != entry.optimal_pattern
    )
    if mismatch_counter:
        (user_pattern, optimal_pattern), _ = mismatch_counter.most_common(1)[0]
        insights.append(
            f"You frequently solve problems using {user_pattern} when {optimal_pattern} is optimal."
        )

    if missed_counter:
        missed_pattern, missed_count = missed_counter.most_common(1)[0]
        insights.append(
            f"Your most missed optimal pattern is {missed_pattern}, showing up {missed_count} time(s)."
        )

    non_optimal_count = sum(1 for entry in history.problems if not entry.optimal)
    if non_optimal_count > 0:
        insights.append(
            f"You often find workable solutions first: {non_optimal_count} stored problem(s) are currently suboptimal."
        )

    if not insights and user_counter and optimal_counter:
        top_user_pattern = user_counter.most_common(1)[0][0]
        top_optimal_pattern = optimal_counter.most_common(1)[0][0]
        insights.append(
            f"Your strongest current habit is {top_user_pattern}, and {top_optimal_pattern} appears most often as the optimal target."
        )

    return insights


def build_analytics(history: HistoryData) -> LearningAnalytics:
    user_counter = Counter(entry.user_pattern for entry in history.problems)
    optimal_counter = Counter(entry.optimal_pattern for entry in history.problems)
    missed_counter = Counter(
        entry.optimal_pattern for entry in history.problems if not entry.optimal
    )

    return LearningAnalytics(
        total_solved=len(history.problems),
        pattern_usage=top_counts(user_counter),
        optimal_pattern_distribution=top_counts(optimal_counter),
        most_missed_optimal_patterns=[
            PatternCount(pattern=pattern, count=count)
            for pattern, count in missed_counter.most_common(5)
        ],
        learning_insights=build_learning_insights(
            history=history,
            user_counter=user_counter,
            optimal_counter=optimal_counter,
            missed_counter=missed_counter,
        ),
    )


def build_placeholder_response(
    metadata: ProblemMetadata,
    history: HistoryData,
    correctness: str = "N/A",
) -> AnalyzeResponse:
    analytics = build_analytics(history)
    return AnalyzeResponse(
        title=metadata.title,
        difficulty=metadata.difficulty,
        user_pattern="N/A",
        optimal_pattern="N/A",
        time_complexity="N/A",
        space_complexity="N/A",
        correctness=correctness,
        optimal=None,
        is_placeholder_analysis=True,
        confidence=0.0,
        alternative_approach="",
        key_insight="",
        explanation="",
        recommended_problems_user_pattern=[],
        recommended_problems_optimal_pattern=[],
        analytics=LearningAnalytics(
            total_solved=analytics.total_solved,
            pattern_usage=analytics.pattern_usage,
            optimal_pattern_distribution=analytics.optimal_pattern_distribution,
            most_missed_optimal_patterns=[],
            learning_insights=[],
        ),
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception(is_retryable_gemini_error),
    reraise=True,
)
def request_analysis(client: genai.Client, payload: AnalyzeRequest):
    return client.models.generate_content(
        model=get_model_name(),
        contents=build_prompt(payload),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.2,
            response_mime_type="application/json",
            response_schema=LLMAnalysis,
        ),
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception(is_retryable_gemini_error),
    reraise=True,
)
def request_hint(client: genai.Client, payload: CoachingRequest, metadata: ProblemMetadata):
    return client.models.generate_content(
        model=get_model_name(),
        contents=build_hint_prompt(payload, metadata),
        config=types.GenerateContentConfig(
            system_instruction=HINT_SYSTEM_INSTRUCTION,
            temperature=0.4,
            response_mime_type="application/json",
            response_schema=HintLLMResponse,
        ),
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception(is_retryable_gemini_error),
    reraise=True,
)
def request_give_up(client: genai.Client, payload: CoachingRequest, metadata: ProblemMetadata):
    return client.models.generate_content(
        model=get_model_name(),
        contents=build_give_up_prompt(payload, metadata),
        config=types.GenerateContentConfig(
            system_instruction=GIVE_UP_SYSTEM_INSTRUCTION,
            temperature=0.2,
            response_mime_type="application/json",
            response_schema=GiveUpLLMResponse,
        ),
    )


ensure_data_files()

app = FastAPI(title="LeetCode AI Analyzer Backend", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    metadata = get_problem_metadata(payload.question_id, payload.leetcode_url)
    history = get_history()

    if is_empty_or_template_code(payload.code):
        return build_placeholder_response(metadata, history, correctness="N/A")

    try:
        client = get_client()
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    try:
        response = request_analysis(client, payload)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {error}") from error

    text = response.text
    if not text:
        raise HTTPException(status_code=502, detail="Gemini returned an empty response.")

    try:
        llm_analysis = LLMAnalysis.model_validate(json.loads(text))
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Invalid Gemini JSON payload: {error}") from error

    llm_analysis.time_complexity = normalize_complexity(llm_analysis.time_complexity)
    llm_analysis.space_complexity = normalize_complexity(llm_analysis.space_complexity)

    stored_entry = StoredAnalysis(
        question_id=int(payload.question_id),
        title=metadata.title,
        difficulty=metadata.difficulty,
        user_pattern=llm_analysis.user_pattern,
        optimal_pattern=llm_analysis.optimal_pattern,
        time_complexity=llm_analysis.time_complexity,
        space_complexity=llm_analysis.space_complexity,
        optimal=bool(llm_analysis.optimal),
        timestamp=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    )

    updated_history = upsert_analysis(history, stored_entry)
    save_history(updated_history)

    problems = read_json(PROBLEMS_PATH)
    pattern_catalog = get_pattern_catalog()

    return AnalyzeResponse(
        **llm_analysis.model_dump(),
        title=metadata.title,
        difficulty=metadata.difficulty,
        correctness=payload.correctness or "Passed latest run",
        is_placeholder_analysis=False,
        recommended_problems_user_pattern=build_recommendations(
            llm_analysis.user_pattern,
            payload.question_id,
            problems,
            pattern_catalog,
        ),
        recommended_problems_optimal_pattern=build_recommendations(
            llm_analysis.optimal_pattern,
            payload.question_id,
            problems,
            pattern_catalog,
        ),
        analytics=build_analytics(updated_history),
    )


@app.post("/hint", response_model=HintResponse)
def hint(payload: CoachingRequest) -> HintResponse:
    if is_empty_or_template_code(payload.code):
        raise HTTPException(status_code=400, detail="Hints are unavailable for empty or template-only code.")

    try:
        client = get_client()
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    metadata = get_problem_metadata(payload.question_id, payload.leetcode_url)

    try:
        response = request_hint(client, payload, metadata)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {error}") from error

    text = response.text
    if not text:
        raise HTTPException(status_code=502, detail="Gemini returned an empty hint response.")

    try:
        hint_response = HintLLMResponse.model_validate(json.loads(text))
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Invalid Gemini JSON payload: {error}") from error

    return HintResponse(
        title=metadata.title,
        difficulty=metadata.difficulty,
        failure_reason=payload.failure_reason,
        encouragement=hint_response.encouragement,
        hint_level=payload.hint_level,
        max_hint_level=3,
        hint=hint_response.hint,
    )


@app.post("/give-up", response_model=GiveUpResponse)
def give_up(payload: CoachingRequest) -> GiveUpResponse:
    if is_empty_or_template_code(payload.code):
        raise HTTPException(status_code=400, detail="Optimal solution is unavailable for empty or template-only code.")

    try:
        client = get_client()
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    metadata = get_problem_metadata(payload.question_id, payload.leetcode_url)

    try:
        response = request_give_up(client, payload, metadata)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {error}") from error

    text = response.text
    if not text:
        raise HTTPException(status_code=502, detail="Gemini returned an empty give-up response.")

    try:
        give_up_response = GiveUpLLMResponse.model_validate(json.loads(text))
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Invalid Gemini JSON payload: {error}") from error

    return GiveUpResponse(
        title=metadata.title,
        difficulty=metadata.difficulty,
        **give_up_response.model_dump(),
    )
