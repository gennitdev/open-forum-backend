import { rule } from "graphql-shield";
import { isAuthenticatedAndVerified } from "./rules/userDataHelperFunctions.js";
import { hasServerPermission } from "./rules/hasServerPermission.js";
import { isChannelOwner, isAccountOwner } from "./rules/isOwner.js";
import { hasChannelPermission } from "./rules/hasChannelPermission.js";
import { ChannelPermissionChecks } from "./rules/hasChannelPermission.js";

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
export const canCreateDiscussion = rule({ cache: "contextual" })(async (parent, args, ctx, info) => {
    console.log(" can create discussion rule is running, args are ", args);
    const channelModel = ctx.ogm.model("Channel");
    const channelConnections = args.channelConnections;
    console.log("discussion create input is ", args.discussionCreateInput);
    console.log("channel connections are ", channelConnections);
    for (const channelConnection of channelConnections) {
        const hasPermissionToCreateDiscussions = await hasChannelPermission({
            permission: ChannelPermissionChecks.CREATE_DISCUSSION,
            channelName: channelConnection,
            context: ctx,
            Channel: channelModel,
        });
        if (hasPermissionToCreateDiscussions instanceof Error) {
            console.log("has channel permission returned error", hasPermissionToCreateDiscussions.message);
            console.log("The user does not have permission to create discussions in this channel: ", channelConnection);
            return hasPermissionToCreateDiscussions;
        }
    }
    console.log("passed rule: can create discussion");
    return true;
});
export const canCreateEvent = rule({ cache: "contextual" })(async (parent, args, ctx, info) => {
    console.log(" can create event rule is running, args are ", args);
    const channelModel = ctx.ogm.model("Channel");
    const channelConnections = args.channelConnections;
    console.log("event create input is ", args.eventCreateInput);
    console.log("channel connections are ", channelConnections);
    for (const channelConnection of channelConnections) {
        const hasPermissionToCreateEvents = await hasChannelPermission({
            permission: ChannelPermissionChecks.CREATE_EVENT,
            channelName: channelConnection,
            context: ctx,
            Channel: channelModel,
        });
        if (hasPermissionToCreateEvents instanceof Error) {
            console.log("has channel permission returned error", hasPermissionToCreateEvents.message);
            console.log("The user does not have permission to create evens in this channel: ", channelConnection);
            return hasPermissionToCreateEvents;
        }
    }
    console.log("passed rule: can create event");
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
    canCreateDiscussion,
    canCreateEvent,
    hasChannelPermission,
    isAdmin,
    isAccountOwner,
};
export default ruleList;
