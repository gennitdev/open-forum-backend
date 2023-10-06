const { gql } = require("apollo-server");

const typeDefs = gql`
  type Event {
    id: ID! @id
    title: String!
    description: String
    startTime: DateTime!
    startTimeYear: String!
    startTimeMonth: String!
    startTimeDayOfMonth: String!
    startTimeDayOfWeek: String!
    startTimeHourOfDay: Int!
    endTime: DateTime!
    Channels: [Channel!]!
      @relationship(type: "POSTED_IN_CHANNEL", direction: OUT)
    CommentSections: [CommentSection!]!
      @relationship(type: "HAS_COMMENTS_IN", direction: OUT)
    locationName: String
    address: String
    virtualEventUrl: String
    Poster: User @relationship(type: "POSTED_BY", direction: OUT)
    updatedAt: DateTime @timestamp(operations: [UPDATE])
    createdAt: DateTime! @timestamp(operations: [CREATE])
    placeId: String
    isInPrivateResidence: Boolean
    cost: String
    free: Boolean
    location: Point
    canceled: Boolean!
    deleted: Boolean
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    # PastVersions:          [EventVersion]    @relationship(type: "HAS_VERSION", direction: OUT)
  }

  type Channel {
    description: String
    name: String
    uniqueName: String! @unique
    Admins: [User!]! @relationship(type: "ADMIN_OF_CHANNEL", direction: IN)
    Moderators: [ModerationProfile!]!
      @relationship(type: "MODERATOR_OF_CHANNEL", direction: IN)
    Discussions: [Discussion!]!
      @relationship(type: "POSTED_IN_CHANNEL", direction: IN)
    RelatedChannels: [Channel!]!
      @relationship(type: "RELATED_CHANNEL", direction: OUT)
    Events: [Event!]! @relationship(type: "POSTED_IN_CHANNEL", direction: IN)
    createdAt: DateTime! @timestamp(operations: [CREATE])
    # Flairs:                   [Flair]                @relationship(type: "HAS_FLAIR", direction: OUT)
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    # WikiPages:                [WikiPage]             @relationship(type: "HAS_WIKI_PAGE", direction: OUT)
    ModerationDashboard: ModerationDashboard
      @relationship(type: "HAS_MODERATION_DASHBOARD", direction: OUT)
    Rules: [Rule!]! @relationship(type: "HAS_RULE", direction: OUT)
    locked: Boolean
    deleted: Boolean
    SuspendedUsers: [User!]!
      @relationship(type: "SUSPENDED_FROM_CHANNEL", direction: IN)
    Comments: [Comment!]! @relationship(type: "HAS_COMMENT", direction: OUT)
    CommentSections: [CommentSection!]!
      @relationship(type: "HAS_COMMENT_SECTION", direction: OUT)
  }

  type Rule {
    id: ID! @id
    orderInList: Int
    summary: String
    description: String
  }

  type Email {
    address: String! @unique
    User: User @relationship(type: "USER", direction: IN)
  }

  type User {
    username: String! @unique
    Email: Email @relationship(type: "EMAIL", direction: OUT)
    name: String
    pronouns: String
    location: String
    bio: String
    isAdmin: Boolean
    Comments: [Comment!]!
      @relationship(type: "AUTHORED_COMMENT", direction: OUT)
    AdminOfChannels: [Channel!]!
      @relationship(type: "ADMIN_OF_CHANNEL", direction: OUT)
    Discussions: [Discussion!]!
      @relationship(type: "POSTED_DISCUSSION", direction: OUT)
    Events: [Event!]! @relationship(type: "POSTED_BY", direction: IN)
    # SentMessages:            [Message!]           @relationship(type: "SENT_MESSAGE", direction: OUT)
    # ReceivedMessages:        [Message!]           @relationship(type: "RECEIVED_MESSAGE", direction: OUT)
    Feeds: [Feed!]! @relationship(type: "HAS_FEED_IN_LIBRARY", direction: OUT)
    CreatedFeeds: [Feed!]! @relationship(type: "CREATED_FEED", direction: OUT)
    DefaultFeed: Feed @relationship(type: "DEFAULT_FEED", direction: OUT)
    createdAt: DateTime! @timestamp(operations: [CREATE])
    # AuthoredWikiPages:       [WikiPage]           @relationship(type: "AUTHORED_PAGE", direction: OUT)
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
    UpvotedDiscussions: [Discussion!]!
      @relationship(type: "UPVOTED_DISCUSSION", direction: OUT)
    UpvotedCommentSections: [CommentSection!]!
      @relationship(type: "UPVOTED_COMMENT_SECTION", direction: OUT)
    ModerationProfile: ModerationProfile
      @relationship(type: "MODERATION_PROFILE", direction: OUT)
    DefaultEmojiSkintone: String
    NotificationBundleInterval: String
    PreferredTimeZone: String
    Issues: [Issue!]! @relationship(type: "AUTHORED_ISSUE", direction: OUT)
    IssueComments: [IssueComment!]!
      @relationship(type: "AUTHORED_ISSUE_COMMENT", direction: OUT)
    SuspendedFromChannels: [Channel!]!
      @relationship(type: "SUSPENDED_FROM_CHANNEL", direction: OUT)
    suspendedFromServer: Boolean
    deleted: Boolean
  }

  type ModerationProfile {
    createdAt: DateTime! @timestamp(operations: [CREATE])
    displayName: String @unique
    User: User @relationship(type: "MODERATION_PROFILE", direction: IN)
    DownvotedComments: [Comment!]!
      @relationship(type: "DOWNVOTED_COMMENT", direction: OUT)
    DownvotedDiscussions: [Discussion!]!
      @relationship(type: "DOWNVOTED_DISCUSSION", direction: OUT)
    DownvotedCommentSections: [CommentSection!]!
      @relationship(type: "DOWNVOTED_COMMENT_SECTION", direction: OUT)
    AuthoredReports: [Report!]!
      @relationship(type: "AUTHORED_REPORT", direction: OUT)
    Issues: [Issue!]! @relationship(type: "AUTHORED_ISSUE", direction: OUT)
    DiscussionComments: [Comment!]!
      @relationship(type: "AUTHORED_COMMENT", direction: OUT)
    IssueComments: [IssueComment!]!
      @relationship(type: "AUTHORED_ISSUE_COMMENT", direction: OUT)
  }

  union IssueAuthor = User | ModerationProfile

  type Issue {
    id: ID! @id
    Author: IssueAuthor @relationship(type: "AUTHORED_ISSUE", direction: IN)
    title: String
    body: String
    ModerationDashboard: ModerationDashboard
      @relationship(type: "HAS_ISSUE", direction: IN)
    isOpen: Boolean!
    Reports: [Report!]! @relationship(type: "CITED_REPORT", direction: OUT)
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp(operations: [UPDATE])
  }

  union IssueCommentAuthor = User | ModerationProfile

  type IssueComment {
    id: ID! @id
    Author: IssueCommentAuthor
      @relationship(type: "AUTHORED_ISSUE_COMMENT", direction: IN)
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp(operations: [UPDATE])
  }

  type ModerationDashboard {
    id: ID! @id
    issueTemplate: String
    Channel: Channel
      @relationship(type: "HAS_MODERATION_DASHBOARD", direction: IN)
    Issues: [Issue!]! @relationship(type: "HAS_ISSUE", direction: OUT)
  }

  type Report {
    id: ID! @id
    Author: ModerationProfile
      @relationship(type: "AUTHORED_REPORT", direction: IN)
    text: String
    RuleViolations: [Rule!]! @relationship(type: "CITED_RULE", direction: OUT)
    Issues: [Issue!]! @relationship(type: "CITED_REPORT", direction: IN)
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp(operations: [UPDATE])
  }

  type Discussion {
    id: ID! @id
    Author: User @relationship(type: "POSTED_DISCUSSION", direction: IN)
    body: String
    Channels: [Channel!]!
      @relationship(type: "POSTED_IN_CHANNEL", direction: OUT)
    title: String!
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime @timestamp(operations: [UPDATE])
    # Flairs:                  [Flair]                 @relationship(type: "HAS_FLAIR", direction: OUT)
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    UpvotedByUsers: [User!]!
      @relationship(type: "UPVOTED_DISCUSSION", direction: IN)
    DownvotedByModerators: [ModerationProfile!]!
      @relationship(type: "DOWNVOTED_DISCUSSION", direction: IN)
    # PastVersions:            [DiscussionVersion]     @relationship(type: "HAS_VERSION", direction: OUT)
    CommentSections: [CommentSection!]!
      @relationship(type: "HAS_COMMENTS_IN", direction: OUT)
    deleted: Boolean
  }

  union OriginalPost = Discussion | Event

  type CommentSection {
    # Must have a Channel and either a Discussion or an Event.
    # Channel is technically optional because channels can be deleted.
    id: ID! @id
    Comments: [Comment!]!
      @relationship(type: "CONTAINS_COMMENT", direction: OUT)
    OriginalPost: OriginalPost
      @relationship(type: "HAS_COMMENTS_IN", direction: IN)
    Channel: Channel @relationship(type: "HAS_COMMENT_SECTION", direction: IN)
    UpvotedByUsers: [User!]!
      @relationship(type: "UPVOTED_COMMENT_SECTION", direction: IN)
    DownvotedByModerators: [ModerationProfile!]!
      @relationship(type: "DOWNVOTED_COMMENT_SECTION", direction: IN)
  }

  union CommentAuthor = User #| ModerationProfile

  type Comment {
    id: ID! @id
    CommentAuthor: CommentAuthor
      @relationship(type: "AUTHORED_COMMENT", direction: IN)
    CommentSection: CommentSection
      @relationship(type: "CONTAINS_COMMENT", direction: IN)
    Channel: Channel @relationship(type: "HAS_COMMENT", direction: IN)
    ParentComment: Comment @relationship(type: "IS_REPLY_TO", direction: OUT)
    text: String
    isRootComment: Boolean!
    ChildComments: [Comment!]! @relationship(type: "IS_REPLY_TO", direction: IN)
    deleted: Boolean
    updatedAt: DateTime @timestamp(operations: [UPDATE])
    createdAt: DateTime! @timestamp(operations: [CREATE])
    # Emoji:                   [Emoji]                 @relationship(type: "HAS_EMOJI", direction: OUT)
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    UpvotedByUsers: [User!]!
      @relationship(type: "UPVOTED_COMMENT", direction: IN)
    DownvotedByModerators: [ModerationProfile!]!
      @relationship(type: "DOWNVOTED_COMMENT", direction: IN)
    # PastVersions:            [CommentVersion]        @relationship(type: "HAS_VERSION", direction: OUT)
  }

  type Feed {
    id: ID! @id
    title: String
    description: String
    Owner: User @relationship(type: "CREATED_FEED", direction: IN)
    # Sources:               [Source]
    Tags: [Tag!]! @relationship(type: "HAS_TAG", direction: OUT)
    deleted: Boolean
  }
  type Tag {
    text: String! @unique
    Channels: [Channel!]! @relationship(type: "HAS_TAG", direction: IN)
    Discussions: [Discussion!]! @relationship(type: "HAS_TAG", direction: IN)
    Events: [Event!]! @relationship(type: "HAS_TAG", direction: IN)
    Comments: [Comment!]! @relationship(type: "HAS_TAG", direction: IN)
    # WikiPages:             [WikiPage]              @relationship(type: "HAS_TAG", direction: IN)
    Feeds: [Feed!]! @relationship(type: "HAS_TAG", direction: IN)
  }
`;

export default typeDefs;
