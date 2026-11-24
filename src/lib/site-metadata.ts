import type { Metadata } from "next";

export const siteOrigin = "https://airdaybook.vercel.app";
const socialImage = { url: "/social/airdaybook.jpg", width: 1200, height: 630, alt: "Delhi rooftops and an elevated Metro train in winter haze" };

export function pageMetadata(path: "/" | "/plan", title: string, description: string): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "AirDaybook", title, description, url: path, images: [socialImage] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}
