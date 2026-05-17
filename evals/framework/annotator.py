"""Annotation generator for creating actionable insights."""

from __future__ import annotations

import uuid

from .types import (
    Annotation,
    AnnotationActionable,
    AnnotationImpact,
    AnnotationType,
    Severity,
    TracedExecution,
    TracedTurn,
)


def generate_inefficiency_annotations(trace: TracedExecution) -> list[Annotation]:
    """Generate annotations for inefficiencies."""
    annotations = []
    
    # Check for glob spam (too many files matched)
    if trace.total_files_read > 20 and trace.relevant_files / trace.total_files_read < 0.3:
        irrelevant = trace.total_files_read - trace.relevant_files
        wasted_tokens = irrelevant * 5000  # Rough estimate
        
        annotations.append(Annotation(
            id=f"ann-{uuid.uuid4().hex[:8]}",
            type=AnnotationType.INEFFICIENCY,
            severity=Severity.WARNING,
            turn=trace.file_accesses[0].read_at_turn if trace.file_accesses else None,
            observation=f"Read {trace.total_files_read} files but only {trace.relevant_files} were relevant",
            impact=AnnotationImpact(
                tokens_wasted=wasted_tokens,
                context_budget_lost=wasted_tokens / trace.task.context_budget,
            ),
            actionable=AnnotationActionable(
                category="context",
                suggestion="Use path-based filtering: 'src/**/routes/*.ts' instead of '**/*.ts' when targeting specific modules",
                rule_addition="When context budget < 30%, prefer narrow glob patterns over broad ones",
            ),
            related_rules=["rules/general.md"],
        ))
    
    # Check for excessive tool calls
    avg_tools_per_turn = len(trace.tool_calls) / max(1, len(trace.turns))
    if avg_tools_per_turn > 5:
        annotations.append(Annotation(
            id=f"ann-{uuid.uuid4().hex[:8]}",
            type=AnnotationType.INEFFICIENCY,
            severity=Severity.WARNING,
            observation=f"Excessive tool usage: {avg_tools_per_turn:.1f} tools per turn on average",
            impact=AnnotationImpact(
                time_impact="High round-trip latency per tool call",
            ),
            actionable=AnnotationActionable(
                category="tool",
                suggestion="Pre-plan tool sequences to minimize round-trips. Batch similar operations.",
            ),
        ))
    
    return annotations


def generate_redundancy_annotations(trace: TracedExecution) -> list[Annotation]:
    """Generate annotations for redundant operations."""
    annotations = []
    
    # Check for duplicate file reads
    seen_files = {}
    for fa in trace.file_accesses:
        if fa.path in seen_files:
            annotations.append(Annotation(
                id=f"ann-{uuid.uuid4().hex[:8]}",
                type=AnnotationType.REDUNDANCY,
                severity=Severity.INFO,
                turn=fa.read_at_turn,
                observation=f"File read twice: {fa.path}",
                impact=AnnotationImpact(
                    tokens_wasted=fa.size // 4,
                ),
                actionable=AnnotationActionable(
                    category="tool",
                    suggestion="Cache file contents in memory before re-reading. Track which files have been read.",
                ),
            ))
        seen_files[fa.path] = fa
    
    # Check for repeated tool patterns
    tool_sequence = [t.name for t in trace.tool_calls]
    for pattern_len in [2, 3]:
        for i in range(len(tool_sequence) - pattern_len * 2):
            pattern = tuple(tool_sequence[i:i + pattern_len])
            next_pattern = tuple(tool_sequence[i + pattern_len:i + pattern_len * 2])
            if pattern == next_pattern:
                annotations.append(Annotation(
                    id=f"ann-{uuid.uuid4().hex[:8]}",
                    type=AnnotationType.REDUNDANCY,
                    severity=Severity.INFO,
                    observation=f"Repeated tool pattern: {' → '.join(pattern)}",
                    actionable=AnnotationActionable(
                        category="prompt",
                        suggestion="Consider combining these operations or using a higher-level tool",
                    ),
                ))
                break
    
    return annotations


def generate_excellence_annotations(trace: TracedExecution) -> list[Annotation]:
    """Generate annotations for excellent patterns."""
    annotations = []
    
    # Check for optimal file ordering (small files first)
    if trace.file_accesses:
        sorted_by_size = sorted(trace.file_accesses, key=lambda f: f.size)
        is_ordered = all(
            trace.file_accesses[i].size <= trace.file_accesses[i + 1].size
            for i in range(len(trace.file_accesses) - 1)
        )
        if is_ordered and len(trace.file_accesses) > 3:
            annotations.append(Annotation(
                id=f"ann-{uuid.uuid4().hex[:8]}",
                type=AnnotationType.EXCELLENCE,
                severity=Severity.INFO,
                observation="Excellent: files read in size order (small first)",
                impact=AnnotationImpact(
                    tokens_wasted=-5000,  # Negative = saved
                ),
                actionable=AnnotationActionable(
                    category="prompt",
                    suggestion="This ordering pattern should be documented in the general rules",
                ),
            ))
    
    # Check for efficient error recovery
    if trace.errors:
        for error in trace.errors:
            if error.recovered and error.recovery_attempts > 0:
                annotations.append(Annotation(
                    id=f"ann-{uuid.uuid4().hex[:8]}",
                    type=AnnotationType.EXCELLENCE,
                    severity=Severity.INFO,
                    turn=error.at_turn,
                    observation=f"Good recovery: handled {error.error_type} after {error.recovery_attempts} attempt(s)",
                ))
    
    return annotations


