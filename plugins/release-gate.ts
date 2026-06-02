import { type Plugin, tool } from "@opencode-ai/plugin";

const REQUIRED_RELEASE_GATES = [
  "lsp-clean",
  "tests-pass",
  "security-scan",
  "adr-compliance",
  "pm-signoff",
  "qa-signoff",
];

const ReleaseGatePlugin: Plugin = async () => {
  return {
    tool: {
      check_release_gates: tool({
        description: "Check agency release readiness gates",
        args: {
          passed: tool.schema
            .array(tool.schema.string())
            .default([])
            .describe("Gate ids that have passed"),
          majorRelease: tool.schema
            .boolean()
            .default(false)
            .describe("Whether CTO sign-off is required"),
        },
        async execute({ passed, majorRelease }) {
          const required = majorRelease
            ? [...REQUIRED_RELEASE_GATES, "cto-signoff"]
            : REQUIRED_RELEASE_GATES;
          const missing = required.filter((gate) => !passed.includes(gate));

          if (missing.length === 0) return "Release gates passed. Ready for release.";

          return [
            "Release blocked.",
            `Passed: ${passed.length > 0 ? passed.join(", ") : "none"}`,
            `Missing: ${missing.join(", ")}`,
          ].join("\n");
        },
      }),
    },
  };
};

export default ReleaseGatePlugin;
