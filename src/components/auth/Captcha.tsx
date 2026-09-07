import { useCallback, useEffect, useId, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/api";
import { adminEndpoints } from "@/helpers/admin/endpoints";

export interface CaptchaHandle {
  captchaId: string;
  image: string;
  value: string;
  setValue: (value: string) => void;
  refresh: () => void;
}

/** Fetches a captcha image + id and manages the visitor's typed answer.
 * Call `refresh()` after a failed login so a spent/rejected code can't be reused. */
export function useCaptcha(): CaptchaHandle {
  const [captchaId, setCaptchaId] = useState("");
  const [image, setImage] = useState("");
  const [value, setValue] = useState("");

  const refresh = useCallback(() => {
    setValue("");
    api
      .get(`/${adminEndpoints.captcha}/`)
      .then((res) => {
        setCaptchaId(res.data?.captcha_id ?? "");
        setImage(res.data?.image ?? "");
      })
      .catch(() => {
        setCaptchaId("");
        setImage("");
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { captchaId, image, value, setValue, refresh };
}

interface CaptchaFieldProps {
  captcha: CaptchaHandle;
  inputClassName?: string;
  imageWrapClassName?: string;
  invalid?: boolean;
}

/** Renders the captcha image + refresh button + a bare <input>, unstyled by
 * default so each login page's own field/label markup can wrap it. */
export function CaptchaField({
  captcha,
  inputClassName,
  imageWrapClassName,
  invalid,
}: CaptchaFieldProps) {
  const inputId = useId();
  const { image } = captcha;

  return (
    <div className="flex items-center gap-2">
      <div
        className={
          imageWrapClassName ??
          "flex h-14 w-[168px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        }
      >
        {image ? (
          <img src={image} alt="Captcha" className="h-full w-full object-cover select-none" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center whitespace-nowrap text-xs text-slate-400">
            Loading…
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={captcha.refresh}
        aria-label="Refresh captcha"
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:text-slate-700"
      >
        <RefreshCw size={16} />
      </button>
      <input
        id={inputId}
        name="captcha"
        type="text"
        autoComplete="off"
        placeholder="Enter code"
        value={captcha.value}
        onChange={(e) => captcha.setValue(e.target.value)}
        aria-invalid={invalid}
        className={inputClassName ?? "h-14 flex-1 min-w-0 rounded-lg border border-slate-200 px-3 text-sm"}
      />
    </div>
  );
}
