# GraphQL MCP Server

A strongly-typed TypeScript Model Context Protocol (MCP) server that provides seamless access to any GraphQL API through Claude AI.

## Features

- **Strongly Typed**: Built with TypeScript for improved code quality and type safety
- **Dynamic GraphQL Integration**: Connect to any GraphQL API with automatic tool generation
- **Schema Introspection**: Automatically discovers and exposes all GraphQL operations as tools
- **Rich Type Support**: Properly handles complex GraphQL types, input objects, and variables
- **MCP Standard Compliant**: Follows the Model Context Protocol format for seamless Claude integration
- **Smart Query Generation**: Builds efficient GraphQL queries with proper field selection
- **Authentication Support**: Simple API key authentication

## Repository Structure

```
graphql-mcp/
├── src/
│   └── graphql-mcp-server.ts     # Main server implementation (TypeScript)
├── dist/                         # Compiled JavaScript (generated)
├── docs/
│   ├── GETTING_STARTED.md         # Setup and usage guide
│   ├── PROJECT_STATUS.md          # Current project status
│   └── TECHNICAL.md               # Technical documentation
├── .env.development               # Environment variables
├── .env.sample                    # Sample environment template
├── claude_desktop_sample_config.json  # Sample Claude Desktop config
├── package.json                   # Project dependencies
├── tsconfig.json                  # TypeScript configuration
├── run-graphql-mcp.sh             # Script to run the server
└── README.md                      # This file
```

## Prerequisites

- Node.js 18 or later
- TypeScript 5.x or later
- Claude Desktop with MCP support
- A GraphQL API endpoint (defaults to the Countries API if not specified)

## Quick Start

### 1. Setup Environment Variables

Copy the sample env file and update it with your GraphQL API details:

```bash
cp .env.sample .env.development
```

Edit `.env.development` with your GraphQL API endpoint and optional API key.

### 2. Build and Run

First compile the TypeScript code:

```bash
npm install
npm run build
```

Then run the server:

```bash
node dist/graphql-mcp-server.js
```

Or use the provided script that compiles and runs in one step:

```bash
./run-graphql-mcp.sh
```

### 3. Claude Desktop Integration

Add this server to your Claude Desktop configuration:

1. Use the sample config as a template:
   ```bash
   cp claude_desktop_sample_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Edit the config and update the path to point to your installation:
   ```json
   {
     "mcpServers": {
       "graphql": {
         "command": "node",
         "args": ["/absolute/path/to/dist/graphql-mcp-server.js"],
         "env": {
           "GRAPHQL_API_ENDPOINT": "https://your-graphql-api.com/graphql",
           "GRAPHQL_API_KEY": "your-api-key-if-needed"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop to connect to the server

You should now see GraphQL operations as available tools in Claude Desktop!

## Example Usage

Once connected to Claude Desktop, you can use commands like:

```
View result from countries from graphql (local){}
```

Or with parameters:

```
View result from country from graphql (local){
  "code": "US"
}
```

## Documentation

For more detailed information, see:

- [Getting Started Guide](./docs/GETTING_STARTED.md)
- [Technical Documentation](./docs/TECHNICAL.md)
- [Project Status](./docs/PROJECT_STATUS.md)

## Development

To make changes to the server:

1. Modify the TypeScript source in `src/graphql-mcp-server.ts`
2. Compile the TypeScript code: `npm run build`
3. Run the compiled server: `node dist/graphql-mcp-server.js`

## License

This project is licensed under the Business Source License 1.1 (BSL 1.1), which allows:

- **Non-commercial use**: You may use this software for any non-commercial purpose
- **Internal business use**: You may use this software for internal business operations that do not provide it to third parties as a hosted or managed service
- **Open source conversion**: On March 14, 2029, the code will automatically convert to the MIT license

Commercial use, including offering this software as a service to others, requires a commercial license from CTK Advisors. For more information, contact us or see the full [LICENSE](./LICENSE) file.

The BSL license is designed to balance open source availability with sustainable commercial development, giving everyone free access for non-commercial purposes while protecting our ability to support and enhance the software long-term.
