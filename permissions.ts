import { and, shield, allow, deny, or } from "graphql-shield";
import rules from "./rules/rules.js";

const permissionList = shield({
    Query: {
      "*": allow,
      emails: allow// rules.isAdmin,
    },
    Mutation: {
      "*": deny,
      createServerRoles: allow, // will later restrict to admins
      createChannelRoles: allow, // will later restrict to admins or channel owners
      createModServerRoles: allow, // will later restrict to admins
      createServerConfigs: allow, // will later restrict to admins
      updateServerConfigs: allow, // will later restrict to admins
      deleteChannelRoles: allow, // will later restrict to admins or channel owners
      deleteServerRoles: allow, // will later restrict to admins

      createEmailAndUser: allow,

      // will prevent users from making themselves admins or moderators but allow other fields to be updated by account owner
      updateUsers: or(rules.isAccountOwner, rules.isAdmin),
      
      createChannels: and(rules.createChannelInputIsValid, rules.canCreateChannel),
      updateChannels: and(rules.updateChannelInputIsValid, or(rules.isChannelOwner, rules.isAdmin)),
      deleteChannels: or(rules.isChannelOwner, rules.isAdmin),

      deleteEmails: or(rules.isAccountOwner, rules.isAdmin),
      deleteUsers: or(rules.isAccountOwner, rules.isAdmin),
    
      createDiscussionWithChannelConnections:  and(rules.createDiscussionInputIsValid, or(rules.canCreateDiscussion, rules.isAdmin)),
      updateDiscussionWithChannelConnections:  and(rules.updateDiscussionInputIsValid, or(rules.isDiscussionOwner, rules.isAdmin)),
      deleteDiscussions: or(rules.isDiscussionOwner, rules.isAdmin),
      
      createEventWithChannelConnections: and(rules.createEventInputIsValid, rules.canCreateEvent),
      updateEventWithChannelConnections: and(rules.updateEventInputIsValid, or(rules.isEventOwner, rules.isAdmin)),
      deleteEvents: or(rules.isEventOwner, rules.isAdmin),
      updateEvents: or(rules.isEventOwner, rules.isAdmin),

      createComments: and(rules.createCommentInputIsValid,rules.canCreateComment),
      updateComments: and(rules.updateCommentInputIsValid, or(rules.isCommentAuthor, rules.isAdmin)),
      deleteComments: or(rules.isCommentAuthor, rules.isAdmin),
      
      createSignedStorageURL: rules.canUploadFile,
      addEmojiToComment: rules.canUpvoteComment,
      removeEmojiFromComment: rules.canUpvoteComment,
      addEmojiToDiscussionChannel: rules.canUpvoteDiscussion,
      removeEmojiFromDiscussionChannel: rules.canUpvoteDiscussion,
      upvoteComment: rules.canUpvoteComment,
      undoUpvoteComment: rules.canUpvoteComment, // We are intentionally reusing the same rule for undoing an upvote as for upvoting.
      // Any user who can upvote a comment can undo their upvote. The undo upvote resolver 
      // checks if the user has upvoted the comment and if so, removes the upvote.

      updateDiscussionChannels: rules.canGiveFeedback, // Need to check the update input to make sure the user is not trying to change the channel name or unique name.
      upvoteDiscussionChannel: rules.canUpvoteDiscussion,
      undoUpvoteDiscussionChannel: rules.canUpvoteDiscussion, // We are intentionally reusing the same rule for undoing an upvote as for upvoting.
      // Any user who can upvote a discussion can undo their upvote. The undo upvote resolver
      // checks if the user has upvoted the discussion and if so, removes the upvote.
      
      createIssues: rules.issueIsValid,
      deleteIssues: allow, // rules.canDeleteIssues,
      updateIssues: allow, // rules.canUpdateIssues,

      createAlbums: allow,
      updateAlbums: allow,
      deleteAlbums: allow,
      // hideComments: updateComments: and(rules.verifiedEmail, or(rules.hasChannelModPermission("hideComments"), rules.isAdmin)),
      // canOpenChannelSupportTicket: and(rules.verifiedEmail, rules.isNotSuspendedFromServer),
      // canCloseChannelSupportTicket: and(rules.verifiedEmail, rules.isChannelModerator, rules.isNotSuspendedFromServer),
      // canOpenServerSupportTicket: rules.verifiedEmail,
      // canCloseServerSupportTicket: and(rules.verifiedEmail, rules.isServerModerator, rules.isNotSuspendedFromServer),
    },
  },{
    debug: true,
    allowExternalErrors: true
  });
  
  
  export default permissionList;
  