import snoowrap from 'snoowrap';
const getSubredditResolver = () => {
    return async (parent, args, context, info) => {
        const { subredditName, options } = args;
        const { limit = 25, sort = 'hot', after } = options || {};
        const r = new snoowrap({
            userAgent: 'web:Listical:v1.0 (by /u/gennitdev)',
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            refreshToken: process.env.REDDIT_REFRESH_TOKEN
        });
        const fetchOptions = {
            limit,
            after // Use the after parameter for pagination
        };
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
        // Dynamically choosing the sort method based on the input
        console.log('using fetch options', fetchOptions);
        let posts;
        switch (sort) {
            case 'hot':
                posts = await r.getSubreddit(subredditName).getHot(fetchOptions);
                break;
            case 'new':
                posts = await r.getSubreddit(subredditName).getNew(fetchOptions);
                break;
            case 'top':
                posts = await r.getSubreddit(subredditName).getTop(fetchOptions);
                break;
            case 'rising':
                posts = await r.getSubreddit(subredditName).getRising(fetchOptions);
                break;
            default:
                posts = await r.getSubreddit(subredditName).getHot(fetchOptions);
        }
        // console.log('posts', posts[0])
        const result = posts.map((post) => {
            var _a;
            // console.log('got data',{
            //   id: post.id,
            //   subreddit: post.subreddit.display_name || subredditName,
            //   title: post.title,
            //   createdUTC: post.created_utc,
            //   author: post.author?.name || '[deleted]',
            //   commentCount: post.num_comments,
            //   text: post.selftext,
            //   mediaMetadata: post.media,
            //   permalink: post.permalink,
            //   thumbnail: post.thumbnail,
            //   upvoteCount: post.ups,
            //   url: post.url,
            //   preview: post.preview,
            // })
            return {
                id: post.id,
                name: post.name,
                subreddit: post.subreddit.display_name || subredditName,
                title: post.title || '',
                createdUTC: post.created_utc,
                author: ((_a = post.author) === null || _a === void 0 ? void 0 : _a.name) || '[deleted]',
                commentCount: post.num_comments,
                text: post.selftext,
                mediaMetadata: post.media,
                permalink: post.permalink,
                thumbnail: post.thumbnail,
                upvoteCount: post.ups,
                url: post.url,
                preview: post.preview,
            };
        });
        const nextPage = result.length > 0 ? result[result.length - 1].name : null;
        return {
            posts: result,
            after: nextPage
        };
    };
};
export default getSubredditResolver;
