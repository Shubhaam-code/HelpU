# Helpu — Campus Rides & Peer Travel Network 🚗🎓

[![React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Bundler-Vite%208-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Capacitor 8](https://img.shields.io/badge/Mobile-Capacitor%208%20Android-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Firebase Auth](https://img.shields.io/badge/Auth-Firebase%20%2B%20Google-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Mongoose-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable%20App-FF572E?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

> **Helpu** is an all-in-one university mobility and academic companion platform built for university students. It empowers students to offer rides, request seats, discover compatible co-travellers on identical routes, share course timetables via **SlotMate**, coordinate directly via WhatsApp, and split costs transparently with zero commission fees.

---

## 📑 Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Problem Statement](#2-problem-statement)
- [3. Key Features](#3-key-features)
- [4. Platform Architecture & Modules](#4-platform-architecture--modules)
  - [PoolMate (Campus Carpooling)](#poolmate-campus-carpooling)
  - [SlotMate (Academic Timetable Matching)](#slotmate-academic-timetable-matching)
  - [Guest-First Exploration](#guest-first-exploration)
  - [Startup Intro Experience](#startup-intro-experience)
- [5. Mobile & Native Android Integration](#5-mobile--native-android-integration)
- [6. Tech Stack](#6-tech-stack)
- [7. Folder Structure](#7-folder-structure)
- [8. Installation and Setup](#8-installation-and-setup)
- [9. Environment Variables](#9-environment-variables)
- [10. Android APK Build & Deployment](#10-android-apk-build--deployment)
- [11. Authentication & Security Flow](#11-authentication--security-flow)
- [12. Ride Matching Engine](#12-ride-matching-engine)
- [13. Push Notifications Pipeline](#13-push-notifications-pipeline)
- [14. Contributing Guidelines](#14-contributing-guidelines)
- [15. License](#15-license)

---

## 1. Project Overview

University campuses often suffer from limited public transit connectivity to central hubs such as railway stations, airports, shopping centers, and bus terminals. **Helpu** bridges this gap by creating an exclusive student-to-student mobility network alongside academic peer pairing.

Whether you are driving your car or two-wheeler to the city and have empty seats, looking to share a cab with peers heading home for the weekend, or finding batchmates with identical course slots, Helpu intelligently evaluates your travel and timetable data to connect you with verified peers.

---

## 2. Problem Statement

1. **Exorbitant Travel Expenses:** Cabs to transit hubs (e.g., Bhopal Junction, Rani Kamlapati, Raja Bhoj Airport) are expensive for solo students.
2. **Chaotic WhatsApp Groups:** Students flood informal chat groups with ad-hoc messages that are quickly buried and lack structured search, filters, or tracking.
3. **Safety & Identity Risks:** Travelling with unverified strangers poses safety concerns.
4. **Asymmetric Travel Direction:** Traditional chat groups result in accidental pairing of students traveling in opposite directions (e.g., Campus ➔ Station vs. Station ➔ Campus).
5. **Academic Isolation:** Students struggle to find peers taking the exact same courses, professors, and class timetable slots.

---

## 3. Key Features

- 🚘 **Offer Rides (PoolMate):** Post journey details, vehicle model, departure time, seat count, and seat price.
- 📍 **Passenger Requests:** Post a ride request when you need a ride to a specific campus or city destination.
- 🎯 **Rule-Based Smart Matching:** Automatically pair compatible offers and requests on identical routes, dates, and departure windows.
- 📚 **SlotMate (Slot Friend):** Match with classmates based on course codes, subject names, course slots, and faculty members.
- 🎬 **Premium Startup Video Intro:** Seamless H.264 offline-bundled startup animation with audio autoplay, first-frame poster preload, and automatic auth bypass for logged-in users.
- 🛡️ **Verified Student Profiles:** Campus identity authentication through Firebase Auth & Google Sign-In, university registration number verification, and WhatsApp onboarding.
- 💬 **Direct WhatsApp Coordination:** Once a seat request is confirmed, riders can connect instantly on WhatsApp with one click.
- 🔔 **Custom Native Android Chimes:** High-importance notifications channel (`helpu_alerts_v3`) with bundled custom `.wav` chime.
- 📱 **Native Android APK & PWA:** Android APK built via Capacitor 8 with edge-to-edge display and gesture navigation, plus installable PWA for web browsers.

---

## 4. Platform Architecture & Modules

### PoolMate (Campus Carpooling)
- Multi-stop route calculation between university campus and transit hubs.
- Automatic direction normalization (`vit bhopal`, `rkmp`, `bhopal junction`, `airport`).
- Real-time seat inventory decrements on accepted booking requests.
- Instant WhatsApp coordination deep links.

### SlotMate (Academic Timetable Matching)
- Search, filter, and match students taking identical course slots.
- Subject-based theme tags and course-code indexing.
- Direct messaging and peer connect for study groups and lab partners.

### Guest-First Exploration
- Allows prospective students and guests to explore ride listings, search routes, and browse course slots without initial login friction.
- Form inputs are saved to draft storage; login is requested only at the final confirmation step with seamless return redirection.

### Startup Intro Experience
- **First-Time / Logged-Out Users:** Fullscreen 9:16 portrait video (`/videos/helpu-intro.mp4`) with fast-start `moov` atom relocation and stereo audio.
- **First-Frame Poster Preload:** Uses static `helpu-intro-poster.jpg` overlay to eliminate native video play button flashes.
- **Logged-In Users:** Instantly bypasses the intro straight to `/home` or `/whatsapp-setup` with zero delay.
- **Session-Guarded:** Once played during an app session, it never replays on route changes or back-navigation.

---

## 5. Mobile & Native Android Integration

Helpu runs as a hybrid native application using **Capacitor 8**:

- **System Window Bars:** Dark icons with warm cream `#FFF8F3` theme on Android status bar and navigation bar.
- **Push Notification Channel:** `helpu_alerts_v3` with custom sound file `res/raw/helpu_notification_chime.wav`.
- **Autoplay Permission:** Configured `setMediaPlaybackRequiresUserGesture(false)` in `MainActivity.java` so startup audio plays seamlessly without requiring a tap.
- **Touch-Action Optimizations:** CSS `touch-action: pan-y` applied across all mobile scroll containers to guarantee smooth WebView swipe scrolling over illustrations and cards.

---

## 6. Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Lucide Icons, Framer Motion |
| **Mobile Runtime** | Capacitor 8 (Android Native Bridge, Push Notifications, Status Bar) |
| **Authentication** | Firebase Authentication (Google OAuth & Email/Password) |
| **State & Caching** | TanStack Query v5, IndexedDB (`idb-keyval`), React Context API |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **Phone Verification** | `libphonenumber-js` with international E.164 normalization |

---

## 7. Folder Structure

```
Idea/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Route controllers (travel, booking, slot, student)
│   │   ├── models/           # Mongoose schemas (Travel, Booking, Student, SlotPost)
│   │   ├── routes/           # Express API endpoints
│   │   ├── services/         # Matching heuristics, notification dispatch
│   │   └── middleware/       # Firebase token verification, validation
│   └── package.json
│
├── frontend/
│   ├── android/              # Native Android Studio project (Capacitor)
│   │   └── app/src/main/
│   │       ├── java/com/helpu/app/MainActivity.java
│   │       └── res/raw/helpu_notification_chime.wav
│   ├── public/
│   │   ├── videos/           # Bundled startup MP4 video & poster
│   │   ├── logo.png          # Official brand logo
│   │   └── manifest.webmanifest
│   ├── src/
│   │   ├── components/       # Reusable UI components & layouts
│   │   │   └── ui/StartupVideoIntro.jsx
│   │   ├── context/          # Firebase Auth, Profile & Slot Friend contexts
│   │   ├── features/slot-friend/  # Complete SlotMate academic pairing module
│   │   ├── lib/              # API clients, Firebase init, queryClient
│   │   ├── mobile/           # Push notifications, Android status bar bridge
│   │   ├── pages/            # Home, OfferRide, Match, WhatsAppOnboarding, etc.
│   │   └── App.jsx           # App shell, session intro guard, route definitions
│   └── package.json
│
└── README.md
```

---

## 8. Installation and Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Android Studio & SDK**: (For compiling the Android APK)
- **MongoDB**: Local instance or MongoDB Atlas cluster URI

### 1. Clone the Repository
```bash
git clone https://github.com/Shubhaam-code/HelpU.git
cd HelpU
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

---

## 9. Environment Variables

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Backend (`backend/.env`)
```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/helpu
JWT_SECRET=your_jwt_secret
FIREBASE_SERVICE_ACCOUNT_KEY=path_or_json_to_firebase_service_account
```

---

## 10. Android APK Build & Deployment

To compile and install the native Android APK directly on a connected device:

### 1. Build Frontend & Sync Capacitor
```bash
cd frontend
npm run build
npx cap sync android
```

### 2. Assemble Debug APK
```bash
cd android
./gradlew assembleDebug
```
The compiled APK will be located at:
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Install on USB-Connected Phone via ADB
```bash
adb devices
adb install -r frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 11. Authentication & Security Flow

```
User visits Helpu
       │
       ├── Logged in? ─────► Bypass intro ─────► Open /home or /whatsapp-setup
       │
       └── Guest? ─────────► Play 5s Intro ────► Open Landing Page (/)
                                                    │
                                                    ▼
                                          Explore Rides / Slots
                                                    │
                                                    ▼
                                            Login with Google
                                                    │
                                                    ▼
                                       Student Verification (WhatsApp)
                                                    │
                                                    ▼
                                            Confirmed Student Profile
```

1. **Client Authentication:** Firebase Authentication manages Google Sign-In tokens across Web and Capacitor native shell (`@capacitor-firebase/authentication`).
2. **Backend Verification:** JWT tokens are validated against Firebase Admin SDK on all protected API routes.
3. **Draft Preservation:** Guest selections and filters are persisted locally and automatically reconciled after onboarding completion.

---

## 12. Ride Matching Engine

The matching service ([`matching.service.js`](file:///c:/Users/Shubham%20Narayan/Desktop/Idea/backend/src/services/matching.service.js)) implements strict heuristic rules:

1. **Directional Equivalence:** Normalized aliases prevent accidental pairing of reverse trips (e.g., Campus ➔ Station will never match Station ➔ Campus).
2. **Calendar Day Matching:** Both trips must fall on the exact same date in the `Asia/Kolkata` timezone.
3. **Flexible Departure Window:** Matches are evaluated within an adjustable ±60 to 120-minute departure window.
4. **Capacity Validation:** Passenger requested seat count cannot exceed available driver seats.
5. **Self-Exclusion:** A student's post is never matched against their own travel posts.

---

## 13. Push Notifications Pipeline

- Built with **Firebase Cloud Messaging (FCM)** and Capacitor Push Notifications.
- Custom notification channel: `helpu_alerts_v3` with high importance and lockscreen visibility.
- Custom sound chime bundled directly in `android/app/src/main/res/raw/helpu_notification_chime.wav`.
- Instant foreground popup banner (`InAppNotificationBanner.jsx`) alerts users of incoming bookings, acceptances, and schedule changes in real time.

---

## 14. Contributing Guidelines

1. Fork the Project.
2. Create your Feature Branch:
   ```bash
   git checkout -b feature/NewFeature
   ```
3. Commit your Changes:
   ```bash
   git commit -m "feat: add NewFeature"
   ```
4. Push to the Branch:
   ```bash
   git push origin feature/NewFeature
   ```
5. Open a Pull Request.

---

## 15. License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">
  <sub>Built with ❤️ for university campus mobility & academic community.</sub>
</div>
