import { rule } from "graphql-shield";
import { CommentCreateInput } from "../src/generated/graphql.js";
import { sendEmailToUser, createCommentNotificationEmail } from "../customResolvers/mutations/shared/emailUtils.js";

type AfterCreateCommentArgs = {
  input: CommentCreateInput[];
};

/**
 * This rule runs after a comment is successfully created
 * It notifies the appropriate authors when someone comments on their content
 */
export const afterCreateComment = rule({ cache: "contextual" })(
  async (parent: any, args: AfterCreateCommentArgs, ctx: any, info: any) => {
    try {
      // The resolver has already run and result is in parent
      if (!parent.comments || !parent.comments[0]) {
        return true; // No comment was created, nothing to do
      }

      const newComment = parent.comments[0];
      const commentId = newComment.id;
      
      // Get the commenter info from the created comment
      const commenterUsername = newComment.CommentAuthor?.username || 
                               newComment.CommentAuthor?.displayName || 
                               'Someone';
      
      // Extract input from args to determine what this is commenting on
      const commentInput = args.input[0];
      
      // Get required models
      const UserModel = ctx.ogm.model("User");
      const DiscussionChannelModel = ctx.ogm.model("DiscussionChannel");
      const DiscussionModel = ctx.ogm.model("Discussion");
      const EventModel = ctx.ogm.model("Event");
      const EventChannelModel = ctx.ogm.model("EventChannel");
      const CommentModel = ctx.ogm.model("Comment");
      
      // Check if this is a comment on a discussion
      if (commentInput.DiscussionChannel?.connect?.where?.node?.id) {
        const discussionChannelId = commentInput.DiscussionChannel.connect.where.node.id;
        
        // Fetch the discussion channel information
        const discussionChannels = await DiscussionChannelModel.find({
          where: { id: discussionChannelId },
          selectionSet: `{
            channelUniqueName
            discussionId
            Channel {
              uniqueName
              displayName
            }
          }`
        });
        
        if (!discussionChannels.length) {
          return true; // Discussion channel not found
        }
        
        const discussionChannel = discussionChannels[0];
        const channelName = discussionChannel.Channel.uniqueName;
        
        // Fetch the discussion and its author
        const discussions = await DiscussionModel.find({
          where: { id: discussionChannel.discussionId },
          selectionSet: `{
            id
            title
            Author {
              username
            }
          }`
        });
        
        if (!discussions.length || !discussions[0].Author) {
          return true; // Discussion or author not found
        }
        
        const discussion = discussions[0];
        const authorUsername = discussion.Author.username;
        
        // Don't notify authors about their own comments
        if (commenterUsername === authorUsername) {
          return true;
        }
        
        // Create markdown notification text for in-app notification
        const notificationMessage = `
${commenterUsername} commented on your discussion [${discussion.title}](${process.env.FRONTEND_URL}/forums/${channelName}/discussion/${discussion.id}?comment=${commentId})
`;

        // Create email content
        const emailContent = createCommentNotificationEmail(
          newComment.text,
          discussion.title,
          commenterUsername,
          channelName,
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
      
      // Check if this is a comment on an event
      else if (commentInput.Event?.connect?.where?.node?.id) {
        const eventId = commentInput.Event.connect.where.node.id;
        
        // Fetch the event and its poster
        const events = await EventModel.find({
          where: { id: eventId },
          selectionSet: `{
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
          }`
        });
        
        if (!events.length || !events[0].Poster) {
          return true; // Event or poster not found
        }
        
        const event = events[0];
        const posterUsername = event.Poster.username;
        
        // Don't notify posters about their own comments
        if (commenterUsername === posterUsername) {
          return true;
        }
        
        // Get channel name from event channels (use first one for notification)
        if (!event.EventChannels || !event.EventChannels.length) {
          return true; // No channel found for event
        }
        
        const channelName = event.EventChannels[0].Channel.uniqueName;
        
        // Create markdown notification text for in-app notification
        const notificationMessage = `
${commenterUsername} commented on your event [${event.title}](${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}?comment=${commentId})
`;

        // Create email content for event notification
        const emailContent = {
          subject: `New comment on your event: ${event.title}`,
          plainText: `
${commenterUsername} commented on your event "${event.title}":

"${newComment.text}"

View the comment at:
${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}?comment=${commentId}
`,
          html: `
<p><strong>${commenterUsername}</strong> commented on your event "<strong>${event.title}</strong>":</p>
<blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin-left: 0;">
  ${newComment.text}
</blockquote>
<p>
  <a href="${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}?comment=${commentId}">View the comment</a>
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
      
      // Check if this is a reply to another comment
      else if (commentInput.ParentComment?.connect?.where?.node?.id) {
        const parentCommentId = commentInput.ParentComment.connect.where.node.id;
        
        // Fetch the parent comment and its author
        const parentComments = await CommentModel.find({
          where: { id: parentCommentId },
          selectionSet: `{
            id
            CommentAuthor {
              ... on User {
                username
              }
              ... on ModerationProfile {
                displayName
              }
            }
            DiscussionChannel {
              channelUniqueName
              Discussion {
                id
                title
              }
              Channel {
                uniqueName
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
        
        if (!parentComments.length || !parentComments[0].CommentAuthor) {
          return true; // Parent comment or author not found
        }
        
        const parentComment = parentComments[0];
        
        // Determine parent comment author's username and if it's a user
        const isParentUserComment = parentComment.CommentAuthor.__typename === 'User';
        const parentAuthorUsername = isParentUserComment 
          ? parentComment.CommentAuthor.username 
          : parentComment.CommentAuthor.displayName;
          
        // Don't notify authors about their own replies
        if (commenterUsername === parentAuthorUsername) {
          return true;
        }
        
        // Variable to store notification info
        let contentTitle, contentUrl, channelName;
        
        // Determine if parent comment is on a discussion or event
        if (parentComment.DiscussionChannel) {
          contentTitle = parentComment.DiscussionChannel.Discussion.title;
          channelName = parentComment.DiscussionChannel.Channel.uniqueName;
          contentUrl = `${process.env.FRONTEND_URL}/forums/${channelName}/discussion/${parentComment.DiscussionChannel.Discussion.id}?comment=${parentCommentId}`;
        } else if (parentComment.Event) {
          contentTitle = parentComment.Event.title;
          
          // Get the channel name from the first event channel
          if (!parentComment.Event.EventChannels || !parentComment.Event.EventChannels.length) {
            return true; // No channel found for event
          }
          
          channelName = parentComment.Event.EventChannels[0].Channel.uniqueName;
          contentUrl = `${process.env.FRONTEND_URL}/forums/${channelName}/events/${parentComment.Event.id}?comment=${parentCommentId}`;
        } else {
          return true; // No content reference found
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

"${newComment.text}"

View the reply at:
${contentUrl}
`,
          html: `
<p><strong>${commenterUsername}</strong> replied to your comment on "<strong>${contentTitle}</strong>":</p>
<blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin-left: 0;">
  ${newComment.text}
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

      return true;
    } catch (error) {
      console.error("Error in afterCreateComment middleware:", error);
      // We don't want to fail the comment creation if notification fails
      return true;
    }
  }
);