def generate_context_annotations(trace: TracedExecution) -> list[Annotation]:
    """Generate annotations for context-related issues."""
    annotations = []
    
    # Check for context budget overrun
    context_usage = trace.total_tokens_in / trace.task.context_budget if trace.task.context_budget > 0 else 0
    if context_usage > 0.95:
        annotations.append(Annotation(
            id=f"ann-{uuid.uuid4().hex[:8]}",
            type=AnnotationType.OVER_CONTEXT,
            severity=Severity.WARNING,
            observation=f"Context budget near limit: {context_usage * 100:.1f}% used",
            impact=AnnotationImpact(
                context_budget_lost=1 - context_usage,
            ),
            actionable=AnnotationActionable(
                category="context",
                suggestion="Implement context budget monitoring. Prioritize high-relevance files.",
            ),
        ))
    
    # Check for potential missing context
    if trace.relevant_files < 3 and trace.total_files_read > 10:
        annotations.append(Annotation(
            id=f"ann-{uuid.uuid4().hex[:8]}",
            type=AnnotationType.MISSING_CONTEXT,
            severity=Severity.INFO,
            observation="Low relevance rate - may have missed key files",
            actionable=AnnotationActionable(
                category="context",
                suggestion="Use more targeted search based on task requirements before broad scanning",
            ),
        ))
    
    return annotations


def generate_tool_mismatch_annotations(trace: TracedExecution) -> list[Annotation]:
    """Generate annotations for tool mismatches."""
    annotations = []
    
    # Check for failed tools
    failed_tools = [t for t in trace.tool_calls if not t.success]
    if failed_tools:
        for tool in failed_tools[:3]:  # Limit to first 3
            annotations.append(Annotation(
                id=f"ann-{uuid.uuid4().hex[:8]}",
                type=AnnotationType.TOOL_MISMATCH,
                severity=Severity.WARNING,
                turn=tool.turn,
                observation=f"Tool failed: {tool.name}",
                impact=AnnotationImpact(
                    time_impact="Retry overhead, potential dead-end",
                ),
                actionable=AnnotationActionable(
                    category="tool",
                    suggestion=f"Verify parameters for {tool.name} are correct",
                ),
            ))
    
    return annotations


def generate_recovery_gap_annotations(trace: TracedExecution) -> list[Annotation]:
    """Generate annotations for recovery gaps."""
    annotations = []
    
    for error in trace.errors:
        if not error.recovered and error.recovery_attempts == 0:
            annotations.append(Annotation(
                id=f"ann-{uuid.uuid4().hex[:8]}",
                type=AnnotationType.RECOVERY_GAP,
                severity=Severity.CRITICAL if error.error_type == "fatal" else Severity.WARNING,
                turn=error.at_turn,
                observation=f"Error not handled: {error.error_type}",
                impact=AnnotationImpact(
                    time_impact="Gave up on task",
                    quality_degradation=0.3,
                ),
                actionable=AnnotationActionable(
                    category="prompt",
                    suggestion="Add error handling guidance. When encountering errors, attempt recovery before giving up.",
                    rule_addition="Never give up on errors without attempting at least one recovery strategy",
                ),
            ))
    
    return annotations


def generate_skill_misalignment_annotations(trace: TracedExecution) -> list[Annotation]:
    """Generate annotations for skill misalignment."""
    annotations = []
    
    for trigger in trace.skill_triggers:
        if trigger.triggered and not trigger.output_used:
            annotations.append(Annotation(
                id=f"ann-{uuid.uuid4().hex[:8]}",
                type=AnnotationType.SKILL_MISALIGNMENT,
                severity=Severity.INFO,
                turn=trigger.at_turn,
                observation=f"Skill triggered but not used: {trigger.skill_name}",
                impact=AnnotationImpact(
                    context_budget_lost=0.05,  # Wasted context loading skill
                ),
                actionable=AnnotationActionable(
                    category="skill",
                    suggestion=f"Review skill description - {trigger.skill_name} may trigger too broadly or content wasn't useful",
                ),
            ))
    
    return annotations


def annotate_trace(trace: TracedExecution) -> list[Annotation]:
    """Generate all annotations for a trace."""
    all_annotations = []
    
    all_annotations.extend(generate_inefficiency_annotations(trace))
    all_annotations.extend(generate_redundancy_annotations(trace))
    all_annotations.extend(generate_excellence_annotations(trace))
    all_annotations.extend(generate_context_annotations(trace))
    all_annotations.extend(generate_tool_mismatch_annotations(trace))
    all_annotations.extend(generate_recovery_gap_annotations(trace))
    all_annotations.extend(generate_skill_misalignment_annotations(trace))
    
    # Sort by severity (critical first)
    severity_order = {Severity.CRITICAL: 0, Severity.WARNING: 1, Severity.INFO: 2}
    all_annotations.sort(key=lambda a: severity_order[a.severity])
    
    return all_annotations