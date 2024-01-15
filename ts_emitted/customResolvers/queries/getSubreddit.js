import snoowrap from 'snoowrap';
const getSubredditResolver = () => {
    return async (parent, args, context, info) => {
        const { subredditName, options } = args;
        const { offset, limit, sort } = options || {};
        const r = new snoowrap({
            userAgent: 'web:Listical:v1.0 (by /u/gennitdev)',
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            refreshToken: process.env.REDDIT_REFRESH_TOKEN
        });
        // @ts-ignore
        const subreddit = await r.getSubreddit(subredditName);
        // output format:
        // type RedditSubmission {
        //     subreddit: String!
        //     title: String!
        //     createdUTC: Int!
        //     author: String!
        //     commentCount: Int!
        //     text: String!
        //     mediaMetadata: JSON
        //     permalink: String!
        //     thumbnail: String!
        //     upvoteCount: Int!
        //   }
        const posts = await subreddit.getHot({ time: 'month' });
        const result = posts.map((post) => {
            var _a;
            return {
                subreddit: post.subreddit.display_name,
                title: post.title,
                createdUTC: post.created_utc,
                author: ((_a = post.author) === null || _a === void 0 ? void 0 : _a.name) || '[deleted]',
                commentCount: post.num_comments,
                text: post.selftext,
                mediaMetadata: post.media_metadata,
                permalink: post.permalink,
                thumbnail: post.thumbnail,
                upvoteCount: post.ups,
                url: post.url,
                preview: post.preview
            };
        });
        return result;
    };
};
export default getSubredditResolver;
