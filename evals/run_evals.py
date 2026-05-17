#!/usr/bin/env python3
"""CLI for running evaluations with the capability/regression framework."""

import argparse
import json
import sys
from pathlib import Path

# Add evals to path
sys.path.insert(0, str(Path(__file__).parent))

from evals.framework import (
    Instrumentation,
    ScoringEngine,
    EvalType,
    EvalTask,
    Verdict,
)
from evals.eval_loop import save_results, print_progress


def load_task(task_path: Path) -> EvalTask:
    """Load an eval task from JSON."""
    data = json.loads(task_path.read_text())
    return EvalTask(
        id=data["id"],
        category=data["category"],
        task_type=EvalType(data["type"]),
        description=data["description"],
        context_budget=data.get("context_budget", 50000),
        max_turns=data.get("max_turns", 5),
        workspace=data.get("workspace", ""),
        expected=data.get("expected", {}),
        thresholds=data.get("thresholds", {}),
        improvement_triggers=data.get("improvement_triggers", []),
    )


def try_load_brain_eval_data() -> list | None:
    """Try to load real Brain decision data from a live or saved export."""
    brain_export_path = Path("brain-plugin/eval_export.json")
    if brain_export_path.exists():
        try:
            data = json.loads(brain_export_path.read_text())
            decisions = data.get("data", [])
            if decisions:
                print(f"[Brain Eval] Loaded {len(decisions)} real decisions")
                return decisions
        except Exception as e:
            print(f"[Brain Eval] Failed to load: {e}")
    return None

def simulate_from_brain_data(trace, brain_data: list, task: EvalTask, iteration: int) -> dict:
    """Use real Brain decisions to inform simulation parameters."""
    from evals.framework.types import (
        TracedExecution,
        FileAccess,
        ExecutedTool,
    )
    
    # Use Brain data to set realistic parameters
    avg_context = sum(d.get("contextCount", 0) for d in brain_data) / max(len(brain_data), 1)
    total_decisions = len(brain_data)
    docs_used = any(d.get("docsUsed", False) for d in brain_data)
    
    decisions = brain_data[-3:] if len(brain_data) > 3 else brain_data
    for i, d in enumerate(decisions):
        trace.add_turn(
            turn=i + 1,
            input_tokens=800,
            output_tokens=400,
            files_read=[FileAccess(path=f"src/{d.get('intent', 'unknown')}.ts", size=2048, lines=60, mtime=0)],
            tools=[ExecutedTool(name="brain_search", args={"query": d.get("query", "")}, correct=True, duration_ms=200)],
        )
    
    # Use docs_used to boost score
    base_score = 0.7 + (0.15 if docs_used else 0) + (0.05 * min(iteration - 1, 3))
    score = min(base_score, 0.98)
    
    result = trace.finalize()
    result_dict = result if hasattr(result, "model_dump") else result.__dict__
    result_dict["task"] = task
    result_dict["score"] = score
    return result_dict

