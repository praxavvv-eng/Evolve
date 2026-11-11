/* Celebration sheets for level-ups and achievements. Events are queued so several unlocks never stack on top of each other. */
import { on } from '../core/events.js';
import { openSheet } from './modal.js';
import { icon } from '../core/icons.js';
import { esc } from '../core/utils.js';

const queue = [];
let showing = false;

function sparks() {
  return Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2, d = 70 + (k % 3) * 22;
    return `<i class="spark" style="--k:${k % 5};--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d)}px"></i>`;
  }).join('');
}

function next() {
  if (showing || !queue.length) return;
  showing = true;
  const ev = queue.shift();
  const isLevel = ev.kind === 'level';
  const body = `<div class="celebrate">${sparks()}
    <div class="badge-art">${isLevel ? `<b>${ev.level}</b>` : icon(ev.achievement.icon, { size: 48 })}</div>
    <p class="t-micro">${isLevel ? 'Level up' : 'Achievement unlocked'}</p>
    <h2>${isLevel ? `Level ${ev.level} · ${esc(ev.rank)}` : esc(ev.achievement.name)}</h2>
    <p>${isLevel ? 'Steady, real progress got you here.' : esc(ev.achievement.desc)}</p>
    ${isLevel && ev.reward ? `<p class="mt-3"><span class="badge badge-accent no-dot">Your reward: ${esc(ev.reward)}</span></p>` : ''}</div>`;
  openSheet({ size: 'narrow', title: '', body, footer: '<button class="btn btn-primary" type="button" data-sheet-close data-autofocus>Continue</button>', onClose: () => { showing = false; setTimeout(next, 250); } });
}

/* Achievements are a gentle, non-blocking pop at the top of the screen. Only level-ups use a sheet. */
let popTimer = Promise.resolve();
function achievementPop(a) {
  popTimer = popTimer.then(() => new Promise(done => {
    const el = document.createElement('div');
    el.className = 'ach-pop glass'; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="ach-pop-ico">${icon(a.icon, { size: 22 })}</span><span><small>Achievement unlocked</small><b>${esc(a.name)}</b></span>`;
    document.body.appendChild(el);
    const out = () => { el.classList.add('is-leaving'); setTimeout(() => { el.remove(); done(); }, 320); };
    el.addEventListener('click', out);
    setTimeout(out, 4200);
  }));
}

on('celebrate', ev => { if (ev.kind === 'achievement') { achievementPop(ev.achievement); return; } queue.push(ev); next(); });
