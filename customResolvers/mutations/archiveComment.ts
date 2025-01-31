import type {
  IssueModel,
  CommentModel,
  IssueCreateInput,
  ModerationActionCreateInput,
  IssueWhere,
  IssueUpdateInput,
  CommentUpdateInput,
  CommentWhere,
} from "../../ogm_types.js";
import { setUserDataOnContext } from "../../rules/permission/userDataHelperFunctions.js";
import { GraphQLError } from "graphql";
import { getFinalCommentText } from "./reportDiscussion.js";

type Args = {
  commentId: string;
  selectedForumRules: string[];
  selectedServerRules: string[];
  reportText: string;
};

type Input = {
  Issue: IssueModel;
  Comment: CommentModel;
};

const getResolver = (input: Input) => {
  const { Issue, Comment } = input;
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { commentId, selectedForumRules, selectedServerRules, reportText } =
      args;

    if (!commentId) {
      throw new GraphQLError("Comment ID is required");
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
    const commentData = await Comment.find({
      where: {
        id: commentId,
      },
      selectionSet: `{
            id
            text
            Channel {
              uniqueName
            }
        }`,
    });
    const channelUniqueName = commentData[0]?.Channel?.uniqueName || "";
    if (!channelUniqueName) {
      throw new GraphQLError(
        "Could not find the forum name attached to the comment."
      );
    }

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
      actionType: "archive",
      actionDescription: "Archived the comment and closed the issue",
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
        isOpen: false, // Close the issue; archival is often the final action.
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
    const commentText = commentData[0]?.text || "";
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
      // Update the comment so that archived=true and the issue is linked
      // to the comment under RelatedIssues.
      const commentUpdateWhere: CommentWhere = {
        id: commentId,
      };
      const commentUpdateInput: CommentUpdateInput = {
        // archived: true,
        RelatedIssues: [
          {
            connect: [
              {
                where: {
                  node: {
                    id: issueId,
                  },
                },
              },
            ],
          },
        ],
      };
      const commentUpdateData = await Comment.update({
        where: commentUpdateWhere,
        update: commentUpdateInput,
      });
      const commentUpdateId = commentUpdateData.comments[0]?.id || null;
      if (!commentUpdateId) {
        throw new GraphQLError("Error updating comment");
      }
      return issueData;
    } catch (error) {
      console.log("Error creating issue", error);
      return false;
    }
  };
};

export default getResolver;
