#!/usr/bin/env python3
"""Growth sprint thread finder: fresh Reddit/HN posts worth a helpful reply.

Pulls posts from the last N hours in the target subreddits (public reddit
.json listing, falling back to the Arctic Shift archive API when reddit
blocks the request) plus Hacker News via Algolia. Keeps posts where someone
asks about tracking applications, resume vs job description match / ATS,
resume parsing problems, cover letters, or organizing a job search, and
writes a ranked markdown list with a suggested reply angle per post.

Nothing is posted anywhere; the owner replies by hand.

Usage: scripts/growth/threads.py [--hours 48] [--limit 30] [--out PATH]
"""
import argparse
import datetime as dt
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "linux:openapply-growth-threadfinder:0.1 (by /u/SergeyKhval; read-only, runs once a day)"
VAULT_DIR = os.path.expanduser(
    "~/Documents/Obsidian Vault/Projects/OpenApply/growth-sprint-2026-09/threads"
)
UTM = "utm_source=reddit&utm_medium=comment&utm_campaign=sprint-2609"
TOOL_URL = "https://openapply.app/tools/resume-job-match"

# Link policy per subreddit, from research/communities.md (rule text read 2026-09-23).
#   "no"        self-promotion banned: value only, never mention OpenApply
#   "disclosed" a link is fine if it truly fits, with "I built this" up front
#   "thread"    promotion only in the sub's monthly promo thread
SUBREDDITS = {
    "jobsearchhacks": ("no", "Rule 1: no self-promotion, 'no sneaky plugs'"),
    "jobs": ("no", "Rule 1: no self promotion of any kind, free or paid"),
    "resumes": ("no", "Rule 2 bans promoting job search tools; rule 5 bans AI-generated content"),
    "recruitinghell": ("no", "Rule 2 no spam incl. 'subtly guiding' to a product; rule 6 no AI content"),
    "GetEmployed": ("no", "Rule 2 no self promotion; rule 7 no AI slop"),
    "careerguidance": ("no", "Rule 2 no advertising; rule 4 no link posts"),
    "EngineeringResumes": ("no", "Rule 3 no self-promotion; rule 11 no AI content"),
    "findapath": ("no", "Rule 4: outside tools need mod clearance, no AI-only tools"),
    "cscareerquestions": ("thread", "Rule 5: promotion only in the monthly stickied thread"),
    "ResumeTips": ("disclosed", "Rule 2: no spam or *excessive* self-promotion"),
    "JobSearchAndResumes": ("disclosed", "Rule 2: no *excessive* promotion"),
    "ChatGPTPromptGenius": ("disclosed", "Rule 3: disclosed promotion OK, value first, link at the end"),
}

# Topic patterns, matched against title and body separately (lowercased).
# A topic counts when it is in the title, or comes up at least twice in the body;
# one passing mention in a long post is not what the post is about.
TOPICS = {
    "tracking": re.compile(
        r"keep(ing)? track|lost track|track(ing)? (my |your |job |of )?(job )?applications?"
        r"|application tracker|job tracker|spreadsheet|organi[sz]e (my |your |the )?(job )?search"
        r"|how (do you|to) (stay )?organi[sz]ed|notion (template|board)"
    ),
    "match": re.compile(
        r"\bats\b|applicant tracking|job descriptions?|\bjds?\b|keywords?|tailor(ed|ing)?\b"
        r"|match(ing)? (my )?(resume|cv)|resume (score|scanner|checker)|jobscan"
    ),
    "parse": re.compile(
        r"pars(e|es|ed|er|ing)\b|two[- ]column|canva|indesign"
        r"|(pdf|docx) (or|vs\.?) (pdf|docx)|reads? my resume wrong|formatting (for|in) ats"
    ),
    "cover": re.compile(r"cover letters?"),
}
QUESTION = re.compile(
    r"\b(how do|how to|how should|anyone|any tips|advice|what do you use|should i|is it worth"
    r"|recommend|help me|does anyone|best way|what tools?)\b"
)
# Hiring posts and other people's promotion (tools, paid services) are not reply targets.
EXCLUDE = re.compile(
    r"\[hiring\]|we('| a)re hiring|\bi built\b|\bi made\b|\bmy (app|tool|startup)\b"
    r"|paid service|my services?\b|i offer\b"
)

