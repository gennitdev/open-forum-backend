import { IssueCreateInput } from "../../src/generated/graphql";

type Input = {
  Issue: any;
};

type Args = {
  relatedDiscussionId: string;
  channelUniqueName: string;
  authorName: string;
  title: string;
  body: string;
};

const getResolver = (input: Input) => {
  console.log("report discussion resolver input", input);
  const { Issue } = input;

  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    console.log("report discussion resolver args", args);

    const { relatedDiscussionId, channelUniqueName, authorName, title, body } =
      args;

    if (!relatedDiscussionId || !title || !authorName || !channelUniqueName) {
      console.log('could not find a value for relatedDiscussionId, title, authorName, or channelUniqueName')
      throw new Error(
        "All arguments (relatedDiscussionId, title, authorName, channelUniqueName) are required"
      );
    }

    // This report must be query-able from the reporter, from the person who reported the item,
    // and from the discussion itself.

    // try {
      // First check if there is already an issue for the given discussionId. 
      // If not, create a new issue.

      console.log('checking if issue already exists for discussion id', relatedDiscussionId)

      const result = await Issue.find({
        where: {
          relatedDiscussionId,
        },
      });

      if (result.length === 0) {
        const issueCreationInput: IssueCreateInput = {
          title,
          body,
          relatedDiscussionId,
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
          RelatedDiscussion: {
            connect: {
              where: {
                node: {
                  id: relatedDiscussionId,
                },
              },
            },
          },
        };
        try {
          const issue = await Issue.create({
            input: [issueCreationInput],
          });
          console.log('Issue created successfully', issue);
          return issue;
        } catch (error) {
          console.error('Error creating issue:', error);
          // Handle or rethrow the error as appropriate
        }
      }

  };
};

export default getResolver;
