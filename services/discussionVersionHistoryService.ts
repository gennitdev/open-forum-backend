import { execute, parse, subscribe } from 'graphql';

type AsyncIterableIterator<T> = AsyncIterable<T> & AsyncIterator<T>;

/**
 * Discussion Version History Service that listens to Discussion update events
 * and tracks version history of title and body changes
 */
export class DiscussionVersionHistoryService {
  private schema: any;
  private ogm: any;
  private isRunning: boolean = false;
  private subscriptionIterator: AsyncIterableIterator<any> | null = null;

  constructor(schema: any, ogm: any) {
    this.schema = schema;
    this.ogm = ogm;
    console.log('Discussion version history service initialized');
  }

  /**
   * Start listening for discussion update events
   */
  async start() {
    if (this.isRunning) {
      console.log('Discussion version history service is already running');
      return;
    }

    try {
      console.log('Starting discussion version history service...');
      this.isRunning = true;

      // Define the subscription query to listen for discussion update events
      const discussionSubscription = `
        subscription {
          discussionUpdated {
            updatedDiscussion {
              id
              title
              body
              updatedAt
              Author {
                username
              }
            }
            previousValues {
              title
              body
            }
          }
        }
      `;

      // Subscribe to discussion update events
      const result = await subscribe({
        schema: this.schema,
        document: parse(discussionSubscription),
        contextValue: { ogm: this.ogm }
      });

      // Check if result is an AsyncIterator (subscription succeeded)
      if (Symbol.asyncIterator in result) {
        this.subscriptionIterator = result as AsyncIterableIterator<any>;

        // Start processing discussion update events
        this.processDiscussionUpdateEvents();
        console.log('Discussion version history service started');
      } else {
        // If not an AsyncIterator, it's an error result
        console.error('Subscription failed:', result);
        this.isRunning = false;
      }
    } catch (error) {
      console.error('Error starting discussion version history service:', error);
      this.isRunning = false;
    }
  }

  /**
   * Process discussion update events and track version history
   */
  private async processDiscussionUpdateEvents() {
    if (!this.subscriptionIterator) return;

    try {
      // Process each discussion update event as it arrives
      for await (const result of this.subscriptionIterator) {
        if (!result.data?.discussionUpdated) {
          console.log('Received invalid discussion update event:', result);
          continue;
        }

        const updatedDiscussion = result.data.discussionUpdated.updatedDiscussion;
        const previousValues = result.data.discussionUpdated.previousValues;
        const discussionId = updatedDiscussion.id;
        
        console.log('Processing version history for updated discussion:', discussionId);

        try {
          // Get the current user who made the update
          const currentUsername = await this.getCurrentUserUsername(discussionId);
          
          if (!currentUsername) {
            console.log('Could not determine current user, skipping version history');
            continue;
          }

          // Check if title has changed - save the NEW title as a version
          if (previousValues?.title && previousValues.title !== updatedDiscussion.title) {
            await this.trackTitleVersionHistory(
              discussionId, 
              updatedDiscussion.title,
              currentUsername
            );
          }

          // Check if body has changed - save the NEW body as a version
          if (previousValues?.body && previousValues.body !== updatedDiscussion.body) {
            await this.trackBodyVersionHistory(
              discussionId, 
              updatedDiscussion.body,
              currentUsername
            );
          }
        } catch (error) {
          console.error('Error processing discussion version history:', error);
          // Continue processing other events even if one fails
        }
      }
    } catch (error) {
      console.error('Error in discussion update event processing:', error);
      
      // If the subscription fails, wait and restart
      if (this.isRunning) {
        console.log('Restarting discussion version history service in 5 seconds...');
        setTimeout(() => this.start(), 5000);
      }
    }
  }

  /**
   * Get the current user who made the update from the Discussion's Author
   */
  private async getCurrentUserUsername(discussionId: string): Promise<string | null> {
    try {
      const DiscussionModel = this.ogm.model('Discussion');
      const discussions = await DiscussionModel.find({
        where: { id: discussionId },
        selectionSet: `{
          Author {
            username
          }
        }`
      });

      if (!discussions.length || !discussions[0].Author?.username) {
        return null;
      }

      return discussions[0].Author.username;
    } catch (error) {
      console.error('Error getting current user username:', error);
      return null;
    }
  }

  /**
   * Track title version history for a discussion
   */
  private async trackTitleVersionHistory(discussionId: string, newTitle: string, username: string) {
    // Get the OGM models
    const DiscussionModel = this.ogm.model('Discussion');
    const TextVersionModel = this.ogm.model('TextVersion');
    const UserModel = this.ogm.model('User');

    console.log(`Tracking title version history for discussion ${discussionId} by user ${username}`);
    console.log(`New title: "${newTitle}"`);

    try {
      // Skip tracking if content is null or empty
      if (!newTitle) {
        console.log('New title is empty, skipping version history');
        return;
      }

      // Get user by username
      const users = await UserModel.find({
        where: { username },
        selectionSet: `{ username }`
      });

      if (!users.length) {
        console.log('User not found:', username);
        return;
      }

      // Create new TextVersion for the new title
      // The createdAt timestamp will be automatically set by @timestamp directive
      const textVersionResult = await TextVersionModel.create({
        input: [{
          body: newTitle,
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

      console.log(`Successfully added title version history for discussion ${discussionId}`);
    } catch (error) {
      console.error('Error tracking title version history:', error);
      throw error;
    }
  }

  /**
   * Track body version history for a discussion
   */
  private async trackBodyVersionHistory(discussionId: string, newBody: string, username: string) {
    // Get the OGM models
    const DiscussionModel = this.ogm.model('Discussion');
    const TextVersionModel = this.ogm.model('TextVersion');
    const UserModel = this.ogm.model('User');

    console.log(`Tracking body version history for discussion ${discussionId} by user ${username}`);

    try {
      // Skip tracking if content is null or empty
      if (!newBody) {
        console.log('New body is empty, skipping version history');
        return;
      }

      // Get user by username
      const users = await UserModel.find({
        where: { username },
        selectionSet: `{ username }`
      });

      if (!users.length) {
        console.log('User not found:', username);
        return;
      }

      // Create new TextVersion for the new body
      // The createdAt timestamp will be automatically set by @timestamp directive
      const textVersionResult = await TextVersionModel.create({
        input: [{
          body: newBody,
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


      await DiscussionModel.update({
        where: { id: discussionId },
        update: {
          PastBodyVersions: {
            connect: [{ where: { id: textVersionId } }]
          },
        }
      });

      console.log(`Successfully added body version history for discussion ${discussionId}`);
    } catch (error) {
      console.error('Error tracking body version history:', error);
      throw error;
    }
  }

  /**
   * Stop the discussion version history service
   */
  stop() {
    console.log('Stopping discussion version history service');
    this.isRunning = false;

    // Clear the subscription iterator
    this.subscriptionIterator = null;
  }
}