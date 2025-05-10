import type {
  CommentModel,
  DiscussionChannelModel,
  DiscussionModel,
  UserModel,
} from "../../ogm_types.js";
import { 
  sendEmailToUser, 
  createCommentNotificationEmail 
} from "./shared/emailUtils.js";

type Args = {
  commentId: string;
};

type Input = {
  Comment: CommentModel;
  DiscussionChannel: DiscussionChannelModel;
  Discussion: DiscussionModel;
  User: UserModel;
};

/**
 * This resolver notifies a discussion author when someone comments on their discussion
 * It should be called after a comment is created
 */
const getResolver = (input: Input) => {
  const { Comment, User } = input;

  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { commentId } = args;

    if (!commentId) {
      throw new Error("Comment ID is required");
    }

    try {
      // Fetch the comment with related data
      const comments = await Comment.find({
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
          DiscussionChannel {
            id
            Channel {
              uniqueName
              displayName
            }
            Discussion {
              id
              title
              Author {
                username
              }
            }
          }
        }`
      });
console.log('comments', comments);
      if (!comments || !comments.length || !comments[0]) {
        throw new Error(`Comment with ID ${commentId} not found`);
      }

      const comment = comments[0];

      if (!comment) {
        console.log("Comment not found");
        return false;
      }
      
      // Don't notify if this is a self-comment
      const isUserComment = comment.CommentAuthor?.__typename === 'User';
      const commenterUsername = isUserComment
        ? (comment.CommentAuthor as { username: string }).username
        : (comment.CommentAuthor as { displayName: string }).displayName;
      
      if (!comment.DiscussionChannel?.Discussion?.Author?.username) {
        console.log("Missing discussion or author data, cannot send notification");
        return false;
      }

      const authorUsername = comment.DiscussionChannel.Discussion.Author.username;
      
      // Don't notify authors about their own comments
      if (isUserComment && commenterUsername === authorUsername) {
        console.log("Not notifying author of their own comment");
        return false;
      }

      const discussionTitle = comment.DiscussionChannel.Discussion.title;
      const channelName = comment.DiscussionChannel.Channel?.uniqueName;
      const discussionId = comment.DiscussionChannel.Discussion.id;
      
      // Create markdown notification text for in-app notification
      const notificationMessage = `
${commenterUsername} commented on your discussion [${discussionTitle}](${process.env.FRONTEND_URL}/forums/${channelName}/discussion/${discussionId}?comment=${commentId})
`;

      // Create email content
      const emailContent = createCommentNotificationEmail(
        comment?.text || "",
        discussionTitle,
        commenterUsername,
        channelName || "",
        discussionId,
        commentId
      );

      // Send both email and in-app notification
      const notificationSent = await sendEmailToUser(
        authorUsername,
        emailContent,
        User,
        {
          inAppText: notificationMessage,
          createInAppNotification: true
        }
      );

      return notificationSent;
    } catch (e) {
      console.error("Error notifying discussion author:", e);
      return false;
    }
  };
};

export default getResolver;