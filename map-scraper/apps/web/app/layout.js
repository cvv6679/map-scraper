export const metadata = {
  title: "Map Scraper",
  description: "Background Google Maps scraper"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, Arial" }}>
        {children}
      </body>
    </html>
  );
}
