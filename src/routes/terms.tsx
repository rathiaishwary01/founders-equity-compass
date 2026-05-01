import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — EquiCompass" },
      { name: "description", content: "Terms of use for EquiCompass equity simulator." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return <LegalPage title="Terms of Use" updated="1 May 2025" sections={termsSections} />;
}

const termsSections = [
  {
    heading: "Acceptance",
    body: `By using EquiCompass you agree to these terms. If you do not agree, please do not use the tool.`,
  },
  {
    heading: "Not legal or financial advice",
    body: `EquiCompass is a modelling and planning tool only. Nothing on this site constitutes legal advice, financial advice, tax advice, or investment advice. The outputs are illustrative estimates based on the inputs you provide. You should always consult a qualified lawyer, chartered accountant, or financial adviser before making decisions about equity, fundraising, or corporate structure.`,
  },
  {
    heading: "No warranty",
    body: `EquiCompass is provided "as is" without warranty of any kind, express or implied. We make no representations that the calculations are accurate, complete, or suitable for any particular purpose. Market norms and legal requirements change — always verify figures with a professional.`,
  },
  {
    heading: "Limitation of liability",
    body: `To the fullest extent permitted by law, EquiCompass and its contributors shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from your use of the tool or reliance on its outputs.`,
  },
  {
    heading: "Open source licence",
    body: `The source code for EquiCompass is released under the MIT Licence. You are free to use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software, subject to the licence terms at github.com/EquiCompass/founders-equity-compass.`,
  },
  {
    heading: "Changes to these terms",
    body: `We may update these terms from time to time. The updated date at the top of this page reflects the most recent revision. Continued use of the tool after changes are posted constitutes acceptance of the revised terms.`,
  },
];
