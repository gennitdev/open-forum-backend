import { CommentCreateInput } from "../../src/generated/graphql";

type Input = {
  Comment: any;
};

type Args = {
  discussionId: string;
  modProfileName: string;
  commentText: string;
  channelUniqueName: string;
};

const getResolver = (input: Input) => {
  const { Comment } = input;

  return async (parent: any, args: Args, context: any, resolveInfo: any) => {

    const { 
        discussionId,
        modProfileName, 
        commentText,
        channelUniqueName
    } = args;

    if (!discussionId || !modProfileName || !commentText || !channelUniqueName) {
      throw new Error(
        "All arguments (discussionId, modProfileName, commentText and channelUniqueName) are required"
      );
    }

    // This feedback must be query-able from the moderator who gave feedback on the discussion,
    // and from the discussion itself.

    const commentCreationInput: CommentCreateInput = {
      text: commentText,
      Channel: {
        connect: {
          where: {
            node: {
              uniqueName: channelUniqueName,
            },
          },
        },
      },
      CommentAuthor: {
        ModerationProfile: {
          connect: {
            where: {
              node: {
                displayName: modProfileName,
              },
            },
          },
        },
      },
      isRootComment: true,
      GivesFeedbackOnDiscussion: {
        connect: {
          where: {
            node: {
              id: discussionId,
            },
          },
        },
      },
    };
    try {
      const comment = await Comment.create({
        input: [commentCreationInput],
      });
      return comment;
    } catch (error) {
      console.error("Error creating comment:", error);
    }
  };
};

export default getResolver;
