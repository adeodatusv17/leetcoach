# LeetCode AI Analyzer - Data Pipeline

## Purpose

Phase 2 turns the analyzer into a local-first DSA coach by storing pattern-level outcomes and building analytics on top of them.

## Files

### `data/analysis_history.json`

Stores one latest record per problem:

```json
{
  "problems": [
    {
      "question_id": 448,
      "title": "Find All Numbers Disappeared in an Array",
      "difficulty": "Easy",
      "user_pattern": "Index Marking",
      "optimal_pattern": "Index Marking",
      "time_complexity": "O(n)",
      "space_complexity": "O(1)",
      "optimal": true,
      "timestamp": "2026-06-05T18:00:00Z"
    }
  ]
}
```

### `data/patterns.json`

Maps patterns to related LeetCode question ids used for recommendation generation.

### `data/problems.json`

Maps question ids to metadata used for rendering recommendation cards and storing history rows.

## Storage rules

The backend never stores:

- source code
- test cases
- cookies
- session tokens
- account information

## Analytics derivation

The backend computes:

- total solved
- pattern usage
- optimal pattern distribution
- most missed optimal patterns
- learning insights

These are derived only from `analysis_history.json`.
