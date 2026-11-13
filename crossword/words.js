const wordsTranslations = {
  en: {
    eyebrow: "A LITTLE WORD PRACTICE",
    title: "Word list",
    subtitle: "Review meanings and track the words you have learned.",
    crosswordLink: "Crossword",
    settingsLink: "Settings",
    searchLabel: "Search",
    searchPlaceholder: "Search words or meanings",
    wordColumn: "Word",
    audioColumn: "Audio",
    playAudio: "Play audio",
    audioError: "Audio could not be played; the file may be missing.",
    phoneticColumn: "Pronunciation",
    levelColumn: "Level",
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
    searchLabel: "搜索",
    searchPlaceholder: "搜索单词或释义",
    wordColumn: "单词",
    audioColumn: "发音",
    playAudio: "播放发音",
    audioError: "无法播放发音，音频文件可能缺失。",
    phoneticColumn: "音标",
    levelColumn: "级别",
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
  search: document.querySelector("#word-search"),
  rows: document.querySelector("#word-rows"),
  status: document.querySelector("#words-status"),
  summary: document.querySelector("#word-summary")
};

let wordsLocale = "en";
let wordsEnglishVariant = "us";
let wordsLevel = "all";
let wordsBank = [];
let wordsKeys = [];
let wordsListName = "word_list.json";
let wordsCorrectCounts = new Uint8Array();
let wordsLearned = new Uint8Array();
let currentWordAudio = null;
let stopCurrentWordAudio = null;

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
  wordsElements.search.placeholder = wordsTranslations[wordsLocale].searchPlaceholder;
  renderWordList();
}

function prepareWordEntries(entries) {
  const firstIndexByAnswer = new Map();
  return entries.flatMap((entry, sourceIndex) => {
    if (!entry || typeof entry.word !== "string") return [];
    if (wordsLevel !== "all" && entry.level !== wordsLevel) return [];
    const answer = entry.word.toUpperCase().replace(/[^A-Z]/g, "");
    if (answer && !firstIndexByAnswer.has(answer)) firstIndexByAnswer.set(answer, sourceIndex);
    return [{
      answer,
      sourceIndex: answer ? firstIndexByAnswer.get(answer) : sourceIndex,
      word: entry.word,
      wordUs: typeof entry.spelling_us === "string"
        ? entry.spelling_us
        : typeof entry.word_us === "string" ? entry.word_us : entry.word,
      wordUk: typeof entry.spelling_uk === "string"
        ? entry.spelling_uk
        : typeof entry.word_uk === "string" ? entry.word_uk : entry.word,
      phoneticUs: typeof entry.phonetic_us === "string" ? entry.phonetic_us : "",
      phoneticUk: typeof entry.phonetic_uk === "string" ? entry.phonetic_uk : "",
      level: typeof entry.level_name === "string" ? entry.level_name : typeof entry.level === "string" ? entry.level : "",
      pos: typeof entry.pos === "string" ? entry.pos : "",
      definitionEn: typeof entry.meaning_en === "string"
        ? entry.meaning_en
        : typeof entry.definition_en === "string" ? entry.definition_en : "",
      definitionZh: typeof entry.meaning_zh === "string"
        ? entry.meaning_zh
        : typeof entry.definition_zh === "string" ? entry.definition_zh : ""
    }];
  });
}

async function fetchWordsFile(filename) {
  const response = await fetch(`./${filename}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${filename}: HTTP ${response.status}`);
  const data = await response.json();
  if (!data || !Array.isArray(data.words)) throw new Error(`${filename} has no words array`);
  return data;
}