def simulate_execution(task: EvalTask, iteration: int) -> dict:
    """
    Load real Brain decision data if available, otherwise simulate.
    """
    from evals.framework import TraceSession
    from evals.framework.types import (
        TracedExecution,
        FileAccess,
        ExecutedTool,
        ErrorEvent,
    )
    
    # Try to load real Brain eval data from brain plugin's export
    brain_data = try_load_brain_eval_data()
    
    instrumentation = Instrumentation()
    trace = instrumentation.start_trace(task.id, task)
    
    if brain_data:
        return simulate_from_brain_data(trace, brain_data, task, iteration)
    
    # Fallback: simulate (Iteration 1: Poor, Iteration 2+: Improving)
    
    if iteration == 1:
        # Poor: read 25 files, only 5 relevant, verbose output
        files_to_read = 25
        relevant = 5
        tool_calls = 12
        errors = 1
        self_corrections = 3
        tokens_in = 45000
        tokens_out = 2500
    elif iteration == 2:
        # Better: read 18 files, 8 relevant
        files_to_read = 18
        relevant = 8
        tool_calls = 8
        errors = 0
        self_corrections = 1
        tokens_in = 32000
        tokens_out = 1200
    elif iteration == 3:
        # Good: read 12 files, 10 relevant
        files_to_read = 12
        relevant = 10
        tool_calls = 6
        errors = 0
        self_corrections = 0
        tokens_in = 22000
        tokens_out = 800
    else:
        # Excellent: minimal reads, all relevant
        files_to_read = 10
        relevant = 10
        tool_calls = 4
        errors = 0
        self_corrections = 0
        tokens_in = 15000
        tokens_out = 500
    
    # Create trace
    trace.total_tokens_in = tokens_in
    trace.total_tokens_out = tokens_out
    trace.total_files_read = files_to_read
    trace.relevant_files = relevant
    trace.self_corrections = self_corrections
    
    # Add file accesses
    for i in range(files_to_read):
        is_relevant = i < relevant
        size = 20000 if is_relevant else 15000  # Relevant files slightly larger
        trace.file_accesses.append(FileAccess(
            path=f"src/module_{i}.ts",
            size=size,
            lines=500,
            relevant=is_relevant,
            read_at_turn=(i // 5) + 1,
            read_order=i,
        ))
    
    # Add tool calls
    for i in range(tool_calls):
        trace.tool_calls.append(ExecutedTool(
            name=["glob", "read", "grep", "edit"][i % 4],
            params={"file_path": f"src/file_{i}.ts"} if i % 2 == 1 else {},
            result={"success": True},
            success=True,
            duration_ms=200 + i * 50,
            turn=(i // 3) + 1,
        ))
    
    # Add errors if any
    for i in range(errors):
        trace.errors.append(ErrorEvent(
            error_type="file_not_found",
            message="File does not exist",
            at_turn=2,
            recovered=i == 0,  # First one recovered
            recovery_attempts=1 if i == 0 else 0,
        ))
    
    return instrumentation.finalize(trace)


def run_single_eval(task_path: Path, iterations: int, verbose: bool = True) -> dict:
    """Run a single evaluation task."""
    task = load_task(task_path)
    
    instrumentation = Instrumentation()
    scoring_engine = ScoringEngine()
    
    results = {
        "task_id": task.id,
        "category": task.category,
        "type": task.task_type.value,
        "iterations": [],
        "final_score": 0,
        "passed": False,
        "best_iteration": 0,
    }
    
    previous_trace = None
    best_score = 0
    
    for iteration in range(1, iterations + 1):
        # Run execution (simulated in this demo)
        trace = simulate_execution(task, iteration)
        
        # Score
        scores = scoring_engine.score_execution(trace, task)
        passed, failed, overall_score = scoring_engine.evaluate(scores, task.task_type)
        
        # Annotate
        from evals.framework import annotate_trace, analyze_trace
        annotations = annotate_trace(trace)
        analysis = analyze_trace(
            trace=trace,
            annotations=annotations,
            iteration=iteration,
            previous_trace=previous_trace,
            passed=passed,
            eval_type=task.task_type.value,
        )
        
        iteration_result = {
            "iteration": iteration,
            "scores": {
                "context_efficiency": round(scores.context_efficiency, 2),
                "token_economy": round(scores.token_economy, 2),
                "tool_optimization": round(scores.tool_optimization, 2),
                "error_resilience": round(scores.error_resilience, 2),
                "skill_alignment": round(scores.skill_alignment, 2),
                "overall": round(overall_score, 2),
            },
            "passed": passed,
            "verdict": analysis.verdict.value,
            "tokens_in": trace.total_tokens_in,
            "tokens_out": trace.total_tokens_out,
            "files_read": trace.total_files_read,
            "relevant_files": trace.relevant_files,
            "explanation": analysis.explanation,
            "annotations": [
                {
                    "type": a.type.value,
                    "severity": a.severity.value,
                    "observation": a.observation[:100],
                }
                for a in annotations[:5]
            ],
        }
        
        if analysis.recommendations:
            iteration_result["recommendations"] = [
                {"priority": r.priority, "action": r.action, "change": r.change}
                for r in analysis.recommendations[:3]
            ]
        
        results["iterations"].append(iteration_result)
        
        if overall_score > best_score:
            best_score = overall_score
            results["best_iteration"] = iteration
        
        # Stop on regression for regression evals
        if task.task_type == EvalType.REGRESSION and not passed:
            results["passed"] = False
            results["final_score"] = overall_score
            results["regression_detected"] = True
            results["culprit"] = "Regression in skill triggering"
            break
        
        # Success for capability evals
        if task.task_type == EvalType.CAPABILITY and passed:
            results["passed"] = True
            results["final_score"] = overall_score
            break
        
        previous_trace = trace
    
    # Max iterations reached
    if not results["passed"] and "regression_detected" not in results:
        results["final_score"] = best_score
    
    return results


def run_all_evals(evals_dir: Path, iterations: int, verbose: bool = True) -> dict:
    """Run all evaluations in a directory."""
    all_results = {
        "capability": [],
        "regression": [],
        "summary": {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "avg_score": 0,
        },
    }
    
    # Find all eval.json files
    for eval_file in evals_dir.rglob("eval.json"):
        rel_path = eval_file.relative_to(evals_dir)
        
        if verbose:
            print(f"\n{'='*60}")
            print(f"Running: {rel_path}")
            print(f"{'='*60}")
        
        result = run_single_eval(eval_file, iterations, verbose)
        
        category = result["type"]
        all_results[category].append(result)
        all_results["summary"]["total"] += 1
        
        if result["passed"]:
            all_results["summary"]["passed"] += 1
        else:
            all_results["summary"]["failed"] += 1
        
        all_results["summary"]["avg_score"] += result["final_score"]
        
        if verbose:
            print(f"\nResult: {'PASS' if result['passed'] else 'FAIL'}")
            print(f"Final Score: {result['final_score']:.2f}")
            print(f"Best Iteration: {result['best_iteration']}")
    
    # Calculate averages
    if all_results["summary"]["total"] > 0:
        all_results["summary"]["avg_score"] /= all_results["summary"]["total"]
    
    return all_results


def main():
    parser = argparse.ArgumentParser(
        description="Run capability and regression evaluations"
    )
    parser.add_argument(
        "--task",
        type=Path,
        help="Path to single eval task JSON",
    )
    parser.add_argument(
        "--evals-dir",
        type=Path,
        default=Path(__file__).parent / "capability",
        help="Directory containing eval tasks",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=5,
        help="Max iterations per eval (default: 5)",
    )
    parser.add_argument(
        "--regression-only",
        action="store_true",
        help="Only run regression evals",
    )
    parser.add_argument(
        "--capability-only",
        action="store_true",
        help="Only run capability evals",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress verbose output",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output JSON file for results",
    )
    
    args = parser.parse_args()
    
    if args.regression_only:
        evals_dir = Path(__file__).parent / "regression"
    elif args.capability_only:
        evals_dir = Path(__file__).parent / "capability"
    elif args.task:
        evals_dir = None
    else:
        evals_dir = Path(__file__).parent / "capability"
    
    # Run evaluation(s)
    if args.task:
        results = run_single_eval(args.task, args.iterations, not args.quiet)
    else:
        results = run_all_evals(evals_dir, args.iterations, not args.quiet)
    
    # Print summary
    if not args.quiet and "summary" in results:
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"Total: {results['summary']['total']}")
        print(f"Passed: {results['summary']['passed']}")
        print(f"Failed: {results['summary']['failed']}")
        print(f"Avg Score: {results['summary']['avg_score']:.2f}")
    
    # Save output
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(results, indent=2))
        print(f"\nResults saved to: {args.output}")
    
    # Return exit code
    if "summary" in results:
        return 0 if results["summary"]["failed"] == 0 else 1
    else:
        return 0 if results.get("passed", False) else 1


if __name__ == "__main__":
    sys.exit(main())