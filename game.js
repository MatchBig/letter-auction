let word = "";
let display = [];
let gameOver = false;
let guessed = new Set();

let currentTab = "legacy";
let leaderboardType = "score"; // "score" or "money"
let currentViewState = "normal"; // "normal", "viewAll", "viewPlayer"
let viewPlayerName = ""; // stores the player name when in viewPlayer mode
let playerName = "";
let nameLocked = false;
let authReady = false;

const DEFAULT_RUN_STATE = {
  balance: 25000,
  gamesWon: 0,
  maxStreak: 0
};

const DEFAULT_UPGRADES = {
  vowelDiscount: false,
  consonantDiscount: false,
  bonusWin: false,
  safetyNet: false,
  safetyNetUsed: false,
  unlockedThemes: [],
  activeTheme: "light"
};
function makeDefaultUpgrades() {
  return {
    vowelDiscount: false,
    consonantDiscount: false,
    bonusWin: false,
    safetyNet: false,
    safetyNetUsed: false,
    unlockedThemes: [],
    activeTheme: "light"
  };
}

let activeStorageScope = "boot";
let runState = { ...DEFAULT_RUN_STATE };
let balance = DEFAULT_RUN_STATE.balance;
let gamesWon = DEFAULT_RUN_STATE.gamesWon;
let maxStreak = DEFAULT_RUN_STATE.maxStreak;

let upgrades = makeDefaultUpgrades();

let leaderboardData = { daily: [], weekly: [], monthly: [], legacy: [] };

let resetTimes = {
  daily: Date.now(),
  weekly: Date.now(),
  monthly: Date.now()
};

const SHOP_ITEMS = {
  hint:              { price: 4000, repeatable: true },
  vowelDiscount:     { price: 8000, repeatable: false },
  consonantDiscount: { price: 6000, repeatable: false },
  bonusWin:          { price: 12000, repeatable: false },
  safetyNet:         { price: 15000, repeatable: false },
  themeOcean:        { price: 5000, repeatable: false, theme: "ocean" },
  themeForest:       { price: 5000, repeatable: false, theme: "forest" },
  themeSunset:       { price: 5000, repeatable: false, theme: "sunset" },
  themeCandy:        { price: 5000, repeatable: false, theme: "candy" }
};

const THEME_BUTTON_MAP = {
  themeLight: "light",
  themeDark: "dark",
  themeOcean: "ocean",
  themeForest: "forest",
  themeSunset: "sunset",
  themeCandy: "candy"
};

const THEMES = {
  light:  { "--bg":"#f5f5f5","--panel":"#ffffff","--border":"#cccccc","--text":"#111111","--key":"#ffffff","--keyBorder":"#cccccc","--accent":"#222222","--accentText":"#ffffff","--subtext":"#555555" },
  dark:   { "--bg":"#121212","--panel":"#1e1e1e","--border":"#333333","--text":"#ffffff","--key":"#2a2a2a","--keyBorder":"#444444","--accent":"#eeeeee","--accentText":"#111111","--subtext":"#aaaaaa" },
  ocean:  { "--bg":"#d0e8f2","--panel":"#e8f4fb","--border":"#a0cce0","--text":"#0a3d5c","--key":"#c2dff0","--keyBorder":"#7ab8d4","--accent":"#0a6ea8","--accentText":"#ffffff","--subtext":"#2a6080" },
  forest: { "--bg":"#d4e6d0","--panel":"#eaf3e8","--border":"#9ec49a","--text":"#1a3d1a","--key":"#c8e0c4","--keyBorder":"#7aaf74","--accent":"#2a6b2a","--accentText":"#ffffff","--subtext":"#3a5e3a" },
  sunset: { "--bg":"#fde8d8","--panel":"#fff3ec","--border":"#f4b89a","--text":"#5c1a00","--key":"#fbd4be","--keyBorder":"#e8956a","--accent":"#d94f00","--accentText":"#ffffff","--subtext":"#8a3a10" },
  candy:  { "--bg":"#fce4f0","--panel":"#fff0f8","--border":"#f4a8d4","--text":"#5c0040","--key":"#fad4ec","--keyBorder":"#e880c0","--accent":"#cc2288","--accentText":"#ffffff","--subtext":"#8a3060" }
};

