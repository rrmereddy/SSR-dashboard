# SSR Dashboard

A smart, server-first job dashboard built for the hackathon!  
This project leverages modern web technologies to provide a seamless experience for resume analysis, job tracking, and collaborative features.

## 🚀 Project Overview

SSR Dashboard is designed to help users:
- **Upload and analyze resumes** using AI for instant feedback and suggestions.
- **Build and edit resumes** interactively.
- **Track coding progress** (e.g., LeetCode) and GitHub activity.
- **Collaborate and chat** with team members in real time.

## ✨ Features

- **AI Resume Analysis:** Upload your PDF resume and get instant, actionable feedback powered by server-side AI.
- **Resume Builder:** Edit, enhance, and export your resume directly from the dashboard.
- **Job & Coding Tracker:** Visualize your GitHub and LeetCode progress.
- **Collaboration Tools:** Real-time chat and collaboration features (in progress).
- **Modern UI:** Built with reusable components and a clean, responsive design.

## 🛠️ Technologies Used

- **Next.js 15** (App Router, Server Components)
- **React 19**
- **Tailwind CSS** (with custom themes)
- **Supabase** (authentication & database)
- **AI/ML:** Google Generative AI for resume analysis
- **PDF Processing:** `pdf-parse`, `html2canvas`, `jspdf`
- **Radix UI** (for accessible UI components)
- **TypeScript** (type safety)
- **Other:** Sonner, Lucide React, and more

## 🏁 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Run the development server:**
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Live Demo

The project is deployed on Vercel:
👉 [https://ssr-dashboard.vercel.app/](https://ssr-dashboard.vercel.app/)

**⚠️ Note:** The resume analyzer uses the Gemini API, which has usage limits. Please be mindful of these limits when uploading and analyzing resumes.

## 📂 Project Structure

- `/app` - Main application (pages, dashboard, auth, resume)
- `/components` - Reusable UI components
- `/server` - Server-side logic (resume analysis, etc.)
- `/lib` - Utility functions and API clients
