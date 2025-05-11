import { execute, parse, subscribe } from 'graphql';
import { sendEmailToUser, createCommentNotificationEmail } from '../customResolvers/mutations/shared/emailUtils.js';

type AsyncIterableIterator<T> = AsyncIterable<T> & AsyncIterator<T>;

/**
 * Comment notification service that listens to Comment creation events
 * and sends notifications to relevant users
 */
export class CommentNotificationService {
  private schema: any;
  private ogm: any;
  private isRunning: boolean = false;
  private subscriptionIterator: AsyncIterableIterator<any> | null = null;

  constructor(schema: any, ogm: any) {
    this.schema = schema;
    this.ogm = ogm;
    console.log('Comment notification service initialized');
  }

  /**
   * Start listening for comment creation events
   */
  async start() {
    if (this.isRunning) {
      console.log('Comment notification service is already running');
      return;
    }

    try {
      console.log('Starting comment notification service...');
      this.isRunning = true;

      // Define the subscription query to listen for comment creation events
      const commentSubscription = `
        subscription {
          commentCreated {
            createdComment {
              id
              text
              CommentAuthor {
                ... on User {
                  __typename
                  username
                }
                ... on ModerationProfile {
                  __typename
                  displayName
                }
              }
            }
          }
        }
      `;

      // Subscribe to comment creation events
      const result = await subscribe({
        schema: this.schema,
        document: parse(commentSubscription),
        contextValue: { ogm: this.ogm }
      });

      // Check if result is an AsyncIterator (subscription succeeded)
      if (Symbol.asyncIterator in result) {
        this.subscriptionIterator = result as AsyncIterableIterator<any>;

        // Start processing comment events
        this.processCommentEvents();
        console.log('Comment notification service started');
      } else {
        // If not an AsyncIterator, it's an error result
        console.error('Subscription failed:', result);
        this.isRunning = false;
      }
    } catch (error) {
      console.error('Error starting comment notification service:', error);
      this.isRunning = false;
    }
  }

  /**
   * Process comment creation events and send notifications
   */
  private async processCommentEvents() {
    if (!this.subscriptionIterator) return;

    try {
      // Process each comment event as it arrives
      for await (const result of this.subscriptionIterator) {
        if (!result.data?.commentCreated?.createdComment) {
          console.log('Received invalid comment event:', result);
          continue;
        }

        const commentBasicInfo = result.data.commentCreated.createdComment;
        const commentId = commentBasicInfo.id;
        
        console.log('Processing notification for newly created comment:', commentId);

        try {
          // Fetch the full comment details
          await this.processCommentNotification(commentId);
        } catch (error) {
          console.error('Error processing comment notification:', error);
          // Continue processing other events even if one fails
        }
      }
    } catch (error) {
      console.error('Error in comment event processing:', error);
      
      // If the subscription fails, wait and restart
      if (this.isRunning) {
        console.log('Restarting comment notification service in 5 seconds...');
        setTimeout(() => this.start(), 5000);
      }
    }
  }

  /**
   * Process a notification for a newly created comment
   */
  private async processCommentNotification(commentId: string) {
    // Get the OGM models
    const CommentModel = this.ogm.model('Comment');
    const UserModel = this.ogm.model('User');
    const DiscussionModel = this.ogm.model('Discussion');

    // Fetch the full comment details
    const fullComments = await CommentModel.find({
      where: { id: commentId },
      selectionSet: `{
        id
        text
        Channel {
          uniqueName
        }
        CommentAuthor {
          ... on User {
            __typename
            username
          }
          ... on ModerationProfile {
            __typename
            displayName
          }
        }
        DiscussionChannel {
          id
          discussionId
          Channel {
            uniqueName
            displayName
          }
        }
        Event {
          id
          title
          Poster {
            username
          }
          EventChannels {
            channelUniqueName
            Channel {
              uniqueName
            }
          }
        }
        ParentComment {
          id
          CommentAuthor {
            ... on User {
              __typename
              username
            }
            ... on ModerationProfile {
              __typename
              displayName
            }
          }
        }
      }`
    });

    if (!fullComments || !fullComments.length) {
      console.log('Could not find comment details for ID:', commentId);
      return;
    }

    const fullComment = fullComments[0];
    console.log('Found comment details for ID:', commentId);

    // Get the commenter info
    const commenterUsername = 
      fullComment.CommentAuthor?.username ||
      fullComment.CommentAuthor?.displayName ||
      'Someone';

    // DISCUSSION COMMENT NOTIFICATION
    if (fullComment.DiscussionChannel) {
      await this.processDiscussionCommentNotification(
        fullComment,
        commentId,
        commenterUsername,
        DiscussionModel,
        UserModel
      );
    }
    // EVENT COMMENT NOTIFICATION
    else if (fullComment.Event) {
      await this.processEventCommentNotification(
        fullComment,
        commentId,
        commenterUsername,
        UserModel
      );
    }
    // COMMENT REPLY NOTIFICATION
    else if (fullComment.ParentComment) {
      await this.processCommentReplyNotification(
        fullComment,
        commentId,
        commenterUsername,
        CommentModel,
        UserModel
      );
    }
  }

