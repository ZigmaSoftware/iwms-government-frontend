import type { AttachmentPreviewProps } from "@/features/grievances/types";

const FILE_ICON =
  "https://cdn-icons-png.flaticon.com/512/337/337946.png";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const isImage = (url: string) => {
  const lower = url.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export function AttachmentPreview({ label, fileUrl }: AttachmentPreviewProps) {
  const handleOpen = () => {
    if (fileUrl) {
      window.open(fileUrl, "_blank");
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">{label}</p>

      {!fileUrl && <p>-</p>}
      {fileUrl && isImage(fileUrl) && (
        <img
          src={fileUrl}
          onClick={handleOpen}
          className="h-40 w-full max-w-sm cursor-pointer rounded-xl border object-cover shadow"
        />
      )}
      {fileUrl && !isImage(fileUrl) && (
        <button onClick={handleOpen} type="button">
          <img src={FILE_ICON} alt="Attachment" className="w-16" />
        </button>
      )}
    </div>
  );
}
