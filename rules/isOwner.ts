import { rule } from "graphql-shield";
import { ERROR_MESSAGES } from "../rules/errorMessages.js";
import { ChannelWhere, Channel, } from "../src/generated/graphql.js";
import { setUserDataOnContext } from "./userDataHelperFunctions.js";

type IsChannelOwnerInput = {
  where: ChannelWhere;
};


// the args to isChannelOwner are the same as args to updateChannel

// {
//   where: { uniqueName: 'innhtdthdth' },
//   update: {
//     description: 'dthdth',
//     displayName: '',
//     channelIconURL: '',
//     channelBannerURL: '',
//     Tags: [ [Object] ],
//     Admins: [ [Object] ]
//   }
// }


export const isChannelOwner = rule({ cache: "contextual" })(
  async (parent: any, args: IsChannelOwnerInput, ctx: any, info: any) => {
    console.log("is channel owner rule is running", args)

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });
    console.log("set user data on context. user data is ", ctx.user);
    let username = ctx.user.username;

    console.log("username is ", username)
    let ogm = ctx.ogm;
    const { where } = args;
    const { uniqueName } = where;
    console.log("unique name is ", uniqueName)

    if (!uniqueName) {
      return new Error(ERROR_MESSAGES.channel.notFound);
    }
    const ChannelModel = ogm.model("Channel");

    // Get the list of channel owners by using the OGM on the
    // Channel object.
    const channel: Channel[] = await ChannelModel.find({
      where: { uniqueName },
      selectionSet: `{ 
            Admins { 
                username
            } 
      }`,
    });

    if (!channel) {
      console.log("channel not found");
      return new Error(ERROR_MESSAGES.channel.notFound);
    }

    if (channel.length === 0) {
      console.log("channel not found 2");
      return new Error(ERROR_MESSAGES.channel.notFound);
    }

    // Get the list of channel owners.
    const channelOwners = channel[0].Admins.map((admin) => admin.username);
    console.log("channel owners are ", channelOwners);
    console.log('logged in user is ', username)

    // Check if the user is in the list of channel owners.
    if (!channelOwners.includes(username)) {
      return new Error(ERROR_MESSAGES.channel.notOwner);
    }

    console.log("passed rule: is channel owner");
    return true;
  }
);

// Check if the user is the owner of the account.
export const isAccountOwner = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    const { username } = ctx.user;
    const { usernameToCompare } = args;

    if (username !== usernameToCompare) {
      return new Error(ERROR_MESSAGES.generic.noPermission);
    }

    console.log("passed rule: is account owner");
    return true;
  }
);
