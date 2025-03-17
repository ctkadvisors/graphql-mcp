#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
const graphql_request_1 = require("graphql-request");
const graphql_1 = require("graphql");
// Configuration
const GRAPHQL_API_ENDPOINT = process.env.GRAPHQL_API_ENDPOINT ||
    "https://countries.trevorblades.com/graphql";
const GRAPHQL_API_KEY = process.env.GRAPHQL_API_KEY || "";
const DEBUG = process.env.DEBUG === "true";
const CACHE_TTL = 3600000; // 1 hour in milliseconds
// Parse whitelisted queries from environment variable
let WHITELISTED_QUERIES = null;
if (process.env.WHITELISTED_QUERIES) {
    try {
        if (typeof process.env.WHITELISTED_QUERIES === "string") {
            // Try parsing as JSON array first
            if (process.env.WHITELISTED_QUERIES.startsWith("[")) {
                WHITELISTED_QUERIES = JSON.parse(process.env.WHITELISTED_QUERIES);
            }
            else {
                // Otherwise treat as comma-separated list
                WHITELISTED_QUERIES = process.env.WHITELISTED_QUERIES.split(",")
                    .map((q) => q.trim())
                    .filter(Boolean);
            }
        }
        log("info", `Loaded whitelist with ${(WHITELISTED_QUERIES && WHITELISTED_QUERIES.length) || 0} queries`, { whitelist: WHITELISTED_QUERIES });
    }
    catch (error) {
        log("error", `Failed to parse WHITELISTED_QUERIES: ${error instanceof Error ? error.message : String(error)}`);
        // If parsing fails, don't use a whitelist
        WHITELISTED_QUERIES = null;
    }
}
// Parse whitelisted mutations from environment variable
let WHITELISTED_MUTATIONS = null;
if (process.env.WHITELISTED_MUTATIONS) {
    try {
        if (typeof process.env.WHITELISTED_MUTATIONS === "string") {
            // Try parsing as JSON array first
            if (process.env.WHITELISTED_MUTATIONS.startsWith("[")) {
                WHITELISTED_MUTATIONS = JSON.parse(process.env.WHITELISTED_MUTATIONS);
            }
            else {
                // Otherwise treat as comma-separated list
                WHITELISTED_MUTATIONS = process.env.WHITELISTED_MUTATIONS.split(",")
                    .map((q) => q.trim())
                    .filter(Boolean);
            }
        }
        log("info", `Loaded mutation whitelist with ${WHITELISTED_MUTATIONS?.length || 0} mutations`, { whitelist: WHITELISTED_MUTATIONS });
    }
    catch (error) {
        log("error", `Failed to parse WHITELISTED_MUTATIONS: ${error instanceof Error ? error.message : String(error)}`);
        // If parsing fails, don't use a whitelist
        WHITELISTED_MUTATIONS = null;
    }
}
// Debug logging to stderr
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.error(JSON.stringify({ timestamp, level, message, ...data }));
}
// Global state
let schemaCache = null;
let schemaFetchInProgress = false;
let schemaCacheExpiry = null;
// Map of truncated tool names to original field names
let toolNameMappings = {};
// Execute GraphQL query
async function executeQuery(args) {
    try {
        const endpoint = args.endpoint || GRAPHQL_API_ENDPOINT;
        if (!endpoint) {
            throw new Error("No GraphQL endpoint specified");
        }
        const headers = { ...(args.headers || {}) };
        if (GRAPHQL_API_KEY && !headers.Authorization) {
            headers.Authorization = `Bearer ${GRAPHQL_API_KEY}`;
        }
        // Validate query
        try {
            (0, graphql_1.parse)(args.query);
        }
        catch (error) {
            throw new Error(`Invalid GraphQL query: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Create client and execute query
        const client = new graphql_request_1.GraphQLClient(endpoint, { headers });
        const startTime = Date.now();
        const result = await client.request(args.query, args.variables || {});
        const duration = Date.now() - startTime;
        log("info", `GraphQL query executed successfully in ${duration}ms`);
        // Return the result directly, it will be formatted in the tool handler
        return result;
    }
    catch (error) {
        log("error", `Error executing GraphQL query: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`GraphQL query error: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Fetch schema and generate tools
async function fetchSchema() {
    // Prevent concurrent schema fetches
    if (schemaFetchInProgress) {
        log("info", "Schema fetch already in progress, waiting for it to complete");
        while (schemaFetchInProgress) {
            await new Promise((resolve) => setTimeout(resolve, 50));
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
        const headers = {};
        if (GRAPHQL_API_KEY) {
            headers.Authorization = `Bearer ${GRAPHQL_API_KEY}`;
        }
        // Create client and execute introspection query
        const client = new graphql_request_1.GraphQLClient(GRAPHQL_API_ENDPOINT, { headers });
        const startTime = Date.now();
        const data = await client.request((0, graphql_1.getIntrospectionQuery)());
        const schema = (0, graphql_1.buildClientSchema)(data);
        const duration = Date.now() - startTime;
        log("info", `Schema fetched successfully in ${duration}ms`);
        // Cache the schema and reset the name mappings
        schemaCache = schema;
        schemaCacheExpiry = now + CACHE_TTL;
        toolNameMappings = {}; // Reset mappings as schema might have changed
        return schema;
    }
    catch (error) {
        log("error", `Error fetching schema: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
    finally {
        schemaFetchInProgress = false;
    }
}
// Get the actual type from a GraphQL type (removing List and NonNull wrappers)
function getNamedType(type) {
    if ((0, graphql_1.isNonNullType)(type)) {
        return getNamedType(type.ofType);
    }
    if ((0, graphql_1.isListType)(type)) {
        return getNamedType(type.ofType);
    }
    return type;
}
// Get tools based on schema - TRULY DYNAMIC TOOLS GENERATION
function getToolsFromSchema(schema) {
    if (!schema) {
        return []; // Return empty tools list if no schema available
    }
    const tools = [];
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
        // Skip fields that aren't in the whitelist (if a whitelist is provided)
        if (WHITELISTED_QUERIES && !WHITELISTED_QUERIES.includes(fieldName)) {
            if (DEBUG) {
                log("debug", `Skipping field ${fieldName} - not in whitelist`);
            }
            continue;
        }
        try {
            // Analyze arguments for the field
            const properties = {};
            const required = [];
            // Process arguments
            field.args.forEach((arg) => {
                // Get the actual GraphQL type (unwrap non-null and list types)
                let argType = arg.type;
                let isNonNull = false;
                if ((0, graphql_1.isNonNullType)(argType)) {
                    isNonNull = true;
                    argType = argType.ofType;
                }
                let isList = false;
                if ((0, graphql_1.isListType)(argType)) {
                    isList = true;
                    argType = argType.ofType;
                    // Unwrap non-null inside list if needed
                    if ((0, graphql_1.isNonNullType)(argType)) {
                        argType = argType.ofType;
                    }
                }
                const baseType = getNamedType(argType);
                // Create property definition
                if ((0, graphql_1.isScalarType)(baseType)) {
                    // For scalar types like Int, String, etc.
                    properties[arg.name] = {
                        type: getJsonSchemaType(baseType.name),
                        description: arg.description || `${arg.name} parameter (${baseType.name})`,
                    };
                }
                else if ((0, graphql_1.isEnumType)(baseType)) {
                    // For enum types, specify allowed values
                    const enumValues = baseType.getValues().map((val) => val.name);
                    properties[arg.name] = {
                        type: "string",
                        enum: enumValues,
                        description: arg.description || `${arg.name} parameter (${baseType.name})`,
                    };
                }
                else if ((0, graphql_1.isInputObjectType)(baseType)) {
                    // For input object types (complex types), describe it as object
                    properties[arg.name] = {
                        type: "object",
                        description: `${arg.name} - Input type: ${baseType.name}`,
                    };
                    // If we wanted to go deeper, we could recursively define the object structure:
                    // properties[arg.name].properties = getInputObjectProperties(baseType);
                }
                else {
                    // Default catch-all
                    properties[arg.name] = {
                        type: "string",
                        description: arg.description || `${arg.name} parameter`,
                    };
                }
                // If arg is non-null, add to required list
                if (isNonNull) {
                    required.push(arg.name);
                }
            });
            // Create a tool for this field - Truncate name to 64 characters if needed
            const truncatedName = fieldName.length > 64 ? fieldName.substring(0, 64) : fieldName;
            // Store mapping from truncated to original name if truncation occurred
            if (truncatedName !== fieldName) {
                toolNameMappings[truncatedName] = fieldName;
            }
            const tool = {
                name: truncatedName,
                description: field.description || `GraphQL ${fieldName} query`,
                inputSchema: {
                    type: "object",
                    properties: properties,
                    required: required,
                },
            };
            tools.push(tool);
        }
        catch (error) {
            log("error", `Error processing field ${fieldName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return tools;
}
// Get tools based on mutation schema
function getToolsFromMutationType(schema) {
    if (!schema) {
        return []; // Return empty tools list if no schema available
    }
    const tools = [];
    // Get the mutation type from the schema
    const mutationType = schema.getMutationType();
    if (!mutationType) {
        log("info", "Schema has no mutation type");
        return tools;
    }
    // Get all available mutation fields
    const fields = mutationType.getFields();
    // Process each mutation field as a potential tool
    for (const [fieldName, field] of Object.entries(fields)) {
        // Skip fields that aren't in the whitelist (if a whitelist is provided)
        if (WHITELISTED_MUTATIONS && !WHITELISTED_MUTATIONS.includes(fieldName)) {
            if (DEBUG) {
                log("debug", `Skipping mutation field ${fieldName} - not in whitelist`);
            }
            continue;
        }
        try {
            // Analyze arguments for the field
            const properties = {};
            const required = [];
            // Process arguments (same logic as query arguments)
            field.args.forEach((arg) => {
                // Get the actual GraphQL type (unwrap non-null and list types)
                let argType = arg.type;
                let isNonNull = false;
                if ((0, graphql_1.isNonNullType)(argType)) {
                    isNonNull = true;
                    argType = argType.ofType;
                }
                let isList = false;
                if ((0, graphql_1.isListType)(argType)) {
                    isList = true;
                    argType = argType.ofType;
                    // Unwrap non-null inside list if needed
                    if ((0, graphql_1.isNonNullType)(argType)) {
                        argType = argType.ofType;
                    }
                }
                const baseType = getNamedType(argType);
                // Create property definition
                if ((0, graphql_1.isScalarType)(baseType)) {
                    // For scalar types like Int, String, etc.
                    properties[arg.name] = {
                        type: getJsonSchemaType(baseType.name),
                        description: arg.description || `${arg.name} parameter (${baseType.name})`,
                    };
                }
                else if ((0, graphql_1.isEnumType)(baseType)) {
                    // For enum types, specify allowed values
                    const enumValues = baseType.getValues().map((val) => val.name);
                    properties[arg.name] = {
                        type: "string",
                        enum: enumValues,
                        description: arg.description || `${arg.name} parameter (${baseType.name})`,
                    };
                }
                else if ((0, graphql_1.isInputObjectType)(baseType)) {
                    // For input object types (complex types), describe it as object
                    properties[arg.name] = {
                        type: "object",
                        description: `${arg.name} - Input type: ${baseType.name}`,
                    };
                }
                else {
                    // Default catch-all
                    properties[arg.name] = {
                        type: "string",
                        description: arg.description || `${arg.name} parameter`,
                    };
                }
                // If arg is non-null, add to required list
                if (isNonNull) {
                    required.push(arg.name);
                }
            });
            // Create a tool for this mutation field - Truncate name to 64 characters if needed
            let fullName = `mutation_${fieldName}`;
            let truncatedName = fullName;
            if (fullName.length > 64) {
                // Truncate the fieldName part to make the full name fit in 64 chars
                // Keep the mutation_ prefix for clarity
                const prefixLength = "mutation_".length;
                const maxFieldNameLength = 64 - prefixLength;
                truncatedName = `mutation_${fieldName.substring(0, maxFieldNameLength)}`;
                // Store mapping from truncated to original full name
                toolNameMappings[truncatedName] = fullName;
            }
            const tool = {
                name: truncatedName,
                description: field.description || `GraphQL ${fieldName} mutation`,
                inputSchema: {
                    type: "object",
                    properties: properties,
                    required: required,
                },
            };
            tools.push(tool);
        }
        catch (error) {
            log("error", `Error processing mutation field ${fieldName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return tools;
}
// Helper function to convert GraphQL scalar types to JSON Schema types
function getJsonSchemaType(graphqlType) {
    const typeMap = {
        Int: "integer",
        Float: "number",
        String: "string",
        Boolean: "boolean",
        ID: "string",
    };
    return typeMap[graphqlType] || "string";
}
// Analyze object type fields to efficiently build query
function analyzeFields(type, schema, visitedTypes = new Set(), depth = 0) {
    // Prevent infinite recursion and limit depth
    if (visitedTypes.has(type.name) || depth > 2) {
        return [];
    }
    // For non-object types, just return empty array
    if (!(0, graphql_1.isObjectType)(type)) {
        return [];
    }
    visitedTypes.add(type.name);
    const fields = type.getFields();
    const result = [];
    // Add fields to query (being careful of nested objects to avoid N+1 problems)
    for (const [fieldName, field] of Object.entries(fields)) {
        // Skip fields that need arguments - they might cause issues
        if (field.args.length > 0) {
            continue;
        }
        const fieldType = getNamedType(field.type);
        if ((0, graphql_1.isScalarType)(fieldType) || (0, graphql_1.isEnumType)(fieldType)) {
            // Include all scalar and enum fields directly
            result.push(fieldName);
        }
        else if ((0, graphql_1.isObjectType)(fieldType) && depth < 2) {
            // For object types, recurse one level to include key identifying fields
            // This is where we're careful about N+1 issues - limited depth
            const nestedFields = analyzeFields(fieldType, schema, visitedTypes, depth + 1);
            if (nestedFields.length > 0) {
                result.push({
                    name: fieldName,
                    fields: nestedFields.slice(0, 3), // Limit to first few fields to avoid overfetching
                });
            }
        }
    }
    return result;
}
// Build selection set string for GraphQL query
function buildSelectionSet(fields, indent = "    ") {
    if (!fields || fields.length === 0)
        return "";
    let result = "";
    for (const field of fields) {
        if (typeof field === "string") {
            // It's a scalar field
            result += `${indent}${field}\n`;
        }
        else if (typeof field === "object" && field.name && field.fields) {
            // It's an object field with nested fields
            result += `${indent}${field.name} {\n${buildSelectionSet(field.fields, indent + "  ")}\n${indent}}\n`;
        }
    }
    return result;
}
// Process and validate input arguments based on schema
function processArguments(args, fieldArgs, schema) {
    if (!args || !fieldArgs)
        return {};
    const processedArgs = {};
    // Process each argument
    for (const [argName, argValue] of Object.entries(args)) {
        // Find the argument definition in the schema
        const argDef = fieldArgs.find((a) => a.name === argName);
        if (!argDef)
            continue;
        const baseType = getNamedType(argDef.type);
        // Handle based on the type
        if ((0, graphql_1.isInputObjectType)(baseType)) {
            // For complex input types
            if (argValue === "") {
                // If it's an empty string, convert to null or empty object
                // depending on if it's required
                if ((0, graphql_1.isNonNullType)(argDef.type)) {
                    processedArgs[argName] = {}; // Empty object for required inputs
                }
                else {
                    processedArgs[argName] = null; // null for optional inputs
                }
            }
            else if (typeof argValue === "string" &&
                (argValue.startsWith("{") || argValue === "")) {
                // Try to parse as JSON if it looks like an object
                try {
                    processedArgs[argName] = JSON.parse(argValue);
                }
                catch (e) {
                    // If it can't be parsed, use null or empty object
                    processedArgs[argName] = (0, graphql_1.isNonNullType)(argDef.type) ? {} : null;
                }
            }
            else {
                // Use as is if it's already an object
                processedArgs[argName] = argValue;
            }
        }
        else if ((0, graphql_1.isEnumType)(baseType)) {
            // For enum types, ensure the value is a string
            processedArgs[argName] = String(argValue);
        }
        else if ((0, graphql_1.isScalarType)(baseType)) {
            // Handle scalar types
            if (baseType.name === "Int") {
                processedArgs[argName] = parseInt(argValue, 10);
            }
            else if (baseType.name === "Float") {
                processedArgs[argName] = parseFloat(argValue);
            }
            else if (baseType.name === "Boolean") {
                processedArgs[argName] = Boolean(argValue);
            }
            else {
                processedArgs[argName] = argValue;
            }
        }
        else {
            // Default: use as-is
            processedArgs[argName] = argValue;
        }
        // Skip null or undefined values for non-required fields
        if ((processedArgs[argName] === null ||
            processedArgs[argName] === undefined) &&
            !(0, graphql_1.isNonNullType)(argDef.type)) {
            delete processedArgs[argName];
        }
    }
    return processedArgs;
}
// Handle tool execution
async function executeGraphQLTool(name, args) {
    try {
        // If this name is in our mapping, use the original field name
        const actualFieldName = toolNameMappings[name] || name;
        // Check if the tool is in the whitelist (if whitelist is enabled)
        if (WHITELISTED_QUERIES && !WHITELISTED_QUERIES.includes(actualFieldName)) {
            throw new Error(`Tool '${actualFieldName}' is not in the whitelist`);
        }
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
        // Get the field for this tool using the resolved field name
        const fields = queryType.getFields();
        const field = fields[actualFieldName];
        if (!field) {
            throw new Error(`Unknown field: ${actualFieldName}`);
        }
        try {
            // Process input arguments
            const processedArgs = processArguments(args, field.args, schema);
            // Get return type and analyze it
            const returnType = getNamedType(field.type);
            // First determine which arguments are actually being used
            const usedArgNames = [];
            field.args.forEach((arg) => {
                if (processedArgs && processedArgs[arg.name] !== undefined) {
                    usedArgNames.push(arg.name);
                }
            });
            // Build variables definition - only for arguments that are actually used
            const varDefs = field.args
                .filter((arg) => usedArgNames.includes(arg.name))
                .map((arg) => {
                // Need to preserve non-null and list wrappers in variable definitions
                const typeStr = arg.type.toString();
                return `$${arg.name}: ${typeStr}`;
            })
                .filter(Boolean)
                .join(", ");
            // Build field arguments - only for arguments that are actually used
            const fieldArgs = usedArgNames
                .map((argName) => {
                return `${argName}: $${argName}`;
            })
                .join(", ");
            // Build selection set based on return type
            let selectionSet = "";
            if ((0, graphql_1.isObjectType)(returnType)) {
                // For objects or lists of objects, analyze fields
                const fields = analyzeFields(returnType, schema);
                selectionSet = buildSelectionSet(fields);
            }
            else if ((0, graphql_1.isListType)(returnType)) {
                // For lists, unwrap and analyze the inner type
                const innerType = getNamedType(returnType.ofType);
                if ((0, graphql_1.isObjectType)(innerType)) {
                    const fields = analyzeFields(innerType, schema);
                    selectionSet = buildSelectionSet(fields);
                }
            }
            // Build the final query
            // Only include variable definitions if fieldArgs is used
            const shouldIncludeVarDefs = fieldArgs && fieldArgs.length > 0;
            const query = `
        query ${name}Query${shouldIncludeVarDefs ? `(${varDefs})` : ""} {
          ${name}${fieldArgs && fieldArgs.length > 0 ? `(${fieldArgs})` : ""} ${selectionSet ? `{\n${selectionSet}  }` : ""}
        }
      `;
            log("debug", `Generated query for ${name}:`, {
                query,
                variables: processedArgs,
            });
            // Execute the query
            return await executeQuery({ query, variables: processedArgs });
        }
        catch (error) {
            throw new Error(`Error executing query for ${name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    catch (error) {
        log("error", `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
// Handle mutation execution
async function executeGraphQLMutation(name, args) {
    try {
        // If this name is in our mapping, use the original field name
        const fullName = toolNameMappings[name] || name;
        // Extract the actual mutation name (remove 'mutation_' prefix)
        const mutationName = fullName.replace(/^mutation_/, "");
        // Check if the mutation is in the whitelist (if whitelist is enabled)
        if (WHITELISTED_MUTATIONS &&
            !WHITELISTED_MUTATIONS.includes(mutationName)) {
            throw new Error(`Mutation '${mutationName}' is not in the whitelist`);
        }
        // Get the schema
        const schema = await fetchSchema();
        if (!schema) {
            throw new Error("Schema not available");
        }
        // Get the mutation type
        const mutationType = schema.getMutationType();
        if (!mutationType) {
            throw new Error("Schema has no mutation type");
        }
        // Get the field for this mutation
        const fields = mutationType.getFields();
        const field = fields[mutationName];
        if (!field) {
            throw new Error(`Unknown mutation: ${mutationName}`);
        }
        try {
            // Process input arguments
            const processedArgs = processArguments(args, field.args, schema);
            // Get return type and analyze it
            const returnType = getNamedType(field.type);
            // First determine which arguments are actually being used
            const usedArgNames = [];
            field.args.forEach((arg) => {
                if (processedArgs && processedArgs[arg.name] !== undefined) {
                    usedArgNames.push(arg.name);
                }
            });
            // Build variables definition - only for arguments that are actually used
            const varDefs = field.args
                .filter((arg) => usedArgNames.includes(arg.name))
                .map((arg) => {
                // Need to preserve non-null and list wrappers in variable definitions
                const typeStr = arg.type.toString();
                return `$${arg.name}: ${typeStr}`;
            })
                .filter(Boolean)
                .join(", ");
            // Build field arguments - only for arguments that are actually used
            const fieldArgs = usedArgNames
                .map((argName) => {
                return `${argName}: $${argName}`;
            })
                .join(", ");
            // Build selection set based on return type
            let selectionSet = "";
            if ((0, graphql_1.isObjectType)(returnType)) {
                // For objects or lists of objects, analyze fields
                const fields = analyzeFields(returnType, schema);
                selectionSet = buildSelectionSet(fields);
            }
            else if ((0, graphql_1.isListType)(returnType)) {
                // For lists, unwrap and analyze the inner type
                const innerType = getNamedType(returnType.ofType);
                if ((0, graphql_1.isObjectType)(innerType)) {
                    const fields = analyzeFields(innerType, schema);
                    selectionSet = buildSelectionSet(fields);
                }
            }
            // Build the final mutation query
            const shouldIncludeVarDefs = fieldArgs && fieldArgs.length > 0;
            const mutation = `
        mutation ${mutationName}Mutation${shouldIncludeVarDefs ? `(${varDefs})` : ""} {
          ${mutationName}${fieldArgs && fieldArgs.length > 0 ? `(${fieldArgs})` : ""} ${selectionSet ? `{\n${selectionSet}  }` : ""}
        }
      `;
            log("debug", `Generated mutation for ${mutationName}:`, {
                mutation,
                variables: processedArgs,
            });
            // Execute the mutation
            return await executeQuery({ query: mutation, variables: processedArgs });
        }
        catch (error) {
            throw new Error(`Error executing mutation for ${mutationName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    catch (error) {
        log("error", `Error executing mutation ${name}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
// Provide resources list (empty but handled to be more compatible)
function getResourcesList() {
    return { resources: [] };
}
// Provide prompts list (empty but handled to be more compatible)
function getPromptsList() {
    return { prompts: [] };
}
async function main() {
    try {
        log("info", "GraphQL MCP Server starting...");
        log("info", `GraphQL API Endpoint: ${GRAPHQL_API_ENDPOINT}`);
        log("info", `API Key: ${GRAPHQL_API_KEY ? "Configured" : "Not configured"}`);
        log("info", `Query Whitelist: ${WHITELISTED_QUERIES
            ? `Enabled (${WHITELISTED_QUERIES.length} queries)`
            : "Disabled (all queries allowed)"}`);
        log("info", `Mutation Whitelist: ${WHITELISTED_MUTATIONS
            ? `Enabled (${WHITELISTED_MUTATIONS.length} mutations)`
            : "Disabled (all mutations allowed)"}`);
        // Set up readline interface for stdin/stdout
        const rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        // Handle incoming JSON-RPC messages
        rl.on("line", async (line) => {
            try {
                if (DEBUG) {
                    log("debug", `Received message: ${line.substring(0, 100)}...`);
                }
                const request = JSON.parse(line);
                const { method, id } = request;
                // Handle initialize
                if (method === "initialize") {
                    log("info", "Handling initialize request");
                    const response = {
                        jsonrpc: "2.0",
                        id,
                        result: {
                            protocolVersion: "2024-11-05",
                            capabilities: {
                                tools: {},
                                resources: {},
                                prompts: {},
                            },
                            serverInfo: {
                                name: "graphql-mcp-server",
                                version: "1.0.0",
                            },
                        },
                    };
                    console.log(JSON.stringify(response));
                    return;
                }
                // Handle initialized notification
                if (method === "notifications/initialized") {
                    // No response needed for notifications
                    return;
                }
                // Handle tools/list
                if (method === "tools/list") {
                    // Get schema (will use cache if available)
                    const schema = await fetchSchema();
                    const queryTools = getToolsFromSchema(schema);
                    const mutationTools = getToolsFromMutationType(schema);
                    const allTools = [...queryTools, ...mutationTools];
                    log("info", `Returning ${allTools.length} tools (${queryTools.length} queries, ${mutationTools.length} mutations)`);
                    const response = {
                        jsonrpc: "2.0",
                        id,
                        result: {
                            tools: allTools,
                        },
                    };
                    console.log(JSON.stringify(response));
                    return;
                }
                // Handle tools/call
                if (method === "tools/call" || method === "tool.call") {
                    const { name, arguments: args } = request.params;
                    log("info", `Tool call: ${name}`, { args });
                    // Determine if this is a mutation or a query
                    const isMutation = name.startsWith("mutation_");
                    // Get result from GraphQL tool execution
                    try {
                        let result;
                        if (isMutation) {
                            result = await executeGraphQLMutation(name, args);
                        }
                        else {
                            result = await executeGraphQLTool(name, args);
                        }
                        // Log the result structure
                        log("debug", `Result structure for ${name}:`, {
                            resultStructure: JSON.stringify(result),
                        });
                        // Handle undefined and null values to prevent Zod validation errors
                        const sanitizeValue = (obj) => {
                            if (obj === undefined || obj === null) {
                                return null;
                            }
                            if (typeof obj === 'object' && obj !== null) {
                                if (Array.isArray(obj)) {
                                    return obj.map(item => sanitizeValue(item));
                                }
                                else {
                                    const newObj = {};
                                    for (const [key, value] of Object.entries(obj)) {
                                        newObj[key] = sanitizeValue(value);
                                    }
                                    return newObj;
                                }
                            }
                            return obj;
                        };
                        // Sanitize the result to avoid Zod validation errors
                        const sanitizedResult = JSON.stringify(sanitizeValue(result), null, 2);
                        const response = {
                            jsonrpc: "2.0",
                            id,
                            result: {
                                content: [
                                    { type: "text", text: sanitizedResult || "{}" },
                                ],
                            },
                        };
                        console.log(JSON.stringify(response));
                    }
                    catch (error) {
                        log("error", `Error in tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
                        // Format error response
                        const response = {
                            jsonrpc: "2.0",
                            id,
                            error: {
                                code: -32000,
                                message: error instanceof Error ? error.message : String(error),
                            },
                        };
                        console.log(JSON.stringify(response));
                    }
                    return;
                }
                // Handle resources/list
                if (method === "resources/list") {
                    const response = {
                        jsonrpc: "2.0",
                        id,
                        result: getResourcesList(),
                    };
                    console.log(JSON.stringify(response));
                    return;
                }
                // Handle prompts/list
                if (method === "prompts/list") {
                    const response = {
                        jsonrpc: "2.0",
                        id,
                        result: getPromptsList(),
                    };
                    console.log(JSON.stringify(response));
                    return;
                }
                // Method not found
                log("warning", `Method not found: ${method}`);
                const response = {
                    jsonrpc: "2.0",
                    id,
                    error: {
                        code: -32601,
                        message: `Method '${method}' not found`,
                    },
                };
                console.log(JSON.stringify(response));
            }
            catch (error) {
                log("error", `Error processing message: ${error instanceof Error ? error.message : String(error)}`, {
                    stack: error instanceof Error ? error.stack : undefined,
                });
                // Try to get the ID from the original message
                let id = null;
                try {
                    id = JSON.parse(line).id;
                }
                catch {
                    // Ignore parse errors
                }
                // Return error response
                const response = {
                    jsonrpc: "2.0",
                    id,
                    error: {
                        code: -32000,
                        message: `Error processing request: ${error instanceof Error ? error.message : String(error)}`,
                    },
                };
                console.log(JSON.stringify(response));
            }
        });
        // Handle process termination
        process.on("uncaughtException", (error) => {
            log("error", `Uncaught exception: ${error.message}`, {
                stack: error.stack,
            });
        });
        process.on("unhandledRejection", (reason) => {
            log("error", `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
        });
        // Initialize schema in the background
        fetchSchema().catch((error) => {
            log("error", `Initial schema fetch failed: ${error instanceof Error ? error.message : String(error)}`);
        });
        log("info", "GraphQL MCP Server started and ready");
    }
    catch (error) {
        log("error", "Fatal error during initialization:", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    }
}
// Start the server
main().catch((error) => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
//# sourceMappingURL=graphql-mcp-server.js.map