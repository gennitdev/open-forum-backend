import { rule } from "graphql-shield";
import { isAuthenticatedAndVerified } from "./rules/userDataHelperFunctions.js";
import { hasServerPermission } from "./rules/hasServerPermission.js";
import { isChannelOwner, isAccountOwner } from "./rules/isOwner.js";
import { hasChannelPermission } from "./rules/hasChannelPermission.js";
const canCreateChannel = rule({ cache: "contextual" })(async (parent, args, ctx, info) => {
    console.log(" can create channel rule is running ");
    const hasPermissionToCreateChannels = hasServerPermission("createChannel", ctx);
    if (hasPermissionToCreateChannels instanceof Error) {
        console.log("The user does not have permission to create channels.");
        return hasPermissionToCreateChannels;
    }
    console.log("passed rule: can create channel");
    return true;
});
const isAdmin = rule({ cache: "contextual" })(async (parent, args, ctx, info) => {
    const { isAdmin } = ctx.user;
    console.log("passed rule: is admin");
    return isAdmin;
});
const ruleList = {
    isChannelOwner,
    isAuthenticatedAndVerified,
    canCreateChannel,
    hasChannelPermission,
    isAdmin,
    isAccountOwner,
};
export default ruleList;
