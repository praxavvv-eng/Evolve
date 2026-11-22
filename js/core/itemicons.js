/* Per-item icons for habits, challenges and goals. A record stores `iconId` (one id from the catalogue below).
 * Records without one get a sensible icon from their name (reading, workout, water...) and then a default for their kind.
 * Nothing is migrated: older records keep their data and simply display the fallback. */
import { icon } from './icons.js';

export const ICON_GROUPS = [
  ['Health and fitness', [['dumbbell', 'Workout', 'gym lift strength train'], ['activity', 'Activity', 'cardio run walk steps'], ['heart', 'Health', 'wellbeing care'], ['droplets', 'Water', 'drink hydrate'], ['bike', 'Cycling', 'bike ride cycle'], ['apple', 'Nutrition', 'food diet eat fruit'], ['moon', 'Sleep', 'rest night bed'], ['sun', 'Morning', 'wake early sunrise'], ['flame', 'Energy', 'streak fire burn']]],
  ['Mind and study', [['book-open', 'Reading', 'read pages book'], ['book', 'Book', 'library novel'], ['brain', 'Study', 'learn think focus memory'], ['graduation', 'Education', 'exam course class school'], ['pen', 'Writing', 'write journal diary'], ['notebook', 'Notes', 'notebook plan'], ['lightbulb', 'Ideas', 'idea creative think'], ['code', 'Coding', 'code program dev'], ['laptop', 'Work', 'laptop computer project'], ['language', 'Language', 'speak translate vocabulary']]],
  ['Money and work', [['wallet', 'Wallet', 'money finance budget'], ['piggy', 'Savings', 'save piggy'], ['coins', 'Coins', 'invest income'], ['briefcase', 'Career', 'job business'], ['chart', 'Analytics', 'chart stats data'], ['trending-up', 'Growth', 'progress improve'], ['receipt', 'Bills', 'expenses spend']]],
  ['Goals and focus', [['target', 'Goal', 'aim target focus'], ['trophy', 'Achievement', 'win trophy'], ['star', 'Star', 'favourite best'], ['award', 'Award', 'badge medal'], ['flag', 'Milestone', 'flag finish'], ['shield', 'Discipline', 'protect quit avoid challenge'], ['mountain', 'Challenge', 'climb summit hard'], ['sparkles', 'Spark', 'new magic'], ['bookmark', 'Saved', 'bookmark']]],
  ['Life and leisure', [['home', 'Home', 'house clean tidy'], ['coffee', 'Coffee', 'coffee tea break'], ['music', 'Music', 'music practice guitar piano'], ['camera', 'Photo', 'photo camera'], ['plane', 'Travel', 'trip travel fly'], ['leaf', 'Mindfulness', 'meditate calm nature yoga'], ['smile', 'Mood', 'happy gratitude smile'], ['gamepad', 'Gaming', 'game play'], ['utensils', 'Cooking', 'cook meal kitchen'], ['clock', 'Time', 'time schedule'], ['gift', 'Gift', 'gift give']]]
];
export const ICON_IDS = new Set(ICON_GROUPS.flatMap(([, list]) => list.map(i => i[0])));
export const DEFAULT_ICON = { habit: 'repeat', challenge: 'shield', goal: 'target' };

const RULES = [
  [/read|book|page|chapter/i, 'book-open'], [/gym|workout|lift|exercise|train|squat|push|pull|strength/i, 'dumbbell'], [/water|drink|hydrat/i, 'droplets'],
  [/sleep|bed\b|bedtime|night/i, 'moon'], [/study|learn|revis|homework|exam|class|lecture/i, 'brain'], [/code|coding|program|leetcode|develop/i, 'code'],
  [/meditat|mindful|yoga|breath|calm|gratitude/i, 'leaf'], [/run|jog|walk|step|cardio|swim|sport/i, 'activity'], [/cycl|bike/i, 'bike'], [/wake|morning|sunrise|early/i, 'sun'], [/save|saving|money|budget|invest|financ|spend/i, 'wallet'],
  [/write|journal|diary|blog/i, 'pen'], [/eat|diet|fruit|veg|meal|protein|sugar/i, 'apple'], [/music|guitar|piano|sing/i, 'music'], [/clean|tidy|room|laundry|home/i, 'home'], [/coffee|tea\b/i, 'coffee'],
  [/language|spanish|french|german|hindi|vocab/i, 'language'], [/quit|avoid|no |nofap|smok|vape|alcohol|social media|scroll|phone/i, 'shield'], [/travel|trip|flight/i, 'plane'], [/photo|camera/i, 'camera'], [/game|gaming/i, 'gamepad']
];
/** Icon id for a record: its chosen one, else a guess from its name, else the default for its kind. */
export function itemIconId(rec = {}, kind = 'habit') {
  if (rec.iconId && ICON_IDS.has(rec.iconId)) return rec.iconId;
  const text = `${rec.name || rec.title || ''}`;
  for (const [re, id] of RULES) if (re.test(text)) return id;
  return DEFAULT_ICON[kind] || 'sparkles';
}
export const itemIcon = (rec, kind = 'habit', size = 22) => icon(itemIconId(rec, kind), { size });
