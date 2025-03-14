import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Simple test script to validate the GraphQL MCP server functionality
 * 
 * This script:
 * 1. Spawns the MCP server as a child process
 * 2. Sends JSON-RPC requests to the server
 * 3. Validates the responses
 */

// Configuration
const SERVER_PATH = path.join(__dirname, '../dist/graphql-mcp-server.js');
const TEST_ENDPOINT = 'https://countries.trevorblades.com/graphql';
const DEBUG = true;

// Ensure the server file exists
if (!fs.existsSync(SERVER_PATH)) {
  console.error(`Server file not found at ${SERVER_PATH}. Make sure to run 'npm run build' first.`);
  process.exit(1);
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
  // Call the continents tool
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'continents',
      arguments: {}
    }
  },
  // Call the country tool with arguments
  {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'country',
      arguments: {
        code: 'US'
      }
    }
  }
];

// Start the MCP server as a child process
function startServer(): ChildProcess {
  console.log('Starting GraphQL MCP server...');
  
  const serverProcess = spawn('node', [SERVER_PATH], {
    env: {
      ...process.env,
      GRAPHQL_API_ENDPOINT: TEST_ENDPOINT,
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

// Run all tests
async function runTests() {
  const server = startServer();
  
  try {
    // Wait for the server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run each test message in sequence
    for (const message of testMessages) {
      try {
        const response = await sendMessage(server, message);
        
        // Validate the response
        if (response.error) {
          console.error(`[TEST] Error in response: ${response.error.message}`);
        } else {
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
          }
        }
      } catch (error) {
        console.error(`[TEST] Error testing message ID ${message.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log('\n[TEST] All tests completed!');
  } finally {
    // Clean up
    console.log('[TEST] Shutting down server...');
    server.kill();
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
