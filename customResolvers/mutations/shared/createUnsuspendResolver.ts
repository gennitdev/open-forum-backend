import { GraphQLError } from "graphql";
import type {
  IssueModel,
  ChannelModel,
  IssueWhere,
  IssueUpdateInput,
  ChannelWhere,
  ChannelUpdateInput,
  ModerationActionCreateInput,
} from "../../../ogm_types.js";
import { setUserDataOnContext } from "../../../rules/permission/userDataHelperFunctions.js";

type CreateUnsuspendResolverOptions = {
  Issue: IssueModel;
  Channel: ChannelModel;

  // The name of the field on the Issue that identifies the user or mod to suspend
  issueRelatedAccountField: 'relatedUsername' | 'relatedModProfileName';

  // The field on Channel to connect the suspended user or mod
  channelSuspendedField: 'SuspendedUsers' | 'SuspendedMods';

  // A short string describing who/what is being suspended
  suspendedEntityName: 'user' | 'mod';

  // For constructing the moderation action message text (and description).
  suspensionActionDescription: string;
  suspensionCommentText: string;
};

type Args = {
  issueId: string;
};

export function createUnsuspendResolver({
  Issue,
  Channel,
  issueRelatedAccountField,
  channelSuspendedField,
  suspendedEntityName,
  suspensionActionDescription,
  suspensionCommentText,
}: CreateUnsuspendResolverOptions) {
  return async function suspendEntityResolver(
    parent: any,
    args: Args,
    context: any,
    resolveInfo: any
  ) {
    const { issueId } = args;
    if (!issueId) {
      throw new GraphQLError("Issue ID is required");
    }

    // Fetch Issue to ensure it exists and to retrieve the channel unique name.
    const issueData = await Issue.find({
      where: { id: issueId },
      selectionSet: `{
        id
        channelUniqueName
        ${issueRelatedAccountField}
        Channel { uniqueName }
      }`,
    });

    if (issueData.length === 0) {
      throw new GraphQLError("Issue not found");
    }

    const foundIssue = issueData[0];
    const channelUniqueName = foundIssue?.Channel?.uniqueName;
    if (!channelUniqueName) {
      throw new GraphQLError("Could not find the forum name for the issue.");
    }

    const relatedAccountName = foundIssue?.[issueRelatedAccountField];
    if (!relatedAccountName) {
      throw new GraphQLError(
        `Could not find the ${suspendedEntityName} account name to be suspended.`
      );
    }

    // Make sure the user is logged in and is a moderator
    context.user = await setUserDataOnContext({
      context,
      getPermissionInfo: false,
    });
    const loggedInUsername = context.user?.username || null;
    if (!loggedInUsername) {
      throw new GraphQLError("User must be logged in");
    }
    const loggedInModName = context.user.data?.ModerationProfile?.displayName;
    if (!loggedInModName) {
      throw new GraphQLError(`User ${loggedInUsername} is not a moderator`);
    }

    // Build the ModerationAction creation input
    const moderationActionCreateInput: ModerationActionCreateInput = {
      ModerationProfile: {
        connect: {
          where: {
            node: { displayName: loggedInModName },
          },
        },
      },
      actionType: "suspension",
      actionDescription: suspensionActionDescription,
      Comment: {
        create: {
          node: {
            text: suspensionCommentText,
            isRootComment: true,
            CommentAuthor: {
              ModerationProfile: {
                connect: {
                  where: { node: { displayName: loggedInModName } },
                },
              },
            },
            Channel: {
              connect: {
                where: { node: { uniqueName: channelUniqueName } },
              },
            },
          },
        },
      },
    };

    // 4. Update the Issue with the new ModerationAction
    const issueUpdateWhere: IssueWhere = { id: issueId };
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

    let updatedIssue: any;
    try {
      updatedIssue = await Issue.update({
        where: issueUpdateWhere,
        update: issueUpdateInput,
      });
    } catch (error) {
      throw new GraphQLError("Error updating issue");
    }

    const updatedIssueId = updatedIssue.issues[0]?.id || null;
    if (!updatedIssueId) {
      throw new GraphQLError("Unable to update Issue with ModerationAction");
    }

    // Update the Channel's suspended field (e.g. SuspendedUsers / SuspendedMods)
    const channelUpdateWhere: ChannelWhere = {
      uniqueName: channelUniqueName,
    };
    const channelUpdateInput: ChannelUpdateInput = {
      [channelSuspendedField]: [
        {
          connect: [
            {
              where: {
                node: { 
                    username: relatedAccountName ,
                    SuspendedUser: issueRelatedAccountField === 'relatedUsername' ? {
                        connect: {
                            node: {
                                where: { username: relatedAccountName }
                            }
                        }
                    } : null,
                    SuspendedMod: issueRelatedAccountField === 'relatedModProfileName' ? {
                        connect: {
                            node: {
                                where: { displayName: relatedAccountName }
                            }
                        }
                    } : null
                },
              },
            },
          ],
        },
      ],
    };

    try {
      const channelData = await Channel.update({
        where: channelUpdateWhere,
        update: channelUpdateInput,
      });
      const channelId = channelData.channels[0]?.uniqueName || null;
      if (channelId) {
        return updatedIssue; // success
      }
    } catch (error) {
      throw new GraphQLError("Error updating channel");
    }

    return false;
  };
}
