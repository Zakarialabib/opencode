"""Instrumentation API for capturing execution traces."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from .types import (
    ContextItem,
    ErrorEvent,
    EvalConfig,
    EvalTask,
    ExecutedTool,
    FileAccess,
    SkillTrigger,
    TracedExecution,
    TracedTurn,
)


class TraceSession:
    """A tracing session for an evaluation task."""
    
    def __init__(self, eval_id: str, task: EvalTask):
        self.eval_id = eval_id
        self.task = task
        self.start_time = time.time()
        
        # Turn tracking
        self.current_turn = 0
        self.turns: list[TracedTurn] = []
        
        # Aggregates
        self.total_tokens_in = 0
        self.total_tokens_out = 0
        self.total_files_read = 0
        self.relevant_files = 0
        
        # Detailed records
        self.tool_calls: list[ExecutedTool] = []
        self.file_accesses: list[FileAccess] = []
        self.skill_triggers: list[SkillTrigger] = []
        self.errors: list[ErrorEvent] = []
        
        # Quality indicators
        self.self_corrections = 0
        self.loop_cycles = 0
        self.timeout_cycles = 0
        
        # Context budget tracking
        self.context_budget = task.context_budget
        self.context_used = 0
        
    def start_turn(self, input_tokens: int, context_items: list[ContextItem]) -> TracedTurn:
        """Start a new turn."""
        self.current_turn += 1
        turn = TracedTurn(
            turn=self.current_turn,
            input_tokens=input_tokens,
            context_items=context_items,
            context_budget_at_start=self.context_budget - self.context_used,
        )
        self.turns.append(turn)
        return turn
    
    def end_turn(self, turn: TracedTurn, output_tokens: int, text_length: int):
        """End the current turn."""
        turn.output_tokens = output_tokens
        turn.text_length = text_length
        turn.context_budget_at_end = self.context_budget - self.context_used
        
        self.total_tokens_in += turn.input_tokens
        self.total_tokens_out += turn.output_tokens
    
    def log_tool_call(
        self,
        name: str,
        params: dict,
        result: Any,
        success: bool,
        duration_ms: int,
    ) -> ExecutedTool:
        """Log a tool call."""
        tool = ExecutedTool(
            name=name,
            params=params,
            result=result,
            success=success,
            duration_ms=duration_ms,
            turn=self.current_turn,
        )
        self.tool_calls.append(tool)
        
        # Also add to current turn
        if self.turns:
            self.turns[-1].tool_calls.append(name)
            self.turns[-1].tools_executed.append(tool)
        
        return tool
    
    def log_file_read(
        self,
        path: str,
        content: str,
        size: int,
        lines: int,
        relevant: bool = False,
    ) -> FileAccess:
        """Log a file read."""
        file_access = FileAccess(
            path=path,
            size=size,
            lines=lines,
            relevant=relevant,
            read_at_turn=self.current_turn,
            read_order=len(self.file_accesses),
        )
        self.file_accesses.append(file_access)
        self.total_files_read += 1
        
        # Estimate token cost (rough: 4 chars per token)
        estimated_tokens = size // 4
        self.context_used += estimated_tokens
        self.total_tokens_in += estimated_tokens
        
        if relevant:
            self.relevant_files += 1
        
        # Also add to current turn
        if self.turns:
            self.turns[-1].files_accessed.append(file_access)
        
        return file_access
    
    def log_skill_trigger(self, skill_name: str, triggered: bool, output_used: bool) -> SkillTrigger:
        """Log a skill trigger event."""
        trigger = SkillTrigger(
            skill_name=skill_name,
            triggered=triggered,
            at_turn=self.current_turn,
            output_used=output_used,
        )
        self.skill_triggers.append(trigger)
        return trigger
    
    def log_error(
        self,
        error_type: str,
        message: str,
        recovered: bool,
        recovery_attempts: int = 0,
    ) -> ErrorEvent:
        """Log an error event."""
        error = ErrorEvent(
            error_type=error_type,
            message=message,
            at_turn=self.current_turn,
            recovered=recovered,
            recovery_attempts=recovery_attempts,
        )
        self.errors.append(error)
        return error
    
    def mark_self_correction(self):
        """Mark that a self-correction occurred."""
        self.self_corrections += 1
    
    def mark_loop_cycle(self):
        """Mark that a loop cycle occurred."""
        self.loop_cycles += 1
    
    def mark_timeout(self):
        """Mark that a timeout occurred."""
        self.timeout_cycles += 1
    
    def finalize(self) -> TracedExecution:
        """Finalize the trace and return the result."""
        duration_ms = int((time.time() - self.start_time) * 1000)
        
        return TracedExecution(
            eval_id=self.eval_id,
            task=self.task,
            total_tokens_in=self.total_tokens_in,
            total_tokens_out=self.total_tokens_out,
            total_files_read=self.total_files_read,
            relevant_files=self.relevant_files,
            turns=self.turns,
            tool_calls=self.tool_calls,
            file_accesses=self.file_accesses,
            skill_triggers=self.skill_triggers,
            errors=self.errors,
            self_corrections=self.self_corrections,
            loop_cycles=self.loop_cycles,
            timeout_cycles=self.timeout_cycles,
            duration_ms=duration_ms,
        )


class Instrumentation:
    """Main instrumentation API."""
    
    def start_trace(self, eval_id: str, task: EvalTask) -> TraceSession:
        """Start a new trace session."""
        return TraceSession(eval_id, task)
    
    def log_event(self, session: TraceSession, event_type: str, data: dict):
        """Log a generic event."""
        # Generic event handler - specific handlers above
        pass
    
    def finalize(self, session: TraceSession) -> TracedExecution:
        """Finalize a trace session."""
        return session.finalize()