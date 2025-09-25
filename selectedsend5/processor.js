import { addClickedCard, clearClickedCards } from './lib/state.js';
import { renderCards, handleFileSelect } from './lib/utils.js';

// --- Configuration ---
// This large string is prefixed to the content of each card before being sent to the AI Studio.
const PROMPT_PREFIX = `### **1. 基本機能**

日本語の単語を入力として受け取り、JSONオブジェクトを出力します。そのオブジェクトは、入力された単語を**「単純語」**または**「複合語」**として分類します。単語が複合語の場合、その構成要素を**再帰的に分解**して示します。構成要素自体が複合語である場合は、その要素もさらに分解されます。

---

### **2. JSON出力の構造**

**A. ルートオブジェクト:**
最上位のオブジェクトは、以下の要素を**必ず**含みます。

*   \`query\` (string): 入力された元の日本語の単語。
*   \`meaning\` (string): 入力単語の簡潔な英語の定義。
*   \`word_type\` (string): 単語の構造を分類します。値は以下の二つのうちのいずれか**でなければなりません**。
    *   \`\\"compound\\"\`: 単語が二つ以上の意味を持つ部分から構成されていることを示します。
    *   \`\\"simple\\"\`: 単語がそれ以上分解できない単一の単位であることを示します（これには独立した単語や接辞も含まれます）。
*   \`breakdown\` (array): 「構成要素オブジェクト」の順序付きリストです。このプロパティは、\`word_type\`が\`\\"compound\\"\`の場合に**のみ**存在します。

**B. 構成要素オブジェクト (\`breakdown\`配列内):**
\`breakdown\`配列内の各オブジェクトは一つの構成要素を表し、ルートオブジェクトと同一の構造を**持たなければなりません**。以下の要素を含みます。

*   \`word\` (string): 構成要素そのものを表す単語（ひらがななどの表音文字で表現）。
*   \`meaning\` (string): 構成要素の簡潔な英語の定義。
*   \`word_type\` (string): 構成要素の構造を分類します（\`\\"simple\\"\`または\`\\"compound\\"\`）。
*   \`breakdown\` (array): さらに下位の構成要素オブジェクトの順序付きリストです。このプロパティは、構成要素の\`word_type\`が\`\\"compound\\"\`の場合に**のみ**存在します。

---

### **3. 例（日本語）**

#### **例1: 単純語**
入力が\`ねこ\`の場合、構造は変わりません。

\`\`\`json
{
  "query": "ねこ",
  "meaning": "Cat",
  "word_type": "simple"
}
\`\`\`

#### **例2: 単純な接辞**
入力が\`お\`の場合、構造は変わりません。

\`\`\`json
{
  "query": "お",
  "meaning": "Honorific prefix",
  "word_type": "simple"
}
\`\`\`

#### **例3: 再帰的な分解を持つ複合語（更新）**
入力が\`わりびきじかん\`の場合、構成要素の\`わりびき\`自体が複合語（\`わり\` + \`ひき\`）です。新しい構造ではこれを反映しています。

\`\`\`json
{
  "query": "わりびきじかん",
  "meaning": "Discount time; happy hour",
  "word_type": "compound",
  "breakdown": [
    {
      "word": "わりびき",
      "meaning": "Discount, reduction",
      "word_type": "compound",
      "breakdown": [
        {
          "word": "わり",
          "meaning": "To split, divide",
          "word_type": "simple"
        },
        {
          "word": "ひき",
          "meaning": "To pull, deduct",
          "word_type": "simple"
        }
      ]
    },
    {
      "word": "じかん",
      "meaning": "Time, hour",
      "word_type": "simple"
    }
  ]
}
\`\`\`

#### **例4: 複雑な再帰的分解（新規）**
入力が\`じどうしゃでんわ\`（自動車電話）の場合、\`じどうしゃ\`（自動車）と\`でんわ\`（電話）の両方が複合語であり、複数の再帰レベルを示しています。

\`\`\`json
{
  "query": "じどうしゃでんわ",
  "meaning": "Car phone",
  "word_type": "compound",
  "breakdown": [
    {
      "word": "じどうしゃ",
      "meaning": "Automobile, car",
      "word_type": "compound",
      "breakdown": [
        {
          "word": "じ",
          "meaning": "Self, own",
          "word_type": "simple"
        },
        {
          "word": "どう",
          "meaning": "Move",
          "word_type": "simple"
        },
        {
          "word": "しゃ",
          "meaning": "Vehicle",
          "word_type": "simple"
        }
      ]
    },
    {
      "word": "でんわ",
      "meaning": "Telephone",
      "word_type": "compound",
      "breakdown": [
        {
          "word": "でん",
          "meaning": "Electric, electricity",
          "word_type": "simple"
        },
        {
          "word": "わ",
          "meaning": "Talk, story",
          "word_type": "simple"
        }
      ]
    }
  ]
}
\`\`\`
### Let's exercise
準備ができました。演習の単語をどうぞ。

`;

