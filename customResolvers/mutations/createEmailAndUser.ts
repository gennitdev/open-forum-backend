import { EmailModel, UserModel } from "../../ogm-types";
import { generateSlug } from "random-word-slugs";

type Args = {
  emailAddress: string;
  username: string;
};

type Input = {
  User: UserModel;
  Email: EmailModel;
};

const getCreateEmailAndUserResolver = (input: Input) => {
  const { User, Email } = input;
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { emailAddress, username } = args;

    if (!emailAddress || !username) {
      throw new Error("Both emailAddress and username are required");
    }

    try {
      // Check if the user already exists
      const existingUser = await User.find({
        where: {
          username,
        },
      });

      if (existingUser.length > 0) {
        throw new Error("Username already taken");
      }

      // Check if the email already exists
      const existingEmail = await Email.find({
        where: {
          address: emailAddress,
        },
      });

      if (existingEmail.length > 0) {
        throw new Error("Email already taken");
      }

      if (existingEmail.length === 0) {
        // Create a new email and user

        const randomWords = generateSlug(4, { format: "camel" });

        await User.create({
          input: [
            {
              username,
              Email: {
                create: {
                  node: {
                    address: emailAddress,
                  },
                },
              },
              ModerationProfile: {
                create: {
                  node: {
                    displayName: randomWords,
                  },
                },
              },
            },
          ],
        });
      }

      const newUserArray = await User.find({
        where: {
          username,
        },
        selectionSet: `
        {
            username
            Email {
                address
            }
            ModerationProfile {
                displayName
            }
        }
        `,
      });
      if (newUserArray.length === 0) {
        throw new Error("Error creating user and linking email");
      }
      const userToReturn = newUserArray[0];

      return userToReturn;
    } catch (e: any) {
      console.error(e);
      throw new Error(
        `An error occurred while creating the user and linking the email: ${e?.message}`
      );
    }
  };
};

export default getCreateEmailAndUserResolver;
