import { and, shield, allow, deny, or } from "graphql-shield";
import rules from "./rules/rules.js";

const {
  isAdmin,
  isAccountOwner,
  isChannelOwner,
  isDiscussionOwner,
  isEventOwner,
  isCommentAuthor,
  isDiscussionChannelOwner,
  canCreateChannel,
  canCreateDiscussion,
  canCreateEvent,
  canCreateComment,
  canUploadFile,
  canUpvoteComment,
  canUpvoteDiscussion,
  issueIsValid,
  createChannelInputIsValid,
  updateChannelInputIsValid,
  createDiscussionInputIsValid,
  updateDiscussionInputIsValid,
  createEventInputIsValid,
  updateEventInputIsValid,
  createCommentInputIsValid,
  updateCommentInputIsValid,
  canReport,
  canSuspendAndUnsuspendUser,
  canArchiveAndUnarchiveComment,
  canArchiveAndUnarchiveDiscussion,
  canArchiveAndUnarchiveEvent,
} = rules;

const permissionList = shield({
    Query: {
      "*": allow,
      emails: allow// isAdmin,
    },
    Mutation: {
      "*": deny,
      dropDataForCypressTests: isAdmin,
      seedDataForCypressTests: isAdmin,
      createTags: allow,
      
      createChannelRoles: isAdmin,
      createModChannelRoles: isAdmin,

      createModServerRoles: isAdmin,
      createServerRoles: isAdmin,
      createServerConfigs: isAdmin,
      deleteServerConfigs: isAdmin,

      updateServerConfigs: isAdmin,
      updateModServerRoles: isAdmin,
      deleteChannelRoles: or(isAdmin, isChannelOwner),
      deleteServerRoles: isAdmin,
      
      createEmailAndUser: allow,
      updateUsers: or(isAccountOwner, isAdmin),
      
      createChannels: and(createChannelInputIsValid, canCreateChannel),
      updateChannels: and(updateChannelInputIsValid, or(isChannelOwner, isAdmin)),
      deleteChannels: or(isAdmin, isChannelOwner),

      deleteEmails: or(isAccountOwner, isAdmin),
      deleteUsers: or(isAdmin, isAccountOwner),
    
      createDiscussionWithChannelConnections:  and(createDiscussionInputIsValid, or(canCreateDiscussion, isAdmin)),
      updateDiscussionWithChannelConnections:  and(updateDiscussionInputIsValid, or(isDiscussionOwner, isAdmin)),
      deleteDiscussions: or(isAdmin, isDiscussionOwner),
      updateDiscussions: or(isAdmin, isDiscussionOwner),
      deleteDiscussionChannels: isAdmin,
      updateDiscussionChannels: or(isAdmin, isDiscussionChannelOwner),
      
      createEventWithChannelConnections: and(createEventInputIsValid, canCreateEvent),
      updateEventWithChannelConnections: and(updateEventInputIsValid, or(isEventOwner, isAdmin)),
      deleteEvents: or(isAdmin, isEventOwner),
      deleteEventChannels: isAdmin,

      createComments: and(createCommentInputIsValid,canCreateComment),
      updateComments: and(updateCommentInputIsValid, or(isCommentAuthor, isAdmin)),
      deleteComments: or(isAdmin, isCommentAuthor),
      
      createSignedStorageURL: canUploadFile,
      addEmojiToComment: canUpvoteComment,
      removeEmojiFromComment: canUpvoteComment,
      addEmojiToDiscussionChannel: canUpvoteDiscussion,
      removeEmojiFromDiscussionChannel: canUpvoteDiscussion,
      upvoteComment: canUpvoteComment,
      undoUpvoteComment: canUpvoteComment, // We are intentionally reusing the same rule for undoing an upvote as for upvoting.
      // Any user who can upvote a comment can undo their upvote. The undo upvote resolver 
      // checks if the user has upvoted the comment and if so, removes the upvote.

      upvoteDiscussionChannel: canUpvoteDiscussion,
      undoUpvoteDiscussionChannel: canUpvoteDiscussion, // We are intentionally reusing the same rule for undoing an upvote as for upvoting.
      // Any user who can upvote a discussion can undo their upvote. The undo upvote resolver
      // checks if the user has upvoted the discussion and if so, removes the upvote.
      
      createIssues: issueIsValid,
      deleteIssues: allow, // canDeleteIssues,
      updateIssues: allow, // canUpdateIssues,

      createAlbums: allow,
      updateAlbums: allow,
      deleteAlbums: allow,

      inviteForumOwner: isChannelOwner,
      cancelInviteForumOwner: isChannelOwner,
      removeForumOwner: isChannelOwner,
      acceptForumOwnerInvite: allow,
      inviteForumMod: isChannelOwner,
      cancelInviteForumMod: isChannelOwner,
      removeForumMod: isChannelOwner,
      acceptForumModInvite: allow,

      createNotifications: deny,
      deleteNotifications: deny,
      updateNotifications: deny,

      reportDiscussion: canReport,
      reportComment: canReport,
      reportEvent: canReport,
      suspendMod: canSuspendAndUnsuspendUser,
      suspendUser: canSuspendAndUnsuspendUser,
      unsuspendMod: canSuspendAndUnsuspendUser,
      unsuspendUser: canSuspendAndUnsuspendUser,
      archiveComment: canArchiveAndUnarchiveComment,
      archiveDiscussion: canArchiveAndUnarchiveDiscussion,
      archiveEvent: canArchiveAndUnarchiveEvent,
      unarchiveComment: canArchiveAndUnarchiveComment,
      unarchiveDiscussion: canArchiveAndUnarchiveDiscussion,
      unarchiveEvent: canArchiveAndUnarchiveEvent,
    },
  },{
    debug: true,
    allowExternalErrors: true
  });
  
  
  export default permissionList;
  