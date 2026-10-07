# TinkerFlow — Frontend Client

Web application for **TinkerFlow** — an operational management and 3D print logistics platform built for mobile instructors and 3D printer operators conducting school workshops.

Currently serving **1,000+ active elementary school students across 5 regional branches**, coordinating daily in-class progress, packing calculations, and central 3D print farm intake.

> **Related repository:** Backend REST API available at [TinkerFlow-back](https://github.com/Maksiator/TinkerFlow-back).

---

## The Problem (Case Study)

Mobile instructors travel between elementary schools daily, conducting multiple consecutive workshop sessions. Managing curriculum progress previously relied on disconnected spreadsheets, introducing severe operational friction:

* **In-Class friction:** Instructors needed an immediate, high-contrast matrix to know which 3D model to assign to whom in a fast-paced classroom, operable on a mobile screen while walking between desks.
* **Packing guesswork:** Instructors overpacked heavy crates of printed tutorial booklets because manual calculation across consecutive groups was impractical.
* **Disconnected print logistics:** The 3D printing lab lacked a real-time queue. Custom student designs, dual-model exceptions, filament choices, and failed prints were communicated across scattered chat threads and paper notes.

TinkerFlow Front delivers specialized, role-tailored workspaces built for speed under real workshop conditions.

---

## Key Workspaces & Frontend Highlights

### 1. The Real-Time Classroom Matrix (`ProjectPivot`)
* **Dense Data Grid:** High-performance matrix rendering student-by-project progress with inline status controls.
* **Optimistic UI:** State transitions update the UI instantly (zero perceived latency) with automatic rollback and toast notifications on network failure — crucial for unreliable school Wi-Fi.
* **Adaptive Track Filtering:** Dynamic toggles between standard curriculum models, advanced Tinkercad projects, and SolidWorks tracks without page reloads.
* **Field-Ready Usability:** Touch-friendly targets and horizontal scroll management engineered for one-handed phone or tablet use in the classroom.

### 2. Smart Packing Aggregator
* Solves physical inventory overhead before hitting the road.
* Computes `max(copies_needed)` across consecutive groups rather than redundant summation (e.g., packing 9 copies of Project X instead of 9 + 5 + 7 = 21), directly reducing physical crate weight.

### 3. Print Manager & Dispatch Drawer
* Slide-out operational drawer embedded directly into the matrix view.
* Enables trainers to assemble batch submissions, attach custom models outside the syllabus, and communicate special notes to the lab operator.
* **Status Alert Engine:** Dynamically alerts trainers with high-visibility indicators (red/amber) when a batch has operator notes or zero successful prints requiring re-assignment.

### 4. 3D Printer Farm Dashboard (`PrinterDashboard`)
* Production workspace for lab operators handling print intake across all branches.
* **Dual View Architecture:** Dense table view for bulk audits vs. detailed card view for individual batch management.
* **Bulk State Processing:** Single-click transitions for entire batch cycles with automatic matrix rollbacks on rejected/failed prints.

### 5. Role-Based Administration
* Dedicated views for branch coordinators to manage schools, student rosters, trainer assignments, and time-scoped substitutions.

---

## Tech Stack & Architecture

* **Framework:** React 19 + TypeScript
* **Build Tooling:** Vite (ESM-native fast HMR and optimized production bundling)
* **Styling:** Tailwind CSS v4
* **Networking & Auth:** Axios client with centralized JWT interceptors and automatic session validation
* **Drag-and-Drop:** `@hello-pangea/dnd` for intuitive project reordering
* **UI Feedback:** `react-hot-toast` + `react-bootstrap-icons`
* **Routing:** React Router v7 with role-based route guards

---

## Getting Started

### Prerequisites
* Node.js (v20+ recommended)
* npm or pnpm

### Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Maksiator/TinkerFlow-front.git
   cd TinkerFlow-front
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the project root:
   ```env
   VITE_API_URL=http://localhost:8080/api
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

The application will be live at `http://localhost:5173`.

---

## Project Structure

```text
├── src/
│   ├── api/          # Strongly-typed API services (Auth, Batches, Matrix, Students, Users)
│   ├── components/   # Reusable and feature-specific components (Matrix, Drawers, Modals)
│   ├── pages/        # Top-level view routes (Matrix, PrinterDashboard, Groups, Students, Admin)
│   └── App.tsx       # Route definitions, role-based guards, toast provider
├── Dockerfile        # Production multi-stage build (Node build -> Nginx static server)
└── package.json
```

---

## License

Copyright © 2026 Maksymilian Fijoł. All rights reserved.  
This repository and its codebase are proprietary. Published strictly for portfolio, architectural review, and hiring evaluation purposes. Unauthorized copying, distribution, modification, or commercial use without prior written permission is strictly prohibited.

