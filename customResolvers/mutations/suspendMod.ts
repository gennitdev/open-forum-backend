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
    issueRelatedAccountField: "relatedModProfileName",
    channelSuspendedField: "SuspendedMods",
    suspendedEntityName: "mod",
    suspensionActionDescription: "Suspended the mod",
    suspensionCommentText: "The mod has been suspended."
  });
}
