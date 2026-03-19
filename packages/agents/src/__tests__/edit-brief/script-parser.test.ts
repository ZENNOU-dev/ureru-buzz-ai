import { describe, it, expect } from "vitest";
import { parseScriptIntoSections } from "../../edit-brief/script-parser.js";

describe("parseScriptIntoSections", () => {
  describe("marker-based parsing", () => {
    it("parses script with section markers", () => {
      const script = `[フック]毎朝、枕についた大量の抜け毛を見て不安になりませんか？
[共感]実はそれ、頭皮環境の悪化サインかもしれません。
[コンセプト]でも大丈夫。新しいヘアケアの常識をお教えします。
[商品紹介]スカルプDは医薬部外品の育毛剤です。
[ベネフィット]使い始めて3ヶ月で、抜け毛が気にならなくなったという声が多数。
[オファー]今なら初回限定50%OFF。
[CTA]詳しくはプロフィールのリンクから。`;

      const sections = parseScriptIntoSections(script);

      expect(sections.length).toBe(7);
      expect(sections[0].section).toBe("hook");
      expect(sections[0].text).toContain("抜け毛");
      expect(sections[1].section).toBe("empathy");
      expect(sections[6].section).toBe("cta");
    });

    it("handles partial markers", () => {
      const script = `[フック]フックテキスト
[共感]共感テキスト
[CTA]CTAテキスト`;

      const sections = parseScriptIntoSections(script);
      expect(sections.length).toBe(3);
      expect(sections[0].section).toBe("hook");
      expect(sections[2].section).toBe("cta");
    });
  });

  describe("proportional parsing", () => {
    it("splits unmarked script proportionally", () => {
      const lines = Array.from({ length: 14 }, (_, i) => `台本の${i + 1}行目のテキスト`);
      const script = lines.join("\n");

      const sections = parseScriptIntoSections(script);
      expect(sections.length).toBeGreaterThan(0);
      expect(sections[0].section).toBe("hook");
    });

    it("handles empty text", () => {
      const sections = parseScriptIntoSections("");
      expect(sections).toEqual([]);
    });
  });
});
