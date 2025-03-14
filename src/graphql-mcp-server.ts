#!/usr/bin/env node

import readline from 'readline';
import { GraphQLClient } from 'graphql-request';
import { 
  parse, 
  getIntrospectionQuery, 
  buildClientSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
  isObjectType,
  isListType,
  isNonNullType,
  isScalarType,
  isEnumType,
  isInputObjectType,
  GraphQLSchema,
  GraphQLArgument,
  GraphQLField,
  GraphQLType,
  GraphQLOutputType,
  GraphQLInputType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLScalarType,
  IntrospectionQuery
} from 'graphql';

// Type definitions for GraphQL MCP Server

// Configuration types
interface Config {
  endpoint: string;
  apiKey: string;
  debug: boolean;
  cacheTtl: number;
}

// Log data type
interface LogData {
  [key: string]: any;
}

// Query execution args
interface QueryExecutionArgs {
  query: string;
  variables?: Record<string, any>;
  endpoint?: string;
  headers?: Record<string, string>;
}

// MCP Tool Definition
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

// JSON-RPC Request
interface JSONRPCRequest {
  jsonrpc: string;
  id: number | string | null;
  method: string;
  params?: any;
}

// JSON-RPC Response
interface JSONRPCResponse {
  jsonrpc: string;
  id: number | string | null;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

// Field representation for selection sets
type FieldSelection = string | { name: string; fields: FieldSelection[] };

// Configuration
const GRAPHQL_API_ENDPOINT: string = process.env.GRAPHQL_API_ENDPOINT || 'https://countries.trevorblades.com/graphql';
const GRAPHQL_API_KEY: string = process.env.GRAPHQL_API_KEY || '';
const DEBUG: boolean = process.env.DEBUG === 'true';
const CACHE_TTL: number = 3600000; // 1 hour in milliseconds

// Debug logging to stderr
function log(level: string, message: string, data: LogData = {}): void {
  const timestamp = new Date().toISOString();
  console.error(JSON.stringify({ timestamp, level, message, ...data }));
}

// Global state
let schemaCache: GraphQLSchema | null = null;
let schemaFetchInProgress: boolean = false;
let schemaCacheExpiry: number | null = null;

// Execute GraphQL query
async function executeQuery(args: QueryExecutionArgs): Promise<any> {
  try {
    const endpoint = args.endpoint || GRAPHQL_API_ENDPOINT;
    if (!endpoint) {
      throw new Error("No GraphQL endpoint specified");
    }
    
    const headers: Record<string, string> = { ...(args.headers || {}) };
    if (GRAPHQL_API_KEY && !headers.Authorization) {
      headers.Authorization = `Bearer ${GRAPHQL_API_KEY}`;
    }
    
    // Validate query
    try {
      parse(args.query);
    } catch (error) {
      throw new Error(`Invalid GraphQL query: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Create client and execute query
    const client = new GraphQLClient(endpoint, { headers });
    const startTime = Date.now();
    const result = await client.request(args.query, args.variables || {});
    const duration = Date.now() - startTime;
    
    log("info", `GraphQL query executed successfully in ${duration}ms`);
    
    // Return the result directly, it will be formatted in the tool handler
    return result;
  } catch (error) {
    log("error", `Error executing GraphQL query: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`GraphQL query error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Fetch schema and generate tools
async function fetchSchema(): Promise<GraphQLSchema | null> {
  // Prevent concurrent schema fetches
  if (schemaFetchInProgress) {
    log("info", "Schema fetch already in progress, waiting for it to complete");
    while (schemaFetchInProgress) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return schemaCache;
  }
  
  // Check if we have a valid cached schema
  const now = Date.now();
  if (schemaCache && schemaCacheExpiry && now < schemaCacheExpiry) {
    log("info", "Using cached schema");
    return schemaCache;
  }
  
  try {
    schemaFetchInProgress = true;
    log("info", `Fetching GraphQL schema from ${GRAPHQL_API_ENDPOINT}`);
    
    // Build headers
    const headers: Record<string, string> = {};
    if (GRAPHQL_API_KEY) {
      headers.Authorization = `Bearer ${GRAPHQL_API_KEY}`;
    }
    
    // Create client and execute introspection query
    const client = new GraphQLClient(GRAPHQL_API_ENDPOINT, { headers });
    const startTime = Date.now();
    const data = await client.request<IntrospectionQuery>(getIntrospectionQuery());
    const schema = buildClientSchema(data);
    const duration = Date.now() - startTime;
    
    log("info", `Schema fetched successfully in ${duration}ms`);
    
    // Cache the schema
    schemaCache = schema;
    schemaCacheExpiry = now + CACHE_TTL;
    
    return schema;
  } catch (error) {
    log("error", `Error fetching schema: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    schemaFetchInProgress = false;
  }
}

// Get the actual type from a GraphQL type (removing List and NonNull wrappers)
function getNamedType(type: GraphQLType): GraphQLType {
  if (isNonNullType(type)) {
    return getNamedType(type.ofType);
  }
  if (isListType(type)) {
    return getNamedType(type.ofType);
  }
  return type;
}

// Get tools based on schema - TRULY DYNAMIC TOOLS GENERATION
function getToolsFromSchema(schema: GraphQLSchema | null): MCPTool[] {
  if (!schema) {
    return []; // Return empty tools list if no schema available
  }
  
  const tools: MCPTool[] = [];
  
  // Get the query type from the schema
  const queryType = schema.getQueryType();
  if (!queryType) {
    log("warning", "Schema has no query type");
    return tools;
  }
  
  // Get all available query fields
  const fields = queryType.getFields();
  
  // Process each query field as a potential tool
  for (const [fieldName, field] of Object.entries(fields)) {
    try {
      // Analyze arguments for the field
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      // Process arguments
      field.args.forEach(arg => {
        // Get the actual GraphQL type (unwrap non-null and list types)
        let argType = arg.type;
        let isNonNull = false;
        
        if (isNonNullType(argType)) {
          isNonNull = true;
          argType = argType.ofType;
        }
        
        let isList = false;
        if (isListType(argType)) {
          isList = true;
          argType = argType.ofType;
          // Unwrap non-null inside list if needed
          if (isNonNullType(argType)) {
            argType = argType.ofType;
          }
        }
        
        const baseType = getNamedType(argType);
        
        // Create property definition
        if (isScalarType(baseType)) {
          // For scalar types like Int, String, etc.
          properties[arg.name] = {
            type: getJsonSchemaType(baseType.name),
            description: arg.description || `${arg.name} parameter (${baseType.name})`
          };
        } else if (isEnumType(baseType)) {
          // For enum types, specify allowed values
          const enumValues = baseType.getValues().map(val => val.name);
          properties[arg.name] = {
            type: 'string',
            enum: enumValues,
            description: arg.description || `${arg.name} parameter (${baseType.name})`
          };
        } else if (isInputObjectType(baseType)) {
          // For input object types (complex types), describe it as object
          properties[arg.name] = {
            type: 'object',
            description: `${arg.name} - Input type: ${baseType.name}`
          };
          
          // If we wanted to go deeper, we could recursively define the object structure:
          // properties[arg.name].properties = getInputObjectProperties(baseType);
        } else {
          // Default catch-all
          properties[arg.name] = {
            type: 'string',
            description: arg.description || `${arg.name} parameter`
          };
        }
        
        // If arg is non-null, add to required list
        if (isNonNull) {
          required.push(arg.name);
        }
      });
      
      // Create a tool for this field
      const tool: MCPTool = {
        name: fieldName,
        description: field.description || `GraphQL ${fieldName} query`,
        inputSchema: {
          type: "object",
          properties: properties,
          required: required
        }
      };
      
      tools.push(tool);
    } catch (error) {
      log("error", `Error processing field ${fieldName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return tools;
}

// Helper function to convert GraphQL scalar types to JSON Schema types
function getJsonSchemaType(graphqlType: string): string {
  const typeMap: Record<string, string> = {
    'Int': 'integer',
    'Float': 'number',
    'String': 'string',
    'Boolean': 'boolean',
    'ID': 'string'
  };
  
  return typeMap[graphqlType] || 'string';
}

// Analyze object type fields to efficiently build query
function analyzeFields(
  type: GraphQLObjectType, 
  schema: GraphQLSchema, 
  visitedTypes: Set<string> = new Set(), 
  depth: number = 0
): FieldSelection[] {
  // Prevent infinite recursion and limit depth
  if (visitedTypes.has(type.name) || depth > 2) {
    return []; 
  }
  
  // For non-object types, just return empty array
  if (!isObjectType(type)) {
    return [];
  }
  
  visitedTypes.add(type.name);
  
  const fields = type.getFields();
  const result: FieldSelection[] = [];
  
  // Add fields to query (being careful of nested objects to avoid N+1 problems)
  for (const [fieldName, field] of Object.entries(fields)) {
    // Skip fields that need arguments - they might cause issues
    if (field.args.length > 0) {
      continue;
    }
    
    const fieldType = getNamedType(field.type);
    
    if (isScalarType(fieldType) || isEnumType(fieldType)) {
      // Include all scalar and enum fields directly
      result.push(fieldName);
    } else if (isObjectType(fieldType) && depth < 2) {
      // For object types, recurse one level to include key identifying fields
      // This is where we're careful about N+1 issues - limited depth
      const nestedFields = analyzeFields(fieldType, schema, visitedTypes, depth + 1);
      
      if (nestedFields.length > 0) {
        result.push({
          name: fieldName,
          fields: nestedFields.slice(0, 3) // Limit to first few fields to avoid overfetching
        });
      }
    }
  }
  
  return result;
}

// Build selection set string for GraphQL query
function buildSelectionSet(fields: FieldSelection[], indent: string = '    '): string {
  if (!fields || fields.length === 0) return '';
  
  let result = '';
  
  for (const field of fields) {
    if (typeof field === 'string') {
      // It's a scalar field
      result += `${indent}${field}\n`;
    } else if (typeof field === 'object' && field.name && field.fields) {
      // It's an object field with nested fields
      result += `${indent}${field.name} {\n${buildSelectionSet(field.fields, indent + '  ')}\n${indent}}\n`;
    }
  }
  
  return result;
}

// Process and validate input arguments based on schema
function processArguments(
  args: Record<string, any> | undefined, 
  fieldArgs: readonly GraphQLArgument[], 
  schema: GraphQLSchema
): Record<string, any> {
  if (!args || !fieldArgs) return {};
  
  const processedArgs: Record<string, any> = {};
  
  // Process each argument
  for (const [argName, argValue] of Object.entries(args)) {
    // Find the argument definition in the schema
    const argDef = fieldArgs.find(a => a.name === argName);
    if (!argDef) continue;
    
    const baseType = getNamedType(argDef.type);
    
    // Handle based on the type
    if (isInputObjectType(baseType)) {
      // For complex input types
      if (argValue === '') {
        // If it's an empty string, convert to null or empty object
        // depending on if it's required
        if (isNonNullType(argDef.type)) {
          processedArgs[argName] = {}; // Empty object for required inputs
        } else {
          processedArgs[argName] = null; // null for optional inputs
        }
      } else if (typeof argValue === 'string' && (argValue.startsWith('{') || argValue === '')) {
        // Try to parse as JSON if it looks like an object
        try {
          processedArgs[argName] = JSON.parse(argValue);
        } catch (e) {
          // If it can't be parsed, use null or empty object
          processedArgs[argName] = isNonNullType(argDef.type) ? {} : null;
        }
      } else {
        // Use as is if it's already an object
        processedArgs[argName] = argValue;
      }
    } else if (isEnumType(baseType)) {
      // For enum types, ensure the value is a string
      processedArgs[argName] = String(argValue);
    } else if (isScalarType(baseType)) {
      // Handle scalar types
      if (baseType.name === 'Int') {
        processedArgs[argName] = parseInt(argValue, 10);
      } else if (baseType.name === 'Float') {
        processedArgs[argName] = parseFloat(argValue);
      } else if (baseType.name === 'Boolean') {
        processedArgs[argName] = Boolean(argValue);
      } else {
        processedArgs[argName] = argValue;
      }
    } else {
      // Default: use as-is
      processedArgs[argName] = argValue;
    }
    
    // Skip null or undefined values for non-required fields
    if ((processedArgs[argName] === null || processedArgs[argName] === undefined) && 
        !isNonNullType(argDef.type)) {
      delete processedArgs[argName];
    }
  }
  
  return processedArgs;
}

// Handle tool execution
async function executeGraphQLTool(name: string, args: Record<string, any> | undefined): Promise<any> {
  try {
    // Get the schema
    const schema = await fetchSchema();
    if (!schema) {
      throw new Error("Schema not available");
    }
    
    // Get the query type
    const queryType = schema.getQueryType();
    if (!queryType) {
      throw new Error("Schema has no query type");
    }
    
    // Get the field for this tool
    const fields = queryType.getFields();
    const field = fields[name];
    
    if (!field) {
      throw new Error(`Unknown field: ${name}`);
    }
    
    try {
      // Process input arguments
      const processedArgs = processArguments(args, field.args, schema);
      
      // Get return type and analyze it
      const returnType = getNamedType(field.type);
      
      // First determine which arguments are actually being used
      const usedArgNames: string[] = [];
      field.args.forEach(arg => {
        if (processedArgs && processedArgs[arg.name] !== undefined) {
          usedArgNames.push(arg.name);
        }
      });

      // Build variables definition - only for arguments that are actually used
      const varDefs = field.args
        .filter(arg => usedArgNames.includes(arg.name))
        .map(arg => {
          // Need to preserve non-null and list wrappers in variable definitions
          const typeStr = arg.type.toString();
          return `$${arg.name}: ${typeStr}`;
        })
        .filter(Boolean)
        .join(', ');
      
      // Build field arguments - only for arguments that are actually used
      const fieldArgs = usedArgNames
        .map(argName => {
          return `${argName}: $${argName}`;
        })
        .join(', ');
      
      // Build selection set based on return type
      let selectionSet = '';
      
      if (isObjectType(returnType)) {
        // For objects or lists of objects, analyze fields
        const fields = analyzeFields(returnType, schema);
        selectionSet = buildSelectionSet(fields);
      } else if (isListType(returnType)) {
        // For lists, unwrap and analyze the inner type
        const innerType = getNamedType(returnType.ofType);
        if (isObjectType(innerType)) {
          const fields = analyzeFields(innerType as GraphQLObjectType, schema);
          selectionSet = buildSelectionSet(fields);
        }
      }
      
      // Build the final query
      // Only include variable definitions if fieldArgs is used
      const shouldIncludeVarDefs = fieldArgs && fieldArgs.length > 0;
      const query = `
        query ${name}Query${shouldIncludeVarDefs ? `(${varDefs})` : ''} {
          ${name}${fieldArgs && fieldArgs.length > 0 ? `(${fieldArgs})` : ''} ${selectionSet ? `{\n${selectionSet}  }` : ''}
        }
      `;
      
      log("debug", `Generated query for ${name}:`, { query, variables: processedArgs });
      
      // Execute the query
      return await executeQuery({ query, variables: processedArgs });
    } catch (error) {
      throw new Error(`Error executing query for ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    log("error", `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Provide resources list (empty but handled to be more compatible)
function getResourcesList(): { resources: any[] } {
  return { resources: [] };
}

// Provide prompts list (empty but handled to be more compatible)
function getPromptsList(): { prompts: any[] } {
  return { prompts: [] };
}

async function main(): Promise<void> {
  try {
    log("info", "GraphQL MCP Server starting...");
    log("info", `GraphQL API Endpoint: ${GRAPHQL_API_ENDPOINT}`);
    log("info", `API Key: ${GRAPHQL_API_KEY ? "Configured" : "Not configured"}`);
    
    // Set up readline interface for stdin/stdout
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    // Handle incoming JSON-RPC messages
    rl.on('line', async (line: string) => {
      try {
        if (DEBUG) {
          log("debug", `Received message: ${line.substring(0, 100)}...`);
        }
        
        const request: JSONRPCRequest = JSON.parse(line);
        const { method, id } = request;
        
        // Handle initialize
        if (method === 'initialize') {
          log("info", "Handling initialize request");
          const response: JSONRPCResponse = {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
                resources: {},
                prompts: {}
              },
              serverInfo: {
                name: "graphql-mcp-server",
                version: "1.0.0"
              }
            }
          };
          console.log(JSON.stringify(response));
          return;
        }
        
        // Handle initialized notification
        if (method === 'notifications/initialized') {
          // No response needed for notifications
          return;
        }
        
        // Handle tools/list
        if (method === 'tools/list') {
          // Get schema (will use cache if available)
          const schema = await fetchSchema();
          const tools = getToolsFromSchema(schema);
          
          log("info", `Returning ${tools.length} tools`);
          
          const response: JSONRPCResponse = {
            jsonrpc: "2.0",
            id,
            result: {
              tools
            }
          };
          console.log(JSON.stringify(response));
          return;
        }
        
        // Handle tools/call 
        if (method === 'tools/call' || method === 'tool.call') {
          const { name, arguments: args } = request.params;
          log("info", `Tool call: ${name}`, { args });
          
          // Get result from GraphQL tool execution
          try {
            const result = await executeGraphQLTool(name, args);
            
            // Log the result structure
            log("debug", `Result structure for ${name}:`, { resultStructure: JSON.stringify(result) });
            
            // Format response with content array containing a text element
            const response: JSONRPCResponse = {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
              }
            };
            console.log(JSON.stringify(response));
          } catch (error) {
            log("error", `Error in tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
            
            // Format error response
            const response: JSONRPCResponse = {
              jsonrpc: "2.0",
              id,
              error: {
                code: -32000,
                message: error instanceof Error ? error.message : String(error)
              }
            };
            console.log(JSON.stringify(response));
          }
          return;
        }
        
        // Handle resources/list
        if (method === 'resources/list') {
          const response: JSONRPCResponse = {
            jsonrpc: "2.0",
            id,
            result: getResourcesList()
          };
          console.log(JSON.stringify(response));
          return;
        }
        
        // Handle prompts/list
        if (method === 'prompts/list') {
          const response: JSONRPCResponse = {
            jsonrpc: "2.0",
            id,
            result: getPromptsList()
          };
          console.log(JSON.stringify(response));
          return;
        }
        
        // Method not found
        log("warning", `Method not found: ${method}`);
        const response: JSONRPCResponse = {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method '${method}' not found`
          }
        };
        console.log(JSON.stringify(response));
      } catch (error) {
        log("error", `Error processing message: ${error instanceof Error ? error.message : String(error)}`, { 
          stack: error instanceof Error ? error.stack : undefined 
        });
        
        // Try to get the ID from the original message
        let id = null;
        try {
          id = JSON.parse(line).id;
        } catch {
          // Ignore parse errors
        }
        
        // Return error response
        const response: JSONRPCResponse = {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: `Error processing request: ${error instanceof Error ? error.message : String(error)}`
          }
        };
        console.log(JSON.stringify(response));
      }
    });
    
    // Handle process termination
    process.on('uncaughtException', (error: Error) => {
      log("error", `Uncaught exception: ${error.message}`, { stack: error.stack });
    });
    
    process.on('unhandledRejection', (reason: any) => {
      log("error", `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
    });
    
    // Initialize schema in the background
    fetchSchema().catch(error => {
      log("error", `Initial schema fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    
    log("info", "GraphQL MCP Server started and ready");
  } catch (error) {
    log("error", "Fatal error during initialization:", { 
      error: error instanceof Error ? error.message : String(error), 
      stack: error instanceof Error ? error.stack : undefined 
    });
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
