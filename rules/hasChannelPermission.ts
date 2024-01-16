import { rule } from "graphql-shield";

export const hasChannelPermission = rule({ cache: "contextual" })(
    async (parent: any, args: any, ctx: any, info: any) => {
      // example of channel permission is CreateEvents.
      const { permission, Channel } = args;
      const { username } = ctx.user;
  
      // Get the list of channel permissions on the User object.
      const channelRoles = []; // to do.
  
      // If there are no channel roles on the user object,
      // get the default channel role. This is located on the
      // ChannelConfig object.
      // if (!channelRoles.length) {
      //   const channelConfig = await ChannelConfig.find({
      //     where: { channelId: Channel.id },
      //   });
      //   channelRoles.push(channelConfig[0]?.defaultChannelRole);
      // }
  
      // Loop over the list of channel roles. They all
      // must explicitly allow the permission.
      // Otherwise, if one says false or is missing
      // the permission, return false.
      // for (const channelRole of channelRoles) {
      //   const channelRolePermissions = []; // to do.
      //   if (!channelRolePermissions.includes(permission)) {
      //     return false;
      //   }
      // }
      console.log("passed rule: has channel permission");
      return true;
    }
  );