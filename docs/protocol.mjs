// MI Matrix framing and image commands based on LostBeard/SpawnDev.MatrixLEDDisplay (MIT).
export const SERVICE = '0000ffd0-0000-1000-8000-00805f9b34fb';
export const WRITE = '0000ffd1-0000-1000-8000-00805f9b34fb';
export const NOTIFY = '0000ffd2-0000-1000-8000-00805f9b34fb';
export function command(data) {
  const crc = data.reduce((sum, byte) => (sum + byte) & 255, 0);
  return Uint8Array.from([0xbc, ...data, crc, ...((data.length + 13) % 32 ? [0x55] : [])]);
}
export function rgbBytes(frame, gamma = 0.6) {
  if (!Array.isArray(frame) || frame.length !== 256 || !Number.isFinite(gamma) || gamma < 0.2 || gamma > 1) throw new Error('Invalid image or gamma.');
  const output = [];
  for (const color of frame) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Invalid pixel color.');
    for (let i = 1; i < 7; i += 2) output.push(Math.floor(Math.pow(parseInt(color.slice(i, i + 2), 16) / 255, 1 / gamma) * 255));
  }
  return output;
}
export async function transmit(frames, write, {gamma = 0.6, save = false, pause = ms => new Promise(r => setTimeout(r, ms)), progress = () => {}} = {}) {
  if (!Array.isArray(frames) || !frames.length || frames.length > 8) throw new Error('Choose between one and eight frames.');
  const images = frames.map(frame => rgbBytes(frame, gamma));
  let packets = 0;
  async function send(bytes, delay = 50) { await write(command(bytes)); packets++; await pause(delay); }
  if (save) { await send([0x00, 0x15], 500); await send([0x00, 0x11, 0xf1]); }
  if (images.length === 1) {
    await send([0x0f, 0xf1, 0x08]);
    for (let block = 0; block < 8; block++) { await send([0x0f, block + 1, ...images[0].slice(block * 96, (block + 1) * 96)]); progress(block + 1, 8); }
    await send([0x0f, 0xf2, 0x08]);
  } else {
    // The firmware expects all eight animation slots, even for a shorter sequence.
    await send([0x00, 0x12], 500);
    for (let index = 1; index <= 8; index++) {
      const image = images[(index - 1) % images.length];
      await send([0x02, 0xf1, 8], 5);
      for (let block = 0; block < 8; block++) await send([0x02, index, block + 1, ...image.slice(block * 96, (block + 1) * 96)], 5);
      if (index === 8 && save) await send([0x02, 0x07, 0x3c], 5);
      await send([0x02, 0xf2, 8], 5);
      progress(index, 8); await pause(50);
    }
  }
  if (save) await send([0x00, 0x11, 0xf2]);
  if (images.length > 1) await send([0x00, 0x12]);
  return packets;
}
