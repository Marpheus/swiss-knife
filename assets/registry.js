/* The one list of tools.
   The homepage builds its cards from it, every tool page builds its header
   from it, and the ⌘K palette indexes it. Adding a tool is one entry here
   plus a folder — nothing else needs touching.

   keys: extra search terms for the palette, beyond name and note. */
window.SK = window.SK || {};

SK.tools = [
  {
    slug: 'json',
    name: 'json',
    note: 'format, minify, validate, sort keys, browse as a tree',
    keys: 'pretty print beautify parse escape stringify'
  },
  {
    slug: 'regex',
    name: 'regex',
    note: 'test a pattern, see every match and capture group',
    keys: 'regexp pattern match replace groups flags'
  },
  {
    slug: 'base64',
    name: 'base64',
    note: 'encode and decode text or files, utf-8 safe',
    keys: 'b64 base64url atob btoa data uri'
  },
  {
    slug: 'jwt',
    name: 'jwt',
    note: 'decode claims, read the dates, verify the signature',
    keys: 'token json web bearer hs256 rs256 claims exp'
  },
  {
    slug: 'diff',
    name: 'diff',
    note: 'compare two texts, line or word level',
    keys: 'compare changes patch unified split merge'
  }
];

SK.tool = function (slug) {
  return (
    SK.tools.find(function (t) {
      return t.slug === slug;
    }) || null
  );
};
