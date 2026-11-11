/* Finance: wallet-style overview, month navigation, category breakdown, budgets, savings goals,
 * filterable transaction history and a transaction detail view. Every figure is computed from recorded transactions only. */
import * as State from '../core/state.js';
import { registerActions, registerChange, registerInput, emit } from '../core/events.js';
import { contributeSavings, find } from '../core/records.js';
import { esc, todayStr, monthKey, addMonths, fmtMonth, fmtMonthShort, fmtDate, money, num, daysInMonth, pct, groupBy, plural, relDay } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { monthTotals, recordedBalance, budgetSpent } from '../core/stats.js';
import { donut, bars, progressBar, CHART_COLORS } from '../components/charts.js';
import { pageHead, emptyState, addBtn, kebab, sectionHead, badge } from '../components/ui.js';
import { selectHTML } from '../components/dropdown.js';
import { openSheet } from '../components/modal.js';
import { OPTIONS } from '../core/schemas.js';
import { toast } from '../components/toast.js';

const ui = { month: monthKey(todayStr()), type: 'all', category: 'All', q: '', all: false };

function txRow(t) {
  const inc = t.type === 'income';
  return `<div class="row tx-row"><a class="tx-link" href="#/finance/tx/${esc(t.id)}" aria-label="Open ${esc(t.note || t.category)}">
      <span class="row-lead tx-ico ${inc ? 'is-in' : ''}">${icon(inc ? 'arrow-down-left' : 'arrow-up-right', { size: 18 })}</span>
      <span class="row-main"><span class="row-title trunc">${esc(t.note || t.category)}</span><span class="row-sub trunc">${esc(t.category)} · ${esc(fmtDate(t.date))}${t.recurrence && t.recurrence !== 'None' ? ` · ${esc(t.recurrence)}` : ''}</span></span>
      <span class="tx-amt t-num ${inc ? 'pos' : ''}">${inc ? '+' : '−'}${esc(money(t.amount))}</span></a>${kebab('transaction', t.id)}</div>`;
}