HN_QUERIES = [
    "job application tracker", "tracking job applications", "resume job description",
    "ATS resume", "cover letter", "job search spreadsheet", "job hunt",
]

REPLY_ANGLES = {
    "tracking": (
        "Share a concrete tracking setup: columns for company, role, where you found it, date applied, "
        "status, next follow-up date, contact. Point out the 'where I found it' column: tracking the source "
        "shows which channels actually produce interviews."
    ),
    "match": (
        "Explain the quote-or-missing check: list every requirement in the JD, mark matched/partial/missing, "
        "and only count a match if you can quote the resume line. Recruiters search with the posting's exact "
        "words, so synonyms don't count. Offer the prompt text inline."
    ),
    "parse": (
        "Suggest the 30-second test: copy the PDF text into Notepad; if it's scrambled, that's roughly what the "
        "parser reads. Single column, real text (not text-as-image), standard section headings."
    ),
    "cover": (
        "Tailored beats generic: pick the 2-3 things the posting repeats, one proof sentence each, strongest "
        "line first, 250-300 words. Keep a doc of your best proof sentences so tailoring takes minutes."
    ),
}
LINK_ANGLES = {
    "tracking": f"If it fits: OpenApply is a free open-source tracker I built (https://openapply.app/?{UTM}&utm_content={{sub}}).",
    "match": f"If it fits: I built a free no-signup checker that runs exactly this ({TOOL_URL}?{UTM}&utm_content={{sub}}).",
    "parse": f"If it fits: the free checker I built shows what a parser extracts from your PDF ({TOOL_URL}?{UTM}&utm_content={{sub}}).",
    "cover": "",
}


def fetch_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


class RedditSource:
    """Reddit's own listing when reachable, else the Arctic Shift archive.

    Arctic Shift ingests posts within seconds, so it is fresh, but its score
    and comment counts are snapshots from ingest time. The output says which
    source was used so the numbers are read accordingly.
    """

    def __init__(self):
        self.reddit_blocked = False
        self.used_archive = False

    def recent_posts(self, subreddit, since):
        if not self.reddit_blocked:
            try:
                listing = fetch_json(
                    f"https://www.reddit.com/r/{subreddit}/new.json?limit=100&raw_json=1"
                )
                time.sleep(2)  # well under reddit's unauthenticated rate limit
                posts = [child["data"] for child in listing["data"]["children"]]
                return [post for post in posts if post["created_utc"] >= since.timestamp()], "reddit"
            except urllib.error.HTTPError as error:
                if error.code not in (403, 429):
                    raise
                print(f"reddit returned {error.code}; using the Arctic Shift archive", file=sys.stderr)
                self.reddit_blocked = True
        self.used_archive = True
        query = urllib.parse.urlencode({
            "subreddit": subreddit,
            "after": since.strftime("%Y-%m-%dT%H:%M:%S"),
            "limit": 100,
            "sort": "desc",
        })
        url = f"https://arctic-shift.photon-reddit.com/api/posts/search?{query}"
        try:
            posts = fetch_json(url)["data"]
        except urllib.error.HTTPError:
            time.sleep(5)  # the archive API fails intermittently; one retry is enough
            posts = fetch_json(url)["data"]
        time.sleep(1)
        return posts, "archive"


def hn_posts(since):
    stories = {}
    for query in HN_QUERIES:
        params = urllib.parse.urlencode({
            "query": query,
            "tags": "story",
            "numericFilters": f"created_at_i>{int(since.timestamp())}",
            "hitsPerPage": 50,
        })
        for hit in fetch_json(f"https://hn.algolia.com/api/v1/search_by_date?{params}")["hits"]:
            stories[hit["objectID"]] = hit
        time.sleep(0.5)
    return list(stories.values())


