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
  const { 
    Issue, 
    Channel,
    Comment,
    Event,
    Discussion
  } = input;
  return createSuspensionResolver({
    Issue,
    Channel,
    Comment,
    Event,
    Discussion,
    issueRelatedAccountField: "relatedModProfileName",
    channelSuspendedField: "SuspendedMods",
    suspendedEntityName: "mod",
    suspensionCommentText: "The mod has been suspended.",
  });
}