/* Firebase handles */
function fb() { return window.firebaseCtx || null; }
function getUid() {
  const ctx = fb();
  return ctx?.auth?.currentUser?.uid || null;
}
function boardEntriesPath(board) {
  const ctx = fb();
  return ctx.collection(ctx.db, "leaderboards", board, "entries");
}
function boardEntryDoc(board, id) {
  const ctx = fb();
  return ctx.doc(ctx.db, "leaderboards", board, "entries", id);
}
function scopedKey(base) {
  return `${base}:${activeStorageScope}`;
}
function resetInMemoryState() {
  runState = { ...DEFAULT_RUN_STATE };
  balance = DEFAULT_RUN_STATE.balance;
  gamesWon = DEFAULT_RUN_STATE.gamesWon;
  maxStreak = DEFAULT_RUN_STATE.maxStreak;
  upgrades = makeDefaultUpgrades();
  resetTimes = { daily: Date.now(), weekly: Date.now(), monthly: Date.now() };
}
function loadStateFromStorage() {
  const savedRun = JSON.parse(localStorage.getItem(scopedKey("runState")) || "null");
  runState = savedRun || { ...DEFAULT_RUN_STATE };
  balance = Number.isFinite(runState.balance) ? runState.balance : DEFAULT_RUN_STATE.balance;
  gamesWon = Number.isFinite(runState.gamesWon) ? runState.gamesWon : DEFAULT_RUN_STATE.gamesWon;
  maxStreak = Number.isFinite(runState.maxStreak) ? runState.maxStreak : DEFAULT_RUN_STATE.maxStreak;

  const savedUpgrades = JSON.parse(localStorage.getItem(scopedKey("upgrades")) || "null");
  upgrades = { ...makeDefaultUpgrades(), ...(savedUpgrades || {}) };
  upgrades.unlockedThemes = Array.isArray(upgrades.unlockedThemes) ? [...upgrades.unlockedThemes] : [];

  const savedResets = JSON.parse(localStorage.getItem(scopedKey("resetTimes")) || "null");
  resetTimes = savedResets || { daily: Date.now(), weekly: Date.now(), monthly: Date.now() };
}
function clearScopedStorage() {
  localStorage.removeItem(scopedKey("runState"));
  localStorage.removeItem(scopedKey("upgrades"));
  localStorage.removeItem(scopedKey("resetTimes"));
}
function hasScopedState() {
  return !!(
    localStorage.getItem(scopedKey("runState")) ||
    localStorage.getItem(scopedKey("upgrades")) ||
    localStorage.getItem(scopedKey("resetTimes"))
  );
}
function scopeForUser(user) {
  if (!user) return "signed-out";
  return user.isAnonymous ? `guest:${user.uid}` : `google:${user.uid}`;
}
async function loadStateFromCloud(user) {
  if (!user || user.isAnonymous || !fb()) return false;
  const ctx = fb();
  const ref = userProfileDoc(user.uid);
  const snap = await ctx.getDoc(ref);
  if (!snap.exists()) return false;
  const data = snap.data();
  if (data.runState) {
    balance = data.runState.balance || 0;
    gamesWon = data.runState.gamesWon || 0;
    maxStreak = data.runState.maxStreak || 0;
  }
  if (data.upgrades) {
    upgrades = { ...makeDefaultUpgrades(), ...data.upgrades };
  }
  if (data.resetTimes) {
    resetTimes = data.resetTimes;
  }
  return true;
}
async function activateSession(user) {
  activeStorageScope = scopeForUser(user);
  const input = document.getElementById("nameInput");
  playerName = "";
  nameLocked = false;
  if (input) {
    input.value = "";
    input.style.display = "inline-block";
  }

  if (!user) {
    resetInMemoryState();
  } else if (user.isAnonymous) {
    // Switching to guest always starts from a clean run.
    clearScopedStorage();
    resetInMemoryState();
  } else {
    const loadedFromCloud = await loadStateFromCloud(user);
    if (!loadedFromCloud) {
      if (hasScopedState()) loadStateFromStorage();
      else resetInMemoryState();
    }
  }

  checkResets();
  applyTheme(upgrades.activeTheme || "light");
  refreshStatsUI();
  startGame();
  await renderLeaderboard();
}
function userProfileDoc(uid) {
  const ctx = fb();
  return ctx.doc(ctx.db, "users", uid);
}
function setAuthMessage(text) {
  const el = document.getElementById("authStatus");
  if (el) el.innerText = text;
}
function setAuthButtonsBusy(isBusy) {
  const guestBtn = document.getElementById("guestAuthBtn");
  const googleBtn = document.getElementById("googleAuthBtn");
  if (guestBtn) guestBtn.disabled = isBusy;
  if (googleBtn) googleBtn.disabled = isBusy;
}
function updateAuthUiFromUser(user) {
  const input = document.getElementById("nameInput");
  if (!user) {
    authReady = false;
    nameLocked = false;
    playerName = "";
    if (input) {
      input.value = "";
      input.style.display = "inline-block";
    }
    return setAuthMessage("Not signed in");
  }

  authReady = true;
  const label = user.isAnonymous ? "Guest" : "Google";
  setAuthMessage(`Signed in as ${label} (${user.uid.slice(0, 8)}...)`);
}
async function waitForFirebaseCtx(maxMs = 8000) {
  const start = Date.now();
  while (!fb() && Date.now() - start < maxMs) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return fb();
}
async function savePlayerNameForCurrentUser(name) {
  const ctx = fb();
  const user = ctx?.auth?.currentUser;
  if (!ctx || !user || user.isAnonymous) return;
  const ref = userProfileDoc(user.uid);
  await ctx.setDoc(ref, { playerName: name, updatedAt: ctx.serverTimestamp() }, { merge: true });
}
async function loadPlayerNameForCurrentUser() {
  const ctx = fb();
  const user = ctx?.auth?.currentUser;
  if (!ctx || !user || user.isAnonymous) return;
  const ref = userProfileDoc(user.uid);
  const snap = await ctx.getDoc(ref);
  if (!snap.exists()) return;
  const savedName = String(snap.data().playerName || "").trim();
  const input = document.getElementById("nameInput");
  if (!savedName || !input) return;
  playerName = savedName;
  nameLocked = true;
  input.value = savedName;
  input.style.display = "none";
  const submitBtn = document.querySelector("#submitArea button");
  if (submitBtn) submitBtn.style.display = "none";
}

