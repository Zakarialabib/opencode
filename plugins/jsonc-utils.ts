export function parseJsonc(content: string): any {
  // Properly strip comments only outside of strings
  let result = "";
  let inString = false;
  let isEscaped = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = i + 1 < content.length ? content[i + 1] : "";

    if (isEscaped) {
      result += char;
      isEscaped = false;
      i++;
      continue;
    }

    if (char === "\\" && inString) {
      result += char;
      isEscaped = true;
      i++;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (!inString) {
      // Check for single-line comment
      if (char === "/" && nextChar === "/") {
        // Skip until end of line
        while (i < content.length && content[i] !== "\n") i++;
        continue;
      }
      // Check for multi-line comment
      if (char === "/" && nextChar === "*") {
        i += 2; // Skip /*
        while (i < content.length) {
          if (content[i] === "*" && i + 1 < content.length && content[i + 1] === "/") {
            i += 2; // Skip */
            break;
          }
          i++;
        }
        continue;
      }
    }

    result += char;
    i++;
  }

  return JSON.parse(result);
}

export function stringifyJson(data: any, indent: number = 2): string {
  return JSON.stringify(data, null, indent);
}
