# Luma MCP App - Event Analytics

This is a protoype MCP App to test draft spec support on an experimental build of Apollo MCP Server, built with Apollo Server v5, Apollo Connectors, and Apollo MCP Server.

## Prerequisites

- **Node.js 20.0.0+** (required for Apollo Server v5)
- Luma API key (this is a paid API so there is mock data available for testing this app without the Luma API)
- **Apollo Rover CLI** (required for Connectors support)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Add your Luma API key to `.env` or set `USE_MOCK_DATA=true`

3. **Install Rover (if not installed):**
   ```bash
   curl -sSL https://rover.apollo.dev/nix/latest | sh
   ```

## Development

### Running Locally with Local MCP Binary

This application requires **three processes** running simultaneously:

**Terminal 1 - Start the analytics subgraph:**
```bash
npm start
```
This starts the Apollo Server analytics subgraph on port 4001.

**Terminal 2 - Start the Apollo Router:**
```bash
# Export environment variables first
export $(cat .env | xargs)
npm run router
```
This starts the Apollo Router with Connectors support on port 4000. The router:
- Executes Apollo Connectors queries directly
- Proxies analytics queries to your analytics subgraph on port 4001
- Uses LUMA_API_KEY from environment variables for API authentication

**Terminal 3 - Start the local MCP server:**
```bash
npm run mcp
```
This starts the custom `apollo-mcp-server` binary on port 8000, which provides the MCP protocol interface to the supergraph running on port 4000.

Once all three are running, the MCP server will be available at `http://localhost:8000`.

## Project Structure

```
luma-mcp-app/
├── apps/
│   └── luma-analytics/
│       ├── .application-manifest.json  # MCP App definition
│       ├── dashboard.html              # MCP App UI
│       └── mock-data.json              # Mock data for testing
├── connectors/
│   └── luma/
│       └── schema.graphql              # Apollo Connectors schema
├── src/
│   ├── schema.graphql                  # Analytics subgraph schema
│   └── server.js                       # Analytics subgraph resolver
├── .env                                # Environment variables (not in git)
├── .env.example                        # Environment template
├── mcp.yaml                            # MCP server config
├── supergraph.yaml                     # Federation config
├── apollo-mcp-server                   # Apollo MCP Server binary
└── package.json
```

## API Endpoints

The Luma connector provides:

- `events` - List events with pagination
- `eventGuests` - Get guests for a specific event

## MCP Tools

- `analyze_events` - Analyze Luma events with interactive visualization dashboard

## Mock Data for Testing

To test the app without a Luma API key:

1. Set `USE_MOCK_DATA=true` in your `.env` file
2. Mock data is loaded from `apps/luma-analytics/mock-data.json`
3. The `calendarId` parameter is ignored when using mock data