/* ---------- Save/Render helpers ---------- */
function saveRunState() {
  localStorage.setItem(scopedKey("runState"), JSON.stringify({ balance, gamesWon, maxStreak }));
  saveRunStateToCloud().catch(() => {});
}
function saveUpgrades() {
  localStorage.setItem(scopedKey("upgrades"), JSON.stringify(upgrades));
  saveUpgradesToCloud().catch(() => {});
}
async function saveRunStateToCloud() {
  if (!authReady || !fb() || !fb().auth.currentUser || fb().auth.currentUser.isAnonymous) return;
  const ctx = fb();
  const ref = userProfileDoc(ctx.auth.currentUser.uid);
  await ctx.setDoc(ref, { runState: { balance, gamesWon, maxStreak }, updatedAt: ctx.serverTimestamp() }, { merge: true });
}
async function saveUpgradesToCloud() {
  if (!authReady || !fb() || !fb().auth.currentUser || fb().auth.currentUser.isAnonymous) return;
  const ctx = fb();
  const ref = userProfileDoc(ctx.auth.currentUser.uid);
  await ctx.setDoc(ref, { upgrades, resetTimes, updatedAt: ctx.serverTimestamp() }, { merge: true });
}
function render() {
  document.getElementById("balance").innerText = "$" + balance.toLocaleString();
  document.getElementById("word").innerText = display.join(" ");
}
function renderShopBalance() {
  document.getElementById("shopBalance").innerText = "$" + balance.toLocaleString();
}
function setMessage(t, c) {
  const m = document.getElementById("message");
  m.innerText = t;
  m.className = c;
}
function flashMsg(text) {
  const m = document.getElementById("shopMsg");
  if (text) m.innerText = text;
  m.style.opacity = "1";
  clearTimeout(m._t);
  m._t = setTimeout(() => { m.style.opacity = "0"; }, 2200);
}
function refreshStatsUI() {
  document.getElementById("gamesWon").innerText = gamesWon;
  document.getElementById("maxStreak").innerText = maxStreak;
  render();
  renderShopBalance();
  updateHintAvailability();
  refreshUpgradeButtons();
  refreshThemeButtons();
}

