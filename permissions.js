const { shield, allow, deny, and, or, not } = require("graphql-shield");
const rules = require("./rules");
const { ApolloError } = require("apollo-server");

const permissions = shield({
    Query: {
      "*": allow,
    },
    Mutation: {
      "*": deny,
      updateChannels: and(rules.isAuthenticatedAndVerified, or(rules.isChannelOwner, rules.isAdmin)),
      deleteChannels: and(rules.isAuthenticatedAndVerified, or(rules.isChannelOwner, rules.isAdmin)),
      createChannels: and(
        rules.isAuthenticatedAndVerified
        rules.hasServerPermission,
      )
  
      // updateEvents: and(rules.verifiedEmail, or(rules.isEventOwner, rules.isAdmin)),
      // deleteEvents: and(rules.verifiedEmail, or(rules.isEventOwner, rules.isAdmin)),
      // createEvents: and(rules.verifiedEmail, rules.hasChannelPermission("createEvents"), rules.hasServerPermission("createEvents"),
      // same for EventChannels
  
      // updateDiscussions: and(rules.verifiedEmail, or(rules.isDiscussionOwner, rules.isAdmin)),
      // deleteDiscussions: and(rules.verifiedEmail, or(rules.isDiscussionOwner, rules.isAdmin)),
      // createDiscussions: and(rules.verifiedEmail, rules.hasChannelPermission("createDiscussions"), rules.hasServerPermission("createDiscussions"),
      // same for EventChannels
    
  
      // uploadFile: and(rules.verifiedEmail, rules.hasChannelPermission("uploadFile"), rules.hasServerPermissions("uploadFile")),
  
      // upvoteComment: and(rules.verifiedEmail, rules.hasChannelPermission("upvoteComment")),
      // upvoteDiscussion: and(rules.verifiedEmail, rules.hasChannelPermission("upvoteDiscussion")),
      // downvoteComment: and(rules.verifiedEmail, rules.hasChannelPermission("downvoteComment")),
      // downvoteDiscussion: and(rules.verifiedEmail, rules.hasChannelPermission("downvoteDiscussion")),
      // voteWithEmoji: and(rules.verifiedEmail, rules.hasChannelPermission("canVoteWithEmoji")),
  
      // updateComments: and(rules.verifiedEmail, or(rules.isCommentAuthor, rules.isAdmin)),
      // deleteComments: and(rules.verifiedEmail, or(rules.isCommentAuthor, rules.isAdmin)),
      // hideComments: updateComments: and(rules.verifiedEmail, or(rules.hasChannelModPermission("hideComments"), rules.isAdmin)),
      // createComment: and(rules.verifiedEmail, rules.hasChannelPermission("createComments"), rules.hasServerPermission("createComments"),
  
  // the rest need updating to the format "hasChannelPermissions" for things that can be suspended or revoked in fine grained roles.
      // canGiveFeedback: and(rules.verifiedEmail, rules.isNotSuspendedFromChannel, rules.isNotSuspendedFromServer),
      // canOpenChannelSupportTicket: and(rules.verifiedEmail, rules.isNotSuspendedFromServer),
      // canCloseChannelSupportTicket: and(rules.verifiedEmail, rules.isChannelModerator, rules.isNotSuspendedFromServer),
      // canOpenServerSupportTicket: rules.verifiedEmail,
      // canCloseServerSupportTicket: and(rules.verifiedEmail, rules.isServerModerator, rules.isNotSuspendedFromServer),
      // canReportContent: and(rules.verifiedEmail, rules.isNotSuspendedFromChannel, rules.isNotSuspendedFromServer)
   
  
      // createUser // require email to not be suspended from server
      // updateUser // prevent users from making themselves admins or moderators but allow other fields to be updated by account owner
      // createEmoji // require email to not be suspended from server
      
     // for add and remove emoji from comment, allow it if they are not suspended from the channel, even if they are not the author of the comment
  
      // to create a server role you must be an admin
  
           // same rules for Events and RecurringEvents
    },
  });
  
  
  module.exports = permissions;
  