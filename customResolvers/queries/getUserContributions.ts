import { getUserContributionsQuery } from "../cypher/cypherQueries.js";
import { DateTime } from "luxon";

interface Input {
  User: any;
  driver: any;
}

interface Args {
  username: string;
  startDate?: string;
  endDate?: string;
  year?: number;
}

const getUserContributionsResolver = (input: Input) => {
  const { driver, User } = input;

  return async (_parent: any, args: Args) => {
    const { username, year, startDate, endDate } = args;
    const session = driver.session({ defaultAccessMode: 'READ' });

    try {
      // Verify user existence
      const userExists = await User.find({
        where: { username },
        selectionSet: `{ username }`,
      });

      if (userExists.length === 0) {
        throw new Error(`User ${username} not found.`);
      }

      // Determine effective date range
      const effectiveStartDate = year
        ? `${year}-01-01`
        : (startDate || DateTime.now().minus({ year: 1 }).toISODate());

      const effectiveEndDate = year
        ? `${year}-12-31`
        : (endDate || DateTime.now().toISODate());

      // Execute optimized Cypher query
      const result = await session.run(getUserContributionsQuery, {
        username,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
      });

      // Simplified mapping of results - return a flat array as is
      const contributions = result.records
        .map((record: any) => {
          const date = record.get('date');
          // Filter out any records with null dates
          if (!date) {
            return null;
          }
          return {
            date,
            count: record.get('count').toNumber ? record.get('count').toNumber() : record.get('count'),
            activities: record.get('activities'),
          };
        })
        .filter((contribution: any) => contribution !== null);

      return contributions;

    } catch (error: any) {
      console.error("Error fetching user contributions:", error);
      throw new Error(`Failed to fetch contributions for user ${username}: ${error.message}`);
    } finally {
      await session.close();
    }
  };
};

export default getUserContributionsResolver;
