import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import { ThemeProvider } from './providers/ThemeProvider'
import { RouterProvider } from 'react-router-dom'
import { router } from './router/AppRoutes'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  document.body.innerHTML = 'Error: Root element not found. Please ensure index.html contains <div id="root"></div>'
  throw new Error('Root element not found')
}

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error?.message || event.message, event.error?.stack);
});

const root = createRoot(rootElement)

function App() {
  return (
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <MotionConfig reducedMotion="user">
            <RouterProvider router={router} />
          </MotionConfig>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}

root.render(<App />)