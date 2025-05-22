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
          // Check if title has changed
          if (previousValues.title && previousValues.title !== updatedDiscussion.title) {
            await this.trackTitleVersionHistory(
              discussionId, 
              previousValues.title,
              updatedDiscussion.Author?.username
            );
          }

          // Check if body has changed
          if (previousValues.body && previousValues.body !== updatedDiscussion.body) {
            await this.trackBodyVersionHistory(
              discussionId, 
              previousValues.body,
              updatedDiscussion.Author?.username
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
   * Track title version history for a discussion
   */
  private async trackTitleVersionHistory(discussionId: string, previousTitle: string, username: string) {
    // Get the OGM models
    const DiscussionModel = this.ogm.model('Discussion');
    const TextVersionModel = this.ogm.model('TextVersion');
    const UserModel = this.ogm.model('User');

    console.log(`Tracking title version history for discussion ${discussionId}`);
    console.log(`Previous title: "${previousTitle}"`);

    try {
      // Fetch the current discussion to get current title version order
      const discussions = await DiscussionModel.find({
        where: { id: discussionId },
        selectionSet: `{
          id
          title
          PastTitleVersions {
            id
            body
            createdAt
          }
        }`
      });

      if (!discussions.length) {
        console.log('Discussion not found');
        return;
      }

      const discussion = discussions[0];

      // Get user by username
      const users = await UserModel.find({
        where: { username },
        selectionSet: `{ username }`
      });

      if (!users.length) {
        console.log('User not found');
        return;
      }

      // Create new TextVersion for previous title
      // The createdAt timestamp will be automatically set by @timestamp directive
      const textVersionResult = await TextVersionModel.create({
        input: [{
          body: previousTitle,
          Author: {
            connect: { where: { username } }
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
  private async trackBodyVersionHistory(discussionId: string, previousBody: string, username: string) {
    // Get the OGM models
    const DiscussionModel = this.ogm.model('Discussion');
    const TextVersionModel = this.ogm.model('TextVersion');
    const UserModel = this.ogm.model('User');

    console.log(`Tracking body version history for discussion ${discussionId}`);

    try {
      // Fetch the current discussion to get current body version order
      const discussions = await DiscussionModel.find({
        where: { id: discussionId },
        selectionSet: `{
          id
          body
          PastBodyVersions {
            id
            body
            createdAt
          }
        }`
      });

      if (!discussions.length) {
        console.log('Discussion not found');
        return;
      }

      const discussion = discussions[0];

      // Get user by username
      const users = await UserModel.find({
        where: { username },
        selectionSet: `{ username }`
      });

      if (!users.length) {
        console.log('User not found');
        return;
      }

      // Create new TextVersion for previous body
      // The createdAt timestamp will be automatically set by @timestamp directive
      const textVersionResult = await TextVersionModel.create({
        input: [{
          body: previousBody,
          Author: {
            connect: { where: { username } }
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