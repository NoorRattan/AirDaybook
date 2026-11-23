"use client";

import { Clipboard, Send } from "lucide-react";
import { useRef, useState } from "react";
import { communityNote, type ShareLanguage } from "@/lib/community-share";
import type { ReadingSelection } from "@/lib/readings";

export function CommunityShare({ selection, now, ready }: { selection: ReadingSelection; now: number; ready: boolean }) {
  const [language, setLanguage] = useState<ShareLanguage>("en");
  const [context, setContext] = useState("");
  const [action, setAction] = useState("");
  const [includeLabels, setIncludeLabels] = useState(false);
  const [notice, setNotice] = useState("");
  const preview = useRef<HTMLTextAreaElement>(null);
  const note = ready ? communityNote({ selection, now, language, context, action, includeLabels }) : "";

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(note);
      setNotice("Community note copied.");
    } catch {
      preview.current?.focus();
      preview.current?.select();
      setNotice("Text selected. Use your device’s Copy command.");
    }
  }

  return (
    <section className="planner-chapter" aria-labelledby="community-title">
      <h2 id="community-title" className="eyebrow"><Send size={16} aria-hidden /> Community share</h2>
      <p className="chapter-heading">A note for the group.</p>
      <p className="chapter-intro" id="community-disclosure">Start with your selected reading. Add the activity and any agreed action you want the group to see. Your saved commitments and routes stay private.</p>
      <div className="share-workbench">
        <fieldset disabled={!ready} aria-describedby="community-disclosure" onChange={() => setNotice("")}>
          <label>Note language
            <select value={language} onChange={(event) => setLanguage(event.target.value === "hi" ? "hi" : "en")}>
              <option value="en">English</option>
              <option value="hi" lang="hi">हिन्दी</option>
            </select>
          </label>
          <label>Group activity<input maxLength={120} value={context} onChange={(event) => setContext(event.target.value)} /></label>
          <label>Agreed action<textarea rows={2} maxLength={300} value={action} onChange={(event) => setAction(event.target.value)} /></label>
          {selection && selection !== "replay" && <label className="check-label"><input type="checkbox" checked={includeLabels} onChange={(event) => setIncludeLabels(event.target.checked)} /> Include the saved place and source names</label>}
        </fieldset>
        <div className="share-preview">
          <label htmlFor="community-note">Share preview</label>
          <textarea readOnly ref={preview} id="community-note" lang={language} rows={8} value={note} />
          <div className="share-actions">
            <button className="button button-primary" type="button" disabled={!ready} onClick={copyNote}><Clipboard size={16} aria-hidden /> Copy note</button>
            <p role="status" className="form-notice">{notice}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
