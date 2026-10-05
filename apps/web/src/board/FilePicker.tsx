import { useEffect, useRef } from "preact/hooks";
import { Icon, type IconName } from "../illustrations/Icon";
import type { Tool } from "../tools";

type Props = { tool: Tool; label: string; icon?: IconName; onFiles: (files: File[]) => void; camera?: boolean; class?: string };

const accepted = { pdf: "application/pdf,.pdf", image: "image/jpeg,image/png,.jpg,.jpeg,.png", photo: "image/*,.heic,.heif" } as const;

export function FilePicker({ tool, label, icon, onFiles, camera = false, class: extra }: Props) {
  const input = useRef<HTMLInputElement>(null);

  // A file chosen before the island hydrated is still in the input, with no handler to see it.
  useEffect(() => {
    const files = input.current?.files;
    if (input.current && files && files.length > 0) {
      onFiles([...files]);
      input.current.value = "";
    }
  }, []);

  return (
    <label class={extra ? `button ${extra}` : "button"}>
      {icon && <Icon name={icon} size={24} />}
      {label}
      <input
        ref={input}
        class="visually-hidden"
        type="file"
        accept={tool.convertsImages ? `${accepted.pdf},${accepted.image}` : accepted[tool.accepts]}
        capture={camera ? "environment" : undefined}
        multiple={tool.multipleFiles}
        onChange={(event) => {
          onFiles([...(event.currentTarget.files ?? [])]);
          event.currentTarget.value = "";
        }}
      />
    </label>
  );
}
