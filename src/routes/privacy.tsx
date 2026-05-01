import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — EquiCompass" },
      { name: "description", content: "Privacy policy for EquiCompass equity simulator." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return <LegalPage title="Privacy Policy" updated="1 May 2025" sections={privacySections} />;
}

const privacySections = [
  {
    heading: "Overview",
    body: `EquiCompass is a free, open-source tool. We do not collect, store, or sell any personal information. All calculations run entirely in your browser — nothing you enter is ever sent to our servers.`,
  },
  {
    heading: "Data we do not collect",
    body: `We do not collect your name, email address, company name, financial data, or any other personally identifiable information. We do not use cookies for tracking or analytics. We do not use third-party analytics services such as Google Analytics.`,
  },
  {
    heading: "Data stored locally",
    body: `Any scenario data you enter is stored only in your browser's local storage on your own device. This data never leaves your device. Clearing your browser storage or cookies will permanently delete it.`,
  },
  {
    heading: "Infrastructure",
    body: `EquiCompass is hosted on Cloudflare Pages. Cloudflare may collect standard server logs (IP address, browser type, pages visited) as part of their infrastructure service. This data is governed by Cloudflare's own privacy policy at cloudflare.com/privacypolicy. We do not have access to this data in identifiable form.`,
  },
  {
    heading: "Open source",
    body: `EquiCompass is fully open source. You can inspect the complete source code at github.com/EquiCompass/founders-equity-compass to verify exactly what the application does and does not do with your data.`,
  },
  {
    heading: "Contact",
    body: `If you have questions about this privacy policy, please open an issue on our GitHub repository or reach out via the contact details in the repository.`,
  },
];
