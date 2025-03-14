# Getting Started with GraphQL MCP Server

This guide will walk you through setting up and using the GraphQL MCP server with Claude Desktop.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/graphql-mcp.git
   cd graphql-mcp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the TypeScript code**:
   ```bash
   npm run build
   ```

## Configuration

### Server Configuration

1. **Set up environment variables**:
   Copy the sample environment file:
   ```bash
   cp .env.sample .env.development
   ```

2. **Edit the environment file** with your GraphQL API details:
   ```
   GRAPHQL_API_ENDPOINT=https://your-graphql-api.com/graphql
   GRAPHQL_API_KEY=your-api-key-if-needed
   DEBUG=true
   ```

### Running the Server

You can run the server with one of these methods:

**Using npm scripts**:
```bash
# Build the TypeScript code
npm run build

# Run the compiled server
npm start
```

**Development mode with live-reload**:
```bash
# Run directly from TypeScript with auto-reloading on changes
npm run dev:watch
```

**Using the provided script**:
```bash
# Compiles TypeScript and runs the server
./run-graphql-mcp.sh
```

### Claude Desktop Integration

1. **Locate your Claude Desktop configuration file**:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Add the GraphQL MCP server configuration**:
   ```json
   {
     "mcpServers": {
       "graphql": {
         "command": "node",
         "args": ["/absolute/path/to/dist/graphql-mcp-server.js"],
         "env": {
           "GRAPHQL_API_ENDPOINT": "https://your-graphql-api.com/graphql",
           "GRAPHQL_API_KEY": "your-api-key-if-needed",
           "DEBUG": "true"
         }
       }
     }
   }
   ```

   Replace `/absolute/path/to` with the actual absolute path to your project directory.

3. **Restart Claude Desktop** to apply the changes.

## Testing the Connection

1. **Open Claude Desktop**

2. **Verify server connection**:
   Type:
   ```
   What tools do you have available from the graphql server?
   ```
   Claude should respond with a list of available GraphQL operations.

3. **Test a simple query**:
   ```
   View result from continents from graphql (local){}
   ```
   Claude should display the continents data from the GraphQL API.

## Using GraphQL Queries

The server dynamically creates tools for all GraphQL operations. You can use them with this syntax:

```
View result from [operation_name] from graphql (local){
  "param1": "value1",
  "param2": "value2"
}
```

Examples:

1. **Query with no parameters**:
   ```
   View result from continents from graphql (local){}
   ```

2. **Query with parameters**:
   ```
   View result from country from graphql (local){
     "code": "US"
   }
   ```

3. **Query with complex parameters**:
   ```
   View result from countries from graphql (local){
     "filter": {
       "continent": {
         "eq": "EU"
       }
     }
   }
   ```

## Development Workflow

1. **Make changes** to the TypeScript source in `src/graphql-mcp-server.ts`

2. **Compile the TypeScript code**:
   ```bash
   npm run build
   ```

3. **Run the server**:
   ```bash
   npm start
   ```

4. **For faster development**, use the watch mode:
   ```bash
   npm run dev:watch
   ```

## Troubleshooting

If you encounter issues:

1. **Check the logs**: Look for error messages in the Claude Desktop logs and terminal output
2. **Verify API access**: Ensure your GraphQL API endpoint is accessible and your API key is valid
3. **Check for TypeScript errors**: Ensure there are no compilation errors
4. **Restart the server**: Sometimes simply restarting Claude Desktop can resolve connection issues

## Next Steps

For more advanced usage and technical details, see:
- [Technical Documentation](./TECHNICAL.md)
- [Project Status](./PROJECT_STATUS.md)
