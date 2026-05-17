"""Type definitions for the eval framework."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class EvalType(Enum):
    """Type of evaluation."""
    CAPABILITY = "capability"  # Green path - iterate to 100%
    REGRESSION = "regression"   # Red path - must always pass


class EvalCategory(Enum):
    """Categories of capability evaluations."""
    CONTEXT_WINDOW = "context_window"
    TOKEN_EFFICIENCY = "token_efficiency"
    CONTEXT_LOADING = "context_loading"
    PROMPT_ADHERENCE = "prompt_adherence"
    TOOL_SELECTION = "tool_selection"
    ERROR_RECOVERY = "error_recovery"


class RegressionCategory(Enum):
    """Categories of regression evaluations."""
    SKILL_TRIGGERING = "skill_triggering"
    BASIC_FUNCTIONALITY = "basic_functionality"
    AGENT_ROUTING = "agent_routing"
    CONTEXT_PRESERVATION = "context_preservation"
    OUTPUT_FORMAT = "output_format"


class AnnotationType(Enum):
    """Types of annotations."""
    INEFFICIENCY = "inefficiency"
    REDUNDANCY = "redundancy"
    EXCELLENCE = "excellence"
    MISSING_CONTEXT = "missing_context"
    OVER_CONTEXT = "over_context"
    TOOL_MISMATCH = "tool_mismatch"
    RECOVERY_GAP = "recovery_gap"
    SKILL_MISALIGNMENT = "skill_misalignment"


class Severity(Enum):
    """Annotation severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class ScoreLabel(Enum):
    """Human-readable score labels."""
    PERFECT_EFFICIENCY = "PERFECT_EFFICIENCY"       # 1.0
    EXCELLENT = "EXCELLENT"                         # 0.9-0.99
    GOOD = "GOOD"                                   # 0.8-0.89
    PARTIAL_EFFICIENCY = "PARTIAL_EFFICIENCY"       # 0.7-0.79
    NEEDS_WORK = "NEEDS_WORK"                       # 0.5-0.69
    POOR = "POOR"                                   # 0.0-0.49


class Verdict(Enum):
    """Evaluation verdict."""
    PASS = "pass"
    FAIL = "fail"
    REGRESSION_DETECTED = "regression_detected"


def score_to_label(score: float) -> ScoreLabel:
    """Convert numeric score to human-readable label."""
    if score >= 1.0:
        return ScoreLabel.PERFECT_EFFICIENCY
    elif score >= 0.9:
        return ScoreLabel.EXCELLENT
    elif score >= 0.8:
        return ScoreLabel.GOOD
    elif score >= 0.7:
        return ScoreLabel.PARTIAL_EFFICIENCY
    elif score >= 0.5:
        return ScoreLabel.NEEDS_WORK
    else:
        return ScoreLabel.POOR


# ============================================================================
# Task & Configuration Types
# ============================================================================

@dataclass
class EvalTask:
    """A single evaluation task."""
    id: str
    category: str  # EvalCategory or RegressionCategory value
    task_type: EvalType
    
    description: str
    context_budget: int = 50000
    max_turns: int = 5
    workspace: str = ""
    
    expected: dict[str, Any] = field(default_factory=dict)
    thresholds: dict[str, float] = field(default_factory=dict)
    improvement_triggers: list[dict] = field(default_factory=list)


@dataclass
class EvalConfig:
    """Configuration for evaluation run."""
    eval_id: str
    task: EvalTask
    max_iterations: int = 5
    verbose: bool = False
    
    # Thresholds
    capability_thresholds: dict[str, float] = field(default_factory=lambda: {
        "context_efficiency": 0.75,
        "token_economy": 0.80,
        "tool_optimization": 0.85,
        "error_resilience": 0.90,
        "skill_alignment": 0.95,
    })
    regression_thresholds: dict[str, float] = field(default_factory=lambda: {
        "skill_triggering": 1.0,
        "basic_functionality": 1.0,
        "agent_routing": 1.0,
        "context_preservation": 1.0,
        "output_format": 1.0,
    })


# ============================================================================
# Trace Types
# ============================================================================

@dataclass
class ContextItem:
    """An item in the context window."""
    path: str
    content: str
    size: int
    lines: int
    loaded_at_turn: int = 0


@dataclass
class ExecutedTool:
    """A tool that was executed."""
    name: str
    params: dict
    result: Any
    success: bool
    duration_ms: int
    turn: int


@dataclass
class FileAccess:
    """Record of a file access."""
    path: str
    size: int
    lines: int
    relevant: bool  # Was file referenced in output?
    read_at_turn: int
    read_order: int  # Sequence number


@dataclass
class SkillTrigger:
    """Record of a skill triggering."""
    skill_name: str
    triggered: bool
    at_turn: int
    output_used: bool


@dataclass
class ErrorEvent:
    """An error that occurred during execution."""
    error_type: str
    message: str
    at_turn: int
    recovered: bool
    recovery_attempts: int = 0


@dataclass
class TracedTurn:
    """Traces for a single turn."""
    turn: int
    
    # Input
    input_tokens: int
    output_tokens: int
    context_items: list[ContextItem] = field(default_factory=list)
    
    # Output
    tool_calls: list[str] = field(default_factory=list)
    text_length: int = 0
    
    # Execution
    tools_executed: list[ExecutedTool] = field(default_factory=list)
    files_accessed: list[FileAccess] = field(default_factory=list)
    context_budget_at_start: int = 0
    context_budget_at_end: int = 0
    
    # Errors
    errors: list[ErrorEvent] = field(default_factory=list)


