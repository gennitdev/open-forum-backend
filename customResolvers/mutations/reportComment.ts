import { IssueCreateInput } from "../../src/generated/graphql";

type Input = {
  Issue: any;
};

type Args = {
  relatedCommentId: string;
  channelUniqueName: string;
  authorName: string;
  title: string;
  body: string;
};

const getResolver = (input: Input) => {
  const { Issue} = input;

  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { relatedCommentId, channelUniqueName, authorName, title, body } =
      args;

    if (!relatedCommentId || !title || !authorName || !channelUniqueName) {
      throw new Error(
        "All arguments (relatedCommentId, title, authorName, channelUniqueName) are required"
      );
    }

    // This report must be query-able from the reporter, from the person who reported the item,
    // and from the comment itself.

    // try {
      // First check if there is already an issue for the given commentId. 
      // If not, create a new issue.

      const result = await Issue.find({
        where: {
          relatedCommentId,
        },
      });

      if (result.length === 0) {
        const issueCreationInput: IssueCreateInput = {
          title,
          body,
          relatedCommentId,
          channelUniqueName,
          authorName,
          isOpen: true,
          Channel: {
            connect: {
              where: {
                node: {
                  uniqueName: channelUniqueName,
                },
              },
            },
          },
          Author: {
            ModerationProfile: {
              connect: {
                where: {
                  node: {
                    displayName: authorName,
                  },
                },
              },
            },
          },
          RelatedComment: {
            connect: {
              where: {
                node: {
                  id: relatedCommentId,
                },
              },
            },
          },
        };
        try {
          const issue = await Issue.create({
            input: [issueCreationInput],
          });
          return issue;
        } catch (error) {
          console.error('Error creating issue:', error);
          // Handle or rethrow the error as appropriate
        }
      }

  };
};

export default getResolver;
