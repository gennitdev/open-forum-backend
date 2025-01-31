import type { IssueModel, ChannelModel } from "../../ogm_types.js";
import { createSuspensionResolver } from "./shared/createSuspensionResolver.js";

type Input = {
  Issue: IssueModel;
  Channel: ChannelModel;
};

export default function getResolver(input: Input) {
  const { Issue, Channel } = input;
  return createSuspensionResolver({
    Issue,
    Channel,
    issueRelatedAccountField: "relatedUsername",
    channelSuspendedField: "SuspendedUsers",
    suspendedEntityName: "user",
    suspensionActionDescription: "Suspended the user",
    suspensionCommentText: "The user has been suspended."
  });
}
