import { IssueCreateInput } from "../../src/generated/graphql";

type Input = {
  Issue: any;
};

type Args = {
  relatedEventId: string;
  channelUniqueName: string;
  authorName: string;
  title: string;
  body: string;
};

const getResolver = (input: Input) => {
  const { Issue} = input;

  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { relatedEventId, channelUniqueName, authorName, title, body } =
      args;

    if (!relatedEventId || !title || !authorName || !channelUniqueName) {
      throw new Error(
        "All arguments (relatedEventId, title, authorName, channelUniqueName) are required"
      );
    }

    // This report must be query-able from the reporter, from the person who reported the item,
    // and from the event itself.

    // try {
      // First check if there is already an issue for the given eventId. 
      // If not, create a new issue.

      const result = await Issue.find({
        where: {
          relatedEventId,
        },
      });

      if (result.length === 0) {
        const issueCreationInput: IssueCreateInput = {
          title,
          body,
          relatedEventId,
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
          RelatedEvent: {
            connect: {
              where: {
                node: {
                  id: relatedEventId,
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
