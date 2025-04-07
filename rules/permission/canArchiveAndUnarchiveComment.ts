import { checkChannelModPermissions } from "./hasChannelModPermission.js";
import { ModChannelPermission } from "./hasChannelModPermission.js";
import { rule } from "graphql-shield";

export interface CanArchiveAndUnarchiveCommentArgs {
  channelUniqueName?: string;
  issueId?: string;
  commentId?: string;
}

export const canArchiveAndUnarchiveComment = rule({ cache: "contextual" })(
  async (parent: any, args: CanArchiveAndUnarchiveCommentArgs, context: any, info: any) => {
    let channelUniqueName = args.channelUniqueName;
    const issueId = args.issueId;
    const commentId = args.commentId;
    
    // If channelUniqueName is not provided, look it up from the issue
    if (!channelUniqueName) {
      if (issueId) {
        const Issue = context.ogm.model("Issue");
        const issue = await Issue.find({
          where: { id: issueId },
          selectionSet: `{ 
            channelUniqueName
          }`,
        });

        if (!issue || !issue[0]) {
          return new Error("Could not find the issue or its associated channel.");
        }

        channelUniqueName = issue[0].channelUniqueName;
      }
      if (commentId) {
        const Comment = context.ogm.model("Comment");
        const comment = await Comment.find({
          where: { id: commentId },
          selectionSet: `{ 
            Channel {
              uniqueName
            }
          }`,
        });

        if (!comment || !comment[0]) {
          return new Error("Could not find the comment or its associated channel.");
        }

        channelUniqueName = comment[0].Channel?.uniqueName;
      }
    }

    if (!channelUniqueName) {
      return new Error("No channel specified for this operation.");
    }
    
    // Check if the user has the required permission in the specified channel
    const permissionResult = await checkChannelModPermissions({
        channelConnections: [channelUniqueName],
        context,
        permissionCheck: ModChannelPermission.canHideComment
    });
    
    // If the user does not have the required permission, return an error
    if (permissionResult instanceof Error) {
        return permissionResult;
    }
    
    // If the user has the required permission, return true
    return true;
}
);
