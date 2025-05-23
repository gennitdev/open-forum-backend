/**
 * Middleware for automatically creating the first TextVersion when a WikiPage is created
 * This middleware runs during channel updates that create WikiHomePages
 */

import { GraphQLResolveInfo } from 'graphql';

// Define types for the middleware
interface UpdateChannelsArgs {
  where?: any;
  update?: any;
  [key: string]: any;
}

interface Context {
  ogm: any;
  driver: any;
  req?: any;
  [key: string]: any;
}

// Define the middleware
const wikiPageCreationMiddleware = {
  Mutation: {
    // Apply to the auto-generated updateChannels mutation for WikiHomePage creation
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
        await createFirstTextVersionForHomePage(result, args, context);
        
        return result;
      }
      
      // Continue with the standard resolver if not creating a WikiPage
      return resolve(parent, args, context, info);
    },
    
    // Apply to the auto-generated updateWikiPages mutation for child page creation
    updateWikiPages: async (
      resolve: (parent: unknown, args: UpdateChannelsArgs, context: Context, info: GraphQLResolveInfo) => Promise<any>,
      parent: unknown,
      args: UpdateChannelsArgs,
      context: Context,
      info: GraphQLResolveInfo
    ) => {
      // Check if this is creating new child WikiPages
      const isCreatingChildPages = args.update?.ChildPages?.create;
      
      if (isCreatingChildPages) {
        console.log('Creating child WikiPages with automatic first TextVersion...');
        
        // Execute the original resolver first to create the WikiPages
        const result = await resolve(parent, args, context, info);
        
        // After the WikiPages are created, create the first TextVersions
        await createFirstTextVersionForChildPages(result, args, context);
        
        return result;
      }
      
      // Continue with the standard resolver if not creating child WikiPages
      return resolve(parent, args, context, info);
    }
  }
};

/**
 * Create the first TextVersion for a newly created WikiHomePage
 */
async function createFirstTextVersionForHomePage(
  result: any,
  args: UpdateChannelsArgs,
  context: Context
) {
  try {
    const { ogm } = context;
    const TextVersionModel = ogm.model('TextVersion');
    const WikiPageModel = ogm.model('WikiPage');
    
    // Get the created WikiPage from the result
    const channels = result?.updateChannels?.channels;
    if (!channels || !channels.length) {
      console.log('No channels found in result');
      return;
    }
    
    const wikiHomePage = channels[0]?.WikiHomePage;
    if (!wikiHomePage) {
      console.log('No WikiHomePage found in result');
      return;
    }
    
    const wikiPageId = wikiHomePage.id;
    const originalTitle = args.update.WikiHomePage?.create?.node.title;
    const originalBody = args.update.WikiHomePage?.create?.node.body;
    
    // Get the current user from context (this will need to be properly implemented)
    // For now, we'll use a placeholder - in practice, you'd get this from auth headers
    const currentUsername = getCurrentUsername(context);
    
    if (!currentUsername) {
      console.log('Could not determine current user for WikiPage creation');
      return;
    }
    
    // Create TextVersions for both title and body if they exist
    if (originalTitle) {
      await createTextVersion(TextVersionModel, wikiPageId, originalTitle, currentUsername, WikiPageModel);
    }
    
    if (originalBody) {
      await createTextVersion(TextVersionModel, wikiPageId, originalBody, currentUsername, WikiPageModel);
    }
    
    console.log(`Successfully created first TextVersion(s) for WikiPage ${wikiPageId}`);
  } catch (error) {
    console.error('Error creating first TextVersion:', error);
    // Don't throw the error - we don't want to break the WikiPage creation
  }
}

/**
 * Create the first TextVersion for newly created child WikiPages
 */
async function createFirstTextVersionForChildPages(
  result: any,
  args: UpdateChannelsArgs,
  context: Context
) {
  try {
    const { ogm } = context;
    const TextVersionModel = ogm.model('TextVersion');
    const WikiPageModel = ogm.model('WikiPage');
    
    // Get the updated WikiPages from the result
    const wikiPages = result?.updateWikiPages?.wikiPages;
    if (!wikiPages || !wikiPages.length) {
      console.log('No wikiPages found in result');
      return;
    }
    
    // Process each parent WikiPage that might have new child pages
    for (const parentWikiPage of wikiPages) {
      const childPages = parentWikiPage.ChildPages;
      if (!childPages || !childPages.length) {
        continue;
      }
      
      // Get the current user from context
      const currentUsername = getCurrentUsername(context);
      
      if (!currentUsername) {
        console.log('Could not determine current user for child WikiPage creation');
        continue;
      }
      
      // Create TextVersions for each new child page
      for (const childPage of childPages) {
        if (childPage.title) {
          await createTextVersion(TextVersionModel, childPage.id, childPage.title, currentUsername, WikiPageModel);
        }
        
        if (childPage.body) {
          await createTextVersion(TextVersionModel, childPage.id, childPage.body, currentUsername, WikiPageModel);
        }
      }
    }
    
    console.log('Successfully created first TextVersion(s) for child WikiPages');
  } catch (error) {
    console.error('Error creating first TextVersion for child pages:', error);
    // Don't throw the error - we don't want to break the WikiPage creation
  }
}

/**
 * Create a single TextVersion and connect it to the WikiPage
 */
async function createTextVersion(
  TextVersionModel: any,
  wikiPageId: string,
  content: string,
  username: string,
  WikiPageModel: any
) {
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
}

/**
 * Get the current username from the request context
 * This is a placeholder - implement according to your auth system
 */
function getCurrentUsername(context: Context): string | null {
  // TODO: Implement proper user extraction from context
  // This might involve decoding JWT tokens from headers, session management, etc.
  // For now, return a placeholder
  return 'system'; // Replace with actual user extraction logic
}

export default wikiPageCreationMiddleware;