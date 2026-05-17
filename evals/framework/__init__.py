"""Eval framework initialization."""

from .types import (
    EvalType,
    EvalCategory,
    RegressionCategory,
    AnnotationType,
    Severity,
    ScoreLabel,
    Verdict,
    score_to_label,
    EvalTask,
    EvalConfig,
    TracedExecution,
    TracedTurn,
    EvalScores,
    EvalResult,
    Annotation,
    AnalysisResult,
    IterationResult,
    EvalLoopOutput,
)

from .instrument import Instrumentation, TraceSession
from .scorer import ScoringEngine, score_execution
from .annotator import annotate_trace
from .analyzer import analyze_trace

__all__ = [
    # Types
    "EvalType",
    "EvalCategory",
    "RegressionCategory",
    "AnnotationType",
    "Severity",
    "ScoreLabel",
    "Verdict",
    "score_to_label",
    "EvalTask",
    "EvalConfig",
    "TracedExecution",
    "TracedTurn",
    "EvalScores",
    "EvalResult",
    "Annotation",
    "AnalysisResult",
    "IterationResult",
    "EvalLoopOutput",
    # Core functions
    "Instrumentation",
    "TraceSession",
    "ScoringEngine",
    "score_execution",
    "annotate_trace",
    "analyze_trace",
]