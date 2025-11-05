---
layout: ../../layouts/BlogPost.astro
title: 'Job Search Tips and Tricks'
pubDate: 2025-11-05
description: 'In this post I want to share some insights on optimizing your LinkedIn profile for job search, applying for jobs effectively, and a prompt for generating AI-powered cover letters.'
author: 'Sergey Khval'
image:
    url: ''
    alt: ''
tags: ["LinkedIn Profile Optimization", "Job Search", "AI Generated Cover Letter", "Cover Letter Prompt"]
---

I got laid off about 6 weeks ago and before that I’ve worked at a company where we were building a product that would automate the recruiter’s job. During this time I’ve learned a couple of things about recruiters’ work and what they pay attention to while screening through candidates. I’ve incorporated this knowledge into my job search and yesterday I accepted a job offer. With a high probability I got lucky and all of this is just survivor’s bias but anyway I’d like to share some insights, how I approached job search and what actually worked for me. If this increases someone’s chances even by a couple of percent that’s already great.

# Optimizing LinkedIn

Recruiters scan LinkedIn profiles a lot. We had candidate profiles baked into our app but recruiters still straight up ignored them and went to check out LinkedIn. And most of the time recruiters look for certain signals. Here is a couple of things that actually matter on your profile.

1. Remove #OpenToWork badge. Too many times have I heard how recruiters call this badge “green badge of desperation”. This might sound silly, but number one thing we advised any candidate that we worked with was to remove this badge. In the eyes of a recruiter you’re essentially labeling yourself as “loser”. If you have relevant experience recruiters will find/open your profile anyway, so it’s very unlikely that this badge generates any views for you at all.
2. Include keywords. Make sure to include keywords relevant to your job search in multiple places: headline, about section, work experience section. So if you’re, let’s say, an account executive your profile should be screaming that you’re one.
3. Recruiters are obsessed with startup experience. If you have one you need to put it front and top on your profile. Words and phrases like “startup experience”, “fast paced environment”, “SaaS”, “AI first / AI powered” give you additional points.
4. Job hoppiness is a huge red flag. Every single client that we had included this criteria one way or another into their candidate search. If you have a history of changing jobs frequently (every 1-2 years) or you’ve stayed with your current company for less than 2 years you are considered job hoppy. I know about all the perks and benefits of changing companies, but if you want to land a job you need to think about how to hide this info on your LI profile.
5. Achievements. This is especially important for recent grads or entry level positions. Recruiters care about them, especially if you have sport achievements. This correlates with your ability to set goals and work towards them with dedication. In a broader sense make sure to add any awards to your profile, like “top performer”, “rookie of the month” etc.
6. Start posting. Post 2-3 times a week on your professional topic. Doesn’t need to be a long post, a couple of sentences is enough. This builds your profile visibility and works much better than the #OpenToWork badge. Recruiters started to outreach me (which hasn’t happened for a couple of years) after I began to post more frequently.

# Applying for jobs

Looks like hiring today is a game of numbers. Luck plays a huge role but you can still do something to skew odds in your favor. Every little change that you introduce starts to stack until you eventually see the results. Here is the strategy that worked for me.

1. Update your resume. You can just drop your resume and a job description into ChatGPT and ask to point out your weak spots. Iterate multiple times until ChatGPT consistently gives you output that your resume totally matches with the JD. You can also try to tailor your resume for every JD, but I personally found this as a waste of time, ROI is too low here.
2. Apply everywhere. Apply early if you can but don’t be discouraged if the vacancy is a couple of weeks old. Apply to the same vacancy through multiple channels if possible: from job board, directly through recruiter if you found an email, on LinkedIn. Aim to apply for at least 20 jobs a day.
3. Keep track of your applications. I started to track everything from day 1 in a spreadsheet and thank God I did it. When the number of your job applications crosses 25-30, you start to forget where you applied, what contacts you had, what you talked about etc. Simple spreadsheet works, save at least company name, position, link to job description, date when you applied.
4. Always add cover letter to your application if possible. You can drop your resume and job description into ChatGPT and it will write pretty decent cover letter (exact cover letter prompt at the bottom of the post). I have repeated this step so many times that I have implemented this exact application [openapply.app](https://openapply.app) to automate this process.
5. Manage your applications. It’s not enough to just apply for a job. You should treat this step only as the top of your funnel. Every day look at the jobs that you’ve already applied for and go through the same routine:

* check all applications starting from the ones most deep into the process
* do you have any interviews / calls scheduled? If yes - prepare for those first. Make sure that you’re ready to execute and if you miss anything - work out a plan on how you’re going to prepare
* are there any applications that you applied for more than 3 days ago and still haven’t got reply? If yes - follow up with them. If you don’t have recruiter’s email - apply again with a different cover letter mentioning that you’ve already applied but wanted to check in if the opportunity is still open and they’ve seen your application
* if there are applications that you’ve already followed up on and still didn’t get a reply after another 3 days, archive them: you probably won’t hear back from them so it’s better to archive and not get distracted
* have you applied for 20 jobs today? If not - go on and apply

Rinse and repeat every day. Complete these steps in order, it’s important to first spend time on the applications you’ve already got response from.

# Cover Letter Prompt

```
You are an expert career coach and professional writer
specializing in crafting compelling cover letters.
Your task is to create a personalized, 
professional cover letter that effectively 
matches the candidate's experience with the job requirements. 

CANDIDATE INFORMATION: 
Company: {{ companyName }} 
Position: {{ position }} 
RESUME CONTENT: {{ resumeText }} 
JOB DESCRIPTION: {{ jobDescription }}

INSTRUCTIONS:

1. Write a professional cover letter that: 
- Opens with a strong, engaging introduction that shows enthusiasm for the specific role and company 
- Highlights 2-3 of the most relevant experiences and achievements from the resume that directly align with the job requirements 
- Demonstrates understanding of the company's needs and how the candidate can add value 
- Uses specific examples and quantifiable achievements when available 
- Maintains a professional yet personable tone 
- Closes with a clear call to action 

2. Structure: 
- Professional salutation (use "Dear Hiring Manager" if no specific name is available) 
- 3-4 concise paragraphs (opening, 1-2 body paragraphs highlighting relevant experience, closing) 
- Professional sign-off, make sure to include candidate's name and last name at the end 

3. Style Guidelines: 
- Keep it concise (150-200 words) 
- Use active voice 
- Avoid clichés and generic statements 
- Tailor language to match the company's tone (formal for traditional companies, slightly more casual for startups) 
- Write cover letter in the same language as the job description 
- Do not repeat the resume verbatim; instead, expand on key points with context 

4. DO NOT: 
- Include placeholder text like [Your Name] or [Date] 
- Add contact information headers (these will be added separately) 
- Make up information not present in the resume 
- Use overly aggressive or desperate language 

Generate the cover letter body text only, starting with the salutation and ending with the sign-off.
```