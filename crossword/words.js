const wordsTranslations = {
  en: {
    eyebrow: "A LITTLE WORD PRACTICE",
    title: "Word list",
    subtitle: "Review meanings and track the words you have learned.",
    crosswordLink: "Crossword",
    settingsLink: "Settings",
    wordListLabel: "Word list",
    searchLabel: "Search",
    searchPlaceholder: "Search words or meanings",
    wordColumn: "Word",
    phoneticColumn: "Pronunciation",
    partOfSpeechColumn: "Part of speech",
    englishColumn: "English meaning",
    chineseColumn: "Chinese meaning",
    progressColumn: "Progress",
    actionColumn: "Action",
    learned: "Learned",
    mastered: "Mastered",
    correctCount: "{count} / 3 correct",
    markLearned: "Mark learned",
    untick: "Untick",
    markedLearned: "Marked as learned.",
    unmarkedLearned: "Learned mark removed.",
    summary: "{learned} of {total} words learned or mastered",
    matchingCount: "{count} shown",
    loading: "Loading word lists…",
    loadError: "Could not load the word list. Run this page from a local web server.",
    progressError: "Could not save word-learning progress in a browser cookie.",
    listFile: "File"
  },
  zh: {
    eyebrow: "每日英语词汇练习",
    title: "词汇表",
    subtitle: "查看单词释义并记录已学会的单词。",
    crosswordLink: "填字游戏",
    settingsLink: "设置",
    wordListLabel: "词汇表",
    searchLabel: "搜索",
    searchPlaceholder: "搜索单词或释义",
    wordColumn: "单词",
    phoneticColumn: "音标",
    partOfSpeechColumn: "词性",
    englishColumn: "英文释义",
    chineseColumn: "中文释义",
    progressColumn: "学习进度",
    actionColumn: "操作",
    learned: "已学会",
    mastered: "已掌握",
    correctCount: "答对 {count} / 3 次",
    markLearned: "标记已学会",
    untick: "取消标记",
    markedLearned: "已标记为学会。",
    unmarkedLearned: "已取消学会标记。",
    summary: "已学会或掌握 {learned} / {total} 个单词",
    matchingCount: "显示 {count} 个",
    loading: "正在加载词汇表…",
    loadError: "无法加载词汇表，请通过本地网页服务器打开此页面。",
    progressError: "无法将单词学习进度保存到浏览器 Cookie。",
    listFile: "文件"
  }
};

const wordsElements = {
  list: document.querySelector("#word-list-selector"),
  search: document.querySelector("#word-search"),
  rows: document.querySelector("#word-rows"),
  status: document.querySelector("#words-status"),
  summary: document.querySelector("#word-summary")
};

let wordsLocale = "en";
let wordsEnglishVariant = "us";
let wordsBank = [];
let wordsKeys = [];
let wordsListFiles = [];
let wordsListName = "word_list.json";
let wordsCorrectCounts = new Uint8Array();
let wordsLearned = new Uint8Array();

function wordsText(key, values = {}) {
  return Object.entries(values)
    .reduce((message, [name, value]) => message.replaceAll(`{${name}}`, value), wordsTranslations[wordsLocale][key]);
}

function setWordsLocale(language) {
  wordsLocale = language === "zh" ? "zh" : "en";
  document.documentElement.lang = wordsLocale;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = wordsTranslations[wordsLocale][node.dataset.i18n];
  });
  wordsElements.list.setAttribute("aria-label", wordsTranslations[wordsLocale].wordListLabel);
  wordsElements.search.placeholder = wordsTranslations[wordsLocale].searchPlaceholder;
  renderWordList();
}

function prepareWordEntries(entries) {
  const firstIndexByAnswer = new Map();
  return entries.flatMap((entry, sourceIndex) => {
    if (!entry || typeof entry.word !== "string") return [];
    const answer = entry.word.toUpperCase().replace(/[^A-Z]/g, "");
    if (answer && !firstIndexByAnswer.has(answer)) firstIndexByAnswer.set(answer, sourceIndex);
    return [{
      answer,
      sourceIndex: answer ? firstIndexByAnswer.get(answer) : sourceIndex,
      word: entry.word,
      wordUs: typeof entry.word_us === "string" ? entry.word_us : entry.word,
      wordUk: typeof entry.word_uk === "string" ? entry.word_uk : entry.word,
      phoneticUs: typeof entry.phonetic_us === "string" ? entry.phonetic_us : "",
      phoneticUk: typeof entry.phonetic_uk === "string" ? entry.phonetic_uk : "",
      pos: typeof entry.pos === "string" ? entry.pos : "",
      definitionEn: typeof entry.definition_en === "string" ? entry.definition_en : "",
      definitionZh: typeof entry.definition_zh === "string" ? entry.definition_zh : ""
    }];
  });
}

async function fetchWordsFile(filename, optional = false) {
  const response = await fetch(`./${filename}`, { cache: "no-store" });
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(`Unable to load ${filename}: HTTP ${response.status}`);
  const data = await response.json();
  if (!data || !Array.isArray(data.words)) throw new Error(`${filename} has no words array`);
  return data;
}

async function chooseWordsFile(filename) {
  if (!wordsListFiles.includes(filename)) return;
  try {
    wordsElements.status.textContent = wordsText("loading");
    const data = await fetchWordsFile(filename);
    wordsListName = filename;
    wordsBank = prepareWordEntries(data.words);
    wordsKeys = data.words.map((entry) => entry?.word || "");
    const legacyIndices = [...new Set(wordsBank
      .filter((word) => word.answer && word.answer.length <= 30)
      .map((word) => word.sourceIndex))];
    const progress = window.CrosswordStorage.readProgress(
      filename,
      data.words.length,
      legacyIndices,
      wordsKeys
    );
    wordsCorrectCounts = progress.correctCounts;
    wordsLearned = progress.learned;
    wordsElements.list.value = filename;
    window.CrosswordStorage.writeSettings({ ...window.CrosswordStorage.readSettings(), wordList: filename });
    wordsElements.status.textContent = "";
    renderWordList();
  } catch (error) {
    console.error(`Unable to load word list ${filename}:`, error);
    wordsElements.list.value = wordsListName;
    wordsElements.status.textContent = wordsText("loadError");
    wordsElements.status.className = "game-status error";
  }
}