async function chooseWordsFile(filename) {
  if (filename !== wordsListName) return;
  try {
    wordsElements.status.textContent = wordsText("loading");
    const data = await fetchWordsFile(filename);
    wordsListName = filename;
    const levels = Array.isArray(data.meta?.levels)
      ? data.meta.levels.map((level) => level?.key).filter((level) => typeof level === "string")
      : [...new Set(data.words.map((entry) => entry?.level).filter((level) => typeof level === "string"))];
    const settings = window.CrosswordStorage.readSettings();
    wordsLevel = levels.includes(settings.wordLevel) ? settings.wordLevel : levels[0] || "all";
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
    if (settings.wordList !== filename || settings.wordLevel !== wordsLevel) {
      if (!window.CrosswordStorage.writeSettings({ ...settings, wordList: filename, wordLevel: wordsLevel })) {
        throw new Error("Unable to save the selected vocabulary level");
      }
    }
    wordsElements.status.textContent = "";
    renderWordList();
  } catch (error) {
    console.error(`Unable to load word list ${filename}:`, error);
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
    const haystack = `${displayWord} ${word.wordUs} ${word.wordUk} ${phonetic} ${word.level} ${word.pos} ${word.definitionEn} ${word.definitionZh}`.toLocaleLowerCase();
    if (query && !haystack.includes(query)) return;
    visibleCount += 1;

    const row = document.createElement("tr");
    if (mastered || manuallyLearned) row.classList.add("word-learned");
    const wordCell = document.createElement("th");
    wordCell.scope = "row";
    wordCell.textContent = displayWord;
    row.append(wordCell);

    const audioCell = document.createElement("td");
    const audioButton = document.createElement("button");
    audioButton.type = "button";
    audioButton.className = "button button-secondary word-audio";
    audioButton.setAttribute("aria-label", `${wordsText("playAudio")}: ${displayWord}`);
    const audioIcon = document.createElement("img");
    audioIcon.src = "./player.svg";
    audioIcon.alt = "";
    audioIcon.setAttribute("aria-hidden", "true");
    audioButton.append(audioIcon);
    audioButton.addEventListener("click", () => playWordAudio(word.word, audioButton));
    audioCell.append(audioButton);
    row.append(audioCell);

    const phoneticCell = document.createElement("td");
    phoneticCell.className = "word-phonetic";
    phoneticCell.textContent = phonetic || "—";
    row.append(phoneticCell);

    for (const value of [word.level, word.pos, word.definitionEn, word.definitionZh]) {
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

function playWordAudio(word, button) {
  if (stopCurrentWordAudio) stopCurrentWordAudio();

  wordsElements.status.textContent = "";
  wordsElements.status.className = "game-status";
  const filename = encodeURIComponent(word);
  const variant = wordsEnglishVariant === "uk" ? "uk" : "us";

  const finish = (activeAudio) => {
    if (currentWordAudio !== activeAudio) return;
    button.disabled = false;
    currentWordAudio = null;
    stopCurrentWordAudio = null;
  };
  const showError = (error) => {
    console.error(`Unable to play audio for ${word}:`, error);
    wordsElements.status.textContent = wordsText("audioError");
    wordsElements.status.className = "game-status error";
  };
  const audio = new Audio(`./audio/${filename}.${variant}.wav`);
  currentWordAudio = audio;
  button.disabled = true;
  audio.addEventListener("ended", () => finish(audio), { once: true });
  audio.addEventListener("error", () => {
    if (currentWordAudio !== audio) return;
    finish(audio);
    showError(new Error("Audio file is missing or could not be decoded"));
  }, { once: true });
  stopCurrentWordAudio = () => {
    if (currentWordAudio !== audio) return;
    audio.pause();
    finish(audio);
  };
  audio.play().catch((error) => {
    if (currentWordAudio !== audio) return;
    finish(audio);
    showError(error);
  });
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
  const settings = window.CrosswordStorage.readSettings();
  wordsEnglishVariant = settings.englishVariant === "uk" ? "uk" : "us";
  if (settings.wordList !== wordsListName
    && !window.CrosswordStorage.writeSettings({ ...settings, wordList: wordsListName })) {
    throw new Error("Unable to save the configured word list");
  }
  await chooseWordsFile(wordsListName);
}

wordsElements.search.addEventListener("input", renderWordList);

const savedSettings = window.CrosswordStorage.readSettings();
wordsLocale = savedSettings.locale === "zh" ? "zh" : "en";
wordsEnglishVariant = savedSettings.englishVariant === "uk" ? "uk" : "us";
document.documentElement.dataset.theme = savedSettings.theme === "dark" ? "dark" : "light";
window.CrosswordStorage.applyAppearance(savedSettings);
setWordsLocale(wordsLocale);
wordsElements.status.textContent = wordsText("loading");
initializeWordsPage().catch((error) => {
  console.error("Unable to initialize word list page:", error);
  wordsElements.status.textContent = wordsText("loadError");
  wordsElements.status.className = "game-status error";
});
