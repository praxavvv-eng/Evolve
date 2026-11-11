/* Levels & rewards: level, category XP, achievements, milestone rewards and the activity history.
 * Everything shown is read from stored XP events; nothing is estimated. */
import * as State from '../core/state.js';
import { registerChange } from '../core/events.js';
import { levelInfo, ACHIEVEMENTS, unlockedMap, CATEGORY_NAMES, LEVEL_MILESTONES, XP_RULES, levelStartXP, RANKS } from '../core/xp.js';
import { esc, todayStr, fmtDate, fmtNum } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { pageHead } from '../components/ui.js';
import { ring, progressBar } from '../components/charts.js';
import { toast } from '../components/toast.js';

function render() {
  const s = State.get(), li = levelInfo(s.xp), unlocked = unlockedMap(s), usedToday = Number(s.dailyXP[todayStr()]) || 0;
  const cats = Object.entries(s.categoryXP), maxCat = Math.max(1, ...cats.map(([, v]) => v));
  const rank = lvl => RANKS[Math.min(RANKS.length - 1, Math.floor((lvl - 1) / 3))];
  const earned = ACHIEVEMENTS.filter(a => unlocked[a.id]).length;

  return `${pageHead({ title: 'Levels', sub: 'Progress from the things you actually did' })}
    <div class="stack-lg">
      <section class="card lvl-hero" style="--i:1">${ring({ value: li.percent, size: 132, stroke: 11, label: String(li.level), sub: 'level', title: `Level ${li.level}, ${Math.round(li.percent)} percent to the next` })}
        <div class="lvl-copy"><p class="t-micro">${esc(li.rank)}</p><p class="t-hero" style="font-size:2rem">${fmtNum(li.xp)} <small class="muted" style="font-size:1rem;font-weight:600">XP</small></p><p class="t-small">${fmtNum(li.remaining)} XP to level ${li.level + 1}</p><div class="mt-3">${progressBar(li.percent)}</div></div></section>

      <section class="card card-pad" style="--i:2"><div class="between"><h2 class="t-h2">By category</h2><span class="t-small">XP earned in each area</span></div>
        <div class="cat-list mt-4">${cats.map(([k, v]) => `<div class="cat-row"><div class="between"><span class="row-title">${esc(CATEGORY_NAMES[k] || k)}</span><span class="t-small t-num">${fmtNum(v)} XP · Lv ${levelInfo(v).level}</span></div>${progressBar((v / maxCat) * 100)}</div>`).join('')}</div></section>

      <section style="--i:3"><div class="sec-head" style="margin-top:0"><div><h2>Achievements</h2><p>${earned} of ${ACHIEVEMENTS.length} unlocked</p></div></div>
        <div class="ach-grid">${ACHIEVEMENTS.map(a => { const on = unlocked[a.id]; return `<article class="ach ${on ? 'is-on' : ''}" aria-label="${esc(a.name)}: ${on ? 'unlocked' : 'locked'}"><span class="ach-ico">${icon(on ? a.icon : 'lock', { size: 22 })}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${on && s.achievements[a.id] ? `<em>${esc(fmtDate(s.achievements[a.id].slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' }))}</em>` : ''}</article>`; }).join('')}</div></section>

      <section class="card card-flush" style="--i:4"><div class="panel-head"><div><h2>Milestone rewards</h2><p>Set a personal reward for each milestone</p></div></div>
        <div class="list">${LEVEL_MILESTONES.map(l => { const reached = li.level >= l; return `<div class="row ms-reward ${reached ? 'is-on' : ''}"><span class="row-lead">${reached ? icon('check', { size: 18 }) : `<b>${l}</b>`}</span><span class="row-main"><span class="row-title">Level ${l} · ${esc(rank(l))}</span><span class="row-sub">${fmtNum(levelStartXP(l))} XP</span>
          <input class="input" style="margin-top:8px;min-height:40px" maxlength="80" placeholder="Your reward, e.g. a new book" value="${esc(s.settings.levelRewards[l] || '')}" data-change="reward-save" data-level="${l}" aria-label="Reward for level ${l}"></span></div>`; }).join('')}</div></section>

      <section class="card card-flush" style="--i:5"><div class="panel-head"><div><h2>Recent activity</h2><p>Today: ${usedToday} / ${s.settings.dailyXpCap} XP</p></div></div>
        ${s.activityLog.length ? `<div class="list">${s.activityLog.slice(0, 15).map(a => `<div class="row"><span class="row-main"><span class="row-title">${esc(a.label)}</span><span class="row-sub">${esc(CATEGORY_NAMES[a.category] || a.category)} · ${esc(fmtDate(String(a.date).slice(0, 10)))}</span></span><span class="row-end"><span class="badge badge-accent no-dot">+${a.points} XP</span></span></div>`).join('')}</div>` : '<p class="t-body" style="padding:0 var(--card-p) var(--card-p)">No XP yet. Finish a task, check in a habit or log a workout to get started.</p>'}</section>

      <section class="card card-pad" style="--i:6"><h2 class="t-h2">How XP works</h2><ul class="xp-rules mt-3">${XP_RULES.map(([p, t]) => `<li><b>${p}</b><span>${esc(t)}</span></li>`).join('')}</ul>
        <p class="t-small mt-3">Each event pays once, ever. Editing, un-checking and re-checking do not pay again. A daily cap of ${s.settings.dailyXpCap} XP keeps levels meaningful. You can change it in Settings.</p></section>
    </div>`;
}

registerChange({
  'reward-save'(el) {
    State.update(s => { const t = el.value.trim().slice(0, 80); if (t) s.settings.levelRewards[el.dataset.level] = t; else delete s.settings.levelRewards[el.dataset.level]; }, { silent: true });
    toast('Reward saved');
  }
});
export const route = { id: 'levels', render };