/* ---------- Theme ---------- */
function applyTheme(name) {
  const t = THEMES[name] || THEMES.light;
  const root = document.documentElement;
  Object.entries(t).forEach(([k, v]) => root.style.setProperty(k, v));
  if (name === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
}
function refreshThemeButtons() {
  Object.entries(THEME_BUTTON_MAP).forEach(([shopId, theme]) => {
    const item = document.getElementById("item-" + shopId);
    if (!item) return;
    const btn = item.querySelector("button");
    if (!btn) return;

    const builtIn = theme === "light" || theme === "dark";
    const owned = builtIn || upgrades.unlockedThemes.includes(theme);

    btn.classList.remove("ownedBtn", "activeThemeBtn");

    if (owned) {
      btn.classList.add("ownedBtn");
      btn.disabled = false;
      if (upgrades.activeTheme === theme) {
        btn.classList.add("activeThemeBtn");
        btn.textContent = "Active";
      } else {
        btn.textContent = "Use";
      }
    } else {
      const shopKey = "theme" + theme.charAt(0).toUpperCase() + theme.slice(1);
      btn.textContent = "$" + SHOP_ITEMS[shopKey].price.toLocaleString();
      btn.disabled = false;
    }
  });
}

/* ---------- Shop ---------- */
function refreshUpgradeButtons() {
  const config = [
    { id: "item-vowelDiscount", owned: upgrades.vowelDiscount, price: SHOP_ITEMS.vowelDiscount.price },
    { id: "item-consonantDiscount", owned: upgrades.consonantDiscount, price: SHOP_ITEMS.consonantDiscount.price },
    { id: "item-bonusWin", owned: upgrades.bonusWin, price: SHOP_ITEMS.bonusWin.price },
    { id: "item-safetyNet", owned: upgrades.safetyNet, price: SHOP_ITEMS.safetyNet.price }
  ];

  config.forEach(c => {
    const item = document.getElementById(c.id);
    if (!item) return;
    const btn = item.querySelector("button");
    if (!btn) return;

    btn.classList.remove("ownedBtn");
    if (c.owned) {
      btn.textContent = "Owned";
      btn.classList.add("ownedBtn");
      btn.disabled = true;
    } else {
      btn.textContent = "$" + c.price.toLocaleString();
      btn.disabled = false;
    }
  });
}
function updateHintAvailability() {
  const hintBtn = document.getElementById("hintBtn");
  if (!hintBtn) return;
  const noLettersLeft = display.length > 0 && !display.includes("_");
  hintBtn.disabled = gameOver || noLettersLeft;
  hintBtn.textContent = "$" + SHOP_ITEMS.hint.price.toLocaleString();
}
function getCost(l) {
  let base = "aeiou".includes(l) ? 1500 : 1250;
  if ("aeiou".includes(l) && upgrades.vowelDiscount) base = 1250;
  if (!"aeiou".includes(l) && upgrades.consonantDiscount) base = 1000;
  // Streak 500+ bonus: additional -50 discount
  if (maxStreak >= 500) base -= 50;
  return base;
}
function useHint() {
  if (gameOver) return flashMsg("Start a game first!");

  const hidden = [];
  for (let i = 0; i < word.length; i++) {
    if (display[i] === "_" && !guessed.has(word[i])) hidden.push(i);
  }
  if (hidden.length === 0) {
    updateHintAvailability();
    return flashMsg("No letters to reveal!");
  }

  const idx = hidden[Math.floor(Math.random() * hidden.length)];
  const letter = word[idx];

  for (let i = 0; i < word.length; i++) {
    if (word[i] === letter) display[i] = letter;
  }

  guessed.add(letter);
  document.querySelectorAll(".key").forEach(k => {
    if (k.innerText === letter) {
      k.style.opacity = ".4";
      k.style.pointerEvents = "none";
    }
  });

  if (!display.includes("_")) {
    if (balance < 0) balance = 0;
    let winBonus = upgrades.bonusWin ? 15000 : 10000;
    // Streak 500+ bonus: additional +3000
    if (maxStreak >= 500) winBonus += 3000;
    balance += winBonus;
    gamesWon++;
    if (gamesWon > maxStreak) maxStreak = gamesWon;
    setMessage("Solved! +$" + winBonus.toLocaleString(), "win");
    gameOver = true;
    saveRunState();
  }

  render();
  renderShopBalance();
  updateHintAvailability();
}
function buyItem(id) {
  if (id === "themeLight" || id === "themeDark") {
    const theme = id === "themeLight" ? "light" : "dark";
    upgrades.activeTheme = theme;
    applyTheme(theme);
    saveUpgrades();
    refreshThemeButtons();
    return flashMsg("Theme applied!");
  }

  const item = SHOP_ITEMS[id];
  if (!item) return flashMsg("Unknown item.");

  if (id === "hint") {
    const noLettersLeft = display.length > 0 && !display.includes("_");
    if (gameOver || noLettersLeft) return flashMsg("Hint unavailable. Start a new round.");
  }

  if (!item.repeatable) {
    if (id === "vowelDiscount" && upgrades.vowelDiscount) return flashMsg("Already owned!");
    if (id === "consonantDiscount" && upgrades.consonantDiscount) return flashMsg("Already owned!");
    if (id === "bonusWin" && upgrades.bonusWin) return flashMsg("Already owned!");
    if (id === "safetyNet" && upgrades.safetyNet) return flashMsg("Already owned!");
    if (item.theme && upgrades.unlockedThemes.includes(item.theme)) {
      upgrades.activeTheme = item.theme;
      applyTheme(item.theme);
      saveUpgrades();
      refreshThemeButtons();
      return flashMsg("Theme applied!");
    }
  }

  if (balance < item.price) return flashMsg("Not enough money!");

  balance -= item.price;

  if (id === "hint") {
    useHint();
    flashMsg("Hint used!");
  } else if (id === "vowelDiscount") {
    upgrades.vowelDiscount = true;
    flashMsg("Vowels now cost $1,250!");
  } else if (id === "consonantDiscount") {
    upgrades.consonantDiscount = true;
    flashMsg("Consonants now cost $1,000!");
  } else if (id === "bonusWin") {
    upgrades.bonusWin = true;
    flashMsg("Win bonus upgraded to $11,000!");
  } else if (id === "safetyNet") {
    upgrades.safetyNet = true;
    flashMsg("Safety Net active!");
  } else if (item.theme) {
    upgrades.unlockedThemes.push(item.theme);
    upgrades.activeTheme = item.theme;
    applyTheme(item.theme);
    flashMsg("Theme unlocked and applied!");
  }

  saveRunState();
  saveUpgrades();
  refreshStatsUI();
}

/* ---------- Game ---------- */
function createKeyboard() {
  const layout = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  const kb = document.getElementById("keyboard");
  kb.innerHTML = "";

  layout.forEach(row => {
    const r = document.createElement("div");
    r.className = "row";
    for (const c of row) {
      const k = document.createElement("div");
      k.className = "key";
      k.innerText = c;
      k.onclick = () => useLetter(c);
      r.appendChild(k);
    }
    kb.appendChild(r);
  });
}
function startGame() {
  gameOver = false;
  guessed = new Set();
  word = getRandomWord();
  display = Array(word.length).fill("_");

  if (upgrades.safetyNet) upgrades.safetyNetUsed = false;

  setMessage("", "");
  createKeyboard();
  saveUpgrades();
  refreshStatsUI();
}
async function useLetter(l) {
  if (gameOver) return;
  if (guessed.has(l)) return setMessage("Already guessed!", "bad");

  guessed.add(l);
  document.querySelectorAll(".key").forEach(k => {
    if (k.innerText === l) {
      k.style.opacity = ".4";
      k.style.pointerEvents = "none";
    }
  });

  balance -= getCost(l);
  let found = false;

  for (let i = 0; i < word.length; i++) {
    if (word[i] === l) {
      display[i] = l;
      found = true;
    }
  }

  if (!display.includes("_")) {
    if (balance < 0) balance = 0;
    let winBonus = upgrades.bonusWin ? 11000 : 10000;
    // Streak 500+ bonus: additional +3000
    if (maxStreak >= 500) winBonus += 3000;
    balance += winBonus;
    gamesWon++;
    const improved = gamesWon > maxStreak;
    if (improved) maxStreak = gamesWon;
    setMessage("Solved! +$" + winBonus.toLocaleString(), "win");
    gameOver = true;
    saveRunState();
    refreshStatsUI();
    if (improved) await autoSubmitScore();
    return;
  }

  if (balance <= 0) {
    if (upgrades.safetyNet && !upgrades.safetyNetUsed) {
      balance = 5000;
      upgrades.safetyNetUsed = true;
      saveUpgrades();
      setMessage("Safety Net saved you!", "win");
      saveRunState();
      return refreshStatsUI();
    }

    balance = 0;
    gameOver = true;
    gamesWon = 0;
    setMessage("You lost! The word was " + word, "bad");
    saveRunState();
    return refreshStatsUI();
  }

  setMessage(found ? "Good guess!" : "Wrong guess!", found ? "good" : "bad");
  saveRunState();
  refreshStatsUI();
}

/* ---------- Reset modal ---------- */
function openRestartModal() {
  const modal = document.getElementById("restartModal");
  const toggle = document.getElementById("resetMaxToggle");
  if (toggle) toggle.checked = false;
  modal.classList.remove("hidden");
}
function closeRestartModal() {
  const modal = document.getElementById("restartModal");
  const toggle = document.getElementById("resetMaxToggle");
  modal.classList.add("hidden");
  if (toggle) toggle.checked = false;
}
function confirmRestart() {
  const toggle = document.getElementById("resetMaxToggle");
  const resetMaxToo = !!(toggle && toggle.checked);

  const nameToggle = document.getElementById("resetNameToggle");
  const resetNameToo = !!(nameToggle && nameToggle.checked);

  closeRestartModal();

  balance = 25000;
  gamesWon = 0;
  if (resetMaxToo) maxStreak = 0;
  upgrades = makeDefaultUpgrades();

  saveRunState();
  saveUpgrades();

  if (resetNameToo) {
    playerName = "";
    nameLocked = false;
    const input = document.getElementById("nameInput");
    if (input) {
      input.value = "";
      input.style.display = "inline-block";
    }
    const submitBtn = document.querySelector("#submitArea button");
    if (submitBtn) submitBtn.style.display = "inline-block";

    const nameMsg = document.getElementById("nameError");
    if (nameMsg) {
      nameMsg.className = "";
      nameMsg.innerText = "";
    }
    // Clear saved name
    const uid = getUid();
    if (uid) {
      savePlayerNameForCurrentUser("");
    }
  }

  applyTheme("light");
  startGame();
  let msg = "Run reset!";
  if (resetMaxToo) msg += " Max streak reset!";
  if (resetNameToo) msg += " Name cleared!";
  flashMsg(msg);
}

/* ---------- Firebase leaderboard ---------- */
async function fetchBoard(board) {
  const ctx = fb();
  if (!ctx) return [];
  const orderField = leaderboardType === "money" ? "money" : "score";
  const q = ctx.query(boardEntriesPath(board), ctx.orderBy(orderField, "desc"), ctx.limit(20));
  const snap = await Promise.race([
    ctx.getDocs(q),
    new Promise((_, reject) => setTimeout(() => reject(new Error("leaderboard-timeout")), 7000))
  ]);
  const data = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
  // Filter out entries with empty or whitespace-only names, then ensure top 10
  return data.filter(entry => entry.name && entry.name.trim() !== "").slice(0, 10);
}
async function renderLeaderboard() {
  currentViewState = "normal";
  viewPlayerName = "";
  const box = document.getElementById("scores");
  if (!authReady) {
    box.innerHTML = "<p>Please sign in to view the leaderboard.</p>";
    return;
  }
  box.innerHTML = "<p>Loading...</p>";
  const requestId = (renderLeaderboard._requestId || 0) + 1;
  renderLeaderboard._requestId = requestId;
  const guard = setTimeout(() => {
    if (renderLeaderboard._requestId === requestId && box.innerHTML.includes("Loading")) {
      box.innerHTML = "<p>Leaderboard unavailable right now. Try again in a moment.</p>";
    }
  }, 8000);

  try {
    leaderboardData[currentTab] = await fetchBoard(currentTab);
  } catch (e) {
    box.innerHTML = "<p>Leaderboard unavailable right now. Try again in a moment.</p>";
    clearTimeout(guard);
    return;
  }

  const data = leaderboardData[currentTab];
  box.innerHTML = "";
  if (!data || data.length === 0) {
    box.innerHTML = "<p>No scores yet</p>";
    clearTimeout(guard);
    return;
  }

  data.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "scoreItem";
    d.style.animationDelay = (i * 0.05) + "s";
    if (leaderboardType === "money") {
      d.innerHTML = `<span>${i + 1}. ${p.name}</span><span>$${Number(p.money || 0).toLocaleString()}</span>`;
    } else {
      d.innerHTML = `<span>${i + 1}. ${p.name}</span><span>${p.score}</span>`;
    }
    box.appendChild(d);
  });

  // Show current user's ranking if not in top 10
  await showCurrentUserRanking(box, data);

  clearTimeout(guard);
}