  /**
   * Process notification for a comment on a discussion
   */
  private async processDiscussionCommentNotification(
    fullComment: any,
    commentId: string,
    commenterUsername: string,
    DiscussionModel: any,
    UserModel: any
  ) {
    console.log('Processing comment on discussion');

    // We need to get the discussion details
    const discussionId = fullComment.DiscussionChannel?.discussionId;
    if (!discussionId) {
      console.log('No discussion ID found');
      return;
    }

    // Fetch the discussion and its author
    const discussions = await DiscussionModel.find({
      where: { id: discussionId },
      selectionSet: `{
        id
        title
        Author {
          username
        }
      }`
    });

    if (!discussions.length || !discussions[0].Author) {
      console.log('Discussion or author not found');
      return;
    }

    const discussion = discussions[0];
    const authorUsername = discussion.Author.username;

    // Don't notify authors about their own comments
    if (commenterUsername === authorUsername) {
      console.log('Not notifying author of their own comment');
      return;
    }

    const channelName = fullComment.Channel?.uniqueName;
    console.log(
      `Sending notification to ${authorUsername} about comment on discussion ${discussion.title}`
    );

    // Create markdown notification text for in-app notification
    const notificationMessage = `
${commenterUsername} commented on your discussion [${discussion.title}](${process.env.FRONTEND_URL}/forums/${channelName}/discussions/${discussion.id}/comments/${commentId})
    `;

    // Create email content
    const emailContent = createCommentNotificationEmail(
      fullComment.text,
      discussion.title,
      commenterUsername,
      channelName || '',
      discussion.id,
      commentId
    );

    // Send both email and in-app notification
    await sendEmailToUser(
      authorUsername,
      emailContent,
      UserModel,
      {
        inAppText: notificationMessage,
        createInAppNotification: true
      }
    );
  }

  /**
   * Process notification for a comment on an event
   */
  private async processEventCommentNotification(
    fullComment: any,
    commentId: string,
    commenterUsername: string,
    UserModel: any
  ) {
    console.log('Processing comment on event');

    const event = fullComment.Event;
    if (!event) {
      console.log('Event not found');
      return;
    }

    if (!event.Poster) {
      console.log('Event poster not found');
      return;
    }

    const posterUsername = event.Poster.username;

    // Don't notify posters about their own comments
    if (commenterUsername === posterUsername) {
      console.log('Not notifying poster of their own comment');
      return;
    }

    // Get channel name from event channels (use first one for notification)
    if (!event.EventChannels || !event.EventChannels.length) {
      console.log('No channel found for event');
      return;
    }

    const channelName = fullComment.Channel?.uniqueName;
    console.log(
      `Sending notification to ${posterUsername} about comment on event ${event.title}`
    );

    // Create markdown notification text for in-app notification
    const notificationMessage = `
${commenterUsername} commented on your event [${event.title}](${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}/comments/${commentId})
    `;

    // Create email content for event notification
    const emailContent = {
      subject: `New comment on your event: ${event.title}`,
      plainText: `
${commenterUsername} commented on your event "${event.title}":

"${fullComment.text}"

View the comment at:
${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}/comments/${commentId}
      `,
      html: `
<p><strong>${commenterUsername}</strong> commented on your event "<strong>${event.title}</strong>":</p>
<blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin-left: 0;">
  ${fullComment.text}
</blockquote>
<p>
  <a href="${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}/comments/${commentId}">View the comment</a>
</p>
      `
    };

    // Send both email and in-app notification
    await sendEmailToUser(
      posterUsername,
      emailContent,
      UserModel,
      {
        inAppText: notificationMessage,
        createInAppNotification: true
      }
    );
  }

