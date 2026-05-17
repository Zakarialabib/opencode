"""Evaluation loop runner with iteration support."""

from __future__ import annotations

import json
from pathlib import Path

from .framework import (
    Instrumentation,
    ScoringEngine,
    EvalType,
    EvalTask,
    TracedExecution,
    IterationResult,
    EvalLoopOutput,
    annotate_trace,
    analyze_trace,
)
from .framework.types import EvalConfig, Verdict


def run_eval_loop(
    config: EvalConfig,
    execution_fn,
    improvement_fn=None,
) -> EvalLoopOutput:
    """
    Run the full eval loop: Instrument → Trace → Eval → Annotate → Analyse
    
    Args:
        config: Evaluation configuration
        execution_fn: Function that runs the task and returns a TracedExecution
        improvement_fn: Function that takes analysis and returns improvement suggestions
    
    Returns:
        EvalLoopOutput with all iterations and final results
    """
    instrumentation = Instrumentation()
    scoring_engine = ScoringEngine()
    
    output = EvalLoopOutput(
        eval_id=config.eval_id,
        task=config.task,
        type=config.task.task_type,
    )
    
    previous_trace = None
    best_score = 0.0
    best_iteration = 0
    
    for iteration in range(1, config.max_iterations + 1):
        # INSTRUMENT & TRACE
        trace = execution_fn(config, iteration)
        
        # EVAL
        scores = scoring_engine.score_execution(trace, config.task)
        passed, failed, overall_score = scoring_engine.evaluate(
            scores, config.task.task_type
        )
        
        # ANNOTATE
        annotations = annotate_trace(trace)
        
        # ANALYSE
        analysis = analyze_trace(
            trace=trace,
            annotations=annotations,
            iteration=iteration,
            previous_trace=previous_trace,
            passed=passed,
            eval_type=config.task.task_type.value,
        )
        
        # Store iteration result
        iteration_result = IterationResult(
            iteration=iteration,
            trace=trace,
            scores=scores,
            result=None,  # Would create EvalResult here
            annotations=annotations,
            analysis=analysis,
            tokens_used=trace.total_tokens_in + trace.total_tokens_out,
            duration_ms=trace.duration_ms,
        )
        output.iterations.append(iteration_result)
        
        # Track best
        if overall_score > best_score:
            best_score = overall_score
            best_iteration = iteration
        
        # Check for regression (stop immediately)
        if config.task.task_type == EvalType.REGRESSION and not passed:
            output.final_passed = False
            output.regression_culprit = identify_regression_culprit(
                analysis, previous_trace, trace
            )
            return output
        
        # Check for capability success
        if config.task.task_type == EvalType.CAPABILITY and passed:
            output.final_passed = True
            output.final_score = overall_score
            output.best_iteration = best_iteration
            return output
        
        # Continue iteration for capability evals
        if iteration < config.max_iterations and improvement_fn:
            improvements = improvement_fn(analysis)
            output.improvement_candidates.extend(improvements)
        
        previous_trace = trace
    
    # Max iterations reached
    output.final_score = best_score
    output.final_passed = False
    output.best_iteration = best_iteration
    
    return output


def identify_regression_culprit(
    analysis,
    previous_trace: TracedExecution | None,
    current_trace: TracedExecution,
) -> str:
    """Identify what likely caused a regression."""
    if not previous_trace:
        return "Unknown - no previous trace to compare"
    
    culprits = []
    
    # Check skill triggering
    if len(current_trace.skill_triggers) != len(previous_trace.skill_triggers):
        culprits.append("Skill triggering pattern changed")
    
    # Check tool usage
    current_tools = set(t.name for t in current_trace.tool_calls)
    prev_tools = set(t.name for t in previous_trace.tool_calls)
    if current_tools != prev_tools:
        culprits.append(f"Tool set changed: added={current_tools - prev_tools}, removed={prev_tools - current_tools}")
    
    # Check error rate
    if current_trace.errors and not previous_trace.errors:
        culprits.append(f"New errors introduced: {[e.error_type for e in current_trace.errors]}")
    
    return "; ".join(culprits) if culprits else "Could not identify specific cause"


def save_results(output: EvalLoopOutput, output_dir: Path):
    """Save eval results to files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save JSON summary
    summary = output.to_json()
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    
    # Save detailed report
    report_lines = [
        f"# Evaluation Report: {output.eval_id}",
        "",
        f"**Type**: {output.type.value}",
        f"**Task**: {output.task.description[:100]}...",
        f"**Final Score**: {output.final_score:.2f}",
        f"**Passed**: {output.final_passed}",
        "",
        "## Iteration Summary",
        "",
    ]
    
    for it in output.iterations:
        report_lines.append(f"### Iteration {it.iteration}")
        report_lines.append(f"- **Score**: {it.scores.overall_score:.2f}")
        report_lines.append(f"- **Context Efficiency**: {it.scores.context_efficiency:.2f}")
        report_lines.append(f"- **Token Economy**: {it.scores.token_economy:.2f}")
        report_lines.append(f"- **Tool Optimization**: {it.scores.tool_optimization:.2f}")
        report_lines.append(f"- **Tokens Used**: {it.tokens_used:,}")
        report_lines.append(f"- **Duration**: {it.duration_ms / 1000:.1f}s")
        report_lines.append("")
        
        if it.analysis.explanation:
            report_lines.append(f"**Explanation**: {it.analysis.explanation}")
            report_lines.append("")
        
        if it.analysis.recommendations:
            report_lines.append("**Recommendations**:")
            for rec in it.analysis.recommendations:
                report_lines.append(f"  - [{rec.priority}] {rec.action}: {rec.change}")
            report_lines.append("")
        
        if it.annotations:
            report_lines.append("**Annotations**:")
            for ann in it.annotations[:5]:  # Limit to first 5
                report_lines.append(f"  - [{ann.severity.value}] {ann.type.value}: {ann.observation}")
            report_lines.append("")
    
    if output.improvement_candidates:
        report_lines.append("## Improvement Candidates")
        for candidate in set(output.improvement_candidates):
            report_lines.append(f"- {candidate}")
    
    if output.regression_culprit:
        report_lines.append(f"\n!!! REGRESSION DETECTED !!!")
        report_lines.append(f"Culprit: {output.regression_culprit}")
    
    (output_dir / "report.md").write_text("\n".join(report_lines))
    
    return output_dir / "report.md"


def print_progress(output: EvalLoopOutput, verbose: bool = True):
    """Print eval progress."""
    print(f"\n{'='*60}")
    print(f"Eval: {output.eval_id}")
    print(f"Type: {output.type.value}")
    print(f"{'='*60}")
    
    for it in output.iterations:
        status = "PASS" if it.analysis.verdict == Verdict.PASS else "FAIL"
        print(f"\nIteration {it.iteration}: [{status}] Score={it.scores.overall_score:.2f}")
        print(f"  Context Eff: {it.scores.context_efficiency:.2f}")
        print(f"  Token Econ:  {it.scores.token_economy:.2f}")
        print(f"  Tool Opt:    {it.scores.tool_optimization:.2f}")
        
        if it.analysis.explanation:
            print(f"  → {it.analysis.explanation}")
    
    print(f"\n{'='*60}")
    print(f"Final: {'PASSED' if output.final_passed else 'FAILED'} ({output.final_score:.2f})")
    if output.improvement_candidates:
        print(f"Improvement candidates: {len(output.improvement_candidates)}")