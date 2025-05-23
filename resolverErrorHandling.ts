/**
 * Enhanced error handling utilities for custom resolvers
 */

import { GraphQLError } from 'graphql';
import { logCriticalError } from './errorHandling.js';

/**
 * Wrapper for resolver functions that provides consistent error handling
 */
export function withResolverErrorHandling<T extends any[], R>(
  resolverName: string,
  resolverFunction: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      const startTime = Date.now();
      console.log(`🔄 Executing resolver: ${resolverName}`);
      
      const result = await resolverFunction(...args);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Resolver ${resolverName} completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - Date.now();
      console.error(`❌ Resolver ${resolverName} failed:`, {
        resolverName,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration,
        timestamp: new Date().toISOString()
      });

      // Enhance error with resolver context
      if (error instanceof GraphQLError) {
        throw error; // Re-throw GraphQL errors as-is
      } else if (error instanceof Error) {
        // Convert regular errors to GraphQL errors with context
        throw new GraphQLError(
          `Resolver Error in ${resolverName}: ${error.message}`,
          {
            extensions: {
              code: 'RESOLVER_ERROR',
              resolverName,
              originalError: error.message,
              timestamp: new Date().toISOString()
            }
          }
        );
      } else {
        // Handle unexpected error types
        logCriticalError(new Error(`Unknown error type in ${resolverName}`), {
          resolverName,
          errorType: typeof error,
          error
        });
        
        throw new GraphQLError(
          `Unexpected error in ${resolverName}`,
          {
            extensions: {
              code: 'UNKNOWN_RESOLVER_ERROR',
              resolverName,
              timestamp: new Date().toISOString()
            }
          }
        );
      }
    }
  };
}

/**
 * Enhanced error classes for specific resolver scenarios
 */
export class ValidationError extends GraphQLError {
  constructor(message: string, field?: string) {
    super(message, {
      extensions: {
        code: 'BAD_USER_INPUT',
        field,
        timestamp: new Date().toISOString()
      }
    });
  }
}

export class AuthenticationError extends GraphQLError {
  constructor(message: string = 'Authentication required') {
    super(message, {
      extensions: {
        code: 'UNAUTHENTICATED',
        timestamp: new Date().toISOString()
      }
    });
  }
}

export class AuthorizationError extends GraphQLError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString()
      }
    });
  }
}

export class DatabaseError extends GraphQLError {
  constructor(message: string, operation?: string) {
    super(message, {
      extensions: {
        code: 'DATABASE_ERROR',
        operation,
        timestamp: new Date().toISOString()
      }
    });
    
    // Log database errors as critical
    logCriticalError(new Error(message), {
      type: 'DatabaseError',
      operation,
      originalMessage: message
    });
  }
}

export class ExternalServiceError extends GraphQLError {
  constructor(service: string, message: string) {
    super(`External service error (${service}): ${message}`, {
      extensions: {
        code: 'EXTERNAL_SERVICE_ERROR',
        service,
        timestamp: new Date().toISOString()
      }
    });
    
    // Log external service errors as critical
    logCriticalError(new Error(message), {
      type: 'ExternalServiceError',
      service,
      originalMessage: message
    });
  }
}

/**
 * Utility to validate required parameters
 */
export function validateRequired(params: Record<string, any>, required: string[]): void {
  const missing = required.filter(param => params[param] === undefined || params[param] === null);
  
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required parameters: ${missing.join(', ')}`,
      missing[0]
    );
  }
}

/**
 * Utility to handle database operations with error handling
 */
export async function withDatabaseOperation<T>(
  operation: string,
  dbOperation: () => Promise<T>
): Promise<T> {
  try {
    return await dbOperation();
  } catch (error) {
    if (error instanceof Error) {
      // Check for common database errors
      if (error.message.includes('Connection')) {
        throw new DatabaseError('Database connection error', operation);
      } else if (error.message.includes('Timeout')) {
        throw new DatabaseError('Database operation timed out', operation);
      } else if (error.message.includes('Constraint')) {
        throw new ValidationError('Data constraint violation');
      } else {
        throw new DatabaseError(error.message, operation);
      }
    }
    throw error;
  }
}

/**
 * Utility to handle external service calls with error handling
 */
export async function withExternalService<T>(
  serviceName: string,
  serviceCall: () => Promise<T>
): Promise<T> {
  try {
    return await serviceCall();
  } catch (error) {
    if (error instanceof Error) {
      throw new ExternalServiceError(serviceName, error.message);
    }
    throw new ExternalServiceError(serviceName, 'Unknown service error');
  }
}