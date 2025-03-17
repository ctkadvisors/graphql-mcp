"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * Enhanced test script to validate the GraphQL MCP server functionality
 * against multiple GraphQL APIs
 *
 * This script:
 * 1. Tests against multiple GraphQL APIs:
 *    - Countries API
 *    - SpaceX API
 *    - Rick and Morty API
 *    - PokéAPI
 * 2. Spawns the MCP server as a child process for each API
 * 3. Sends appropriate JSON-RPC requests to test each API
 * 4. Validates the responses
 */
// Configuration
const SERVER_PATH = path_1.default.join(__dirname, '../dist/graphql-mcp-server.js');
const DEBUG = true;
// Test APIs
const TEST_APIS = [
    {
        name: 'Countries API',
        endpoint: 'https://countries.trevorblades.com/graphql',
        tests: [
            // Initialize the server
            {
                id: 1,
                method: 'initialize',
                params: {}
            },
            // List available tools
            {
                id: 2,
                method: 'tools/list',
                params: {}
            },
            // Call the continents tool
            {
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'continents',
                    arguments: {}
                }
            },
            // Call the country tool with arguments
            {
                id: 4,
                method: 'tools/call',
                params: {
                    name: 'country',
                    arguments: {
                        code: 'US'
                    }
                }
            }
        ]
    },
    {
        name: 'SpaceX API',
        endpoint: 'https://api.spacex.land/graphql/',
        tests: [
            // Initialize the server
            {
                id: 1,
                method: 'initialize',
                params: {}
            },
            // List available tools
            {
                id: 2,
                method: 'tools/list',
                params: {}
            },
            // Call capsules query
            {
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'capsules',
                    arguments: {
                        limit: 3
                    }
                }
            },
            // Call company info
            {
                id: 4,
                method: 'tools/call',
                params: {
                    name: 'company',
                    arguments: {}
                }
            },
            // Call rockets query
            {
                id: 5,
                method: 'tools/call',
                params: {
                    name: 'rockets',
                    arguments: {
                        limit: 2
                    }
                }
            }
        ]
    },
    {
        name: 'Rick and Morty API',
        endpoint: 'https://rickandmortyapi.com/graphql',
        tests: [
            // Initialize the server
            {
                id: 1,
                method: 'initialize',
                params: {}
            },
            // List available tools
            {
                id: 2,
                method: 'tools/list',
                params: {}
            },
            // Get character data
            {
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'character',
                    arguments: {
                        id: "1"
                    }
                }
            },
            // Get location data
            {
                id: 4,
                method: 'tools/call',
                params: {
                    name: 'location',
                    arguments: {
                        id: "1"
                    }
                }
            },
            // Get episode data
            {
                id: 5,
                method: 'tools/call',
                params: {
                    name: 'episode',
                    arguments: {
                        id: "1"
                    }
                }
            }
        ]
    },
    {
        name: 'PokéAPI',
        endpoint: 'https://beta.pokeapi.co/graphql/v1beta',
        tests: [
            // Initialize the server
            {
                id: 1,
                method: 'initialize',
                params: {}
            },
            // List available tools
            {
                id: 2,
                method: 'tools/list',
                params: {}
            },
            // Get pokemon data
            {
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'pokemon_v2_pokemon',
                    arguments: {
                        where: {
                            name: {
                                _eq: "pikachu"
                            }
                        },
                        limit: 1
                    }
                }
            },
            // Get pokemon species
            {
                id: 4,
                method: 'tools/call',
                params: {
                    name: 'pokemon_v2_pokemonspecies',
                    arguments: {
                        where: {
                            name: {
                                _eq: "charizard"
                            }
                        },
                        limit: 1
                    }
                }
            }
        ]
    }
];
// Ensure the server file exists
if (!fs_1.default.existsSync(SERVER_PATH)) {
    console.error(`Server file not found at ${SERVER_PATH}. Make sure to run 'npm run build' first.`);
    process.exit(1);
}
// Start the MCP server as a child process
function startServer(apiEndpoint) {
    console.log(`Starting GraphQL MCP server for API: ${apiEndpoint}...`);
    const serverProcess = (0, child_process_1.spawn)('node', [SERVER_PATH], {
        env: {
            ...process.env,
            GRAPHQL_API_ENDPOINT: apiEndpoint,
            DEBUG: String(DEBUG)
        },
        stdio: ['pipe', 'pipe', 'pipe'] // Ensure stdin, stdout, stderr are available
    });
    if (!serverProcess.stderr) {
        throw new Error('Server process stderr is not available');
    }
    serverProcess.stderr.on('data', (data) => {
        try {
            // Try to parse as JSON (debug logs)
            const logMessage = JSON.parse(data.toString());
            console.log(`[SERVER LOG] ${logMessage.level}: ${logMessage.message}`);
        }
        catch (e) {
            // Regular stderr output
            console.log(`[SERVER ERROR] ${data.toString().trim()}`);
        }
    });
    return serverProcess;
}
// Send a message to the server and wait for response
function sendMessage(server, message) {
    return new Promise((resolve, reject) => {
        const messageStr = JSON.stringify(message);
        console.log(`\n[TEST] Sending message: ${messageStr}`);
        if (!server.stdin) {
            return reject(new Error('Server stdin is not available'));
        }
        if (!server.stdout) {
            return reject(new Error('Server stdout is not available'));
        }
        // Send the message to the server
        server.stdin.write(messageStr + '\n');
        // Set up a handler for the response
        const responseHandler = (data) => {
            const responseStr = data.toString().trim();
            console.log(`[TEST] Received response: ${responseStr.substring(0, 150)}...`);
            try {
                const response = JSON.parse(responseStr);
                // Check if this response is for our message
                if (response.id === message.id) {
                    if (server.stdout) {
                        server.stdout.removeListener('data', responseHandler);
                    }
                    resolve(response);
                }
            }
            catch (e) {
                console.error(`[TEST] Error parsing response: ${e instanceof Error ? e.message : String(e)}`);
            }
        };
        // Listen for responses
        server.stdout.on('data', responseHandler);
        // Set a timeout
        setTimeout(() => {
            if (server.stdout) {
                server.stdout.removeListener('data', responseHandler);
            }
            reject(new Error(`Timeout waiting for response to message ID ${message.id}`));
        }, 15000); // Longer timeout for schema introspection
    });
}
// Run tests for a specific API
async function runApiTests(api) {
    console.log(`\n========== Testing ${api.name} ==========\n`);
    const server = startServer(api.endpoint);
    try {
        // Wait for the server to start and fetch schema
        console.log('[TEST] Waiting for server to start and fetch schema...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Run each test message in sequence
        for (const message of api.tests) {
            try {
                const response = await sendMessage(server, message);
                // Validate the response
                if (response.error) {
                    console.error(`[TEST] Error in response: ${JSON.stringify(response.error)}`);
                }
                else {
                    console.log(`[TEST] Test passed for message ID ${message.id}`);
                    // For tools/list, count the tools
                    if (message.method === 'tools/list') {
                        const toolCount = response.result?.tools?.length || 0;
                        console.log(`[TEST] Found ${toolCount} tools in the API`);
                    }
                    // For tools/call, check if we got content
                    if (message.method === 'tools/call') {
                        const hasContent = response.result?.content?.length > 0;
                        console.log(`[TEST] Content received: ${hasContent}`);
                        // Log the name/operation of the query
                        if (message.params?.name) {
                            console.log(`[TEST] Successfully executed query: ${message.params.name}`);
                        }
                    }
                }
            }
            catch (error) {
                console.error(`[TEST] Error testing message ID ${message.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        console.log(`\n[TEST] All tests completed for ${api.name}!`);
    }
    finally {
        // Clean up
        console.log(`[TEST] Shutting down server for ${api.name}...`);
        server.kill();
        // Give it a moment to fully close
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}
// Run all API tests in sequence
async function runAllTests() {
    for (const api of TEST_APIS) {
        try {
            await runApiTests(api);
        }
        catch (error) {
            console.error(`Error testing ${api.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    console.log('\n===== All API tests completed! =====');
}
// Run the tests
runAllTests().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-multi-api.js.map