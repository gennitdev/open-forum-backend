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
        createSignedStorageURL: rules.canUploadFile,
        upvoteComment: rules.canUpvoteComment,
        undoUpvoteComment: rules.canUpvoteComment, // We are intentionally reusing the same rule for undoing an upvote as for upvoting.
        // Any user who can upvote a comment can undo their upvote. The undo upvote resolver 
        // checks if the user has upvoted the comment and if so, removes the upvote.
        upvoteDiscussionChannel: rules.canUpvoteDiscussion,
        undoUpvoteDiscussionChannel: rules.canUpvoteDiscussion, // We are intentionally reusing the same rule for undoing an upvote as for upvoting.
        // Any user who can upvote a discussion can undo their upvote. The undo upvote resolver
        // checks if the user has upvoted the discussion and if so, removes the upvote.
        // voteWithEmoji: rules.canVoteWithEmoji,
        // MOD PERMISSIONS
        // downvoteComment: rules.canDownvoteComment,
        // downvoteDiscussion: rules.canDownvoteDiscussion,
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
