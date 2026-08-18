#  AI Interview Simulator

An AI-powered interview practice application that generates customized interview questions and evaluates user responses using the Gemini API.

The application allows users to configure an interview based on their target role, company, interview type, experience level, and number of questions. Users can answer questions through text or voice input, receive AI-generated feedback and scores, and review their performance in a final summary.

##  Features

### Core Features

- Customized interview setup
- AI-generated interview questions using Gemini
- Questions based on:
  - Job role
  - Company
  - Interview type
  - Experience level
  - Number of questions
- Text-based answer input
- Word count tracking
- Skip question functionality
- AI-powered answer evaluation
- Individual question scores and feedback
- Interview progress tracking
- Final interview summary
- Answered and skipped question statistics
- Question history and performance review
- Error handling for failed API requests
- Safe handling of Gemini quota and rate-limit errors

### Bonus Features

- **Voice Input**  
  Users can speak their answers using browser speech recognition.

- **Interview Timer**  
  Tracks the duration of the interview and displays the total interview time in the summary.

- **Light and Dark Mode**  
  Users can switch between themes, and their preference is saved using `localStorage`.

-  **Custom Pixel Desert UI**  
  A game-inspired interface featuring a desert landscape in light mode and a night landscape with stars and a moon in dark mode.

## 🛠️ Tech Stack

- **Next.js 14**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **Google Gemini API**
- **Browser Web Speech API**
- **CSS**

## 📂 Project Structure

```text
ai-interview-simulator/
│
├── app/
│   ├── api/
│   │   ├── interview-feedback/
│   │   │   └── route.ts
│   │   └── interview-question/
│   │       └── route.ts
│   │
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── SetupForm.tsx
│   └── ThemeToggle.tsx
│
├── .env.local
├── package.json
├── tailwind.config.ts
└── README.md