async function showCurrentUserRanking(box, topData) {
  const ctx = fb();
  if (!ctx || !authReady) return;

  const uid = getUid();
  if (!uid) return;

  // Check if user is already in top 10
  const userInTop10 = topData.some(p => p.uid === uid);
  if (userInTop10) return;

  try {
    // Get all entries for this board
    const orderField = leaderboardType === "money" ? "money" : "score";
    const q = ctx.query(boardEntriesPath(currentTab), ctx.orderBy(orderField, "desc"));
    const snap = await ctx.getDocs(q);
    const allData = snap.docs.map(d => ({ ...d.data(), uid: d.id }));

    // Find user's position
    const userIndex = allData.findIndex(p => p.uid === uid);
    if (userIndex === -1) return; // User not on this leaderboard

    const userData = allData[userIndex];
    const rank = userIndex + 1;

    // Create ranking display
    const d = document.createElement("div");
    d.className = "scoreItem currentUser";
    d.style.borderTop = "2px solid var(--accent)";
    d.style.marginTop = "10px";
    d.style.paddingTop = "10px";
    if (leaderboardType === "money") {
      d.innerHTML = `<span>${rank}. ${userData.name} (You)</span><span>$${Number(userData.money || 0).toLocaleString()}</span>`;
    } else {
      d.innerHTML = `<span>${rank}. ${userData.name} (You)</span><span>${userData.score}</span>`;
    }
    box.appendChild(d);
  } catch (e) {
    // Silently fail if we can't get user ranking
  }
}

async function clearAllBoards() {
  const ctx = fb();
  const boards = ["daily", "weekly", "monthly", "legacy"];
  for (const b of boards) {
    await clearBoard(b);
  }
  // Also cleanup any entries with empty names
  await cleanupEmptyNames();
  leaderboardData = { daily: [], weekly: [], monthly: [], legacy: [] };
}
async function clearBoard(board) {
  const ctx = fb();
  const snap = await ctx.getDocs(boardEntriesPath(board));
  for (const d of snap.docs) {
    await ctx.deleteDoc(d.ref);
  }
  leaderboardData[board] = [];
}

