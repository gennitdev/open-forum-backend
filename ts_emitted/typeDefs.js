import { gql } from "apollo-server";
const typeDefinitions = gql `
  scalar JSON

  union IssueCommentAuthor = User | ModerationProfile
  union CommentAuthor = User | ModerationProfile
  union IssueAuthor = User | ModerationProfile

  input RuleInput {
    summary: String!
    detail: String!
  }

  type Image {
    id: ID! @id
    url: String
    alt: String
    caption: String
    copyright: String
    Album: Album @relationship(type: "HAS_IMAGE", direction: IN)
  }

  type Album {
    id: ID! @id
    Owner: User @relationship(type: "HAS_ALBUM", direction: IN)
    Images: [Image!]! @relationship(type: "HAS_IMAGE", direction: OUT)
    Discussions: [Discussion!]! @relationship(type: "HAS_ALBUM", direction: IN)
  }

  type User {
    Albums: [Album!]! @relationship(type: "HAS_ALBUM", direction: OUT)
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
    rules: JSON
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
    DefaultChannelRole: ChannelRole
      @relationship(type: "HAS_DEFAULT_CHANNEL_ROLE", direction: OUT)
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
      @relationship(type: "UPVOTED_DISCUSSION", direction: IN)
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
    FeedbackComments: [Comment!]!
      @relationship(type: "HAS_FEEDBACK_COMMENT", direction: IN)
    RelatedIssues: [Issue!]! @relationship(type: "CITED_ISSUE", direction: IN)
    Album: Album @relationship(type: "HAS_ALBUM", direction: OUT)
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
    Comments: [Comment!]! @relationship(type: "HAS_COMMENT", direction: OUT)
    RecurringEvent: RecurringEvent
      @relationship(type: "HAS_RECURRING_EVENT", direction: OUT)
    Poster: User @relationship(type: "POSTED_BY", direction: IN)
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    # PastVersions:          [EventVersion]    @relationship(type: "HAS_VERSION", direction: OUT)
    EventChannels: [EventChannel!]!
      @relationship(type: "POSTED_IN_CHANNEL", direction: IN)
    RelatedIssues: [Issue!]! @relationship(type: "CITED_ISSUE", direction: IN)
    FeedbackComments: [Comment!]!
      @relationship(type: "HAS_FEEDBACK_COMMENT", direction: IN)
  }

  type Comment {
    id: ID! @id
    CommentAuthor: CommentAuthor
      @relationship(type: "AUTHORED_COMMENT", direction: IN)
    DiscussionChannel: DiscussionChannel
      @relationship(type: "CONTAINS_COMMENT", direction: IN)
    Event: Event @relationship(type: "HAS_COMMENT", direction: IN)
    Channel: Channel @relationship(type: "HAS_COMMENT", direction: IN)
    ParentComment: Comment @relationship(type: "IS_REPLY_TO", direction: OUT)
    text: String
    isRootComment: Boolean!
    isFeedbackComment: Boolean
    ChildComments: [Comment!]! @relationship(type: "IS_REPLY_TO", direction: IN)
    deleted: Boolean
    updatedAt: DateTime @timestamp(operations: [UPDATE])
    createdAt: DateTime! @timestamp(operations: [CREATE])
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    weightedVotesCount: Float
    UpvotedByUsers: [User!]!
      @relationship(type: "UPVOTED_COMMENT", direction: IN)
    # PastVersions:            [CommentVersion]        @relationship(type: "HAS_VERSION", direction: OUT)
    emoji: JSON
    GivesFeedbackOnDiscussion: Discussion
      @relationship(type: "HAS_FEEDBACK_COMMENT", direction: OUT)
    GivesFeedbackOnEvent: Event
      @relationship(type: "HAS_FEEDBACK_COMMENT", direction: OUT)
    GivesFeedbackOnComment: Comment
      @relationship(type: "HAS_FEEDBACK_COMMENT", direction: OUT)
    Issue: Issue @relationship(type: "ACTIVITY_ON_ISSUE", direction: OUT)
    FeedbackComments: [Comment!]!
      @relationship(type: "HAS_FEEDBACK_COMMENT", direction: IN)
    ModerationAction: ModerationAction @relationship(type: "MODERATED_COMMENT", direction: IN)
  }

  type Emoji {
    id: ID! @id
    name: String! @unique
    PostedByUser: User @relationship(type: "POSTED_EMOJI", direction: IN)
    createdAt: DateTime! @timestamp(operations: [CREATE])
  }

  type Email {
    address: String! @unique
    User: User @relationship(type: "HAS_EMAIL", direction: OUT)
  }

  type ModerationProfile {
    createdAt: DateTime! @timestamp(operations: [CREATE])
    displayName: String @unique
    User: User @relationship(type: "MODERATION_PROFILE", direction: IN)
    AuthoredIssues: [Issue!]!
      @relationship(type: "AUTHORED_ISSUE", direction: IN)
    AuthoredComments: [Comment!]!
      @relationship(type: "AUTHORED_COMMENT", direction: OUT)
    ModChannelRoles: [ModChannelRole!]!
      @relationship(type: "HAS_MOD_ROLE", direction: OUT)
    ModServerRoles: [ModServerRole!]!
      @relationship(type: "HAS_MOD_ROLE", direction: OUT)
    ActivityFeed: [ModerationAction!]!
      @relationship(type: "ACTIVITY_ON_ISSUE", direction: OUT)
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
    flaggedServerRuleViolation: Boolean
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

  type DropDataResponse {
    success: Boolean
    message: String
  }

  type SeedDataResponse {
    success: Boolean
    message: String
  }

  input EventCreateInputWithChannels {
    eventCreateInput: EventCreateInput!
    channelConnections: [String!]!
  }

  input DiscussionCreateInputWithChannels {
    discussionCreateInput: DiscussionCreateInput!
    channelConnections: [String!]!
  }

  input NewUserInput {
    emailAddress: String!
    username: String!
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
      input: [DiscussionCreateInputWithChannels!]!
    ): [Discussion!]!
    updateDiscussionWithChannelConnections(
      where: DiscussionWhere!
      discussionUpdateInput: DiscussionUpdateInput!
      channelConnections: [String!]
      channelDisconnections: [String]
    ): Discussion
    createEventWithChannelConnections(
      input: [EventCreateInputWithChannels!]!
    ): [Event!]!
    updateEventWithChannelConnections(
      where: EventWhere!
      eventUpdateInput: EventUpdateInput!
      channelConnections: [String!]
      channelDisconnections: [String]
    ): Event
    upvoteComment(commentId: ID!, username: String!): Comment
    undoUpvoteComment(commentId: ID!, username: String!): Comment
    upvoteDiscussionChannel(
      discussionChannelId: ID!
      username: String!
    ): DiscussionChannel
    undoUpvoteDiscussionChannel(
      discussionChannelId: ID!
      username: String!
    ): DiscussionChannel
    createSignedStorageURL(filename: String!, contentType: String!): SignedURL
    createEmailAndUser(emailAddress: String!, username: String!): User
    dropDataForCypressTests: DropDataResponse
    seedDataForCypressTests(
      channels: [ChannelCreateInput!]!
      users: [NewUserInput!]!
      tags: [TagCreateInput!]!
      discussions: [DiscussionCreateInputWithChannels!]!
      events: [EventCreateInputWithChannels!]!
      comments: [CommentCreateInput!]!
      channelRoles: [ChannelRoleCreateInput!]!
      modChannelRoles: [ModChannelRoleCreateInput!]!
      serverRoles: [ServerRoleCreateInput!]!
      modServerRoles: [ModServerRoleCreateInput!]!
      serverConfigs: [ServerConfigCreateInput!]!
    ): SeedDataResponse
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
    DiscussionChannel: DiscussionChannel
    Comments: [Comment!]!
  }

  type EventCommentsFormat {
    Event: Event
    Comments: [Comment!]!
  }

  type CommentRepliesFormat {
    ChildComments: [Comment!]!
    aggregateChildCommentCount: Int!
  }

  type LinkFlair {
    id: String
    text: String
    cssClass: String
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
    showAdminTag: Boolean
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
    canUpdateChannel: Boolean
    showModTag: Boolean
  }

  type ModChannelRole {
    name: String @unique
    channelUniqueName: String
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
    rules: JSON
    DefaultServerRole: ServerRole
      @relationship(type: "HAS_DEFAULT_SERVER_ROLE", direction: OUT)
    DefaultModRole: ModServerRole
      @relationship(type: "HAS_DEFAULT_MOD_ROLE", direction: OUT)
    DefaultChannelRole: ChannelRole
      @relationship(type: "HAS_DEFAULT_CHANNEL_ROLE", direction: OUT)
    DefaultModChannelRole: ModChannelRole
      @relationship(type: "HAS_DEFAULT_MOD_ROLE", direction: OUT)
  }

  type EnvironmentInfo {
    isTestEnvironment: Boolean
    currentDatabase: String
  }

  type SafetyCheckResponse {
    environment: EnvironmentInfo
  }

  type GetSortedChannelsResponse {
    channels: [Channel]
    aggregateChannelCount: Int
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
      modName: String
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
      modName: String
      offset: Int
      limit: Int
      sort: SortType
    ): CommentRepliesFormat
    getSortedChannels(
      offset: Int
      limit: Int
      tags: [String]
      searchInput: String
    ): GetSortedChannelsResponse
    safetyCheck: SafetyCheckResponse
  }
`;
export default typeDefinitions;
