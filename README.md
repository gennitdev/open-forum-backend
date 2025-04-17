## Project Intro

An introduction to the project is in the frontend README: https://github.com/gennit-project/multiforum-frontend

## Technology Stack

On the backend (https://github.com/gennit-project/multiforum-backend), an Apollo server fetches data from the database (a graph database, Neo4j). Some resolvers are auto-generated using the [Neo4j graphql library](https://neo4j.com/docs/graphql/current/), while more complex resolvers are implemented using a combination of the [OGM](https://neo4j.com/docs/graphql/current/ogm/) and custom Cypher queries.

The frontend is a Vue application that makes GraphQL queries to the Apollo server.

## Permission System Architecture

Multiforum uses a comprehensive role-based permission system that governs what actions users can perform across the platform. The system operates at both server-wide and channel-specific levels.

### Permission Model Overview

The permission system uses the following components:

#### Types of Roles

1. **Server Roles** - Server-wide role definitions for regular users
   - Define baseline permissions for all users across the platform
   - Examples: `canCreateChannel`, `canCreateDiscussion`, `canUpvoteComment`

2. **Channel Roles** - Channel-specific role definitions for regular users
   - Define permissions for actions within specific channels
   - Examples: `canCreateDiscussion`, `canCreateComment`, `canUpvoteDiscussion`

3. **Mod Server Roles** - Server-wide role definitions for moderators
   - Define baseline moderation capabilities across all channels
   - Examples: `canHideComment`, `canGiveFeedback`, `canSuspendUser`

4. **Mod Channel Roles** - Channel-specific role definitions for moderators
   - Define moderation capabilities within specific channels
   - Examples: `canHideDiscussion`, `canGiveFeedback`, `canReport`

5. **Suspended Roles** - Define restricted permissions for suspended users/moderators
   - Different variants for regular users and moderators
   - Typically limit user capabilities while suspended

#### User Classifications

- **Regular Users** - Standard platform users
- **Channel Owners** - Have administrative control over specific channels
- **Moderators** - Users with moderation capabilities
- **Suspended Users** - Users with temporarily restricted permissions

### How Permissions Are Applied

The permission system follows a hierarchical flow:

1. **Authentication Check**
   - Verifies that the user is logged in and their JWT is valid

2. **Role Determination**
   - For each action, the system determines which role applies to the user
   - The system follows this priority order when determining permissions:
     - For regular user actions (e.g., creating posts):
       1. Channel Owner status (automatic permission for all channel actions)
       2. Suspension status (uses SuspendedRole if suspended)
       3. Channel-specific roles
       4. Channel default role
       5. Server default role
     - For moderation actions:
       1. Channel Owner status (automatic permission for all moderation actions)
       2. Suspension status (uses SuspendedModRole if suspended)
       3. Elevated moderator status and role
       4. Default moderator role
       5. Server default moderator role

3. **Permission Verification**
   - Once the appropriate role is determined, the system checks if that role grants the specific permission required for the action
   - If the permission is granted, the action proceeds
   - If the permission is denied, an error is returned

### Special Cases

- **Channel Owners** always have full permissions within their channels
- **Feedback Comments** require moderator permissions (`canGiveFeedback`) rather than standard comment permissions
- **Suspended Users** have limited permissions based on the Suspended roles

### Current Implementation Notes

- The ability to create customized channel roles (changing what is allowed for standard users or moderators in a given channel) is a planned feature but is not currently available
- Currently, the permissions are defined in the server configuration
- All permission checks are enforced through GraphQL Shield middleware combined with custom rule resolvers

### Permission Check Implementation

Permission checks are implemented in two main files:

1. `hasChannelPermission.ts` - Handles regular user permissions for channel-specific actions
2. `hasChannelModPermission.ts` - Handles moderator permissions for moderation actions

These files share a similar logical flow but handle different types of roles and permissions.

## Environment Variables and Running the App

I will fill out this section when the project is finished, or if someone expresses interest in collaborating on this project, whichever comes sooner. Anyone interested can contact me at catherine.luse@gmail.com.