  /**
   * Process notification for a reply to a comment
   */
  private async processCommentReplyNotification(
    fullComment: any,
    commentId: string,
    commenterUsername: string,
    CommentModel: any,
    UserModel: any
  ) {
    console.log('Processing reply to comment');

    const parentComment = fullComment.ParentComment;
    if (!parentComment) {
      console.log('Parent comment not found');
      return;
    }

    if (!parentComment.CommentAuthor) {
      console.log('Parent comment author not found');
      return;
    }

    // Fetch more details about the parent comment
    const parentCommentId = parentComment.id;
    const parentCommentDetails = await CommentModel.find({
      where: { id: parentCommentId },
      selectionSet: `{
        id
        Channel {
          uniqueName
        }
        CommentAuthor {
          ... on User {
            __typename
            username
          }
          ... on ModerationProfile {
            __typename
            displayName
          }
        }
        DiscussionChannel {
          discussionId
          Channel {
            uniqueName
          }
          Discussion {
            id
            title
          }
        }
        Event {
          id
          title
          EventChannels {
            Channel {
              uniqueName
            }
          }
        }
      }`
    });

    if (!parentCommentDetails.length) {
      console.log('Could not fetch parent comment details');
      return;
    }

    const parentCommentWithDetails = parentCommentDetails[0];

    // Determine parent comment author's username and if it's a user
    const isParentUserComment = parentCommentWithDetails.CommentAuthor?.__typename === 'User';
    const parentAuthorUsername = isParentUserComment
      ? (parentCommentWithDetails.CommentAuthor as { username: string }).username
      : (parentCommentWithDetails.CommentAuthor as { displayName: string }).displayName;

    // Don't notify authors about their own replies
    if (commenterUsername === parentAuthorUsername) {
      console.log('Not notifying author of reply to their own comment');
      return;
    }

    console.log(`Sending notification to ${parentAuthorUsername} about reply to their comment`);

    // Variable to store notification info
    let contentTitle, contentUrl, channelName;

    // Determine if parent comment is on a discussion or event
    if (parentCommentWithDetails.DiscussionChannel) {
      contentTitle = parentCommentWithDetails.DiscussionChannel.Discussion.title;
      channelName = parentCommentWithDetails.Channel?.uniqueName;
      contentUrl = `${process.env.FRONTEND_URL}/forums/${channelName}/discussions/${parentCommentWithDetails.DiscussionChannel.Discussion.id}/comments/${parentCommentId}`;
    } else if (parentCommentWithDetails.Event) {
      contentTitle = parentCommentWithDetails.Event.title;

      // Get the channel name from the first event channel
      if (!parentCommentWithDetails.Channel?.uniqueName) {
        console.log('No channel found for event');
        return;
      }

      channelName = parentCommentWithDetails.Channel?.uniqueName;
      contentUrl = `${process.env.FRONTEND_URL}/forums/${channelName}/events/${parentCommentWithDetails.Event.id}/comments/${parentCommentId}`;
    } else {
      console.log('No content reference found for parent comment');
      return;
    }

    // Create markdown notification text for in-app notification
    const notificationMessage = `
${commenterUsername} replied to your comment on [${contentTitle}](${contentUrl})
    `;

    // Create email content for reply notification
    const emailContent = {
      subject: `New reply to your comment on: ${contentTitle}`,
      plainText: `
${commenterUsername} replied to your comment on "${contentTitle}":

"${fullComment.text}"

View the reply at:
${contentUrl}
      `,
      html: `
<p><strong>${commenterUsername}</strong> replied to your comment on "<strong>${contentTitle}</strong>":</p>
<blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin-left: 0;">
  ${fullComment.text}
</blockquote>
<p>
  <a href="${contentUrl}">View the reply</a>
</p>
      `
    };

    // Send both email and in-app notification
    if (isParentUserComment) {
      await sendEmailToUser(
        parentAuthorUsername,
        emailContent,
        UserModel,
        {
          inAppText: notificationMessage,
          createInAppNotification: true
        }
      );
    }
  }

  /**
   * Stop the comment notification service
   */
  stop() {
    console.log('Stopping comment notification service');
    this.isRunning = false;

    // Clear the subscription iterator
    this.subscriptionIterator = null;
  }
}