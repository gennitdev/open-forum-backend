import snoowrap from "snoowrap";
const getSubredditResolver = () => {
    return async (parent, args, context, info) => {
        const { subredditName, options, flair } = args;
        const { limit = 25, sort = "hot", after } = options || {};
        const r = new snoowrap({
            userAgent: "web:Listical:v1.0 (by /u/gennitdev)",
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            refreshToken: process.env.REDDIT_REFRESH_TOKEN,
        });
        const fetchOptions = {
            limit,
            after, // Use the after parameter for pagination
        };
        let posts;
        if (flair) {
            // Constructing the search query for flair
            const flairQuery = `flair:"${flair}"`;
            posts = await r.getSubreddit(subredditName).search({
                query: flairQuery,
                sort: sort,
                time: "all",
                ...fetchOptions,
            });
        }
        else {
            switch (sort) {
                case "hot":
                    posts = await r.getSubreddit(subredditName).getHot(fetchOptions);
                    break;
                case "new":
                    posts = await r.getSubreddit(subredditName).getNew(fetchOptions);
                    break;
                case "top":
                    posts = await r.getSubreddit(subredditName).getTop(fetchOptions);
                    break;
                default:
                    posts = await r.getSubreddit(subredditName).getHot(fetchOptions);
            }
        }
        // console.log('posts', posts[0])
        const result = posts.map((post) => {
            var _a;
            return {
                id: post.id,
                name: post.name,
                subreddit: post.subreddit.display_name || subredditName,
                title: post.title || "",
                createdUTC: post.created_utc,
                author: ((_a = post.author) === null || _a === void 0 ? void 0 : _a.name) || "[deleted]",
                commentCount: post.num_comments,
                text: post.selftext,
                media: {
                    media: post.media,
                    secureMediaEmbed: post.secure_media_embed,
                    secureMedia: post.secure_media,
                    mediaEmbed: post.media_embed,
                    // @ts-ignore
                    mediaMetadata: post.media_metadata || {},
                },
                flair: {
                    linkFlairBackgroundColor: post.link_flair_background_color,
                    linkFlairTextColor: post.link_flair_text_color,
                    linkFlairRichText: post.link_flair_richtext,
                    linkFlairText: post.link_flair_text,
                },
                numCrossposts: post.num_crossposts,
                permalink: post.permalink,
                thumbnail: post.thumbnail,
                upvoteCount: post.ups,
                url: post.url,
                preview: post.preview,
                stickied: post.stickied,
            };
        });
        const nextPage = result.length > 0 ? result[result.length - 1].name : null;
        return {
            posts: result,
            after: nextPage,
        };
    };
};
export default getSubredditResolver;
