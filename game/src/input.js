// Keyboard and mouse, read every frame. Movement is WASD or arrows; the mouse
// aims and the left button fires; Space or Shift dashes; Enter/Space confirms on
// menus; P pauses; M mutes; 1-6 buys in the shop. Clicks are also exposed as a
// point in logical field coordinates so menus can be used with the mouse.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: FIELD.width / 2, y: FIELD.height / 2, down: false, clicked: false, clickX: 0, clickY: 0 };
  let actions = 0;

  function logical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
      y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (!event.repeat) {
      pressed.add(event.key.toLowerCase());
      if (event.key === 'Enter' || event.key === ' ') actions |= ACTION_CONFIRM;
      if (event.key.toLowerCase() === 'p' || event.key === 'Escape') actions |= ACTION_PAUSE;
      if (event.key.toLowerCase() === 'm') actions |= ACTION_MUTE;
    }
    keys.add(event.key.toLowerCase());
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const p = logical(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const p = logical(event);
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = p.x;
    mouse.clickY = p.y;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  return {
    mouse,
    direction,
    aimAngle(fromX, fromY) {
      return Math.atan2(mouse.y - fromY, mouse.x - fromX);
    },
    firing() {
      return mouse.down || keys.has('j') || keys.has('z');
    },
    dashHeld() {
      return keys.has(' ') || keys.has('shift');
    },
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
    takeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
    takeDigit() {
      for (let d = 1; d <= 6; d += 1) {
        if (pressed.has(String(d))) {
          pressed.delete(String(d));
          return d;
        }
      }
      return 0;
    },
    consumePressed() {
      pressed.clear();
    },
  };
}
