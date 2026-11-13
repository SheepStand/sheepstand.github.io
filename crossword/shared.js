(() => {
  const PROGRESS_PREFIX = "crossword-progress-";
  const SHARED_PROGRESS_PREFIX = "crossword-word-progress-";
  const SHARED_PROGRESS_COUNT = `${SHARED_PROGRESS_PREFIX}count`;
  const SHARED_PROGRESS_CHUNK_SIZE = 2000;
  const SETTINGS_COOKIE = "crossword-settings";
  const COOKIE_MAX_LENGTH = 3800;
  const GAME_SAVE_COOKIE = "crossword-game-save";
  const EXPORT_FORMAT = "crossword-html-backup";
  const BOARD_SIZE = 31;
  const DEFAULT_ACCENT_COLOR = "#2563eb";
  const WORD_LIST_CACHE_PREFIX = "crossword-word-list-v1:";
  const systemThemePreference = window.matchMedia("(prefers-color-scheme: dark)");
  let systemThemeListenerAttached = false;

  function getCookie(name) {
    const cookie = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
    if (!cookie) return null;
    try {
      return decodeURIComponent(cookie.slice(name.length + 1));
    } catch (error) {
      console.error(`Unable to decode ${name} cookie:`, error);
      return null;
    }
  }

  function setCookie(name, value) {
    const encoded = encodeURIComponent(value);
    if (encoded.length > COOKIE_MAX_LENGTH) return false;
    try {
      document.cookie = `${name}=${encoded}; Max-Age=31536000; Path=/; SameSite=Lax`;
    } catch (error) {
      console.error(`Unable to write ${name} cookie:`, error);
      return false;
    }
    return document.cookie.split("; ").some((cookie) => cookie.startsWith(`${name}=`));
  }

  function cookieKey(listName) {
    return `${PROGRESS_PREFIX}${listName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }

  function toBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function fromBase64(encoded) {
    const binary = atob(encoded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function readSharedProgress() {
    const chunkCount = Number(getCookie(SHARED_PROGRESS_COUNT));
    if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 100) return {};
    let serialized = "";
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = getCookie(`${SHARED_PROGRESS_PREFIX}${index}`);
      if (chunk === null) return {};
      serialized += chunk;
    }
    try {
      const saved = JSON.parse(serialized);
      return saved && saved.version === 1 && saved.words && typeof saved.words === "object"
        ? saved.words
        : {};
    } catch (error) {
      console.error("Unable to read shared word progress:", error);
      return {};
    }
  }

  function writeSharedProgress(words) {
    const serialized = JSON.stringify({ version: 1, words });
    const chunks = [];
    for (let offset = 0; offset < serialized.length; offset += SHARED_PROGRESS_CHUNK_SIZE) {
      chunks.push(serialized.slice(offset, offset + SHARED_PROGRESS_CHUNK_SIZE));
    }
    for (let index = 0; index < chunks.length; index += 1) {
      if (!setCookie(`${SHARED_PROGRESS_PREFIX}${index}`, chunks[index])) return false;
    }
    return setCookie(SHARED_PROGRESS_COUNT, String(chunks.length));
  }

  function normalizeWord(word) {
    return typeof word === "string" ? word.toLocaleUpperCase().replace(/[^A-Z]/g, "") : "";
  }

  function readProgress(listName, totalWords, legacySourceIndices = [], wordKeys = []) {
    const progress = { correctCounts: new Uint8Array(totalWords), learned: new Uint8Array(totalWords) };
    const shared = readSharedProgress();
    const raw = getCookie(cookieKey(listName));
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        if (!saved || saved.version !== 1) throw new Error("Unsupported progress cookie version");
        if (typeof saved.counts === "string") {
          const packedCounts = fromBase64(saved.counts);
          const sourceIndices = Number.isInteger(saved.size)
            ? Array.from({ length: Math.min(totalWords, saved.size) }, (_, index) => index)
            : legacySourceIndices;
          for (let index = 0; index < sourceIndices.length; index += 1) {
            const value = (packedCounts[index >> 2] >> ((index & 3) * 2)) & 3;
            if (sourceIndices[index] < totalWords) progress.correctCounts[sourceIndices[index]] = value;
          }
        }
        if (typeof saved.learned === "string") {
          const packedLearned = fromBase64(saved.learned);
          const sourceIndices = Number.isInteger(saved.size)
            ? Array.from({ length: Math.min(totalWords, saved.size) }, (_, index) => index)
            : legacySourceIndices;
          for (let index = 0; index < sourceIndices.length; index += 1) {
            if (sourceIndices[index] < totalWords) {
              progress.learned[sourceIndices[index]] = (packedLearned[index >> 3] >> (index & 7)) & 1;
            }
          }
        }
      } catch (error) {
        console.error(`Unable to read progress for ${listName}:`, error);
      }
    }

    wordKeys.forEach((word, index) => {
      const key = normalizeWord(word);
      if (!key || index >= totalWords) return;
      const sharedProgress = shared[key];
      if (Object.hasOwn(shared, key) && Array.isArray(sharedProgress) && sharedProgress.length === 2) {
        progress.correctCounts[index] = Math.min(3, Number(sharedProgress[0]) || 0);
        progress.learned[index] = sharedProgress[1] ? 1 : 0;
      }
    });

    if (wordKeys.length > 0) {
      const merged = { ...shared };
      wordKeys.forEach((word, index) => {
        const key = normalizeWord(word);
        if (!key || index >= totalWords) return;
        const existing = merged[key];
        const count = Math.min(3, progress.correctCounts[index]);
        const learned = Boolean(progress.learned[index]);
        if (count || learned) {
          merged[key] = [
            Math.max(count, Array.isArray(existing) ? Number(existing[0]) || 0 : 0),
            learned || Boolean(Array.isArray(existing) && existing[1])
          ];
          progress.correctCounts[index] = merged[key][0];
          progress.learned[index] = Number(merged[key][1]);
        }
      });
      writeSharedProgress(merged);
    }
    return progress;
  }

  function writeProgress(listName, correctCounts, learned, wordKeys = []) {
    const packedCounts = new Uint8Array(Math.ceil(correctCounts.length / 4));
    const packedLearned = new Uint8Array(Math.ceil(learned.length / 8));
    for (let index = 0; index < correctCounts.length; index += 1) {
      packedCounts[index >> 2] |= (Math.min(3, correctCounts[index]) & 3) << ((index & 3) * 2);
      if (learned[index]) packedLearned[index >> 3] |= 1 << (index & 7);
    }
    const saved = JSON.stringify({
      version: 1,
      size: correctCounts.length,
      counts: toBase64(packedCounts),
      learned: toBase64(packedLearned)
    });
    const shared = readSharedProgress();
    wordKeys.forEach((word, index) => {
      const key = normalizeWord(word);
      if (!key || index >= correctCounts.length) return;
      const count = Math.min(3, correctCounts[index]);
      const isLearned = Boolean(learned[index]);
      if (count || isLearned) shared[key] = [count, isLearned];
      else if (Object.hasOwn(shared, key)) shared[key] = [0, false];
    });
    const sharedSaved = writeSharedProgress(shared);
    const listSaved = setCookie(cookieKey(listName), saved);
    return sharedSaved && listSaved;
  }

  function readSettings() {
    const raw = getCookie(SETTINGS_COOKIE);
    let settings = {};
    try {
      const saved = raw ? JSON.parse(raw) : {};
      settings = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      console.error("Unable to read crossword settings:", error);
    }
    if (settings.theme === "light" || settings.theme === "dark" || settings.theme === "system") return settings;

    try {
      const legacyTheme = localStorage.getItem("crossword-theme");
      if (legacyTheme === "light" || legacyTheme === "dark") {
        settings.theme = legacyTheme;
        if (setCookie(SETTINGS_COOKIE, JSON.stringify(settings))) {
          localStorage.removeItem("crossword-theme");
        }
      }
    } catch (error) {
      console.error("Unable to migrate the saved crossword theme:", error);
    }
    return settings;
  }

  function writeSettings(settings) {
    const saved = setCookie(SETTINGS_COOKIE, JSON.stringify(settings));
    if (saved) {
      try {
        localStorage.removeItem("crossword-theme");
      } catch (error) {
        console.error("Unable to remove the legacy crossword theme:", error);
      }
    }
    return saved;
  }

  async function loadWordList(filename = "word_list.json") {
    const wordListUrl = new URL(filename, document.baseURI);
    const hashUrl = new URL(`${filename}.hash`, document.baseURI);
    const cacheKey = `${WORD_LIST_CACHE_PREFIX}${wordListUrl.pathname}`;
    const hashResponse = await fetch(hashUrl, { cache: "no-store" });
    if (!hashResponse.ok) throw new Error(`Unable to load ${hashUrl.pathname}: HTTP ${hashResponse.status}`);
    const expectedHash = (await hashResponse.text()).trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
      throw new Error(`${hashUrl.pathname} does not contain a valid SHA-256 hash`);
    }

    try {
      const cachedValue = localStorage.getItem(cacheKey);
      if (cachedValue) {
        const cached = JSON.parse(cachedValue);
        if (cached.hash === expectedHash && typeof cached.wordList === "string") {
          const data = JSON.parse(cached.wordList);
          if (data && Array.isArray(data.words)) return data;
          console.error(`Cached word list ${wordListUrl.pathname} is invalid; refreshing it.`);
        }
      }
    } catch (error) {
      console.error(`Unable to read cached word list ${wordListUrl.pathname}:`, error);
    }

    const response = await fetch(wordListUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${wordListUrl.pathname}: HTTP ${response.status}`);
    const wordList = await response.text();
    const data = JSON.parse(wordList);
    if (!data || !Array.isArray(data.words)) {
      throw new Error(`${wordListUrl.pathname} has no words array`);
    }

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ hash: expectedHash, wordList }));
    } catch (error) {
      console.error(`Unable to cache word list ${wordListUrl.pathname} in localStorage:`, error);
    }
    return data;
  }

  function applyAppearance(settings = readSettings()) {
    const theme = settings.theme === "system"
      ? (systemThemePreference.matches ? "dark" : "light")
      : settings.theme === "dark" ? "dark" : "light";
    const accentColor = /^#[0-9a-f]{6}$/i.test(settings.accentColor || "")
      ? settings.accentColor
      : DEFAULT_ACCENT_COLOR;
    const channels = accentColor.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255);
    const luminance = channels
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const accentForeground = luminance > 0.179 ? "#000000" : "#ffffff";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--accent", accentColor);
    document.documentElement.style.setProperty("--accent-foreground", accentForeground);
    document.documentElement.style.setProperty(
      "--accent-border",
      accentForeground === "#000000" ? "#000000" : "transparent"
    );
    if (!systemThemeListenerAttached) {
      systemThemePreference.addEventListener("change", () => {
        const currentSettings = readSettings();
        if (currentSettings.theme === "system") applyAppearance(currentSettings);
      });
      systemThemeListenerAttached = true;
    }
    return { theme, accentColor, accentForeground };
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isWordListName(value) {
    return value === "word_list.json";
  }

  function isValidGameSave(save) {
    return isRecord(save)
      && save.version === 1
      && isWordListName(save.wordList)
      && Array.isArray(save.words)
      && save.words.length > 0
      && save.words.every((placement) =>
        Array.isArray(placement)
        && placement.length === 4
        && Number.isInteger(placement[0])
        && placement[0] >= 0
        && Number.isInteger(placement[1])
        && placement[1] >= 0
        && placement[1] < BOARD_SIZE
        && Number.isInteger(placement[2])
        && placement[2] >= 0
        && placement[2] < BOARD_SIZE
        && (placement[3] === "across" || placement[3] === "down"))
      && Array.isArray(save.letters)
      && save.letters.every((letter) =>
        Array.isArray(letter)
        && letter.length === 2
        && Number.isInteger(letter[0])
        && letter[0] >= 0
        && letter[0] < BOARD_SIZE * BOARD_SIZE
        && typeof letter[1] === "string"
        && /^[A-Z]$/.test(letter[1]))
      && Array.isArray(save.counted)
      && save.counted.every((wordIndex) => Number.isInteger(wordIndex) && wordIndex >= 0)
      && (save.wordLevel === undefined || typeof save.wordLevel === "string")
      && (save.showChinese === undefined || typeof save.showChinese === "boolean")
      && (save.locale === undefined || save.locale === "en" || save.locale === "zh");
  }

  function isValidSettings(settings) {
    return isRecord(settings)
      && (settings.locale === "en" || settings.locale === "zh")
      && (settings.theme === "light" || settings.theme === "dark" || settings.theme === "system")
      && typeof settings.showChinese === "boolean"
      && (settings.englishVariant === undefined || settings.englishVariant === "us" || settings.englishVariant === "uk")
      && (settings.accentColor === undefined || /^#[0-9a-f]{6}$/i.test(settings.accentColor))
      && (settings.wordList === undefined || isWordListName(settings.wordList))
      && (settings.wordLevel === undefined || typeof settings.wordLevel === "string");
  }

  function isValidListProgress(value) {
    if (!isRecord(value) || value.version !== 1 || !Number.isInteger(value.size) || value.size < 0
      || typeof value.counts !== "string" || typeof value.learned !== "string"
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.counts)
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.learned)) {
      return false;
    }
    try {
      return fromBase64(value.counts).length === Math.ceil(value.size / 4)
        && fromBase64(value.learned).length === Math.ceil(value.size / 8);
    } catch (error) {
      return false;
    }
  }

  function isValidBackup(data) {
    if (!isRecord(data) || data.format !== EXPORT_FORMAT || data.version !== 1
      || !(data.savedGame === null || isValidGameSave(data.savedGame))
      || (data.settings !== undefined && !isValidSettings(data.settings))
      || !isRecord(data.progress)
      || !isRecord(data.progress.sharedWords)
      || !isRecord(data.progress.lists)) {
      return false;
    }
    for (const [word, progress] of Object.entries(data.progress.sharedWords)) {
      if (!/^[A-Z]+$/.test(word)
        || !Array.isArray(progress)
        || progress.length !== 2
        || !Number.isInteger(progress[0])
        || progress[0] < 0
        || progress[0] > 3
        || typeof progress[1] !== "boolean") {
        return false;
      }
    }
    return Object.entries(data.progress.lists).every(([name, progress]) =>
      isWordListName(name) && isValidListProgress(progress));
  }

  function exportData() {
    const lists = {};
    for (const item of document.cookie.split("; ")) {
      const separator = item.indexOf("=");
      const name = item.slice(0, separator);
      if (!name.startsWith(PROGRESS_PREFIX)) continue;
      const listName = name.slice(PROGRESS_PREFIX.length).replace(/_json$/, ".json");
      const raw = getCookie(name);
      if (raw === null) throw new Error(`Unable to read saved progress for ${listName}`);
      try {
        const progress = JSON.parse(raw);
        if (!isWordListName(listName) || !isValidListProgress(progress)) {
          throw new Error(`Saved progress for ${listName} has an invalid format`);
        }
        lists[listName] = progress;
      } catch (error) {
        console.error(`Unable to export progress for ${listName}:`, error);
        throw error;
      }
    }

    const rawGameSave = getCookie(GAME_SAVE_COOKIE);
    let savedGame = null;
    if (rawGameSave !== null) {
      try {
        savedGame = JSON.parse(rawGameSave);
      } catch (error) {
        console.error("Unable to export saved crossword:", error);
        throw new Error("Unable to read the saved crossword");
      }
    }

    const settings = readSettings();
    const data = {
      format: EXPORT_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      savedGame,
      settings: {
        locale: settings.locale === "zh" ? "zh" : "en",
        theme: settings.theme === "dark" || settings.theme === "system" ? settings.theme : "light",
        showChinese: settings.showChinese === true,
        englishVariant: settings.englishVariant === "uk" ? "uk" : "us",
        accentColor: /^#[0-9a-f]{6}$/i.test(settings.accentColor || "")
          ? settings.accentColor
          : DEFAULT_ACCENT_COLOR,
        ...(isWordListName(settings.wordList) ? { wordList: settings.wordList } : {}),
        ...(typeof settings.wordLevel === "string" ? { wordLevel: settings.wordLevel } : {})
      },
      progress: { sharedWords: readSharedProgress(), lists }
    };
    if (!isValidBackup(data)) throw new Error("Saved data is not in a valid exportable format");
    return data;
  }

  function expireCookie(name) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  }

  function clearLearningProgress() {
    const progressCookies = document.cookie.split("; ")
      .map((item) => item.slice(0, item.indexOf("=")))
      .filter((name) => name.startsWith(PROGRESS_PREFIX) || name.startsWith(SHARED_PROGRESS_PREFIX));
    for (const name of progressCookies) expireCookie(name);
    return !document.cookie.split("; ").some((item) => {
      const name = item.slice(0, item.indexOf("="));
      return name.startsWith(PROGRESS_PREFIX) || name.startsWith(SHARED_PROGRESS_PREFIX);
    });
  }

  function importData(data) {
    if (!isValidBackup(data)) return false;

    const serializedLists = Object.entries(data.progress.lists)
      .map(([name, progress]) => [cookieKey(name), JSON.stringify(progress)]);
    const serializedGame = data.savedGame === null ? null : JSON.stringify(data.savedGame);
    const serializedShared = JSON.stringify({ version: 1, words: data.progress.sharedWords });
    const sharedChunks = [];
    for (let offset = 0; offset < serializedShared.length; offset += SHARED_PROGRESS_CHUNK_SIZE) {
      sharedChunks.push(serializedShared.slice(offset, offset + SHARED_PROGRESS_CHUNK_SIZE));
    }
    if (sharedChunks.length > 100
      || sharedChunks.some((chunk, index) =>
        encodeURIComponent(chunk).length > COOKIE_MAX_LENGTH
        || encodeURIComponent(`${SHARED_PROGRESS_PREFIX}${index}`).length > COOKIE_MAX_LENGTH)
      || serializedLists.some(([name, value]) =>
        encodeURIComponent(value).length > COOKIE_MAX_LENGTH
        || encodeURIComponent(name).length > COOKIE_MAX_LENGTH)
      || (serializedGame !== null && encodeURIComponent(serializedGame).length > COOKIE_MAX_LENGTH)
      || (data.settings && encodeURIComponent(JSON.stringify(data.settings)).length > COOKIE_MAX_LENGTH)) {
      return false;
    }

    const existingProgressCookies = document.cookie.split("; ")
      .map((item) => item.slice(0, item.indexOf("=")))
      .filter((name) => name.startsWith(PROGRESS_PREFIX));
    const targetProgressCookies = new Set(serializedLists.map(([name]) => name));
    for (const name of existingProgressCookies) {
      if (!targetProgressCookies.has(name)) expireCookie(name);
    }

    for (const item of document.cookie.split("; ")) {
      const name = item.slice(0, item.indexOf("="));
      if (name.startsWith(SHARED_PROGRESS_PREFIX) && name !== SHARED_PROGRESS_COUNT) {
        const index = Number(name.slice(SHARED_PROGRESS_PREFIX.length));
        if (Number.isInteger(index) && index >= sharedChunks.length) expireCookie(name);
      }
    }

    const sharedSaved = writeSharedProgress(data.progress.sharedWords);
    const listsSaved = serializedLists.every(([name, value]) => setCookie(name, value));
    const gameSaved = serializedGame === null
      ? (expireCookie(GAME_SAVE_COOKIE), true)
      : setCookie(GAME_SAVE_COOKIE, serializedGame);
    const settingsSaved = data.settings ? writeSettings(data.settings) : true;
    return sharedSaved && listsSaved && gameSaved && settingsSaved;
  }

  window.CrosswordStorage = Object.freeze({
    getCookie,
    setCookie,
    readProgress,
    writeProgress,
    readSettings,
    writeSettings,
    loadWordList,
    applyAppearance,
    clearLearningProgress,
    exportData,
    isValidBackup,
    importData
  });
})();
