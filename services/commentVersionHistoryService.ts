import { execute, parse, subscribe } from 'graphql';

type AsyncIterableIterator<T> = AsyncIterable<T> & AsyncIterator<T>;

/**
 * Comment Version History Service that listens to Comment update events
 * and tracks version history of text changes
 */
export class CommentVersionHistoryService {
  private schema: any;
  private ogm: any;
  private isRunning: boolean = false;
  private subscriptionIterator: AsyncIterableIterator<any> | null = null;

  constructor(schema: any, ogm: any) {
    this.schema = schema;
    this.ogm = ogm;
    console.log('Comment version history service initialized');
  }

  /**
   * Start listening for comment update events
   */
  async start() {
    if (this.isRunning) {
      console.log('Comment version history service is already running');
      return;
    }

    try {
      console.log('Starting comment version history service...');
      this.isRunning = true;

      // Define the subscription query to listen for comment update events
      const commentSubscription = `
        subscription {
          commentUpdated {
            updatedComment {
              id
              text
              updatedAt
              CommentAuthor {
                ... on User {
                  username
                }
                ... on ModerationProfile {
                  displayName
                }
              }
            }
            previousValues {
              text
            }
          }
        }
      `;

      // Subscribe to comment update events
      const result = await subscribe({
        schema: this.schema,
        document: parse(commentSubscription),
        contextValue: { ogm: this.ogm }
      });

      // Check if result is an AsyncIterator (subscription succeeded)
      if (Symbol.asyncIterator in result) {
        this.subscriptionIterator = result as AsyncIterableIterator<any>;

        // Start processing comment update events
        this.processCommentUpdateEvents();
        console.log('Comment version history service started');
      } else {
        // If not an AsyncIterator, it's an error result
        console.error('Subscription failed:', result);
        this.isRunning = false;
      }
    } catch (error) {
      console.error('Error starting comment version history service:', error);
      this.isRunning = false;
    }
  }

  /**
   * Process comment update events and track version history
   */
  private async processCommentUpdateEvents() {
    if (!this.subscriptionIterator) return;

    try {
      // Process each comment update event as it arrives
      for await (const result of this.subscriptionIterator) {
        if (!result.data?.commentUpdated) {
          console.log('Received invalid comment update event:', result);
          continue;
        }

        const updatedComment = result.data.commentUpdated.updatedComment;
        const commentId = updatedComment.id;
        
        console.log('Processing version history for updated comment:', commentId);

        try {
          // Fetch the updated comment's text directly from the database
          const CommentModel = this.ogm.model('Comment');
          const comments = await CommentModel.find({
            where: { id: commentId },
            selectionSet: `{
              id
              text
              CommentAuthor {
                ... on User {
                  username
                }
                ... on ModerationProfile {
                  displayName
                }
              }
            }`
          });

          if (!comments.length) {
            console.log('Comment not found in database');
            continue;
          }

          const comment = comments[0];
          const username = comment.CommentAuthor?.username || comment.CommentAuthor?.displayName;

          if (!username) {
            console.log('Could not determine username from comment author');
            continue;
          }
        } catch (error) {
          console.error('Error processing comment version history:', error);
          // Continue processing other events even if one fails
        }
      }
    } catch (error) {
      console.error('Error in comment update event processing:', error);
      
      // If the subscription fails, wait and restart
      if (this.isRunning) {
        console.log('Restarting comment version history service in 5 seconds...');
        setTimeout(() => this.start(), 5000);
      }
    }
  }

  /**
   * Track text version history for a comment
   */
  private async trackTextVersionHistory(commentId: string, previousText: string, username: string) {
    // Get the OGM models
    const CommentModel = this.ogm.model('Comment');
    const TextVersionModel = this.ogm.model('TextVersion');
    const UserModel = this.ogm.model('User');

    console.log(`Tracking text version history for comment ${commentId}`);

    // Skip if previous text or username is missing
    if (!previousText) {
      console.log('Previous text is empty, skipping version history');
      return;
    }

    if (!username) {
      console.log('Username is missing, cannot track author of the change');
      return;
    }

    try {
      // Fetch the current comment to get current version data
      const comments = await CommentModel.find({
        where: { id: commentId },
        selectionSet: `{
          id
          text
          PastVersions {
            id
            body
            createdAt
          }
        }`
      });

      if (!comments.length) {
        console.log('Comment not found');
        return;
      }

      const comment = comments[0];

      // Get user by username
      const users = await UserModel.find({
        where: { username },
        selectionSet: `{ username }`
      });

      if (!users.length) {
        console.log(`User not found with username: ${username}`);
        return;
      }

      // Create new TextVersion for previous text
      // The createdAt timestamp will be automatically set by @timestamp directive
      const textVersionResult = await TextVersionModel.create({
        input: [{
          body: previousText,
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

      await CommentModel.update({
        where: { id: commentId },
        update: {
          PastVersions: {
            connect: [{ where: { id: textVersionId } }]
          },
        }
      });

      console.log(`Successfully added text version history for comment ${commentId}`);
    } catch (error) {
      console.error('Error tracking text version history:', error);
      throw error;
    }
  }

  /**
   * Stop the comment version history service
   */
  stop() {
    console.log('Stopping comment version history service');
    this.isRunning = false;

    // Clear the subscription iterator
    this.subscriptionIterator = null;
  }
}