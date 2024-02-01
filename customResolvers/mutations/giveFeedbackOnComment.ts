import { CommentCreateInput } from "../../src/generated/graphql";

type Input = {
  Comment: any;
};

type Args = {
  commentId: string;
  modProfileName: string;
  commentText: string;
};

const getResolver = (input: Input) => {
  const { Comment } = input;

  return async (parent: any, args: Args, context: any, resolveInfo: any) => {

    const { commentId, modProfileName, commentText } = args;

    if (!commentId || !modProfileName || !commentText) {
      throw new Error(
        "All arguments (commentId, modProfileName and commentText) are required"
      );
    }

    // This feedback must be query-able from the moderator who gave feedback on the comment,
    // and from the original comment itself.

    const commentCreationInput: CommentCreateInput = {
      text: commentText,
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
      GivesFeedbackOnComment: {
        connect: {
          where: {
            node: {
              id: commentId,
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
