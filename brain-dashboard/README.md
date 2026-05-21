# 🧠 OpenCode Brain Dashboard

A visual dashboard for testing, monitoring, and benchmarking the OpenCode Brain plugin with LM Studio integration.

![Brain Dashboard](https://img.shields.io/badge/Status-Active-brightgreen)
![Node](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **LM Studio Integration** - Check connection status, view loaded models, configure endpoints
- **Real-time Brain Status** - Monitor brain health, indexed files, and database size
- **Observability (Telemetry)** - View tool/skill/RAG/harness runs and recent events stored in `brain.db`
- **RAG Sessions** - Browse query sessions, inspect retrieved/used chunks, and submit feedback
- **Source Management** - Add/remove folders and URLs for indexing
- **Progress Tracking** - Visual progress bar for indexing operations
- **Semantic Search Testing** - Test brain_search with different intents (learn, refactor, feature, debug, test)
- **Diagnostic Tools** - Run comprehensive brain diagnostics
- **Benchmark Suite** - Measure retrieval latency and quality
- **Indexed Files Viewer** - See what files are in the brain database
- **Query History** - Track all searches with latency metrics
- **WebSocket Support** - Real-time updates

## Prerequisites

1. **OpenCode** installed and configured
2. **LM Studio** running with models loaded (optional but recommended)
3. **Node.js** 18+ for the dashboard

## Installation

```bash
cd brain-dashboard
npm install
```

## Usage

### Start the Dashboard

```bash
npm start
```

The dashboard will be available at: http://localhost:3456

### OpenCode Server Integration (optional)

By default the dashboard expects an OpenCode server at `http://127.0.0.1:4096`. Override with:

```bash
OPENCODE_SERVER_BASE_URL=http://127.0.0.1:4096 npm start
```

### Connect to LM Studio

1. Start LM Studio and load your models
2. Open the dashboard at http://localhost:3456
3. Click "Check Connection" to verify LM Studio status
4. Models will be displayed if connected

## Dashboard Sections

### 1. LM Studio Connection

- Check connection status to LM Studio
- View loaded models (embeddings, rerankers, chat models)
- Configure LM Studio URL
- Real-time connection indicator

### 2. Brain Status

- **Indexed Files**: Total files in database
- **Total Chunks**: Code chunks indexed
- **DB Size**: Database file size
- **Total Queries**: Searches performed

### 3. Indexing Progress

- Visual progress bar during indexing
- Status indicators (Idle, Indexing, Completed)
- Cancel button for long operations
- Re-index all sources button

### 4. Index Sources

#### Folders Tab
- Add folder paths with glob patterns
- Enable/disable sources
- Re-index individual folders
- View last indexed time and item count

#### URLs Tab
- Add documentation URLs
- Enable/disable sources
- Track indexed pages

#### Indexed Items Tab
- View all files in the database
- See chunk counts, file sizes
- Check when files were indexed/modified

### 5. Semantic Search

- Enter natural language queries
- Select intent (learn, refactor, feature, debug, test)
- Set result limit
- View formatted search results with scores

### 6. Quick Actions

- Run Diagnostic
- Run Benchmark
- View Indexed
- Refresh Sources
- Clear History

### 7. Performance Metrics

- Average latency
- Success rate
- Total searches
- Active sources count

### 8. Query History

- Click to reload previous queries
- View latency and intent
- Timestamp display

### 9. Activity Log

- Real-time logging
- Color-coded by type (info, success, warning, error)

## API Endpoints

### LM Studio

```
GET /api/lmstudio/status
POST /api/lmstudio/configure
```

### Brain Status

```
GET /api/brain/status
```

Returns brain plugin status including file count, chunk count, and database size.

### Indexed Items

```
GET /api/brain/indexed
```

Returns list of all indexed files with metadata.

### Index Sources

```
GET /api/brain/sources
POST /api/brain/sources
DELETE /api/brain/sources/:id
PATCH /api/brain/sources/:id
```

Manage folders and URLs for indexing.

### Index Operations

```
POST /api/brain/index/folder
POST /api/brain/index/url
POST /api/brain/index/cancel
GET /api/brain/index/status
POST /api/brain/reindex
```

Control indexing operations.

### Semantic Search

```
POST /api/brain/search
Content-Type: application/json

{
  "query": "authentication middleware",
  "intent": "learn",
  "limit": 10
}
```

Available intents:
- `learn` - Understanding code
- `refactor` - Improving code
- `feature` - Adding new functionality
- `debug` - Finding and fixing bugs
- `test` - Writing tests

### Diagnostics & Metrics

```
GET /api/brain/metrics
GET /api/brain/diagnostic
POST /api/brain/benchmark
POST /api/brain/clear
```

## WebSocket Support

Connect to `ws://localhost:3456` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3456');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'brain_status' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Brain update:', data);
};

// Receive real-time events:
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'indexing-started':
      console.log('Indexing started:', msg.data);
      break;
    case 'indexing-progress':
      console.log('Progress:', msg.data.progress);
      break;
    case 'indexing-completed':
      console.log('Indexing done!');
      break;
    case 'indexing-cancelled':
      console.log('Indexing cancelled');
      break;
  }
});
```

## Configuration

The dashboard reads from the OpenCode brain configuration:

```bash
<project>/.opencode/brain.db              # Brain database
<project>/.opencode/brain-sources.json    # Index sources config
```

## Troubleshooting

### Dashboard Won't Start

```bash
# Check if port is in use (Windows)
netstat -ano | findstr :3456

# Kill existing process
taskkill /PID <pid> /F

# Try again
npm start
```

### Can't Connect to LM Studio

```bash
# Ensure LM Studio is running
# Check LM Studio settings for:
# - Server enabled
# - Port (default: 1234)
# - CORS enabled if needed
```

### Empty Search Results

```bash
# Run OpenCode to create database and index files
opencode

# Then use dashboard to re-index
```

### Database Not Found

```bash
# Start OpenCode to create the brain database
opencode

# The database will be created at:
# <project>/.opencode/brain.db
```

## Architecture

```
brain-dashboard/
├── server.js      # Express server + API routes
├── index.html     # Dashboard UI (vanilla JS)
├── package.json   # Dependencies
└── README.md      # This file
```

## Dependencies

- **express** - Web server
- **ws** - WebSocket support
- **better-sqlite3** - Database access

## License

MIT License

## Support

For issues or feature requests, please open an issue on the OpenCode repository.
