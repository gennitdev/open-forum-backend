import type {
  IssueModel,
  DiscussionModel,
  IssueCreateInput,
  ModerationActionCreateInput,
  IssueWhere,
  IssueUpdateInput,
  DiscussionChannelUpdateInput,
  DiscussionChannelWhere,
  DiscussionChannelModel,
} from "../../ogm_types.js";
import { setUserDataOnContext } from "../../rules/permission/userDataHelperFunctions.js";
import { GraphQLError } from "graphql";
import { getFinalCommentText } from "./reportDiscussion.js";

type Args = {
  discussionId: string;
  selectedForumRules: string[];
  selectedServerRules: string[];
  reportText: string;
  channelUniqueName: string;
};

type Input = {
  Issue: IssueModel;
  Discussion: DiscussionModel;
  DiscussionChannel: DiscussionChannelModel;
};

const getResolver = (input: Input) => {
  const { Issue, Discussion, DiscussionChannel } = input;
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const {
      discussionId,
      selectedForumRules,
      selectedServerRules,
      reportText,
      channelUniqueName,
    } = args;

    if (!discussionId) {
      throw new GraphQLError("Discussion ID is required");
    }

    if (!channelUniqueName) {
      throw new GraphQLError("A forum name is required.");
    }

    const atLeastOneViolation =
      selectedForumRules?.length > 0 || selectedServerRules?.length > 0;

    if (!atLeastOneViolation) {
      throw new GraphQLError("At least one rule must be selected");
    }

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

    let existingIssueId = "";
    let existingIssueFlaggedServerRuleViolation = false;
    const discussionData = await Discussion.find({
      where: {
        id: discussionId,
      },
      selectionSet: `{
            id
            title
        }`,
    });

    // Check if an issue already exists for the discussion ID and channel unique name.
    const issueData = await Issue.find({
      where: {
        channelUniqueName: channelUniqueName,
        relatedDiscussionId: discussionId,
      },
      selectionSet: `{
            id
            flaggedServerRuleViolation
        }`,
    });

    if (issueData.length > 0) {
      existingIssueId = issueData[0]?.id || "";
      existingIssueFlaggedServerRuleViolation =
        issueData[0]?.flaggedServerRuleViolation || false;
    } else {
      // If an issue does NOT already exist, create a new issue.
      const discussionTitle = discussionData[0]?.title || "";
      const truncatedDiscussionTitle = discussionTitle?.substring(0, 50) || "";

      const issueCreateInput: IssueCreateInput = {
        title: `[Reported Discussion] "${truncatedDiscussionTitle}${
          truncatedDiscussionTitle.length > 50 ? "..." : ""
        }"`,
        isOpen: true,
        authorName: loggedInModName,
        flaggedServerRuleViolation: selectedServerRules.length > 0,
        channelUniqueName: channelUniqueName,
        relatedDiscussionId: discussionId,
        Author: {
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
      };

      try {
        const issueData = await Issue.create({
          input: [issueCreateInput],
        });
        const issueId = issueData.issues[0]?.id || null;
        if (!issueId) {
          throw new GraphQLError("Error creating issue");
        }
        existingIssueId = issueId;
      } catch (error) {
        throw new GraphQLError("Error creating issue");
      }
    }

    const finalDiscussionText = getFinalCommentText({
      reportText,
      selectedForumRules,
      selectedServerRules,
    });

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
      actionType: "archive",
      actionDescription: "Archived the discussion and closed the issue",
      Comment: {
        create: {
          node: {
            text: finalDiscussionText,
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

    try {
      // Add the activity feed item to the issue that says we archived the discussion.
      const issueUpdateWhere: IssueWhere = {
        id: existingIssueId,
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
        isOpen: false, // Close the issue; archival is often the final action.
        flaggedServerRuleViolation:
          existingIssueFlaggedServerRuleViolation ||
          selectedServerRules.length > 0,
      };

      const issueData = await Issue.update({
        where: issueUpdateWhere,
        update: issueUpdateInput,
      });
      const issueId = issueData.issues[0]?.id || null;
      if (!issueId) {
        throw new GraphQLError("Error updating issue");
      }
    } catch (error) {
      throw new GraphQLError("Error updating issue");
    }

    try {
      // Update the discussionChannel so that archived=true and the issue is linked
      // to the discussion under RelatedIssues.
      // First we need to find the discussionChannel that matches the given discussion ID
      // and channel unique name.
      const discussionChannel = await DiscussionChannel.find({
        where: {
          discussionId: discussionId,
          channelUniqueName: channelUniqueName,
        },
        selectionSet: `{
            id
        }`,
      });
      console.log("discussionChannel", discussionChannel);
      const discussionChannelId = discussionChannel[0]?.id || null;
      if (!discussionChannelId) {
        throw new GraphQLError("Error finding discussionChannel");
      }
      const discussionChannelUpdateWhere: DiscussionChannelWhere = {
        id: discussionChannelId,
      };
      const discussionChannelUpdateInput: DiscussionChannelUpdateInput = {
        archived: true,
        RelatedIssues: [
          {
            connect: [
              {
                where: {
                  node: {
                    id: existingIssueId,
                  },
                },
              },
            ],
          },
        ],
      };
      const discussionChannelUpdateData = await DiscussionChannel.update({
        where: discussionChannelUpdateWhere,
        update: discussionChannelUpdateInput,
      });
      console.log('result of discussion channel update data', discussionChannelUpdateData);
      const discussionChannelUpdateId =
        discussionChannelUpdateData.discussionChannels[0]?.id || null;
      if (!discussionChannelUpdateId) {
        throw new GraphQLError("Error updating discussionChannel");
      }
      return issueData[0];
    } catch (error) {
      console.log("Error creating issue", error);
      return false;
    }
  };
};

export default getResolver;
