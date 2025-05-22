/**
 * Middleware for tracking discussion version history
 * This middleware runs before discussion update operations to capture the previous
 * values of title and body before they are updated.
 */

// Import the handler function that contains the version history logic
import { discussionVersionHistoryHandler } from "../hooks/discussionVersionHistoryHook.js";
import { GraphQLResolveInfo } from 'graphql';

// Define types for the middleware
interface UpdateDiscussionsArgs {
  where: {
    id?: string;
  };
  update: {
    title?: string;
    body?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface Context {
  ogm: any;
  driver: any;
  [key: string]: any;
}

// Define the middleware
const discussionVersionHistoryMiddleware = {
  Mutation: {
    // Apply to the auto-generated updateDiscussions mutation
    updateDiscussions: async (
      resolve: (parent: unknown, args: UpdateDiscussionsArgs, context: Context, info: GraphQLResolveInfo) => Promise<any>,
      parent: unknown,
      args: UpdateDiscussionsArgs,
      context: Context,
      info: GraphQLResolveInfo
    ) => {
      // Extract the parameters that we need for version history tracking
      const { where, update } = args;
      
      // Check if title or body is being updated
      if (update.title || update.body) {
        // Run the version history handler before the update
        await discussionVersionHistoryHandler({ 
          context, 
          params: { where, update } 
        });
      }
      
      // Continue with the standard resolver
      return resolve(parent, args, context, info);
    }
  }
};

export default discussionVersionHistoryMiddleware;