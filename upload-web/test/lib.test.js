const test = require('node:test');
const assert = require('node:assert');
const { escapeHtml, sniffVideo } = require('../lib');

test('escapes html', () =>
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;'));

test('detects mp4', () =>
  assert.equal(sniffVideo(Buffer.from([0,0,0,0x18,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d])), 'video/mp4'));

test('rejects text file', () =>
  assert.equal(sniffVideo(Buffer.from('hello world, not video')), null));