import { CommentCreateInput } from "../../src/generated/graphql";

type Input = {
  Comment: any;
};

type Args = {
  eventId: string;
  modProfileName: string;
  commentText: string;
  channelUniqueName: string;
};

const getResolver = (input: Input) => {
  const { Comment } = input;

  return async (parent: any, args: Args, context: any, resolveInfo: any) => {

    const { eventId, modProfileName, commentText, channelUniqueName } = args;

    if (!eventId || !modProfileName || !commentText || !channelUniqueName) {
      throw new Error(
        "All arguments (eventId, modProfileName, commentText and channelUniqueName) are required"
      );
    }

    // This feedback must be query-able from the moderator who gave feedback on the event,
    // and from the event itself.

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
      GivesFeedbackOnEvent: {
        connect: {
          where: {
            node: {
              id: eventId,
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
      // Handle or rethrow the error as appropriate
    }
  };
};

export default getResolver;
