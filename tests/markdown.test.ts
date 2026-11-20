import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../src/lib/markdown";

test("markdown: headings, lists, emphasis, links", () => {
  const html = renderMarkdown("## Titre\n\n- **un**\n- *deux*\n\n1. a\n2. b\n\n> note\n\nVoir [site](https://example.org).");
  assert.match(html, /<h2>Titre<\/h2>/);
  assert.match(html, /<ul>\n<li><strong>un<\/strong><\/li>\n<li><em>deux<\/em><\/li>\n<\/ul>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<blockquote>note<\/blockquote>/);
  assert.match(html, /<a href="https:\/\/example.org" target="_blank" rel="noopener noreferrer nofollow">site<\/a>/);
});

test("markdown: HTML and javascript: links are neutralised (XSS)", () => {
  const html = renderMarkdown('<script>alert(1)</script>\n[x](javascript:alert(1))\n<img src=x onerror="a">');
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes('href="javascript'));
  assert.match(html, /&lt;script&gt;/);
});
