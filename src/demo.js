// Original two-layer example skin; no remote asset is needed to start the studio.
export function makeDemoSkin() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const skin = '#c99c7e', hair = '#4d3930', shirt = '#54baca', pants = '#626b9c';
  rect(0, 0, 32, 16, skin);
  rect(0, 0, 32, 8, hair);
  rect(0, 8, 8, 5, hair); rect(16, 8, 16, 5, hair); rect(24, 8, 8, 8, hair);
  rect(8, 8, 8, 2, hair); rect(8, 10, 1, 1, hair); rect(14, 10, 2, 1, hair);
  rect(9, 12, 2, 1, '#f8f6ec'); rect(13, 12, 2, 1, '#f8f6ec');
  rect(10, 12, 1, 1, '#5a557e'); rect(13, 12, 1, 1, '#5a557e');
  rect(11, 13, 2, 1, '#aa7459'); rect(10, 14, 4, 2, '#76503e'); rect(11, 14, 2, 1, '#c18a6b');
  rect(16, 16, 24, 16, shirt); rect(20, 20, 8, 1, '#9fdce0');
  rect(22, 20, 4, 2, skin); rect(23, 22, 2, 1, skin);
  rect(20, 24, 1, 7, '#4bafbf'); rect(27, 23, 1, 8, '#429fb2');
  rect(23, 29, 2, 3, '#419fae');
  for (const [x, y] of [[40,16], [32,48]]) { rect(x,y,16,16,skin); rect(x,y,16,8,shirt); rect(x+4,y+6,4,2,'#49a5b9'); rect(x+5,y+12,1,3,'#bd8d70'); }
  for (const [x,y] of [[0,16], [16,48]]) { rect(x,y,16,16,pants); rect(x,y+14,16,2,'#485465'); rect(x+4,y+9,4,1,'#59618e'); }
  // Transparent hat and jacket overlay illustrate that both skin layers render.
  rect(40, 8, 8, 1, '#594237'); rect(40, 9, 2, 1, '#594237'); rect(46, 9, 2, 1, '#594237');
  rect(20, 36, 1, 10, '#7bd2db'); rect(27, 36, 1, 10, '#69cbd5');
  rect(20, 46, 8, 1, '#4298ad'); rect(36, 52, 4, 1, '#74cad1'); rect(44, 36, 4, 1, '#74cad1');
  return canvas;
}
