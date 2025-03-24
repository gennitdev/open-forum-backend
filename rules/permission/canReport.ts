import { checkChannelModPermissions } from "./hasChannelModPermission.js";
import { ModChannelPermission } from "./hasChannelModPermission.js";
import { rule } from "graphql-shield";

export const canReport = rule({ cache: "contextual" })(
  async (parent: any, args: any, context: any, info: any) => {
    const channelUniqueName = args.channelUniqueName;
    console.log('can report');
    console.log("channelUniqueName", channelUniqueName);
    
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
