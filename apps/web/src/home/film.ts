function setupFilm() {
  const film = document.querySelector<HTMLDialogElement>("dialog.film");
  const watch = document.querySelector(".watch");
  if (!film || !watch || film.dataset.live !== undefined) return;
  film.dataset.live = "";
  const video = film.querySelector("video");
  watch.addEventListener("click", () => {
    film.showModal();
    // The browser may refuse to start it (codec, autoplay rules): its controls stay there.
    video?.play().catch(() => undefined);
  });
  film.addEventListener("click", (event) => {
    if (event.target === film) film.close();
  });
  film.addEventListener("close", () => video?.pause());
}

document.addEventListener("astro:page-load", setupFilm);
setupFilm();
