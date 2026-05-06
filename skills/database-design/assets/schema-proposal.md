# Schema Proposal: [Feature Name]

## Overview

[Brief explanation of why this schema change is required and how it fits into the current Phase.]

## Proposed Changes

### Table: `[table_name]`

| Column Name  | Type   | Modifiers    | Description        |
| :----------- | :----- | :----------- | :----------------- |
| `id`         | bigint | PK, Auto-Inc | Primary Identifier |
| `[col_name]` | [type] | [modifiers]  | [description]      |

### Indexes

- `[index_name]` on `([columns])` - _Reason: [why this index is necessary]_

### Relationships (Foreign Keys)

- `[table_name].[col]` -> references -> `[other_table].[col]` (On Delete: [Cascade/Restrict])

## Query Performance Considerations

- **Expected Read Volume**: [High/Medium/Low]
- **Expected Write Volume**: [High/Medium/Low]
- **N+1 Mitigation**: [How will the ORM eager load this?]

## Synchronization Strategy (If Applicable)

[If this data needs to be synced to the offline Frontend app, describe the payload and sync mechanism here.]
