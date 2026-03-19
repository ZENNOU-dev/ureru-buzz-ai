import type { ScriptSection } from "@ureru-buzz-ai/core";
import { SCRIPT_SECTIONS } from "@ureru-buzz-ai/core";
import type { ScriptSectionData } from "./types.js";

// Section markers in Japanese
const SECTION_MARKERS: Record<ScriptSection, string[]> = {
  hook: ["[フック]", "【フック】", "[HOOK]"],
  empathy: ["[共感]", "【共感】", "[EMPATHY]"],
  concept: ["[コンセプト]", "【コンセプト】", "[CONCEPT]"],
  product: ["[商品紹介]", "【商品紹介】", "[PRODUCT]"],
  benefit: ["[ベネフィット]", "【ベネフィット】", "[BENEFIT]"],
  offer: ["[オファー]", "【オファー】", "[OFFER]"],
  cta: ["[CTA]", "【CTA】", "[CTA]", "[アクション]"],
};

/**
 * Parse a script text into sections
 * Tries marker-based parsing first, falls back to proportional split
 */
export function parseScriptIntoSections(scriptText: string): ScriptSectionData[] {
  // Try marker-based parsing first
  const markerResult = parseWithMarkers(scriptText);
  if (markerResult.length > 0) {
    return markerResult;
  }

  // Fallback: proportional split
  return parseProportional(scriptText);
}

function parseWithMarkers(scriptText: string): ScriptSectionData[] {
  const results: ScriptSectionData[] = [];

  // Find all marker positions
  const markerPositions: Array<{ section: ScriptSection; position: number }> = [];

  for (const section of SCRIPT_SECTIONS) {
    const markers = SECTION_MARKERS[section];
    for (const marker of markers) {
      const pos = scriptText.indexOf(marker);
      if (pos !== -1) {
        markerPositions.push({ section, position: pos });
        break;
      }
    }
  }

  // Sort by position
  markerPositions.sort((a, b) => a.position - b.position);

  if (markerPositions.length === 0) return [];

  // Extract text between markers
  for (let i = 0; i < markerPositions.length; i++) {
    const current = markerPositions[i];
    const nextPosition = i + 1 < markerPositions.length
      ? markerPositions[i + 1].position
      : scriptText.length;

    // Find the end of the marker
    let startPos = current.position;
    const markers = SECTION_MARKERS[current.section];
    for (const marker of markers) {
      if (scriptText.indexOf(marker, current.position) === current.position) {
        startPos = current.position + marker.length;
        break;
      }
    }

    const text = scriptText.slice(startPos, nextPosition).trim();
    if (text) {
      results.push({ section: current.section, text });
    }
  }

  return results;
}

/**
 * Proportional split based on typical section lengths
 * Used when no section markers are found
 */
function parseProportional(scriptText: string): ScriptSectionData[] {
  const lines = scriptText.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Typical proportions for a 7-section script
  const proportions: Record<ScriptSection, number> = {
    hook: 0.12,
    empathy: 0.15,
    concept: 0.12,
    product: 0.20,
    benefit: 0.18,
    offer: 0.12,
    cta: 0.11,
  };

  const totalLines = lines.length;
  const results: ScriptSectionData[] = [];
  let currentLine = 0;

  for (const section of SCRIPT_SECTIONS) {
    const lineCount = Math.max(1, Math.round(totalLines * proportions[section]));
    const endLine = Math.min(currentLine + lineCount, totalLines);
    const text = lines.slice(currentLine, endLine).join("\n").trim();

    if (text) {
      results.push({ section, text });
    }
    currentLine = endLine;
  }

  // Assign any remaining lines to the last section
  if (currentLine < totalLines && results.length > 0) {
    const lastResult = results[results.length - 1];
    const remainingText = lines.slice(currentLine).join("\n").trim();
    if (remainingText) {
      lastResult.text += "\n" + remainingText;
    }
  }

  return results;
}
