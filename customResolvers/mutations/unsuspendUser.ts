import type { IssueModel, ChannelModel } from "../../ogm_types.js";
import { createUnsuspendResolver } from "./shared/createUnsuspendResolver.js";

type Input = {
  Issue: IssueModel;
  Channel: ChannelModel;
};

export default function getResolver(input: Input) {
  const { Issue, Channel } = input;
  return createUnsuspendResolver({
    Issue,
    Channel,
    issueRelatedAccountField: "relatedUsername",
    channelSuspendedField: "SuspendedUsers",
    suspendedEntityName: "user",
    suspensionActionDescription: "Uns-suspended the user",
    suspensionCommentText: "The user has been un-suspended."
  });
}