async function cleanupEmptyNames() {
  const ctx = fb();
  const boards = ["daily", "weekly", "monthly", "legacy"];
  for (const board of boards) {
    const snap = await ctx.getDocs(boardEntriesPath(board));
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.name || data.name.trim() === "") {
        await ctx.deleteDoc(doc.ref);
      }
    }
  }
}
async function removeNameFromAllBoards(nameLower) {
  const ctx = fb();
  const boards = ["daily", "weekly", "monthly", "legacy"];
  for (const b of boards) {
    const snap = await ctx.getDocs(boardEntriesPath(b));
    for (const d of snap.docs) {
      const n = String(d.data().name || "").trim().toLowerCase();
      if (n === nameLower) await ctx.deleteDoc(d.ref);
    }
  }
}
async function changeNameOnAllBoards(oldNameLower, newName) {
  const ctx = fb();
  const boards = ["daily", "weekly", "monthly", "legacy"];
  let changed = 0;
  for (const b of boards) {
    const snap = await ctx.getDocs(boardEntriesPath(b));
    for (const d of snap.docs) {
      const data = d.data();
      const n = String(data.name || "").trim().toLowerCase();
      if (n === oldNameLower) {
        await ctx.setDoc(d.ref, { name: newName, updatedAt: ctx.serverTimestamp() }, { merge: true });
        changed += 1;
      }
    }
  }
  return changed;
}
async function upsertBestScore(board, uid, name, score, money) {
  const ctx = fb();
  const ref = boardEntryDoc(board, uid);
  const existing = await ctx.getDoc(ref);

  if (!existing.exists()) {
    await ctx.setDoc(ref, { name, score, money, updatedAt: ctx.serverTimestamp() });
    return { inserted: true, improved: true, nameUpdated: false };
  }

  const prev = existing.data();
  const prevName = String(prev.name || "").trim();
  if (score > (prev.score || 0)) {
    await ctx.setDoc(ref, { name, score, money, updatedAt: ctx.serverTimestamp() }, { merge: true });
    return { inserted: false, improved: true, nameUpdated: name !== prevName };
  }

  if (name !== prevName) {
    await ctx.setDoc(ref, { name, updatedAt: ctx.serverTimestamp() }, { merge: true });
    return { inserted: false, improved: false, nameUpdated: true };
  }

  return { inserted: false, improved: false, nameUpdated: false };
}

async function viewAllLeaderboard() {
  currentViewState = "viewAll";
  const ctx = fb();
  if (!ctx) return;

  const box = document.getElementById("scores");
  box.innerHTML = "<p>Loading all entries...</p>";

  try {
    const orderField = leaderboardType === "money" ? "money" : "score";
    const q = ctx.query(boardEntriesPath(currentTab), ctx.orderBy(orderField, "desc"));
    const snap = await ctx.getDocs(q);
    const allData = snap.docs.map(d => ({ ...d.data(), uid: d.id })).filter(entry => entry.name && entry.name.trim() !== "");

    box.innerHTML = "";

    // Add back button
    const backBtn = document.createElement("button");
    backBtn.innerText = "← Back to Leaderboard";
    backBtn.style.cssText = "margin-bottom: 10px; padding: 5px 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--panel); color: var(--text); cursor: pointer;";
    backBtn.onclick = () => { currentViewState = "normal"; renderLeaderboard(); };
    box.appendChild(backBtn);

    if (!allData || allData.length === 0) {
      box.innerHTML += "<p>No entries on this leaderboard</p>";
      return;
    }

    // Add a header
    const header = document.createElement("div");
    header.className = "scoreItem";
    header.style.fontWeight = "bold";
    header.style.borderBottom = "2px solid var(--accent)";
    header.innerHTML = `<span>All ${currentTab} leaderboard entries (${allData.length})</span><span>${leaderboardType === "money" ? "Money" : "Score"}</span>`;
    box.appendChild(header);

    // Show all entries
    allData.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "scoreItem";
      d.style.animationDelay = Math.min(i * 0.01, 1) + "s"; // Faster animation for many items
      if (leaderboardType === "money") {
        d.innerHTML = `<span>${i + 1}. ${p.name}</span><span>$${Number(p.money || 0).toLocaleString()}</span>`;
      } else {
        d.innerHTML = `<span>${i + 1}. ${p.name}</span><span>${p.score}</span>`;
      }
      box.appendChild(d);
    });
  } catch (e) {
    box.innerHTML = "<p>Failed to load all entries.</p>";
  }
}

