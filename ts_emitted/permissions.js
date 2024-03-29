import { shield, allow, deny, and, or } from "graphql-shield";
import rules from "./rules/rules.js";
const permissionList = shield({
    Query: {
        "*": allow,
    },
    Mutation: {
        "*": deny,
        createServerRoles: allow, // will later restrict to admins
        createServerConfigs: allow, // will later restrict to admins
        updateServerConfigs: allow, // will later restrict to admins
        createUsers: allow,
        // will prevent users from making themselves admins or moderators but allow other fields to be updated by account owner
        updateUsers: and(rules.isAuthenticatedAndVerified, or(rules.isAccountOwner, rules.isAdmin)),
        createChannels: rules.canCreateChannel,
        updateChannels: or(rules.isChannelOwner, rules.isAdmin),
        deleteChannels: or(rules.isChannelOwner, rules.isAdmin),
        createDiscussionWithChannelConnections: or(rules.canCreateDiscussion, rules.isAdmin),
        updateDiscussionWithChannelConnections: or(rules.isDiscussionOwner, rules.isAdmin),
        deleteDiscussions: or(rules.isDiscussionOwner, rules.isAdmin),
        createEventWithChannelConnections: rules.canCreateEvent,
        updateEventWithChannelConnections: or(rules.isEventOwner, rules.isAdmin),
        deleteEvents: or(rules.isEventOwner, rules.isAdmin),
        createComments: rules.canCreateComment,
        updateComments: or(rules.isCommentAuthor, rules.isAdmin),
        deleteComments: or(rules.isCommentAuthor, rules.isAdmin),
        // uploadFile: and(rules.verifiedEmail, rules.hasChannelPermission("uploadFile"), rules.hasServerPermissions("uploadFile")),
        // upvoteComment: and(rules.verifiedEmail, rules.hasChannelPermission("upvoteComment")),
        // upvoteDiscussion: and(rules.verifiedEmail, rules.hasChannelPermission("upvoteDiscussion")),
        // downvoteComment: and(rules.verifiedEmail, rules.hasChannelPermission("downvoteComment")),
        // downvoteDiscussion: and(rules.verifiedEmail, rules.hasChannelPermission("downvoteDiscussion")),
        // voteWithEmoji: and(rules.verifiedEmail, rules.hasChannelPermission("canVoteWithEmoji")),
        // MOD PERMISSIONS
        // hideComments: updateComments: and(rules.verifiedEmail, or(rules.hasChannelModPermission("hideComments"), rules.isAdmin)),
        // the rest need updating to the format "hasChannelPermissions" for things that can be suspended or revoked in fine grained roles.
        // canGiveFeedback: and(rules.verifiedEmail, rules.isNotSuspendedFromChannel, rules.isNotSuspendedFromServer),
        // canOpenChannelSupportTicket: and(rules.verifiedEmail, rules.isNotSuspendedFromServer),
        // canCloseChannelSupportTicket: and(rules.verifiedEmail, rules.isChannelModerator, rules.isNotSuspendedFromServer),
        // canOpenServerSupportTicket: rules.verifiedEmail,
        // canCloseServerSupportTicket: and(rules.verifiedEmail, rules.isServerModerator, rules.isNotSuspendedFromServer),
        // canReportContent: and(rules.verifiedEmail, rules.isNotSuspendedFromChannel, rules.isNotSuspendedFromServer)
    },
});
export default permissionList;
