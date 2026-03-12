import './globals.css';

export const metadata = {
  title: 'Nexus H-1B1 Pipeline',
  description: 'Admin pipeline for processing H-1B1 visa candidate applications',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
