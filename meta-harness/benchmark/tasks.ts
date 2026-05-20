import type { BenchmarkTask } from "../types.js"

/**
 * Benchmark Task Suite for Meta-Harness Brain Plugin.
 * 
 * Tasks simulate real developer queries across all 7 intents.
 * Each task defines:
 * - query: The user message
 * - intent: Expected classification
 * - goldChunks: Files/chunks that SHOULD be retrieved
 * - expectedOutput: Regex or string the LLM output should match
 * 
 * Smoke suite: 5 tasks (1 per major intent)
 * Full suite: 21 tasks (3 per intent)
 */

export function loadTasks(suite: "smoke" | "full"): BenchmarkTask[] {
  if (suite === "smoke") {
    return SMOKE_TASKS
  }
  return FULL_TASKS
}

// --- Smoke Tasks (5 tasks) ---

const SMOKE_TASKS: BenchmarkTask[] = [
  {
    name: "debug-null-pointer",
    query: "Why am I getting Cannot read property of null in AuthService?",
    intent: "debug",
    goldChunks: ["src/services/AuthService.ts:42", "src/models/User.ts:15"],
    expectedOutput: /null check|optional chaining|AuthService/,
    reset: async () => { /* Reset in-memory stores */ },
    run: async (config) => {
      // Simulate Brain Plugin pipeline
      const intent = "debug"
      const chunks = simulateRetrieval("debug-null-pointer", config.chunkCounts.debug || 10)
      const injected = chunks.slice(0, config.chunkCounts.debug || 10)
      const tokens = injected.length * 200 // Rough estimate

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: injected.length,
        tokensUsed: tokens,
        tokensWasted: tokens * 0.3,
        llmOutput: "The error occurs because AuthService.ts:42 accesses user.profile without checking if user is null. Add optional chaining: user?.profile",
      }
    },
  },

  {
    name: "refactor-extract-hook",
    query: "Refactor this useEffect into a custom hook",
    intent: "refactor",
    goldChunks: ["src/components/Dashboard.tsx:45-78"],
    expectedOutput: /useCustomHook|useEffect|extract/,
    reset: async () => {},
    run: async (config) => {
      const intent = "refactor"
      const chunks = simulateRetrieval("refactor-extract-hook", config.chunkCounts.refactor || 20)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.refactor || 20),
        tokensUsed: 1500,
        tokensWasted: 200,
        llmOutput: "Extract the useEffect logic into a useDashboardData custom hook...",
      }
    },
  },

  {
    name: "feature-add-auth",
    query: "Add JWT authentication middleware to the API routes",
    intent: "feature",
    goldChunks: ["src/middleware/auth.ts", "src/routes/api.ts", "src/utils/jwt.ts"],
    expectedOutput: /JWT|middleware|auth/,
    reset: async () => {},
    run: async (config) => {
      const intent = "feature"
      const chunks = simulateRetrieval("feature-add-auth", config.chunkCounts.feature || 15)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.feature || 15),
        tokensUsed: 2500,
        tokensWasted: 500,
        llmOutput: "Create a new auth middleware that validates JWT tokens from the Authorization header...",
      }
    },
  },

  {
    name: "learn-architecture",
    query: "How does the data flow work between the frontend and backend?",
    intent: "learn",
    goldChunks: ["src/api/client.ts", "src/store/index.ts", "docs/architecture.md"],
    expectedOutput: /API|store|Redux|context|fetch/,
    reset: async () => {},
    run: async (config) => {
      const intent = "learn"
      const chunks = simulateRetrieval("learn-architecture", config.chunkCounts.learn || 25)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.learn || 25),
        tokensUsed: 4000,
        tokensWasted: 800,
        llmOutput: "The frontend uses a custom API client (src/api/client.ts) that interfaces with the Redux store...",
      }
    },
  },

  {
    name: "test-login-form",
    query: "Write a test for the login form validation",
    intent: "test",
    goldChunks: ["src/components/LoginForm.tsx", "src/__tests__/LoginForm.test.tsx"],
    expectedOutput: /test|describe|it|expect|render/,
    reset: async () => {},
    run: async (config) => {
      const intent = "test"
      const chunks = simulateRetrieval("test-login-form", config.chunkCounts.test || 12)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.test || 12),
        tokensUsed: 1200,
        tokensWasted: 100,
        llmOutput: "import { render, screen, fireEvent } from '@testing-library/react'; describe('LoginForm', () => { ... })",
      }
    },
  },
]

// --- Full Tasks (21 tasks: 3 per intent) ---