function renderWordList() {
  if (!wordsBank.length && !wordsListName) return;
  const query = wordsElements.search.value.trim().toLocaleLowerCase();
  const fragment = document.createDocumentFragment();
  let learnedCount = 0;
  let visibleCount = 0;

  wordsBank.forEach((word) => {
    const displayWord = wordsEnglishVariant === "uk" ? word.wordUk : word.wordUs;
    const phonetic = wordsEnglishVariant === "uk" ? word.phoneticUk : word.phoneticUs;
    const mastered = wordsCorrectCounts[word.sourceIndex] >= 3;
    const manuallyLearned = wordsLearned[word.sourceIndex] === 1;
    if (mastered || manuallyLearned) learnedCount += 1;
    const haystack = `${displayWord} ${word.wordUs} ${word.wordUk} ${phonetic} ${word.pos} ${word.definitionEn} ${word.definitionZh}`.toLocaleLowerCase();
    if (query && !haystack.includes(query)) return;
    visibleCount += 1;

    const row = document.createElement("tr");
    if (mastered || manuallyLearned) row.classList.add("word-learned");
    const wordCell = document.createElement("th");
    wordCell.scope = "row";
    wordCell.textContent = displayWord;
    row.append(wordCell);

    const phoneticCell = document.createElement("td");
    phoneticCell.className = "word-phonetic";
    phoneticCell.textContent = phonetic || "—";
    row.append(phoneticCell);

    for (const value of [word.pos, word.definitionEn, word.definitionZh]) {
      const cell = document.createElement("td");
      cell.textContent = value || "—";
      row.append(cell);
    }

    const progressCell = document.createElement("td");
    const progressLabel = document.createElement("span");
    progressLabel.className = "word-progress";
    progressLabel.textContent = mastered
      ? `✓ ${wordsText("mastered")}`
      : manuallyLearned
        ? `✓ ${wordsText("learned")}`
        : wordsText("correctCount", { count: wordsCorrectCounts[word.sourceIndex] });
    progressCell.append(progressLabel);
    row.append(progressCell);

    const actionCell = document.createElement("td");
    const action = document.createElement("button");
    action.type = "button";
    action.className = "button button-secondary word-action";
    action.textContent = manuallyLearned ? wordsText("untick") : wordsText("markLearned");
    action.disabled = mastered;
    action.setAttribute("aria-pressed", String(Boolean(manuallyLearned || mastered)));
    action.addEventListener("click", () => toggleLearned(word.sourceIndex));
    actionCell.append(action);
    row.append(actionCell);
    fragment.append(row);
  });

  wordsElements.rows.replaceChildren(fragment);
  wordsElements.summary.textContent = `${wordsText("summary", { learned: learnedCount, total: wordsBank.length })} · ${wordsText("matchingCount", { count: visibleCount })}`;
}

function toggleLearned(index) {
  if (wordsCorrectCounts[index] >= 3) return;
  wordsLearned[index] = wordsLearned[index] ? 0 : 1;
  if (!window.CrosswordStorage.writeProgress(wordsListName, wordsCorrectCounts, wordsLearned, wordsKeys)) {
    wordsLearned[index] = wordsLearned[index] ? 0 : 1;
    wordsElements.status.textContent = wordsText("progressError");
    wordsElements.status.className = "game-status error";
    return;
  }
  wordsElements.status.textContent = wordsText(wordsLearned[index] ? "markedLearned" : "unmarkedLearned");
  wordsElements.status.className = "game-status success";
  renderWordList();
}

async function initializeWordsPage() {
  const files = [];
  if (await fetchWordsFile("word_list.json", true)) files.push("word_list.json");
  if (await fetchWordsFile("word_list0.json", true)) files.push("word_list0.json");
  for (let number = 1; ; number += 1) {
    const filename = `word_list${number}.json`;
    const data = await fetchWordsFile(filename, true);
    if (!data) break;
    files.push(filename);
  }
  if (!files.length) throw new Error("No word_list*.json files were found");
  wordsListFiles = files;
  for (const filename of files) {
    const option = document.createElement("option");
    option.value = filename;
    option.textContent = filename;
    wordsElements.list.append(option);
  }

  const settings = window.CrosswordStorage.readSettings();
  wordsEnglishVariant = settings.englishVariant === "uk" ? "uk" : "us";
  const selectedFile = files.includes(settings.wordList) ? settings.wordList : files[0];
  await chooseWordsFile(selectedFile);
}

wordsElements.list.addEventListener("change", (event) => chooseWordsFile(event.target.value));
wordsElements.search.addEventListener("input", renderWordList);

const savedSettings = window.CrosswordStorage.readSettings();
wordsLocale = savedSettings.locale === "zh" ? "zh" : "en";
wordsEnglishVariant = savedSettings.englishVariant === "uk" ? "uk" : "us";
document.documentElement.dataset.theme = savedSettings.theme === "dark" ? "dark" : "light";
setWordsLocale(wordsLocale);
wordsElements.status.textContent = wordsText("loading");
initializeWordsPage().catch((error) => {
  console.error("Unable to initialize word list page:", error);
  wordsElements.status.textContent = wordsText("loadError");
  wordsElements.status.className = "game-status error";
});
