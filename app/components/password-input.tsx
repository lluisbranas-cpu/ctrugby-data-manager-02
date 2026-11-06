"use client";

import { InputHTMLAttributes, useState } from "react";

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement>;

export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return <div className="relative">
    <input {...props} type={visible ? "text" : "password"} className={`${className} pr-20`} />
    <button
      type="button"
      aria-pressed={visible}
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      className="absolute inset-y-1 right-1 rounded px-3 text-xs font-bold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
      onClick={() => setVisible((current) => !current)}
    >
      {visible ? "Ocultar" : "Ver"}
    </button>
  </div>;
}
