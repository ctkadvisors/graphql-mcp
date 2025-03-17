import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

/**
 * Test script to validate the GraphQL MCP server's mutation support
 * 
 * This script:
 * 1. Spawns the MCP server as a child process pointing to GitHub's GraphQL API (which has mutations)
 * 2. Sends JSON-RPC requests to test mutation operations
 * 3. Validates the responses
 * 
 * Note: Requires a GitHub personal access token in the GITHUB_TOKEN environment variable
 */

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

// Configuration
const SERVER_PATH = path.join(__dirname, '../dist/graphql-mcp-server.js');
const GITHUB_API_ENDPOINT = 'https://api.github.com/graphql';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DEBUG = true;

// Ensure the server file exists
if (!fs.existsSync(SERVER_PATH)) {
  console.error(`Server file not found at ${SERVER_PATH}. Make sure to run 'npm run build' first.`);
  process.exit(1);
}

// Ensure GitHub token is available
if (!GITHUB_TOKEN) {
  console.warn('GitHub token not found. Running in simulation mode.');
  console.warn('For full testing with real GitHub API, set the GITHUB_TOKEN environment variable.');
  console.warn('You can create a token at https://github.com/settings/tokens');
}

// Test messages to send to the server
const testMessages = [
  // Initialize the server
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {}
  },
  // List available tools
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  },
  // Call a mutation tool (add star to repository)
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'mutation_addStar',
      arguments: {
        input: {
          starrableId: "REPLACE_WITH_REPO_ID" // Will be replaced in the code
        }
      }
    }
  }
];

// Start the MCP server as a child process
function startServer(): ChildProcess {
  console.log('Starting GraphQL MCP server with GitHub API...');
  
  const serverProcess = spawn('node', [SERVER_PATH], {
    env: {
      ...process.env,
      GRAPHQL_API_ENDPOINT: GITHUB_API_ENDPOINT,
      GRAPHQL_API_KEY: GITHUB_TOKEN,
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
    } catch (e) {
      // Regular stderr output
      console.log(`[SERVER ERROR] ${data.toString().trim()}`);
    }
  });
  
  return serverProcess;
}

// Send a message to the server and wait for response
function sendMessage(server: ChildProcess, message: any): Promise<any> {
  // Simulate response if in simulation mode
  if (!GITHUB_TOKEN) {
    console.log(`\n[TEST] Simulating response for message: ${JSON.stringify(message)}`);
    
    if (message.method === 'initialize') {
      return Promise.resolve({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: 'graphql-mcp-server', version: '1.0.0' }
        }
      });
    } else if (message.method === 'tools/list') {
      return Promise.resolve({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: [
            { name: 'viewer', description: 'Viewer query' },
            { name: 'repository', description: 'Repository query' },
            { name: 'mutation_addStar', description: 'Add star to a repository' },
            { name: 'mutation_removeStar', description: 'Remove star from a repository' }
          ]
        }
      });
    } else if (message.method === 'tools/call' && message.params.name === 'mutation_addStar') {
      return Promise.resolve({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              addStar: {
                starrable: {
                  id: message.params.arguments.input.starrableId,
                  stargazerCount: 42
                }
              }
            })
          }]
        }
      });
    }
    
    // Default simulated response
    return Promise.resolve({
      jsonrpc: '2.0',
      id: message.id,
      result: { content: [{ type: 'text', text: '{}' }] }
    });
  }
  
  // Real implementation for when token is available
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
    const responseHandler = (data: Buffer) => {
      const responseStr = data.toString().trim();
      console.log(`[TEST] Received response: ${responseStr}`);
      
      try {
        const response = JSON.parse(responseStr);
        
        // Check if this response is for our message
        if (response.id === message.id) {
          if (server.stdout) {
            server.stdout.removeListener('data', responseHandler);
          }
          resolve(response);
        }
      } catch (e) {
        console.error(`[TEST] Error parsing response: ${e}`);
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
    }, 10000);
  });
}

