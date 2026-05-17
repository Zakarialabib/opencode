"""Scoring engine for evaluation."""

from __future__ import annotations

from .types import (
    EvalScores,
    EvalTask,
    EvalType,
    TracedExecution,
)


def calculate_context_efficiency(trace: TracedExecution) -> float:
    """
    Calculate context efficiency score.
    
    Ideal: Read only relevant files, in optimal order
    Penalty factors:
    - Reading irrelevant files (files read but never referenced in output)
    - Reading too deeply before needed
    - Not using context budget when available for complex tasks
    - Exceeding context budget unnecessarily
    """
    if not trace.file_accesses:
        return 1.0
    
    total_bytes = sum(f.size for f in trace.file_accesses)
    relevant_bytes = sum(f.size for f in trace.file_accesses if f.relevant)
    
    # Relevance ratio
    if total_bytes == 0:
        return 1.0
    relevance_ratio = relevant_bytes / total_bytes
    
    # Context waste penalty
    irrelevant_count = len([f for f in trace.file_accesses if not f.relevant])
    total_count = len(trace.file_accesses)
    irrelevant_ratio = irrelevant_count / total_count if total_count > 0 else 0
    
    # Size penalty: heavy penalty for reading very large irrelevant files
    avg_irrelevant_size = 0
    irrelevant_files = [f for f in trace.file_accesses if not f.relevant]
    if irrelevant_files:
        avg_irrelevant_size = sum(f.size for f in irrelevant_files) / len(irrelevant_files)
    
    # Normalize: assume 100KB avg file size as reference
    size_penalty = min(0.5, (avg_irrelevant_size / 100000) * irrelevant_ratio)
    
    # Order bonus: if reading smaller files first
    order_bonus = 0.0
    sorted_by_size = sorted(trace.file_accesses, key=lambda f: f.size)
    actual_order_relevance = sum(
        (len(sorted_by_size) - sorted_by_size.index(f)) * (1 if f.relevant else 0)
        for f in trace.file_accesses
    )
    worst_order_relevance = sum(
        (len(sorted_by_size) - i) for i in range(len(sorted_by_size))
    )
    if worst_order_relevance > 0:
        order_bonus = (actual_order_relevance / worst_order_relevance - 0.5) * 0.1
    
    return max(0, min(1, relevance_ratio * (1 - size_penalty) * (1 + order_bonus)))


def calculate_token_economy(trace: TracedExecution) -> float:
    """
    Calculate token economy score.
    
    Ideal: Minimal tokens that fully answer the task
    Penalize:
    - Verbose explanations of obvious things
    - Repeating information
    - Excessive formatting when not needed
    - Including "working on it" or "let me check" filler
    """
    if trace.total_tokens_out == 0:
        return 1.0
    
    output_chars = sum(turn.text_length for turn in trace.turns)
    
    # Very rough: assume 4 chars per token
    estimated_optimal = output_chars // 4
    
    # Penalize excessive self-corrections
    correction_penalty = trace.self_corrections * 0.05
    if correction_penalty > 0.3:
        correction_penalty = 0.3
    
    # Penalize redundant reads
    redundant_reads = 0
    seen_files = set()
    for f in trace.file_accesses:
        if f.path in seen_files and f.relevant:
            redundant_reads += 1
        seen_files.add(f.path)
    
    redundancy_penalty = min(0.2, redundant_reads * 0.02)
    
    # Base score from correction/redundancy penalties
    base_score = 1.0 - correction_penalty - redundancy_penalty
    
    return max(0, min(1, base_score))


def calculate_tool_optimization(trace: TracedExecution) -> float:
    """
    Calculate tool optimization score.
    
    Ideal: Exact tools needed, in optimal order
    Penalize:
    - Wrong tool for task
    - Redundant tool calls (read same file twice)
    - Missing tools that would have helped
    - Excessive tool calls for simple tasks
    """
    if not trace.tool_calls:
        # Trivially simple task or no tools needed
        return 1.0
    
    tool_calls = trace.tool_calls
    
    # Count successful vs failed tools
    successful_tools = sum(1 for t in tool_calls if t.success)
    success_rate = successful_tools / len(tool_calls)
    
    # Check for redundant calls
    seen_tools = {}
    redundant = 0
    for t in tool_calls:
        key = f"{t.name}:{t.params.get('file_path', '')}"
        if key in seen_tools:
            redundant += 1
        seen_tools[key] = t
    
    redundancy_penalty = min(0.3, redundant * 0.05)
    
    # Count tool diversity (too few types might mean missing capabilities)
    tool_types = set(t.name for t in tool_calls)
    diversity = len(tool_types) / max(1, len(tool_calls))
    
    # Optimal: moderate diversity with low redundancy
    score = success_rate * (1 - redundancy_penalty) * (0.7 + 0.3 * diversity)
    
    return max(0, min(1, score))