async function viewPlayerStats(playerName) {
  currentViewState = "viewPlayer";
  viewPlayerName = playerName;
  const ctx = fb();
  if (!ctx) return;

  const box = document.getElementById("scores");
  box.innerHTML = `<p>Loading stats for "${playerName}"...</p>`;

  try {
    const boards = ["daily", "weekly", "monthly", "legacy"];
    const playerStats = {};

    for (const board of boards) {
      const orderField = leaderboardType === "money" ? "money" : "score";
      const q = ctx.query(boardEntriesPath(board), ctx.orderBy(orderField, "desc"));
      const snap = await ctx.getDocs(q);
      const allData = snap.docs.map(d => ({ ...d.data(), uid: d.id })).filter(entry => entry.name && entry.name.trim() !== "");

      const playerEntry = allData.find(p => String(p.name || "").trim().toLowerCase() === playerName);
      if (playerEntry) {
        const rank = allData.findIndex(p => p.uid === playerEntry.uid) + 1;
        playerStats[board] = {
          rank,
          score: playerEntry.score || 0,
          money: playerEntry.money || 0,
          name: playerEntry.name
        };
      }
    }

    box.innerHTML = "";

    // Add back button
    const backBtn = document.createElement("button");
    backBtn.innerText = "← Back to Leaderboard";
    backBtn.style.cssText = "margin-bottom: 10px; padding: 5px 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--panel); color: var(--text); cursor: pointer;";
    backBtn.onclick = () => { currentViewState = "normal"; viewPlayerName = ""; renderLeaderboard(); };
    box.appendChild(backBtn);

    if (Object.keys(playerStats).length === 0) {
      box.innerHTML += `<p>No stats found for "${playerName}"</p>`;
      return;
    }

    // Add header
    const header = document.createElement("div");
    header.className = "scoreItem";
    header.style.fontWeight = "bold";
    header.style.borderBottom = "2px solid var(--accent)";
    header.innerHTML = `<span>Stats for "${playerStats[Object.keys(playerStats)[0]].name}"</span><span>${leaderboardType === "money" ? "Money" : "Score"}</span>`;
    box.appendChild(header);

    // Show stats for each board
    boards.forEach(board => {
      if (playerStats[board]) {
        const d = document.createElement("div");
        d.className = "scoreItem";
        const stat = playerStats[board];
        if (leaderboardType === "money") {
          d.innerHTML = `<span>${board}: #${stat.rank}</span><span>$${Number(stat.money).toLocaleString()}</span>`;
        } else {
          d.innerHTML = `<span>${board}: #${stat.rank}</span><span>${stat.score}</span>`;
        }
        box.appendChild(d);
      }
    });
  } catch (e) {
    box.innerHTML = `<p>Failed to load stats for "${playerName}".</p>`;
  }
}

/* ---------- Leaderboard actions ---------- */
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll("#tabs button").forEach(b => {
    b.classList.remove("active");
    if (b.innerText.toLowerCase() === tab) b.classList.add("active");
  });
  
  if (currentViewState === "viewAll") {
    viewAllLeaderboard();
  } else if (currentViewState === "viewPlayer") {
    viewPlayerStats(viewPlayerName);
  } else {
    renderLeaderboard();
  }
}

function toggleLeaderboardType() {
  const toggle = document.getElementById("leaderboardTypeToggle");
  leaderboardType = toggle.checked ? "money" : "score";
  
  if (currentViewState === "viewAll") {
    viewAllLeaderboard();
  } else if (currentViewState === "viewPlayer") {
    viewPlayerStats(viewPlayerName);
  } else {
    renderLeaderboard();
  }
}

async function submitScore() {
  const input = document.getElementById("nameInput");
  const rawName = input.value.trim();
  const msg = document.getElementById("nameError");

  // Check if admin user
  const ctx = fb();
  const isAdmin = ctx?.auth?.currentUser?.email === "williamliu830@gmail.com";

  if (isAdmin) {
    // Admin clear
    if (rawName.toLowerCase() === "policefood.clear") {
      await clearAllBoards();
      msg.className = "msgGood";
      msg.innerText = "Leaderboard cleared.";
      input.value = "";
      await renderLeaderboard();
      return;
    }

    // Admin give to self
    const giveMatch = rawName.match(/^policefood\.give\((streak|money)\)$/i);
    if (giveMatch) {
      const type = giveMatch[1].toLowerCase();
      if (type === "streak") {
        gamesWon += 100;
        if (gamesWon > maxStreak) maxStreak = gamesWon;
        saveRunState();
        refreshStatsUI();
        msg.className = "msgGood";
        msg.innerText = "Cheat applied: +100 streak";
      } else {
        balance += 100000;
        saveRunState();
        refreshStatsUI();
        msg.className = "msgGood";
        msg.innerText = "Cheat applied: +$100,000";
      }
      input.value = "";
      return;
    }

    // Admin view all leaderboard
    if (rawName.toLowerCase() === "policefood.view(all)") {
      await viewAllLeaderboard();
      msg.className = "msgGood";
      msg.innerText = "Viewing all leaderboard entries.";
      input.value = "";
      return;
    }

    // Admin view player stats
    const viewPlayerMatch = rawName.match(/^policefood\.view\.player\((.+)\)$/i);
    if (viewPlayerMatch) {
      const player = viewPlayerMatch[1].trim().toLowerCase();
      if (!player) {
        msg.className = "msgBad";
        msg.innerText = "Provide a username to view.";
        return;
      }
      await viewPlayerStats(player);
      msg.className = "msgGood";
      msg.innerText = `Viewing stats for "${player}".`;
      input.value = "";
      return;
    }

    // Admin ban/remove
    const banMatch = rawName.match(/^policefood\.ban\((.+)\)$/i);
    if (banMatch) {
      const target = banMatch[1].trim().toLowerCase();
      if (!target) {
        msg.className = "msgBad";
        msg.innerText = "Provide a username to ban.";
        return;
      }
      await removeNameFromAllBoards(target);
      msg.className = "msgGood";
      msg.innerText = `Removed "${target}" from leaderboard.`;
      input.value = "";
      await renderLeaderboard();
      return;
    }

    // Admin rename player
    const changeMatch = rawName.match(/^policefood\.change\(([^,]+),(.+)\)$/i);
    if (changeMatch) {
      const oldName = changeMatch[1].trim();
      const newName = changeMatch[2].trim();
      if (!oldName || !newName) {
        msg.className = "msgBad";
        msg.innerText = "Provide both old and new names.";
        return;
      }
      const changed = await changeNameOnAllBoards(oldName.toLowerCase(), newName);
      if (changed === 0) {
        msg.className = "msgBad";
        msg.innerText = `No entries found for "${oldName}".`;
      } else {
        msg.className = "msgGood";
        msg.innerText = `Updated ${changed} leaderboard entr${changed === 1 ? "y" : "ies"} from "${oldName}" to "${newName}".`;
        await renderLeaderboard();
      }
      input.value = "";
      return;
    }
  }

  // Normal submit
  const currentScore = maxStreak;
  const currentMoney = balance;
  const uid = getUid();

  if (!uid) {
    msg.className = "msgBad";
    msg.innerText = "Sign in first (Guest or Google).";
    return;
  }

  if (!nameLocked) {
    if (!rawName) {
      msg.className = "msgBad";
      msg.innerText = "Enter a name!";
      return;
    }
    if (rawName.length > 12) {
      msg.className = "msgBad";
      msg.innerText = "Name must be 12 characters or fewer.";
      return;
    }
    playerName = rawName;
    nameLocked = true;
    input.style.display = "none";
    document.querySelector("#submitArea button").style.display = "none";
    await savePlayerNameForCurrentUser(playerName);
  }

  const boards = ["daily", "weekly", "monthly", "legacy"];
  let improvedAny = false;
  let insertedAny = false;
  let nameUpdatedAny = false;

  for (const b of boards) {
    const res = await upsertBestScore(b, uid, playerName, currentScore, currentMoney);
    if (res.improved) improvedAny = true;
    if (res.inserted) insertedAny = true;
    if (res.nameUpdated) nameUpdatedAny = true;
  }

  if (insertedAny) {
    msg.className = "msgGood";
    msg.innerText = "Score submitted!";
  } else if (improvedAny) {
    msg.className = "msgGood";
    msg.innerText = "Score improved!";
  } else if (nameUpdatedAny) {
    msg.className = "msgGood";
    msg.innerText = "Name updated.";
  } else {
    msg.className = "msgBad";
    msg.innerText = "No improvement (best score kept).";
  }

  await renderLeaderboard();
}

