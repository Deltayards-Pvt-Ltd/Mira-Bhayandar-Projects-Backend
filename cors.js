
const allowedOrigins = [
  "https://mb-react-web-admin.vercel.app",
  "https://mb-react-web-frontend.vercel.app",
  "https://mira-bhayandar-projects-admin.vercel.app/",
  
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",

];

// Allow any localhost / 127.0.0.1 port during development (Vite drifts to 5173/5174/5175…)
const devLocalhost = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin / curl / server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (devLocalhost.test(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default corsOptions;