def calculate_error_resilience(trace: TracedExecution) -> float:
    """
    Calculate error resilience score.
    
    Ideal: Errors handled gracefully, recoveries attempted
    Penalize:
    - Errors not recovered
    - No recovery attempts when errors occur
    - Gave up after errors
    """
    if not trace.errors:
        return 1.0
    
    total_errors = len(trace.errors)
    recovered_errors = sum(1 for e in trace.errors if e.recovered)
    total_recovery_attempts = sum(e.recovery_attempts for e in trace.errors)
    
    # Recovery rate
    recovery_rate = recovered_errors / total_errors
    
    # Recovery effort (did they try enough?)
    expected_recovery_attempts = total_errors
    recovery_effort = min(1.0, total_recovery_attempts / expected_recovery_attempts)
    
    # Gave up penalty
    gave_up = sum(1 for e in trace.errors if not e.recovered and e.recovery_attempts == 0)
    gave_up_penalty = gave_up / total_errors * 0.5
    
    score = recovery_rate * (0.5 + 0.3 * recovery_effort) * (1 - gave_up_penalty)
    
    return max(0, min(1, score))


def calculate_skill_alignment(trace: TracedExecution) -> float:
    """
    Calculate skill alignment score.
    
    Ideal: Correct skills triggered, outputs used
    Penalize:
    - Skills triggered but not used
    - Skills needed but not triggered
    - Wrong skills triggered
    """
    if not trace.skill_triggers:
        return 1.0  # No skills expected
    
    triggers = trace.skill_triggers
    used_triggers = sum(1 for t in triggers if t.output_used)
    unused_triggers = sum(1 for t in triggers if t.triggered and not t.output_used)
    
    # Success: triggered and used
    success_rate = used_triggers / len(triggers)
    
    # Penalty for unused skills (wasted context)
    waste_penalty = unused_triggers / len(triggers) * 0.3
    
    # Bonus for good timing (early trigger is better)
    avg_trigger_turn = sum(t.at_turn for t in triggers) / len(triggers)
    early_bonus = max(0, (5 - avg_trigger_turn) / 10)  # Max 0.5 bonus if all triggered in turn 1
    
    score = success_rate * (1 - waste_penalty) + early_bonus
    
    return max(0, min(1, score))


def score_execution(
    trace: TracedExecution,
    task: EvalTask,
    thresholds: dict[str, float] | None = None,
) -> EvalScores:
    """Calculate all scores for an execution."""
    return EvalScores(
        context_efficiency=calculate_context_efficiency(trace),
        token_economy=calculate_token_economy(trace),
        tool_optimization=calculate_tool_optimization(trace),
        error_resilience=calculate_error_resilience(trace),
        skill_alignment=calculate_skill_alignment(trace),
        tokens_per_relevant_file=(
            trace.total_tokens_in / trace.relevant_files 
            if trace.relevant_files > 0 else 0
        ),
        context_waste_percentage=(
            (trace.total_files_read - trace.relevant_files) / trace.total_files_read * 100
            if trace.total_files_read > 0 else 0
        ),
        tool_calls_per_useful_action=(
            len(trace.tool_calls) / max(1, trace.relevant_files)
        ),
    )


def evaluate_capability(
    scores: EvalScores,
    thresholds: dict[str, float],
) -> tuple[bool, list[str]]:
    """
    Evaluate capability against thresholds.
    
    Returns (passed, failed_categories)
    """
    failed = []
    
    for category, threshold in thresholds.items():
        score = getattr(scores, category, 0)
        if score < threshold:
            failed.append(f"{category}={score:.2f} < {threshold}")
    
    return len(failed) == 0, failed


def evaluate_regression(
    scores: EvalScores,
    thresholds: dict[str, float],
) -> tuple[bool, list[str]]:
    """
    Evaluate regression against thresholds.
    
    For regression, ALL must be 1.0 (100%)
    Returns (passed, failed_categories)
    """
    failed = []
    
    for category, threshold in thresholds.items():
        score = getattr(scores, category, 0)
        # For regression, threshold should always be 1.0
        if score < threshold:
            failed.append(f"{category}={score:.2f} < {threshold}")
    
    return len(failed) == 0, failed


class ScoringEngine:
    """Main scoring engine class."""
    
    def __init__(self, config: dict | None = None):
        self.config = config or {}
        self.capability_thresholds = self.config.get("capability", {
            "context_efficiency": 0.75,
            "token_economy": 0.80,
            "tool_optimization": 0.85,
            "error_resilience": 0.90,
            "skill_alignment": 0.95,
        })
        self.regression_thresholds = self.config.get("regression", {
            "context_efficiency": 1.0,
            "token_economy": 1.0,
            "tool_optimization": 1.0,
            "error_resilience": 1.0,
            "skill_alignment": 1.0,
        })
    
    def score_execution(self, trace: TracedExecution, task: EvalTask) -> EvalScores:
        """Score an execution."""
        return score_execution(trace, task)
    
    def evaluate(
        self,
        scores: EvalScores,
        eval_type: EvalType,
    ) -> tuple[bool, list[str], float]:
        """
        Evaluate scores against thresholds.
        
        Returns (passed, failed_categories, overall_score)
        """
        if eval_type == EvalType.CAPABILITY:
            passed, failed = evaluate_capability(scores, self.capability_thresholds)
        else:
            passed, failed = evaluate_regression(scores, self.regression_thresholds)
        
        return passed, failed, scores.overall_score