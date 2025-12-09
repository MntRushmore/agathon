# AI Whiteboard

An intelligent whiteboard application powered by AI that provides real-time assistance, OCR, voice interaction, and automated help detection for students and learners.

## Features

- Interactive whiteboard using TLDraw
- AI-powered assistance with three modes: Feedback, Suggest, and Answer
- Optical Character Recognition (OCR) for handwritten and typed text
- Voice assistant with real-time workspace analysis
- Automatic help detection when you're stuck
- Persistent whiteboard storage with Supabase

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **UI**: TLDraw, Radix UI, Tailwind CSS
- **AI Services**:
  - OpenRouter API (GPT-4.1-mini, Gemini models)
  - Mistral API (Pixtral for OCR)
  - OpenAI Realtime API (Voice assistant)
- **Database**: Supabase
- **Image Processing**: Sharp

## Prerequisites

Before you begin, make sure you have:

- Node.js 20 or higher
- npm, yarn, pnpm, or bun package manager
- API keys for the following services:
  - [OpenRouter](https://openrouter.ai/keys)
  - [Mistral AI](https://console.mistral.ai/)
  - [OpenAI](https://platform.openai.com/api-keys)
  - [Supabase](https://supabase.com/dashboard)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### 2. Set Up Environment Variables

Copy the `.env.example` file to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and fill in your API keys:

```env
# Required API Keys
OPENROUTER_API_KEY=your_openrouter_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Required Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Getting API Keys:

1. **OpenRouter API Key**:
   - Sign up at [https://openrouter.ai](https://openrouter.ai)
   - Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
   - Create a new API key

2. **Mistral API Key**:
   - Sign up at [https://console.mistral.ai](https://console.mistral.ai)
   - Navigate to API Keys section
   - Generate a new API key

3. **OpenAI API Key**:
   - Sign up at [https://platform.openai.com](https://platform.openai.com)
   - Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Create a new secret key

4. **Supabase Configuration**:
   - Create a new project at [https://supabase.com](https://supabase.com)
   - Go to Project Settings > API
   - Copy the Project URL and anon/public key
   - Create a `whiteboards` table with the following schema:
     ```sql
     create table whiteboards (
       id uuid primary key default uuid_generate_v4(),
       title text not null,
       created_at timestamp with time zone default now(),
       updated_at timestamp with time zone default now(),
       preview text,
       data jsonb
     );
     ```

### 3. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### 4. Optional Configuration

You can customize the AI models and other settings in `.env.local`:

```env
# Optional: AI Model Configuration
OPENROUTER_HELP_CHECK_MODEL=openai/gpt-4.1-mini
OPENROUTER_IMAGE_GEN_MODEL=google/gemini-3-pro-image-preview
OPENROUTER_VOICE_ANALYSIS_MODEL=google/gemini-2.5-flash
MISTRAL_OCR_MODEL=pixtral-12b-2409
OPENAI_REALTIME_MODEL=gpt-realtime

# Optional: Other Settings
MISTRAL_OCR_MAX_TOKENS=1000
CANVAS_ACTIVITY_DEBOUNCE_MS=3000
LOG_LEVEL=info
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Usage

1. **Create a Whiteboard**: Click "New Whiteboard" on the dashboard
2. **Draw and Write**: Use the drawing tools to work on problems
3. **Get AI Help**:
   - The app automatically detects when you might need help
   - Choose from three help modes:
     - **Feedback**: Visual annotations and highlights
     - **Suggest**: Hints without giving away the answer
     - **Answer**: Complete solution
4. **Voice Assistant**: Click the microphone icon to activate voice interaction
5. **OCR**: The app automatically extracts text from your drawings

## Development

- `npm run dev` - Start development server with pretty logs
- `npm run dev:raw` - Start development server with raw logs
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
madhacks/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── check-help-needed/
│   │   │   ├── generate-solution/
│   │   │   ├── ocr/
│   │   │   └── voice/
│   │   ├── board/[id]/       # Whiteboard page
│   │   ├── layout.tsx
│   │   └── page.tsx          # Dashboard
│   ├── components/           # UI components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities
│   └── utils/               # Helper functions
├── public/                  # Static assets
└── package.json
```

## Troubleshooting

- **API Key Errors**: Make sure all required API keys are set in `.env.local`
- **Supabase Connection**: Verify your Supabase URL and anon key are correct
- **Build Errors**: Try deleting `node_modules` and `.next`, then reinstall dependencies
- **Voice Not Working**: Ensure you have a valid OpenAI API key with Realtime API access

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

This project is open source and available under the MIT License.
