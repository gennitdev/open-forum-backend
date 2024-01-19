import { shield, allow, deny, and, or, not } from "graphql-shield";
import rules from "./rules.js";

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
      updateUsers: and(rules.isAuthenticatedAndVerified, or(rules.isAccountOwner, rules.isAdmin)),
      
      createChannels: and(
        rules.isAuthenticatedAndVerified,
        rules.canCreateChannel,
      ),
      updateChannels: and(rules.isAuthenticatedAndVerified, or(rules.isChannelOwner, rules.isAdmin)),
      deleteChannels: and(rules.isAuthenticatedAndVerified, or(rules.isChannelOwner, rules.isAdmin)),
      
      createDiscussions: deny, // create discussion should not be used because
      // discussion creation is handled by createDiscussionWithChannelConnections.
      createDiscussionWithChannelConnections: rules.canCreateDiscussion,
      // updateDiscussions: and(rules.verifiedEmail, or(rules.isDiscussionOwner, rules.isAdmin)),
      // deleteDiscussions: and(rules.verifiedEmail, or(rules.isDiscussionOwner, rules.isAdmin)),
      // updateDiscussionWithChannelConnections
      
      // same for DiscussionChannels
    
      createEvents: deny, // create event should not be used because
      // event creation is handled by createEventWithChannelConnections.

      // updateEvents: and(rules.verifiedEmail, or(rules.isEventOwner, rules.isAdmin)),
      // deleteEvents: and(rules.verifiedEmail, or(rules.isEventOwner, rules.isAdmin)),
      // createEventWithChannelConnections
      // updateEventWithChannelConnections
      // same for EventChannels
  
             // createComment: and(rules.verifiedEmail, rules.hasChannelPermission("createComments"), rules.hasServerPermission("createComments"),
      // updateComments: and(rules.verifiedEmail, or(rules.isCommentAuthor, rules.isAdmin)),
      // deleteComments: and(rules.verifiedEmail, or(rules.isCommentAuthor, rules.isAdmin)),
      // hideComments: updateComments: and(rules.verifiedEmail, or(rules.hasChannelModPermission("hideComments"), rules.isAdmin)),




  
      // uploadFile: and(rules.verifiedEmail, rules.hasChannelPermission("uploadFile"), rules.hasServerPermissions("uploadFile")),
  
      // upvoteComment: and(rules.verifiedEmail, rules.hasChannelPermission("upvoteComment")),
      // upvoteDiscussion: and(rules.verifiedEmail, rules.hasChannelPermission("upvoteDiscussion")),
      // downvoteComment: and(rules.verifiedEmail, rules.hasChannelPermission("downvoteComment")),
      // downvoteDiscussion: and(rules.verifiedEmail, rules.hasChannelPermission("downvoteDiscussion")),
      // voteWithEmoji: and(rules.verifiedEmail, rules.hasChannelPermission("canVoteWithEmoji")),
  
  
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



// make sure all the mutations in custom resolvers have rules
    },
  });
  
  
  export default permissionList;
  