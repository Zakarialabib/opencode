"""Root cause analysis module."""

from __future__ import annotations

from collections import Counter

from .types import (
    AnalysisResult,
    Recommendation,
    Risk,
    RootCause,
    TracedExecution,
    Verdict,
)


# Category mapping from annotation types
ANNOTATION_CATEGORY_MAP = {
    "inefficiency": "context",
    "redundancy": "context",
    "excellence": "prompt",
    "missing_context": "context",
    "over_context": "context",
    "tool_mismatch": "tool",
    "recovery_gap": "prompt",
    "skill_misalignment": "skill",
}


def identify_root_causes(trace: TracedExecution, annotations: list) -> list[RootCause]:
    """Identify root causes from annotations."""
    categories = Counter()
    
    for ann in annotations:
        category = ANNOTATION_CATEGORY_MAP.get(ann.type.value, "prompt")
        if ann.severity.value in ["warning", "critical"]:
            categories[category] += 1
    
    root_causes = []
    for category, count in categories.most_common():
        severity = "critical" if count > 3 else "high" if count > 1 else "medium"
        descriptions = {
            "context": "Context not used efficiently - files read but not relevant, or relevant files not read",
            "prompt": "Prompt guidance insufficient - unclear expectations or missing error handling",
            "tool": "Tool selection or usage suboptimal - wrong tool or incorrect parameters",
            "skill": "Skill triggering misalignment - skills triggered incorrectly or not used",
            "routing": "Agent routing issues - wrong agent selected or poor delegation",
        }
        
        root_causes.append(RootCause(
            category=category,
            description=descriptions.get(category, "General issue"),
            frequency=count,
            severity=severity,
        ))
    
    return root_causes


def generate_recommendations(
    root_causes: list[RootCause],
    trace: TracedExecution,
) -> list[Recommendation]:
    """Generate improvement recommendations."""
    recommendations = []
    
    for rc in root_causes:
        if rc.category == "context":
            recommendations.append(Recommendation(
                priority=1 if rc.severity in ["critical", "high"] else 2,
                action="add_rule",
                target="rules/general.md",
                change="Add guidance for context-budget-aware file selection",
                expected_impact=f"Reduce irrelevant file reads by ~{min(50, rc.frequency * 10)}%",
                effort="low",
            ))
            recommendations.append(Recommendation(
                priority=2,
                action="adjust_prompt",
                target="Core prompting",
                change="Add context efficiency reminders for large codebases",
                expected_impact="Better file prioritization",
                effort="low",
            ))
        
        elif rc.category == "prompt":
            recommendations.append(Recommendation(
                priority=1,
                action="add_rule",
                target="rules/general.md",
                change="Add error recovery guidance with specific strategies",
                expected_impact=f"Recovery rate improvement for {rc.frequency} error types",
                effort="low",
            ))
            recommendations.append(Recommendation(
                priority=2,
                action="adjust_prompt",
                target="Core prompting",
                change="Add conciseness reminders for output generation",
                expected_impact="Reduce verbose output",
                effort="low",
            ))
        
        elif rc.category == "tool":
            recommendations.append(Recommendation(
                priority=2,
                action="add_rule",
                target="rules/general.md",
                change="Add tool selection heuristics for common tasks",
                expected_impact="Better tool choice accuracy",
                effort="medium",
            ))
        
        elif rc.category == "skill":
            recommendations.append(Recommendation(
                priority=2,
                action="update_skill",
                target="skills/index.json",
                change="Review and refine skill triggering descriptions",
                expected_impact="Reduce unnecessary skill triggers",
                effort="medium",
            ))
    
    # Sort by priority
    recommendations.sort(key=lambda r: r.priority)
    
    # Limit to top 5
    return recommendations[:5]


