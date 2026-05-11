#!/usr/bin/env python3
"""
Validate the local knowledge-architect skill bundle.
"""

import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).parent.parent

EXPECTED_FILES = [
    "SKILL.md",
    "_meta.json",
    "references/domain-routing.md",
    "references/classification-labels.md",
]


def validate_frontmatter() -> tuple[bool, str]:
    content = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
    if not content.startswith("---"):
        return False, "SKILL.md must start with YAML frontmatter"
    end = content.find("---", 3)
    if end == -1:
        return False, "SKILL.md frontmatter is not closed"
    frontmatter = content[3:end]
    for key in ("name:", "description:"):
        if key not in frontmatter:
            return False, f"missing frontmatter key: {key}"
    return True, "OK"


def validate_meta() -> tuple[bool, str]:
    try:
        meta = json.loads((SKILL_DIR / "_meta.json").read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        return False, f"_meta.json is invalid JSON: {error}"
    for key in ("id", "version"):
        if key not in meta:
            return False, f"_meta.json missing {key}"
    return True, "OK"


def main() -> int:
    errors = []
    for relative in EXPECTED_FILES:
        if not (SKILL_DIR / relative).exists():
            errors.append(f"missing file: {relative}")

    valid, message = validate_frontmatter()
    if not valid:
        errors.append(message)
    else:
        print(f"Frontmatter validation: {message}")

    valid, message = validate_meta()
    if not valid:
        errors.append(message)
    else:
        print(f"_meta.json validation: {message}")

    if errors:
        print("VALIDATION FAILED:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print("\nOK: All validation checks passed!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
