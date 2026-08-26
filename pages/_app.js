import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { ToastProvider } from "@/components/Toast";

export default function App({ Component, pageProps }) {
  return (
    <ToastProvider>
      <Component {...pageProps} />
      <Analytics />
    </ToastProvider>
  );
}