const FULL_TASKS: BenchmarkTask[] = [
  ...SMOKE_TASKS,

  // Additional debug tasks
  {
    name: "debug-stack-trace",
    query: "Stack trace shows error at line 156 in database.ts",
    intent: "debug+stacktrace",
    goldChunks: ["src/database.ts:156", "src/database.ts:140-160"],
    expectedOutput: /database|connection|pool|query/,
    reset: async () => {},
    run: async (config) => {
      const intent = "debug+stacktrace"
      const chunks = simulateRetrieval("debug-stack-trace", config.chunkCounts["debug+stacktrace"] || 5)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts["debug+stacktrace"] || 5),
        tokensUsed: 800,
        tokensWasted: 50,
        llmOutput: "The stack trace indicates a connection pool exhaustion at database.ts:156...",
      }
    },
  },

  {
    name: "debug-race-condition",
    query: "Intermittent failure in concurrent user update",
    intent: "debug",
    goldChunks: ["src/services/UserService.ts", "src/locks/redis.ts"],
    expectedOutput: /race|lock|concurrent|atomic/,
    reset: async () => {},
    run: async (config) => {
      const intent = "debug"
      const chunks = simulateRetrieval("debug-race-condition", config.chunkCounts.debug || 10)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.debug || 10),
        tokensUsed: 1000,
        tokensWasted: 150,
        llmOutput: "This is a race condition. The UserService update method lacks proper locking...",
      }
    },
  },

  // Additional refactor tasks
  {
    name: "refactor-rename-variable",
    query: "Rename all instances of 'data' to 'userData' in this file",
    intent: "refactor+single",
    goldChunks: ["src/components/Profile.tsx"],
    expectedOutput: /userData|rename|refactor/,
    reset: async () => {},
    run: async (config) => {
      const intent = "refactor+single"
      const chunks = simulateRetrieval("refactor-rename-variable", config.chunkCounts["refactor+single"] || 8)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts["refactor+single"] || 8),
        tokensUsed: 600,
        tokensWasted: 50,
        llmOutput: "Renamed 'data' to 'userData' across Profile.tsx...",
      }
    },
  },

  {
    name: "refactor-extract-service",
    query: "Extract the payment logic into a separate service class",
    intent: "refactor",
    goldChunks: ["src/controllers/OrderController.ts", "src/services/PaymentService.ts"],
    expectedOutput: /PaymentService|extract|class/,
    reset: async () => {},
    run: async (config) => {
      const intent = "refactor"
      const chunks = simulateRetrieval("refactor-extract-service", config.chunkCounts.refactor || 20)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.refactor || 20),
        tokensUsed: 2000,
        tokensWasted: 300,
        llmOutput: "Created PaymentService class with processPayment and refund methods...",
      }
    },
  },

  // Additional feature tasks
  {
    name: "feature-pagination",
    query: "Add pagination to the user list endpoint",
    intent: "feature",
    goldChunks: ["src/routes/users.ts", "src/models/User.ts"],
    expectedOutput: /page|limit|offset|pagination/,
    reset: async () => {},
    run: async (config) => {
      const intent = "feature"
      const chunks = simulateRetrieval("feature-pagination", config.chunkCounts.feature || 15)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.feature || 15),
        tokensUsed: 1800,
        tokensWasted: 250,
        llmOutput: "Added page and limit query parameters to GET /users with default values...",
      }
    },
  },

  {
    name: "feature-websocket",
    query: "Implement real-time notifications using WebSockets",
    intent: "feature",
    goldChunks: ["src/websocket/server.ts", "src/events/notification.ts"],
    expectedOutput: /WebSocket|socket.io|real-time|ws/,
    reset: async () => {},
    run: async (config) => {
      const intent = "feature"
      const chunks = simulateRetrieval("feature-websocket", config.chunkCounts.feature || 15)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.feature || 15),
        tokensUsed: 2200,
        tokensWasted: 400,
        llmOutput: "Set up WebSocket server with connection handling and notification broadcasting...",
      }
    },
  },

  // Additional test tasks
  {
    name: "test-api-integration",
    query: "Write integration tests for the checkout API",
    intent: "test",
    goldChunks: ["src/routes/checkout.ts", "src/__tests__/integration/checkout.test.ts"],
    expectedOutput: /supertest|request|expect|checkout/,
    reset: async () => {},
    run: async (config) => {
      const intent = "test"
      const chunks = simulateRetrieval("test-api-integration", config.chunkCounts.test || 12)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.test || 12),
        tokensUsed: 1600,
        tokensWasted: 200,
        llmOutput: "Using supertest to test the checkout flow: cart → payment → confirmation...",
      }
    },
  },

  {
    name: "test-mock-external",
    query: "Mock the Stripe API in payment tests",
    intent: "test",
    goldChunks: ["src/services/PaymentService.ts", "src/__tests__/mocks/stripe.ts"],
    expectedOutput: /mock|jest|stripe|vi.mock/,
    reset: async () => {},
    run: async (config) => {
      const intent = "test"
      const chunks = simulateRetrieval("test-mock-external", config.chunkCounts.test || 12)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.test || 12),
        tokensUsed: 1400,
        tokensWasted: 150,
        llmOutput: "Mock Stripe using jest.mock or MSW to intercept API calls...",
      }
    },
  },

  // Additional learn tasks
  {
    name: "learn-state-management",
    query: "Explain when to use Redux vs Context API",
    intent: "learn",
    goldChunks: ["docs/state-management.md", "src/store/redux.ts", "src/context/AppContext.tsx"],
    expectedOutput: /Redux|Context|state|global|local/,
    reset: async () => {},
    run: async (config) => {
      const intent = "learn"
      const chunks = simulateRetrieval("learn-state-management", config.chunkCounts.learn || 25)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.learn || 25),
        tokensUsed: 3500,
        tokensWasted: 600,
        llmOutput: "Redux is best for global state with complex updates, Context for dependency injection...",
      }
    },
  },

  {
    name: "learn-deployment",
    query: "How do I deploy this to production with Docker?",
    intent: "learn",
    goldChunks: ["Dockerfile", "docker-compose.yml", "docs/deployment.md"],
    expectedOutput: /docker|compose|deploy|production/,
    reset: async () => {},
    run: async (config) => {
      const intent = "learn"
      const chunks = simulateRetrieval("learn-deployment", config.chunkCounts.learn || 25)

      return {
        intent,
        retrievedChunks: chunks.map(c => c.id),
        chunksRetrieved: chunks.length,
        chunksInjected: Math.min(chunks.length, config.chunkCounts.learn || 25),
        tokensUsed: 3000,
        tokensWasted: 500,
        llmOutput: "Build the Docker image with docker build -t app . and run with docker-compose up...",
      }
    },
  },

  // Quick chat tasks (minimal retrieval)
  {
    name: "quick-greeting",
    query: "Hello, how are you?",
    intent: "quick_chat",
    goldChunks: [],
    expectedOutput: /hello|hi|help/,
    reset: async () => {},
    run: async (config) => {
      const intent = "quick_chat"

      return {
        intent,
        retrievedChunks: [],
        chunksRetrieved: 0,
        chunksInjected: 0,
        tokensUsed: 100,
        tokensWasted: 0,
        llmOutput: "Hello! I'm ready to help you with your code. What would you like to work on?",
      }
    },
  },

  {
    name: "quick-capabilities",
    query: "What can you do?",
    intent: "quick_chat",
    goldChunks: [],
    expectedOutput: /help|code|debug|refactor|feature/,
    reset: async () => {},
    run: async (config) => {
      const intent = "quick_chat"

      return {
        intent,
        retrievedChunks: [],
        chunksRetrieved: 0,
        chunksInjected: 0,
        tokensUsed: 150,
        tokensWasted: 0,
        llmOutput: "I can help you debug issues, refactor code, add features, write tests, and explain architecture...",
      }
    },
  },

  {
    name: "quick-thanks",
    query: "Thanks for the help!",
    intent: "quick_chat",
    goldChunks: [],
    expectedOutput: /welcome|glad|help/,
    reset: async () => {},
    run: async (config) => {
      const intent = "quick_chat"

      return {
        intent,
        retrievedChunks: [],
        chunksRetrieved: 0,
        chunksInjected: 0,
        tokensUsed: 80,
        tokensWasted: 0,
        llmOutput: "You're welcome! Feel free to ask if you need anything else.",
      }
    },
  },
]