# "[2 YoE, Unemployed, Analyst, USA]" style resume review requests: only worth it
# when the title itself is about one of the topics.
REVIEW_REQUEST = re.compile(r"^\[[^\]]*(yoe|student|unemployed|grad)[^\]]*\]", re.I)


def classify(title, body):
    """Topic -> strength: 3 if in the title, 2 if repeated in the body."""
    title, body = title.lower(), body.lower()
    strengths = {}
    for topic, pattern in TOPICS.items():
        if pattern.search(title):
            strengths[topic] = 3
        elif len(pattern.findall(body)) >= 2:
            strengths[topic] = 2
    return strengths


def asks_question(title, body):
    # A question mark in the title, or an explicit ask near the start of the body.
    return "?" in title or bool(QUESTION.search(title.lower())) or bool(QUESTION.search(body[:400].lower()))


def rank_score(topics, is_question, upvotes, comments, age_hours):
    return (
        sum(topics.values())
        + (2 if is_question else 0)
        + math.log2(1 + max(upvotes, 0))
        + math.log2(1 + comments)
        - age_hours / 24
    )


def reddit_candidates(source, since, now):
    candidates, scanned = [], 0
    for subreddit, (link_policy, rule) in SUBREDDITS.items():
        try:
            posts, origin = source.recent_posts(subreddit, since)
        except (urllib.error.URLError, TimeoutError, KeyError) as error:
            print(f"r/{subreddit}: skipped ({error})", file=sys.stderr)
            continue
        scanned += len(posts)
        for post in posts:
            body = post.get("selftext") or ""
            if post.get("stickied") or body in ("[removed]", "[deleted]") or post.get("removed_by_category"):
                continue
            if EXCLUDE.search(f"{post['title']}\n{body}".lower()):
                continue
            topics = classify(post["title"], body)
            if REVIEW_REQUEST.search(post["title"]) and 3 not in topics.values():
                continue
            if not topics:
                continue
            is_question = asks_question(post["title"], body)
            if 3 not in topics.values() and not is_question:
                continue
            age_hours = (now.timestamp() - post["created_utc"]) / 3600
            candidates.append({
                "platform": "reddit",
                "where": f"r/{subreddit}",
                "subreddit": subreddit,
                "title": post["title"],
                "url": f"https://www.reddit.com{post['permalink']}",
                "upvotes": post.get("score", 0),
                "comments": post.get("num_comments", 0),
                "age_hours": age_hours,
                "topics": topics,
                "is_question": is_question,
                "link_policy": link_policy,
                "rule": rule,
                "origin": origin,
                "excerpt": " ".join(body.split())[:220],
                "score": rank_score(topics, is_question, post.get("score", 0), post.get("num_comments", 0), age_hours),
            })
    return candidates, scanned


def hn_candidates(since, now):
    candidates = []
    stories = hn_posts(since)
    for story in stories:
        title = story.get("title") or ""
        story_text = re.sub(r"<[^>]+>", " ", story.get("story_text") or "")
        topics = classify(title, story_text)
        if not topics:
            continue
        is_question = asks_question(title, story_text) or title.startswith("Ask HN")
        age_hours = (now.timestamp() - story["created_at_i"]) / 3600
        points, comments = story.get("points") or 0, story.get("num_comments") or 0
        is_show_hn = (story.get("title") or "").startswith("Show HN")
        candidates.append({
            "platform": "hn",
            "where": "HN",
            "subreddit": "hn",
            "title": story["title"],
            "url": f"https://news.ycombinator.com/item?id={story['objectID']}",
            "upvotes": points,
            "comments": comments,
            "age_hours": age_hours,
            "topics": topics,
            "is_question": is_question,
            # Links are normal on HN when relevant; on someone else's Show HN, don't pitch.
            "link_policy": "no" if is_show_hn else "disclosed",
            "rule": "Someone else's Show HN: give feedback, don't pitch" if is_show_hn
            else "Links fine when directly relevant; say you built it",
            "origin": "algolia",
            "excerpt": " ".join(story_text.split())[:220],
            "score": rank_score(topics, is_question, points, comments, age_hours),
        })
    return candidates, len(stories)


