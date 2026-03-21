import Image from "next/image";
import recordingIcon from "@/components/icons/recording.svg";
import { cn } from "@/lib/cn";

export function RecordButton({
  onClick,
  label = "Record",
  variant = "primary",
  className,
  disabled = false,
}: {
  onClick?: () => void;
  label?: string;
  variant?: "primary" | "fab";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
        variant === "primary" &&
          "bg-red-600 px-8 py-4 text-white shadow-lg hover:bg-red-500",
        variant === "fab" &&
          "h-14 w-14 bg-red-600 text-white shadow-xl hover:bg-red-500 md:h-16 md:w-16",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      aria-label={label}
    >
      <Image
        src={recordingIcon}
        alt=""
        width={recordingIcon.width}
        height={recordingIcon.height}
        unoptimized
        className={cn(
          "object-contain",
          variant === "primary" ? "h-3 w-3" : "h-3.5 w-3.5",
        )}
        aria-hidden
      />
      {variant === "primary" ? (
        <span className="text-base">{label}</span>
      ) : null}
    </button>
  );
}
