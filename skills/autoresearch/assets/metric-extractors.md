# Metric Extraction Patterns

## ML Training (val_bpb)

```python
# Extract from training output
import re
pattern = r'val_bpb:\s*([0-9.]+)'
match = re.search(pattern, output)
if match:
    return float(match.group(1))
```

## Build Time

```bash
# Unix
time npm run build 2>&1 | grep real

# Windows PowerShell
Measure-Command { npm run build } | Select-Object TotalSeconds
```

## Bundle Size

```javascript
// webpack-bundle-analyzer or similar
const bundleSize = fs.statSync("dist/bundle.js").size;
console.log(`Bundle size: ${bundleSize / 1024}KB`);
```

## Test Speed

```bash
# Parse test output
npm test -- --json | jq '.stats.runtime'
```

## Lighthouse Scores

```bash
lighthouse http://localhost:3000 --output=json | jq '.categories.performance.score'
```

## Custom Metric Template

```python
def extract_metric(output: str) -> float:
    """Extract metric from command output.
    Returns: metric value (lower is better)
    """
    # Your extraction logic here
    pass
```