function filtered(s) {
  const q = ui.q.trim().toLowerCase();
  return s.transactions.filter(t => (ui.all || monthKey(t.date) === ui.month) && (ui.type === 'all' || t.type === ui.type) && (ui.category === 'All' || t.category === ui.category) && (!q || `${t.note} ${t.category}`.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function insights(s, cur, prev) {
  const out = [];
  const cats = Object.entries(cur.byCat).sort((a, b) => b[1] - a[1]);
  if (cats.length && cur.expense > 0) out.push(`<b>${esc(cats[0][0])}</b> is your largest category at ${Math.round(pct(cats[0][1], cur.expense))}% of spending.`);
  const isNow = ui.month === monthKey(todayStr());
  const days = isNow ? new Date().getDate() : daysInMonth(ui.month);
  if (cur.expense > 0) out.push(`You spend about <b>${esc(money(cur.expense / days))}</b> a day${isNow ? ' so far this month' : ''}.`);
  if (prev.expense > 0 && cur.expense > 0 && !isNow) out.push(`${fmtMonthShort(addMonths(ui.month, -1))}: ${esc(money(prev.expense))}. This month is ${cur.expense <= prev.expense ? `${Math.round((1 - cur.expense / prev.expense) * 100)}% lower` : `${Math.round((cur.expense / prev.expense - 1) * 100)}% higher`}.`);
  else if (prev.expense > 0 && cur.expense > 0) out.push(`Last month you spent ${esc(money(prev.expense))} in total.`);
  return out;
}

function renderOverview() {
  const s = State.get(), today = todayStr(), nowKey = monthKey(today);
  const head = pageHead({ title: 'Finance', sub: s.transactions.length ? `${plural(s.transactions.length, 'transaction')} recorded` : 'Money in, money out', actions: addBtn('transaction', 'Transaction') });
  if (!s.transactions.length && !s.budgets.length && !s.savingsGoals.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'wallet', title: 'Your wallet is empty', text: 'Record your first income or expense and a clear picture of your month builds from there.', action: `<div class="row-gap" style="justify-content:center">${addBtn('transaction', 'Add a transaction')}${addBtn('budget', 'Set a budget', { cls: 'btn btn-sm' })}</div>` })}</div>`;

  const cur = monthTotals(s, ui.month), prev = monthTotals(s, addMonths(ui.month, -1)), nowT = monthTotals(s, nowKey);
  const balance = recordedBalance(s);
  const cats = Object.entries(cur.byCat).sort((a, b) => b[1] - a[1]);
  const top = cats.slice(0, 5), rest = cats.slice(5).reduce((a, [, v]) => a + v, 0);
  const segs = [...top.map(([label, value], i) => ({ label, value, color: CHART_COLORS[i] })), ...(rest > 0 ? [{ label: 'Other', value: rest, color: CHART_COLORS[5] }] : [])];
  const months = Array.from({ length: 6 }, (_, i) => addMonths(nowKey, i - 5));
  const monthData = months.map(m => ({ m, ...monthTotals(s, m) }));
  const monthsWithData = monthData.filter(d => d.count > 0).length;
  const budgets = s.budgets.filter(b => b.month === ui.month);
  const list = filtered(s), grouped = groupBy(list, t => t.date), dates = Object.keys(grouped).sort().reverse();
  const cat = (id, v) => selectHTML({ value: v, options: id, label: 'Category', compact: true, dataChange: 'fin-cat' });

  return `${head}<div class="stack-lg">
    <section class="wallet" style="--i:1" aria-label="Wallet balance">
      <div class="wallet-top"><span class="wallet-label">Recorded balance</span>${icon('wallet', { size: 22 })}</div>
      <div class="wallet-amount t-num">${esc(money(balance))}</div>
      <div class="wallet-foot"><div><small>Income this month</small><b class="t-num">${esc(money(nowT.income))}</b></div><div><small>Spent this month</small><b class="t-num">${esc(money(nowT.expense))}</b></div></div>
    </section>

    <div class="month-nav" style="--i:2"><button class="icon-btn is-solid" type="button" data-action="fin-month" data-dir="-1" aria-label="Previous month">${icon('chevron-left', { size: 20 })}</button>
      <button class="month-label" type="button" data-action="fin-month-now" ${ui.month === nowKey ? 'aria-current="date"' : ''} title="Jump to this month">${esc(fmtMonth(ui.month))}</button>
      <button class="icon-btn is-solid" type="button" data-action="fin-month" data-dir="1" aria-label="Next month">${icon('chevron-right', { size: 20 })}</button></div>

    <div class="trio" style="--i:3"><div class="card card-pad stat"><span>Income</span><b class="pos t-num">${esc(money(cur.income, { compactMode: true }))}</b></div><div class="card card-pad stat"><span>Spent</span><b class="t-num">${esc(money(cur.expense, { compactMode: true }))}</b></div><div class="card card-pad stat"><span>Net</span><b class="t-num ${cur.net < 0 ? 'neg' : ''}">${esc(money(cur.net, { compactMode: true }))}</b></div></div>

    <div class="grid cols-2" style="--i:4">
      <section class="card card-pad"><h2 class="t-h2">Where it went</h2>
        ${segs.length ? `<div class="spend-row mt-4">${donut({ segments: segs, size: 132, stroke: 16, centerTop: money(cur.expense, { compactMode: true }), centerBottom: 'spent' })}<ul class="spend-legend">${segs.map(g => `<li><i style="--c:${g.color}"></i><span class="trunc">${esc(g.label)}</span><b class="t-num">${Math.round(pct(g.value, cur.expense))}%</b></li>`).join('')}</ul></div>` : `<p class="t-body mt-3">No spending recorded in ${esc(fmtMonth(ui.month))}.</p>`}</section>
      <section class="card card-pad"><h2 class="t-h2">Insights</h2>
        ${insights(s, cur, prev).length ? `<ul class="insight-list mt-3">${insights(s, cur, prev).map(x => `<li>${x}</li>`).join('')}</ul>` : '<p class="t-body mt-3">Insights appear once this month has spending.</p>'}</section>
    </div>

    <section class="card card-pad" style="--i:5"><div class="between"><div><h2 class="t-h2">Monthly spending</h2><p class="t-small">Last six months</p></div></div>
      ${monthsWithData >= 2 ? `<div class="mt-4">${bars({ items: monthData.map(d => ({ label: fmtMonthShort(d.m), value: d.expense, today: d.m === nowKey, title: `${fmtMonth(d.m)}: ${money(d.expense)} spent` })), height: 130, showValues: true, fmt: v => money(v, { compactMode: true }), ariaLabel: 'Spending by month' })}</div>` : '<p class="t-body mt-3">Comparisons appear once at least two months have transactions.</p>'}</section>

    <section style="--i:6">${sectionHead('Budgets', fmtMonth(ui.month), addBtn('budget', 'Budget', { cls: 'btn btn-sm', prefill: { month: ui.month } }))}
      ${budgets.length ? `<div class="card card-flush"><div class="list">${budgets.map(b => { const spent = budgetSpent(s, b), p = pct(spent, b.monthlyLimit), over = spent > b.monthlyLimit, warn = p >= num(b.alertAt, 80);
        return `<div class="row budget-row"><div class="row-main"><div class="between"><span class="row-title">${esc(b.category)}</span><span class="t-small t-num">${esc(money(spent))} / ${esc(money(b.monthlyLimit))}</span></div>${progressBar(p, over ? 'is-over' : warn ? 'is-warn' : '')}<span class="row-sub ${over ? 'neg' : warn ? 'warn' : ''}">${over ? `${esc(money(spent - b.monthlyLimit))} over budget` : `${esc(money(b.monthlyLimit - spent))} left${warn ? ' · nearing limit' : ''}`}</span></div>${kebab('budget', b.id)}</div>`; }).join('')}</div></div>`
        : `<div class="card card-pad"><p class="t-body">No budgets for ${esc(fmtMonth(ui.month))}. Set a limit for a category to track it here.</p></div>`}</section>

    <section style="--i:7">${sectionHead('Savings goals', '', addBtn('savingsGoal', 'Goal', { cls: 'btn btn-sm' }))}
      ${s.savingsGoals.length ? `<div class="grid auto-grid">${s.savingsGoals.map(g => { const p = pct(g.savedAmount, g.targetAmount);
        return `<article class="card card-pad save-card"><div class="between"><h3 class="t-h3 trunc">${esc(g.name)}</h3>${kebab('savingsGoal', g.id)}</div><p class="save-amt t-num">${esc(money(g.savedAmount))} <small>of ${esc(money(g.targetAmount))}</small></p>${progressBar(p, p >= 100 ? 'is-pos' : '')}
          <div class="between mt-3"><span class="t-small">${p >= 100 ? 'Goal reached' : `${Math.round(p)}%${g.targetDate ? ` · by ${esc(fmtDate(g.targetDate, { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}`}</span>${p < 100 ? `<button class="btn btn-soft btn-sm" type="button" data-action="save-add" data-id="${esc(g.id)}">${icon('plus', { size: 14 })} Add money</button>` : ''}</div></article>`; }).join('')}</div>`
        : `<div class="card card-pad"><p class="t-body">Saving for something? Add a goal and add money as you set it aside. Savings goals track separately from your transactions.</p></div>`}</section>

    <section style="--i:8">${sectionHead('Transactions', ui.all ? 'All time' : fmtMonth(ui.month))}
      <div class="filters"><div class="seg" role="group" aria-label="Type">${['all', 'income', 'expense'].map(t => `<button type="button" aria-pressed="${ui.type === t}" class="${ui.type === t ? 'is-on' : ''}" data-action="fin-type" data-type="${t}">${t === 'all' ? 'All' : t === 'income' ? 'Income' : 'Expenses'}</button>`).join('')}</div>
        <div class="filters-row">${cat(['All', ...OPTIONS.txCategory], ui.category)}<button type="button" class="chip ${ui.all ? 'is-on' : ''}" data-action="fin-all" aria-pressed="${ui.all}">All time</button></div>
        <input class="input" type="search" placeholder="Search description or category" value="${esc(ui.q)}" data-input="fin-q" data-keep="fin-q" aria-label="Search transactions"></div>
      ${list.length ? `<div class="stack mt-3">${dates.map(d => { const day = grouped[d]; const net = day.reduce((a, t) => a + (t.type === 'income' ? t.amount : -t.amount), 0);
        return `<section class="card card-flush"><div class="day-head"><span>${esc(relDay(d, { done: true }))}${d === today ? '' : ''}</span><span class="t-num t-small ${net > 0 ? 'pos' : ''}">${esc(money(net, { sign: true }))}</span></div><div class="list">${day.map(txRow).join('')}</div></section>`; }).join('')}</div>`
        : `<div class="card mt-3">${emptyState({ icon: 'receipt', title: 'No transactions match', text: ui.type !== 'all' || ui.category !== 'All' || ui.q ? 'Try clearing the filters.' : `Nothing recorded for ${fmtMonth(ui.month)}.`, action: addBtn('transaction', 'Add transaction') })}</div>`}</section>
  </div>`;
}

function renderTx(id) {
  const t = find('transaction', id);
  if (!t) return `<div class="card">${emptyState({ icon: 'receipt', title: 'Transaction not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/finance">Back to Finance</a>' })}</div>`;
  const inc = t.type === 'income';
  return `<header class="page-head"><div><p class="eyebrow">${inc ? 'Income' : 'Expense'}</p><h1 class="t-title">${esc(t.note || t.category)}</h1></div></header>
    <div class="stack-lg"><section class="card card-pad tx-detail" style="--i:1"><div class="tx-big t-num ${inc ? 'pos' : ''}">${inc ? '+' : '−'}${esc(money(t.amount))}</div>${badge(inc ? 'Income' : 'Expense', inc ? 'pos' : '')}
      <dl class="kv mt-4"><div><dt>Category</dt><dd>${esc(t.category)}</dd></div><div><dt>Date</dt><dd>${esc(fmtDate(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</dd></div><div><dt>Description</dt><dd>${esc(t.note || '—')}</dd></div><div><dt>Repeats</dt><dd>${esc(t.recurrence || 'None')}${t.recurrence && t.recurrence !== 'None' ? ' <span class="t-small">(label only)</span>' : ''}</dd></div></dl></section>
      <div class="row-gap" style="--i:2">${addBtn('transaction', 'Edit', { cls: 'btn btn-primary', id: t.id })}<button class="btn btn-danger" type="button" data-action="delete" data-type="transaction" data-id="${esc(t.id)}" data-back="#/finance">${icon('trash', { size: 18 })} Delete</button></div></div>`;
}

function openAddMoney(id) {
  const g = find('savingsGoal', id); if (!g) return;
  const api = openSheet({ title: `Add to ${g.name}`, size: 'narrow', body: `<div class="field field-big"><label for="sv-amt">Amount</label><div class="prefix-wrap"><span class="prefix">${esc(money(0).replace(/[\d.,\s]/g, ''))}</span><input id="sv-amt" type="number" inputmode="decimal" min="0" step="any" placeholder="0" data-autofocus></div><div class="field-error" role="alert" hidden></div></div>`, footer: '<button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button><button class="btn btn-primary" type="button" data-go>Add</button>' });
  const go = () => { const input = api.el.querySelector('#sv-amt'); if (contributeSavings(id, input.value)) { api.close(); toast('Added to savings goal'); } else { const e = api.el.querySelector('.field-error'); e.hidden = false; e.textContent = 'Enter an amount above zero.'; } };
  api.el.querySelector('[data-go]').addEventListener('click', go);
  api.el.querySelector('#sv-amt').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}

registerActions({
  'fin-month'(el) { ui.month = addMonths(ui.month, Number(el.dataset.dir)); ui.all = false; emit('view:refresh'); },
  'fin-month-now'() { ui.month = monthKey(todayStr()); ui.all = false; emit('view:refresh'); },
  'fin-type'(el) { ui.type = el.dataset.type; emit('view:refresh'); },
  'fin-all'() { ui.all = !ui.all; emit('view:refresh'); },
  'save-add'(el) { openAddMoney(el.dataset.id); }
});
registerChange({ 'fin-cat'(el) { ui.category = el.value; emit('view:refresh'); } });
registerInput({ 'fin-q'(el) { ui.q = el.value; emit('view:refresh'); } });

export const route = {
  id: 'finance',
  render: parts => (parts[0] === 'tx' && parts[1] ? renderTx(parts[1]) : renderOverview()),
  title: parts => (parts[0] === 'tx' ? 'Transaction' : 'Finance')
};
