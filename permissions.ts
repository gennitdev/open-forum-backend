import { and, shield, allow, deny, or } from "graphql-shield";
import rules from "./rules/rules.js";
import safetyCheck from './customResolvers/queries/safetyCheck';

const permissionList = shield({
    Query: {
      "*": allow,
      emails: allow// rules.isAdmin,
    },
    Mutation: {
      "*": deny,
      createServerRoles: rules.isAdmin,
      createChannelRoles: rules.isAdmin,
      createModServerRoles: rules.isAdmin,
      createServerConfigs: rules.isAdmin,
      updateServerConfigs: rules.isAdmin,
      deleteChannelRoles: or(rules.isAdmin, rules.isChannelOwner),
      deleteServerRoles: rules.isAdmin,
      
      createEmailAndUser: allow,
      updateUsers: or(rules.isAccountOwner, rules.isAdmin),
      
      createChannels: and(rules.createChannelInputIsValid, rules.canCreateChannel),
      updateChannels: and(rules.updateChannelInputIsValid, or(rules.isChannelOwner, rules.isAdmin)),
      deleteChannels: or(rules.isChannelOwner, rules.isAdmin),

      deleteEmails: or(rules.isAccountOwner, rules.isAdmin),
      deleteUsers: or(rules.isAccountOwner, rules.isAdmin),
    
      createDiscussionWithChannelConnections:  and(rules.createDiscussionInputIsValid, or(rules.canCreateDiscussion, rules.isAdmin)),
      updateDiscussionWithChannelConnections:  and(rules.updateDiscussionInputIsValid, or(rules.isDiscussionOwner, rules.isAdmin)),
      deleteDiscussions: or(rules.isDiscussionOwner, rules.isAdmin),
      deleteDiscussionChannels: rules.isAdmin,
      
      createEventWithChannelConnections: and(rules.createEventInputIsValid, rules.canCreateEvent),
      updateEventWithChannelConnections: and(rules.updateEventInputIsValid, or(rules.isEventOwner, rules.isAdmin)),
      deleteEvents: or(rules.isEventOwner, rules.isAdmin),
      updateEvents: or(rules.isEventOwner, rules.isAdmin),
      deleteEventChannels: rules.isAdmin,

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
  