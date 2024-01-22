export const ERROR_MESSAGES = {
  generic: {
    noPermission: "You do not have permission to do that.",
  },
  server: {
    noServerPermission: "You don't have permission to do that.",
  },
  discussion: {
    noId: "You must provide a discussion id.",
    noAuthor: "Could not find the author of this discussion.",
    notOwner: "You must be the author of this discussion to do that.",
    noUpdatePermission: "You do not have permission to update this discussion.",
  },
  event: {
    noId: "You must provide an event id.",
    notFound: "Event not found.",
    noOwner: "Could not find the owner of this event.",
    notOwner: "You must be the owner of this event to do that.",
    noUpdatePermission: "You do not have permission to update this event.",
  },
  comment: {
    noId: "You must provide a comment id.",
    notFound: "Comment not found.",
    noOwner: "Could not find the author of this comment.",
    notOwner: "You must be the author of this comment to do that.",
    noUpdatePermission: "You do not have permission to update this comment.",
  },
  channel: {
    notFound: "Channel not found.",
    notAuthenticated: "You must be logged in to do that.",
    notVerified: "You must verify your email address to do that.",
    notOwner: "You must be the owner of this channel to do that.",
    noChannelPermission: "You do not have permission to create channels.",
  },
  user: {
    noUsername: "You must provide a username.",
    notOwner: "You must be the owner of this account to do that.",
  }
};