// --- DOM Elements ---
const grid = document.getElementById('grid');
const fileInput = document.getElementById('fileInput');
const clearSavedBtn = document.getElementById('clearSaved');
const batchOpenBtn = document.getElementById('batchOpenBtn');
const batchOpenCountInput = document.getElementById('batchOpenCount');
const themeSwitcher = document.getElementById('themeSwitcher');

// -------------------------------------------------------------------
// --- THEME MANAGEMENT LOGIC ---
// -------------------------------------------------------------------
const themeStorageKey = 'selected-card-theme';

/**
 * Applies the selected theme to the document and updates button states.
 * @param {string} theme - The theme to apply ('light', 'dark', or 'system').
 */
function applyTheme(theme) {
    const root = document.documentElement;
    let effectiveTheme = theme;

    if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    root.setAttribute('data-theme', effectiveTheme);
    
    themeSwitcher.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

/**
 * Initializes the theme on page load and sets up event listeners.
 */
function initTheme() {
    const savedTheme = localStorage.getItem(themeStorageKey) || 'system';
    applyTheme(savedTheme);

    themeSwitcher.addEventListener('click', (e) => {
        const themeButton = e.target.closest('.theme-btn');
        if (themeButton) {
            const newTheme = themeButton.dataset.theme;
            localStorage.setItem(themeStorageKey, newTheme);
            applyTheme(newTheme);
        }
    });

    // Also listen for OS-level theme changes if the user has 'system' selected.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const currentTheme = localStorage.getItem(themeStorageKey) || 'system';
        if (currentTheme === 'system') {
            applyTheme('system');
        }
    });
}

// -------------------------------------------------------------------
// --- CORE EXTENSION FUNCTIONALITY ---
// -------------------------------------------------------------------

/**
 * A simple promise-based delay function.
 * @param {number} ms - The number of milliseconds to wait.
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Handles the logic for opening a single card.
 * @param {HTMLElement} card - The card element to open.
 */
async function openCard(card) {
  if (!card || card.classList.contains('card-clicked')) return;
  
  card.classList.add('card-clicked');
  const { id, name, content } = card.dataset;
  await addClickedCard(id);

  // Format the card content into a minified JSON array string.
  const lines = content.split('\n');
  const minifiedLines = lines.map(line => line.trim()).filter(line => line);
  const arrayFormattedContent = JSON.stringify(minifiedLines);
  
  const modifiedContent = PROMPT_PREFIX + arrayFormattedContent;

  const newTab = await chrome.tabs.create({ 
      url: "https://aistudio.google.com/prompts/new_chat", 
      active: false 
  });

  // Send a message to the background script to register this new tab for monitoring.
  chrome.runtime.sendMessage({
    action: "logTabCreation",
    payload: { id: newTab.id, cardName: name, cardContent: modifiedContent }
  });
}

// -------------------------------------------------------------------
// --- INITIALIZATION & EVENT LISTENERS ---
// -------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 1. Set up the theme switcher.
    initTheme();

    // 2. Listen for clicks on individual cards.
    grid.addEventListener('click', async (event) => {
        const card = event.target.closest('.card');
        if (card) await openCard(card);
    });

    // 3. Listen for a file selection to populate the grid.
    fileInput.addEventListener('change', (event) => {
        handleFileSelect(event, (lines) => renderCards(grid, lines));
    });

    // 4. Listen for clicks on the "Clear State" button.
    clearSavedBtn.addEventListener('click', async () => {
        await clearClickedCards();
        alert('✅ Cleared all clicked card states.');
        document.querySelectorAll('.card.card-clicked').forEach(c => c.classList.remove('card-clicked'));
    });

    // 5. Listen for clicks on the "Batch Open" button.
    batchOpenBtn.addEventListener('click', async () => {
        const count = parseInt(batchOpenCountInput.value, 10);
        if (isNaN(count) || count <= 0) {
            alert('Please enter a valid number of cards to open.'); 
            return;
        }

        const unclickedCards = grid.querySelectorAll('.card:not(.card-clicked)');
        const cardsToOpen = Array.from(unclickedCards).slice(0, count);

        if (cardsToOpen.length === 0) {
            alert('No unclicked cards available to open.');
            return;
        }

        // Disable controls during batch operation to prevent conflicts.
        batchOpenBtn.disabled = true;
        batchOpenCountInput.disabled = true;

        for (const card of cardsToOpen) {
            await openCard(card);
            await wait(200); // Small delay between opening tabs to avoid issues.
        }
        
        // Re-enable controls.
        batchOpenBtn.disabled = false;
        batchOpenCountInput.disabled = false;
        batchOpenCountInput.value = '';
    });
});