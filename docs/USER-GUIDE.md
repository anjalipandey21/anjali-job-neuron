# Job Neuron User Guide

Welcome to **Job Neuron** — your AI-powered job search assistant. This guide walks you through every feature so you can make the most of the platform.

---

## Getting Started

Job Neuron is **invite-only**. You'll receive an email invitation with a link to set your password. Once logged in, you'll create a profile and begin your job search.

### First Login

1. Click the invitation link in your email and set a password.
2. Log in at [Job Neuron.netlify.app](https://Job Neuron.netlify.app).
3. Create your first profile — give it a name (e.g., "Software Engineer" or "Data Analyst").
4. A welcome guide will appear showing you the 4 key steps. Click **Get Started** to jump to the Resume page, or **Skip** to explore on your own.

### Multiple Profiles

You can create multiple profiles under one account — useful if you're searching for different roles (e.g., "Frontend Developer" vs. "Product Manager") or managing job searches for family members. Switch between profiles from the profile menu in the top nav or from the Settings page.

---

## Navigation

- **Desktop / Tablet**: A top navigation bar appears at the top of the screen with links and a profile menu in the top-right corner.
- **Mobile**: A bottom tab bar provides easy thumb navigation.

There are five sections:

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Overview of metrics, upcoming tasks, and recent activity |
| **Resume** | Upload and analyze your resume |
| **Jobs** | Search for AI-matched job listings |
| **Applications** | Track your application pipeline |
| **Settings** | Configure preferences, search filters, and account |

The profile menu (top-right on desktop, Settings page on mobile) gives you access to Switch profile, Admin panel (if applicable), Report a bug, and Sign out.

---

## Resume

**Upload your resume for AI analysis, ATS scoring, and keyword optimization.**

### Uploading

- **PDF or Word**: Click "Upload Resume" and select your file. Text is extracted automatically.
- **Paste text**: Click "Paste text" and paste your resume content directly.

### AI Analysis

Once uploaded, click **Analyze Resume**. The AI extracts:
- **Skills** — technical and soft skills identified in your resume
- **Roles** — job titles and positions you've held
- **Experience** — years and areas of experience
- **Education** — degrees and certifications

### ATS Score

Click **Run ATS Scan** to simulate how an Applicant Tracking System would score your resume. You'll get:
- An overall score across 8 categories
- Specific suggestions for improving each category
- Actionable fixes you can apply immediately

The ATS scan runs as a background job — you can navigate away and come back when it's done.

---

## Find Jobs

**Search AI-matched jobs, customize your resume per role, and apply with one click.**

### Searching

1. Set your preferences in **Settings** first (roles, location, work type, job type, date window).
2. Go to **Find Jobs** and click **Find jobs**.
3. The system queries Google Jobs via SerpApi across 5 pages in parallel, returning up to 50 unique listings.
4. Dead or expired job links are filtered out automatically.
5. Each job is scored **0–100%** against your full resume using AI, sorted highest match first.

The first 10 results appear immediately. Scroll to the bottom to load 10 more — keep scrolling until you've seen all available jobs for the day.

### Filter Bar

The filter bar is always visible above the search button. Use it to override your default preferences for a single search without changing your Settings:

- **Roles / keywords** — override the job titles to search for
- **Location** — override the preferred location
- **Work type** — any, remote, or on-site
- **Job type** — any, full-time, contract, or part-time
- **Date posted** — last 30, 60, or 90 days (session-only; resets to your Settings preference on next visit)

Collapse the panel with the ▾ Filters toggle if you need more screen space.

### Daily Scheduled Search

Enable **Daily Job Search** in Settings to automatically search for new jobs every day at 8 AM in your timezone. Results appear in the Find Jobs tab.

### Job Cards

Each job card shows:
- **Match score** (color-coded: green = great match, yellow = moderate, red = low)
- **Company and title**
- **Location and salary** (when available)
- **Visa sponsorship badge** (green = sponsors, red = no sponsorship)
- **Job description** displayed as a structured grid (Qualifications, Responsibilities, Benefits, Overview)

### Actions on Each Job

- **Details** — expand to see the full job description
- **Customize** — generate an AI cover letter and 5 resume highlights tailored to this specific job
- **Tailor Resume** — get a detailed gap analysis with section scores, before/after rewrite suggestions, and missing keyword identification
- **Skip** — mark as "Not Interested" (hidden from future searches; undo from skipped list)
- **Apply** — opens the best application link and saves the job to your Applications tracker

### Apply Links

Each job shows up to 3 prioritized links: company career site first, then LinkedIn, Indeed, and other boards.

---

## Applications

**Monitor your pipeline from applied through interview to offer, with tasks and notes.**

### Pipeline Stages

Every application moves through these stages:
- **Applied** — you've submitted your application
- **Interview** — you have an interview scheduled or in progress
- **Offer** — you've received an offer
- **Rejected** — the application was declined

Change the status using the dropdown on each application card.

### Adding Jobs Manually

Click **+ Add Job** to manually add a job you found outside of Job Neuron. Enter the job title, company, URL, and any notes.

### Tasks

Each application has its own task list. Click **Tasks** on any application card to:
- Add custom tasks with due dates
- Use preset quick-add buttons (e.g., "Follow up", "Prepare for interview")
- Track overdue tasks (shown with a red badge)

### Activity Log

Click **Activity** on any application card to see the event timeline — status changes, phone calls, emails, and interviews are all logged with timestamps.

### Cover Letter Generation

From an application card, click **Customize** to generate a tailored cover letter using the saved job data. The AI produces a structured analysis with a cover letter, key highlights, and resume tweaks.

---

## Dashboard

**Track your metrics, upcoming tasks, and recent activity across all applications.**

The Dashboard gives you a quick overview:
- **Quick stats** — total applications, interviews, offers, match score average
- **Upcoming tasks** — tasks due soon across all applications
- **Overdue tasks** — tasks past their due date (highlighted in red)

---

## Settings

**Configure your profile preferences, job search filters, and account settings.**

### Job Search Preferences

- **Roles** — job titles to search for (comma-separated)
- **Locations** — preferred locations (e.g., "Remote, San Francisco, New York")
- **Work type** — remote, on-site, or hybrid
- **Job type** — full-time, part-time, contract, internship
- **Date window** — search jobs posted within the last 30, 60, or 90 days

### Daily Job Search

Toggle the automatic daily search on or off. When enabled, Job Neuron searches for new jobs every morning at 8 AM in your timezone.

### AI Provider

Job Neuron supports multiple AI providers. The default is Gemini 2.0 Flash. Your admin can switch between Gemini, Claude, OpenAI, or Groq.

### Developer Tools

- **Debug logging** — toggle structured JSON logging in the browser console for troubleshooting

### Help & Feedback

Found a bug? Use the **Report a bug** link in the profile menu (top-right) or in **Settings > Help & Feedback** to open a GitHub issue.

---

## Tips for Best Results

1. **Upload a detailed resume** — the more content the AI has, the better your match scores and tailored outputs will be.
2. **Run the ATS scan** — fix the suggestions before searching for jobs to maximize your match scores.
3. **Use Tailor Resume** on your top matches — the before/after rewrite suggestions help you customize your resume for each application.
4. **Check daily** — if you enable scheduled search, new jobs appear every morning. The best listings get taken quickly.
5. **Track everything** — use the Applications pipeline and task system to stay organized across multiple applications.

---

## Reporting Bugs

If you encounter a bug or have a feature request:
- Click the **Report a bug** link in the profile menu (top-right corner on desktop)
- Or go to **Settings > Help & Feedback**
- Both link to the [GitHub Issues page](https://github.com/jadhavnikhil78/jobhunter-ai/issues)

Please include a description of what happened and what you expected to happen.