def identify_risks(
    root_causes: list[RootCause],
    trace: TracedExecution,
) -> list[Risk]:
    """Identify potential risks."""
    risks = []
    
    # Critical root causes = risks
    for rc in root_causes:
        if rc.severity == "critical":
            risks.append(Risk(
                description=f"Critical {rc.category} issue: {rc.description}",
                severity="high",
                mitigation=f"Address {rc.category} recommendations immediately",
            ))
    
    # Context overrun risk
    if trace.total_tokens_in > trace.task.context_budget * 0.9:
        risks.append(Risk(
            description="Near context budget limit",
            severity="medium",
            mitigation="Implement context budget monitoring and prioritization",
        ))
    
    # Error rate risk
    error_rate = len(trace.errors) / max(1, len(trace.turns))
    if error_rate > 0.3:
        risks.append(Risk(
            description=f"High error rate: {error_rate:.1%} per turn",
            severity="medium",
            mitigation="Add error handling and recovery guidance",
        ))
    
    return risks


def calculate_efficiency_delta(
    current_trace: TracedExecution,
    previous_trace: TracedExecution | None,
) -> dict[str, float]:
    """Calculate efficiency improvements from previous iteration."""
    if not previous_trace:
        return {
            "tokens_saved": 0,
            "context_improvement": 0,
            "time_improvement": 0,
        }
    
    tokens_delta = previous_trace.total_tokens_in - current_trace.total_tokens_in
    context_waste_delta = (
        (previous_trace.total_files_read - previous_trace.relevant_files) / max(1, previous_trace.total_files_read)
        - (current_trace.total_files_read - current_trace.relevant_files) / max(1, current_trace.total_files_read)
    )
    time_delta = previous_trace.duration_ms - current_trace.duration_ms
    
    return {
        "tokens_saved": tokens_delta,
        "context_improvement": context_waste_delta * 100,  # Percentage point
        "time_improvement": time_delta / 1000,  # Seconds
    }


def generate_explanation(
    trace: TracedExecution,
    annotations: list,
    passed: bool,
    eval_type: str,
) -> str:
    """Generate human-readable explanation."""
    if passed:
        if eval_type == "capability":
            return (
                f"Evaluation passed with score {trace.relevant_files / max(1, trace.total_files_read):.0%} relevance. "
                f"OpenCode effectively utilized context ({trace.total_tokens_in:,} tokens) and "
                f"completed the task with {len(trace.tool_calls)} tool calls. "
                f"No significant inefficiencies detected."
            )
        else:
            return (
                "Regression check passed. All baseline capabilities preserved. "
                "Safe to deploy capability improvements."
            )
    else:
        issues = [a.observation for a in annotations if a.severity.value in ["warning", "critical"]]
        if issues:
            return (
                f"Evaluation {'partially succeeded' if eval_type == 'capability' else 'failed'}. "
                f"Key issues: {'; '.join(issues[:3])}. "
                f"Context efficiency: {trace.relevant_files / max(1, trace.total_files_read):.0%}. "
                f"Review annotations for actionable improvements."
            )
        else:
            return (
                f"Evaluation {'partially succeeded' if eval_type == 'capability' else 'failed'}. "
                "Minor issues detected. Review annotations for details."
            )


def analyze_trace(
    trace: TracedExecution,
    annotations: list,
    iteration: int,
    previous_trace: TracedExecution | None = None,
    passed: bool = False,
    eval_type: str = "capability",
) -> AnalysisResult:
    """Complete analysis of a trace."""
    root_causes = identify_root_causes(trace, annotations)
    recommendations = generate_recommendations(root_causes, trace)
    risks = identify_risks(root_causes, trace)
    efficiency_delta = calculate_efficiency_delta(trace, previous_trace)
    explanation = generate_explanation(trace, annotations, passed, eval_type)
    
    # Determine verdict
    if eval_type == "regression" and not passed:
        verdict = Verdict.REGRESSION_DETECTED
    elif passed:
        verdict = Verdict.PASS
    else:
        verdict = Verdict.FAIL
    
    return AnalysisResult(
        eval_id=trace.eval_id,
        loop_iteration=iteration,
        verdict=verdict,
        root_causes=root_causes,
        recommendations=recommendations,
        efficiency_delta=efficiency_delta,
        risks=risks,
        explanation=explanation,
    )