let virtualRepeat = false;
let seeking = false;

const LOOP_THRESHOLD_MS = 600;
const REPEAT_BUTTON = '[data-testid="control-button-repeat"]';
const ICON_REPEAT_KEY = "repeat-plus:native-repeat";
const ICON_REPEAT_ONCE_KEY = "repeat-plus:native-repeat-once";

function rememberNativeIcon(button: HTMLButtonElement) {
  const svg = button.querySelector<SVGElement>("svg");
  if (!svg) return;

  const state = button.getAttribute("aria-checked");

  // Native Repeat One
  if (state === "mixed") {
    localStorage.setItem(ICON_REPEAT_ONCE_KEY, svg.innerHTML);
  }

  // Native Repeat Off
  if (state === "false") {
    localStorage.setItem(ICON_REPEAT_KEY, svg.innerHTML);
  }
}

function getRepeatIcon() {
  return (
    localStorage.getItem(ICON_REPEAT_KEY) ??
    Spicetify.SVGIcons["repeat"]
  );
}

function getRepeatOnceIcon() {
  return (
    localStorage.getItem(ICON_REPEAT_ONCE_KEY) ??
    Spicetify.SVGIcons["repeat-once"]
  );
}

function repeatIsBlocked(): boolean {
  return (
    Spicetify.Player.data?.restrictions?.canToggleRepeatTrack === false
  );
}

function getRepeatButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(REPEAT_BUTTON);
}

function syncButton() {
  const button = getRepeatButton();
  if (!button) return;

  /*
   * Normal Spotify context.
   * Don't interfere — but learn Spotify's current icons.
   */
  if (!repeatIsBlocked()) {
    rememberNativeIcon(button);

    if (button.dataset.repeatPlusOwned === "true") {
      delete button.dataset.repeatPlusOwned;
      button.style.removeProperty("color");
    }

    return;
  }

  /*
   * Radio / autoplay context.
   */
  button.dataset.repeatPlusOwned = "true";

  // Spotify normally sets disabled="" here.
  button.disabled = false;

  const svg = button.querySelector<SVGElement>("svg");

  if (virtualRepeat) {
    button.setAttribute("aria-checked", "mixed");
    button.setAttribute("aria-label", "Disable repeat");

    if (svg) {
      svg.innerHTML = getRepeatOnceIcon();
    }

    button.style.color = "var(--text-bright-accent)";
  } else {
    button.setAttribute("aria-checked", "false");
    button.setAttribute("aria-label", "Enable repeat");

    if (svg) {
      svg.innerHTML = getRepeatIcon();
    }

    button.style.removeProperty("color");
  }
}

async function main() {
  while (
    !Spicetify?.Player ||
    !Spicetify?.SVGIcons
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /*
   * Repeat engine
   */
  Spicetify.Player.addEventListener("onprogress", () => {
    if (!virtualRepeat || !repeatIsBlocked() || seeking) return;

    const progress = Spicetify.Player.getProgress();
    const duration = Spicetify.Player.getDuration();

    if (!duration) return;

    if (duration - progress <= LOOP_THRESHOLD_MS) {
      seeking = true;

      Spicetify.Player.seek(0);

      setTimeout(() => {
        seeking = false;
      }, 1000);
    }
  });

  /*
   * Intercept Spotify's existing repeat button.
   *
   * Capture phase means we catch the click before Spotify's
   * own React handler receives it.
   */
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;

      const button =
        target?.closest<HTMLButtonElement>(REPEAT_BUTTON);

      if (!button) return;

      // Normal repeatable context:
      // Spotify receives the click normally.
      if (!repeatIsBlocked()) return;

      // Blocked radio/autoplay context:
      // stop Spotify receiving a command it will reject.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      virtualRepeat = !virtualRepeat;

      syncButton();

      console.log(
        `[RepeatPlus] Virtual Repeat ${virtualRepeat ? "ON" : "OFF"}`
      );
    },
    true
  );

  /*
   * Spotify can recreate the player controls through React.
   * Re-sync periodically rather than holding a reference to
   * an old DOM element.
   */
  setInterval(syncButton, 750);

  Spicetify.Player.addEventListener("songchange", () => {
    setTimeout(syncButton, 0);
  });

  /*
   * Temporary debugging API.
   */
  (window as any).RepeatPlus = {
    enable() {
      virtualRepeat = true;
      syncButton();
    },

    disable() {
      virtualRepeat = false;
      syncButton();
    },

    toggle() {
      virtualRepeat = !virtualRepeat;
      syncButton();
    },

    getState() {
      return virtualRepeat;
    },

    isBlocked() {
      return repeatIsBlocked();
    },
  };

  syncButton();

  Spicetify.showNotification("Repeat Plus loaded");
}

export default main;
