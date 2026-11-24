"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>AirDaybook couldn’t open</h1>
          <p><button type="button" onClick={reset}>Try again</button></p>
          <p><a href="/">Open Today</a></p>
        </main>
      </body>
    </html>
  );
}