def reply_angle(candidate):
    main_topics = sorted(candidate["topics"], key=candidate["topics"].get, reverse=True)[:2]
    angles = [REPLY_ANGLES[topic] for topic in main_topics]
    if candidate["link_policy"] == "disclosed" and candidate["is_question"]:
        link_lines = [
            LINK_ANGLES[topic].format(sub=candidate["subreddit"])
            for topic in main_topics if LINK_ANGLES[topic]
        ]
        if link_lines:
            angles.append(link_lines[0] + " Say you built it in the same sentence.")
    elif candidate["link_policy"] == "no":
        angles.append("No link, no mention of OpenApply. Write it by hand; several of these subs ban AI-written text.")
    elif candidate["link_policy"] == "thread":
        angles.append("No link here; OpenApply only goes in the monthly promo thread.")
    return " ".join(angles)


LINK_LABELS = {"no": "no links", "disclosed": "link OK if disclosed", "thread": "monthly promo thread only"}


def format_age(hours):
    return f"{hours:.0f}h" if hours < 48 else f"{hours / 24:.1f}d"


def render(candidates, now, hours, used_archive, scanned):
    lines = [
        "---",
        "tags: [openapply, growth, threads]",
        "---",
        "",
        f"# Threads to reply to: {now:%Y-%m-%d}",
        "",
        f"Generated {now:%Y-%m-%d %H:%M} UTC by `scripts/growth/threads.py` (last {hours}h). "
        f"Top {len(candidates)} from {scanned['reddit']} Reddit posts and {scanned['hn']} HN stories scanned. "
        "Nothing here has been posted; reply by hand, one thread at a time, and only where you have something useful to add.",
        "",
    ]
    if used_archive:
        lines += [
            "> Reddit blocked the public .json listing from this network, so Reddit posts came from the Arctic Shift "
            "archive. Their upvote/comment counts are snapshots from seconds after posting (usually 1/0). "
            "Open the thread to see the real numbers before replying.",
            "",
        ]
    if not candidates:
        lines.append("No matching threads in this window.")
    for rank, candidate in enumerate(candidates, start=1):
        counts = f"{candidate['upvotes']}↑ {candidate['comments']}c"
        if candidate["origin"] == "archive":
            counts += " (at ingest)"
        lines += [
            f"## {rank}. {candidate['title']}",
            "",
            f"- **Link:** {candidate['url']}",
            f"- **Where:** {candidate['where']} · **Age:** {format_age(candidate['age_hours'])} · **Votes/comments:** {counts}",
            f"- **Topics:** {', '.join(candidate['topics'])}{' · question' if candidate['is_question'] else ''}",
            f"- **Links allowed:** {LINK_LABELS[candidate['link_policy']]} ({candidate['rule']})",
            f"- **Reply angle:** {reply_angle(candidate)}",
        ]
        if candidate["excerpt"]:
            lines.append(f"- **Excerpt:** {candidate['excerpt']}")
        lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--hours", type=int, default=48, help="look-back window (default 48)")
    parser.add_argument("--limit", type=int, default=30, help="max threads in the output (default 30)")
    parser.add_argument("--out", help="output file (default: sprint vault threads/YYYY-MM-DD.md)")
    args = parser.parse_args()

    now = dt.datetime.now(dt.timezone.utc)
    since = now - dt.timedelta(hours=args.hours)
    source = RedditSource()
    reddit, reddit_scanned = reddit_candidates(source, since, now)
    hn, hn_scanned = hn_candidates(since, now)
    ranked = sorted(reddit + hn, key=lambda candidate: candidate["score"], reverse=True)[: args.limit]
    scanned = {"reddit": reddit_scanned, "hn": hn_scanned}
    output = render(ranked, now, args.hours, source.used_archive, scanned)

    out_path = args.out or os.path.join(VAULT_DIR, f"{now:%Y-%m-%d}.md")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as output_file:
        output_file.write(output)
    print(f"{len(ranked)} threads -> {out_path}")


if __name__ == "__main__":
    main()
