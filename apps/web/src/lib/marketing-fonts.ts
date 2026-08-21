import { Bricolage_Grotesque, Figtree } from "next/font/google";

/** Display face for marketing brand and headlines — not used in the app shell. */
export const marketingDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-mkt-display",
  display: "swap",
});

/** Body face for marketing copy. */
export const marketingBody = Figtree({
  subsets: ["latin"],
  variable: "--font-mkt-body",
  display: "swap",
});

export const marketingFontClassName = `${marketingDisplay.variable} ${marketingBody.variable}`;