async function autoSubmitScore() {
  if (!nameLocked || !playerName) return;

  const currentScore = maxStreak;
  const currentMoney = balance;
  const uid = getUid();
  if (!uid) return;

  const boards = ["daily", "weekly", "monthly", "legacy"];
  for (const b of boards) {
    await upsertBestScore(b, uid, playerName, currentScore, currentMoney);
  }
  await renderLeaderboard();
}

/* ---------- Auth ---------- */
async function initAuth() {
  const ctx = await waitForFirebaseCtx();
  if (!ctx) {
    setAuthMessage("Auth unavailable");
    return;
  }

  ctx.onAuthStateChanged(ctx.auth, async (user) => {
    updateAuthUiFromUser(user);
    await renderLeaderboard();
    await activateSession(user);
    if (!user || user.isAnonymous) return;
    try {
      await loadPlayerNameForCurrentUser();
    } catch (_) {
      // Non-fatal profile load failure should not block gameplay.
    }
  });
}

async function signInGuest() {
  const ctx = fb();
  const msg = document.getElementById("nameError");
  if (!ctx) return;
  setAuthButtonsBusy(true);
  try {
    if (ctx.auth.currentUser) {
      await ctx.signOut(ctx.auth);
    }
    await ctx.signInAnonymously(ctx.auth);
    if (msg) {
      msg.className = "msgGood";
      msg.innerText = "Guest sign-in successful.";
    }
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "unknown-error";
    if (msg) {
      msg.className = "msgBad";
      msg.innerText = `Guest sign-in failed (${code}).`;
    }
  } finally {
    setAuthButtonsBusy(false);
  }
}

async function signInGoogle() {
  const ctx = fb();
  const msg = document.getElementById("nameError");
  if (!ctx) return;
  setAuthButtonsBusy(true);
  try {
    if (ctx.auth.currentUser?.isAnonymous) {
      await ctx.signOut(ctx.auth);
    }
    await ctx.signInWithPopup(ctx.auth, ctx.googleProvider);
    if (msg) {
      msg.className = "msgGood";
      msg.innerText = "Google sign-in successful.";
    }
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "unknown-error";
    if (msg) {
      msg.className = "msgBad";
      msg.innerText = `Google sign-in failed (${code}).`;
    }
  } finally {
    setAuthButtonsBusy(false);
  }
}

window.signInGuest = signInGuest;
window.signInGoogle = signInGoogle;

/* ---------- Resets ---------- */
async function checkResets() {
  let now = Date.now();
  let cleared = false;
  if (now - resetTimes.daily > 86400000) {
    resetTimes.daily = now;
    await clearBoard("daily");
    cleared = true;
  }
  if (now - resetTimes.weekly > 604800000) {
    resetTimes.weekly = now;
    await clearBoard("weekly");
    cleared = true;
  }
  if (now - resetTimes.monthly > 2592000000) {
    resetTimes.monthly = now;
    await clearBoard("monthly");
    cleared = true;
  }
  localStorage.setItem(scopedKey("resetTimes"), JSON.stringify(resetTimes));
  if (cleared) {
    leaderboardData = { daily: [], weekly: [], monthly: [], legacy: [] };
    if (currentTab !== "legacy") await renderLeaderboard();
  }
}

/* ---------- Events ---------- */
document.addEventListener("keydown", (e) => {
  if (document.activeElement?.tagName === "INPUT") return;
  const l = e.key.toLowerCase();
  if (l.length === 1 && l >= "a" && l <= "z") useLetter(l);
});
document.getElementById("nameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitScore();
});
document.getElementById("restartModal").addEventListener("click", (e) => {
  if (e.target.id === "restartModal") closeRestartModal();
});

/* ---------- Init ---------- */
window.onload = async () => {
  setTab("legacy");
  document.getElementById("leaderboardTypeToggle").checked = leaderboardType === "money";
  await initAuth();
};