@dataclass
class TracedExecution:
    """Complete trace of an execution."""
    eval_id: str
    task: EvalTask
    
    # Aggregates
    total_tokens_in: int = 0
    total_tokens_out: int = 0
    total_files_read: int = 0
    relevant_files: int = 0
    
    # Detailed traces
    turns: list[TracedTurn] = field(default_factory=list)
    tool_calls: list[ExecutedTool] = field(default_factory=list)
    file_accesses: list[FileAccess] = field(default_factory=list)
    skill_triggers: list[SkillTrigger] = field(default_factory=list)
    errors: list[ErrorEvent] = field(default_factory=list)
    
    # Quality indicators
    self_corrections: int = 0
    loop_cycles: int = 0
    timeout_cycles: int = 0
    
    # Metadata
    duration_ms: int = 0
    iterations_used: int = 1


# ============================================================================
# Scoring Types
# ============================================================================

@dataclass
class EvalScores:
    """Scores for an evaluation."""
    # Primary scores (0-1)
    context_efficiency: float
    token_economy: float
    tool_optimization: float
    error_resilience: float
    skill_alignment: float
    
    # Composite
    overall_score: float = 0.0
    
    # Efficiency metrics (absolute)
    tokens_per_relevant_file: float = 0.0
    context_waste_percentage: float = 0.0
    tool_calls_per_useful_action: float = 0.0
    
    def __post_init__(self):
        # Calculate composite score
        weights = {
            "context_efficiency": 0.25,
            "token_economy": 0.25,
            "tool_optimization": 0.20,
            "error_resilience": 0.15,
            "skill_alignment": 0.15,
        }
        self.overall_score = sum(
            getattr(self, k) * v for k, v in weights.items()
        )


@dataclass 
class EvalResult:
    """Result of an evaluation."""
    eval_id: str
    task: EvalTask
    
    scores: EvalScores
    passed: bool
    
    # For regression, specific failures
    regression_failures: list[str] = field(default_factory=list)
    
    # Breakdown for transparency
    breakdown: dict[str, float] = field(default_factory=dict)


# ============================================================================
# Annotation Types
# ============================================================================

@dataclass
class AnnotationImpact:
    """Impact measurement of an annotation."""
    tokens_wasted: int = 0
    time_impact: str = ""
    context_budget_lost: float = 0.0
    quality_degradation: float = 0.0


@dataclass
class AnnotationActionable:
    """Actionable improvement suggestion."""
    category: str  # prompt, context, tool, skill, routing
    suggestion: str
    code_change: str = ""
    rule_addition: str = ""


@dataclass
class Annotation:
    """A single annotation explaining an observation."""
    id: str
    type: AnnotationType
    severity: Severity
    
    # Location in trace
    turn: int | None = None
    step: int | None = None
    phase: str | None = None  # plan, execute, reflect
    
    # What
    observation: str = ""
    
    # Why it matters
    impact: AnnotationImpact = field(default_factory=AnnotationImpact)
    
    # How to fix
    actionable: AnnotationActionable | None = None
    
    # Links
    related_rules: list[str] = field(default_factory=list)
    related_skills: list[str] = field(default_factory=list)


# ============================================================================
# Analysis Types
# ============================================================================

@dataclass
class RootCause:
    """Identified root cause of an issue."""
    category: str  # prompt, context, tool, skill, routing
    description: str
    frequency: int
    severity: str  # low, medium, high, critical


@dataclass
class Recommendation:
    """A recommended improvement."""
    priority: int  # 1, 2, 3
    action: str    # add_rule, update_skill, adjust_prompt, fix_routing
    target: str    # File or skill to change
    change: str    # Description of change
    expected_impact: str
    effort: str    # low, medium, high


@dataclass
class Risk:
    """Identified risk."""
    description: str
    severity: str
    mitigation: str


@dataclass
class AnalysisResult:
    """Complete analysis result."""
    eval_id: str
    loop_iteration: int
    
    verdict: Verdict
    
    # Root cause analysis
    root_causes: list[RootCause] = field(default_factory=list)
    
    # Improvement recommendations (prioritized)
    recommendations: list[Recommendation] = field(default_factory=list)
    
    # Efficiency trends
    efficiency_delta: dict[str, float] = field(default_factory=dict)
    
    # Risk assessment
    risks: list[Risk] = field(default_factory=list)
    
    # Human-readable explanation
    explanation: str = ""


# ============================================================================
# Loop Output Types
# ============================================================================

@dataclass
class IterationResult:
    """Result of a single iteration."""
    iteration: int
    
    trace: TracedExecution
    scores: EvalScores
    result: EvalResult
    annotations: list[Annotation]
    analysis: AnalysisResult
    
    tokens_used: int
    duration_ms: int


@dataclass
class EvalLoopOutput:
    """Complete output of an evaluation loop."""
    eval_id: str
    task: EvalTask
    type: EvalType
    
    iterations: list[IterationResult] = field(default_factory=list)
    
    # Final state
    final_score: float = 0.0
    final_passed: bool = False
    best_iteration: int = 0
    
    # For capability evals: what was improved
    improvement_candidates: list[str] = field(default_factory=list)
    
    # For regression evals: what broke
    regression_culprit: str | None = None
    
    def to_json(self) -> dict:
        """Convert to JSON-serializable dict."""
        return {
            "eval_id": self.eval_id,
            "category": self.task.category,
            "type": self.type.value,
            "iterations": [
                {
                    "iteration": i.iteration,
                    "score": i.scores.overall_score,
                    "passed": i.result.passed,
                    "tokens": i.tokens_used,
                    "duration_ms": i.duration_ms,
                }
                for i in self.iterations
            ],
            "final_score": self.final_score,
            "final_passed": self.final_passed,
            "best_iteration": self.best_iteration,
            "improvement_candidates": self.improvement_candidates,
        }