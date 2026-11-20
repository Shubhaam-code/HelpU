# Helpu — The All-in-One Campus Super-App 🚗🎓📚

[![React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Bundler-Vite%208-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Capacitor 8](https://img.shields.io/badge/Mobile-Capacitor%208%20Android-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Firebase Auth](https://img.shields.io/badge/Auth-Firebase%20%2B%20Google-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini 2.5 Flash](https://img.shields.io/badge/AI%20Vision-Gemini%202.5%20Flash-4285F4?logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Mongoose-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)

> **Helpu** is an all-in-one university mobility, academic matchmaking, and timetable registration platform built specifically for students. It unifies campus carpooling (**PoolMate**), free-slot academic matching (**SlotMate**), and an AI-powered course schedule builder (**FFCS Mate**) into a responsive cross-platform web and native Android application.

---

## 📑 Table of Contents

- [Core Modules](#-core-modules)
  - [1. PoolMate (Ride Sharing & Cab Pooling)](#1-poolmate-ride-sharing--cab-pooling-)
  - [2. SlotMate (Academic Timetable Matching)](#2-slotmate-academic-timetable-matching-)
  - [3. FFCS Mate (Smart Curriculum & Faculty Selection)](#3-ffcs-mate-smart-curriculum--faculty-selection-)
- [Tech Stack](#%EF%B8%8F-tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started & Local Setup](#-getting-started--local-setup)
  - [Prerequisites](#prerequisites)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Frontend Setup](#2-frontend-setup)
- [Environment Configuration & Security](#-environment-configuration--security)
- [Building the Android APK](#-building-the-android-apk)
- [License](#-license)

---

## 🚀 Core Modules

### 1. PoolMate (Ride Sharing & Cab Pooling) 🚗
* **Route Matching & Direction Normalization:** Intelligently pairs students traveling on identical routes between campus and transit hubs (e.g., Bhopal Junction, RKMP, Airport).
* **Cost Splitting & Inventory Management:** Transparent per-seat fare calculation with real-time seat inventory updates.
* **Instant WhatsApp Coordination:** One-tap connection with verified campus co-travelers without exchanging numbers in crowded groups.
* **Smart Filter & Search:** Filter by date, departure time window, and vehicle type.

### 2. SlotMate (Academic Timetable Matching) 🎓
* **Free-Slot Discovery:** Find batchmates and friends who share identical free slots across the academic timetable.
* **Course & Faculty Search:** Instant search by course codes, subject names, or faculty members.
* **Study Group Pairing:** Match with lab partners and study companions effortlessly.

### 3. FFCS Mate (Smart Curriculum & Faculty Selection) 📚
* **AI-Powered Multi-Format Extraction (Google Gemini 2.5 Flash):** Extract timetable and curriculum schedules from images (PNG, JPG, WebP) and PDFs simultaneously.
* **Parallel Batch Extraction:** Submit up to 8 courses at once; extracts all courses concurrently in seconds via `Promise.allSettled`.
* **In-App File Previews:** Fullscreen interactive preview modal for images and PDFs with multi-page viewer and download options.
* **Faculty Review & Slot Clash Detection:** Compare faculty ratings, view course credits, and generate conflict-free timetable combinations.

---

## 🛠️ Tech Stack

| Area | Technology |
|---|---|
| **Frontend Framework** | React 19, Vite 8, React Router v7 |
| **Styling & Icons** | Tailwind CSS v4, Lucide React, Framer Motion |
| **Mobile & Hybrid App** | Capacitor 8 (Android Platform, Status Bar, Push Notifications) |
| **Authentication** | Firebase Authentication (Google Sign-In + Email/Password) |
| **Backend API** | Node.js, Express.js |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **AI Vision Engine** | Google Gemini 2.5 Flash API (`@google/genai`) |
| **Async Queues & Cache** | Redis, BullMQ (for background notifications & cache) |

---

## 📂 Project Directory Structure

```text
helpu/
├── backend/
│   ├── src/
│   │   ├── config/          # Database (MongoDB), Firebase Admin & Redis config
│   │   ├── controllers/     # Route controllers (Auth, Travel, FFCS, etc.)
│   │   ├── middlewares/     # Auth verification, file upload (Multer)
│   │   ├── models/          # Mongoose database models
│   │   ├── routes/          # Express API route declarations
│   │   ├── services/        # Business logic & Gemini AI Vision service
│   │   └── app.js           # Express app definition
│   ├── server.js            # HTTP server entrypoint
│   └── .env.example         # Template for backend secrets
│
├── frontend/
│   ├── android/             # Capacitor Android native studio project
│   ├── src/
│   │   ├── assets/          # Compressed images, icons, illustrations
│   │   ├── components/      # Reusable UI components & Service Switcher
│   │   ├── context/         # React Contexts (Auth, State)
│   │   ├── features/
│   │   │   ├── ffcs/        # FFCS Mate (AddCourseScreen, CourseSelection, etc.)
│   │   │   ├── rides/       # PoolMate (Rides listing, create offer, booking)
│   │   │   └── slot-friend/ # SlotMate (Timetable & slot matching)
│   │   ├── App.jsx          # App router and global wrappers
│   │   └── main.jsx         # React application mount
│   ├── capacitor.config.json# Capacitor mobile app configuration
│   └── .env.example         # Template for frontend environment variables
│
└── .gitignore               # Strict gitignore protecting keys, envs, and builds
```

---

## 💻 Getting Started & Local Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **MongoDB**: Local MongoDB instance or free MongoDB Atlas URI
* **Android Studio**: (Optional, required only for native APK builds)

### 1. Backend Setup

```bash
cd backend
npm install

# Copy environment variables template
cp .env.example .env

# Run the development server
npm run dev
```
> The backend server starts at `http://localhost:5000`.

### 2. Frontend Setup

```bash
cd frontend
npm install

# Copy environment variables template
cp .env.example .env

# Start Vite development server
npm run dev
```
> The web application starts at `http://localhost:5173`.

---

## 🔐 Environment Configuration & Security

> ⚠️ **Security Notice:** Never commit `.env` or credential files to GitHub. Always use `.env.example` templates.

### Frontend (`frontend/.env.example`)
```env
VITE_API_URL=https://helpu.onrender.com

# Firebase Web App Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_web_app_id
```

### Backend (`backend/.env.example`)
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/helpu
JWT_SECRET=your_jwt_secret_key_here

# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Gemini API (For FFCS AI Vision Extraction)
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 📱 Building the Android APK

### Fast Terminal Build:
```powershell
cd frontend
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
```
The compiled APK will be generated at:
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

### Open in Android Studio:
```powershell
cd frontend
npm run cap:android
```

---

## 📄 License
This project is proprietary and developed for campus students. All rights reserved.
