export function parseJsonc(content: string): any {
  const text = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return JSON.parse(text);
}

export function stringifyJson(data: any, indent: number = 2): string {
  return JSON.stringify(data, null, indent);
}
