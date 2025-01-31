import type {
  IssueModel,
  ChannelWhere,
  ChannelUpdateInput,
  ModerationActionCreateInput,
  IssueWhere,
  IssueUpdateInput,
  ChannelModel,
} from "../../ogm_types.js";
import { setUserDataOnContext } from "../../rules/permission/userDataHelperFunctions.js";
import { GraphQLError } from "graphql";

type Args = {
  issueId: string;
};

type Input = {
  Issue: IssueModel;
  Channel: ChannelModel;
};

const getResolver = (input: Input) => {
  const { Issue, Channel } = input;
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { issueId } = args;
    if (!issueId) {
      throw new GraphQLError("Issue ID is required");
    }
    // Check if an issue already exists for the issue ID and channel unique name.
    const issueData = await Issue.find({
      where: {
        id: issueId,
      },
      selectionSet: `{
            id
            channelUniqueName
            relatedUsername
            Channel { uniqueName }
        }`,
    });

    // If the issue is not found, throw an error.
    if (issueData.length === 0) {
      throw new GraphQLError("Issue not found");
    }

    const channelUniqueName = issueData[0]?.Channel?.uniqueName || null;
    if (!channelUniqueName) {
      throw new GraphQLError("Could not find the forum name for the issue.");
    }

    const relatedUsername = "test"; //issueData[0]?.relatedUsername || null;
    // if (!relatedUsername) {
    //   throw new GraphQLError("Could not find the username of the account that needs to be suspended.");
    // }

    // Set loggedInUsername to null explicitly if not present
    context.user = await setUserDataOnContext({
      context,
      getPermissionInfo: false,
    });

    const loggedInUsername = context.user?.username || null;

    if (!loggedInUsername) {
      throw new GraphQLError("User must be logged in");
    }
    const loggedInModName = context.user.data.ModerationProfile.displayName;
    if (!loggedInModName) {
      throw new GraphQLError(`User ${loggedInUsername} is not a moderator`);
    }

    const moderationActionCreateInput: ModerationActionCreateInput = {
      ModerationProfile: {
        connect: {
          where: {
            node: {
              displayName: loggedInModName,
            },
          },
        },
      },
      actionType: "suspension",
      actionDescription: "Suspended the user",
      Comment: {
        create: {
          node: {
            text: "The user has been suspended.",
            isRootComment: true,
            CommentAuthor: {
              ModerationProfile: {
                connect: {
                  where: {
                    node: {
                      displayName: loggedInModName,
                    },
                  },
                },
              },
            },
            Channel: {
              connect: {
                where: {
                  node: {
                    uniqueName: channelUniqueName,
                  },
                },
              },
            },
          },
        },
      },
    };

    // Update the issue with the new moderation action.
    const issueUpdateWhere: IssueWhere = {
      id: issueId,
    };
    const issueUpdateInput: IssueUpdateInput = {
      ActivityFeed: [
        {
          create: [
            {
              node: moderationActionCreateInput,
            },
          ],
        },
      ],
    };

    try {
      const issueData = await Issue.update({
        where: issueUpdateWhere,
        update: issueUpdateInput,
      });
      const issueId = issueData.issues[0]?.id || null;
      // Also update the channel's Suspensions field
      // to include the suspended user's username.

      // const channelUpdateWhere: ChannelWhere = {
      //   uniqueName: channelUniqueName,
      // };
      // const channelUpdateInput: ChannelUpdateInput = {
      //   SuspendedUsers: {
      //     connect: {
      //       where: {
      //         node: {
      //           username: relatedUsername,
      //         },
      //       },
      //     },
      //   },
      // };

      // try {
      //   const channelData = await Channel.update({
      //     where: channelUpdateWhere,
      //     update: channelUpdateInput,
      //   });
      //   const channelId = channelData.channels[0]?.uniqueName || null;
      //   if (channelId) return issueData;
      // } catch (error) {
      //   throw new GraphQLError("Error updating channel");
      // }
    } catch (error) {
      throw new GraphQLError("Error updating issue");
    }

    return false;
  };
};

export default getResolver;
