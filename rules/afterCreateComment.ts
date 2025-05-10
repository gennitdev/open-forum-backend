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
      console.log("After create comment middleware running");

      // In GraphQL Shield, when using chain(), the parent isn't what we expect
      // We need to get the comment from the input args instead
      if (!args.input || !args.input[0]) {
        console.log("No comment input found");
        return true; // No comment was created, nothing to do
      }

      // Get the necessary models
      const CommentModel = ctx.ogm.model("Comment");
      const UserModel = ctx.ogm.model("User");
      const DiscussionModel = ctx.ogm.model("Discussion");

      // Get the comment input
      const commentInput = args.input[0];
      console.log("Processing comment input");

      // Create a slightly longer delay to ensure the comment is fully created
      await new Promise(resolve => setTimeout(resolve, 300));

      // Direct access to comment based on its connections
      let commentQuery = {};
      let commentId;

      // We need to construct a query to find the newly created comment
      if (commentInput.DiscussionChannel?.connect?.where?.node?.id) {
        // This is a direct query to find the comment via its DiscussionChannel connection
        const discussionChannelId = commentInput.DiscussionChannel.connect.where.node.id;
        commentQuery = { DiscussionChannel: { id: discussionChannelId } };
      } else if (commentInput.Event?.connect?.where?.node?.id) {
        // This is a direct query to find the comment via its Event connection
        const eventId = commentInput.Event.connect.where.node.id;
        commentQuery = { Event: { id: eventId } };
      } else if (commentInput.ParentComment?.connect?.where?.node?.id) {
        // This is a direct query to find the comment via its ParentComment connection
        const parentCommentId = commentInput.ParentComment.connect.where.node.id;
        commentQuery = { ParentComment: { id: parentCommentId } };
      }

      console.log("Looking up comment details");

      // Find the newly created comment with full details
      const fullComments = await CommentModel.find({
        where: commentQuery,
        options: {
          sort: [{ createdAt: 'DESC' }],
          limit: 1
        },
        selectionSet: `{
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
        console.log("Could not find comment details");
        return true;
      }

      const fullComment = fullComments[0];
      commentId = fullComment.id;
      console.log("Found comment details, processing notifications...");

      // Get the commenter info from the created comment
      const commenterUsername = fullComment.CommentAuthor?.username ||
                               fullComment.CommentAuthor?.displayName ||
                               'Someone';

      // Check if this is a comment on a discussion
      if (fullComment.DiscussionChannel) {
        console.log("Processing comment on discussion");

        // We need to get the discussion details
        const discussionId = fullComment.DiscussionChannel.discussionId;

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
          console.log("Discussion or author not found");
          return true;
        }

        const discussion = discussions[0];
        const authorUsername = discussion.Author.username;

        // Don't notify authors about their own comments
        if (commenterUsername === authorUsername) {
          console.log("Not notifying author of their own comment");
          return true;
        }

        const channelName = fullComment.DiscussionChannel.Channel.uniqueName;
        console.log(`Sending notification to ${authorUsername} about comment on discussion ${discussion.title}`);

        // Create markdown notification text for in-app notification
        const notificationMessage = `
${commenterUsername} commented on your discussion [${discussion.title}](${process.env.FRONTEND_URL}/forums/${channelName}/discussion/${discussion.id}?comment=${commentId})
`;

        // Create email content
        const emailContent = createCommentNotificationEmail(
          fullComment.text,
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
      else if (fullComment.Event) {
        console.log("Processing comment on event");

        const event = fullComment.Event;

        if (!event.Poster) {
          console.log("Event poster not found");
          return true;
        }

        const posterUsername = event.Poster.username;

        // Don't notify posters about their own comments
        if (commenterUsername === posterUsername) {
          console.log("Not notifying poster of their own comment");
          return true;
        }

        // Get channel name from event channels (use first one for notification)
        if (!event.EventChannels || !event.EventChannels.length) {
          console.log("No channel found for event");
          return true;
        }

        const channelName = event.EventChannels[0].Channel.uniqueName;
        console.log(`Sending notification to ${posterUsername} about comment on event ${event.title}`);

        // Create markdown notification text for in-app notification
        const notificationMessage = `
${commenterUsername} commented on your event [${event.title}](${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}?comment=${commentId})
`;

        // Create email content for event notification
        const emailContent = {
          subject: `New comment on your event: ${event.title}`,
          plainText: `
${commenterUsername} commented on your event "${event.title}":

"${fullComment.text}"

View the comment at:
${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}?comment=${commentId}
`,
          html: `
<p><strong>${commenterUsername}</strong> commented on your event "<strong>${event.title}</strong>":</p>
<blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin-left: 0;">
  ${fullComment.text}
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
      else if (fullComment.ParentComment) {
        console.log("Processing reply to comment");

        const parentComment = fullComment.ParentComment;

        if (!parentComment.CommentAuthor) {
          console.log("Parent comment author not found");
          return true;
        }

        // Fetch more details about the parent comment
        const parentCommentId = parentComment.id;
        const parentCommentDetails = await CommentModel.find({
          where: { id: parentCommentId },
          selectionSet: `{
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
          console.log("Could not fetch parent comment details");
          return true;
        }

        const parentCommentWithDetails = parentCommentDetails[0];

        // Determine parent comment author's username and if it's a user
        const isParentUserComment = parentCommentWithDetails.CommentAuthor.__typename === 'User';
        const parentAuthorUsername = isParentUserComment
          ? (parentCommentWithDetails.CommentAuthor as { username: string }).username
          : (parentCommentWithDetails.CommentAuthor as { displayName: string }).displayName;

        // Don't notify authors about their own replies
        if (commenterUsername === parentAuthorUsername) {
          console.log("Not notifying author of reply to their own comment");
          return true;
        }

        console.log(`Sending notification to ${parentAuthorUsername} about reply to their comment`);

        // Variable to store notification info
        let contentTitle, contentUrl, channelName;

        // Determine if parent comment is on a discussion or event
        if (parentCommentWithDetails.DiscussionChannel) {
          contentTitle = parentCommentWithDetails.DiscussionChannel.Discussion.title;
          channelName = parentCommentWithDetails.DiscussionChannel.Channel.uniqueName;
          contentUrl = `${process.env.FRONTEND_URL}/forums/${channelName}/discussion/${parentCommentWithDetails.DiscussionChannel.Discussion.id}?comment=${parentCommentId}`;
        } else if (parentCommentWithDetails.Event) {
          contentTitle = parentCommentWithDetails.Event.title;

          // Get the channel name from the first event channel
          if (!parentCommentWithDetails.Event.EventChannels || !parentCommentWithDetails.Event.EventChannels.length) {
            console.log("No channel found for event");
            return true;
          }

          channelName = parentCommentWithDetails.Event.EventChannels[0].Channel.uniqueName;
          contentUrl = `${process.env.FRONTEND_URL}/forums/${channelName}/events/${parentCommentWithDetails.Event.id}?comment=${parentCommentId}`;
        } else {
          console.log("No content reference found for parent comment");
          return true;
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

      return true;
    } catch (error) {
      console.error("Error in afterCreateComment middleware:", error);
      // We don't want to fail the comment creation if notification fails
      return true;
    }
  }
);