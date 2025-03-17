#!/bin/bash

# This script starts the GraphQL MCP server

# Display startup message
echo "Starting GraphQL MCP server for Claude Desktop..." >&2

# Set environment variables 
export GRAPHQL_API_ENDPOINT="https://countries.trevorblades.com/graphql"  # Replace with your actual endpoint
export GRAPHQL_API_KEY=""
export DEBUG="true"

# Compile TypeScript
echo "Compiling TypeScript..." >&2
npx tsc

# Start the server
node dist/graphql-mcp-server.js
