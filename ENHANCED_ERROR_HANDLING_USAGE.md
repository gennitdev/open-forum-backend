# Enhanced Error Handling - Usage Guide

## Overview
The enhanced error handling system provides comprehensive error logging, better error messages, and improved debugging capabilities for your GraphQL backend.

## What's Been Implemented

### 1. Enhanced Error Formatting (`errorHandling.ts`)
- **Comprehensive Error Logging**: Detailed console logs with timestamps, error IDs, and context
- **Environment-Aware Responses**: More details in development, sanitized in production
- **Error Classification**: Validation, Auth, Permission, and Critical errors
- **Debugging Hints**: Contextual suggestions for common error types
- **Sensitive Data Sanitization**: Automatic removal of passwords, tokens, etc.

### 2. Resolver Error Utilities (`resolverErrorHandling.ts`)
- **Error Wrapper Function**: `withResolverErrorHandling()` for consistent error handling
- **Specialized Error Classes**: `ValidationError`, `AuthenticationError`, `DatabaseError`, etc.
- **Validation Utilities**: `validateRequired()` for parameter validation
- **Database Operation Wrapper**: `withDatabaseOperation()` for database error handling

### 3. Enhanced Server Logging
- **Structured Operation Logging**: Every GraphQL operation logged with context
- **Service Startup Monitoring**: Enhanced logging for background services
- **Connection Retry Logic**: Better Neo4j connection error handling
- **Critical Error Tracking**: Automatic logging for system-critical issues

## Benefits

### Before (Original Error Example):
```json
{
  "errors": [
    {
      "message": "Unknown argument \"hasDownload\" on field \"Query.getSiteWideDiscussionList\".",
      "locations": [{"line": 8, "column": 5}],
      "code": "GRAPHQL_VALIDATION_FAILED"
    }
  ]
}
```

### After (Enhanced Error Response):
```json
{
  "errors": [
    {
      "message": "Schema Validation Error: Unknown argument \"hasDownload\" on field \"Query.getSiteWideDiscussionList\". This usually means your query doesn't match the current GraphQL schema.",
      "locations": [{"line": 8, "column": 5}],
      "extensions": {
        "code": "GRAPHQL_VALIDATION_FAILED",
        "errorId": "err_1640995200000_abc123def",
        "timestamp": "2024-01-01T10:00:00.000Z",
        "debugHint": "Check if your query matches the current schema. Try running this query in GraphQL Playground to see detailed validation errors.",
        "operationName": "GetDiscussions",
        "variables": {"searchInput": "test"}
      }
    }
  ]
}
```

### Server-Side Logging:
```
🚨 GraphQL Error Details: {
  errorId: 'err_1640995200000_abc123def',
  timestamp: '2024-01-01T10:00:00.000Z',
  message: 'Unknown argument "hasDownload" on field "Query.getSiteWideDiscussionList".',
  code: 'GRAPHQL_VALIDATION_FAILED',
  path: null,
  locations: [{ line: 8, column: 5 }],
  operationName: 'GetDiscussions',
  variables: { searchInput: 'test', hasDownload: true },
  userAgent: 'Mozilla/5.0...',
  ip: '127.0.0.1'
}
📝 Full Query that caused validation error:
query GetDiscussions($searchInput: String, $hasDownload: Boolean) {
  getSiteWideDiscussionList(
    searchInput: $searchInput
    hasDownload: $hasDownload
  ) {
    discussions {
      id
      title
    }
  }
}
📝 Variables:
{
  "searchInput": "test",
  "hasDownload": true
}
```

## How This Solves Your Problem

1. **Descriptive Server Logs**: You'll now see the exact query and variables that caused errors in your server console
2. **Error Classification**: Clear identification of validation vs. runtime vs. critical errors
3. **Debugging Context**: Full query logging for validation errors (your main pain point)
4. **Error Tracking**: Unique error IDs for tracking specific issues
5. **Environment Awareness**: More details in development, production-safe in production
6. **No More Silent Failures**: All errors are properly logged and categorized

## Usage Examples

### Using Resolver Error Wrapper:
```typescript
// Before
const myResolver = async (parent, args, context) => {
  // resolver logic
};

// After
const myResolver = withResolverErrorHandling('myResolver', async (parent, args, context) => {
  // resolver logic - automatic error handling and logging
});
```

### Using Validation Utilities:
```typescript
import { validateRequired, ValidationError } from './resolverErrorHandling.js';

const myResolver = async (parent, args, context) => {
  // Validate required parameters
  validateRequired(args, ['channelUniqueName', 'discussionId']);
  
  // Custom validation
  if (args.limit > 100) {
    throw new ValidationError('Limit cannot exceed 100', 'limit');
  }
  
  // resolver logic...
};
```

## Next Steps

1. **The error handling is already active** - you should see improved logging immediately
2. **For critical resolvers**, consider wrapping them with `withResolverErrorHandling()`
3. **Monitor your logs** - you should now see much more detailed error information
4. **In development**, set `NODE_ENV=development` for maximum error detail
5. **For production monitoring**, consider integrating with services like Sentry or DataDog

The enhanced error handling will help you quickly identify and debug GraphQL issues without needing to test in the GraphQL Playground!