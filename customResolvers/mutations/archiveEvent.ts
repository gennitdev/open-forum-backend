import type {
  IssueModel,
  EventModel,
  IssueCreateInput,
  ModerationActionCreateInput,
  IssueWhere,
  IssueUpdateInput,
  EventChannelUpdateInput,
  EventChannelWhere,
  EventChannelModel,
} from "../../ogm_types.js";
import { setUserDataOnContext } from "../../rules/permission/userDataHelperFunctions.js";
import { GraphQLError } from "graphql";
import { getFinalCommentText } from "./reportDiscussion.js";

type Args = {
  eventId: string;
  selectedForumRules: string[];
  selectedServerRules: string[];
  reportText: string;
  channelUniqueName: string;
};

type Input = {
  Issue: IssueModel;
  Event: EventModel;
  EventChannel: EventChannelModel
};

const getResolver = (input: Input) => {
  const { Issue, Event, EventChannel } = input;
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { eventId, selectedForumRules, selectedServerRules, reportText, channelUniqueName } =
      args;

    if (!eventId) {
      throw new GraphQLError("Event ID is required");
    }

    if (!channelUniqueName) {
      throw new GraphQLError(
        "A forum name is required."
      );
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

    const loggedInModName = context.user?.data?.ModerationProfile?.displayName;
    if (!loggedInModName) {
      throw new GraphQLError(`User ${loggedInUsername} is not a moderator`);
    }

    let existingIssueId = "";
    let existingIssueFlaggedServerRuleViolation = false;
    const eventData = await Event.find({
      where: {
        id: eventId,
      },
      selectionSet: `{
            id
            title
        }`,
    });
  

    // Check if an issue already exists for the event ID and channel unique name.
    const issueData = await Issue.find({
      where: {
        channelUniqueName: channelUniqueName,
        relatedEventId: eventId,
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

    const finalEventText = getFinalCommentText({
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
      actionDescription: "Archived the event and closed the issue",
      Comment: {
        create: {
          node: {
            text: finalEventText,
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
        if (!issueId) {
          throw new GraphQLError("Error updating issue");
        }
      } catch (error) {
        throw new GraphQLError("Error updating issue");
      }
    }

    // If an issue does NOT already exist, create a new issue.
    const eventTitle = eventData[0]?.title || "";
    const truncatedEventTitle = eventTitle?.substring(0, 50) || "";

    const issueCreateInput: IssueCreateInput = {
      title: `[Reported Event] "${truncatedEventTitle}${
        truncatedEventTitle.length > 50 ? "..." : ""
      }"`,
      isOpen: true,
      authorName: loggedInModName,
      flaggedServerRuleViolation: selectedServerRules.length > 0,
      channelUniqueName: channelUniqueName,
      relatedEventId: eventId,
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
      // Update the eventChannel so that archived=true and the issue is linked
      // to the event under RelatedIssues.
      // First we need to find the eventChannel that matches the given event ID
      // and channel unique name.
      const eventChannel = await EventChannel.find({
        where: {
          eventId: eventId,
          channelUniqueName: channelUniqueName,
        },
        selectionSet: `{
            id
        }`,
      });
      const eventChannelId = eventChannel[0]?.id || null;
      if (!eventChannelId) {
        throw new GraphQLError("Error finding eventChannel");
      }
      const eventChannelUpdateWhere: EventChannelWhere = {
        id: eventId,
      };
      const eventChannelUpdateInput: EventChannelUpdateInput = {
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
      const eventChannelUpdateData = await EventChannel.update({
        where: eventChannelUpdateWhere,
        update: eventChannelUpdateInput,
      });
      const eventChannelUpdateId = eventChannelUpdateData.eventChannels[0]?.id || null;
      if (!eventChannelUpdateId) {
        throw new GraphQLError("Error updating eventChannel");
      }
      return issueData.issues[0]
    } catch (error) {
      console.log("Error creating issue", error);
      return false;
    }
  };
};

export default getResolver;
