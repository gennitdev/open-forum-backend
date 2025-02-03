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

type ModActionInput = {
  text: string;
  loggedInModName: string;
  channelUniqueName: string;
  actionType: string;
  actionDescription: string;
  issueId: string;
};

export const getModerationActionCreateInput = (input: ModActionInput) => {
  const {
    text,
    loggedInModName,
    channelUniqueName,
    actionType,
    actionDescription,
    issueId,
  } = input;

  return {
    ModerationProfile: {
      connect: {
        where: {
          node: {
            displayName: loggedInModName,
          },
        },
      },
    },
    actionType,
    actionDescription,
    Comment: {
      create: {
        node: {
          text,
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
            // Important for making user profile's permalinks work
            connect: {
              where: {
                node: {
                  uniqueName: channelUniqueName,
                },
              },
            },
          },
          Issue: {
            // Important for making user profile's permalinks work
            connect: {
              where: {
                node: {
                  id: issueId,
                },
              },
            },
          },
        },
      },
    },
  };
};

type InputIssueCreate = {
  contextText: string;
  selectedForumRules: string[];
  selectedServerRules: string[];
  loggedInModName: string;
  channelUniqueName: string;
  reportedContentType: "comment" | "discussion" | "event";
  relatedCommentId?: string;
  relatedDiscussionId?: string;
  relatedEventId?: string;
};

export const getIssueCreateInput = (
  input: InputIssueCreate
): IssueCreateInput => {
  const {
    contextText,
    selectedServerRules,
    loggedInModName,
    channelUniqueName,
    reportedContentType,
    relatedCommentId,
    relatedDiscussionId,
    relatedEventId,
  } = input;

  if (reportedContentType === "comment" && !relatedCommentId) {
    throw new GraphQLError("Comment ID is required");
  }
  if (reportedContentType === "discussion" && !relatedDiscussionId) {
    throw new GraphQLError("Discussion ID is required");
  }
  if (reportedContentType === "event" && !relatedEventId) {
    throw new GraphQLError("Event ID is required");
  }

  const truncatedContextText = contextText?.substring(0, 50) || "";
  const output: IssueCreateInput = {
    title: `[Reported ${reportedContentType}] "${truncatedContextText}${
      contextText.length > 50 ? "..." : ""
    }"`,
    isOpen: true,
    authorName: loggedInModName,
    flaggedServerRuleViolation: selectedServerRules.length > 0,
    channelUniqueName: channelUniqueName,
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
  switch (reportedContentType) {
    case "comment":
      output.relatedCommentId = relatedCommentId;
      break;
    case "discussion":
      output.relatedDiscussionId = relatedDiscussionId;
      break;
    case "event":
      output.relatedEventId = relatedEventId;
      break;
  }
  return output;
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

    // If an issue does NOT already exist, create a new issue.
    if (!existingIssueId) {
      const commentData = await Comment.find({
        where: {
          id: commentId,
        },
        selectionSet: `{
                id
                text            
            }`,
      });
      const commentText = commentData[0]?.text || "";

      const issueCreateInput: IssueCreateInput = getIssueCreateInput({
        contextText: commentText,
        selectedForumRules,
        selectedServerRules,
        loggedInModName,
        channelUniqueName,
        reportedContentType: "comment",
        relatedCommentId: commentId,
      });
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
    const moderationActionCreateInput: ModerationActionCreateInput =
      getModerationActionCreateInput({
        text: finalCommentText,
        loggedInModName,
        channelUniqueName,
        actionType: "report",
        actionDescription: "Reported the comment",
        issueId: existingIssueId,
      });

    // Update the issue with the new moderation action.
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
      if (!issueId) {
        throw new GraphQLError("Error updating issue");
      }
      return issueData.issues[0];
    } catch (error) {
      throw new GraphQLError("Error updating issue");
    }
  };
};

export default getResolver;
