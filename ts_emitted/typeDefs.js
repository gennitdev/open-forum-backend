import { gql } from "apollo-server";
const typeDefinitions = gql `
  scalar JSON

  union IssueCommentAuthor = User | ModerationProfile
  union CommentAuthor = User | ModerationProfile
  union IssueAuthor = User | ModerationProfile

  type Channel {
    description: String
    displayName: String
    uniqueName: String! @unique
    createdAt: DateTime! @timestamp(operations: [CREATE])
    locked: Boolean
    deleted: Boolean
    channelIconURL: String
    channelBannerURL: String
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    # WikiPages:                [WikiPage]             @relationship(type: "HAS_WIKI_PAGE", direction: OUT)
    Rules: [Rule!]! @relationship(type: "HAS_RULE", direction: OUT)
    Admins: [User!]! @relationship(type: "ADMIN_OF_CHANNEL", direction: IN)
    Moderators: [ModerationProfile!]!
      @relationship(type: "MODERATOR_OF_CHANNEL", direction: IN)
    RelatedChannels: [Channel!]!
      @relationship(type: "RELATED_CHANNEL", direction: OUT)
    EventChannels: [EventChannel!]!
      @relationship(type: "POSTED_IN_CHANNEL", direction: IN)
    DiscussionChannels: [DiscussionChannel!]!
      @relationship(type: "POSTED_IN_CHANNEL", direction: IN)
    Comments: [Comment!]! @relationship(type: "HAS_COMMENT", direction: OUT) # used for aggregated comment counts
    DefaultChannelRole: ChannelRole @relationship(type: "HAS_DEFAULT_CHANNEL_ROLE", direction: OUT)
    Issues: [Issue!]! @relationship(type: "HAS_ISSUE", direction: OUT)
  }

  type DiscussionChannel {
    id: ID! @id
    locked: Boolean
    discussionId: ID! # used for uniqueness constraint
    channelUniqueName: String! # used for uniqueness constraint
    createdAt: DateTime! @timestamp(operations: [CREATE])
    weightedVotesCount: Float
    Discussion: Discussion
      @relationship(type: "POSTED_IN_CHANNEL", direction: OUT)
    Channel: Channel @relationship(type: "POSTED_IN_CHANNEL", direction: OUT)
    UpvotedByUsers: [User!]!
      @relationship(type: "UPVOTED_DISCUSSION", direction: OUT)
    DownvotedByModerators: [ModerationProfile!]!
      @relationship(type: "DOWNVOTED_DISCUSSION", direction: OUT)
    Comments: [Comment!]!
      @relationship(type: "CONTAINS_COMMENT", direction: OUT)
    emoji: JSON
  }

  type Discussion {
    id: ID! @id
    Author: User @relationship(type: "POSTED_DISCUSSION", direction: IN)
    body: String
    title: String!
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime @timestamp(operations: [UPDATE])
    deleted: Boolean
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    # PastVersions:            [DiscussionVersion]     @relationship(type: "HAS_VERSION", direction: OUT)
    DiscussionChannels: [DiscussionChannel!]!
      @relationship(type: "POSTED_IN_CHANNEL", direction: IN)
    FeedbackComments: [Comment!]! @relationship(type: "HAS_FEEDBACK_COMMENT", direction: IN)
    RelatedIssues: [Issue!]! @relationship(type: "CITED_ISSUE", direction: IN)
  }

  type EventChannel {
    id: ID! @id
    locked: Boolean
    eventId: ID! # used for uniqueness constraint
    channelUniqueName: String! # used for uniqueness constraint
    createdAt: DateTime! @timestamp(operations: [CREATE])
    Event: Event @relationship(type: "POSTED_IN_CHANNEL", direction: OUT)
    Channel: Channel @relationship(type: "POSTED_IN_CHANNEL", direction: OUT)
    Comments: [Comment!]!
      @relationship(type: "CONTAINS_COMMENT", direction: OUT)
  }

  enum RepeatUnit {
    DAY
    WEEK
    MONTH
    YEAR
  }

  enum RepeatType {
    NEVER
    ON
    AFTER
  }

  type RepeatEvery {
    count: Int
    unit: RepeatUnit
  }

  type RepeatEnds {
    type: String
    count: Int
    unit: RepeatUnit
    until: DateTime
  }

  type RecurringEvent {
    id: ID! @id
    repeatEvery: RepeatEvery
    repeatEnds: RepeatEnds
    Events: [Event!]! @relationship(type: "HAS_RECURRING_EVENT", direction: OUT)
  }

  type Event {
    id: ID! @id
    title: String!
    description: String
    startTime: DateTime!
    startTimeDayOfWeek: String # only used for filtering events by day of week
    startTimeHourOfDay: Int # only used for filtering events by hour of day
    endTime: DateTime!
    locationName: String
    address: String
    virtualEventUrl: String
    updatedAt: DateTime @timestamp(operations: [UPDATE])
    createdAt: DateTime! @timestamp(operations: [CREATE])
    placeId: String
    isInPrivateResidence: Boolean
    cost: String
    free: Boolean
    location: Point
    canceled: Boolean!
    deleted: Boolean
    isHostedByOP: Boolean
    isAllDay: Boolean
    coverImageURL: String
    locked: Boolean
    Comments: [Comment!]!
      @relationship(type: "HAS_COMMENT", direction: OUT)
    RecurringEvent: RecurringEvent
      @relationship(type: "HAS_RECURRING_EVENT", direction: OUT)
    Poster: User @relationship(type: "POSTED_BY", direction: IN)
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    # PastVersions:          [EventVersion]    @relationship(type: "HAS_VERSION", direction: OUT)
    EventChannels: [EventChannel!]!
      @relationship(type: "POSTED_IN_CHANNEL", direction: IN)
    RelatedIssues: [Issue!]! @relationship(type: "CITED_ISSUE", direction: IN)
    FeedbackComments: [Comment!]! @relationship(type: "HAS_FEEDBACK_COMMENT", direction: IN)
  }

  type Comment {
    id: ID! @id
    CommentAuthor: CommentAuthor
      @relationship(type: "AUTHORED_COMMENT", direction: IN)
    DiscussionChannel: DiscussionChannel
      @relationship(type: "CONTAINS_COMMENT", direction: IN)
    Event: Event @relationship(type: "HAS_COMMENT", direction: IN)
    Channel: Channel @relationship(type: "HAS_COMMENT", direction: IN)
    Issue: Issue @relationship(type: "ACTIVITY_ON_ISSUE", direction: IN)
    ParentComment: Comment @relationship(type: "IS_REPLY_TO", direction: OUT)
    text: String
    isRootComment: Boolean!
    ChildComments: [Comment!]! @relationship(type: "IS_REPLY_TO", direction: IN)
    deleted: Boolean
    updatedAt: DateTime @timestamp(operations: [UPDATE])
    createdAt: DateTime! @timestamp(operations: [CREATE])
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    weightedVotesCount: Float
    UpvotedByUsers: [User!]!
      @relationship(type: "UPVOTED_COMMENT", direction: IN)
    DownvotedByModerators: [ModerationProfile!]!
      @relationship(type: "DOWNVOTED_COMMENT", direction: IN)
    # PastVersions:            [CommentVersion]        @relationship(type: "HAS_VERSION", direction: OUT)
    emoji: JSON
    GivesFeedbackOnDiscussion: Discussion @relationship(type: "HAS_FEEDBACK_COMMENT", direction: OUT)
    GivesFeedbackOnEvent: Event @relationship(type: "HAS_FEEDBACK_COMMENT", direction: OUT)
    GivesFeedbackOnComment: Comment @relationship(type: "HAS_FEEDBACK_COMMENT", direction: OUT)
    FeedbackComments: [Comment!]! @relationship(type: "HAS_FEEDBACK_COMMENT", direction: IN)
  }

  type Emoji {
    id: ID! @id
    name: String! @unique
    PostedByUser: User @relationship(type: "POSTED_EMOJI", direction: IN)
    createdAt: DateTime! @timestamp(operations: [CREATE])
  }

  type Rule {
    summary: String
    description: String
  }

  type Email {
    address: String! @unique
    User: User @relationship(type: "HAS_EMAIL", direction: OUT)
  }

  type User {
    username: String! @unique
    Email: Email @relationship(type: "HAS_EMAIL", direction: IN)
    displayName: String
    pronouns: String
    location: String
    bio: String
    commentKarma: Int
    discussionKarma: Int
    profilePicURL: String
    Comments: [Comment!]!
      @relationship(type: "AUTHORED_COMMENT", direction: OUT)
    AdminOfChannels: [Channel!]!
      @relationship(type: "ADMIN_OF_CHANNEL", direction: OUT)
    Discussions: [Discussion!]!
      @relationship(type: "POSTED_DISCUSSION", direction: OUT)
    Events: [Event!]! @relationship(type: "POSTED_BY", direction: OUT)
    # SentMessages:            [Message!]           @relationship(type: "SENT_MESSAGE", direction: OUT)
    # ReceivedMessages:        [Message!]           @relationship(type: "RECEIVED_MESSAGE", direction: OUT)
    Feeds: [Feed!]! @relationship(type: "HAS_FEED_IN_LIBRARY", direction: OUT)
    CreatedFeeds: [Feed!]! @relationship(type: "CREATED_FEED", direction: OUT)
    DefaultFeed: Feed @relationship(type: "DEFAULT_FEED", direction: OUT)
    createdAt: DateTime! @timestamp(operations: [CREATE])
    # WikiChangeProposals:     [WikiChangeProposal] @relationship(type: "AUTHORED_CHANGE_PROPOSAL", direction: OUT)
    # Notifications:           [Notification]       @relationship(type: "HAS_NOTIFICATION", direction: OUT)
    Blocked: User @relationship(type: "BLOCKED", direction: OUT)
    IsBlockedBy: User @relationship(type: "BLOCKED", direction: IN)
    FavoriteChannels: [Channel!]!
      @relationship(type: "FAVORITE_CHANNEL", direction: OUT)
    RecentlyVisitedChannels: [Channel!]!
      @relationship(type: "RECENTLY_VISITED_CHANNEL", direction: OUT)
    UpvotedComments: [Comment!]!
      @relationship(type: "UPVOTED_COMMENT", direction: OUT)
    UpvotedDiscussionChannels: [DiscussionChannel!]!
      @relationship(type: "UPVOTED_DISCUSSION_IN_CHANNEL", direction: OUT)
    ModerationProfile: ModerationProfile
      @relationship(type: "MODERATION_PROFILE", direction: OUT)
    DefaultEmojiSkinTone: String
    NotificationBundleInterval: String
    PreferredTimeZone: String
    Issues: [Issue!]! @relationship(type: "AUTHORED_ISSUE", direction: OUT)
    IssueComments: [Comment!]!
      @relationship(type: "AUTHORED_ISSUE_COMMENT", direction: OUT)
    deleted: Boolean
    ChannelRoles: [ChannelRole!]!
      @relationship(type: "HAS_CHANNEL_ROLE", direction: OUT)
    ServerRoles: [ServerRole!]!
      @relationship(type: "HAS_SERVER_ROLE", direction: OUT)
  }

  type ModerationProfile {
    createdAt: DateTime! @timestamp(operations: [CREATE])
    displayName: String @unique
    User: User @relationship(type: "MODERATION_PROFILE", direction: IN)
    DownvotedComments: [Comment!]!
      @relationship(type: "DOWNVOTED_COMMENT", direction: OUT)
    DownvotedDiscussionChannels: [DiscussionChannel!]!
      @relationship(type: "DOWNVOTED_COMMENT_SECTION", direction: OUT)
    AuthoredIssues: [Issue!]!
      @relationship(type: "AUTHORED_ISSUE", direction: IN)
    AuthoredComments: [Comment!]!
      @relationship(type: "AUTHORED_COMMENT", direction: OUT)
    ModChannelRoles: [ModChannelRole!]!
      @relationship(type: "HAS_MOD_ROLE", direction: OUT)
    ModServerRoles: [ModServerRole!]! @relationship(type: "HAS_MOD_ROLE", direction: OUT)
  }

  type ModerationAction {
    id: ID! @id
    ModerationProfile: ModerationProfile
      @relationship(type: "PERFORMED_MODERATION_ACTION", direction: IN)
    Comment: Comment @relationship(type: "MODERATED_COMMENT", direction: OUT)
    createdAt: DateTime! @timestamp(operations: [CREATE])
    actionType: String
    actionDescription: String
  }

  type Issue {
    id: ID! @id
    channelUniqueName: String
    Channel: Channel @relationship(type: "HAS_ISSUE", direction: IN)
    authorName: String
    Author: IssueAuthor @relationship(type: "AUTHORED_ISSUE", direction: OUT)
    title: String
    body: String
    isOpen: Boolean!
    relatedDiscussionId: ID
    relatedCommentId: ID
    relatedEventId: ID
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime @timestamp(operations: [UPDATE])
    ActivityFeed: [ModerationAction!]!
      @relationship(type: "ACTIVITY_ON_ISSUE", direction: OUT)
  }


  type Feed {
    id: ID! @id
    title: String
    description: String
    Owner: User @relationship(type: "CREATED_FEED", direction: IN)
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    deleted: Boolean
  }

  type Tag {
    text: String! @unique
    Channels: [Channel!]! @relationship(type: "HAS_TAG", direction: IN)
    Discussions: [Discussion!]! @relationship(type: "HAS_TAG", direction: IN)
    Events: [Event!]! @relationship(type: "HAS_TAG", direction: IN)
    Comments: [Comment!]! @relationship(type: "HAS_TAG", direction: IN)
    Feeds: [Feed!]! @relationship(type: "HAS_TAG", direction: IN)
  }

  type SignedURL {
    url: String
  }

  type Mutation {
    addEmojiToComment(
      commentId: ID!
      emojiLabel: String!
      unicode: String!
      username: String!
    ): Comment
    removeEmojiFromComment(
      commentId: ID!
      emojiLabel: String!
      username: String!
    ): Comment
    addEmojiToDiscussionChannel(
      discussionChannelId: ID!
      emojiLabel: String!
      unicode: String!
      username: String!
    ): DiscussionChannel
    removeEmojiFromDiscussionChannel(
      discussionChannelId: ID!
      emojiLabel: String!
      username: String!
    ): DiscussionChannel
    createDiscussionWithChannelConnections(
      discussionCreateInput: DiscussionCreateInput
      channelConnections: [String]
    ): Discussion
    updateDiscussionWithChannelConnections(
      discussionWhere: DiscussionWhere!
      discussionUpdateInput: DiscussionUpdateInput!
      channelConnections: [String!]!
      channelDisconnections: [String]!
    ): Discussion
    createEventWithChannelConnections(
      eventCreateInput: EventCreateInput
      channelConnections: [String]
    ): Event
    updateEventWithChannelConnections(
      eventWhere: EventWhere!
      eventUpdateInput: EventUpdateInput!
      channelConnections: [String!]!
      channelDisconnections: [String]!
    ): Event
    upvoteComment(commentId: ID!, username: String!): Comment
    undoUpvoteComment(commentId: ID!, username: String!): Comment
    upvoteDiscussionChannel(discussionChannelId: ID!, username: String!): DiscussionChannel
    undoUpvoteDiscussionChannel(discussionChannelId: ID!, username: String!): DiscussionChannel
    createSignedStorageURL(filename: String!, contentType: String!): SignedURL
  }

  input SiteWideDiscussionSortOrder {
    weightedVotesCount: String
  }

  enum SortType {
    hot
    new
    top
  }

  enum TimeFrame {
    day
    week
    month
    year
    all
  }
  
  input DiscussionListOptions {
    offset: Int
    limit: Int
    sort: SortType
    timeFrame: TimeFrame
  }

  type SiteWideDiscussionListFormat {
    aggregateDiscussionCount: Int!
    discussions: [Discussion!]!
  }

  type DiscussionChannelListFormat {
    aggregateDiscussionChannelsCount: Int!
    discussionChannels: [DiscussionChannel!]!
  }

  type CommentSectionFormat {
    DiscussionChannel: DiscussionChannel!
    Comments: [Comment!]!
  }

  type EventCommentsFormat {
    Event: Event!
    Comments: [Comment!]!
  }

  type CommentRepliesFormat {
    ChildComments: [Comment!]!
    aggregateChildCommentCount: Int!
  }

  type RedditSubmission {
    subreddit: String!
    title: String!
    createdUTC: Int!
    author: String!
    commentCount: Int!
    text: String!
    mediaMetadata: JSON
    permalink: String!
    thumbnail: String!
    upvoteCount: Int!
    url: String
    preview: JSON
  }

  type SubredditSidebar {
    title: String!
    displayName: String!
    shortDescription: String # 500 characters max
    longDescription: String # 5120 characters max
    allowGalleries: Boolean
    communityIcon: String
    showMediaPreview: Boolean
    bannerImg: String
    allowImages: Boolean
  }

  type ServerRole {
    name: String @unique
    description: String
    canCreateChannel: Boolean
    canCreateDiscussion: Boolean
    canCreateEvent: Boolean
    canCreateComment: Boolean
    canUpvoteDiscussion: Boolean
    canUpvoteComment: Boolean
    canUploadFile: Boolean
    canGiveFeedback: Boolean
  }

  type ChannelRole {
    name: String @unique
    channelUniqueName: String
    description: String
    canCreateDiscussion: Boolean
    canCreateEvent: Boolean
    canCreateComment: Boolean
    canUpvoteDiscussion: Boolean
    canUpvoteComment: Boolean
    canUploadFile: Boolean
    canGiveFeedback: Boolean
    canUpdateChannel: Boolean
  }

  type ModChannelRole {
    name: String @unique
    description: String
    canHideComment: Boolean
    canHideEvent: Boolean
    canHideDiscussion: Boolean
    canGiveFeedback: Boolean
    canOpenSupportTickets: Boolean
    canCloseSupportTickets: Boolean
    canReport: Boolean
  }

  type ModServerRole {
    name: String @unique
    description: String
    canOpenSupportTickets: Boolean
    canLockChannel: Boolean
    canCloseSupportTickets: Boolean
    canGiveFeedback: Boolean
  }

  type ServerConfig {
    serverName: String @unique
    serverDescription: String
    serverIconURL: String
    DefaultChannelRole: ChannelRole @relationship(type: "HAS_DEFAULT_CHANNEL_ROLE", direction: OUT)
    DefaultServerRole: ServerRole! @relationship(type: "HAS_DEFAULT_SERVER_ROLE", direction: OUT)
    DefaultModRole: ModServerRole @relationship(type: "HAS_DEFAULT_MOD_ROLE", direction: OUT)
  }

  type Query {
    getDiscussionsInChannel(
      channelUniqueName: String!
      searchInput: String
      selectedTags: [String]
      options: DiscussionListOptions
    ): DiscussionChannelListFormat
    getSiteWideDiscussionList(
      searchInput: String
      selectedChannels: [String]
      selectedTags: [String]
      options: DiscussionListOptions
    ): SiteWideDiscussionListFormat
    getCommentSection(
      channelUniqueName: String!
      discussionId: ID!
      offset: Int
      limit: Int
      sort: String
    ): CommentSectionFormat
    getEventComments(
      eventId: ID!
      offset: Int
      limit: Int
      sort: SortType
    ): EventCommentsFormat
    getCommentReplies(
      commentId: ID!
      offset: Int
      limit: Int
      sort: SortType
    ): CommentRepliesFormat
    getSubreddit(subredditName: String!, options: JSON): [RedditSubmission]
    getSubredditSidebar(subredditName: String!, options: JSON): SubredditSidebar
  }
`;
export default typeDefinitions;
