import rss from "@astrojs/rss";
import type { APIContext } from "astro";

type PostModule = {
  url?: string;
  frontmatter: {
    title: string;
    description?: string;
    pubDate?: string;
    author?: string;
  };
};

export async function GET(context: APIContext) {
  const postModules = import.meta.glob<PostModule>("./blog/*.md", {
    eager: true,
  });
  const posts = Object.values(postModules);

  return rss({
    title: "OpenApply Blog - Job Search Tips & Career Advice",
    description:
      "Expert insights on job search strategies, resume building, cover letter writing, and leveraging AI tools to land your dream job.",
    site: context.site || "https://openapply.app",
    items: posts.map((post) => ({
      title: post.frontmatter.title,
      description: post.frontmatter.description || post.frontmatter.title,
      pubDate: post.frontmatter.pubDate
        ? new Date(post.frontmatter.pubDate)
        : new Date(),
      link: post.url || "",
      author: post.frontmatter.author || "OpenApply Team",
    })),
    customData: "<language>en-us</language>",
  });
}