// --- Simulation Helpers ---

interface SimulatedChunk {
  id: string
  content: string
  score: number
}

function simulateRetrieval(taskName: string, count: number): SimulatedChunk[] {
  // Deterministic simulation based on task name hash
  const chunks: SimulatedChunk[] = []
  const baseFiles = [
    "src/services/AuthService.ts",
    "src/models/User.ts",
    "src/components/Dashboard.tsx",
    "src/api/client.ts",
    "src/store/index.ts",
    "src/middleware/auth.ts",
    "src/routes/api.ts",
    "src/utils/jwt.ts",
    "src/database.ts",
    "src/websocket/server.ts",
    "docs/architecture.md",
    "Dockerfile",
  ]

  // Deterministic pseudo-random based on task name
  let seed = 0
  for (let i = 0; i < taskName.length; i++) {
    seed = ((seed << 5) - seed) + taskName.charCodeAt(i)
    seed |= 0
  }

  const pseudoRandom = () => {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  for (let i = 0; i < count; i++) {
    const fileIdx = Math.floor(pseudoRandom() * baseFiles.length)
    const line = Math.floor(pseudoRandom() * 200) + 1
    chunks.push({
      id: `${baseFiles[fileIdx]}:${line}`,
      content: `// Simulated chunk ${i} from ${baseFiles[fileIdx]}`,
      score: pseudoRandom(),
    })
  }

  return chunks.sort((a, b) => b.score - a.score)
}