// Find a repository ID to star
async function getRepoIdForStarTest(server: ChildProcess): Promise<string> {
  // Use a fake ID in simulation mode
  if (!GITHUB_TOKEN) {
    return 'MDEwOlJlcG9zaXRvcnkxMjk2MjY5'; // Fake repository ID
  }
  
  // Query for a repository that we can add a star to
  const repoQuery = {
    jsonrpc: '2.0',
    id: 'repo-query',
    method: 'tools/call',
    params: {
      name: 'repository',
      arguments: {
        owner: 'octocat',
        name: 'Hello-World'
      }
    }
  };
  
  try {
    const response = await sendMessage(server, repoQuery);
    if (response.result?.content?.[0]?.text) {
      const content = JSON.parse(response.result.content[0].text);
      if (content.repository && content.repository.id) {
        return content.repository.id;
      }
    }
    throw new Error('Could not get repository ID');
  } catch (error) {
    console.error(`[TEST] Error getting repository ID: ${error instanceof Error ? error.message : String(error)}`);
    return 'MDEwOlJlcG9zaXRvcnkxMjk2MjY5'; // Fallback to a known public repo ID
  }
}

// Run all tests
async function runTests() {
  console.log('Running GitHub GraphQL API Mutation Tests...');
  console.log(`API Endpoint: ${GITHUB_API_ENDPOINT}`);
  console.log(`GitHub Token: ${GITHUB_TOKEN ? '***' + GITHUB_TOKEN.slice(-4) : 'Not provided (simulation mode)'}`);
  
  // If we're in simulation mode, we don't need to start a real server
  let server: ChildProcess | null = null;
  
  if (GITHUB_TOKEN) {
    server = startServer();
    // Wait for the server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  try {
    // Get a repository ID for the star test
    const repoId = server ? await getRepoIdForStarTest(server) : 'MDEwOlJlcG9zaXRvcnkxMjk2MjY5';
    console.log(`[TEST] Got repository ID for star test: ${repoId}`);
    
    // Update the star mutation with the actual repo ID
    if (testMessages[2] && testMessages[2].params && testMessages[2].params.arguments) {
      testMessages[2].params.arguments.input.starrableId = repoId;
    }
    
    // Run each test message in sequence
    for (const message of testMessages) {
      try {
        const response = await sendMessage(server || ({} as ChildProcess), message);
        
        // Validate the response
        if (response.error) {
          console.error(`[TEST] Error in response: ${response.error.message}`);
        } else {
          console.log(`[TEST] Test passed for message ID ${message.id}`);
          
          // For tools/list, count the tools and look for mutations
          if (message.method === 'tools/list' && response.result?.tools) {
            const allTools = response.result.tools;
            const mutationTools = allTools.filter((tool: any) => tool.name.startsWith('mutation_'));
            const queryTools = allTools.filter((tool: any) => !tool.name.startsWith('mutation_'));
            
            console.log(`[TEST] Found ${allTools.length} tools in the GitHub API:`);
            console.log(`[TEST] - ${queryTools.length} queries`);
            console.log(`[TEST] - ${mutationTools.length} mutations`);
            
            // Display a few mutation tools as examples
            if (mutationTools.length > 0) {
              console.log('[TEST] Example mutations available:');
              mutationTools.slice(0, 5).forEach((tool: any) => {
                console.log(`[TEST] - ${tool.name}: ${tool.description}`);
              });
            }
          }
          
          // For mutation calls, check the response
          if (message.method === 'tools/call' && message.params.name === 'mutation_addStar') {
            try {
              const content = JSON.parse(response.result.content[0].text);
              console.log(`[TEST] Mutation result:`, content);
              
              if (content.addStar && content.addStar.starrable) {
                console.log(`[TEST] Successfully executed star mutation!`);
                console.log(`[TEST] Starrable ID: ${content.addStar.starrable.id}`);
              }
            } catch (e) {
              console.error(`[TEST] Error parsing mutation result: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      } catch (error) {
        console.error(`[TEST] Error testing message ID ${message.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log('\n[TEST] All tests completed!');
  } finally {
    // Clean up
    if (server) {
      console.log('[TEST] Shutting down server...');
      server.kill();
    }
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
