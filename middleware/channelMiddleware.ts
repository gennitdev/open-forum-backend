/**
 * Middleware for handling channel operations including WikiHomePage creation
 */

import { GraphQLResolveInfo } from 'graphql';

// Define types for the middleware (using simple types to avoid conflicts)
interface UpdateChannelsArgs {
  where?: any;
  update?: any;
  [key: string]: any;
}

interface Context {
  ogm: any;
  driver: any;
  [key: string]: any;
}

// Define the middleware
const channelMiddleware = {
  Mutation: {
    // Apply to the auto-generated updateChannels mutation
    updateChannels: async (
      resolve: (parent: unknown, args: UpdateChannelsArgs, context: Context, info: GraphQLResolveInfo) => Promise<any>,
      parent: unknown,
      args: UpdateChannelsArgs,
      context: Context,
      info: GraphQLResolveInfo
    ) => {
      // Check if this is creating a new WikiHomePage
      const isCreatingWikiHomePage = args.update?.WikiHomePage?.create?.node;
      
      if (isCreatingWikiHomePage) {
        console.log('Creating WikiHomePage with automatic first TextVersion...');
        
        // Execute the original resolver first to create the WikiPage
        const result = await resolve(parent, args, context, info);
        
        // After the WikiPage is created, create the first TextVersion
        await handleWikiHomePageCreation(result, args, context);
        
        return result;
      }
      
      // Continue with the standard resolver if not creating a WikiPage
      return resolve(parent, args, context, info);
    }
  }
};

/**
 * Handle creation of WikiHomePage by creating first TextVersions
 */
async function handleWikiHomePageCreation(result: any, args: UpdateChannelsArgs, context: Context) {
  try {
    const { ogm } = context;
    const TextVersionModel = ogm.model('TextVersion');
    const WikiPageModel = ogm.model('WikiPage');
    
    // Get the created WikiPage from the result
    const channels = result?.updateChannels?.channels;
    if (!channels || !channels.length) {
      console.log('No channels found in result for WikiHomePage creation');
      return;
    }
    
    const wikiHomePage = channels[0]?.WikiHomePage;
    if (!wikiHomePage) {
      console.log('No WikiHomePage found in result');
      return;
    }
    
    const wikiPageId = wikiHomePage.id;
    const originalTitle = args.update?.WikiHomePage?.create?.node?.title;
    const originalBody = args.update?.WikiHomePage?.create?.node?.body;
    
    // Get the current user from context - placeholder for now
    const currentUsername = getCurrentUsernameFromContext(context);
    
    if (!currentUsername) {
      console.log('Could not determine current user for WikiHomePage creation');
      return;
    }
    
    // Create TextVersions for both title and body if they exist
    if (originalTitle) {
      await createFirstTextVersion(TextVersionModel, wikiPageId, originalTitle, currentUsername, WikiPageModel);
    }
    
    if (originalBody) {
      await createFirstTextVersion(TextVersionModel, wikiPageId, originalBody, currentUsername, WikiPageModel);
    }
    
    console.log(`Successfully created first TextVersion(s) for WikiHomePage ${wikiPageId}`);
  } catch (error) {
    console.error('Error creating first TextVersion for WikiHomePage:', error);
    // Don't throw the error - we don't want to break the WikiPage creation
  }
}

/**
 * Create a TextVersion and connect it to a WikiPage
 */
async function createFirstTextVersion(
  TextVersionModel: any,
  wikiPageId: string,
  content: string,
  username: string,
  WikiPageModel: any
) {
  try {
    // Create the TextVersion
    const textVersionResult = await TextVersionModel.create({
      input: [{
        body: content,
        Author: {
          connect: { where: { node: { username } } }
        }
      }]
    });

    if (!textVersionResult.textVersions.length) {
      console.log('Failed to create TextVersion');
      return;
    }

    const textVersionId = textVersionResult.textVersions[0].id;

    // Connect the TextVersion to the WikiPage
    await WikiPageModel.update({
      where: { id: wikiPageId },
      update: {
        PastVersions: {
          connect: [{ 
            where: { 
              node: { id: textVersionId } 
            } 
          }]
        }
      }
    });

    console.log(`Successfully created first TextVersion for WikiPage ${wikiPageId}`);
  } catch (error) {
    console.error(`Error creating first TextVersion for WikiPage ${wikiPageId}:`, error);
  }
}

/**
 * Get the current username from the request context
 * This is a placeholder - implement according to your auth system
 */
function getCurrentUsernameFromContext(context: Context): string | null {
  // TODO: Implement proper user extraction from context
  // This might involve decoding JWT tokens from headers, session management, etc.
  // For now, return a placeholder
  return 'system'; // Replace with actual user extraction logic
}

export default channelMiddleware;