# Pepsi Memory Soundtrack - Suno AI POC

A vibrant, Next.js-powered web application that transforms your Pepsi memories into personalized music using Suno AI's music generation API.

![Pepsi Memories](https://img.shields.io/badge/Powered%20by-Suno%20AI-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8)

## 🎨 Features

- **Interactive Form**: Share your Pepsi memories with an intuitive, beautifully designed form
- **AI Music Generation**: Powered by Suno AI to create personalized soundtracks
- **Genre Selection**: Choose from 10+ music genres
- **Vocal Options**: Select male vocals, female vocals, or instrumental
- **Real-time Feedback**: Beautiful loading animations while your music is being created
- **Audio Player**: Listen to your generated tracks directly in the browser
- **Download**: Save your favorite tracks for offline listening
- **Responsive Design**: Optimized for all devices (mobile, tablet, desktop)
- **Pepsi-Inspired Theme**: Vibrant color palette with playful animations

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- A Suno AI API key (get one from [Suno API](https://api.sunoapi.org/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/marius02/suno-api-pepsi-poc.git
   cd suno-api-pepsi-poc
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your Suno API key:
   ```
   NEXT_PUBLIC_SUNO_API_KEY=your_actual_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Fonts**: Poppins & Inter (Google Fonts)
- **API**: [Suno AI Music Generation](https://api.sunoapi.org/)
- **Deployment**: [Vercel](https://vercel.com/)

## 📁 Project Structure

```
suno-api-pepsi-poc/
├── app/
│   ├── api/
│   │   └── callback/
│   │       └── route.ts          # API callback handler
│   ├── components/
│   │   ├── InputForm.tsx         # User input form
│   │   ├── Loader.tsx            # Loading animation
│   │   ├── TrackCard.tsx         # Individual track display
│   │   └── TrackGrid.tsx         # Grid of generated tracks
│   ├── globals.css               # Global styles & animations
│   ├── layout.tsx                # Root layout with bubbles
│   └── page.tsx                  # Main page component
├── public/                       # Static assets
├── .env.local.example            # Environment variables template
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## 🎵 How It Works

1. **User Input**: Users describe their Pepsi memory, select a genre, and choose vocal preferences
2. **API Call**: The app sends a POST request to Suno API with the user's input
3. **Polling**: The app polls the Suno API to check when music generation is complete
4. **Display**: Generated tracks are displayed in a beautiful grid with audio players
5. **Download**: Users can download their favorite tracks

## 🎨 Design Inspiration

The design is inspired by [PepsiCo Smiles](https://pepsicosmiles.ro/), featuring:
- Vibrant Pepsi blue (#004B93) and red (#E32934) color palette
- Playful gradient backgrounds
- Floating bubble animations
- Smooth transitions and hover effects
- Energetic, optimistic aesthetic

## 🚀 Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy via Vercel**
   - Visit [vercel.com](https://vercel.com/)
   - Import your repository
   - Add your environment variable: `NEXT_PUBLIC_SUNO_API_KEY`
   - Click "Deploy"

3. **Update Callback URL** (if using callbacks)
   - Note your Vercel deployment URL
   - Update the `callBackUrl` in the API request to: `https://your-app.vercel.app/api/callback`

## 🔧 Configuration

### Environment Variables

- `NEXT_PUBLIC_SUNO_API_KEY`: Your Suno AI API key (required)

### Customization

You can customize the app by modifying:
- **Colors**: Edit `tailwind.config.ts` to change the Pepsi color palette
- **Genres**: Add/remove genres in `app/components/InputForm.tsx`
- **Animations**: Modify animations in `app/globals.css`
- **API Settings**: Adjust polling intervals and model version in `app/page.tsx`

## 📝 API Reference

### Suno AI API Endpoints

**Generate Music**
```
POST https://api.sunoapi.org/api/v1/generate
```

**Query Task Status**
```
GET https://api.sunoapi.org/api/v1/query?taskId={taskId}
```

For full API documentation, visit [Suno API Docs](https://api.sunoapi.org/docs)

## 🐛 Troubleshooting

### Common Issues

1. **"API key is not configured"**
   - Make sure `.env.local` exists and contains your API key
   - Restart the development server after adding the key

2. **"Failed to generate music"**
   - Check your API key is valid
   - Ensure you have API credits remaining
   - Check browser console for detailed error messages

3. **Music generation times out**
   - The default timeout is 30 attempts × 5 seconds = 2.5 minutes
   - Complex requests may take longer
   - Try again with a simpler prompt

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [Suno AI](https://suno.ai/) for the amazing music generation API
- [PepsiCo Smiles](https://pepsicosmiles.ro/) for design inspiration
- [Vercel](https://vercel.com/) for hosting

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Contact: [your-email@example.com]

---

**Built with ❤️ and 🥤 Pepsi vibes**
