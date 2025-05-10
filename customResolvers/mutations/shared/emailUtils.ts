import sgMail from "@sendgrid/mail";
import type { UserModel } from "../../../ogm_types.js";

// Types for email content
export type EmailContent = {
  subject: string;
  plainText: string;
  html: string;
};

// Interface for notification options
export interface NotificationOptions {
  inAppText: string;
  createInAppNotification: boolean;
}

/**
 * Sends an email and optionally creates an in-app notification
 * @param recipient Username of the recipient
 * @param emailContent Email content (subject, plainText, html)
 * @param User OGM User model for database operations
 * @param notificationOptions Optional settings for in-app notifications
 * @returns Promise<boolean> Whether the email was sent successfully
 */
export const sendEmailToUser = async (
  recipient: string,
  emailContent: EmailContent,
  User: UserModel,
  notificationOptions?: NotificationOptions
): Promise<boolean> => {
  try {
    // Set up SendGrid (if API key provided)
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    } else {
      console.warn("SENDGRID_API_KEY is not set. Email will not be sent.");
      return false;
    }

    // Fetch the user's email address
    const users = await User.find({
      where: {
        username: recipient,
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
      throw new Error(`User with username "${recipient}" not found`);
    }

    const user = users[0];
    if (!user.Email) {
      throw new Error(
        `User with username "${recipient}" does not have an email address`
      );
    }

    if (!process.env.SENDGRID_FROM_EMAIL) {
      throw new Error("SENDGRID_FROM_EMAIL is not set");
    }

    // Send the email
    const msg = {
      to: user.Email.address,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: emailContent.subject,
      text: emailContent.plainText,
      html: emailContent.html,
    };

    console.log("Sending email to", user.Email.address);
    await sgMail.send(msg);

    // Create in-app notification if requested
    if (notificationOptions?.createInAppNotification) {
      const userUpdateNotificationInput = {
        Notifications: [
          {
            create: [
              {
                node: {
                  text: notificationOptions.inAppText,
                  read: false,
                },
              },
            ],
          },
        ],
      };

      const userUpdateResult = await User.update({
        where: {
          username: recipient,
        },
        update: userUpdateNotificationInput,
      });

      if (!userUpdateResult.users[0]) {
        throw new Error("Could not create in-app notification for the user.");
      }
    }

    return true;
  } catch (e) {
    console.error("Error sending email:", e);
    return false;
  }
};

/**
 * Creates email content for comment notifications
 * @param commentText The text of the comment
 * @param discussionTitle The title of the discussion
 * @param commenterUsername Username of the person who commented
 * @param channelName Name of the channel
 * @param discussionId ID of the discussion
 * @param commentId ID of the comment
 * @returns EmailContent object with subject, plainText, and HTML
 */
export const createCommentNotificationEmail = (
  commentText: string,
  discussionTitle: string,
  commenterUsername: string,
  channelName: string,
  discussionId: string,
  commentId: string
): EmailContent => {
  // Create URL to the comment using permalink format
  const commentUrl = `${process.env.FRONTEND_URL}/forums/${channelName}/discussions/${discussionId}/comments/${commentId}`;

  // Create subject line
  const subject = `New comment on your discussion: ${discussionTitle}`;
  
  // Create plain text version
  const plainText = `
${commenterUsername} commented on your discussion "${discussionTitle}":

"${commentText}"

View the comment at:
${commentUrl}
`;

  // Create HTML version with some basic formatting
  const html = `
<p><strong>${commenterUsername}</strong> commented on your discussion "<strong>${discussionTitle}</strong>":</p>
<blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin-left: 0;">
  ${commentText}
</blockquote>
<p>
  <a href="${commentUrl}">View the comment</a>
</p>
`;

  return {
    subject,
    plainText,
    html
  };
};