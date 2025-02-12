import type { IssueModel, ChannelModel, EventModel, DiscussionModel, CommentModel } from "../../ogm_types.js";
import { createSuspensionResolver } from "./shared/createSuspensionResolver.js";

type Input = {
  Issue: IssueModel;
  Channel: ChannelModel;
  Event: EventModel;
  Comment: CommentModel;
  Discussion: DiscussionModel;
};

export default function getResolver(input: Input) {
  const { Issue, Channel, Event, Comment, Discussion } = input;
  return createSuspensionResolver({
    Issue,
    Channel,
    Event,
    Comment,
    Discussion,
    issueRelatedAccountField: "relatedUsername",
    channelSuspendedField: "SuspendedUsers",
    suspendedEntityName: "user",
    suspensionCommentText: "The user has been suspended.",
    suspensionActionDescription: "Suspended the user",
  });
}
