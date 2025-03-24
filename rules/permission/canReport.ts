import { checkChannelModPermissions } from "./hasChannelModPermission.js";
import { ModChannelPermission } from "./hasChannelModPermission.js";
import { rule } from "graphql-shield";

export const canReport = rule({ cache: "contextual" })(
  async (parent: any, args: any, context: any, info: any) => {
    let channelUniqueName = args.channelUniqueName;
    const issueId = args.issueId;
    
    console.log('can report');
    console.log("channelUniqueName", channelUniqueName);
    console.log("issueId", issueId);
    
    // If channelUniqueName is not provided, look it up from the issue
    if (!channelUniqueName && issueId) {
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

    if (!channelUniqueName) {
      return new Error("No channel specified for this operation.");
    }
    
    // Check if the user has the required permission in the specified channel
    const permissionResult = await checkChannelModPermissions({
        channelConnections: [channelUniqueName],
        context,
        permissionCheck: ModChannelPermission.canReport
    });
    
    // If the user does not have the required permission, return an error
    if (permissionResult instanceof Error) {
        return permissionResult;
    }
    
    // If the user has the required permission, return true
    return true;
}
);
