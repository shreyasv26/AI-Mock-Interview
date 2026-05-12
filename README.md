# AI Mock Interview Platform

AI Mock Interview Platform is a full-stack web application that helps users prepare for technical and HR interviews using AI-generated questions and feedback. Users can upload resumes, attend mock interviews, receive performance analysis, and track their improvement over time.

---

# Features

- User authentication using JWT
- Resume upload and parsing (PDF/DOCX)
- AI-generated interview questions using Gemini API
- Technical and HR interview rounds
- AI-based answer evaluation and feedback
- Progress tracking and performance analysis
- Personalized learning recommendations
- Responsive frontend using React

---

# Tech Stack

## Frontend
- React.js
- JavaScript
- Tailwind CSS

## Backend
- Python
- Flask

## Database
- MySQL

## AI Integration
- Google Gemini API

## Resume Parsing
- spaCy
- PyMuPDF
- python-docx

---

# Installation and Setup

## 1. Clone Repository

```bash
git clone https://github.com/shreyasv26/AI-Mock-Interview.git
cd AI-Mock-Interview
```

---

## 2. Backend Setup

### Create Virtual Environment

```bash
python -m venv venv
```

### Activate Virtual Environment

#### Windows

```bash
venv\Scripts\activate
```

#### Mac/Linux

```bash
source venv/bin/activate
```

### Install Backend Dependencies

```bash
pip install -r requirement.txt
```

### Install spaCy Model

```bash
python -m spacy download en_core_web_sm
```

---

## 3. Configure Environment Variables

Create a `.env` file inside the `backend` folder.

```env
GEMINI_API_KEY=YOUR_API_KEY

SECRET_KEY=YOUR_SECRET_KEY
JWT_SECRET=YOUR_JWT_SECRET

DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=ai_interview
DB_USER=root
DB_PASSWORD=YOUR_PASSWORD
```

---

## 4. Database Setup

Create the database in MySQL:

```sql
CREATE DATABASE ai_interview;
```

Create the required tables:
- users
- resumes
- sessions
- questions
- answers
- progress
- learn_section

---

## 5. Frontend Setup

Install frontend dependencies:

```bash
cd frontend
npm install
```

---

# Running the Application

## Start Backend Server

```bash
cd backend
python app.py
```

Backend runs on:

```bash
http://127.0.0.1:5000
```

---

## Start Frontend Server

```bash
cd frontend
npm start
```

Frontend runs on:

```bash
http://localhost:3000
```

---

# Core Functionalities

## Resume Analysis
- Extracts skills and experience
- Parses projects and education details
- Identifies important resume keywords

## AI Interview System
- Generates role-specific interview questions
- Supports technical and HR interview rounds
- Evaluates answers using Gemini AI

## Performance Tracking
- Technical score analysis
- Communication evaluation
- Overall performance tracking

## Learning Recommendations
- Skill-gap identification
- Personalized improvement suggestions
- Recommended learning resources

---

# Authentication

- JWT-based authentication
- Secure session management
- Protected API routes

---

# Future Enhancements

- Voice-based interviews
- Video interview analysis
- Real-time coding rounds
- AI-based emotion analysis
- Leaderboard system

---

