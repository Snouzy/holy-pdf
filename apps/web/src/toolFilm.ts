function setupToolFilm() {
  const dialog = document.querySelector<HTMLDialogElement>("dialog.reel");
  const open = document.querySelector(".reel-open");
  const video = dialog?.querySelector("video");
  const end = dialog?.querySelector<HTMLElement>(".reel-end");
  if (!dialog || !open || !video || !end || dialog.dataset.live !== undefined) return;
  dialog.dataset.live = "";
  const play = () => {
    end.hidden = true;
    video.currentTime = 0;
    // The browser may refuse to start it (codec, autoplay rules): its controls stay there.
    video.play().catch(() => undefined);
  };
  open.addEventListener("click", () => {
    // Set on the first opening only: nothing of the film loads before.
    video.src ||= dialog.dataset.src ?? "";
    dialog.showModal();
    play();
  });
  video.addEventListener("ended", () => {
    end.hidden = false;
    end.querySelector("button")?.focus();
  });
  end.querySelector(".reel-again")?.addEventListener("click", play);
  end.querySelector(".reel-choose")?.addEventListener("click", () => {
    dialog.close();
    document.querySelector<HTMLInputElement>(".dropzone input[type=file]")?.click();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => video.pause());
}

document.addEventListener("astro:page-load", setupToolFilm);
setupToolFilm();
