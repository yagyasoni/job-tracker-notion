# JobSync - Job Posting to Notion Extension

## Overview

A Chrome extension that automatically scrapes job posting details from career websites and saves them directly to your Notion database. Streamline your job application tracking with one-click data extraction and organized storage.

## 📽️ Demo Video

[![Watch the video](https://img.youtube.com/vi/VIDEO_ID_HERE/0.jpg)]([https://www.youtube.com/watch?v=VIDEO_ID_HERE](https://drive.google.com/file/d/1WuaLOgxC52sO5s0gPxp3k9gbwsPNQPQv/view?usp=sharing))


## Features

- **Auto-scraping**: Extract job title, company, location, and description from career sites
- **Notion Integration**: Save directly to your personal Notion database
- **Status Tracking**: Mark applications as Applied, Wishlist, Interviewing, Rejected, etc.
- **Multi-platform Support**: Works with Greenhouse, Lever, BambooHR, Workable, and more
- **Editable Fields**: Review and modify scraped data before saving

## Prerequisites

- Node.js (v16+)
- Chrome browser
- Notion account with API access

## Installation

### 1. Build the Project

```bash
# Clone and install dependencies
git clone <your-repository-url>
cd job-posting-to-notion-extension
npm install

# Build the extension
npm run build
```

### 2. Load Extension into Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **"Load unpacked"**
4. Select the `dist` folder
5. Extension appears in Chrome toolbar

### 3. Configure Notion API

#### Create Notion Integration:
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create new integration and copy the **API token**

#### Setup Database:
1. Create a Notion database with these properties:
   - **Job Title** (Title)
   - **Company** (Text)
   - **Location** (Text)
   - **Description** (Text)
   - **URL** (URL)
   - **Status** (Select options: Applied, Wishlist, Interviewing, Rejected, Offer, Closed, N/A)
2. Share database with your integration
3. Copy **Database ID** from URL: `https://www.notion.so/{workspace}/{DATABASE_ID}?v={view_id}`

#### Configure Extension:
1. Click extension icon in Chrome
2. Enter **Notion API Key** and **Database ID**
3. Click **"Save Notion Config"**

## How to Use

1. **Navigate** to any job posting on career websites
2. **Open extension** and paste the job URL
3. **Click "Scrape Details"** to auto-extract job information
4. **Review/edit** the populated fields if needed
5. **Select status** (Applied, Wishlist, etc.)
6. **Click "Add to Notion"** to save to your database

## Why I Built This

While applying for jobs through company career websites, I consistently faced a frustrating problem:

**The Challenge**: Company career websites mostly have long response times. When responses finally arrive in your email, you have to search through your inbox to remember which job you applied for. Unlike LinkedIn Easy Apply or other platforms that keep application history, direct company applications aren't readily tracked.

**The Reality**: When you're applying to multiple companies simultaneously, it becomes nearly impossible to keep track of all applications. You end up wasting precious time trying to find job details and remember which positions you've applied for.

**The Solution**: JobSync eliminates this time-wasting search process by instantly capturing and organizing all your job applications in one centralized Notion database.

## Supported Platforms

- Greenhouse.io
- Lever.co  
- BambooHR
- Workable
- SmartRecruiters
- JazzHR
- Most company career pages

## Troubleshooting

**Extension won't load**: Ensure you built the project (`npm run build`) and loaded the `dist` folder

**Scraping fails**: Verify you're on the actual job posting page and the site is supported

**Notion sync issues**: Check API key, Database ID, and ensure database is shared with integration

## Tech Stack

- React 18 + Vite
- Chrome Extensions Manifest V3
- Notion API
- Lucide React icons

---

**Stop losing track of job applications with JobSync. Organize your career journey effortlessly.**
