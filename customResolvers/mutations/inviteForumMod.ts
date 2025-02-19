import type {
  ChannelUpdateInput,
  ChannelModel,
  UserUpdateInput,
  UserModel,
} from "../../ogm_types.js";
import sgMail from "@sendgrid/mail";

type Args = {
  inviteeUsername: string;
  channelUniqueName: string;
};

type Input = {
  Channel: ChannelModel;
  User: UserModel;
};

const getResolver = (input: Input) => {
  const { Channel, User } = input;

  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { channelUniqueName, inviteeUsername } = args;

    if (!channelUniqueName || !inviteeUsername) {
      throw new Error(
        "All arguments (channelUniqueName, inviteeUsername) are required"
      );
    }

    // 1. Markdown-friendly message for in-app Notifications
    const notificationMessage = `
You have been invited to be a mod of the forum ${channelUniqueName}.
To accept it, go to [this page](${process.env.FRONTEND_URL}/forums/${channelUniqueName}/accept-invite).
    `;

    // 2. Non-Markdown (plain text + HTML) for email
    const emailPlainText = `You have been invited to be a mod of the forum "${channelUniqueName}".
To accept it, please visit this link:
${process.env.FRONTEND_URL}/forums/${channelUniqueName}/accept-invite
`;

    const emailHtml = `
<p>You have been invited to be a mod of the forum <strong>${channelUniqueName}</strong>.</p>
<p>To accept your invite, please click or copy/paste the link below:</p>
<p>
  <a href="${process.env.FRONTEND_URL}/forums/${channelUniqueName}/accept-invite">
    ${process.env.FRONTEND_URL}/forums/${channelUniqueName}/accept-invite
  </a>
</p>
`;

    // Prepare the OGM update inputs
    const channelUpdateInput: ChannelUpdateInput = {
      PendingModInvites: [
        {
          connect: [
            {
              where: {
                node: {
                  username: inviteeUsername,
                },
              },
            },
          ],
        },
      ],
    };

    const userUpdateNotificationInput: UserUpdateInput = {
      Notifications: [
        {
          create: [
            {
              node: {
                text: notificationMessage,
                read: false,
              },
            },
          ],
        },
      ],
    };

    try {
      // Update the Channel (add the pending mod invite)
      const channelUpdateResult = await Channel.update({
        where: {
          uniqueName: channelUniqueName,
        },
        update: channelUpdateInput,
      });
      if (!channelUpdateResult.channels[0]) {
        throw new Error("Could not invite user.");
      }

      // Create the in-app notification for the user
      const userUpdateResult = await User.update({
        where: {
          username: inviteeUsername,
        },
        update: userUpdateNotificationInput,
      });
      if (!userUpdateResult.users[0]) {
        throw new Error("Could not notify the user of the invite.");
      }

      // Set up SendGrid (if API key provided)
      if (process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      } else {
        console.warn("SENDGRID_API_KEY is not set. Email will not be sent.");
      }

      // Fetch the user’s email address
      const users = await User.find({
        where: {
          username: inviteeUsername,
        },
        selectionSet: `
        {
          username
          Email {
            address
          }
        }
        `,
      });

      if (!users.length) {
        throw new Error(`User with username "${inviteeUsername}" not found`);
      }

      const user = users[0];
      if (!user.Email) {
        throw new Error(
          `User with username "${inviteeUsername}" does not have an email address`
        );
      }

      if (!process.env.SENDGRID_FROM_EMAIL) {
        throw new Error("SENDGRID_FROM_EMAIL is not set");
      }

      // Send the email
      const msg = {
        to: user.Email.address,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: "You have been invited to be a mod of a forum",
        text: emailPlainText,
        html: emailHtml
      };

      console.log("Sending email to", user.Email.address);
      await sgMail.send(msg);

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };
};

export default getResolver;
