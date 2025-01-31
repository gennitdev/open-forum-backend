import type {
  IssueModel,
  CommentModel,
  IssueCreateInput,
  ModerationActionCreateInput,
  IssueWhere,
  IssueUpdateInput,
} from "../../ogm_types.js";
import { setUserDataOnContext } from "../../rules/permission/userDataHelperFunctions.js";
import { GraphQLError } from "graphql";
import { getFinalCommentText } from "./reportDiscussion.js";

type Args = {
  commentId: string;
  reportText: string;
  selectedForumRules: string[];
  selectedServerRules: string[];
  channelUniqueName: string;
};

type Input = {
  Issue: IssueModel;
  Comment: CommentModel;
};

const getResolver = (input: Input) => {
  const { Issue, Comment } = input;
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const {
      commentId,
      reportText,
      selectedForumRules,
      selectedServerRules,
      channelUniqueName,
    } = args;

    if (!commentId) {
      throw new GraphQLError("Comment ID is required");
    }
    if (!channelUniqueName) {
      throw new GraphQLError("Channel unique name is required");
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

    // Check if an issue already exists for the comment ID and channel unique name.
    const issueData = await Issue.find({
      where: {
        channelUniqueName: channelUniqueName,
        relatedCommentId: commentId,
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
    }

    const finalCommentText = getFinalCommentText({
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
      actionType: "report",
      actionDescription: "Reported the comment",
      Comment: {
        create: {
          node: {
            text: finalCommentText,
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

    // If an issue already exists, update the issue with the new moderation action.
    if (existingIssueId) {
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
        isOpen: true, // Reopen the issue if it was closed
        flaggedServerRuleViolation:
          existingIssueFlaggedServerRuleViolation ||
          selectedServerRules.length > 0,
      };

      try {
        const issueData = await Issue.update({
          where: issueUpdateWhere,
          update: issueUpdateInput,
        });
        const issueId = issueData.issues[0]?.id || null;
        if (issueId) return true;
      } catch (error) {
        throw new GraphQLError("Error updating issue");
      }
    }

    // If an issue does NOT already exist, create a new issue.

    const commentData = await Comment.find({
      where: {
        id: commentId,
      },
      selectionSet: `{
            id
            text            
        }`,
    });
    const commentText = commentData[0]?.text || '';
    const truncatedCommentText = commentText?.substring(0, 50) || "";

    const issueCreateInput: IssueCreateInput = {
      title: `[Reported Comment] "${truncatedCommentText}${
        commentText.length > 50 ? "..." : ""
      }"`,
      isOpen: true,
      authorName: loggedInModName,
      flaggedServerRuleViolation: selectedServerRules.length > 0,
      channelUniqueName: channelUniqueName,
      relatedCommentId: commentId,
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
      ActivityFeed: {
        create: [
          {
            node: moderationActionCreateInput,
          },
        ],
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
      return issueData;
    } catch (error) {
      throw new GraphQLError("Error creating issue");
    }
  };
};

export default getResolver;
