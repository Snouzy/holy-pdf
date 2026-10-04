/** Static paper placeholders: no raster work or perpetual animation while the engine loads. */
export function DocumentSkeleton({ label }: { label: string }) {
  return (
    <div class="document-skeleton" role="status" aria-label={label}>
      <div class="document-skeleton-lines" aria-hidden="true">
        <span class="document-skeleton-title" />
        <span class="document-skeleton-subtitle" />
        <span /><span /><span /><span class="document-skeleton-short" />
        <span class="document-skeleton-section" /><span /><span /><span class="document-skeleton-short" />
      </div>
    </div>
  );
}
